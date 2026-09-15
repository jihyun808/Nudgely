"""모아보기(진도) 스키마.

프론트 types/archive.ts GoalProgress 와 1:1 (camelCase).
"""

from datetime import datetime

from app.schemas.common import CamelModel


class AttachmentOut(CamelModel):
    """모아보기 첨부 (types/archive.ts Attachment).

    url 은 항상 원본이다(뷰어·다운로드용). 목록에 작게 그릴 때 쓰라고
    사진(image)은 thumbnail_url 을 함께 준다(api.md §3.6, §8-3-2).
    """

    id: str
    kind: str  # file | image
    name: str
    size_bytes: int
    uploaded_at: datetime
    url: str | None = None
    # 사진만 있다. 없으면 프론트가 url(원본)로 대체한다.
    thumbnail_url: str | None = None


class ProgressMilestoneOut(CamelModel):
    id: str
    title: str
    status: str  # done | current | upcoming


class GoalProgressOut(CamelModel):
    """목표 진도 로드맵. 진행률(%)은 프론트가 done÷전체로 계산한다."""

    goal_id: str
    goal_title: str
    started_at: datetime
    completed_at: datetime | None = None
    milestones: list[ProgressMilestoneOut]

    # 집계 3종. 없으면 프론트가 해당 칸을 그리지 않는다(초기엔 생략 가능).
    focused_seconds: int | None = None  # 집중 세션에 goal_id 필요(4단계)
    completed_todo_count: int | None = None
    best_month: str | None = None  # 집중 집계(4단계)
