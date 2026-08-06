"""테스트 공통 픽스처.

각 테스트는 격리된 인메모리 SQLite 를 쓴다.
- 앱의 get_db 의존성을 테스트용 세션으로 교체한다.
- 실제 .env / OpenAI 키 없이도 인증·설정 흐름을 검증한다.
"""

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401  (모델을 메타데이터에 등록)
from app.core.db import Base, get_db
from app.main import app


@pytest_asyncio.fixture
async def client() -> AsyncClient:
    # StaticPool + 단일 연결이라 :memory: DB 가 테스트 동안 유지된다.
    engine = create_async_engine(
        "sqlite+aiosqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    test_session = async_sessionmaker(engine, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async def _override_get_db():
        async with test_session() as session:
            yield session

    app.dependency_overrides[get_db] = _override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()
    await engine.dispose()
