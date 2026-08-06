"""텐미닛 플래너 스키마.

프론트 types/planner.ts 와 1:1 (camelCase).
"""

from datetime import date

from app.schemas.common import CamelModel


class PlannerBlockOut(CamelModel):
    id: str
    title: str
    start_minutes: int
    duration_minutes: int
    # 실제 기록만 kind(focus/verify/manual). 계획 블록은 없음.
    kind: str | None = None


class DailyPlannerOut(CamelModel):
    """하루치 플래너 (types/planner.ts DailyPlanner)."""

    date: date
    planned: list[PlannerBlockOut]
    actual: list[PlannerBlockOut]
