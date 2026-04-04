"""
news.py — News management routes.

  POST /admin/upload     — Upload an image, returns its URL
  POST /admin/news       — Post news with sections + images (council/admin only)
  GET  /news             — All news, newest-first (list view)
  GET  /news/{id}        — Single news with full sections (detail view)
"""
from __future__ import annotations

import os
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

import state
from auth import get_current_user
from database import get_db
from models import News, NewsSection, User, UserRole
from rag_service import Chunk
from schemas import NewsCreate, NewsResponse, NewsSectionResponse

router = APIRouter()

UPLOADS_DIR = os.path.join(os.path.dirname(__file__), "static", "uploads")
ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_BYTES = 8 * 1024 * 1024  # 8 MB

# ── Auth guard ────────────────────────────────────────────────────

def _require_council(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in (UserRole.admin, UserRole.student_council):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only student council or admins can post news.",
        )
    return current_user


# ── Serialiser ────────────────────────────────────────────────────

def _to_response(news: News) -> NewsResponse:
    return NewsResponse(
        id=news.id,
        title=news.title,
        cover_image_url=news.cover_image_url,
        content=news.content,
        sections=[
            NewsSectionResponse(
                id=s.id,
                subtitle=s.subtitle,
                body=s.body,
                image_url=s.image_url,
                order=s.order,
            )
            for s in sorted(news.sections, key=lambda s: s.order)
        ],
        author_id=news.author_id,
        author_name=news.author.full_name if news.author else None,
        created_at=news.created_at,
    )


# ── Image upload ──────────────────────────────────────────────────

@router.post("/admin/upload")
async def upload_image(
    file: UploadFile = File(...),
    _: User = Depends(_require_council),
):
    """Upload a JPEG/PNG/WebP image. Returns its public URL."""
    if file.content_type not in ALLOWED_MIME:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {file.content_type}")

    data = await file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="File too large (max 8 MB).")

    ext = file.filename.rsplit(".", 1)[-1].lower() if file.filename and "." in file.filename else "jpg"
    filename = f"{uuid.uuid4().hex}.{ext}"

    os.makedirs(UPLOADS_DIR, exist_ok=True)
    with open(os.path.join(UPLOADS_DIR, filename), "wb") as f:
        f.write(data)

    return {"url": f"/static/uploads/{filename}"}


# ── Create news ───────────────────────────────────────────────────

@router.post("/admin/news", response_model=NewsResponse, status_code=status.HTTP_201_CREATED)
def create_news(
    payload: NewsCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_council),
):
    news = News(
        title=payload.title,
        cover_image_url=payload.cover_image_url,
        content=payload.content or "",   # legacy NOT NULL column
        author_id=current_user.id,
    )
    db.add(news)
    db.flush()  # get news.id before adding sections

    for i, sec in enumerate(payload.sections):
        db.add(NewsSection(
            news_id=news.id,
            subtitle=sec.subtitle,
            body=sec.body,
            image_url=sec.image_url,
            order=sec.order if sec.order else i,
        ))

    db.commit()
    db.refresh(news)

    # Index into FAISS — concatenate all section bodies
    if state.rag and state.rag._ready:
        full_text = news.title + "\n\n"
        if news.sections:
            full_text += "\n\n".join(
                f"{s.subtitle}\n{s.body}" if s.subtitle else s.body
                for s in news.sections
            )
        elif news.content:
            full_text += news.content

        state.rag.add_chunks([Chunk(
            section_id=f"news-{news.id}",
            section_title=f"Мэдээ: {news.title}",
            text=full_text,
            chunk_index=0,
            category="news",
        )])
        print(f"[News] Indexed news id={news.id} ({len(news.sections)} sections)")

    return _to_response(news)


# ── Read news ─────────────────────────────────────────────────────

@router.get("/news", response_model=list[NewsResponse])
def get_news(db: Session = Depends(get_db)):
    items = db.query(News).order_by(News.created_at.desc()).all()
    return [_to_response(n) for n in items]


@router.get("/news/{news_id}", response_model=NewsResponse)
def get_news_detail(news_id: int, db: Session = Depends(get_db)):
    news = db.query(News).filter(News.id == news_id).first()
    if not news:
        raise HTTPException(status_code=404, detail="News not found.")
    return _to_response(news)
