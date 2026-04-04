"""
models.py — SQLAlchemy ORM models.
"""
from __future__ import annotations

import enum
import re

from sqlalchemy import Column, DateTime, Enum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship, validates
from sqlalchemy.sql import func

from database import Base

STUDENT_ID_RE = re.compile(r"^B\d{9}$")


class UserRole(str, enum.Enum):
    student = "student"
    admin = "admin"
    student_council = "student_council"


class User(Base):
    __tablename__ = "users"

    id: int = Column(Integer, primary_key=True, index=True)
    student_id: str = Column(String(10), unique=True, index=True, nullable=False)
    email: str = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password: str = Column(String(255), nullable=False)

    full_name: str = Column(String(255), nullable=True)
    major: str = Column(String(255), nullable=True)
    gpa: float = Column(Float, nullable=True)
    total_credits: int = Column(Integer, nullable=True)

    role: UserRole = Column(Enum(UserRole), default=UserRole.student, nullable=False)

    # ── Validators ───────────────────────────────────────────────

    @validates("student_id")
    def validate_student_id(self, key: str, value: str) -> str:
        if not STUDENT_ID_RE.match(value):
            raise ValueError(
                f"student_id must be 'B' followed by exactly 9 digits, got: {value!r}"
            )
        return value

    # ── Derived properties ────────────────────────────────────────

    @property
    def admission_year(self) -> str:
        """First 2 digits after 'B' — e.g. 'B221910027' → '22'."""
        return self.student_id[1:3]

    @property
    def class_code(self) -> str:
        """Next 5 digits — e.g. 'B221910027' → '19100'."""
        return self.student_id[3:8]

    @property
    def index(self) -> str:
        """Last 2 digits — e.g. 'B221910027' → '27'."""
        return self.student_id[8:10]

    def __repr__(self) -> str:  # pragma: no cover
        return f"<User id={self.id} student_id={self.student_id} role={self.role}>"


class News(Base):
    __tablename__ = "news"

    id: int = Column(Integer, primary_key=True, index=True)
    title: str = Column(String(500), nullable=False)
    content: str = Column(Text, nullable=True)          # legacy plain-text fallback
    cover_image_url: str = Column(String(1000), nullable=True)
    author_id: int = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    author = relationship("User", backref="news_posts")
    sections = relationship(
        "NewsSection",
        backref="news",
        cascade="all, delete-orphan",
        order_by="NewsSection.order",
    )


class NewsSection(Base):
    __tablename__ = "news_sections"

    id: int = Column(Integer, primary_key=True, index=True)
    news_id: int = Column(Integer, ForeignKey("news.id", ondelete="CASCADE"), nullable=False)
    subtitle: str = Column(String(500), nullable=True)
    body: str = Column(Text, nullable=False)
    image_url: str = Column(String(1000), nullable=True)
    order: int = Column(Integer, default=0, nullable=False)
