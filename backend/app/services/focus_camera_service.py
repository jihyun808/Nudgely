"""카메라 집중 인증 (focus camera).

세션 중 기기가 "자리에 있나(focus) / 없나(absent)" 를 N초마다 판정해 상태 샘플만
보낸다. **영상·프레임은 서버로 오지 않는다**(프라이버시 — 결정사항).

흐름:
  POST /focus/sessions/camera        세션 시작(세션별 동의 필요) → id
  POST /focus/sessions/{id}/checks   상태 샘플 배치 업로드 → 점수·이탈 갱신
  POST /focus/sessions/{id}/finish   종료 → 집중 점수·인증 확정 + 플래너 '인증' 기록

이탈(자리 비움) 5분 이상 지속되면 그 채팅방으로 선톡("자리 비웠네?") 한 번.
집중 점수 = 자리 비움(연속 absent)을 뺀 샘플 비율(%). 기준 이상이면 verified=True.
"""

from datetime import UTC, datetime
from itertools import groupby

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.core.timezones import as_utc, zone_of
from app.models.focus import (
    FOCUS_CHECK_STATUSES,
    FocusCheckSample,
    FocusSession,
)
from app.models.goal import Goal
from app.models.notification import Notification
from app.models.user import UserSettings
from app.schemas.focus import CameraSessionOut, FocusCheckIn
from app.services.notification_service import send_nudge
from app.services.planner_service import add_block

#: 자리 비움이 이만큼 이어지면 '이탈' 로 본다(결정: 5분).
CAMERA_AWAY_SECONDS = 300
#: 집중 점수가 이 이상이면 인증 성립.
VERIFY_MIN_SCORE = 70
#: 이만큼 연속으로 안 보여야 자리를 비운 것으로 본다.
MIN_ABSENT_RUN = 3


async def _owned_camera_session(db: AsyncSession, user_id: str, session_id: str) -> FocusSession:
    session = await db.get(FocusSession, session_id)
    if session is None or session.user_id != user_id or session.source != "camera":
        raise AppError("FOCUS_SESSION_NOT_FOUND", "집중 세션을 찾을 수 없습니다.", status_code=404)
    return session


def _away_runs(ordered: list[FocusCheckSample]) -> list[list[FocusCheckSample]]:
    """연속 MIN_ABSENT_RUN 개 이상 absent 인 구간들."""
    runs = []
    for status, group in groupby(ordered, key=lambda s: s.status):
        run = list(group)
        if status == "absent" and len(run) >= MIN_ABSENT_RUN:
            runs.append(run)
    return runs


def _score_and_away(samples: list[FocusCheckSample]) -> tuple[int, int, datetime | None]:
    """집중 점수(%), 이탈(5분+ 자리비움) 횟수, 진행 중 이탈의 시작 시각.

    고개를 숙이거나 물을 마셔도 absent 가 찍힌다. 그걸 그대로 깎으면 성실히 앉아
    있어도 점수가 안 나오므로, 연속 MIN_ABSENT_RUN 개부터 자리 비움으로 센다.
    """
    if not samples:
        return 0, 0, None
    ordered = sorted(samples, key=lambda s: s.at)
    runs = _away_runs(ordered)

    away_samples = sum(len(run) for run in runs)
    score = round((len(ordered) - away_samples) / len(ordered) * 100)

    away_count = 0
    ongoing_start: datetime | None = None
    for run in runs:
        run_start = as_utc(run[0].at)
        if (as_utc(run[-1].at) - run_start).total_seconds() < CAMERA_AWAY_SECONDS:
            continue
        away_count += 1
        if run[-1] is ordered[-1]:
            ongoing_start = run_start
    return score, away_count, ongoing_start


async def start_camera_session(
    db: AsyncSession,
    user_id: str,
    *,
    started_at: datetime,
    goal_id: str | None,
    consented: bool,
) -> FocusSession:
    if not consented:
        raise AppError("CAMERA_NOT_CONSENTED", "카메라 사용 동의가 필요합니다.", status_code=403)
    settings = await db.get(UserSettings, user_id)
    if settings is not None and not settings.camera_verify_enabled:
        raise AppError("CAMERA_DISABLED", "설정에서 카메라 집중 인증을 켜주세요.", status_code=403)
    if goal_id is not None:
        goal = await db.get(Goal, goal_id)
        if goal is None or goal.user_id != user_id:
            raise AppError("GOAL_NOT_FOUND", "목표를 찾을 수 없습니다.", status_code=404)

    session = FocusSession(
        user_id=user_id,
        goal_id=goal_id,
        mode="camera",
        source="camera",
        seconds=0,
        started_at=started_at,
        verified=False,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session


async def _maybe_nudge_away(
    db: AsyncSession, session: FocusSession, ongoing_start: datetime | None, now_utc: datetime
) -> None:
    """진행 중 이탈이 5분을 넘겼고 아직 안 알렸으면 선톡 한 번."""
    if ongoing_start is None or session.goal_id is None:
        return
    ref = f"focus_away:{session.id}:{ongoing_start.isoformat()}"
    already = (
        await db.execute(select(Notification.id).where(Notification.ref == ref).limit(1))
    ).scalar_one_or_none()
    if already is not None:
        return
    goal = await db.get(Goal, session.goal_id)
    if goal is None:
        return
    content = f"'{goal.title or goal.name}' 집중 중에 자리를 비운 지 좀 됐어. 다시 돌아와볼까?"
    await send_nudge(db, goal, content, ref=ref, now_utc=now_utc)


async def add_camera_checks(
    db: AsyncSession,
    user_id: str,
    session_id: str,
    samples: list[FocusCheckIn],
    *,
    now_utc: datetime | None = None,
) -> CameraSessionOut:
    now_utc = now_utc or datetime.now(UTC)
    session = await _owned_camera_session(db, user_id, session_id)

    for s in samples:
        if s.status not in FOCUS_CHECK_STATUSES:
            raise AppError(
                "INVALID_CHECK_STATUS", "샘플 상태가 올바르지 않습니다.", status_code=422
            )
        db.add(
            FocusCheckSample(
                session_id=session.id, status=s.status, at=s.at, confidence=s.confidence
            )
        )
    await db.flush()

    rows = (
        (
            await db.execute(
                select(FocusCheckSample).where(FocusCheckSample.session_id == session.id)
            )
        )
        .scalars()
        .all()
    )
    score, away_count, ongoing = _score_and_away(rows)
    session.focus_score = score
    await _maybe_nudge_away(db, session, ongoing, now_utc)
    await db.commit()

    return CameraSessionOut(
        id=session.id, focus_score=score, verified=session.verified, away_count=away_count
    )


async def finish_camera_session(
    db: AsyncSession, user_id: str, session_id: str, *, seconds: int
) -> CameraSessionOut:
    session = await _owned_camera_session(db, user_id, session_id)
    session.seconds = seconds

    rows = (
        (
            await db.execute(
                select(FocusCheckSample).where(FocusCheckSample.session_id == session.id)
            )
        )
        .scalars()
        .all()
    )
    score, away_count, _ = _score_and_away(rows)
    session.focus_score = score
    session.verified = score >= VERIFY_MIN_SCORE

    # 인증된 집중은 플래너 '실제' 열에 verify 기록으로 남긴다(마이페이지 '인증 완료' 집계).
    if session.verified and seconds >= 60:
        settings = await db.get(UserSettings, user_id)
        zone = zone_of(settings.timezone if settings else None)
        local = as_utc(session.started_at).astimezone(zone)
        title = "집중 인증"
        if session.goal_id:
            goal = await db.get(Goal, session.goal_id)
            if goal is not None:
                title = goal.title or goal.name
        await add_block(
            db,
            user_id,
            local.date(),
            title=title,
            start_minutes=local.hour * 60 + local.minute,
            duration_minutes=seconds // 60,
            kind="verify",
            goal_id=session.goal_id,
        )

    await db.commit()
    return CameraSessionOut(
        id=session.id, focus_score=score, verified=session.verified, away_count=away_count
    )


async def interrupt_camera_session(
    db: AsyncSession,
    user_id: str,
    session_id: str,
    *,
    seconds: int,
    now_utc: datetime | None = None,
) -> CameraSessionOut:
    """앱이 백그라운드로 가서 판정이 끊겼다. 거기까지로 끝내고 알린다.

    화면이 내려가면 카메라도 추론도 멈춘다. 그대로 두면 사용자는 계속 인증되는
    줄 알고 공부하다가, 돌아와서 점수가 안 오른 걸 보게 된다. 그 자리에서 알린다.
    """
    now_utc = now_utc or datetime.now(UTC)
    session = await _owned_camera_session(db, user_id, session_id)
    result = await finish_camera_session(db, user_id, session_id, seconds=seconds)

    if session.goal_id is not None:
        goal = await db.get(Goal, session.goal_id)
        if goal is not None:
            await send_nudge(
                db,
                goal,
                "앱이 내려가서 집중 인증이 멈췄어. 돌아와서 다시 시작할까?",
                ref=f"focus_interrupt:{session.id}",
                now_utc=now_utc,
            )
            await db.commit()
    return result


async def verified_summary(db: AsyncSession, user_id: str) -> tuple[int, int]:
    """카메라로 인증된 집중 세션의 (횟수, 총 집중 초). 마이페이지 '인증 완료'."""
    row = (
        await db.execute(
            select(
                func.count(),
                func.coalesce(func.sum(FocusSession.seconds), 0),
            ).where(
                FocusSession.user_id == user_id,
                FocusSession.source == "camera",
                FocusSession.verified.is_(True),
            )
        )
    ).one()
    return int(row[0]), int(row[1])
