"""집중 세션 모델 (api.md §6).

스톱워치는 종료 시 한 건, 뽀모도로는 집중 25분마다 한 건 저장한다(휴식 제외).
중복 저장 방지: (user_id, started_at) 유니크 — 같은 시작 시각의 재전송은 무시.

goal_id: 목표별 집중 시간 집계용(api.md §8-7). 현재 집중 화면에 목표 선택 UI가
없어 대부분 NULL 이지만, 붙는 즉시 목표 진도의 focusedSeconds 가 채워진다.
"""

from datetime import UTC, datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.core.ids import new_id

FOCUS_MODES = ("stopwatch", "pomodoro")


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
    seconds: Mapped[int] = mapped_column(Integer, nullable=False)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
