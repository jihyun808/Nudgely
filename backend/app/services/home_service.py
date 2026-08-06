"""홈 미리보기 조립 (api.md §5.1).

안 읽은 메시지가 있는 목표마다 한 장씩 message 카드를 만든다.
공지(notice)·광고(ad)는 별도 소스가 생기면 합친다(현재 없음).
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.goal import Goal, Message, ReadState
from app.schemas.home import HomePreviewOut
from app.services.notification_service import chat_link


async def home_previews(db: AsyncSession, user_id: str) -> list[HomePreviewOut]:
    goals = (
        (
            await db.execute(
                select(Goal).where(
                    Goal.user_id == user_id,
                    Goal.is_hidden.is_(False),
                    Goal.completed_at.is_(None),
                )
            )
        )
        .scalars()
        .all()
    )

    previews: list[HomePreviewOut] = []
    for g in goals:
        latest = (
            await db.execute(
                select(Message)
                .where(Message.goal_id == g.id, Message.role == "assistant")
                .order_by(Message.created_at.desc(), Message.id.desc())
                .limit(1)
            )
        ).scalar_one_or_none()
        if latest is None:
            continue

        # 마지막으로 읽은 시각 이후면 '안 읽음'
        read = await db.get(ReadState, (user_id, g.id))
        boundary = None
        if read is not None and read.last_read_message_id is not None:
            last_read = await db.get(Message, read.last_read_message_id)
            boundary = last_read.created_at if last_read else None
        if boundary is not None and latest.created_at <= boundary:
            continue

        previews.append(
            HomePreviewOut(
                id=f"p_{g.id}",
                kind="message",
                title=g.name,
                content=latest.content,
                received_at=latest.created_at,
                link_to=chat_link(g.id),
            )
        )

    previews.sort(key=lambda p: p.received_at, reverse=True)
    return previews
