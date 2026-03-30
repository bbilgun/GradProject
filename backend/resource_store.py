"""
ResourceStore — Persistent registry of every PDF / document resource.

Written by:  pdf_processor.sync_pdfs()  and  web_scraper.sync_web()
Read by:     GET /resources  endpoint

File layout
-----------
  resource_registry.json
  {
    "last_updated": "ISO-8601",
    "resources": [
      {
        "id":          "12-char hex (md5 of url)",
        "title":       "Mongolian document title",
        "url":         "https://...",
        "category":    "rule | regulation | order | tuition | pdf",
        "section_id":  "introduction | ...",
        "source_type": "text_pdf | scanned_pdf | web_page",
        "added_at":    "ISO-8601"
      }, ...
    ]
  }
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

_REGISTRY = Path(__file__).parent / "resource_registry.json"

# ── Display labels + icons per category (used by the API response) ──
CATEGORY_META: dict[str, dict] = {
    "rule":       {"label": "Дүрэм (Rules)",           "icon": "gavel"},
    "regulation": {"label": "Журам (Regulations)",      "icon": "description"},
    "order":      {"label": "Тушаал (Orders)",          "icon": "assignment"},
    "tuition":    {"label": "Сургалтын төлбөр (Tuition)", "icon": "payments"},
    "pdf":        {"label": "Бусад баримт",             "icon": "picture-as-pdf"},
}

_CATEGORY_ORDER = ["rule", "regulation", "order", "tuition", "pdf"]


# ─────────────────────────────────────────────────────────────────
# Internal I/O
# ─────────────────────────────────────────────────────────────────

def _load() -> dict:
    if _REGISTRY.exists():
        try:
            return json.loads(_REGISTRY.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {"resources": []}


def _save(data: dict) -> None:
    data["last_updated"] = datetime.now(timezone.utc).isoformat()
    _REGISTRY.write_text(
        json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8"
    )


def _resource_id(url: str) -> str:
    return hashlib.md5(url.encode()).hexdigest()[:12]


# ─────────────────────────────────────────────────────────────────
# Public write API
# ─────────────────────────────────────────────────────────────────

def register(
    *,
    title: str,
    url: str,
    category: str,
    section_id: str = "",
    source_type: str = "text_pdf",   # "text_pdf" | "scanned_pdf" | "web_page"
) -> None:
    """
    Upsert a resource entry.
    Silently skips if the URL is already registered.
    """
    data = _load()
    existing_urls = {r["url"] for r in data["resources"]}
    if url in existing_urls:
        return

    data["resources"].append({
        "id":          _resource_id(url),
        "title":       title.strip(),
        "url":         url,
        "category":    category,
        "section_id":  section_id,
        "source_type": source_type,
        "added_at":    datetime.now(timezone.utc).isoformat(),
    })
    _save(data)


def bulk_register(items: list[dict]) -> int:
    """Register multiple resources at once. Returns count of newly added."""
    data = _load()
    existing_urls = {r["url"] for r in data["resources"]}
    added = 0
    for item in items:
        url = item.get("url", "")
        if url and url not in existing_urls:
            data["resources"].append({
                "id":          _resource_id(url),
                "title":       item.get("title", "").strip(),
                "url":         url,
                "category":    item.get("category", "pdf"),
                "section_id":  item.get("section_id", ""),
                "source_type": item.get("source_type", "text_pdf"),
                "added_at":    datetime.now(timezone.utc).isoformat(),
            })
            existing_urls.add(url)
            added += 1
    if added:
        _save(data)
    return added


# ─────────────────────────────────────────────────────────────────
# Public read API
# ─────────────────────────────────────────────────────────────────

def get_grouped() -> dict:
    """
    Return all resources grouped by category, ordered by _CATEGORY_ORDER.

    Response shape
    --------------
    {
      "groups": [
        {
          "label":    "Дүрэм (Rules)",
          "category": "rule",
          "icon":     "gavel",
          "items": [
            {
              "id":          "abc123",
              "title":       "ШУТИС-ийн дүрэм",
              "url":         "https://...",
              "source_type": "text_pdf"
            }, ...
          ]
        }, ...
      ],
      "total":       42,
      "last_synced": "2026-03-30T..."
    }
    """
    data = _load()
    resources = data.get("resources", [])
    last_synced = data.get("last_updated", "")

    # Group
    buckets: dict[str, list[dict]] = {cat: [] for cat in _CATEGORY_ORDER}
    for r in resources:
        cat = r.get("category", "pdf")
        bucket = buckets.get(cat, buckets["pdf"])
        bucket.append({
            "id":          r.get("id", _resource_id(r["url"])),
            "title":       r["title"],
            "url":         r["url"],
            "source_type": r.get("source_type", "text_pdf"),
        })

    groups = []
    for cat in _CATEGORY_ORDER:
        items = buckets[cat]
        if not items:
            continue
        meta = CATEGORY_META.get(cat, {"label": cat, "icon": "description"})
        groups.append({
            "label":    meta["label"],
            "category": cat,
            "icon":     meta["icon"],
            "items":    items,
        })

    return {
        "groups":      groups,
        "total":       len(resources),
        "last_synced": last_synced,
    }


def get_recent(limit: int = 10) -> list[dict]:
    """Return the most recently added resources (for the Home screen Quick Links)."""
    data = _load()
    resources = data.get("resources", [])
    # Sort by added_at descending
    sorted_resources = sorted(
        resources, key=lambda r: r.get("added_at", ""), reverse=True
    )
    return [
        {
            "id":       r.get("id", ""),
            "title":    r["title"],
            "url":      r["url"],
            "category": r.get("category", "pdf"),
        }
        for r in sorted_resources[:limit]
    ]
