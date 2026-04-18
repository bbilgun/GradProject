"""
RAGService — Hybrid Search (FAISS Semantic + BM25 Keyword + RRF Fusion)
Indexes the MUST Student Handbook and performs hybrid retrieval.
"""

from __future__ import annotations

import os
import re
import json
from dataclasses import dataclass, field
from typing import List

import numpy as np
import faiss
from rank_bm25 import BM25Okapi
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


def _tokenize(text: str) -> list[str]:
    """Simple whitespace + lowercased tokenizer for BM25."""
    return text.lower().split()


def _reciprocal_rank_fusion(
    ranked_lists: list[list[int]],
    k: int = 60,
) -> list[tuple[int, float]]:
    """
    Reciprocal Rank Fusion (Cormack et al., 2009).

    Takes multiple ranked lists of chunk indices and returns a single
    fused ranking. Each item's score = sum(1 / (k + rank)) across all
    lists it appears in.

    Parameters
    ----------
    ranked_lists : list of lists of chunk indices, each ordered by relevance.
    k            : smoothing constant (default 60, standard in literature).

    Returns
    -------
    List of (chunk_index, rrf_score) sorted by descending score.
    """
    scores: dict[int, float] = {}
    for ranked in ranked_lists:
        for rank, idx in enumerate(ranked, start=1):
            scores[idx] = scores.get(idx, 0.0) + 1.0 / (k + rank)
    return sorted(scores.items(), key=lambda x: x[1], reverse=True)


class RAGService:
    MODEL_NAME = "paraphrase-multilingual-MiniLM-L12-v2"

    def __init__(self, handbook_path: str | None = None):
        self.handbook_path = handbook_path
        self.model: SentenceTransformer | None = None
        self.index: faiss.IndexFlatIP | None = None
        self.chunks: List[Chunk] = []
        self._bm25: BM25Okapi | None = None
        self._bm25_corpus: list[list[str]] = []  # tokenized texts parallel to self.chunks
        self._ready = False

    # ─────────────────────────────────────────────────────────────
    # BM25 helpers
    # ─────────────────────────────────────────────────────────────

    def _rebuild_bm25(self) -> None:
        """(Re)build the BM25 index from the current chunk list."""
        if not self.chunks:
            self._bm25 = None
            self._bm25_corpus = []
            return
        self._bm25_corpus = [_tokenize(c.text) for c in self.chunks]
        self._bm25 = BM25Okapi(self._bm25_corpus)

    # ─────────────────────────────────────────────────────────────
    # Public API
    # ─────────────────────────────────────────────────────────────

    def build(self) -> None:
        """Load handbook → chunk → embed → FAISS index + BM25 index."""
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

        print("[RAG] Building BM25 index…")
        self._rebuild_bm25()

        self._ready = True
        print("[RAG] Ready ✓  (hybrid: FAISS + BM25)")

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
        self._bm25 = None
        self._bm25_corpus = []
        self._ready = True
        print(f"[RAG] Empty index ready (dim={dim}) ✓")

    def add_chunks(self, new_chunks: List[Chunk]) -> int:
        """
        Embed *new_chunks* and insert them into the live FAISS index,
        then rebuild the BM25 index so keyword search covers them too.

        Returns the number of chunks actually added.
        """
        if not self._ready:
            raise RuntimeError("RAGService.build() / build_empty() must be called first.")
        if not new_chunks:
            return 0

        embeddings = self._embed([c.text for c in new_chunks])
        self.index.add(embeddings.astype(np.float32))
        self.chunks.extend(new_chunks)

        # Rebuild BM25 so the new chunks are searchable via keyword too
        self._rebuild_bm25()

        print(f"[RAG] +{len(new_chunks)} chunks  (total: {len(self.chunks)})")
        return len(new_chunks)

    # Score added to priority chunks (tuition, key regulations) to surface them first
    PRIORITY_BOOST = 0.15

    def _search_semantic(self, query: str, top_k: int) -> list[int]:
        """Return chunk indices ranked by FAISS cosine similarity."""
        q_emb = self._embed([query])
        raw_k = min(top_k, len(self.chunks)) if self.chunks else top_k
        scores, indices = self.index.search(q_emb.astype(np.float32), raw_k)

        # Build list applying priority boost, then sort
        candidates: list[tuple[float, int]] = []
        for score, idx in zip(scores[0], indices[0]):
            if idx == -1:
                continue
            chunk = self.chunks[idx]
            adjusted = float(score) + (self.PRIORITY_BOOST if chunk.priority else 0.0)
            candidates.append((adjusted, int(idx)))

        candidates.sort(key=lambda x: x[0], reverse=True)
        return [idx for _, idx in candidates]

    def _search_bm25(self, query: str, top_k: int) -> list[int]:
        """Return chunk indices ranked by BM25 keyword relevance."""
        if self._bm25 is None or not self._bm25_corpus:
            return []
        tokenized_query = _tokenize(query)
        scores = self._bm25.get_scores(tokenized_query)
        # Get top_k indices with highest BM25 scores (exclude zero-score)
        top_indices = np.argsort(scores)[::-1][:top_k]
        return [int(i) for i in top_indices if scores[i] > 0]

    def search(self, query: str, top_k: int = 6) -> List[SearchResult]:
        """
        Hybrid search: fetch candidates from both FAISS (semantic) and
        BM25 (keyword), fuse with Reciprocal Rank Fusion, then deduplicate.
        """
        if not self._ready:
            raise RuntimeError("RAGService not built yet. Call build() first.")

        # Fetch more candidates from each retriever so RRF has enough to work with
        fetch_k = min(top_k * 4, len(self.chunks)) if self.chunks else top_k * 4

        semantic_ranked = self._search_semantic(query, fetch_k)
        bm25_ranked = self._search_bm25(query, fetch_k)

        # Fuse the two ranked lists via RRF
        fused = _reciprocal_rank_fusion([semantic_ranked, bm25_ranked], k=60)

        # De-duplicate by (section_id, source_url) — keep highest RRF-scored chunk per section
        seen: set[str] = set()
        results: List[SearchResult] = []
        for idx, rrf_score in fused:
            chunk = self.chunks[idx]
            dedup_key = f"{chunk.section_id}::{chunk.source_url}"
            if dedup_key in seen:
                continue
            seen.add(dedup_key)
            results.append(
                SearchResult(
                    section_id=chunk.section_id,
                    section_title=chunk.section_title,
                    text=chunk.text[:400],
                    score=rrf_score,
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
