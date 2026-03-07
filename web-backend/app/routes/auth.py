from __future__ import annotations

from uuid import uuid4

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.errors import api_error
from app.models import Book, BookAccessRole, User, UserBookAccess
from app.schemas import (
    AuthChangePasswordRequest,
    AuthLoginRequest,
    AuthRefreshRequest,
    AuthRegisterRequest,
    AuthResetPasswordRequest,
    AuthTokenOut,
    AuthUserOut,
    UserBookAccessOut,
    UserBookAccessUpsertRequest,
)
from app.services.auth import (
    authenticate_refresh_token,
    get_current_user,
    get_optional_current_user,
    hash_password,
    issue_auth_tokens,
    normalize_email,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/register", response_model=AuthUserOut, status_code=201)
def register_user(
    payload: AuthRegisterRequest,
    request_user: User | None = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
) -> User:
    email = normalize_email(payload.email)
    if not email:
        raise api_error(400, "VALIDATION_ERROR", "email is required")

    total_users = int(db.execute(select(func.count()).select_from(User)).scalar_one())
    bootstrap_mode = total_users == 0
    if not bootstrap_mode:
        if request_user is None:
            raise api_error(401, "AUTH_REQUIRED", "authentication required")
        if not request_user.is_superuser:
            raise api_error(403, "FORBIDDEN", "superuser privileges required")

    existing = db.execute(select(User.id).where(User.email == email).limit(1)).scalar_one_or_none()
    if existing:
        raise api_error(409, "USER_EMAIL_EXISTS", "email already in use")

    full_name = payload.full_name.strip() if payload.full_name else None
    user = User(
        id=str(uuid4()),
        email=email,
        password_hash=hash_password(payload.password),
        full_name=full_name or None,
        is_active=True,
        is_superuser=True if bootstrap_mode else bool(payload.is_superuser),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=AuthTokenOut)
def login(payload: AuthLoginRequest, db: Session = Depends(get_db)) -> dict:
    email = normalize_email(payload.email)
    user = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
    if user is None or not verify_password(payload.password, user.password_hash):
        raise api_error(401, "INVALID_CREDENTIALS", "invalid email or password")
    if not user.is_active:
        raise api_error(403, "USER_INACTIVE", "user is inactive")
    return issue_auth_tokens(user)


@router.post("/refresh", response_model=AuthTokenOut)
def refresh_tokens(payload: AuthRefreshRequest, db: Session = Depends(get_db)) -> dict:
    user = authenticate_refresh_token(payload.refresh_token, db)
    return issue_auth_tokens(user)


@router.post("/change-password", status_code=204)
def change_password(
    payload: AuthChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    if not verify_password(payload.current_password, current_user.password_hash):
        raise api_error(401, "INVALID_CREDENTIALS", "invalid current password")
    if payload.current_password == payload.new_password:
        raise api_error(400, "PASSWORD_REUSE", "new password must differ from current password")
    current_user.password_hash = hash_password(payload.new_password)
    db.commit()


@router.get("/me", response_model=AuthUserOut)
def me(current_user: User = Depends(get_current_user)) -> User:
    return current_user


@router.get("/users", response_model=list[AuthUserOut])
def list_users(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[User]:
    if not current_user.is_superuser:
        raise api_error(403, "FORBIDDEN", "superuser privileges required")
    return db.execute(select(User).order_by(User.created_at.asc(), User.email.asc())).scalars().all()


@router.get("/users/{user_id}/books", response_model=list[UserBookAccessOut])
def list_user_book_access(
    user_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[UserBookAccess]:
    if not current_user.is_superuser:
        raise api_error(403, "FORBIDDEN", "superuser privileges required")
    if db.get(User, user_id) is None:
        raise api_error(404, "NOT_FOUND", "requested resource was not found")
    return db.execute(
        select(UserBookAccess).where(UserBookAccess.user_id == user_id).order_by(UserBookAccess.book_id.asc())
    ).scalars().all()


@router.post("/users/{user_id}/reset-password", status_code=204)
def reset_user_password(
    user_id: str,
    payload: AuthResetPasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    if not current_user.is_superuser:
        raise api_error(403, "FORBIDDEN", "superuser privileges required")
    target = db.get(User, user_id)
    if target is None:
        raise api_error(404, "NOT_FOUND", "requested resource was not found")
    target.password_hash = hash_password(payload.new_password)
    db.commit()


@router.put("/users/{user_id}/books/{book_id}", response_model=UserBookAccessOut)
def upsert_user_book_access(
    user_id: str,
    book_id: str,
    payload: UserBookAccessUpsertRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserBookAccess:
    if not current_user.is_superuser:
        raise api_error(403, "FORBIDDEN", "superuser privileges required")
    if db.get(User, user_id) is None:
        raise api_error(404, "NOT_FOUND", "requested resource was not found")
    if db.get(Book, book_id) is None:
        raise api_error(400, "INVALID_BOOK", "book_id must reference an existing book", {"book_id": book_id})

    access = db.get(UserBookAccess, {"user_id": user_id, "book_id": book_id})
    role = BookAccessRole(payload.role.value)
    if access is None:
        access = UserBookAccess(user_id=user_id, book_id=book_id, role=role)
        db.add(access)
    else:
        access.role = role
    db.commit()
    db.refresh(access)
    return access


@router.delete("/users/{user_id}/books/{book_id}", status_code=204)
def delete_user_book_access(
    user_id: str,
    book_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    if not current_user.is_superuser:
        raise api_error(403, "FORBIDDEN", "superuser privileges required")
    access = db.get(UserBookAccess, {"user_id": user_id, "book_id": book_id})
    if access is None:
        raise api_error(404, "NOT_FOUND", "requested resource was not found")
    db.delete(access)
    db.commit()
