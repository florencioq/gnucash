from __future__ import annotations

import os
from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient

# Must be set before importing app modules that build the engine.
os.environ.setdefault("DATABASE_URL_TEST", "sqlite:///./test.db")
os.environ["DATABASE_URL"] = os.environ["DATABASE_URL_TEST"]
# Tests run with public business routes to preserve baseline test expectations.
os.environ["AUTH_REQUIRED"] = "false"
os.environ["AUTH_JWT_SECRET"] = "test-jwt-secret-with-at-least-32-bytes"

from app.db import SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Base  # noqa: E402


@pytest.fixture(autouse=True)
def clean_db() -> Generator[None, None, None]:
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def client() -> Generator[TestClient, None, None]:
    with TestClient(app) as c:
        yield c


@pytest.fixture()
def db_session() -> Generator:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
