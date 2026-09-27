"""집중 스키마 (api.md §6).

프론트가 실제 쓰는 필드는 FocusSummary{focusedSeconds,targetMinutes},
WeeklyFocus{hours,diffFromLastWeek}. streak 3종은 api.md 스펙(프론트는 무시해도 안전).
"""

from datetime import datetime

from pydantic import Field

from app.schemas.common import CamelModel


class FocusSummaryOut(CamelModel):
    focused_seconds: int
    target_minutes: int
    # 연속 기록(투두 체크된 날 기준). 과거 전체 이력으로 서버가 계산.
    streak_days: int = 0
    best_streak_days: int = 0
    is_best_streak: bool = False


class FocusSessionIn(CamelModel):
    mode: str  # stopwatch | pomodoro
    seconds: int = Field(gt=0)
    started_at: datetime
    goal_id: str | None = None  # 목표별 집계용(선택)


class WeeklyFocusOut(CamelModel):
    hours: list[float]  # 월~일 7개(시간 단위)
    diff_from_last_week: float


class DailyFocusItem(CamelModel):
    date: str  # YYYY-MM-DD
    seconds: int


class DailyFocusOut(CamelModel):
    days: list[DailyFocusItem]
