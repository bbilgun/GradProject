"""
web_search.py — Real-time web search tool for the AI assistant.

Scrapes must.edu.mn pages on demand and returns cleaned text that
Gemini can use as context to answer questions about recent events,
news, or specific university pages.
"""

from __future__ import annotations

import re
import time
from dataclasses import dataclass
from urllib.parse import urldefrag, urljoin, urlparse

import httpx
from bs4 import BeautifulSoup, Tag

# ─────────────────────────────────────────────────────────────────
# Constants
# ─────────────────────────────────────────────────────────────────

BASE_URL = "https://www.must.edu.mn"

# Key landing pages to search across
_NEWS_URL = f"{BASE_URL}/mn/news"
_MAIN_URL = BASE_URL
_SEARCH_SEED_URLS = [
    _NEWS_URL,
    f"{BASE_URL}/mn",
    f"{BASE_URL}/mn/page/546",  # rules
    f"{BASE_URL}/mn/page/501",  # regulations
    f"{BASE_URL}/mn/page/499",  # orders
    f"{BASE_URL}/mn/page/193",  # tuition
]

_HEADERS = {
    "User-Agent": "MUST-Handbook-Bot/2.0 (+https://must.edu.mn)",
    "Accept-Language": "mn,en;q=0.9",
}

_TIMEOUT = httpx.Timeout(connect=8.0, read=15.0, write=5.0, pool=5.0)

# Maximum characters of cleaned page text to return
_MAX_CONTENT_CHARS = 3000
_CACHE_TTL_SECONDS = 300
_PAGE_CACHE: dict[str, tuple[float, str]] = {}

_STOPWORDS = {
    "нь", "юм", "вэ", "юу", "уу", "бол", "болон", "эсвэл", "энэ", "тэр",
    "тухай", "хэрхэн", "яаж", "авах", "өгөх", "байна", "байдаг", "миний",
    "the", "a", "an", "and", "or", "of", "to", "in", "for", "about",
}

_RECENT_WORDS = {
    "сүүлийн", "шинэ", "мэдээ", "өнөөдөр", "өчигдөр", "маргааш",
    "энэ", "долоо", "хоног", "latest", "recent", "today", "news",
}


# ─────────────────────────────────────────────────────────────────
# Data types
# ─────────────────────────────────────────────────────────────────

@dataclass
class WebSearchResult:
    """One page of scraped content."""
    title: str
    url: str
    snippet: str
    date: str = ""
    score: float = 0.0


# ─────────────────────────────────────────────────────────────────
# HTML → clean text
# ─────────────────────────────────────────────────────────────────

def _normalise_space(text: str) -> str:
    text = re.sub(r"[ \t\r\f\v]+", " ", text or "")
    text = re.sub(r"\n\s*\n\s*\n+", "\n\n", text)
    return text.strip()


def _dedupe_repeated_words(text: str) -> str:
    words = text.split()
    if len(words) < 4 or len(words) % 2:
        return text
    midpoint = len(words) // 2
    if words[:midpoint] == words[midpoint:]:
        return " ".join(words[:midpoint])
    return text


def _is_noise_line(line: str) -> bool:
    line_l = line.lower()
    if line_l in {"мэдээ", "зарлал", "элсэгч", "холбоо барих", "ажлын байр"}:
        return True
    noisy_phrases = [
        "мэдээ зарлал science fm",
        "элсэгч холбоо барих ажлын байр",
        "science fm",
        "холбоо барих",
        "facebook",
        "youtube",
        "copyright",
    ]
    return any(phrase in line_l for phrase in noisy_phrases)


def _canonical_url(url: str, page_url: str = BASE_URL) -> str:
    absolute = urljoin(page_url, url.strip())
    absolute, _fragment = urldefrag(absolute)
    return absolute


def _is_allowed_url(url: str) -> bool:
    parsed = urlparse(url)
    return parsed.scheme in {"http", "https"} and parsed.netloc.endswith("must.edu.mn")


def _tokens(text: str) -> set[str]:
    return {
        token
        for token in re.sub(r"[^\w\sА-Яа-яӨөҮүЁё]", " ", (text or "").lower()).split()
        if len(token) > 1 and token not in _STOPWORDS
    }


def _score_result(query: str, title: str, snippet: str, url: str = "") -> float:
    q_tokens = _tokens(query)
    if not q_tokens:
        return 0.0

    title_tokens = _tokens(title)
    snippet_tokens = _tokens(snippet)
    url_l = url.lower()
    score = 0.0
    score += 4.0 * len(q_tokens & title_tokens)
    score += 1.25 * len(q_tokens & snippet_tokens)
    if "/mn/news/" in url_l or "/mn/post/" in url_l:
        score += 0.75
    if q_tokens & _RECENT_WORDS and ("/mn/news" in url_l or "/mn/post" in url_l):
        score += 2.0
    return score


async def _get_text(client: httpx.AsyncClient, url: str) -> str:
    now = time.time()
    cached = _PAGE_CACHE.get(url)
    if cached and now - cached[0] < _CACHE_TTL_SECONDS:
        return cached[1]

    last_exc: Exception | None = None
    for attempt in range(3):
        try:
            resp = await client.get(url)
            resp.raise_for_status()
            text = resp.text
            _PAGE_CACHE[url] = (now, text)
            return text
        except Exception as exc:
            last_exc = exc
            await asyncio_sleep_backoff(attempt)
    raise last_exc or RuntimeError(f"Could not fetch {url}")


async def asyncio_sleep_backoff(attempt: int) -> None:
    import asyncio

    await asyncio.sleep(0.35 * (attempt + 1))


def _extract_text(html: str) -> str:
    """Strip tags, scripts, styles and collapse whitespace."""
    soup = BeautifulSoup(html, "lxml")
    for tag in soup(["script", "style", "nav", "footer", "header", "noscript", "form"]):
        tag.decompose()

    main = soup.find(["main", "article"]) or soup.find(
        "div",
        class_=re.compile(r"(content|entry|article|news|body|main)", re.I),
    )
    target = main or soup.body or soup
    lines = [
        _normalise_space(line)
        for line in target.get_text(separator="\n", strip=True).splitlines()
    ]
    cleaned: list[str] = []
    seen: set[str] = set()
    for line in lines:
        if not line or len(line) < 2 or _is_noise_line(line):
            continue
        compact = line.lower()
        if compact in seen:
            continue
        seen.add(compact)
        cleaned.append(line)
    return "\n".join(cleaned).strip()


def _extract_page_meta(html: str, url: str) -> tuple[str, str]:
    soup = BeautifulSoup(html, "lxml")
    title = ""
    for selector in [
        "meta[property='og:title']",
        "meta[name='twitter:title']",
    ]:
        tag = soup.select_one(selector)
        if tag and tag.get("content"):
            title = tag["content"].strip()
            break
    if not title:
        heading = soup.find(["h1", "h2", "h3"])
        title = heading.get_text(" ", strip=True) if heading else ""
    if not title and soup.title:
        title = soup.title.get_text(" ", strip=True)
    if not title:
        title = urlparse(url).path.rsplit("/", 1)[-1] or url

    date = ""
    time_tag = soup.find("time")
    if time_tag:
        date = time_tag.get("datetime") or time_tag.get_text(" ", strip=True)
    if not date:
        date_tag = soup.find(class_=re.compile(r"(date|time|created|published)", re.I))
        if date_tag:
            date = date_tag.get_text(" ", strip=True)

    return _normalise_space(title), _normalise_space(date)


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

        url = _canonical_url(href)
        if not _is_allowed_url(url):
            continue

        # Title: first heading inside the card, or the link text
        heading = a_tag.find(["h1", "h2", "h3", "h4", "h5"])
        title = heading.get_text(strip=True) if heading else a_tag.get_text(separator=" ", strip=True)
        title = _dedupe_repeated_words(_normalise_space(title))
        if not title or len(title) < 3 or title.lower() in {"мэдээ", "зарлал"}:
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
        snippet = _dedupe_repeated_words(_normalise_space(" ".join(snippet_parts)))
        if snippet.startswith(title):
            snippet = snippet[len(title):].strip()
        snippet = snippet[:240]
        date = ""
        date_tag = a_tag.find(["time"]) or a_tag.find(class_=re.compile(r"(date|time)", re.I))
        if date_tag:
            date = _normalise_space(date_tag.get("datetime") or date_tag.get_text(" ", strip=True))

        items.append({"title": title, "url": url, "snippet": snippet, "date": date})

    # Deduplicate by URL
    seen: set[str] = set()
    deduped: list[dict] = []
    for item in items:
        if item["url"] not in seen:
            seen.add(item["url"])
            deduped.append(item)

    return deduped[:25]  # Cap to 25 items


def _extract_relevant_links(html: str, page_url: str, query: str) -> list[WebSearchResult]:
    soup = BeautifulSoup(html, "lxml")
    results: list[WebSearchResult] = []
    seen: set[str] = set()

    for a_tag in soup.find_all("a", href=True):
        url = _canonical_url(a_tag["href"], page_url)
        if url in seen or not _is_allowed_url(url):
            continue
        if not any(part in url for part in ("/mn/news", "/mn/post", "/mn/page", "/media/uploads")):
            continue

        title = _normalise_space(a_tag.get_text(" ", strip=True))
        if not title:
            title = urlparse(url).path.rsplit("/", 1)[-1]
        if len(title) < 3:
            continue

        parent_text = ""
        if isinstance(a_tag.parent, Tag):
            parent_text = _normalise_space(a_tag.parent.get_text(" ", strip=True))[:280]

        score = _score_result(query, title, parent_text, url)
        if score <= 0 and not (_tokens(query) & _RECENT_WORDS and "/mn/news" in url):
            continue

        seen.add(url)
        results.append(WebSearchResult(
            title=title,
            url=url,
            snippet=parent_text,
            score=score,
        ))

    return results


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
    import asyncio

    async with httpx.AsyncClient(
        timeout=_TIMEOUT,
        follow_redirects=True,
        headers=_HEADERS,
    ) as client:
        parts: list[str] = []
        candidates: dict[str, WebSearchResult] = {}

        # ── 1. Fetch seed pages concurrently ──────────────────────
        seed_pages: list[tuple[str, str]] = []
        seed_fetches = await asyncio.gather(
            *[_get_text(client, url) for url in _SEARCH_SEED_URLS],
            return_exceptions=True,
        )
        for url, result in zip(_SEARCH_SEED_URLS, seed_fetches):
            if isinstance(result, Exception):
                parts.append(f"(Хуудас ачаалахад алдаа: {url} — {result})")
                continue
            seed_pages.append((url, result))

        # ── 2. Parse news listing + broad page links ──────────────
        news_items: list[dict] = []
        for page_url, html in seed_pages:
            if page_url == _NEWS_URL:
                news_items = _extract_news_items(html)
                for item in news_items:
                    score = _score_result(query, item["title"], item.get("snippet", ""), item["url"])
                    if not score and _tokens(query) & _RECENT_WORDS:
                        score = 1.0
                    candidates[item["url"]] = WebSearchResult(
                        title=item["title"],
                        url=item["url"],
                        snippet=item.get("snippet", ""),
                        date=item.get("date", ""),
                        score=score,
                    )

            for item in _extract_relevant_links(html, page_url, query):
                existing = candidates.get(item.url)
                if not existing or item.score > existing.score:
                    candidates[item.url] = item

        if news_items:
            listing = "\n".join(
                f"- {item['title']}"
                + (f" — {item['date']}" if item.get("date") else "")
                + (f" ({item['snippet'][:80]})" if item["snippet"] else "")
                for item in news_items[:10]
            )
            parts.append(f"## must.edu.mn сүүлийн мэдээнүүд\n\n{listing}")

        ranked = sorted(candidates.values(), key=lambda item: item.score, reverse=True)
        if not ranked and seed_pages:
            homepage_text = _extract_text(seed_pages[0][1])[:_MAX_CONTENT_CHARS]
            parts.append(f"## must.edu.mn ерөнхий мэдээлэл\n\n{homepage_text}")
            return "\n\n".join(parts)

        # ── 3. Fetch top matching pages for detailed context ──────
        top_matches = [
            item for item in ranked
            if item.score > 0 and not urlparse(item.url).path.lower().endswith(".pdf")
        ][:3]

        if top_matches:
            detail_fetches = await asyncio.gather(
                *[_get_text(client, item.url) for item in top_matches],
                return_exceptions=True,
            )
            for item, detail in zip(top_matches, detail_fetches):
                if isinstance(detail, Exception):
                    continue
                try:
                    title, date = _extract_page_meta(detail, item.url)
                    detail_text = _extract_text(detail)[:_MAX_CONTENT_CHARS]
                except Exception:
                    continue
                parts.append(
                    f"\n## Олдсон эх сурвалж: {title or item.title}\n"
                    f"URL: {item.url}\n"
                    + (f"Огноо: {date}\n" if date else "")
                    + f"\n{detail_text}"
                )

        if ranked:
            link_list = "\n".join(
                f"- {item.title} — {item.url}"
                for item in ranked[:8]
            )
            parts.append(f"## Холбоотой холбоосууд\n\n{link_list}")

    return "\n\n".join(parts)


async def fetch_must_page(url: str) -> str:
    """
    Fetch a specific must.edu.mn page and return its cleaned text.
    Used when the model wants to read a specific URL it found in the
    news listing.
    """
    url = _canonical_url(url)
    if not _is_allowed_url(url):
        return "Зөвхөн must.edu.mn домэйнд хандах боломжтой."

    async with httpx.AsyncClient(
        timeout=_TIMEOUT,
        follow_redirects=True,
        headers=_HEADERS,
    ) as client:
        try:
            html = await _get_text(client, url)
            title, date = _extract_page_meta(html, url)
            text = _extract_text(html)[:_MAX_CONTENT_CHARS]
            return (
                f"## {title}\n"
                f"URL: {url}\n"
                + (f"Огноо: {date}\n" if date else "")
                + f"\n{text}"
            )
        except Exception as exc:
            return f"Хуудас ачаалахад алдаа гарлаа: {exc}"
