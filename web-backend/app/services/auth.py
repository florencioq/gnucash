from __future__ import annotations

import base64
from contextvars import ContextVar
import hashlib
import hmac
import secrets
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import ExpiredSignatureError, InvalidTokenError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.errors import api_error
from app.models import User

JWT_ALGORITHM = "HS256"
TOKEN_TYPE_ACCESS = "access"
TOKEN_TYPE_REFRESH = "refresh"

_bearer_scheme = HTTPBearer(auto_error=False)
_request_user_var: ContextVar[User | None] = ContextVar("request_user", default=None)


def normalize_email(email: str) -> str:
    return email.strip().lower()


def _b64encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def _b64decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(f"{data}{padding}")


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    iterations = settings.auth_password_iterations
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
    return f"pbkdf2_sha256${iterations}${_b64encode(salt)}${_b64encode(digest)}"


def verify_password(password: str, password_hash: str) -> bool:
    try:
        algo, iterations_raw, salt_raw, digest_raw = password_hash.split("$", 3)
        if algo != "pbkdf2_sha256":
            return False
        iterations = int(iterations_raw)
        salt = _b64decode(salt_raw)
        expected_digest = _b64decode(digest_raw)
    except (TypeError, ValueError):
        return False

    computed_digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
    return hmac.compare_digest(computed_digest, expected_digest)


def _encode_token(*, user: User, token_type: str, ttl_minutes: int) -> str:
    now = datetime.now(UTC)
    expires_at = now + timedelta(minutes=ttl_minutes)
    payload = {
        "sub": user.id,
        "type": token_type,
        "email": user.email,
        "iat": int(now.timestamp()),
        "exp": int(expires_at.timestamp()),
    }
    return jwt.encode(payload, settings.auth_jwt_secret, algorithm=JWT_ALGORITHM)


def issue_auth_tokens(user: User) -> dict[str, Any]:
    access_ttl = settings.auth_access_token_ttl_minutes
    refresh_ttl = settings.auth_refresh_token_ttl_minutes
    return {
        "access_token": _encode_token(user=user, token_type=TOKEN_TYPE_ACCESS, ttl_minutes=access_ttl),
        "refresh_token": _encode_token(user=user, token_type=TOKEN_TYPE_REFRESH, ttl_minutes=refresh_ttl),
        "token_type": "bearer",
        "expires_in": access_ttl * 60,
    }


def _decode_token(token: str) -> dict[str, Any]:
    try:
        return jwt.decode(token, settings.auth_jwt_secret, algorithms=[JWT_ALGORITHM])
    except ExpiredSignatureError as exc:
        raise api_error(401, "TOKEN_EXPIRED", "token expired") from exc
    except InvalidTokenError as exc:
        raise api_error(401, "INVALID_TOKEN", "invalid token") from exc


def _resolve_user_from_token(*, token: str, expected_type: str, db: Session) -> User:
    payload = _decode_token(token)
    token_type = payload.get("type")
    if token_type != expected_type:
        raise api_error(401, "INVALID_TOKEN", "invalid token type")

    user_id = payload.get("sub")
    if not isinstance(user_id, str) or not user_id:
        raise api_error(401, "INVALID_TOKEN", "invalid token subject")

    user = db.execute(select(User).where(User.id == user_id)).scalar_one_or_none()
    if user is None or not user.is_active:
        raise api_error(401, "INVALID_TOKEN", "token is no longer valid")
    return user


def authenticate_access_token(token: str, db: Session) -> User:
    return _resolve_user_from_token(token=token, expected_type=TOKEN_TYPE_ACCESS, db=db)


def authenticate_refresh_token(token: str, db: Session) -> User:
    return _resolve_user_from_token(token=token, expected_type=TOKEN_TYPE_REFRESH, db=db)


def get_request_user() -> User | None:
    return _request_user_var.get()


def get_optional_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
    db: Session = Depends(get_db),
) -> User | None:
    if credentials is None or not credentials.credentials:
        return None
    return authenticate_access_token(credentials.credentials, db)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None or not credentials.credentials:
        raise api_error(401, "AUTH_REQUIRED", "authentication required")
    return authenticate_access_token(credentials.credentials, db)


def require_api_auth(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
    db: Session = Depends(get_db),
) -> User | None:
    user: User | None = None
    if credentials is None or not credentials.credentials:
        if settings.auth_required:
            raise api_error(401, "AUTH_REQUIRED", "authentication required")
    else:
        user = authenticate_access_token(credentials.credentials, db)

    _request_user_var.set(user)
    db.info["request_user"] = user
    return user
