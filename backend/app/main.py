"""FastAPI 앱 진입점.

실행:  uvicorn app.main:app --reload
문서:  http://localhost:8000/docs
"""

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.router import api_router
from app.core.config import settings
from app.core.db import init_models
from app.core.errors import register_error_handlers
from app.core.scheduler import shutdown_scheduler, start_scheduler


@asynccontextmanager
async def lifespan(_: FastAPI):
    # 개발 편의: 앱 시작 시 테이블 생성(SQLite).
    # 운영에서는 auto_create_tables=False 로 두고 `alembic upgrade head` 를 쓴다.
    if settings.auto_create_tables:
        await init_models()
    if settings.scheduler_enabled:
        start_scheduler()  # 밤 11시 점검 스케줄러
    yield
    shutdown_scheduler()


app = FastAPI(
    title="Nudgely API",
    description="스터디 페르소나 — 백엔드 + AI 서버",
    version="0.1.0",
    lifespan=lifespan,
)

# 공통 에러 응답 포맷 {code, message} 핸들러 등록
register_error_handlers(app)

# 프론트엔드(Vite)에서 호출할 수 있도록 CORS 허용
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# /api 하위로 모든 라우터 연결
app.include_router(api_router, prefix="/api")

# 업로드 파일 서빙(/static). 운영에서는 S3+CDN 등으로 대체.
# StaticFiles 는 경로 이탈을 막고, 저장 시 파일명을 서버가 생성하므로 실행 위험이 없다.
_media = Path(settings.storage_dir)
_media.mkdir(parents=True, exist_ok=True)
app.mount("/static", StaticFiles(directory=str(_media)), name="static")


@app.get("/")
def root() -> dict[str, str]:
    return {"service": "nudgely-backend", "status": "ok", "docs": "/docs"}
