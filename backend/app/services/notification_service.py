"""알림 생성·조회 로직 (api.md §5.2).

발송 판단은 사용자 설정(UserSettings)을 본다:
- notifications.enabled 가 꺼지면 아무 알림도 만들지 않는다.
- 종류별 토글: nudge→nudge, todoAdded/todoDone→todo, *Incomplete→deadline
- 방해 금지 시간대(now_hour 가 주어질 때)면 만들지 않는다(스케줄러용).
"""

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification
from app.models.user import UserSettings
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
