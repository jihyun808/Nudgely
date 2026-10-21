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


# ── 카메라 집중 인증 ──


class StartCameraSessionIn(CamelModel):
    """카메라 인증 세션 시작.

    consented: 세션별 명시적 동의(카메라 사용에 동의했는가). False 면 거부.
    영상은 서버로 오지 않으며 기기에서만 분석됨(프라이버시).
    """

    started_at: datetime
    goal_id: str | None = None
    consented: bool = False


class FocusCheckIn(CamelModel):
    status: str  # focus | absent
    at: datetime
    confidence: float | None = None


class SubmitChecksIn(CamelModel):
    samples: list[FocusCheckIn] = Field(min_length=1)


class FinishCameraSessionIn(CamelModel):
    seconds: int = Field(ge=0)


class CameraSessionOut(CamelModel):
    """카메라 세션 현재 상태."""

    id: str
    focus_score: int
    verified: bool
    away_count: int  # 5분 이상 자리 비움 횟수


class ResumeCameraSessionOut(CamelModel):
    """백그라운드에서 돌아왔을 때. False 면 유예가 지나 이미 끊겼다."""

    alive: bool


class VerifiedFocusOut(CamelModel):
    """마이페이지 '인증 완료' 집계 — 카메라로 인증된 집중 세션."""

    count: int
    total_seconds: int
