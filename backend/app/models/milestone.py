"""마일스톤 모델 (api.md §3.6, archive progress).

목표의 진도 로드맵 한 지점. AI가 생성하며 화면은 읽기 전용.
모아보기 진도 탭의 타임라인이 된다. (카드 진행률 막대인 goal.progress 와는 별개)
"""

from datetime import UTC, datetime

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base, UtcDateTime
from app.core.ids import new_id

# 진행 상태 (types/archive.ts ProgressMilestone.status)
MILESTONE_STATUSES = ("done", "current", "upcoming")


def _now() -> datetime:
    return datetime.now(UTC)


class Milestone(Base):
    __tablename__ = "milestones"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: new_id("ms"))
    goal_id: Mapped[str] = mapped_column(
        String, ForeignKey("goals.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(String, default="upcoming")  # done|current|upcoming
    # 이 단계가 끝나는 진도 지점(goal.progress.current 기준). 없으면 균등 분할로 본다.
    # 예: 24소주제를 1~4장으로 나누면 6/12/18/24.
    target_progress: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # 타임라인 정렬용 순서
    order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(UtcDateTime, default=_now)
