from __future__ import annotations

from uuid import uuid4

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.errors import api_error
from app.models import User
from app.schemas import (
    AuthLoginRequest,
    AuthRefreshRequest,
    AuthRegisterRequest,
    AuthTokenOut,
    AuthUserOut,
)
from app.services.auth import (
    authenticate_refresh_token,
    get_current_user,
    hash_password,
    issue_auth_tokens,
    normalize_email,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/register", response_model=AuthUserOut, status_code=201)
def register_user(payload: AuthRegisterRequest, db: Session = Depends(get_db)) -> User:
    email = normalize_email(payload.email)
    if not email:
        raise api_error(400, "VALIDATION_ERROR", "email is required")

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
        is_superuser=False,
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


@router.get("/me", response_model=AuthUserOut)
def me(current_user: User = Depends(get_current_user)) -> User:
    return current_user
