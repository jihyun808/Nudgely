"""반복 일정 모델 — '매일 할 것'.

목표를 세울 때 정한 "매일 1소주제씩, 수업·문제풀이·정리" 를 담는다.
투두(todos)는 날짜마다 새로 생기는 기록이고, 이건 **그 투두를 만들 근거**다.

없으면 매일 "오늘 뭐 할래?" 를 백지에서 물어야 한다. 있으면 AI 가
"오늘도 수업·문제풀이·정리 할까?" 로 먼저 제안할 수 있다.
"""

from datetime import UTC, datetime

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base, UtcDateTime
from app.core.ids import new_id


def _now() -> datetime:
    return datetime.now(UTC)


class Routine(Base):
    """목표의 반복 할 일 한 줄. 통째로 교체하는 방식이라 순서(order)를 갖는다."""

    __tablename__ = "goal_routines"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: new_id("r"))
    goal_id: Mapped[str] = mapped_column(
        String, ForeignKey("goals.id", ondelete="CASCADE"), index=True
    )
    content: Mapped[str] = mapped_column(String, nullable=False)
    tag: Mapped[str | None] = mapped_column(String, nullable=True)
    # 이 항목을 끝내면 목표 진도가 얼마나 오르는지. 투두로 옮길 때 그대로 쓴다.
    # 한 단위를 여러 줄로 쪼갰으면 합이 1 이 되게 둔다(복습·정리는 0).
    progress_delta: Mapped[int] = mapped_column(Integer, default=0)
    # 플래너에 시간을 잡을 때 제안할 길이(분). 모르면 비워 둔다.
    duration_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # 하는 요일. 월=0 … 일=6 을 이어 붙인 문자열("024" = 월·수·금).
    # 비어 있으면 매일. (프론트의 toMondayFirst 와 같은 기준)
    weekdays: Mapped[str | None] = mapped_column(String, nullable=True)
    order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(UtcDateTime, default=_now)
