"""첨부 저장·조회 로직 (api.md §3.6)."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.storage import SavedFile
from app.models.attachment import Attachment
from app.schemas.archive import AttachmentOut


async def create_attachment(
    db: AsyncSession, goal_id: str, message_id: str | None, saved: SavedFile
) -> Attachment:
    att = Attachment(
        goal_id=goal_id,
        message_id=message_id,
        kind=saved.kind,
        name=saved.display_name,
        size_bytes=saved.size_bytes,
        url=saved.url,
        thumb_url=saved.thumb_url,
    )
    db.add(att)
    await db.flush()
    return att


async def list_attachments(db: AsyncSession, goal_id: str, kind: str) -> list[AttachmentOut]:
    rows = (
        (
            await db.execute(
                select(Attachment)
                .where(Attachment.goal_id == goal_id, Attachment.kind == kind)
                .order_by(Attachment.uploaded_at.desc(), Attachment.id.desc())
            )
        )
        .scalars()
        .all()
    )
    return [
        AttachmentOut(
            id=a.id,
            kind=a.kind,
            name=a.name,
            size_bytes=a.size_bytes,
            uploaded_at=a.uploaded_at,
            # 사진 목록은 썸네일 URL 을 쓴다(없으면 원본).
            url=(a.thumb_url or a.url) if a.kind == "image" else a.url,
        )
        for a in rows
    ]
