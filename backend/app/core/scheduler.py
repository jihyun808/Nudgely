"""백그라운드 스케줄러 (밤 11시 점검, api.md §5.2).

사용자마다 타임존이 다르므로 **매시간 정각에 깨어나 "지금 로컬로 밤 11시인 사용자"**
만 골라 처리한다. 서버 UTC 한 시각에만 돌리면 한국 사용자는 아침 8시에 알림을 받는다.

같은 날 같은 알림은 한 번만 만들어진다(notification_service 에서 확인).
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
        await run_nightly_check(db, now, target_hour=settings.nightly_hour)
        await db.commit()


def start_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        return
    sched = AsyncIOScheduler(timezone="UTC")
    # 매시간 정각. 어느 타임존이든 그 사람의 23시를 놓치지 않는다.
    # (UTC 오프셋이 30·45분인 지역도 있어 시각 판단은 job 안에서 사용자별로 한다)
    sched.add_job(_nightly_job, "cron", minute=0, id="nightly")
    sched.start()
    _scheduler = sched


def shutdown_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
