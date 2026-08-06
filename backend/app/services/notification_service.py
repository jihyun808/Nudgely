"""알림 생성·조회 로직 (api.md §5.2).

발송 판단은 사용자 설정(UserSettings)을 본다:
- notifications.enabled 가 꺼지면 아무 알림도 만들지 않는다.
- 종류별 토글: nudge→nudge, todoAdded/todoDone→todo, *Incomplete→deadline
- 방해 금지 시간대(now_hour 가 주어질 때)면 만들지 않는다(스케줄러용).
"""

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.goal import Goal, Message
from app.models.notification import Notification
from app.models.planner import Planner, PlannerBlock
from app.models.todo import Todo, TodoItem
from app.models.user import User, UserSettings
from app.schemas.notification import NotificationOut

# 최신순 최대 개수(api.md §5.2)
MAX_NOTIFICATIONS = 5

_TYPE_TOGGLE = {
    "nudge": "notif_nudge",
    "todoAdded": "notif_todo",
    "todoDone": "notif_todo",
    "todoIncomplete": "notif_deadline",
    "plannerIncomplete": "notif_deadline",
}


def chat_link(goal_id: str) -> str:
    return f"/chat/{goal_id}"


RECORD_LINK = "/record"


def _in_dnd(hour: int, start: int, end: int) -> bool:
    """방해 금지 시간대 판정. start>end 면 자정을 넘긴 것으로 본다."""
    if start == end:
        return False
    if start < end:
        return start <= hour < end
    return hour >= start or hour < end  # 자정 넘김


def should_notify(settings: UserSettings, ntype: str, now_hour: int | None = None) -> bool:
    if settings is None or not settings.notif_enabled:
        return False
    toggle = _TYPE_TOGGLE.get(ntype)
    if toggle is not None and not getattr(settings, toggle):
        return False
    if now_hour is not None and settings.dnd_enabled:
        if _in_dnd(now_hour, settings.dnd_start_hour, settings.dnd_end_hour):
            return False
    return True


async def create_notification(
    db: AsyncSession,
    user_id: str,
    *,
    ntype: str,
    title: str,
    body: str,
    link_to: str | None = None,
    now_hour: int | None = None,
) -> Notification | None:
    """설정을 확인해 알림을 만든다. 발송 조건 미충족이면 None."""
    settings = await db.get(UserSettings, user_id)
    if not should_notify(settings, ntype, now_hour):
        return None
    notif = Notification(user_id=user_id, type=ntype, title=title, body=body, link_to=link_to)
    db.add(notif)
    await db.flush()
    return notif


async def list_notifications(db: AsyncSession, user_id: str) -> list[NotificationOut]:
    rows = (
        (
            await db.execute(
                select(Notification)
                .where(Notification.user_id == user_id)
                .order_by(Notification.created_at.desc(), Notification.id.desc())
                .limit(MAX_NOTIFICATIONS)
            )
        )
        .scalars()
        .all()
    )
    return [
        NotificationOut(
            id=n.id,
            type=n.type,
            title=n.title,
            body=n.body,
            created_at=n.created_at,
            is_read=n.is_read,
            link_to=n.link_to,
        )
        for n in rows
    ]


async def mark_all_read(db: AsyncSession, user_id: str) -> None:
    await db.execute(
        update(Notification)
        .where(Notification.user_id == user_id, Notification.is_read.is_(False))
        .values(is_read=True)
    )
    await db.commit()


# ── 독촉(nudge) · 밤 11시 점검 (api.md §5.2) ───────────────────


async def send_nudge(db: AsyncSession, goal: Goal, content: str) -> Message | None:
    """AI 선톡(독촉): 채팅방에 assistant 메시지를 남기고 nudge 알림을 만든다.

    muted·완주 목표는 대상에서 제외하고, 알림 설정이 nudge 를 끄면 아예 보내지 않는다.
    """
    if goal.is_notification_muted or goal.completed_at is not None:
        return None
    settings = await db.get(UserSettings, goal.user_id)
    if not should_notify(settings, "nudge"):
        return None

    msg = Message(goal_id=goal.id, role="assistant", content=content)
    db.add(msg)
    await db.flush()
    await create_notification(
        db,
        goal.user_id,
        ntype="nudge",
        title=goal.name,
        body=content,
        link_to=chat_link(goal.id),
    )
    return msg


async def _has_active_goal(db: AsyncSession, user_id: str) -> bool:
    row = await db.execute(
        select(Goal.id)
        .where(
            Goal.user_id == user_id,
            Goal.is_hidden.is_(False),
            Goal.completed_at.is_(None),
        )
        .limit(1)
    )
    return row.first() is not None


async def _has_incomplete_todo(db: AsyncSession, user_id: str, on_date) -> bool:
    row = await db.execute(
        select(TodoItem.id)
        .join(Todo, TodoItem.todo_id == Todo.id)
        .join(Goal, Todo.goal_id == Goal.id)
        .where(
            Goal.user_id == user_id,
            Goal.is_hidden.is_(False),
            Goal.completed_at.is_(None),
            Goal.is_notification_muted.is_(False),
            Todo.date == on_date,
            TodoItem.is_done.is_(False),
        )
        .limit(1)
    )
    return row.first() is not None


async def _has_plan(db: AsyncSession, user_id: str, on_date) -> bool:
    row = await db.execute(
        select(PlannerBlock.id)
        .join(Planner, PlannerBlock.planner_id == Planner.id)
        .where(
            Planner.user_id == user_id,
            Planner.date == on_date,
            PlannerBlock.kind.is_(None),  # 계획 블록
        )
        .limit(1)
    )
    return row.first() is not None


async def run_nightly_check(db: AsyncSession, on_date, now_hour: int | None = None) -> int:
    """밤 11시 점검: 미완료 투두 / 빈 플래너 알림 생성. 만든 알림 수를 반환.

    활성 목표가 있는 사용자만 대상으로 한다(빈 계정 스팸 방지).
    발송 여부는 설정(deadline 토글·방해금지)을 따른다.
    """
    users = (await db.execute(select(User).where(User.deleted_at.is_(None)))).scalars().all()
    created = 0
    for u in users:
        if not await _has_active_goal(db, u.id):
            continue

        if await _has_incomplete_todo(db, u.id, on_date):
            n = await create_notification(
                db,
                u.id,
                ntype="todoIncomplete",
                title="오늘의 할 일",
                body="아직 완료하지 않은 할 일이 있어요.",
                link_to=RECORD_LINK,
                now_hour=now_hour,
            )
            created += n is not None

        if not await _has_plan(db, u.id, on_date):
            n = await create_notification(
                db,
                u.id,
                ntype="plannerIncomplete",
                title="오늘의 플래너",
                body="오늘 플래너가 비어 있어요.",
                link_to=RECORD_LINK,
                now_hour=now_hour,
            )
            created += n is not None

    await db.flush()
    return created
