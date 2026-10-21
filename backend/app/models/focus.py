"""집중 세션 모델 (api.md §6).

스톱워치는 종료 시 한 건, 뽀모도로는 집중 25분마다 한 건 저장한다(휴식 제외).
중복 저장 방지: (user_id, started_at) 유니크 — 같은 시작 시각의 재전송은 무시.

집중 '시간' 집계는 이 표가 아니라 플래너 실제 기록에서 한다(planner_service).
세션은 저장과 동시에 플래너 블록을 남기고, 사용자는 그 블록을 고친다.
이 표는 중복 저장 방지와 카메라 판정 샘플을 위해 남겨 둔다.

카메라 집중 인증(source="camera"): 세션 중 기기가 "자리에 있나/없나"를 판정해
상태 샘플(FocusCheckSample)만 보낸다. **영상·프레임은 서버로 오지 않는다.**
"""

from datetime import UTC, datetime

from sqlalchemy import Boolean, Float, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base, UtcDateTime
from app.core.ids import new_id

FOCUS_MODES = ("stopwatch", "pomodoro")
#: 세션 출처. 일반 타이머 vs 카메라 인증.
FOCUS_SOURCES = ("timer", "camera")
#: 카메라 판정 샘플 상태.
FOCUS_CHECK_STATUSES = ("focus", "absent")


def _now() -> datetime:
    return datetime.now(UTC)


class FocusSession(Base):
    __tablename__ = "focus_sessions"
    __table_args__ = (UniqueConstraint("user_id", "started_at", name="uq_focus_user_started"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: new_id("fs"))
    user_id: Mapped[str] = mapped_column(
        String, ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    goal_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("goals.id", ondelete="SET NULL"), nullable=True, index=True
    )
    mode: Mapped[str] = mapped_column(String, nullable=False)  # stopwatch | pomodoro
    seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    started_at: Mapped[datetime] = mapped_column(UtcDateTime, nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(UtcDateTime, default=_now)

    # ── 카메라 집중 인증 ──
    source: Mapped[str] = mapped_column(String, nullable=False, default="timer")
    # 집중 점수(%): 자리 비움(연속 absent)을 뺀 샘플 비율. 카메라 세션에서만 채워진다.
    focus_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # 인증 성립 여부(focus_score 가 기준 이상 + 종료됨).
    verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    checks: Mapped[list["FocusCheckSample"]] = relationship(
        back_populates="session",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class FocusCheckSample(Base):
    """카메라 집중 인증의 구간 판정 한 건.

    기기가 N초마다 "focus(자리에 있고 집중) / absent(자리 비움)" 를 판정해 보낸다.
    원본 프레임이 아니라 **판정 결과만** 저장한다(프라이버시).
    """

    __tablename__ = "focus_check_samples"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: new_id("fc"))
    session_id: Mapped[str] = mapped_column(
        String, ForeignKey("focus_sessions.id", ondelete="CASCADE"), index=True
    )
    status: Mapped[str] = mapped_column(String, nullable=False)  # focus | absent
    at: Mapped[datetime] = mapped_column(UtcDateTime, nullable=False)
    # 판정 신뢰도(0~1). 기기가 주면 저장, 없으면 NULL.
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(UtcDateTime, default=_now)

    session: Mapped["FocusSession"] = relationship(back_populates="checks")
