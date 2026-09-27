"""Alembic 마이그레이션 환경.

DB URL 과 모델 메타데이터를 app 설정에서 가져온다.
async 엔진(aiosqlite/asyncpg)을 지원하고, SQLite ALTER 를 위해 batch 모드를 켠다.
"""

import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy.ext.asyncio import create_async_engine

# 모든 모델을 등록해 autogenerate 가 인식하도록 한다.
import app.models  # noqa: F401
from app.core.config import settings
from app.core.db import Base

config = context.config
# alembic 은 ini 값에 %(...)s 치환을 돌린다. 비밀번호에 % 가 들어 있으면
# 그걸 치환 기호로 읽고 죽는다(호스팅이 만들어주는 비밀번호에 흔하다)
config.set_main_option("sqlalchemy.url", settings.async_database_url.replace("%", "%%"))

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    context.configure(
        url=settings.async_database_url,
        target_metadata=target_metadata,
        literal_binds=True,
        render_as_batch=True,
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def _do_run_migrations(connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        render_as_batch=True,  # SQLite ALTER 지원
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    engine = create_async_engine(settings.async_database_url, future=True)
    async with engine.connect() as connection:
        await connection.run_sync(_do_run_migrations)
    await engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
