"""데이터베이스 계층.

- SQLAlchemy 2.0 async 엔진/세션을 앱 전체에서 재사용한다.
- 라우터는 `Depends(get_db)` 로 세션을 주입받는다.
- 모든 ORM 모델은 `Base` 를 상속한다.

개발(SQLite)에서는 `AUTO_CREATE_TABLES=true` 로 두면 앱 시작 시 `init_models()` 가
테이블을 만든다. 운영에서는 이 값을 false 로 두고 Alembic 마이그레이션으로 관리한다.
(`alembic upgrade head` — 자세한 건 README 의 'DB 마이그레이션' 참고)
"""

from collections.abc import AsyncIterator
from datetime import UTC, datetime

from sqlalchemy import DateTime, TypeDecorator, event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings


class UtcDateTime(TypeDecorator):
    """항상 UTC 를 달고 오가는 DateTime.

    SQLite 는 타임존을 저장하지 못해서, 그냥 DateTime(timezone=True) 로 두면
    읽을 때 naive 값이 돌아온다. 그러면
      - 응답 JSON 에 오프셋이 빠져 프론트가 로컬 시각으로 잘못 읽고(9시간 밀림),
      - 서버에서 datetime.now(UTC) 와 비교하다 TypeError 가 난다.
    저장 직전 UTC 로 맞추고, 읽는 즉시 UTC 를 다시 붙여 그 두 가지를 막는다.
    (Postgres 는 원래 타임존을 들고 있어 이 변환이 무해하게 지나간다.)
    """

    impl = DateTime(timezone=True)
    cache_ok = True

    def process_bind_param(self, value: datetime | None, dialect) -> datetime | None:
        if value is None:
            return None
        # naive 로 들어온 값은 UTC 로 간주한다(서버는 UTC 로만 만든다)
        if value.tzinfo is None:
            return value.replace(tzinfo=UTC)
        return value.astimezone(UTC)

    def process_result_value(self, value: datetime | None, dialect) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is None:
            return value.replace(tzinfo=UTC)
        return value.astimezone(UTC)


# async_database_url: 호스팅이 준 postgresql:// 주소를 asyncpg 용으로 고쳐 쓴다
engine = create_async_engine(settings.async_database_url, echo=settings.db_echo, future=True)


def enable_sqlite_foreign_keys(target) -> None:
    """SQLite 연결마다 외래 키 제약을 켠다.

    SQLite 는 `PRAGMA foreign_keys` 가 **연결마다 기본 꺼짐**이다. 켜지 않으면
    ON DELETE CASCADE / SET NULL 이 선언만 되고 아무 일도 하지 않아,
    목표를 지워도 집중 세션의 goal_id 가 사라진 목표를 계속 가리킨다.
    (Postgres 는 항상 제약을 지키므로 SQLite 일 때만 건다.)

    엔진을 만드는 쪽(앱·테스트)이 각자 한 번 불러준다.
    """
    if target.dialect.name != "sqlite":
        return

    @event.listens_for(target.sync_engine, "connect")
    def _set_pragma(dbapi_connection, _record) -> None:  # pragma: no cover - 연결 훅
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


enable_sqlite_foreign_keys(engine)


async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    """모든 ORM 모델의 공통 부모."""


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    """백그라운드 작업이 쓸 세션 팩토리.

    get_db 가 주는 세션은 응답이 끝나면 닫힌다. 응답 뒤에도 계속 도는 작업은
    자기 세션을 따로 열어야 해서 팩토리 자체를 주입한다.
    (의존성으로 둔 건 테스트가 테스트 DB 로 갈아끼우기 위해서다)
    """
    return async_session


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
