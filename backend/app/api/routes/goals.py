"""목표(=채팅방) · 메시지 엔드포인트 (api.md §3).

    GET    /api/goals                    목록 (hidden/completed 필터)
    POST   /api/goals                    개설 (multipart)
    GET    /api/goals/{id}               단건 → GoalDetail
    PATCH  /api/goals/{id}               수정 → GoalDetail
    POST   /api/goals/{id}/complete      완료 처리 (204)
    DELETE /api/goals/{id}               삭제 (204)
    DELETE /api/goals/{id}/messages      대화만 삭제 (204)
    GET    /api/goals/{id}/messages      메시지 조회 (커서 페이지네이션)
    POST   /api/goals/{id}/read          읽음 처리 (204)

메시지 전송(SSE)·파일 첨부·모아보기(attachments)·진도(progress) 쓰기는 다음 슬라이스.
"""

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, File, Form, Query, Response, UploadFile, status
from sqlalchemy import delete, select, tuple_
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.db import get_db
from app.core.errors import AppError
from app.models.goal import Goal, Message, ReadState
from app.models.user import User
from app.schemas.goal import (
    NAME_MAX,
    PERSONAS,
    PROMPT_MAX,
    TITLE_MAX,
    GoalDetailOut,
    GoalOut,
    MessageOut,
    MessagePage,
    UpdateGoalIn,
)
from app.services.goal_service import build_goal_detail, build_goal_out, get_owned_goal

router = APIRouter()

# 메시지 페이지 크기 상한(프론트 권장 30, 서버가 상한을 둔다: api.md §3.3)
MESSAGE_LIMIT_MAX = 50
MESSAGE_LIMIT_DEFAULT = 30


def _validate_persona(persona: str | None) -> None:
    if persona is not None and persona not in PERSONAS:
        raise AppError("INVALID_PERSONA", "지원하지 않는 페르소나입니다.", status_code=422)


@router.get("/goals", response_model=list[GoalOut])
async def list_goals(
    hidden: bool = Query(default=False),
    completed: bool = Query(default=False),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[GoalOut]:
    stmt = select(Goal).where(Goal.user_id == user.id)
    if completed:
        # 완주한 목표(마이페이지). 숨긴 것도 포함한다.
        stmt = stmt.where(Goal.completed_at.is_not(None))
    elif hidden:
        stmt = stmt.where(Goal.is_hidden.is_(True))
    else:
        # 기본 목록: 숨긴 목표는 제외
        stmt = stmt.where(Goal.is_hidden.is_(False))

    stmt = stmt.order_by(Goal.created_at.desc())
    goals = (await db.execute(stmt)).scalars().all()
    return [await build_goal_out(db, g, user.id) for g in goals]


@router.post("/goals", response_model=GoalDetailOut, status_code=status.HTTP_201_CREATED)
async def create_goal(
    name: str = Form(..., min_length=1, max_length=NAME_MAX),
    title: str = Form(default="", max_length=TITLE_MAX),
    prompt: str = Form(default="", max_length=PROMPT_MAX),
    persona: str | None = Form(default=None),
    image: UploadFile | None = File(default=None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> GoalDetailOut:
    _validate_persona(persona)
    # TODO(파일 슬라이스): image 를 검증·재인코딩·저장하고 image_url 을 채운다.
    goal = Goal(
        user_id=user.id,
        name=name.strip(),
        title=title.strip() or None,
        prompt=prompt.strip() or None,
        persona=persona,
    )
    db.add(goal)
    await db.commit()
    await db.refresh(goal)
    return await build_goal_detail(db, goal, user.id)


@router.get("/goals/{goal_id}", response_model=GoalDetailOut)
async def get_goal(
    goal_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> GoalDetailOut:
    goal = await get_owned_goal(db, user.id, goal_id)
    return await build_goal_detail(db, goal, user.id)


@router.patch("/goals/{goal_id}", response_model=GoalDetailOut)
async def update_goal(
    goal_id: str,
    body: UpdateGoalIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> GoalDetailOut:
    goal = await get_owned_goal(db, user.id, goal_id)
    _validate_persona(body.persona)

    if body.name is not None:
        goal.name = body.name.strip()
    if body.title is not None:
        goal.title = body.title.strip() or None
    if body.prompt is not None:
        goal.prompt = body.prompt.strip() or None
    if body.persona is not None:
        goal.persona = body.persona
    if body.due_date is not None:
        goal.due_date = body.due_date
    if body.is_notification_muted is not None:
        goal.is_notification_muted = body.is_notification_muted
    if body.is_hidden is not None:
        goal.is_hidden = body.is_hidden

    await db.commit()
    await db.refresh(goal)
    return await build_goal_detail(db, goal, user.id)


@router.post("/goals/{goal_id}/complete", status_code=status.HTTP_204_NO_CONTENT)
async def complete_goal(
    goal_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    goal = await get_owned_goal(db, user.id, goal_id)
    if goal.completed_at is None:
        goal.completed_at = datetime.now(UTC)
        await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/goals/{goal_id}/messages", status_code=status.HTTP_204_NO_CONTENT)
async def clear_messages(
    goal_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    goal = await get_owned_goal(db, user.id, goal_id)
    await db.execute(delete(Message).where(Message.goal_id == goal.id))
    # 읽음 기준도 초기화
    read = await db.get(ReadState, (user.id, goal.id))
    if read is not None:
        read.last_read_message_id = None
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/goals/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_goal(
    goal_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    goal = await get_owned_goal(db, user.id, goal_id)
    # ⚠️ 딸린 데이터(투두·플래너) 처리 정책 미확정(api.md §8-7). 지금은 대화·읽음만 함께 지운다.
    await db.execute(delete(Message).where(Message.goal_id == goal.id))
    await db.execute(delete(ReadState).where(ReadState.goal_id == goal.id))
    await db.delete(goal)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/goals/{goal_id}/messages", response_model=MessagePage)
async def list_messages(
    goal_id: str,
    cursor: str | None = Query(default=None),
    limit: int = Query(default=MESSAGE_LIMIT_DEFAULT, ge=1),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MessagePage:
    goal = await get_owned_goal(db, user.id, goal_id)
    limit = min(limit, MESSAGE_LIMIT_MAX)

    stmt = (
        select(Message)
        .where(Message.goal_id == goal.id)
        .order_by(Message.created_at.desc(), Message.id.desc())
    )
    if cursor is not None:
        anchor = await db.get(Message, cursor)
        if anchor is None or anchor.goal_id != goal.id:
            raise AppError("INVALID_CURSOR", "잘못된 커서입니다.", status_code=400)
        # 커서보다 과거(자기 자신 제외)
        stmt = stmt.where(
            tuple_(Message.created_at, Message.id) < tuple_(anchor.created_at, anchor.id)
        )

    # 다음 페이지 존재 여부를 알려고 limit+1 개를 떠본다
    rows = (await db.execute(stmt.limit(limit + 1))).scalars().all()
    has_more = len(rows) > limit
    page = rows[:limit]

    messages = [
        MessageOut(id=m.id, role=m.role, content=m.content, created_at=m.created_at) for m in page
    ]
    next_cursor = page[-1].id if (has_more and page) else None
    return MessagePage(messages=messages, next_cursor=next_cursor)


@router.post("/goals/{goal_id}/read", status_code=status.HTTP_204_NO_CONTENT)
async def mark_read(
    goal_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    goal = await get_owned_goal(db, user.id, goal_id)
    latest = (
        await db.execute(
            select(Message.id)
            .where(Message.goal_id == goal.id)
            .order_by(Message.created_at.desc(), Message.id.desc())
            .limit(1)
        )
    ).scalar_one_or_none()

    read = await db.get(ReadState, (user.id, goal.id))
    if read is None:
        read = ReadState(user_id=user.id, goal_id=goal.id, last_read_message_id=latest)
        db.add(read)
    else:
        read.last_read_message_id = latest
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
