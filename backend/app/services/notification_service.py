"""알림 생성·조회 로직 (api.md §5.2).

발송 판단은 사용자 설정(UserSettings)을 본다:
- notifications.enabled 가 꺼지면 아무 알림도 만들지 않는다.
- 종류별 토글: nudge→nudge, todoAdded/todoDone→todo, *Incomplete→deadline
- 방해 금지 시간대면 만들지 않는다.

방해 금지와 밤 11시 점검은 **사용자 로컬 시각** 기준이다(UserSettings.timezone).
서버 UTC 로 판단하면 한국 사용자의 밤 11시가 아침 8시가 된다.
"""

from datetime import UTC, datetime
from datetime import date as date_type

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.timezones import day_bounds, local_now, zone_of
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


def should_notify(settings: UserSettings, ntype: str, now_utc: datetime | None = None) -> bool:
    """지금 이 사용자에게 이 알림을 보내도 되는지.

    now_utc 를 주면 방해 금지를 확인하고, 주지 않으면 건너뛴다(즉시 알림).
    대화 중 생기는 todoAdded/todoDone 은 사용자가 직접 만든 알림이라 막지 않는다.
    확인할 때는 **사용자 로컬 시각**으로 판단한다 — 서버 UTC 로 보면 엉뚱한 시간이 막힌다.
    """
    if settings is None or not settings.notif_enabled:
        return False
    toggle = _TYPE_TOGGLE.get(ntype)
    if toggle is not None and not getattr(settings, toggle):
        return False
    if now_utc is not None and settings.dnd_enabled:
        hour = local_now(zone_of(settings.timezone), now_utc).hour
        if _in_dnd(hour, settings.dnd_start_hour, settings.dnd_end_hour):
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
    now_utc: datetime | None = None,
) -> Notification | None:
    """설정을 확인해 알림을 만든다. 발송 조건 미충족이면 None.

    now_utc 를 주면 그 시각을 created_at 으로도 쓴다. 발송 판단에 쓴 시각과
    기록된 시각이 어긋나지 않아야 "오늘 이미 보냈나" 확인이 정확해진다.
    (사용자가 많아 점검 루프가 길어져도 시각이 미끄러지지 않는다.)
    """
    settings = await db.get(UserSettings, user_id)
    if not should_notify(settings, ntype, now_utc):
        return None
    notif = Notification(user_id=user_id, type=ntype, title=title, body=body, link_to=link_to)
    if now_utc is not None:
        notif.created_at = now_utc
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


async def _already_sent_today(
    db: AsyncSession, user_id: str, ntype: str, day: date_type, zone
) -> bool:
    """같은 날 같은 종류를 두 번 보내지 않는다.

    점검이 매시간 돌기 때문에(사용자마다 로컬 23시가 다르다) 이 확인이 필요하다.
    서버 재시작이나 서머타임으로 같은 시각이 두 번 지나가도 안전하다.
    """
    start, end = day_bounds(day, zone)
    row = await db.execute(
        select(Notification.id)
        .where(
            Notification.user_id == user_id,
            Notification.type == ntype,
            Notification.created_at.between(start, end),
        )
        .limit(1)
    )
    return row.first() is not None


async def run_nightly_check(
    db: AsyncSession, now_utc: datetime | None = None, target_hour: int = 23
) -> int:
    """밤 11시 점검: 미완료 투두 / 빈 플래너 알림 생성. 만든 알림 수를 반환.

    **사용자 로컬 시각 기준**이다. 매시간 호출되며, 지금 로컬로 target_hour 인
    사용자만 처리한다. 날짜도 그 사람 기준의 '오늘' 을 쓴다.

    활성 목표가 있는 사용자만 대상으로 한다(빈 계정 스팸 방지).
    발송 여부는 설정(deadline 토글·방해금지)을 따른다.
    """
    now_utc = now_utc or datetime.now(UTC)
    users = (await db.execute(select(User).where(User.deleted_at.is_(None)))).scalars().all()
    created = 0

    for u in users:
        settings = await db.get(UserSettings, u.id)
        zone = zone_of(settings.timezone if settings else None)
        local = local_now(zone, now_utc)
        if local.hour != target_hour:
            continue

        if not await _has_active_goal(db, u.id):
            continue

        on_date = local.date()

        if await _has_incomplete_todo(db, u.id, on_date) and not await _already_sent_today(
            db, u.id, "todoIncomplete", on_date, zone
        ):
            n = await create_notification(
                db,
                u.id,
                ntype="todoIncomplete",
                title="오늘의 할 일",
                body="아직 완료하지 않은 할 일이 있어요.",
                link_to=RECORD_LINK,
                now_utc=now_utc,
            )
            created += n is not None

        if not await _has_plan(db, u.id, on_date) and not await _already_sent_today(
            db, u.id, "plannerIncomplete", on_date, zone
        ):
            n = await create_notification(
                db,
                u.id,
                ntype="plannerIncomplete",
                title="오늘의 플래너",
                body="오늘 플래너가 비어 있어요.",
                link_to=RECORD_LINK,
                now_utc=now_utc,
            )
            created += n is not None

    await db.flush()
    return created
