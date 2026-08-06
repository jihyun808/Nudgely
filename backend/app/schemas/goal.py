"""목표(=채팅방) · 메시지 스키마.

프론트 types/goal.ts · types/chat.ts 와 1:1 로 맞춘다(camelCase).
"""

from datetime import date, datetime

from pydantic import Field

from app.schemas.common import CamelModel

NAME_MAX = 10
TITLE_MAX = 50
PROMPT_MAX = 500
PERSONAS = ("teacher", "instructor", "friend")


class Progress(CamelModel):
    current: int
    total: int
    unit: str


class GoalOut(CamelModel):
    """채팅 목록 · 홈 목표 카드 공용 (types/goal.ts Goal)."""

    id: str
    name: str
    title: str | None = None
    image_url: str | None = None

    last_message: str
    last_message_at: datetime
    unread_count: int

    started_at: datetime | None = None
    remaining_days: int | None = None
    completed_at: datetime | None = None
    progress: Progress | None = None


class GoalDetailOut(GoalOut):
    """목표 상세 (설정 화면). Goal + 설정용 필드."""

    prompt: str | None = None
    persona: str | None = None
    due_date: date | None = None
    is_notification_muted: bool = False
    is_hidden: bool = False


class UpdateGoalIn(CamelModel):
    """PATCH /goals/{id}. 보낸 필드만 갱신한다.

    이미지는 파일 스토리지 슬라이스에서 multipart 로 붙인다(여기선 제외).
    """

    name: str | None = Field(default=None, min_length=1, max_length=NAME_MAX)
    title: str | None = Field(default=None, max_length=TITLE_MAX)
    prompt: str | None = Field(default=None, max_length=PROMPT_MAX)
    persona: str | None = None
    due_date: date | None = None
    is_notification_muted: bool | None = None
    is_hidden: bool | None = None


# ── 메시지 ──


class MessageFile(CamelModel):
    name: str
    caption: str | None = None
    url: str | None = None


class MessageOut(CamelModel):
    """채팅 메시지 (types/chat.ts ChatMessage)."""

    id: str
    role: str
    content: str
    created_at: datetime
    file: MessageFile | None = None


class MessagePage(CamelModel):
    """메시지 목록 응답 (최신 → 과거 순). 프론트가 뒤집어 그린다."""

    messages: list[MessageOut]
    next_cursor: str | None = None


# 입력창 최대 길이(types/chat.ts MESSAGE_MAX_LENGTH)
MESSAGE_CONTENT_MAX = 1000


class SendMessageIn(CamelModel):
    """POST /goals/{id}/messages 본문 (텍스트).

    파일 첨부(multipart)는 파일 스토리지 슬라이스에서 추가한다.
    """

    content: str = Field(min_length=1, max_length=MESSAGE_CONTENT_MAX)
