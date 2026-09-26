"""기록(투두) 스키마.

프론트 types/record.ts 와 1:1 (camelCase).
"""

from datetime import date

from pydantic import Field

from app.schemas.common import CamelModel

#: 항목 내용·태그 글자수 상한 (프론트 types/record.ts 와 같은 값)
TODO_CONTENT_MAX = 50
TODO_TAG_MAX = 10


class TodoItemOut(CamelModel):
    id: str
    content: str
    is_done: bool
    tag: str | None = None
    # 누가 만든 항목인지. 화면이 'AI가 넣은 것' 을 표시하는 데 쓴다.
    source: str | None = None


class TodoItemIn(CamelModel):
    """항목 추가·수정 입력."""

    content: str = Field(min_length=1, max_length=TODO_CONTENT_MAX)
    tag: str | None = Field(default=None, max_length=TODO_TAG_MAX)


class TodoItemDoneIn(CamelModel):
    is_done: bool


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
