"""
MUST Handbook FastAPI Backend
Endpoints:
  POST /search      — Semantic search (RAG / FAISS)
  POST /summarize   — Summarise / answer questions about a text passage
  GET  /sync-web    — Mock web-scraper sync endpoint
  GET  /health      — Health check
"""

from __future__ import annotations

import os
import re
import json
from datetime import datetime, timezone
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from rag_service import RAGService

# ─────────────────────────────────────────────────────────────────
# Config
# ─────────────────────────────────────────────────────────────────

HANDBOOK_PATH = os.getenv(
    "HANDBOOK_PATH",
    os.path.join(os.path.dirname(__file__), "..", "..", "Downloads", "handbook_content.txt"),
)

# ─────────────────────────────────────────────────────────────────
# Lifecycle — build RAG index on startup
# ─────────────────────────────────────────────────────────────────

rag: RAGService | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global rag
    handbook_abs = os.path.abspath(HANDBOOK_PATH)
    if os.path.exists(handbook_abs):
        print(f"[Startup] Found handbook at {handbook_abs}")
        rag = RAGService(handbook_abs)
        rag.build()
    else:
        print(f"[Startup] WARNING: handbook not found at {handbook_abs}. Search will use fallback.")
        rag = None
    yield
    print("[Shutdown] Done.")


app = FastAPI(
    title="MUST Handbook API",
    version="1.0.0",
    description="RAG-powered semantic search for the MUST Student Handbook",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────────────────────────
# Schemas
# ─────────────────────────────────────────────────────────────────


class SearchRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=500, description="Search query")
    top_k: int = Field(6, ge=1, le=20, description="Number of results to return")


class SearchResultItem(BaseModel):
    section_id: str
    section_title: str
    text: str
    score: float


class SearchResponse(BaseModel):
    query: str
    results: list[SearchResultItem]
    total: int
    engine: str  # "semantic" | "fallback"


class SummarizeRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=20000)
    language: str = Field("mn", description="Response language: 'mn' (Mongolian) or 'en'")


class SummarizeResponse(BaseModel):
    summary: str
    tokens_used: Optional[int] = None


class SyncResponse(BaseModel):
    status: str
    message: str
    timestamp: str
    source: str


# ─────────────────────────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────────────────────────


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "rag_ready": rag is not None and rag._ready,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.post("/search", response_model=SearchResponse)
async def search(req: SearchRequest):
    """
    Perform semantic search across the MUST handbook using FAISS.
    Falls back to keyword matching if the RAG index is not available.
    """
    query = req.query.strip()

    if rag and rag._ready:
        raw_results = rag.search(query, top_k=req.top_k)
        results = [
            SearchResultItem(
                section_id=r.section_id,
                section_title=r.section_title,
                text=r.text,
                score=r.score,
            )
            for r in raw_results
        ]
        engine = "semantic"
    else:
        # Offline keyword fallback
        results = _keyword_fallback(query, req.top_k)
        engine = "fallback"

    return SearchResponse(
        query=query,
        results=results,
        total=len(results),
        engine=engine,
    )


@app.post("/summarize", response_model=SummarizeResponse)
async def summarize(req: SummarizeRequest):
    """
    Summarise / answer a question about the provided text.
    In production, swap _local_summarize() with an LLM call (OpenAI, Claude, etc.)
    """
    summary = _local_summarize(req.text)
    return SummarizeResponse(summary=summary)


@app.get("/sync-web", response_model=SyncResponse)
async def sync_web():
    """
    Mock endpoint for the future web-scraper integration.
    Will eventually crawl must.edu.mn and update the vector index.
    """
    return SyncResponse(
        status="success",
        message="Sync successful — web scraper placeholder. No real data was fetched.",
        timestamp=datetime.now(timezone.utc).isoformat(),
        source="mock",
    )


# ─────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────

# Section metadata (mirrors the frontend HandbookService)
_SECTIONS = {
    "introduction":          "ШУТИС танилцуулга",
    "schools":               "Бүрэлдэхүүн сургуулиуд",
    "core-curriculum":       "Цөм хөтөлбөр",
    "credit-system":         "Кредит тооцох тогтолцоо",
    "admission":             "Элсэлт",
    "digital-learning":      "Цахим сургалтын орчин",
    "graduation":            "Төгсөлт ба диплом",
    "student-life":          "Оюутны амьдрал",
    "dormitory":             "Оюутны байр",
    "health-services":       "Эрүүл мэнд",
    "scholarships":          "Тэтгэлэг ба санхүүгийн дэмжлэг",
    "exchange-programs":     "Оюутан солилцооны хөтөлбөр",
    "research":              "Эрдэм шинжилгээ ба Номын сан",
    "international-students":"Гадаад оюутанд",
}

_KEYWORD_MAP: dict[str, list[str]] = {
    "introduction":          ["шутис", "алсын харaa", "зорилго", "уриа", "эрхэм"],
    "schools":               ["сургууль", "хөтөлбөр", "барилга", "геологи", "мэдээлэл холбооны"],
    "core-curriculum":       ["цөм", "хичээл", "ерөнхий суурь", "мэргэжлийн"],
    "credit-system":         ["кредит", "хичээл сонголт", "үнэлгээ", "семестр", "улирал"],
    "admission":             ["элсэлт", "бүртгэл", "шалгалт", "элсэгч"],
    "digital-learning":      ["веб", "unimis", "апп", "цахим"],
    "graduation":            ["төгсөлт", "диплом", "хамгаалалт"],
    "student-life":          ["газрын зураг", "үнэмлэх", "тээвэр", "клуб", "байр"],
    "dormitory":             ["байр", "дотуур", "дорм"],
    "health-services":       ["эрүүл мэнд", "эмч", "даатгал", "шимтгэл"],
    "scholarships":          ["тэтгэлэг", "зээл", "урамшуулал", "мицубиши", "оюу толгой"],
    "exchange-programs":     ["солилцоо", "iaeste", "гадаад", "япон", "бнсу"],
    "research":              ["эрдэм шинжилгээ", "номын сан", "олимпиад", "бүтээл"],
    "international-students":["гадаад оюутан", "виз", "оршин суух", "цагаачлал"],
}


def _keyword_fallback(query: str, top_k: int) -> list[SearchResultItem]:
    q = query.lower()
    scored: list[tuple[str, int]] = []
    for slug, keywords in _KEYWORD_MAP.items():
        score = sum(1 for kw in keywords if kw in q)
        if score > 0:
            scored.append((slug, score))
    scored.sort(key=lambda x: x[1], reverse=True)

    results = []
    for slug, score in scored[:top_k]:
        results.append(SearchResultItem(
            section_id=slug,
            section_title=_SECTIONS.get(slug, slug),
            text=f'"{query}" гэсэн хайлтад холбоотой хэсэг.',
            score=float(score),
        ))
    return results


def _local_summarize(text: str) -> str:
    """
    Lightweight extractive summary (no LLM).
    In production, replace with:
      - Anthropic Claude API (claude-sonnet-4-6)
      - OpenAI GPT-4o
      - Any other LLM
    """
    # Strip markdown syntax
    clean = re.sub(r"[#*`|>_~\[\]()]", "", text)
    clean = re.sub(r"\n{2,}", "\n", clean).strip()

    sentences = re.split(r"[.!?\n]+", clean)
    sentences = [s.strip() for s in sentences if len(s.strip()) > 40]

    # Take first 5 sentences as summary
    summary_sentences = sentences[:5]

    if not summary_sentences:
        return "Энэ хэсгийн агуулга хураангуйлахад хангалтгүй байна."

    summary = ". ".join(summary_sentences) + "."
    prefix = (
        "📋 **Хураангуй:**\n\n"
        "*(Тэмдэглэл: Энэ хураангуй нь орон нутгийн алгоритмаар үүсгэгдсэн. "
        "Бүрэн үнэн зөв мэдээлэл авахыг хүсвэл must.edu.mn-аас шалгана уу.)*\n\n"
    )
    return prefix + summary
