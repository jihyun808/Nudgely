"""데이터베이스 계층.

- SQLAlchemy 2.0 async 엔진/세션을 앱 전체에서 재사용한다.
- 라우터는 `Depends(get_db)` 로 세션을 주입받는다.
- 모든 ORM 모델은 `Base` 를 상속한다.

개발(SQLite)에서는 앱 시작 시 `init_models()` 로 테이블을 생성한다.
운영에서는 Alembic 마이그레이션으로 관리한다. (TODO: alembic 셋업)
"""

from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

engine = create_async_engine(settings.database_url, echo=settings.db_echo, future=True)

async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    """모든 ORM 모델의 공통 부모."""


async def get_db() -> AsyncIterator[AsyncSession]:
    """요청마다 세션을 하나 열고, 끝나면 닫는다."""
    async with async_session() as session:
        yield session


async def init_models() -> None:
    """등록된 모든 모델로 테이블을 생성(개발용).

    import 부작용으로 모델이 메타데이터에 등록되도록,
    여기서 models 패키지를 한 번 불러온다.
    """
    from app import models  # noqa: F401  (모델 등록용)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
