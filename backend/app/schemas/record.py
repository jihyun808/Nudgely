"""기록(투두) 스키마.

프론트 types/record.ts 와 1:1 (camelCase).
"""

from datetime import date

from app.schemas.common import CamelModel


class TodoItemOut(CamelModel):
    id: str
    content: str
    is_done: bool
    tag: str | None = None


class DailyTodoOut(CamelModel):
    """어떤 목표의 하루치 투두 (types/record.ts DailyTodo)."""

    id: str
    goal_id: str
    goal_title: str
    date: date
    items: list[TodoItemOut]


class TodoMark(CamelModel):
    """캘린더 한 칸의 완료 표시. 완료 항목 하나가 꽃잎 하나(목표 id 중복 허용)."""

    date: date
    done_goal_ids: list[str]


class TodoMarksOut(CamelModel):
    marks: list[TodoMark]
