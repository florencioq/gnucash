from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.errors import api_error
from app.models import BookAccessRole, UserBookAccess
from app.services.auth import get_request_user


def _current_user_or_none(db: Session | None = None):
    if db is not None:
        user = db.info.get("request_user")
        if user is not None:
            return user
    return get_request_user()


def require_superuser(db: Session | None = None, *, strict: bool = False) -> None:
    user = _current_user_or_none(db)
    if user is None:
        if strict:
            raise api_error(401, "AUTH_REQUIRED", "authentication required")
        return
    if not user.is_superuser:
        raise api_error(403, "FORBIDDEN", "superuser privileges required")


def _user_book_role(db: Session, *, user_id: str, book_id: str) -> BookAccessRole | None:
    role = db.execute(
        select(UserBookAccess.role).where(
            UserBookAccess.user_id == user_id,
            UserBookAccess.book_id == book_id,
        )
    ).scalar_one_or_none()
    return role


def ensure_book_read_access(db: Session, *, book_id: str) -> None:
    user = _current_user_or_none(db)
    if user is None or user.is_superuser:
        return

    role = _user_book_role(db, user_id=user.id, book_id=book_id)
    if role is None:
        raise api_error(403, "FORBIDDEN_BOOK", "user has no access to this book", {"book_id": book_id})


def ensure_book_write_access(db: Session, *, book_id: str) -> None:
    user = _current_user_or_none(db)
    if user is None or user.is_superuser:
        return

    role = _user_book_role(db, user_id=user.id, book_id=book_id)
    if role not in {BookAccessRole.EDITOR}:
        raise api_error(
            403,
            "FORBIDDEN_BOOK",
            "user has no write access to this book",
            {"book_id": book_id, "required_role": BookAccessRole.EDITOR.value},
        )


def accessible_book_ids(db: Session) -> set[str] | None:
    user = _current_user_or_none(db)
    if user is None or user.is_superuser:
        return None
    rows = db.execute(
        select(UserBookAccess.book_id).where(UserBookAccess.user_id == user.id)
    ).scalars().all()
    return set(rows)
