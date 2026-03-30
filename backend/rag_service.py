"""
RAGService — Handbook Vector Search (FAISS + sentence-transformers)
Indexes the MUST Student Handbook and performs semantic search.
"""

from __future__ import annotations

import os
import re
import json
from dataclasses import dataclass, field
from typing import List

import numpy as np
import faiss
from sentence_transformers import SentenceTransformer

# ─────────────────────────────────────────────────────────────────
# Section slugs must match the frontend HandbookService IDs
# ─────────────────────────────────────────────────────────────────
SECTION_SLUGS = [
    "introduction",
    "schools",
    "core-curriculum",
    "credit-system",
    "admission",
    "digital-learning",
    "graduation",
    "student-life",
    "dormitory",
    "health-services",
    "scholarships",
    "exchange-programs",
    "research",
    "international-students",
]

# Map Mongolian keywords → section slug (used for keyword-based chunking)
SECTION_KEYWORDS: dict[str, list[str]] = {
    "introduction": ["алсын", "зорилго", "эрхэм зорилго", "уриа", "үнэт зүйлс", "шутис-ийн"],
    "schools": ["бүрэлдэхүүн сургууль", "харьяа сургууль", "хөтөлбөрүүд сургалтын", "барилга архитектур",
                "менежментийн сургууль", "геологи уул", "мэдээлэл холбооны технологийн сургууль"],
    "core-curriculum": ["цөм хөтөлбөр", "ерөнхий суурийн хичээл", "мэргэжлийн суурийн", "дадлага",
                        "дипломын төсөл", "бакалаврын хөтөлбөрийн ангилал"],
    "credit-system": ["кредит тооцох", "хичээл сонголт", "кредит шууд тооцох", "үнэлгээ",
                      "намрын улирал", "хаврын улирал", "семестр", "явцын шалгалт"],
    "admission": ["элсэлт", "бүртгэл", "элсэгч", "шалгалт", "элсэлтийн", "must elselt"],
    "digital-learning": ["оюутны веб", "цахим сургалт", "unimis", "must student", "route map",
                         "гар утасны аппликейшн"],
    "graduation": ["төгсөлт", "дипломын хамгаалалт", "дипломын төсөл", "sp", "np", "turnitin",
                   "placscan", "бүтээлийн хуулбарлалт"],
    "student-life": ["газрын зураг", "оюутны үнэмлэх", "нийтийн тээврийн", "u-money", "оюутны холбоо",
                     "клуб", "кампус"],
    "dormitory": ["оюутны байр", "байрны бүртгэл", "дотуур байр", "байрны журам"],
    "health-services": ["эрүүл мэнд", "эмчилгээ", "даатгал", "эмч", "эрүүл мэндийн төв",
                        "шимтгэл", "ebarimt"],
    "scholarships": ["тэтгэлэг", "кредитийн урамшуулал", "боловсролын зээлийн сан",
                     "мицубиши", "сумитомо", "тоёота", "оюу толгой", "таван богд",
                     "ажил эрхлэлт"],
    "exchange-programs": ["солилцооны хөтөлбөр", "iaeste", "гадаадад дадлага", "япон",
                          "бнсу", "хамтарсан хөтөлбөр"],
    "research": ["эрдэм шинжилгээ", "номын сан", "олимпиад", "робокон", "эрдмийн чуулган",
                 "бүтээл", "турниит"],
    "international-students": ["гадаад оюутан", "виз", "оршин суух зөвшөөрөл", "монгол хэлний",
                               "цагаачлалын"],
}


@dataclass
class Chunk:
    section_id: str
    section_title: str
    text: str
    chunk_index: int
    source_url: str = ""    # Original URL the chunk came from
    category: str = ""      # "rule" | "regulation" | "order" | "tuition" | "handbook" | "pdf"
    priority: bool = False  # True → score is boosted in ranking


@dataclass
class SearchResult:
    section_id: str
    section_title: str
    text: str
    score: float
    chunk_index: int
    source_url: str = ""
    category: str = ""


class RAGService:
    MODEL_NAME = "paraphrase-multilingual-MiniLM-L12-v2"

    def __init__(self, handbook_path: str | None = None):
        self.handbook_path = handbook_path
        self.model: SentenceTransformer | None = None
        self.index: faiss.IndexFlatIP | None = None
        self.chunks: List[Chunk] = []
        self._ready = False

    # ─────────────────────────────────────────────────────────────
    # Public API
    # ─────────────────────────────────────────────────────────────

    def build(self) -> None:
        """Load handbook → chunk → embed → FAISS index."""
        print("[RAG] Loading model…")
        self.model = SentenceTransformer(self.MODEL_NAME)

        print("[RAG] Reading handbook…")
        text = self._load_text()

        print("[RAG] Chunking…")
        self.chunks = self._chunk_text(text)
        print(f"[RAG] {len(self.chunks)} chunks created")

        print("[RAG] Embedding…")
        embeddings = self._embed([c.text for c in self.chunks])

        print("[RAG] Building FAISS index…")
        dim = embeddings.shape[1]
        self.index = faiss.IndexFlatIP(dim)
        self.index.add(embeddings.astype(np.float32))

        self._ready = True
        print("[RAG] Ready ✓")

    def build_empty(self) -> None:
        """
        Load the embedding model and create an empty FAISS index.
        Used when no handbook file is present — the index is populated
        entirely via add_chunks() (PDF sync).
        """
        print("[RAG] Loading model (empty-index mode)…")
        self.model = SentenceTransformer(self.MODEL_NAME)
        # Determine embedding dimension with a single probe encode
        probe = self.model.encode(["init"], normalize_embeddings=True)
        dim = probe.shape[1]
        self.index = faiss.IndexFlatIP(dim)
        self._ready = True
        print(f"[RAG] Empty index ready (dim={dim}) ✓")

    def add_chunks(self, new_chunks: List[Chunk]) -> int:
        """
        Embed *new_chunks* and insert them into the live FAISS index.
        Safe to call after build() or build_empty().

        Returns the number of chunks actually added.
        """
        if not self._ready:
            raise RuntimeError("RAGService.build() / build_empty() must be called first.")
        if not new_chunks:
            return 0

        embeddings = self._embed([c.text for c in new_chunks])
        self.index.add(embeddings.astype(np.float32))
        self.chunks.extend(new_chunks)
        print(f"[RAG] +{len(new_chunks)} chunks  (total: {len(self.chunks)})")
        return len(new_chunks)

    # Score added to priority chunks (tuition, key regulations) to surface them first
    PRIORITY_BOOST = 0.15

    def search(self, query: str, top_k: int = 6) -> List[SearchResult]:
        """
        Semantic search across all indexed chunks (handbook + PDFs + web).
        Priority chunks (e.g. tuition) receive a score boost so they
        surface at the top for relevant financial/fee queries.
        """
        if not self._ready:
            raise RuntimeError("RAGService not built yet. Call build() first.")

        q_emb = self._embed([query])
        # Fetch extra candidates so post-boost re-ranking can promote priority chunks
        raw_k = min(top_k * 4, len(self.chunks)) if self.chunks else top_k * 4
        scores, indices = self.index.search(q_emb.astype(np.float32), raw_k)

        # Build scored candidates, applying priority boost
        candidates: list[tuple[float, Chunk]] = []
        for score, idx in zip(scores[0], indices[0]):
            if idx == -1:
                continue
            chunk = self.chunks[idx]
            adjusted = float(score) + (self.PRIORITY_BOOST if chunk.priority else 0.0)
            candidates.append((adjusted, chunk))

        # Sort by adjusted score descending
        candidates.sort(key=lambda x: x[0], reverse=True)

        # De-duplicate by section_id (keep highest-scored chunk per section)
        seen: set[str] = set()
        results: List[SearchResult] = []
        for adjusted_score, chunk in candidates:
            dedup_key = f"{chunk.section_id}::{chunk.source_url}"
            if dedup_key in seen:
                continue
            seen.add(dedup_key)
            results.append(
                SearchResult(
                    section_id=chunk.section_id,
                    section_title=chunk.section_title,
                    text=chunk.text[:400],
                    score=adjusted_score,
                    chunk_index=chunk.chunk_index,
                    source_url=chunk.source_url,
                    category=chunk.category,
                )
            )
            if len(results) >= top_k:
                break

        return results

    # ─────────────────────────────────────────────────────────────
    # Private helpers
    # ─────────────────────────────────────────────────────────────

    def _load_text(self) -> str:
        with open(self.handbook_path, "r", encoding="utf-8") as f:
            return f.read()

    def _embed(self, texts: list[str]) -> np.ndarray:
        embeddings = self.model.encode(texts, normalize_embeddings=True, show_progress_bar=False)
        return np.array(embeddings)

    def _classify_section(self, text_lower: str) -> str:
        """Return the slug whose keywords best match a text chunk."""
        best_slug = "introduction"
        best_count = 0
        for slug, kws in SECTION_KEYWORDS.items():
            count = sum(1 for kw in kws if kw in text_lower)
            if count > best_count:
                best_count = count
                best_slug = slug
        return best_slug

    SECTION_TITLES = {
        "introduction": "ШУТИС танилцуулга",
        "schools": "Бүрэлдэхүүн сургуулиуд",
        "core-curriculum": "Цөм хөтөлбөр",
        "credit-system": "Кредит тооцох тогтолцоо",
        "admission": "Элсэлт",
        "digital-learning": "Цахим сургалтын орчин",
        "graduation": "Төгсөлт ба диплом",
        "student-life": "Оюутны амьдрал",
        "dormitory": "Оюутны байр",
        "health-services": "Эрүүл мэнд",
        "scholarships": "Тэтгэлэг ба санхүүгийн дэмжлэг",
        "exchange-programs": "Оюутан солилцооны хөтөлбөр",
        "research": "Эрдэм шинжилгээ ба Номын сан",
        "international-students": "Гадаад оюутанд",
    }

    def _chunk_text(self, raw: str, chunk_size: int = 350, overlap: int = 80) -> list[Chunk]:
        """
        Split raw OCR text into overlapping chunks, classify each chunk to
        a handbook section, and return the list.
        """
        # Normalise whitespace
        lines = [l.strip() for l in raw.splitlines()]
        clean_lines: list[str] = []
        for l in lines:
            if l:
                clean_lines.append(l)

        words = " ".join(clean_lines).split()
        chunks: list[Chunk] = []
        i = 0
        chunk_idx = 0

        while i < len(words):
            window = words[i : i + chunk_size]
            text = " ".join(window)
            slug = self._classify_section(text.lower())
            title = self.SECTION_TITLES.get(slug, slug)
            chunks.append(Chunk(
                section_id=slug,
                section_title=title,
                text=text,
                chunk_index=chunk_idx,
            ))
            i += chunk_size - overlap
            chunk_idx += 1

        return chunks
