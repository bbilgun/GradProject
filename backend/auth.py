"""
auth.py — JWT authentication, password hashing, and auth/user routes.

Routes
------
  POST /auth/register   — Create a new user account
  POST /auth/login      — Return a JWT access token
  GET  /users/me        — Return the authenticated user's profile
"""
from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from database import get_db
from models import User
from schemas import LoginRequest, Token, TokenData, UserCreate, UserResponse

# ── Config ────────────────────────────────────────────────────────

SECRET_KEY: str = os.getenv("SECRET_KEY", "change-me-in-production-use-openssl-rand-hex-32")
ALGORITHM: str = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))

# ── Security helpers ──────────────────────────────────────────────

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    payload = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta if expires_delta else timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    payload["exp"] = expire
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


# ── Dependency: get current user ──────────────────────────────────

async def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        student_id: str | None = payload.get("sub")
        if student_id is None:
            raise credentials_exc
        token_data = TokenData(student_id=student_id)
    except JWTError:
        raise credentials_exc

    user = db.query(User).filter(User.student_id == token_data.student_id).first()
    if user is None:
        raise credentials_exc
    return user


# ── Router ────────────────────────────────────────────────────────

router = APIRouter()


@router.post("/auth/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(payload: UserCreate, db: Session = Depends(get_db)):
    """Create a new student account."""
    if db.query(User).filter(User.student_id == payload.student_id).first():
        raise HTTPException(status_code=400, detail="student_id already registered")
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="email already registered")

    user = User(
        student_id=payload.student_id,
        email=payload.email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        major=payload.major,
        gpa=payload.gpa,
        total_credits=payload.total_credits,
        role=payload.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return _to_response(user)


@router.post("/auth/login", response_model=Token)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    """Authenticate and return a JWT access token."""
    user = db.query(User).filter(User.student_id == payload.student_id).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect student_id or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token({"sub": user.student_id})
    return Token(access_token=access_token)


# OAuth2PasswordRequestForm variant — lets Swagger UI's "Authorize" button work
@router.post("/auth/token", response_model=Token, include_in_schema=False)
def login_form(
    form: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    """Same as /auth/login but accepts form data (for OAuth2 clients / Swagger)."""
    user = db.query(User).filter(User.student_id == form.username).first()
    if not user or not verify_password(form.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect student_id or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token({"sub": user.student_id})
    return Token(access_token=access_token)


@router.get("/users/me", response_model=UserResponse)
def read_me(current_user: User = Depends(get_current_user)):
    """Return the authenticated student's profile."""
    return _to_response(current_user)


# ── Internal helper ───────────────────────────────────────────────

def _to_response(user: User) -> UserResponse:
    return UserResponse(
        id=user.id,
        student_id=user.student_id,
        email=user.email,
        full_name=user.full_name,
        major=user.major,
        gpa=user.gpa,
        total_credits=user.total_credits,
        role=user.role,
        admission_year=user.admission_year,
        class_code=user.class_code,
        index=user.index,
    )
