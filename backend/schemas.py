"""
schemas.py — Pydantic request/response models for auth & users.
"""
from __future__ import annotations

import re
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, field_validator

from models import UserRole

STUDENT_ID_RE = re.compile(r"^B\d{9}$")


# ── Token ─────────────────────────────────────────────────────────

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    student_id: Optional[str] = None


# ── User ──────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    student_id: str = Field(..., examples=["B221910027"])
    email: EmailStr
    password: str = Field(..., min_length=8)
    full_name: Optional[str] = None
    major: Optional[str] = None
    gpa: Optional[float] = Field(None, ge=0.0, le=4.0)
    total_credits: Optional[int] = Field(None, ge=0)
    role: UserRole = UserRole.student

    @field_validator("student_id")
    @classmethod
    def validate_student_id(cls, v: str) -> str:
        if not STUDENT_ID_RE.match(v):
            raise ValueError(
                "student_id must be 'B' followed by exactly 9 digits (e.g. 'B221910027')"
            )
        return v


class UserResponse(BaseModel):
    id: int
    student_id: str
    email: str
    full_name: Optional[str]
    major: Optional[str]
    gpa: Optional[float]
    total_credits: Optional[int]
    role: UserRole

    # Parsed student_id fields
    admission_year: str
    class_code: str
    index: str

    model_config = {"from_attributes": True}


class LoginRequest(BaseModel):
    student_id: str = Field(..., examples=["B221910027"])
    password: str


# ── News ──────────────────────────────────────────────────────────

class NewsSectionCreate(BaseModel):
    subtitle: Optional[str] = None
    body: str = Field(..., min_length=1)
    image_url: Optional[str] = None
    order: int = 0


class NewsSectionResponse(BaseModel):
    id: int
    subtitle: Optional[str]
    body: str
    image_url: Optional[str]
    order: int

    model_config = {"from_attributes": True}


class NewsCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    cover_image_url: Optional[str] = None
    sections: list[NewsSectionCreate] = Field(default_factory=list)
    # legacy single-body fallback (used when sections is empty)
    content: Optional[str] = None


class NewsResponse(BaseModel):
    id: int
    title: str
    cover_image_url: Optional[str]
    content: Optional[str]          # legacy
    sections: list[NewsSectionResponse] = []
    author_id: int
    author_name: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}
