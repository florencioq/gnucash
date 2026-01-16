import asyncio
import pytest
from typing import AsyncIterator
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.main import app
from app.db import get_session
from app.models import Base


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session")
async def async_engine():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", future=True)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    try:
        yield engine
    finally:
        await engine.dispose()


@pytest.fixture()
async def session(async_engine) -> AsyncIterator[AsyncSession]:
    SessionLocal = async_sessionmaker(async_engine, expire_on_commit=False, class_=AsyncSession)

    async def _get_session_override() -> AsyncIterator[AsyncSession]:
        async with SessionLocal() as s:
            yield s

    app.dependency_overrides[get_session] = _get_session_override
    async with SessionLocal() as s:
        yield s
    app.dependency_overrides.clear()


@pytest.fixture()
async def client(session) -> AsyncIterator[AsyncClient]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac