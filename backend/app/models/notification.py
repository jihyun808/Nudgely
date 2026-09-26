"""알림 모델 (api.md §5.2).

type: nudge | todoAdded | todoDone | todoIncomplete | plannerIncomplete

알림은 '무슨 일이 있었는지' 만 알린다. 눌러도 이동하지 않는다 —
푸시로 앱이 열리는 것까지가 역할이고, 어디로 갈지는 사용자가 정한다.
(경로를 서버가 박으면 프론트 라우팅이 바뀔 때 지난 알림이 전부 깨진다)

여기 쌓인 것이 앱 안 종 아이콘 목록이다. 푸시(push_service)는 이 행을 만들 때
함께 나가지만, 행 없이 푸시만 보내는 경우도 있다(대화 답변 — api.md §5.3).
"""

from datetime import UTC, datetime

from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base, UtcDateTime
from app.core.ids import new_id

NOTIFICATION_TYPES = (
    "nudge",
    "todoAdded",
    "todoDone",
    "todoIncomplete",
    "plannerIncomplete",
)


def _now() -> datetime:
    return datetime.now(UTC)


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: new_id("n"))
    user_id: Mapped[str] = mapped_column(
        String, ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    type: Mapped[str] = mapped_column(String, nullable=False)
    title: Mapped[str] = mapped_column(String, nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False, default="")
    # 어느 목표에서 온 알림인지. 선톡 하루 상한을 목표별로 세는 데 쓴다.
    # 목표와 무관한 알림(공지 등)은 비어 있다.
    goal_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("goals.id", ondelete="CASCADE"), nullable=True, index=True
    )
    # 같은 것에 두 번 보내지 않기 위한 표식. 예: "plan_start:plb_01H".
    # 스케줄러가 10분마다 도니까 이게 없으면 같은 블록에 계속 보낸다.
    ref: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(UtcDateTime, default=_now, index=True)
