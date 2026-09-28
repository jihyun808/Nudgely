"""회원 탈퇴 처리 (이용약관 §14).

탈퇴하면 개인정보와 회원이 만든 콘텐츠를 **지체 없이 파기**한다.
「개인정보 보호법」 제21조가 목적이 끝난 개인정보를 바로 파기하도록 정하고 있다.

DB 행은 users 를 지우면 FK CASCADE 로 함께 사라진다(목표·대화·투두·시간표·
집중 기록·첨부·알림·기기 토큰·설정). SQLite 도 `PRAGMA foreign_keys=ON` 을
켜 두었으므로 동작한다 — core/db.py 참고.

다만 **디스크의 파일은 CASCADE 로 지워지지 않는다.** 그래서 행을 지우기 전에
파일 주소를 먼저 모아 두었다가 지운다.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.storage import delete_by_url
from app.models.attachment import Attachment
from app.models.goal import Goal
from app.models.user import User


async def _file_urls_of(db: AsyncSession, user: User) -> list[str]:
    """이 회원에게 딸린 업로드 파일 주소 전부."""
    urls: list[str] = []

    if user.image_url:
        urls.append(user.image_url)

    goal_ids = (await db.execute(select(Goal.id).where(Goal.user_id == user.id))).scalars().all()
    if goal_ids:
        images = (
            (
                await db.execute(
                    select(Goal.image_url).where(
                        Goal.user_id == user.id, Goal.image_url.is_not(None)
                    )
                )
            )
            .scalars()
            .all()
        )
        urls.extend(images)

        rows = (
            await db.execute(
                select(Attachment.url, Attachment.thumb_url).where(Attachment.goal_id.in_(goal_ids))
            )
        ).all()
        for url, thumb_url in rows:
            urls.append(url)
            if thumb_url:
                urls.append(thumb_url)

    return urls


async def withdraw(db: AsyncSession, user: User) -> int:
    """회원과 딸린 데이터를 모두 파기한다. 지운 파일 수를 돌려준다.

    파일을 먼저 지우고 행을 지운다. 순서를 뒤집으면 어떤 파일을 지워야 하는지
    알 방법이 사라져 디스크에 영영 남는다.
    """
    urls = await _file_urls_of(db, user)
    removed = sum(1 for url in urls if delete_by_url(url))

    # users 를 지우면 나머지는 FK CASCADE 로 따라 지워진다
    await db.delete(user)
    await db.commit()
    return removed
