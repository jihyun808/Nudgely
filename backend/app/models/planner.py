"""텐미닛 플래너 모델 (api.md §4.3).

- Planner: 사용자의 '하루치' 플래너.
- PlannerBlock: 그 안의 막대 하나.
  - kind=None  → 계획(planned). AI가 정하며 사용자는 바꿀 수 없다.
  - kind=focus/verify/manual → 실제 기록(actual). 출처 구분.

시간은 자정 기준 '분'으로 저장한다(08:00 → 480). 10분 = 1블록.
"""

from datetime import UTC, date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.core.ids import new_id

# 실제 기록의 출처 (types/planner.ts PlannerRecordKind)
PLANNER_KINDS = ("focus", "verify", "manual")


def _now() -> datetime:
    return datetime.now(UTC)


class Planner(Base):
    __tablename__ = "planners"
    __table_args__ = (UniqueConstraint("user_id", "date", name="uq_planner_user_date"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: new_id("pl"))
    user_id: Mapped[str] = mapped_column(
        String, ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    date: Mapped[date] = mapped_column(Date, index=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    blocks: Mapped[list["PlannerBlock"]] = relationship(
        back_populates="planner",
        cascade="all, delete-orphan",
        order_by="PlannerBlock.start_minutes, PlannerBlock.id",
        lazy="selectin",
    )


class PlannerBlock(Base):
    __tablename__ = "planner_blocks"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: new_id("plb"))
    planner_id: Mapped[str] = mapped_column(
        String, ForeignKey("planners.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String, nullable=False)
    start_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    # None 이면 계획(planned), 값이 있으면 실제 기록(actual)
    kind: Mapped[str | None] = mapped_column(String, nullable=True)

    planner: Mapped["Planner"] = relationship(back_populates="blocks")

    @property
    def is_actual(self) -> bool:
        return self.kind is not None
