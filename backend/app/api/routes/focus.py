"""집중 엔드포인트 (api.md §6).

GET  /api/focus/summary?date=YYYY-MM-DD     오늘 요약(집중시간·목표시간·streak)
POST /api/focus/sessions                     세션 저장 (204)
GET  /api/focus/weekly?weekStart=YYYY-MM-DD  주간 집중(월~일)
GET  /api/focus/daily?from=&to=              기간별 집중(히트맵)
"""

from datetime import date

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.db import get_db
from app.core.errors import AppError
from app.models.focus import FOCUS_MODES
from app.models.user import User
from app.schemas.focus import DailyFocusOut, FocusSessionIn, FocusSummaryOut, WeeklyFocusOut
from app.services import focus_service

router = APIRouter(prefix="/focus")


@router.get("/summary", response_model=FocusSummaryOut)
async def get_summary(
    date: date = Query(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> FocusSummaryOut:
    return await focus_service.summary(db, user.id, date)


@router.post("/sessions", status_code=status.HTTP_204_NO_CONTENT)
async def save_session(
    body: FocusSessionIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    if body.mode not in FOCUS_MODES:
        raise AppError("INVALID_FOCUS_MODE", "지원하지 않는 집중 모드입니다.", status_code=422)
    await focus_service.save_session(
        db,
        user.id,
        mode=body.mode,
        seconds=body.seconds,
        started_at=body.started_at,
        goal_id=body.goal_id,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/weekly", response_model=WeeklyFocusOut)
async def get_weekly(
    week_start: date = Query(..., alias="weekStart"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> WeeklyFocusOut:
    return await focus_service.weekly(db, user.id, week_start)


@router.get("/daily", response_model=DailyFocusOut)
async def get_daily(
    frm: date = Query(..., alias="from"),
    to: date = Query(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DailyFocusOut:
    if frm > to:
        raise AppError("INVALID_RANGE", "from 이 to 보다 늦습니다.", status_code=422)
    return await focus_service.daily(db, user.id, frm, to)
