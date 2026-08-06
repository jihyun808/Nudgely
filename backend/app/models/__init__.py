"""ORM 모델 패키지.

여기서 모든 모델을 import 해 두면 `Base.metadata` 에 등록되어
`init_models()`(개발) / Alembic autogenerate 가 인식한다.
새 모델을 추가하면 이 목록에도 넣어주세요.
"""

from app.models.attachment import Attachment
from app.models.focus import FocusSession
from app.models.goal import Goal, Message, ReadState
from app.models.milestone import Milestone
from app.models.notification import Notification
from app.models.planner import Planner, PlannerBlock
from app.models.todo import Todo, TodoItem
from app.models.user import User, UserSettings

__all__ = [
    "Attachment",
    "FocusSession",
    "Goal",
    "Message",
    "Milestone",
    "Notification",
    "Planner",
    "PlannerBlock",
    "ReadState",
    "Todo",
    "TodoItem",
    "User",
    "UserSettings",
]
