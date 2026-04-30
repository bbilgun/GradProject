"""
Small JSON cache for extracted RAG chunks.

The hash caches in pdf_processor.py and web_scraper.py tell us whether a
remote file changed, but the in-memory FAISS index is rebuilt on every
backend restart. This cache stores extracted chunk text so unchanged sources
can still be restored into the fresh index without re-parsing every PDF.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


def load_chunk_cache(path: Path) -> dict[str, Any]:
    if path.exists():
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            return {}
    return {}


def save_chunk_cache(path: Path, cache: dict[str, Any]) -> None:
    path.write_text(json.dumps(cache, indent=2, ensure_ascii=False), encoding="utf-8")


def rag_has_source(rag, source_url: str) -> bool:
    if not source_url or not getattr(rag, "chunks", None):
        return False
    return any(chunk.source_url == source_url for chunk in rag.chunks)


def serialize_chunks(chunks: list) -> list[dict[str, Any]]:
    return [
        {
            "section_id": chunk.section_id,
            "section_title": chunk.section_title,
            "text": chunk.text,
            "chunk_index": chunk.chunk_index,
            "source_url": chunk.source_url,
            "category": chunk.category,
            "priority": chunk.priority,
        }
        for chunk in chunks
    ]


def deserialize_chunks(items: list[dict[str, Any]]) -> list:
    from rag_service import Chunk

    return [
        Chunk(
            section_id=item.get("section_id", "introduction"),
            section_title=item.get("section_title", ""),
            text=item.get("text", ""),
            chunk_index=int(item.get("chunk_index", index)),
            source_url=item.get("source_url", ""),
            category=item.get("category", ""),
            priority=bool(item.get("priority", False)),
        )
        for index, item in enumerate(items)
        if item.get("text")
    ]


def get_cached_chunks(
    cache: dict[str, Any],
    key: str,
    content_hash: str,
    *,
    cache_version: str | None = None,
) -> list | None:
    entry = cache.get(key)
    if not isinstance(entry, dict) or entry.get("hash") != content_hash:
        return None
    if cache_version is not None and entry.get("cache_version") != cache_version:
        return None
    return deserialize_chunks(entry.get("chunks", []))


def put_cached_chunks(
    cache: dict[str, Any],
    key: str,
    content_hash: str,
    chunks: list,
    *,
    cache_version: str | None = None,
) -> None:
    entry = {
        "hash": content_hash,
        "chunks": serialize_chunks(chunks),
    }
    if cache_version is not None:
        entry["cache_version"] = cache_version
    cache[key] = entry
