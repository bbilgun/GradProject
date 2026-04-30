"""
PDFProcessor — Downloads MUST official PDFs, extracts and chunks text,
then adds chunks to the live RAG/FAISS index.

Features
--------
- Async download via httpx (30 s timeout, redirect follow)
- Text extraction via pdfplumber (handles Mongolian Cyrillic well)
- OCR fallback for scanned PDFs via PyMuPDF + Tesseract when no text layer exists
- Recursive character text splitter (paragraph → line → sentence → word → char)
- SHA-256 hash cache (pdf_cache.json) — skips unchanged PDFs
- Thread-safe: the FAISS mutation is serialised by the caller's asyncio.Lock
"""

from __future__ import annotations

import asyncio
import hashlib
import importlib.util
import json
import os
import re
import shutil
import subprocess
import tempfile
from dataclasses import dataclass, field
from io import BytesIO
from pathlib import Path
from typing import TYPE_CHECKING

import httpx
import pdfplumber

from chunk_cache import (
    get_cached_chunks,
    load_chunk_cache,
    put_cached_chunks,
    rag_has_source,
    save_chunk_cache,
)

if TYPE_CHECKING:
    from rag_service import RAGService

# ─────────────────────────────────────────────────────────────────
# PDF source catalogue
# ─────────────────────────────────────────────────────────────────

@dataclass(frozen=True)
class PDFSource:
    url: str
    title: str          # Human-readable Mongolian title
    section_id: str     # Must match frontend HandbookService IDs
    category: str = "pdf"  # "rule" | "regulation" | "order" | "pdf"


PDF_SOURCES: list[PDFSource] = [
    # ── Дүрэм ──────────────────────────────────────────────────────
    PDFSource(
        url="https://www.must.edu.mn/media/uploads/2025/10/27/1-.pdf",
        title="ШИНЖЛЭХ УХААН, ТЕХНОЛОГИЙН ИХ СУРГУУЛИЙН ДҮРЭМ",
        section_id="introduction",
        category="rule",
    ),
    PDFSource(
        url="https://www.must.edu.mn/media/uploads/2025/10/27/2-_pcFUSXG.pdf",
        title="ШУТИС-ИЙН УДИРДАХ ЗӨВЛӨЛИЙН ДҮРЭМ",
        section_id="introduction",
        category="rule",
    ),
    PDFSource(
        url="https://www.must.edu.mn/media/uploads/2025/10/27/3-_UiTgtBv.pdf",
        title="ШУТИС-ИЙН БАГШ, АЖИЛТНЫ ЁС ЗҮЙН ДҮРЭМ",
        section_id="introduction",
        category="rule",
    ),
    PDFSource(
        url="https://www.must.edu.mn/media/uploads/2025/10/27/4_MDAZoEF.pdf",
        title="ШУТИС-ИЙН ОЮУТНЫ ЁС ЗҮЙН ДҮРЭМ",
        section_id="student-life",
        category="rule",
    ),
    # ── Журам ──────────────────────────────────────────────────────
    PDFSource(
        url="https://www.must.edu.mn/media/uploads/2025/10/28/39.pdf",
        title="ШУТИС-ийн оюутны байрны журам",
        section_id="dormitory",
        category="regulation",
    ),
    PDFSource(
        url="https://www.must.edu.mn/media/uploads/2025/12/30/20251224a408.PDF",
        title="ШУТИС-ийн бакалаврын төгсөлтийн журам",
        section_id="graduation",
        category="regulation",
    ),
    PDFSource(
        url="https://www.must.edu.mn/media/uploads/2025/10/28/27-2025-2026.pdf",
        title="ШУТИС-ийн бакалаврын хөтөлбөрт оюутан элсүүлэх журам 2025-2026",
        section_id="admission",
        category="regulation",
    ),
    PDFSource(
        url="https://www.must.edu.mn/media/uploads/2025/10/28/26-.pdf",
        title="ШУТИС-ийн суралцагчдад тэтгэлэг, кредитийн урамшуулал олгох журам",
        section_id="scholarships",
        category="regulation",
    ),
]

# ─────────────────────────────────────────────────────────────────
# Hash cache  (pdf_cache.json lives next to this file)
# ─────────────────────────────────────────────────────────────────

_CACHE_FILE = Path(__file__).parent / "pdf_cache.json"
_CHUNK_CACHE_FILE = Path(__file__).parent / "pdf_chunk_cache.json"


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except ValueError:
        return default


_OCR_ENABLED = os.getenv("PDF_OCR_ENABLED", "1").strip().lower() not in {
    "0",
    "false",
    "no",
    "off",
}
_OCR_LANG = os.getenv("PDF_OCR_LANG", "mon+eng")
_OCR_FALLBACK_LANG = os.getenv("PDF_OCR_FALLBACK_LANG", "eng")
_OCR_DPI = _env_int("PDF_OCR_DPI", 200)
_OCR_MAX_PAGES = _env_int("PDF_OCR_MAX_PAGES", 80)
_MIN_TEXT_LAYER_CHARS = _env_int("PDF_MIN_TEXT_LAYER_CHARS", 120)


def _installed_tesseract_lang_signature() -> str:
    if shutil.which("tesseract") is None:
        return "no-tesseract"

    try:
        proc = subprocess.run(
            ["tesseract", "--list-langs"],
            capture_output=True,
            text=True,
            timeout=3,
            check=False,
        )
    except Exception:
        return "langs-unknown"

    installed = {
        line.strip()
        for line in (proc.stdout + "\n" + proc.stderr).splitlines()
        if line.strip() and "List of available languages" not in line
    }
    requested = {
        part
        for part in re.split(r"[+,\s]+", f"{_OCR_LANG}+{_OCR_FALLBACK_LANG}")
        if part
    }
    available_requested = sorted(installed & requested)
    return ",".join(available_requested) or "no-requested-langs"


def _ocr_dependency_signature() -> str:
    if not _OCR_ENABLED:
        return "text-only"

    missing = []
    if shutil.which("tesseract") is None:
        missing.append("tesseract")
    for module_name in ("fitz", "pytesseract", "PIL"):
        if importlib.util.find_spec(module_name) is None:
            missing.append(module_name)

    dependency_state = "ready" if not missing else "missing-" + "-".join(missing)
    lang_state = _installed_tesseract_lang_signature()
    return (
        f"ocr-{dependency_state}-lang-{lang_state}-"
        f"dpi-{_OCR_DPI}-pages-{_OCR_MAX_PAGES}-min-{_MIN_TEXT_LAYER_CHARS}"
    )


PDF_CHUNK_CACHE_VERSION = f"pdf-v2-{_ocr_dependency_signature()}"


def _load_cache() -> dict[str, str]:
    if _CACHE_FILE.exists():
        try:
            return json.loads(_CACHE_FILE.read_text(encoding="utf-8"))
        except Exception:
            return {}
    return {}


def _save_cache(cache: dict[str, str]) -> None:
    _CACHE_FILE.write_text(
        json.dumps(cache, indent=2, ensure_ascii=False), encoding="utf-8"
    )


def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


# ─────────────────────────────────────────────────────────────────
# Text extraction
# ─────────────────────────────────────────────────────────────────

def extract_text(pdf_bytes: bytes) -> str:  # public alias used by web_scraper
    return _extract_text(pdf_bytes)


def _extract_text(pdf_bytes: bytes) -> str:
    """Extract searchable text, falling back to OCR for scanned PDFs."""
    try:
        text = _extract_text_layer(pdf_bytes)
    except Exception as exc:
        print(f"[PDF Extract] Text-layer extraction failed; trying OCR fallback: {exc}")
        text = ""

    if _has_meaningful_text(text):
        return text

    ocr_text = _extract_text_with_ocr(pdf_bytes)
    if ocr_text:
        return ocr_text

    return text


def _extract_text_layer(pdf_bytes: bytes) -> str:
    """
    Write bytes to a temp file, open with pdfplumber, extract all pages.
    pdfplumber handles Mongolian Cyrillic better than raw PyMuPDF for
    text-layer PDFs.
    """
    pages: list[str] = []

    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        tmp.write(pdf_bytes)
        tmp_path = tmp.name

    try:
        with pdfplumber.open(tmp_path) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text(x_tolerance=2, y_tolerance=2)
                if page_text:
                    pages.append(page_text)
    finally:
        os.unlink(tmp_path)

    return _clean_text("\n\n".join(pages))


def _has_meaningful_text(text: str) -> bool:
    """Ignore page-number-only extraction from scanned PDFs."""
    useful_chars = re.findall(r"[0-9A-Za-zА-Яа-яЁёӨөҮү]", text or "")
    return len(useful_chars) >= _MIN_TEXT_LAYER_CHARS


def _extract_text_with_ocr(pdf_bytes: bytes) -> str:
    """
    Render scanned PDF pages and run Tesseract OCR.

    The dependencies are optional so deployments without OCR support keep the
    previous behaviour: scanned PDFs are registered as static resources.
    """
    if not _OCR_ENABLED:
        return ""

    if shutil.which("tesseract") is None:
        print("[PDF OCR] Tesseract binary not found; skipping OCR fallback")
        return ""

    try:
        import fitz  # PyMuPDF  # noqa: PLC0415
        import pytesseract  # noqa: PLC0415
        from PIL import Image, ImageOps  # noqa: PLC0415
    except Exception as exc:
        print(f"[PDF OCR] Optional OCR dependency missing; skipping OCR fallback: {exc}")
        return ""

    pages: list[str] = []

    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        tmp.write(pdf_bytes)
        tmp_path = tmp.name

    try:
        with fitz.open(tmp_path) as doc:
            page_limit = min(len(doc), max(_OCR_MAX_PAGES, 0))
            zoom = max(_OCR_DPI, 72) / 72
            matrix = fitz.Matrix(zoom, zoom)

            for page_index in range(page_limit):
                page = doc.load_page(page_index)
                pix = page.get_pixmap(matrix=matrix, alpha=False)
                image = Image.open(BytesIO(pix.tobytes("png")))
                image.load()
                image = ImageOps.grayscale(image)
                image = ImageOps.autocontrast(image)

                page_text = _ocr_image_to_text(pytesseract, image, page_index + 1)
                if page_text:
                    pages.append(page_text)
    except Exception as exc:
        print(f"[PDF OCR] OCR fallback failed: {exc}")
        return ""
    finally:
        os.unlink(tmp_path)

    text = _clean_text("\n\n".join(pages))
    if text:
        print(f"[PDF OCR] Extracted {len(text)} chars from scanned PDF")
    return text


def _ocr_image_to_text(pytesseract, image, page_number: int) -> str:
    config = "--oem 3 --psm 6"

    try:
        return pytesseract.image_to_string(image, lang=_OCR_LANG, config=config).strip()
    except pytesseract.TesseractError as exc:
        if _OCR_FALLBACK_LANG and _OCR_FALLBACK_LANG != _OCR_LANG:
            try:
                print(
                    f"[PDF OCR] Language '{_OCR_LANG}' failed on page {page_number}; "
                    f"falling back to '{_OCR_FALLBACK_LANG}'"
                )
                return pytesseract.image_to_string(
                    image,
                    lang=_OCR_FALLBACK_LANG,
                    config=config,
                ).strip()
            except pytesseract.TesseractError as fallback_exc:
                print(f"[PDF OCR] Tesseract failed on page {page_number}: {fallback_exc}")
                return ""

        print(f"[PDF OCR] Tesseract failed on page {page_number}: {exc}")
        return ""


def _clean_text(text: str) -> str:
    """Normalise raw PDF text: fix hyphenation, blank lines, spacing."""
    # Re-join hyphenated line-breaks: "тэтгэ-\nлэг" → "тэтгэлэг"
    text = re.sub(r"-\n(\S)", r"\1", text)
    # Collapse 3+ blank lines to 2
    text = re.sub(r"\n{3,}", "\n\n", text)
    # Drop lines that are just digits / page separators
    text = re.sub(r"(?m)^\s*[\d\-–—]+\s*$", "", text)
    # Normalise horizontal whitespace
    text = re.sub(r"[ \t]+", " ", text)
    return text.strip()


# ─────────────────────────────────────────────────────────────────
# Recursive character text splitter
# ─────────────────────────────────────────────────────────────────

def _recursive_char_split(
    text: str,
    chunk_size: int = 400,
    overlap: int = 80,
    separators: list[str] | None = None,
) -> list[str]:
    """
    Split *text* into chunks of at most *chunk_size* characters.

    Separator hierarchy (tried in order until one is found in the text):
        \\n\\n  →  \\n  →  .  →  !  →  ?  →  space  →  '' (char-level)

    Each chunk overlaps with the next by *overlap* characters so context
    is not lost at boundaries.  Mirrors LangChain's RecursiveCharacterTextSplitter.
    """
    if separators is None:
        separators = ["\n\n", "\n", ".", "!", "?", " ", ""]

    # ── 1. Pick the first separator that exists in this text ───────
    chosen_sep = ""
    next_seps: list[str] = []
    for i, sep in enumerate(separators):
        if sep == "" or sep in text:
            chosen_sep = sep
            next_seps = separators[i + 1 :]
            break

    # ── 2. Split ───────────────────────────────────────────────────
    raw_parts = text.split(chosen_sep) if chosen_sep else list(text)

    # ── 3. Merge parts into ≤ chunk_size windows with overlap ──────
    final_chunks: list[str] = []
    buffer: list[str] = []
    buf_len = 0

    for part in raw_parts:
        sep_cost = len(chosen_sep) if buffer else 0
        part_len = len(part)

        if buf_len + sep_cost + part_len > chunk_size and buffer:
            merged = chosen_sep.join(buffer)

            if len(merged) > chunk_size and next_seps:
                # Still too big → recurse with finer separators
                final_chunks.extend(
                    _recursive_char_split(merged, chunk_size, overlap, next_seps)
                )
            else:
                final_chunks.append(merged)

            # ── Keep tail for overlap ──────────────────────────────
            tail: list[str] = []
            tail_len = 0
            for p in reversed(buffer):
                cost = len(p) + len(chosen_sep)
                if tail_len + cost <= overlap:
                    tail.insert(0, p)
                    tail_len += cost
                else:
                    break
            buffer = tail
            buf_len = tail_len

        buffer.append(part)
        buf_len += part_len + (len(chosen_sep) if buffer else 0)

    # ── 4. Flush remaining buffer ──────────────────────────────────
    if buffer:
        merged = chosen_sep.join(buffer)
        if len(merged) > chunk_size and next_seps:
            final_chunks.extend(
                _recursive_char_split(merged, chunk_size, overlap, next_seps)
            )
        else:
            final_chunks.append(merged)

    return [c.strip() for c in final_chunks if c.strip()]


# ─────────────────────────────────────────────────────────────────
# PDF → Chunk list
# ─────────────────────────────────────────────────────────────────

def pdf_bytes_to_chunks(
    pdf_bytes: bytes,
    *,
    section_id: str,
    title: str,
    source_url: str = "",
    category: str = "pdf",
    priority: bool = False,
    chunk_size: int = 400,
    overlap: int = 80,
) -> list:
    """
    Shared utility: extract text from raw PDF bytes and return list[Chunk].
    Returns an empty list if the PDF has no text layer and OCR cannot extract text.
    Imports Chunk / RAGService at call-time to avoid circular imports.
    """
    from rag_service import Chunk, RAGService  # noqa: PLC0415

    text = _extract_text(pdf_bytes)
    if not text:
        return []  # Caller treats empty as OCR-unreadable/static PDF

    section_title = RAGService.SECTION_TITLES.get(section_id, section_id)
    full_text = f"[{title}]\n\n{text}"
    raw_chunks = _recursive_char_split(full_text, chunk_size=chunk_size, overlap=overlap)

    return [
        Chunk(
            section_id=section_id,
            section_title=f"{section_title} — {title}",
            text=chunk_text,
            chunk_index=i,
            source_url=source_url,
            category=category,
            priority=priority,
        )
        for i, chunk_text in enumerate(raw_chunks)
    ]


def _pdf_to_chunks(source: PDFSource, pdf_bytes: bytes) -> list:
    """Thin wrapper around pdf_bytes_to_chunks for the fixed PDFSource catalogue."""
    return pdf_bytes_to_chunks(
        pdf_bytes,
        section_id=source.section_id,
        title=source.title,
        source_url=source.url,
        category=source.category,
    )


# ─────────────────────────────────────────────────────────────────
# Sync result
# ─────────────────────────────────────────────────────────────────

@dataclass
class SyncResult:
    processed: int = 0
    skipped: int = 0
    total_chunks: int = 0
    errors: list[str] = field(default_factory=list)


# ─────────────────────────────────────────────────────────────────
# Main orchestrator
# ─────────────────────────────────────────────────────────────────

async def sync_pdfs(rag: "RAGService", force: bool = False) -> SyncResult:
    """
    Async entrypoint: download every PDF in PDF_SOURCES, check its SHA-256
    hash against the cache, extract + chunk new/changed content, and inject
    it into *rag* via add_chunks().

    Parameters
    ----------
    rag   : An initialised (build() or build_empty() called) RAGService.
    force : If True, re-index even if the hash matches the cached value.

    Returns
    -------
    SyncResult with counts and any error messages.
    """
    import resource_store  # noqa: PLC0415

    # Pre-register all known sources so they appear in /resources immediately,
    # even before the actual download / FAISS indexing completes.
    resource_store.bulk_register([
        {
            "title":       s.title,
            "url":         s.url,
            "category":    s.category,
            "section_id":  s.section_id,
            "source_type": "text_pdf",
        }
        for s in PDF_SOURCES
    ])

    cache = _load_cache()
    chunk_cache = load_chunk_cache(_CHUNK_CACHE_FILE)
    chunk_cache_dirty = False
    result = SyncResult()

    async with httpx.AsyncClient(
        timeout=httpx.Timeout(connect=10.0, read=60.0, write=10.0, pool=5.0),
        follow_redirects=True,
        headers={"User-Agent": "MUST-Handbook-Sync/1.0 (+https://must.edu.mn)"},
    ) as client:

        for source in PDF_SOURCES:
            # ── Download ───────────────────────────────────────────
            try:
                print(f"[PDF Sync] ↓  {source.title}")
                response = await client.get(source.url)
                response.raise_for_status()
                pdf_bytes = response.content
            except httpx.HTTPStatusError as exc:
                msg = f"HTTP {exc.response.status_code} for {source.url}"
                print(f"[PDF Sync] ERR {msg}")
                result.errors.append(msg)
                continue
            except Exception as exc:
                msg = f"Download failed — {source.title}: {exc}"
                print(f"[PDF Sync] ERR {msg}")
                result.errors.append(msg)
                continue

            # ── Hash check ─────────────────────────────────────────
            content_hash = _sha256(pdf_bytes)
            if not force and cache.get(source.url) == content_hash:
                if rag_has_source(rag, source.url):
                    print(f"[PDF Sync] ✓  Unchanged — already indexed: {source.title}")
                    result.skipped += 1
                    continue

                cached_chunks = get_cached_chunks(
                    chunk_cache,
                    source.url,
                    content_hash,
                    cache_version=PDF_CHUNK_CACHE_VERSION,
                )
                if cached_chunks is not None:
                    if cached_chunks:
                        try:
                            added = rag.add_chunks(cached_chunks)
                            result.total_chunks += added
                            print(f"[PDF Sync] ↺  Restored {added} cached chunks — {source.title}")
                        except Exception as exc:
                            msg = f"Cached FAISS restore failed — {source.title}: {exc}"
                            print(f"[PDF Sync] ERR {msg}")
                            result.errors.append(msg)
                    else:
                        print(f"[PDF Sync] ✓  Unchanged OCR-unreadable/empty PDF — {source.title}")
                    result.skipped += 1
                    continue

                print(f"[PDF Sync] ↻  Unchanged but no chunk cache — re-extract: {source.title}")

            # ── Extract + chunk (run in thread to avoid blocking) ──
            try:
                chunks = await asyncio.get_event_loop().run_in_executor(
                    None, _pdf_to_chunks, source, pdf_bytes
                )
                put_cached_chunks(
                    chunk_cache,
                    source.url,
                    content_hash,
                    chunks,
                    cache_version=PDF_CHUNK_CACHE_VERSION,
                )
                chunk_cache_dirty = True
            except Exception as exc:
                msg = f"Text extraction failed — {source.title}: {exc}"
                print(f"[PDF Sync] ERR {msg}")
                result.errors.append(msg)
                continue

            # ── Add to FAISS ───────────────────────────────────────
            if chunks:
                try:
                    added = rag.add_chunks(chunks)
                    result.total_chunks += added
                    print(f"[PDF Sync] +{added} chunks — {source.title}")
                except Exception as exc:
                    msg = f"FAISS insert failed — {source.title}: {exc}"
                    print(f"[PDF Sync] ERR {msg}")
                    result.errors.append(msg)
                    continue
            else:
                print(f"[PDF Sync] ⚠  No text extracted — {source.title}")

            cache[source.url] = content_hash
            result.processed += 1

    # Persist updated cache
    try:
        await asyncio.get_event_loop().run_in_executor(None, _save_cache, cache)
        if chunk_cache_dirty:
            await asyncio.get_event_loop().run_in_executor(
                None, save_chunk_cache, _CHUNK_CACHE_FILE, chunk_cache
            )
    except Exception as exc:
        print(f"[PDF Sync] WARNING: could not save cache: {exc}")

    return result
