"""테스트 공통 픽스처.

각 테스트는 격리된 인메모리 SQLite 를 쓴다.
- engine: StaticPool 단일 연결이라 :memory: DB 가 테스트 동안 유지된다.
- client: 앱의 get_db 를 테스트 세션으로 교체한 httpx 클라이언트.
- session: 같은 DB 를 직접 조작할 때(메시지 사전 삽입 등) 쓰는 세션.
"""

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401  (모델을 메타데이터에 등록)
from app.core.db import Base, get_db
from app.main import app


@pytest_asyncio.fixture
async def engine():
    eng = create_async_engine(
        "sqlite+aiosqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield eng
    await eng.dispose()


@pytest_asyncio.fixture
async def session_factory(engine):
    return async_sessionmaker(engine, expire_on_commit=False)


@pytest_asyncio.fixture
async def client(session_factory) -> AsyncClient:
    async def _override_get_db():
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = _override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def session(session_factory):
    """DB 를 직접 조작할 때 쓰는 세션(픽스처 종료 시 닫힌다)."""
    async with session_factory() as s:
        yield s
