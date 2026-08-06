"""FastAPI 앱 진입점.

실행:  uvicorn app.main:app --reload
문서:  http://localhost:8000/docs
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import settings
from app.core.db import init_models
from app.core.errors import register_error_handlers


@asynccontextmanager
async def lifespan(_: FastAPI):
    # 개발용: 앱 시작 시 테이블 생성(SQLite).
    # 운영에서는 Alembic 마이그레이션으로 대체한다.
    await init_models()
    yield


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


@app.get("/")
def root() -> dict[str, str]:
    return {"service": "nudgely-backend", "status": "ok", "docs": "/docs"}
