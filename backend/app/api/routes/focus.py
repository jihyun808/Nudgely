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
from app.schemas.focus import (
    CameraSessionOut,
    DailyFocusOut,
    FinishCameraSessionIn,
    FocusSessionIn,
    FocusSummaryOut,
    StartCameraSessionIn,
    SubmitChecksIn,
    VerifiedFocusOut,
    WeeklyFocusOut,
)
from app.services import focus_camera_service, focus_service

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


# ── 카메라 집중 인증 ──


@router.post(
    "/sessions/camera", response_model=CameraSessionOut, status_code=status.HTTP_201_CREATED
)
async def start_camera_session(
    body: StartCameraSessionIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CameraSessionOut:
    session = await focus_camera_service.start_camera_session(
        db,
        user.id,
        started_at=body.started_at,
        goal_id=body.goal_id,
        consented=body.consented,
    )
    return CameraSessionOut(id=session.id, focus_score=0, verified=False, away_count=0)


@router.post("/sessions/{session_id}/checks", response_model=CameraSessionOut)
async def submit_camera_checks(
    session_id: str,
    body: SubmitChecksIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CameraSessionOut:
    return await focus_camera_service.add_camera_checks(db, user.id, session_id, body.samples)


@router.post("/sessions/{session_id}/finish", response_model=CameraSessionOut)
async def finish_camera_session(
    session_id: str,
    body: FinishCameraSessionIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CameraSessionOut:
    return await focus_camera_service.finish_camera_session(
        db, user.id, session_id, seconds=body.seconds
    )


@router.post("/sessions/{session_id}/interrupt", response_model=CameraSessionOut)
async def interrupt_camera_session(
    session_id: str,
    body: FinishCameraSessionIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CameraSessionOut:
    """앱이 백그라운드로 내려가 판정이 끊겼을 때. 거기까지로 끝내고 알린다."""
    return await focus_camera_service.interrupt_camera_session(
        db, user.id, session_id, seconds=body.seconds
    )


@router.get("/verified", response_model=VerifiedFocusOut)
async def get_verified(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> VerifiedFocusOut:
    count, total_seconds = await focus_camera_service.verified_summary(db, user.id)
    return VerifiedFocusOut(count=count, total_seconds=total_seconds)
