"""기록(투두) 엔드포인트 (api.md §4).

    GET /api/todos?date=YYYY-MM-DD    날짜별 투두 (목표별 묶음)
    GET /api/todos/marks?month=YYYY-MM 캘린더 완료 표시

플래너(GET /planners)·진도(GET /goals/{id}/progress)는 다음 슬라이스.
투두 생성·체크는 AI 툴 슬라이스에서 붙인다(현재 화면은 읽기 전용).
"""

import re
from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.db import get_db
from app.core.errors import AppError
from app.models.user import User
from app.schemas.record import DailyTodoOut, TodoMarksOut
from app.services.record_service import daily_todos, todo_marks

router = APIRouter()

_MONTH_RE = re.compile(r"^\d{4}-\d{2}$")


@router.get("/todos", response_model=list[DailyTodoOut])
async def get_todos(
    date: date = Query(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[DailyTodoOut]:
    return await daily_todos(db, user.id, date)


@router.get("/todos/marks", response_model=TodoMarksOut)
async def get_todo_marks(
    month: str = Query(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TodoMarksOut:
    if not _MONTH_RE.match(month):
        raise AppError("INVALID_MONTH", "month 는 'YYYY-MM' 형식이어야 합니다.", status_code=422)
    return TodoMarksOut(marks=await todo_marks(db, user.id, month))
