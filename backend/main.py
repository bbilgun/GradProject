"""
MUST Handbook FastAPI Backend
═════════════════════════════
Endpoints
---------
  POST /search      — Semantic search (handbook + indexed PDFs)
  POST /summarize   — Extractive summarisation of a text passage
  GET  /sync        — Manually trigger PDF download + FAISS update
  GET  /health      — Health / readiness check

Startup
-------
  1. Build the FAISS index from the local handbook text file (if present).
  2. Kick off a background task that downloads and indexes all official
     MUST PDFs into the same FAISS index.
"""

from __future__ import annotations

import asyncio
import os
import re

# Load .env from the backend directory before anything reads os.getenv()
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from rag_service import RAGService

# ─────────────────────────────────────────────────────────────────
# Config
# ─────────────────────────────────────────────────────────────────

HANDBOOK_PATH = os.getenv(
    "HANDBOOK_PATH",
    os.path.join(os.path.dirname(__file__), "..", "..", "..", "Downloads", "handbook_content.txt"),
)

# ─────────────────────────────────────────────────────────────────
# Globals
# ─────────────────────────────────────────────────────────────────

rag: RAGService | None = None
_sync_lock = asyncio.Lock()          # Prevents concurrent FAISS mutations
_sync_running = False                # Human-readable status flag


# ─────────────────────────────────────────────────────────────────
# Lifespan — startup / shutdown
# ─────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    global rag

    handbook_abs = os.path.abspath(HANDBOOK_PATH)

    if os.path.exists(handbook_abs):
        print(f"[Startup] Building handbook index from: {handbook_abs}")
        rag = RAGService(handbook_abs)
        rag.build()
    else:
        print(f"[Startup] Handbook file not found at {handbook_abs}.")
        print("[Startup] Initialising empty index — PDF sync will populate it.")
        rag = RAGService()
        rag.build_empty()

    # Non-blocking background PDF sync — server accepts requests immediately
    asyncio.create_task(_run_background_sync())

    yield  # ← server is live here

    print("[Shutdown] Bye.")


async def _run_background_sync() -> None:
    """Download & index all sources in the background without blocking startup."""
    global _sync_running
    from pdf_processor import sync_pdfs
    from web_scraper import sync_web

    print("[Startup] Background sync starting…")
    _sync_running = True
    try:
        async with _sync_lock:
            # 1. Fixed PDF catalogue
            pdf_result = await sync_pdfs(rag, force=False)
            print(
                f"[Startup] Fixed PDFs — "
                f"processed={pdf_result.processed}, skipped={pdf_result.skipped}, "
                f"chunks={pdf_result.total_chunks}, errors={len(pdf_result.errors)}"
            )
            # 2. Web-scraped pages + discovered PDFs
            web_result = await sync_web(rag, force=False)
            print(
                f"[Startup] Web sync — "
                f"discovered={web_result.pdfs_discovered}, "
                f"indexed={web_result.pdfs_indexed}, "
                f"static={web_result.pdfs_static}, "
                f"tuition_chunks={web_result.tuition_chunks}, "
                f"errors={len(web_result.errors)}"
            )
        for err in pdf_result.errors + web_result.errors:
            print(f"[Startup]   ⚠  {err}")
    except Exception as exc:
        print(f"[Startup] Background sync crashed: {exc}")
    finally:
        _sync_running = False


# ─────────────────────────────────────────────────────────────────
# App
# ─────────────────────────────────────────────────────────────────

app = FastAPI(
    title="MUST Handbook API",
    version="2.0.0",
    description=(
        "RAG-powered semantic search across the MUST Student Handbook "
        "and official PDF regulations/procedures."
    ),
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
    query: str = Field(..., min_length=1, max_length=500)
    top_k: int = Field(6, ge=1, le=20)


class SearchResultItem(BaseModel):
    section_id: str
    section_title: str
    text: str
    score: float
    source_url: str = ""
    category: str = ""
    result_type: str = "semantic"   # "semantic" | "static_resource"


class SearchResponse(BaseModel):
    query: str
    results: list[SearchResultItem]
    total: int
    engine: str   # "semantic" | "fallback"


class SummarizeRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=20_000)
    language: str = Field("mn")


class ChatMessage(BaseModel):
    role: str   # "user" | "assistant"
    content: str


class ChatRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=1000)
    history: list[ChatMessage] = Field(default_factory=list)


class SummarizeResponse(BaseModel):
    summary: str
    tokens_used: Optional[int] = None


class SyncResponse(BaseModel):
    status: str                  # "success" | "partial" | "error" | "busy"
    message: str
    timestamp: str
    # Fixed PDF catalogue (pdf_processor)
    pdfs_processed: int
    chunks_added: int
    skipped: int
    # Web-scraped PDFs (web_scraper)
    web_pdfs_discovered: int = 0
    web_pdfs_indexed: int = 0
    web_pdfs_static: int = 0     # Scanned PDFs saved to static_resources.json
    tuition_chunks: int = 0
    errors: list[str]


# ─────────────────────────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "rag_ready": rag is not None and rag._ready,
        "total_chunks": len(rag.chunks) if rag else 0,
        "sync_running": _sync_running,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.post("/search", response_model=SearchResponse)
async def search(req: SearchRequest):
    """
    Unified search across:
      1. FAISS index  — handbook + text-based PDFs + tuition (semantic)
      2. static_resources.json — scanned PDFs (keyword title match)
    Falls back to keyword matching when the FAISS index is not ready.
    """
    from web_scraper import search_static_resources

    query = req.query.strip()

    if rag and rag._ready and len(rag.chunks) > 0:
        raw = rag.search(query, top_k=req.top_k)
        semantic_results = [
            SearchResultItem(
                section_id=r.section_id,
                section_title=r.section_title,
                text=r.text,
                score=r.score,
                source_url=r.source_url,
                category=r.category,
                result_type="semantic",
            )
            for r in raw
        ]
        engine = "semantic"
    else:
        semantic_results = _keyword_fallback(query, req.top_k)
        engine = "fallback"

    # Merge static resource results (scanned PDFs matched by title keywords)
    static_hits = search_static_resources(query, top_k=3)
    static_results = [
        SearchResultItem(
            section_id=r.get("section_id", "introduction"),
            section_title=r["title"],
            text=f"PDF баримт бичиг: {r['title']}",
            score=0.6,   # Fixed score; ranked below semantic results
            source_url=r["url"],
            category=r.get("category", "pdf"),
            result_type="static_resource",
        )
        for r in static_hits
    ]

    # Combine: semantic first, then static (no duplicates by source_url)
    seen_urls: set[str] = {r.source_url for r in semantic_results if r.source_url}
    deduped_static = [r for r in static_results if r.source_url not in seen_urls]
    results = (semantic_results + deduped_static)[: req.top_k + 3]

    return SearchResponse(query=query, results=results, total=len(results), engine=engine)


@app.post("/summarize", response_model=SummarizeResponse)
async def summarize(req: SummarizeRequest):
    """
    Extractive summary of the provided text.
    Replace _local_summarize() with an LLM call (Claude, GPT-4o, etc.)
    for production quality.
    """
    return SummarizeResponse(summary=_local_summarize(req.text))


# Short system prompt = fewer input tokens billed every request
_SYSTEM_PROMPT = (
    "Та ШУТИС-ийн оюутны AI туслах. "
    "Гарын авлагын мэдээлэл өгөгдвөл түүнд тулгуурлан хариул. "
    "Энгийн яриа бол байгалийн байдлаар хариул. "
    "Хариултаа үргэлж бүрэн дуусга — дундаас таслахгүй."
)

# Casual / greeting keywords — skip RAG search for these to save tokens
_CASUAL = {
    "сайн", "байна", "уу", "юу", "hello", "hi", "hey", "баярлалаа",
    "thanks", "thank", "ok", "ок", "тийм", "үгүй", "за", "болж",
}

GEMINI_KEY = os.getenv("GEMINI_API_KEY", "")

# Reuse a single Gemini client (avoid re-creating per request)
_gemini_client = None


def _get_ai_client():
    global _gemini_client
    if _gemini_client is None:
        from google import genai
        _gemini_client = genai.Client(api_key=GEMINI_KEY)
    return _gemini_client


def _is_casual(query: str) -> bool:
    words = set(re.sub(r"[^\w\s]", "", query.lower()).split())
    return len(words) <= 4 and bool(words & _CASUAL)


def _truncate(text: str, max_chars: int = 400) -> str:
    return text[:max_chars] + "…" if len(text) > max_chars else text


@app.post("/chat")
async def chat(req: ChatRequest):
    """
    Conversational AI endpoint powered by Claude Haiku (lowest cost tier).

    Cost controls
    -------------
    - Shortest viable system prompt (billed on every request).
    - Skip RAG search for casual messages.
    - Top-3 chunks, each truncated to 400 chars.
    - History capped at last 6 turns.
    - max_tokens=512 (enough for handbook answers).
    """
    if not GEMINI_KEY:
        raise HTTPException(
            status_code=503,
            detail="GEMINI_API_KEY тохируулаагүй байна.",
        )

    # ── 1. RAG context (skip for casual messages) ──────────────
    context_block = ""
    if not _is_casual(req.query) and rag and rag._ready and len(rag.chunks) > 0:
        try:
            raw = rag.search(req.query, top_k=3)          # 3 chunks, not 5
            if raw:
                snippets = "\n---\n".join(
                    f"[{r.section_title}]\n{_truncate(r.text)}"   # 400 chars each
                    for r in raw
                )
                context_block = f"\n\nХолбогдох мэдээлэл:\n{snippets}"
        except Exception:
            pass

    # ── 2. Build Gemini history (last 6 turns) ─────────────────
    gemini_history = []
    for m in req.history[-6:]:
        if m.role == "user":
            gemini_history.append({"role": "user", "parts": [{"text": m.content}]})
        elif m.role == "assistant":
            gemini_history.append({"role": "model", "parts": [{"text": m.content}]})

    user_content = req.query + context_block

    # ── 3. Call Gemini ─────────────────────────────────────────
    def _call_gemini():
        from google.genai import types
        client = _get_ai_client()
        # Build contents: history + current user message
        contents = gemini_history + [{"role": "user", "parts": [{"text": user_content}]}]
        resp = client.models.generate_content(
            model="models/gemini-2.5-flash",
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=_SYSTEM_PROMPT,
                max_output_tokens=2048,
                thinking_config=types.ThinkingConfig(thinking_budget=0),
            ),
        )
        return resp.text

    try:
        reply = await asyncio.get_event_loop().run_in_executor(None, _call_gemini)
        return {"reply": reply or "Хариу авахад алдаа гарлаа."}
    except Exception as exc:
        err = str(exc)
        if "429" in err or "quota" in err.lower() or "ResourceExhausted" in err:
            raise HTTPException(status_code=429, detail="API хүсэлтийн лимит хэтэрлээ. Түр хүлээгээд дахин оролдоно уу.")
        raise HTTPException(status_code=502, detail="AI үйлчилгээнд алдаа гарлаа. Дахин оролдоно уу.")


@app.get("/sync", response_model=SyncResponse)
async def sync_endpoint(
    force: bool = Query(False, description="Re-index PDFs even if content is unchanged"),
):
    """
    Manually trigger a PDF sync.

    - Downloads each PDF from must.edu.mn
    - Skips files whose SHA-256 hash matches the cache (unless ?force=true)
    - Adds new/changed chunks to the live FAISS index without downtime
    """
    global _sync_running

    if _sync_lock.locked():
        return SyncResponse(
            status="busy",
            message="A sync is already in progress. Try again shortly.",
            timestamp=datetime.now(timezone.utc).isoformat(),
            pdfs_processed=0,
            chunks_added=0,
            skipped=0,
            errors=[],
        )

    if not rag or not rag._ready:
        raise HTTPException(status_code=503, detail="RAG service is not ready yet.")

    from pdf_processor import sync_pdfs
    from web_scraper import sync_web

    _sync_running = True
    try:
        async with _sync_lock:
            pdf_result = await sync_pdfs(rag, force=force)
            web_result = await sync_web(rag, force=force)
    finally:
        _sync_running = False

    all_errors = pdf_result.errors + web_result.errors
    total_chunks = pdf_result.total_chunks + web_result.total_chunks

    if all_errors and pdf_result.processed == 0 and web_result.pdfs_indexed == 0:
        status = "error"
    elif all_errors:
        status = "partial"
    else:
        status = "success"

    return SyncResponse(
        status=status,
        message=(
            f"Fixed PDFs: processed={pdf_result.processed}, skipped={pdf_result.skipped}. "
            f"Web: discovered={web_result.pdfs_discovered}, "
            f"indexed={web_result.pdfs_indexed}, scanned={web_result.pdfs_static}. "
            f"Total new chunks: {total_chunks}."
        ),
        timestamp=datetime.now(timezone.utc).isoformat(),
        pdfs_processed=pdf_result.processed,
        chunks_added=total_chunks,
        skipped=pdf_result.skipped,
        web_pdfs_discovered=web_result.pdfs_discovered,
        web_pdfs_indexed=web_result.pdfs_indexed,
        web_pdfs_static=web_result.pdfs_static,
        tuition_chunks=web_result.tuition_chunks,
        errors=all_errors,
    )


# Keep the old path as an alias so the mobile app doesn't break
@app.get("/sync-web", response_model=SyncResponse, include_in_schema=False)
async def sync_web_alias(force: bool = Query(False)):
    return await sync_endpoint(force=force)


@app.get("/resources")
async def get_resources():
    """
    Return all registered PDF / document resources grouped by category.

    Response shape
    --------------
    {
      "groups": [
        {
          "label":    "Дүрэм (Rules)",
          "category": "rule",
          "icon":     "gavel",
          "items": [{"id", "title", "url", "source_type"}, ...]
        }, ...
      ],
      "total":       42,
      "last_synced": "ISO-8601"
    }
    """
    import resource_store
    return resource_store.get_grouped()


@app.get("/resources/recent")
async def get_recent_resources(limit: int = Query(10, ge=1, le=50)):
    """Return the *limit* most recently registered resources (for Quick Links)."""
    import resource_store
    return {"items": resource_store.get_recent(limit=limit)}


# ─────────────────────────────────────────────────────────────────
# Keyword fallback (used when FAISS index is empty / building)
# ─────────────────────────────────────────────────────────────────

_SECTIONS = {
    "introduction":           "ШУТИС танилцуулга",
    "schools":                "Бүрэлдэхүүн сургуулиуд",
    "core-curriculum":        "Цөм хөтөлбөр",
    "credit-system":          "Кредит тооцох тогтолцоо",
    "admission":              "Элсэлт",
    "digital-learning":       "Цахим сургалтын орчин",
    "graduation":             "Төгсөлт ба диплом",
    "student-life":           "Оюутны амьдрал",
    "dormitory":              "Оюутны байр",
    "health-services":        "Эрүүл мэнд",
    "scholarships":           "Тэтгэлэг ба санхүүгийн дэмжлэг",
    "exchange-programs":      "Оюутан солилцооны хөтөлбөр",
    "research":               "Эрдэм шинжилгээ ба Номын сан",
    "international-students": "Гадаад оюутанд",
}

_KEYWORD_MAP: dict[str, list[str]] = {
    "introduction":           ["шутис", "алсын харaa", "зорилго", "уриа", "эрхэм", "дүрэм"],
    "schools":                ["сургууль", "хөтөлбөр", "барилга", "геологи", "мэдээлэл холбооны"],
    "core-curriculum":        ["цөм", "хичээл", "ерөнхий суурь", "мэргэжлийн"],
    "credit-system":          ["кредит", "хичээл сонголт", "үнэлгээ", "семестр", "улирал"],
    "admission":              ["элсэлт", "бүртгэл", "шалгалт", "элсэгч"],
    "digital-learning":       ["веб", "unimis", "апп", "цахим"],
    "graduation":             ["төгсөлт", "диплом", "хамгаалалт", "журам"],
    "student-life":           ["газрын зураг", "үнэмлэх", "тээвэр", "клуб", "ёс зүй"],
    "dormitory":              ["байр", "дотуур", "дорм", "байрны журам"],
    "health-services":        ["эрүүл мэнд", "эмч", "даатгал", "шимтгэл"],
    "scholarships":           ["тэтгэлэг", "зээл", "урамшуулал", "мицубиши", "оюу толгой"],
    "exchange-programs":      ["солилцоо", "iaeste", "гадаад", "япон", "бнсу"],
    "research":               ["эрдэм шинжилгээ", "номын сан", "олимпиад", "бүтээл"],
    "international-students": ["гадаад оюутан", "виз", "оршин суух", "цагаачлал"],
}


def _keyword_fallback(query: str, top_k: int) -> list[SearchResultItem]:
    q = query.lower()
    scored: list[tuple[str, int]] = []
    for slug, keywords in _KEYWORD_MAP.items():
        score = sum(1 for kw in keywords if kw in q)
        if score > 0:
            scored.append((slug, score))
    scored.sort(key=lambda x: x[1], reverse=True)

    return [
        SearchResultItem(
            section_id=slug,
            section_title=_SECTIONS.get(slug, slug),
            text=f'"{query}" гэсэн хайлтад холбоотой хэсэг.',
            score=float(score),
        )
        for slug, score in scored[:top_k]
    ]


# ─────────────────────────────────────────────────────────────────
# Local extractive summariser (no LLM)
# Replace with Claude / GPT-4o in production.
# ─────────────────────────────────────────────────────────────────

def _local_summarize(text: str) -> str:
    clean = re.sub(r"[#*`|>_~\[\]()]", "", text)
    clean = re.sub(r"\n{2,}", "\n", clean).strip()
    sentences = re.split(r"[.!?\n]+", clean)
    sentences = [s.strip() for s in sentences if len(s.strip()) > 40]

    if not sentences:
        return "Энэ хэсгийн агуулга хураангуйлахад хангалтгүй байна."

    summary = ". ".join(sentences[:5]) + "."
    prefix = (
        "📋 **Хураангуй:**\n\n"
        "*(Тэмдэглэл: Local алгоритмаар үүсгэгдсэн хураангуй. "
        "Бүрэн мэдээлэл авахыг хүсвэл must.edu.mn-аас шалгана уу.)*\n\n"
    )
    return prefix + summary
