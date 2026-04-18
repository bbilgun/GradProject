"""
web_search.py — Real-time web search tool for the AI assistant.

Scrapes must.edu.mn pages on demand and returns cleaned text that
Gemini can use as context to answer questions about recent events,
news, or specific university pages.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

import httpx
from bs4 import BeautifulSoup, Tag

# ─────────────────────────────────────────────────────────────────
# Constants
# ─────────────────────────────────────────────────────────────────

BASE_URL = "https://www.must.edu.mn"

# Key landing pages to search across
_NEWS_URL = f"{BASE_URL}/mn/news"
_MAIN_URL = BASE_URL

_HEADERS = {
    "User-Agent": "MUST-Handbook-Bot/2.0 (+https://must.edu.mn)",
    "Accept-Language": "mn,en;q=0.9",
}

_TIMEOUT = httpx.Timeout(connect=8.0, read=15.0, write=5.0, pool=5.0)

# Maximum characters of cleaned page text to return
_MAX_CONTENT_CHARS = 3000


# ─────────────────────────────────────────────────────────────────
# Data types
# ─────────────────────────────────────────────────────────────────

@dataclass
class WebSearchResult:
    """One page of scraped content."""
    title: str
    url: str
    snippet: str


# ─────────────────────────────────────────────────────────────────
# HTML → clean text
# ─────────────────────────────────────────────────────────────────

def _extract_text(html: str) -> str:
    """Strip tags, scripts, styles and collapse whitespace."""
    soup = BeautifulSoup(html, "lxml")
    for tag in soup(["script", "style", "nav", "footer", "header", "noscript"]):
        tag.decompose()

    text = soup.get_text(separator="\n", strip=True)
    # Collapse multiple blank lines
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _extract_news_items(html: str) -> list[dict]:
    """
    Parse the must.edu.mn news listing page and extract individual
    news items with title, link, and date/snippet.
    """
    soup = BeautifulSoup(html, "lxml")
    items: list[dict] = []

    # The MUST site renders news as card-like blocks with <a> links.
    # Try multiple selectors to be resilient to markup changes.
    for a_tag in soup.select("a[href*='/mn/news/'], a[href*='/mn/post/']"):
        href = a_tag.get("href", "")
        if not href:
            continue

        # Build absolute URL
        url = href if href.startswith("http") else f"{BASE_URL}{href}"

        # Title: first heading inside the card, or the link text
        heading = a_tag.find(["h1", "h2", "h3", "h4", "h5"])
        title = heading.get_text(strip=True) if heading else a_tag.get_text(separator=" ", strip=True)
        if not title or len(title) < 3:
            continue

        # Date/snippet text: anything that isn't the heading
        snippet_parts: list[str] = []
        for child in a_tag.descendants:
            if isinstance(child, Tag) and child.name in ("h1", "h2", "h3", "h4", "h5"):
                continue
            if isinstance(child, str):
                t = child.strip()
                if t and t != title:
                    snippet_parts.append(t)
        snippet = " ".join(snippet_parts)[:200]

        items.append({"title": title, "url": url, "snippet": snippet})

    # Deduplicate by URL
    seen: set[str] = set()
    deduped: list[dict] = []
    for item in items:
        if item["url"] not in seen:
            seen.add(item["url"])
            deduped.append(item)

    return deduped[:15]  # Cap to 15 items


# ─────────────────────────────────────────────────────────────────
# Public API — called by the Gemini function-calling handler
# ─────────────────────────────────────────────────────────────────

async def search_must_website(query: str) -> str:
    """
    Search must.edu.mn for content relevant to *query*.

    Strategy:
      1. Fetch the news listing page → extract headlines + snippets.
      2. If any headline is relevant, fetch that article for full text.
      3. If nothing matches, fetch the MUST homepage as general context.

    Returns a cleaned text block ready for LLM context injection.
    """
    async with httpx.AsyncClient(
        timeout=_TIMEOUT,
        follow_redirects=True,
        headers=_HEADERS,
    ) as client:
        parts: list[str] = []

        # ── 1. Fetch news listing ─────────────────────────────────
        try:
            resp = await client.get(_NEWS_URL)
            resp.raise_for_status()
            news_items = _extract_news_items(resp.text)
        except Exception as exc:
            news_items = []
            parts.append(f"(Мэдээний хуудас ачаалахад алдаа: {exc})")

        if news_items:
            listing = "\n".join(
                f"- {item['title']}"
                + (f" ({item['snippet'][:80]})" if item["snippet"] else "")
                for item in news_items[:10]
            )
            parts.append(f"## must.edu.mn сүүлийн мэдээнүүд\n\n{listing}")

            # ── 2. Try to find a matching article ─────────────────
            q_lower = query.lower()
            q_words = set(re.sub(r"[^\w\s]", " ", q_lower).split())

            best_match: dict | None = None
            best_score = 0
            for item in news_items:
                title_words = set(re.sub(r"[^\w\s]", " ", item["title"].lower()).split())
                overlap = len(q_words & title_words)
                if overlap > best_score:
                    best_score = overlap
                    best_match = item

            if best_match and best_score >= 1:
                try:
                    detail_resp = await client.get(best_match["url"])
                    detail_resp.raise_for_status()
                    detail_text = _extract_text(detail_resp.text)[:_MAX_CONTENT_CHARS]
                    parts.append(
                        f"\n## Дэлгэрэнгүй: {best_match['title']}\n"
                        f"URL: {best_match['url']}\n\n"
                        f"{detail_text}"
                    )
                except Exception:
                    pass  # Fall through — we still have the listing
        else:
            # ── 3. Fallback: fetch homepage ───────────────────────
            try:
                resp = await client.get(_MAIN_URL)
                resp.raise_for_status()
                homepage_text = _extract_text(resp.text)[:_MAX_CONTENT_CHARS]
                parts.append(f"## must.edu.mn нүүр хуудас\n\n{homepage_text}")
            except Exception as exc:
                parts.append(f"(Вэб хуудас ачаалахад алдаа: {exc})")

    return "\n\n".join(parts)


async def fetch_must_page(url: str) -> str:
    """
    Fetch a specific must.edu.mn page and return its cleaned text.
    Used when the model wants to read a specific URL it found in the
    news listing.
    """
    # Safety: only allow must.edu.mn URLs
    if "must.edu.mn" not in url:
        return "Зөвхөн must.edu.mn домэйнд хандах боломжтой."

    async with httpx.AsyncClient(
        timeout=_TIMEOUT,
        follow_redirects=True,
        headers=_HEADERS,
    ) as client:
        try:
            resp = await client.get(url)
            resp.raise_for_status()
            return _extract_text(resp.text)[:_MAX_CONTENT_CHARS]
        except Exception as exc:
            return f"Хуудас ачаалахад алдаа гарлаа: {exc}"
