"""백그라운드 스케줄러 (밤 11시 점검, api.md §5.2).

매일 정해진 시각에 미완료 투두 / 빈 플래너 알림을 만든다.
앱 시작(lifespan)에서 start_scheduler() 로 켜고 종료 시 끈다.

⚠️ 현재는 서버 UTC 기준 단일 시각에 실행한다. 사용자 로컬 타임존별 실행은 후속.
푸시(FCM/APNs)는 Capacitor 전환 이후(api.md §5.2).
"""

from datetime import UTC, datetime

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.core.config import settings

_scheduler: AsyncIOScheduler | None = None


async def _nightly_job() -> None:
    from app.core.db import async_session
    from app.services.notification_service import run_nightly_check

    now = datetime.now(UTC)
    async with async_session() as db:
        await run_nightly_check(db, now.date(), now.hour)
        await db.commit()


def start_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        return
    sched = AsyncIOScheduler(timezone="UTC")
    sched.add_job(_nightly_job, "cron", hour=settings.nightly_hour, minute=0, id="nightly")
    sched.start()
    _scheduler = sched


def shutdown_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
