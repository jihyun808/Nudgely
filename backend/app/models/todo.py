"""투두 모델 (api.md §4.1).

- Todo: 어떤 목표의 '하루치' 투두 묶음. 날짜마다 새로 만들어진다.
- TodoItem: 그 안의 항목. 체크 상태는 AI가 바꾸고 화면은 읽기 전용.

진도 연동(확정, ai-plan §4.3b): 항목마다 `progress_delta`(진도 기여값)를 갖고,
완료/해제 시 목표의 progress.current 를 ±delta 로 조정한다.
"""

from datetime import UTC, date, datetime

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.core.ids import new_id


def _now() -> datetime:
    return datetime.now(UTC)


class Todo(Base):
    __tablename__ = "todos"
    __table_args__ = (UniqueConstraint("goal_id", "date", name="uq_todo_goal_date"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: new_id("t"))
    goal_id: Mapped[str] = mapped_column(
        String, ForeignKey("goals.id", ondelete="CASCADE"), index=True
    )
    date: Mapped[date] = mapped_column(Date, index=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    items: Mapped[list["TodoItem"]] = relationship(
        back_populates="todo",
        cascade="all, delete-orphan",
        order_by="TodoItem.created_at, TodoItem.id",
        lazy="selectin",
    )


class TodoItem(Base):
    __tablename__ = "todo_items"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: new_id("ti"))
    todo_id: Mapped[str] = mapped_column(
        String, ForeignKey("todos.id", ondelete="CASCADE"), index=True
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    is_done: Mapped[bool] = mapped_column(Boolean, default=False)
    tag: Mapped[str | None] = mapped_column(String, nullable=True)
    # 진도 기여값. '강'에 해당하는 항목만 값을 갖고, 복습·정리 등은 0.
    progress_delta: Mapped[int] = mapped_column(Integer, default=0)
    done_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    todo: Mapped["Todo"] = relationship(back_populates="items")
