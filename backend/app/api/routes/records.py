"""기록(투두 · 플래너) 엔드포인트 (api.md §4).

    GET /api/todos?date=YYYY-MM-DD     날짜별 투두 (목표별 묶음)
    GET /api/todos/marks?month=YYYY-MM 캘린더 완료 표시
    GET /api/planners?date=YYYY-MM-DD  텐미닛 플래너 (계획/실제)

    POST   /api/todos/{todoId}/items              항목 추가(사용자)
    PATCH  /api/todos/{todoId}/items/{itemId}     항목 내용·태그 수정
    POST   /api/todos/{todoId}/items/{itemId}/done  완료 여부 토글
    DELETE /api/todos/{todoId}/items/{itemId}     항목 삭제

    POST   /api/planners/{date}/actual            실제 기록 추가
    PATCH  /api/planners/{date}/actual/{blockId}  실제 기록 수정
    DELETE /api/planners/{date}/actual/{blockId}  실제 기록 삭제

투두 '계획' 블록은 AI 가 세우므로 쓰기 경로가 없다. 실제 기록은 자동(집중 타이머)
으로도 쌓이지만 사용자가 고칠 수 있다 — 타이머를 켜 두고 딴짓한 날을 바로잡는 길.
"""

import re
from datetime import date

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.db import get_db
from app.core.errors import AppError
from app.models.user import User
from app.schemas.planner import DailyPlannerOut, PlannerBlockIn
from app.schemas.record import (
    DailyTodoOut,
    TodoItemDoneIn,
    TodoItemIn,
    TodoItemOut,
    TodoMarksOut,
)
from app.services.planner_service import add_actual, daily_planner, delete_actual, update_actual
from app.services.record_service import (
    add_user_item,
    daily_todos,
    delete_item,
    owned_todo,
    set_item_done,
    todo_marks,
    update_item,
)

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


@router.get("/planners", response_model=DailyPlannerOut)
async def get_planner(
    date: date = Query(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DailyPlannerOut:
    return await daily_planner(db, user.id, date)


# ── 투두 항목 (사용자 편집) ─────────────────────────────


@router.post("/todos/{todo_id}/items", response_model=TodoItemOut, status_code=201)
async def add_todo_item(
    todo_id: str,
    body: TodoItemIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TodoItemOut:
    todo = await owned_todo(db, user.id, todo_id)
    item = await add_user_item(db, todo, body.content, body.tag)
    await db.commit()
    return TodoItemOut(
        id=item.id, content=item.content, is_done=item.is_done, tag=item.tag, source="user"
    )


@router.patch("/todos/{todo_id}/items/{item_id}", response_model=TodoItemOut)
async def edit_todo_item(
    todo_id: str,
    item_id: str,
    body: TodoItemIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TodoItemOut:
    todo = await owned_todo(db, user.id, todo_id)
    item = await update_item(db, todo, item_id, body.content, body.tag)
    await db.commit()
    return TodoItemOut(
        id=item.id,
        content=item.content,
        is_done=item.is_done,
        tag=item.tag,
        source=item.source or "ai",
    )


@router.post("/todos/{todo_id}/items/{item_id}/done", status_code=status.HTTP_204_NO_CONTENT)
async def check_todo_item(
    todo_id: str,
    item_id: str,
    body: TodoItemDoneIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """완료 여부 토글. 진도(progressDelta)가 붙은 항목이면 목표 진도도 함께 움직인다."""
    todo = await owned_todo(db, user.id, todo_id)
    item = next((i for i in todo.items if i.id == item_id), None)
    if item is None:
        raise AppError("TODO_ITEM_NOT_FOUND", "할 일을 찾을 수 없습니다.", status_code=404)
    await set_item_done(db, item, body.is_done)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/todos/{todo_id}/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_todo_item(
    todo_id: str,
    item_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    todo = await owned_todo(db, user.id, todo_id)
    await delete_item(db, todo, item_id)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ── 플래너 실제 기록 (사용자 편집) ──────────────────────────
#
# 응답으로 그날 플래너 전체를 돌려준다. 블록 하나만 주면 화면이 목록을 다시
# 맞춰야 하는데, 요약(달성률)까지 같이 바뀌어서 어차피 전체가 필요하다.


@router.post("/planners/{on}/actual", response_model=DailyPlannerOut, status_code=201)
async def create_planner_actual(
    on: date,
    body: PlannerBlockIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DailyPlannerOut:
    await add_actual(
        db,
        user.id,
        on,
        title=body.title,
        start_minutes=body.start_minutes,
        duration_minutes=body.duration_minutes,
    )
    await db.commit()
    return await daily_planner(db, user.id, on)


@router.patch("/planners/{on}/actual/{block_id}", response_model=DailyPlannerOut)
async def edit_planner_actual(
    on: date,
    block_id: str,
    body: PlannerBlockIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DailyPlannerOut:
    await update_actual(
        db,
        user.id,
        on,
        block_id,
        title=body.title,
        start_minutes=body.start_minutes,
        duration_minutes=body.duration_minutes,
    )
    await db.commit()
    return await daily_planner(db, user.id, on)


@router.delete("/planners/{on}/actual/{block_id}", response_model=DailyPlannerOut)
async def remove_planner_actual(
    on: date,
    block_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DailyPlannerOut:
    await delete_actual(db, user.id, on, block_id)
    await db.commit()
    return await daily_planner(db, user.id, on)
