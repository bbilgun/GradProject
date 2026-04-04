"""
state.py — Module-level singletons shared across routers.
main.py sets these at startup; routers import them here.
"""
from __future__ import annotations
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from rag_service import RAGService

rag: "RAGService | None" = None
