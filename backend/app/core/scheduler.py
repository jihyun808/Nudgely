"""백그라운드 스케줄러 (밤 11시 점검 · 계획 기반 선톡, api.md §5.2).

사용자마다 타임존이 다르므로 **깨어나서 "지금 그 사람 로컬로 몇 시인지"** 를 보고
처리한다. 서버 UTC 한 시각에만 돌리면 한국 사용자는 아침 8시에 알림을 받는다.

10분마다 깨어난다. 계획 기반 선톡(시작 +10분, 종료 +30분)이 플래너 블록 시각을
따라가야 하는데, 매시간 정각만 돌면 09:20 에 시작하는 계획은 아무 때도 안 걸린다.

같은 것에 두 번 보내지 않는 건 각 서비스가 확인한다
(밤 점검은 날짜별, 선톡은 Notification.ref 로 블록별).
푸시(FCM/APNs)는 Capacitor 전환 이후(api.md §5.2).
"""

import logging
from datetime import UTC, datetime

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.core.config import settings

logger = logging.getLogger(__name__)

_scheduler: AsyncIOScheduler | None = None


async def _tick() -> None:
    """10분마다 깨어나 밤 점검과 계획 기반 선톡을 돌린다.

    대상이 없으면 곧바로 빠져나오므로 빈 실행은 싸다.
    한쪽이 실패해도 다른 쪽은 돌게 따로 감싼다.
    """
    from app.ai.nudge_writer import generate_nudge
    from app.core.db import async_session
    from app.services.notification_service import run_nightly_check
    from app.services.nudge_service import default_writer, run_plan_nudges
    from app.services.routine_service import run_routine_todos

    now = datetime.now(UTC)
    async with async_session() as db:
        try:
            await run_nightly_check(db, now, target_hour=settings.nightly_hour)
            await db.commit()
        except Exception:  # noqa: BLE001 - 다음 틱에 다시 시도한다
            await db.rollback()
            logger.exception("밤 점검 실패")

        try:
            await run_routine_todos(db, now, target_hour=settings.routine_hour)
            await db.commit()
        except Exception:  # noqa: BLE001
            await db.rollback()
            logger.exception("반복 계획 투두 생성 실패")

        try:
            # 문구는 싼 모델이 쓴다. 키가 없는 개발 환경에서는 템플릿으로 돈다
            # (생성이 실패해도 nudge_service 가 템플릿으로 떨어뜨린다)
            writer = generate_nudge if settings.openai_api_key else default_writer
            await run_plan_nudges(db, now, writer=writer)
            await db.commit()
        except Exception:  # noqa: BLE001
            await db.rollback()
            logger.exception("계획 선톡 실패")


def start_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        return
    sched = AsyncIOScheduler(timezone="UTC")
    # 10분마다. 플래너 최소 단위가 10분이라 계획 시각을 놓치지 않는다.
    # (UTC 오프셋이 30·45분인 지역도 있어 시각 판단은 job 안에서 사용자별로 한다)
    sched.add_job(_tick, "cron", minute="*/10", id="tick")
    sched.start()
    _scheduler = sched


def shutdown_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
