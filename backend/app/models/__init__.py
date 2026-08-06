"""ORM 모델 패키지.

여기서 모든 모델을 import 해 두면 `Base.metadata` 에 등록되어
`init_models()`(개발) / Alembic autogenerate 가 인식한다.
새 모델을 추가하면 이 목록에도 넣어주세요.
"""

from app.models.goal import Goal, Message, ReadState
from app.models.todo import Todo, TodoItem
from app.models.user import User, UserSettings

__all__ = [
    "Goal",
    "Message",
    "ReadState",
    "Todo",
    "TodoItem",
    "User",
    "UserSettings",
]
