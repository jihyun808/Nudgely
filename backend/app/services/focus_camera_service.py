"""카메라 집중 인증 (focus camera).

세션 중 기기가 "자리에 있나(focus) / 없나(absent)" 를 N초마다 판정해 상태 샘플만
보낸다. **영상·프레임은 서버로 오지 않는다**(프라이버시 — 결정사항).

흐름:
  POST /focus/sessions/camera        세션 시작(세션별 동의 필요) → id
  POST /focus/sessions/{id}/checks   상태 샘플 배치 업로드 → 점수·이탈 갱신
  POST /focus/sessions/{id}/finish   종료 → 집중 점수·인증 확정 + 플래너 '인증' 기록

이탈(자리 비움) 5분 이상 지속되면 그 채팅방으로 선톡("자리 비웠네?") 한 번.
집중 점수 = focus 샘플 비율(%). 기준 이상이면 verified=True.
"""

from datetime import UTC, datetime

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


async def _owned_camera_session(db: AsyncSession, user_id: str, session_id: str) -> FocusSession:
    session = await db.get(FocusSession, session_id)
    if session is None or session.user_id != user_id or session.source != "camera":
        raise AppError("FOCUS_SESSION_NOT_FOUND", "집중 세션을 찾을 수 없습니다.", status_code=404)
    return session


def _score_and_away(samples: list[FocusCheckSample]) -> tuple[int, int, datetime | None]:
    """집중 점수(%), 이탈(5분+ 자리비움) 횟수, 진행 중 이탈의 시작 시각.

    진행 중 이탈 시작 = 마지막 샘플이 absent 이고 그 연속 구간이 5분 이상이면 그 시작.
    """
    if not samples:
        return 0, 0, None
    ordered = sorted(samples, key=lambda s: s.at)
    total = len(ordered)
    focus = sum(1 for s in ordered if s.status == "focus")
    score = round(focus / total * 100)

    away_count = 0
    ongoing_start: datetime | None = None
    run_start: datetime | None = None
    for i, s in enumerate(ordered):
        if s.status == "absent":
            if run_start is None:
                run_start = as_utc(s.at)
            # 구간이 끝나는 지점(다음이 focus 이거나 마지막)에서 길이를 잰다
            is_last = i == total - 1
            next_focus = not is_last and ordered[i + 1].status == "focus"
            if is_last or next_focus:
                duration = (as_utc(s.at) - run_start).total_seconds()
                if duration >= CAMERA_AWAY_SECONDS:
                    away_count += 1
                    if is_last:
                        ongoing_start = run_start
                run_start = None
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
