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
  pdf_bytes_to_chunks()  →  has text?  → YES → add_chunks(rag)
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
from urllib.parse import urljoin, urlparse

import httpx
from bs4 import BeautifulSoup

from pdf_processor import pdf_bytes_to_chunks, _recursive_char_split

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
_STATIC_RESOURCES    = Path(__file__).parent / "static_resources.json"

# Minimum characters for a PDF to be considered text-based (not scanned)
_MIN_TEXT_CHARS = 150

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
    existing_urls = {r["url"] for r in resources}
    if resource["url"] not in existing_urls:
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
    if href.startswith("//"):
        href = "https:" + href
    return urljoin(page_url, href)


def _is_pdf_url(url: str) -> bool:
    path = urlparse(url).path.lower()
    return path.endswith(".pdf")


def _scrape_pdf_links(html: str, page_url: str, category: str, section_id: str) -> list[DiscoveredPDF]:
    """
    Extract all <a> tags pointing to PDFs.
    Title comes from the link text; falls back to the filename.
    """
    soup = BeautifulSoup(html, "lxml")
    results: list[DiscoveredPDF] = []
    seen_urls: set[str] = set()

    for tag in soup.find_all("a", href=True):
        href: str = tag["href"].strip()
        if not href:
            continue

        abs_url = _normalise_url(href, page_url)
        if not _is_pdf_url(abs_url):
            continue
        if abs_url in seen_urls:
            continue
        seen_urls.add(abs_url)

        # Prefer anchor text; fall back to filename
        raw_title = tag.get_text(separator=" ", strip=True)
        if not raw_title or len(raw_title) < 3:
            raw_title = urlparse(abs_url).path.split("/")[-1]

        results.append(DiscoveredPDF(
            url=abs_url,
            title=raw_title,
            category=category,
            section_id=section_id,
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
    result = WebSyncResult()

    async with httpx.AsyncClient(
        timeout=httpx.Timeout(connect=10.0, read=60.0, write=10.0, pool=5.0),
        follow_redirects=True,
        headers=_HEADERS,
    ) as client:

        # ── 1. Scrape tuition page (high priority) ─────────────────
        await _process_tuition_page(client, rag, result, cache, force)

        # ── 2. Scrape PDF-link pages ───────────────────────────────
        all_pdfs: list[DiscoveredPDF] = []
        for source in SCRAPE_SOURCES:
            try:
                resp = await client.get(source["url"])
                resp.raise_for_status()
                pdfs = _scrape_pdf_links(
                    resp.text, source["url"], source["category"], source["section_id"]
                )
                all_pdfs.extend(pdfs)
            except Exception as exc:
                msg = f"Page scrape failed ({source['url']}): {exc}"
                print(f"[WebSync] ERR {msg}")
                result.errors.append(msg)

        result.pdfs_discovered += len(all_pdfs)

        # ── 3. Download + index / store each PDF ──────────────────
        for pdf in all_pdfs:
            await _process_pdf(client, pdf, rag, result, cache, force)

    # Persist cache
    try:
        await asyncio.get_event_loop().run_in_executor(None, _save_web_cache, cache)
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
    force: bool,
) -> None:
    """Fetch tuition page, convert table to Markdown, add as priority chunks."""
    from rag_service import Chunk, RAGService  # noqa: PLC0415

    try:
        resp = await client.get(TUITION_URL)
        resp.raise_for_status()
        html_bytes = resp.content
    except Exception as exc:
        msg = f"Tuition page fetch failed: {exc}"
        print(f"[WebSync] ERR {msg}")
        result.errors.append(msg)
        return

    content_hash = _sha256(html_bytes)
    cache_key = f"tuition::{TUITION_URL}"

    if not force and cache.get(cache_key) == content_hash:
        print("[WebSync] ✓  Tuition page unchanged — skip")
        return

    markdown = await asyncio.get_event_loop().run_in_executor(
        None, _scrape_tuition_markdown, resp.text
    )

    if not markdown.strip():
        print("[WebSync] ⚠  No tuition data extracted")
        cache[cache_key] = content_hash
        return

    section_title = RAGService.SECTION_TITLES.get(TUITION_SECTION, TUITION_SECTION)
    raw_chunks = _recursive_char_split(markdown, chunk_size=800, overlap=150)

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
    resource_store.register(
        title="ШУТИС-ийн сургалтын төлбөрийн мэдээлэл",
        url=TUITION_URL,
        category="tuition",
        section_id=TUITION_SECTION,
        source_type="web_page",
    )
    print(f"[WebSync] Tuition: +{added} priority chunk(s)")


async def _process_pdf(
    client: httpx.AsyncClient,
    pdf: DiscoveredPDF,
    rag: "RAGService",
    result: WebSyncResult,
    cache: dict,
    force: bool,
) -> None:
    """Download one PDF, classify it, and either index it or save to static store."""
    # Download
    try:
        print(f"[WebSync] ↓  {pdf.title[:60]}")
        resp = await client.get(pdf.url)
        resp.raise_for_status()
        pdf_bytes = resp.content
    except Exception as exc:
        msg = f"Download failed ({pdf.url}): {exc}"
        print(f"[WebSync] ERR {msg}")
        result.errors.append(msg)
        return

    content_hash = _sha256(pdf_bytes)

    if not force and cache.get(pdf.url) == content_hash:
        print(f"[WebSync] ✓  Unchanged — skip: {pdf.title[:50]}")
        result.pdfs_skipped += 1
        return

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

    import resource_store  # noqa: PLC0415

    if chunks:
        # Text-based PDF → add to FAISS
        try:
            added = rag.add_chunks(chunks)
            result.pdfs_indexed += 1
            result.total_chunks += added
            print(f"[WebSync] +{added} chunks (text) — {pdf.title[:50]}")
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
        # Scanned / image PDF → save to static_resources.json + registry
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
