"""
WebScraper — Crawls four MUST.edu.mn pages to build a live knowledge base.

Pages
-----
  546  Дүрэм (Rules)          → extract PDF links → index or store as static
  501  Журам (Regulations)    → extract PDF links → index or store as static
  499  Тушаал (Orders)        → extract PDF links → index or store as static
  193  Төлбөр (Tuition)       → extract HTML table → Markdown → high-priority chunks

Pipeline
--------
  scrape page → discover PDF URLs
      ↓
  download PDF bytes
      ↓
  pdf_bytes_to_chunks()  →  text/OCR?  → YES → add_chunks(rag)
                                        → NO  → append to static_resources.json

  scrape tuition table → build Markdown → embed as priority=True chunks
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import TYPE_CHECKING
from urllib.parse import unquote, urldefrag, urljoin, urlparse

import httpx
from bs4 import BeautifulSoup, Tag

from chunk_cache import (
    get_cached_chunks,
    load_chunk_cache,
    put_cached_chunks,
    rag_has_source,
    save_chunk_cache,
)
from pdf_processor import (
    PDF_CHUNK_CACHE_VERSION,
    _recursive_char_split,
    pdf_bytes_to_chunks,
)

if TYPE_CHECKING:
    from rag_service import RAGService

# ─────────────────────────────────────────────────────────────────
# Constants
# ─────────────────────────────────────────────────────────────────

BASE_URL = "https://www.must.edu.mn"

SCRAPE_SOURCES: list[dict] = [
    {"url": f"{BASE_URL}/mn/page/546", "category": "rule",       "section_id": "introduction"},
    {"url": f"{BASE_URL}/mn/page/501", "category": "regulation", "section_id": "introduction"},
    {"url": f"{BASE_URL}/mn/page/499", "category": "order",      "section_id": "introduction"},
]

TUITION_URL   = f"{BASE_URL}/mn/page/193"
TUITION_SECTION = "scholarships"   # maps to "Тэтгэлэг ба санхүүгийн дэмжлэг"

# Scraped content is cached separately from the fixed-PDF cache
_WEB_CACHE_FILE      = Path(__file__).parent / "web_cache.json"
_WEB_CHUNK_CACHE     = Path(__file__).parent / "web_chunk_cache.json"
_STATIC_RESOURCES    = Path(__file__).parent / "static_resources.json"

_HEADERS = {
    "User-Agent": "MUST-Handbook-Bot/2.0 (+https://must.edu.mn)",
    "Accept-Language": "mn,en;q=0.9",
}


# ─────────────────────────────────────────────────────────────────
# Cache helpers
# ─────────────────────────────────────────────────────────────────

def _load_web_cache() -> dict[str, str]:
    if _WEB_CACHE_FILE.exists():
        try:
            return json.loads(_WEB_CACHE_FILE.read_text(encoding="utf-8"))
        except Exception:
            return {}
    return {}


def _save_web_cache(cache: dict[str, str]) -> None:
    _WEB_CACHE_FILE.write_text(
        json.dumps(cache, indent=2, ensure_ascii=False), encoding="utf-8"
    )


def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


async def _get_with_retries(client: httpx.AsyncClient, url: str, attempts: int = 3) -> httpx.Response:
    last_exc: Exception | None = None
    for attempt in range(attempts):
        try:
            resp = await client.get(url)
            resp.raise_for_status()
            return resp
        except Exception as exc:
            last_exc = exc
            if attempt < attempts - 1:
                await asyncio.sleep(0.5 * (attempt + 1))
    raise last_exc or RuntimeError(f"Fetch failed: {url}")


def _clean_title(text: str) -> str:
    text = unquote(text or "")
    text = re.sub(r"\.(pdf|PDF)(\?.*)?$", "", text)
    text = re.sub(r"[_\-]+", " ", text)
    text = re.sub(r"\s+", " ", text).strip(" -–—\t\n")
    return text


_SECTION_HINTS: dict[str, list[str]] = {
    "scholarships": ["тэтгэлэг", "урамшуулал", "сургалтын төлбөр", "зээл", "санхүү"],
    "dormitory": ["оюутны байр", "дотуур байр", "байрны"],
    "health-services": ["эрүүл мэнд", "даатгал", "эмнэлэг", "эмч"],
    "admission": ["элсэлт", "элсүүлэх", "элсэгч"],
    "graduation": ["төгсөлт", "диплом", "хамгаалалт"],
    "credit-system": ["кредит", "хичээл сонголт", "үнэлгээ", "шалгалт"],
    "digital-learning": ["оюутны веб", "цахим", "unimis", "апп"],
    "student-life": ["оюутны ёс зүй", "оюутны үйлчилгээ", "клуб", "оюутны холбоо"],
    "research": ["эрдэм шинжилгээ", "номын сан", "судалгаа", "олимпиад"],
    "international-students": ["гадаад", "виз", "оршин суух"],
}


def _infer_section_id(title: str, default: str) -> str:
    title_l = title.lower()
    for section_id, keywords in _SECTION_HINTS.items():
        if any(keyword in title_l for keyword in keywords):
            return section_id
    return default


# ─────────────────────────────────────────────────────────────────
# Static resources store  (scanned / image PDFs)
# ─────────────────────────────────────────────────────────────────

def _load_static_resources() -> list[dict]:
    if _STATIC_RESOURCES.exists():
        try:
            data = json.loads(_STATIC_RESOURCES.read_text(encoding="utf-8"))
            return data.get("resources", [])
        except Exception:
            return []
    return []


def _save_static_resources(resources: list[dict]) -> None:
    _STATIC_RESOURCES.write_text(
        json.dumps(
            {
                "version": "1.0",
                "last_updated": datetime.now(timezone.utc).isoformat(),
                "resources": resources,
            },
            indent=2,
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )


def _upsert_static_resource(resource: dict) -> None:
    """Add or update a resource entry by URL."""
    resources = _load_static_resources()
    for existing in resources:
        if existing.get("url") == resource["url"]:
            existing.update(resource)
            _save_static_resources(resources)
            return
    resources.append(resource)
    _save_static_resources(resources)


def search_static_resources(query: str, top_k: int = 3) -> list[dict]:
    """
    Keyword search over static resource titles.
    Returns dicts with keys: title, url, category, section_id.
    """
    resources = _load_static_resources()
    if not resources:
        return []

    q_words = set(re.sub(r"[^\w\s]", " ", query.lower()).split())
    scored: list[tuple[int, dict]] = []

    for r in resources:
        title_words = set(re.sub(r"[^\w\s]", " ", r.get("title", "").lower()).split())
        overlap = len(q_words & title_words)
        if overlap > 0:
            scored.append((overlap, r))

    scored.sort(key=lambda x: x[0], reverse=True)
    return [r for _, r in scored[:top_k]]


# ─────────────────────────────────────────────────────────────────
# HTML scraping helpers
# ─────────────────────────────────────────────────────────────────

@dataclass
class DiscoveredPDF:
    url: str
    title: str
    category: str
    section_id: str


def _normalise_url(href: str, page_url: str) -> str:
    """Resolve relative / protocol-relative URLs to absolute."""
    href = href.strip()
    if href.startswith("//"):
        href = "https:" + href
    absolute = urljoin(page_url, href)
    absolute, _fragment = urldefrag(absolute)
    return absolute


def _is_pdf_url(url: str) -> bool:
    parsed = urlparse(url)
    path = unquote(parsed.path).lower()
    query = unquote(parsed.query).lower()
    return path.endswith(".pdf") or ".pdf" in path or ".pdf" in query


def _candidate_hrefs(tag: Tag) -> list[str]:
    hrefs: list[str] = []
    for attr in ("href", "src", "data", "data-url", "data-href", "data-src"):
        value = tag.get(attr)
        if isinstance(value, str) and value.strip():
            hrefs.append(value.strip())

    onclick = tag.get("onclick")
    if isinstance(onclick, str):
        hrefs.extend(re.findall(r"""['"]([^'"]+?\.pdf(?:\?[^'"]*)?)['"]""", onclick, flags=re.I))

    return hrefs


def _title_from_tag(tag: Tag, url: str) -> str:
    title = (
        tag.get_text(separator=" ", strip=True)
        or tag.get("title", "")
        or tag.get("aria-label", "")
        or ""
    )
    if not title and tag.parent:
        title = tag.parent.get_text(separator=" ", strip=True)
    if not title or len(title) < 3:
        title = urlparse(url).path.split("/")[-1]
    return _clean_title(title)


def _scrape_pdf_links(html: str, page_url: str, category: str, section_id: str) -> list[DiscoveredPDF]:
    """
    Extract all <a> tags pointing to PDFs.
    Title comes from the link text; falls back to the filename.
    """
    soup = BeautifulSoup(html, "lxml")
    results: list[DiscoveredPDF] = []
    seen_urls: set[str] = set()

    for tag in soup.find_all(["a", "iframe", "embed", "object"]):
        for href in _candidate_hrefs(tag):
            abs_url = _normalise_url(href, page_url)
            if not _is_pdf_url(abs_url) or abs_url in seen_urls:
                continue
            seen_urls.add(abs_url)

            raw_title = _title_from_tag(tag, abs_url)
            results.append(DiscoveredPDF(
                url=abs_url,
                title=raw_title,
                category=category,
                section_id=_infer_section_id(raw_title, section_id),
            ))

    for href in re.findall(r"""(?:https?:)?//[^"' <>()]+?\.pdf(?:\?[^"' <>()]*)?|/[^"' <>()]+?\.pdf(?:\?[^"' <>()]*)?""", html, flags=re.I):
        abs_url = _normalise_url(href, page_url)
        if abs_url in seen_urls:
            continue
        seen_urls.add(abs_url)
        raw_title = _clean_title(urlparse(abs_url).path.split("/")[-1])
        results.append(DiscoveredPDF(
            url=abs_url,
            title=raw_title,
            category=category,
            section_id=_infer_section_id(raw_title, section_id),
        ))

    print(f"[Scraper] Found {len(results)} PDF link(s) on {page_url}")
    return results


# ─────────────────────────────────────────────────────────────────
# Tuition table → Markdown
# ─────────────────────────────────────────────────────────────────

def _table_to_markdown(table_tag) -> str:
    """Convert a <table> BeautifulSoup element to a Markdown table string."""
    rows = table_tag.find_all("tr")
    if not rows:
        return ""

    md_lines: list[str] = []
    for row_idx, row in enumerate(rows):
        cells = row.find_all(["th", "td"])
        if not cells:
            continue
        cell_texts = [
            re.sub(r"\s+", " ", c.get_text(separator=" ", strip=True)).replace("|", "｜")
            for c in cells
        ]
        md_lines.append("| " + " | ".join(cell_texts) + " |")
        if row_idx == 0:
            md_lines.append("| " + " | ".join(["---"] * len(cell_texts)) + " |")

    return "\n".join(md_lines)


def _scrape_tuition_markdown(html: str) -> str:
    """
    Extract all tables from the tuition page and convert to Markdown.
    Prepends a Mongolian context header so the AI knows what the data is.
    """
    soup = BeautifulSoup(html, "lxml")
    tables = soup.find_all("table")

    if not tables:
        # Fallback: extract all visible text from content area
        content = soup.find("div", class_=re.compile(r"content|entry|article|main", re.I))
        fallback_text = content.get_text(separator="\n", strip=True) if content else soup.get_text(separator="\n", strip=True)
        return f"## ШУТИС-ийн сургалтын төлбөрийн мэдээлэл\n\n{fallback_text}"

    md_parts: list[str] = [
        "## ШУТИС-ийн сургалтын төлбөрийн мэдээлэл\n",
        "*Эх сурвалж: must.edu.mn/mn/page/193*\n",
    ]
    for i, table in enumerate(tables, 1):
        table_md = _table_to_markdown(table)
        if table_md:
            md_parts.append(f"\n### Хүснэгт {i}\n\n{table_md}")

    return "\n".join(md_parts)


def _scrape_source_page_markdown(
    html: str,
    page_url: str,
    category: str,
    pdfs: list[DiscoveredPDF],
) -> str:
    soup = BeautifulSoup(html, "lxml")
    heading = soup.find(["h1", "h2", "h3"])
    title = heading.get_text(" ", strip=True) if heading else page_url
    title = _clean_title(title)

    category_label = {
        "rule": "Дүрэм",
        "regulation": "Журам",
        "order": "Тушаал",
    }.get(category, category)

    lines = [
        f"## ШУТИС {category_label} баримт бичгийн жагсаалт",
        f"Эх сурвалж: {page_url}",
        f"Хуудасны гарчиг: {title}",
        "",
        "### Олдсон PDF баримтууд",
    ]
    for pdf in pdfs:
        lines.append(f"- {pdf.title} ({pdf.url})")

    content = soup.find("div", class_=re.compile(r"content|entry|article|main", re.I))
    if content:
        text = re.sub(r"\s+", " ", content.get_text(" ", strip=True))
        if text:
            lines.extend(["", "### Хуудасны текст", text[:2000]])

    return "\n".join(lines)


# ─────────────────────────────────────────────────────────────────
# Sync result
# ─────────────────────────────────────────────────────────────────

@dataclass
class WebSyncResult:
    pdfs_discovered: int = 0
    pdfs_indexed: int = 0      # Text-based PDFs added to FAISS
    pdfs_static: int = 0       # Scanned PDFs saved to static_resources.json
    pdfs_skipped: int = 0      # Unchanged (hash match)
    tuition_chunks: int = 0
    total_chunks: int = 0
    errors: list[str] = field(default_factory=list)


# ─────────────────────────────────────────────────────────────────
# Main orchestrator
# ─────────────────────────────────────────────────────────────────

async def sync_web(rag: "RAGService", force: bool = False) -> WebSyncResult:
    """
    Scrape the 4 MUST pages and update the RAG index + static resources.

    Steps
    -----
    1. Fetch pages 546, 501, 499  → discover PDF links
    2. Fetch page 193             → extract tuition table → high-priority chunks
    3. For each discovered PDF:
         - Download bytes
         - Check SHA-256 hash (skip if unchanged, unless force=True)
         - pdf_bytes_to_chunks() → has text? → add to FAISS
                                 → empty?   → add to static_resources.json
    """
    cache = _load_web_cache()
    chunk_cache = load_chunk_cache(_WEB_CHUNK_CACHE)
    result = WebSyncResult()

    async with httpx.AsyncClient(
        timeout=httpx.Timeout(connect=10.0, read=60.0, write=10.0, pool=5.0),
        follow_redirects=True,
        headers=_HEADERS,
    ) as client:

        # ── 1. Scrape tuition page (high priority) ─────────────────
        await _process_tuition_page(client, rag, result, cache, chunk_cache, force)

        # ── 2. Scrape PDF-link pages ───────────────────────────────
        all_pdfs: list[DiscoveredPDF] = []
        for source in SCRAPE_SOURCES:
            try:
                resp = await _get_with_retries(client, source["url"])
                pdfs = _scrape_pdf_links(
                    resp.text, source["url"], source["category"], source["section_id"]
                )
                await _process_source_page(
                    source,
                    resp.text,
                    pdfs,
                    rag,
                    result,
                    cache,
                    chunk_cache,
                    force,
                )
                all_pdfs.extend(pdfs)
            except Exception as exc:
                msg = f"Page scrape failed ({source['url']}): {exc}"
                print(f"[WebSync] ERR {msg}")
                result.errors.append(msg)

        result.pdfs_discovered += len(all_pdfs)

        # ── 3. Download + index / store each PDF ──────────────────
        for pdf in all_pdfs:
            await _process_pdf(client, pdf, rag, result, cache, chunk_cache, force)

    # Persist cache
    try:
        await asyncio.get_event_loop().run_in_executor(None, _save_web_cache, cache)
        await asyncio.get_event_loop().run_in_executor(
            None, save_chunk_cache, _WEB_CHUNK_CACHE, chunk_cache
        )
    except Exception as exc:
        print(f"[WebSync] WARNING: could not save web cache: {exc}")

    return result


# ─────────────────────────────────────────────────────────────────
# Internal helpers
# ─────────────────────────────────────────────────────────────────

async def _process_tuition_page(
    client: httpx.AsyncClient,
    rag: "RAGService",
    result: WebSyncResult,
    cache: dict,
    chunk_cache: dict,
    force: bool,
) -> None:
    """Fetch tuition page, convert table to Markdown, add as priority chunks."""
    from rag_service import Chunk, RAGService  # noqa: PLC0415

    try:
        resp = await _get_with_retries(client, TUITION_URL)
        html_bytes = resp.content
    except Exception as exc:
        msg = f"Tuition page fetch failed: {exc}"
        print(f"[WebSync] ERR {msg}")
        result.errors.append(msg)
        return

    content_hash = _sha256(html_bytes)
    cache_key = f"tuition::{TUITION_URL}"

    if not force and cache.get(cache_key) == content_hash:
        if rag_has_source(rag, TUITION_URL):
            print("[WebSync] ✓  Tuition page unchanged — already indexed")
            return
        cached_chunks = get_cached_chunks(chunk_cache, cache_key, content_hash)
        if cached_chunks is not None:
            if cached_chunks:
                added = rag.add_chunks(cached_chunks)
                result.tuition_chunks += added
                result.total_chunks += added
                print(f"[WebSync] ↺  Tuition restored from cache: +{added} chunk(s)")
            else:
                print("[WebSync] ✓  Tuition page unchanged — no cached text")
            return
        print("[WebSync] ↻  Tuition unchanged but no chunk cache — re-extract")

    markdown = await asyncio.get_event_loop().run_in_executor(
        None, _scrape_tuition_markdown, resp.text
    )

    if not markdown.strip():
        print("[WebSync] ⚠  No tuition data extracted")
        cache[cache_key] = content_hash
        return

    section_title = RAGService.SECTION_TITLES.get(TUITION_SECTION, TUITION_SECTION)
    raw_chunks = _recursive_char_split(markdown, chunk_size=400, overlap=80)

    tuition_chunks = [
        Chunk(
            section_id=TUITION_SECTION,
            section_title=f"{section_title} — Сургалтын төлбөр",
            text=c,
            chunk_index=i,
            source_url=TUITION_URL,
            category="tuition",
            priority=True,   # ← High-priority: boosted in all financial queries
        )
        for i, c in enumerate(raw_chunks)
    ]

    import resource_store  # noqa: PLC0415

    added = rag.add_chunks(tuition_chunks)
    result.tuition_chunks += added
    result.total_chunks += added
    cache[cache_key] = content_hash
    put_cached_chunks(chunk_cache, cache_key, content_hash, tuition_chunks)
    resource_store.register(
        title="ШУТИС-ийн сургалтын төлбөрийн мэдээлэл",
        url=TUITION_URL,
        category="tuition",
        section_id=TUITION_SECTION,
        source_type="web_page",
    )
    print(f"[WebSync] Tuition: +{added} priority chunk(s)")


async def _process_source_page(
    source: dict,
    html: str,
    pdfs: list[DiscoveredPDF],
    rag: "RAGService",
    result: WebSyncResult,
    cache: dict,
    chunk_cache: dict,
    force: bool,
) -> None:
    """Index source pages as catalogs of official documents."""
    from rag_service import Chunk, RAGService  # noqa: PLC0415

    page_url = source["url"]
    content_hash = _sha256(html.encode("utf-8", errors="ignore"))
    cache_key = f"html::{page_url}"

    if not force and cache.get(cache_key) == content_hash:
        if rag_has_source(rag, page_url):
            return
        cached_chunks = get_cached_chunks(chunk_cache, cache_key, content_hash)
        if cached_chunks is not None:
            if cached_chunks:
                added = rag.add_chunks(cached_chunks)
                result.total_chunks += added
                print(f"[WebSync] ↺  Source page restored: +{added} chunk(s) — {page_url}")
            return

    markdown = _scrape_source_page_markdown(html, page_url, source["category"], pdfs)
    raw_chunks = _recursive_char_split(markdown, chunk_size=500, overlap=80)
    section_title = RAGService.SECTION_TITLES.get(source["section_id"], source["section_id"])
    chunks = [
        Chunk(
            section_id=source["section_id"],
            section_title=f"{section_title} — баримт бичгийн жагсаалт",
            text=chunk_text,
            chunk_index=i,
            source_url=page_url,
            category=source["category"],
            priority=False,
        )
        for i, chunk_text in enumerate(raw_chunks)
    ]
    if chunks:
        added = rag.add_chunks(chunks)
        result.total_chunks += added
        cache[cache_key] = content_hash
        put_cached_chunks(chunk_cache, cache_key, content_hash, chunks)

        import resource_store  # noqa: PLC0415

        resource_store.register(
            title=f"ШУТИС {source['category']} баримт бичгийн жагсаалт",
            url=page_url,
            category=source["category"],
            section_id=source["section_id"],
            source_type="web_page",
        )
        print(f"[WebSync] Source page indexed: +{added} chunk(s) — {page_url}")


async def _process_pdf(
    client: httpx.AsyncClient,
    pdf: DiscoveredPDF,
    rag: "RAGService",
    result: WebSyncResult,
    cache: dict,
    chunk_cache: dict,
    force: bool,
) -> None:
    """Download one PDF, classify it, and either index it or save to static store."""
    # Download
    try:
        print(f"[WebSync] ↓  {pdf.title[:60]}")
        resp = await _get_with_retries(client, pdf.url)
        pdf_bytes = resp.content
        content_type = resp.headers.get("content-type", "").lower()
        if "pdf" not in content_type and not pdf_bytes.startswith(b"%PDF"):
            msg = f"Not a PDF response ({pdf.url}, content-type={content_type or 'unknown'})"
            print(f"[WebSync] ERR {msg}")
            result.errors.append(msg)
            return
    except Exception as exc:
        msg = f"Download failed ({pdf.url}): {exc}"
        print(f"[WebSync] ERR {msg}")
        result.errors.append(msg)
        return

    content_hash = _sha256(pdf_bytes)

    import resource_store  # noqa: PLC0415

    resource_store.register(
        title=pdf.title,
        url=pdf.url,
        category=pdf.category,
        section_id=pdf.section_id,
        source_type="discovered_pdf",
    )

    if not force and cache.get(pdf.url) == content_hash:
        if rag_has_source(rag, pdf.url):
            print(f"[WebSync] ✓  Unchanged — already indexed: {pdf.title[:50]}")
            result.pdfs_skipped += 1
            return

        cached_chunks = get_cached_chunks(
            chunk_cache,
            pdf.url,
            content_hash,
            cache_version=PDF_CHUNK_CACHE_VERSION,
        )
        if cached_chunks is not None:
            if cached_chunks:
                try:
                    added = rag.add_chunks(cached_chunks)
                    result.pdfs_indexed += 1
                    result.total_chunks += added
                    print(f"[WebSync] ↺  Restored {added} cached chunks — {pdf.title[:50]}")
                except Exception as exc:
                    msg = f"Cached FAISS restore failed ({pdf.title}): {exc}"
                    print(f"[WebSync] ERR {msg}")
                    result.errors.append(msg)
            else:
                _upsert_static_resource({
                    "title": pdf.title, "url": pdf.url,
                    "category": pdf.category, "section_id": pdf.section_id,
                    "type": "scanned_pdf",
                })
                print(f"[WebSync] ✓  Unchanged OCR-unreadable/empty PDF — {pdf.title[:50]}")
            result.pdfs_skipped += 1
            return

        print(f"[WebSync] ↻  Unchanged but no chunk cache — re-extract: {pdf.title[:50]}")

    # Try to extract text (run in thread — CPU-bound)
    chunks = await asyncio.get_event_loop().run_in_executor(
        None,
        lambda: pdf_bytes_to_chunks(
            pdf_bytes,
            section_id=pdf.section_id,
            title=pdf.title,
            source_url=pdf.url,
            category=pdf.category,
        ),
    )

    put_cached_chunks(
        chunk_cache,
        pdf.url,
        content_hash,
        chunks,
        cache_version=PDF_CHUNK_CACHE_VERSION,
    )

    if chunks:
        # Text-layer or OCR-readable PDF → add to FAISS
        try:
            added = rag.add_chunks(chunks)
            result.pdfs_indexed += 1
            result.total_chunks += added
            print(f"[WebSync] +{added} chunks (text/OCR) — {pdf.title[:50]}")
        except Exception as exc:
            msg = f"FAISS insert failed ({pdf.title}): {exc}"
            print(f"[WebSync] ERR {msg}")
            result.errors.append(msg)
            return
        resource_store.register(
            title=pdf.title, url=pdf.url,
            category=pdf.category, section_id=pdf.section_id,
            source_type="text_pdf",
        )
    else:
        # OCR-unreadable scanned / image PDF → save to static_resources.json + registry
        _upsert_static_resource({
            "title": pdf.title, "url": pdf.url,
            "category": pdf.category, "section_id": pdf.section_id,
            "type": "scanned_pdf",
        })
        resource_store.register(
            title=pdf.title, url=pdf.url,
            category=pdf.category, section_id=pdf.section_id,
            source_type="scanned_pdf",
        )
        result.pdfs_static += 1
        print(f"[WebSync] 🖼  Scanned PDF → static store: {pdf.title[:50]}")

    cache[pdf.url] = content_hash
