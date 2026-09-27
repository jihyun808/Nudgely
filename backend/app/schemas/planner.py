"""텐미닛 플래너 스키마.

프론트 types/planner.ts 와 1:1 (camelCase).
"""

from datetime import date

from pydantic import Field

from app.schemas.common import CamelModel

#: 자정 기준 분. 24:00 == 1440
DAY_MINUTES = 24 * 60


class PlannerBlockOut(CamelModel):
    id: str
    title: str
    start_minutes: int
    duration_minutes: int
    # 실제 기록만 kind(focus/verify/manual). 계획 블록은 없음.
    kind: str | None = None
    # 어느 목표의 블록인지. 목표 없이 그냥 집중한 기록이면 둘 다 없다.
    goal_id: str | None = None
    goal_name: str | None = None


class PlannerBlockIn(CamelModel):
    """실제 기록 추가·수정 입력. 계획(kind=None)은 AI 가 세우므로 여기로 들어오지 않는다."""

    title: str = Field(min_length=1, max_length=50)
    start_minutes: int = Field(ge=0, le=DAY_MINUTES - 1)
    duration_minutes: int = Field(ge=1, le=DAY_MINUTES)


class DailyPlannerOut(CamelModel):
    """하루치 플래너 (types/planner.ts DailyPlanner)."""

    date: date
    planned: list[PlannerBlockOut]
    actual: list[PlannerBlockOut]
