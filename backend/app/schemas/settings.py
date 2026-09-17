"""설정 스키마.

프론트 AppSettings(types/settings.ts)와 그대로 매핑한다.
ORM(UserSettings)의 평면 컬럼 ↔ 프론트의 중첩 구조를 서로 변환한다.
"""

from app.core.timezones import DEFAULT_TIMEZONE, is_valid_zone
from app.models.user import UserSettings
from app.schemas.common import CamelModel


class NotificationSettings(CamelModel):
    enabled: bool
    nudge: bool
    todo: bool
    deadline: bool


class DoNotDisturbSettings(CamelModel):
    enabled: bool
    start_hour: int
    end_hour: int


class PlannerSettings(CamelModel):
    start_hour: int
    end_hour: int


class AppSettings(CamelModel):
    notifications: NotificationSettings
    do_not_disturb: DoNotDisturbSettings
    planner: PlannerSettings
    linked_providers: list[str] = []
    # api.md 에 없는 추가 필드. 방해금지·밤 11시 점검·"오늘 집중 시간" 을
    # 그 사람 시각으로 판단하려면 필요하다. 프론트가 무시해도 동작한다.
    timezone: str = DEFAULT_TIMEZONE

    @classmethod
    def from_orm_settings(
        cls, s: UserSettings, linked_providers: list[str] | None = None
    ) -> "AppSettings":
        return cls(
            notifications=NotificationSettings(
                enabled=s.notif_enabled,
                nudge=s.notif_nudge,
                todo=s.notif_todo,
                deadline=s.notif_deadline,
            ),
            do_not_disturb=DoNotDisturbSettings(
                enabled=s.dnd_enabled,
                start_hour=s.dnd_start_hour,
                end_hour=s.dnd_end_hour,
            ),
            planner=PlannerSettings(start_hour=s.planner_start_hour, end_hour=s.planner_end_hour),
            linked_providers=linked_providers or [],
            timezone=s.timezone or DEFAULT_TIMEZONE,
        )


class UpdateNotificationSettings(CamelModel):
    enabled: bool | None = None
    nudge: bool | None = None
    todo: bool | None = None
    deadline: bool | None = None


class UpdateDoNotDisturbSettings(CamelModel):
    enabled: bool | None = None
    start_hour: int | None = None
    end_hour: int | None = None


class UpdatePlannerSettings(CamelModel):
    start_hour: int | None = None
    end_hour: int | None = None


class UpdateSettingsIn(CamelModel):
    """PATCH /settings. 바뀐 그룹/항목만 보낸다."""

    notifications: UpdateNotificationSettings | None = None
    do_not_disturb: UpdateDoNotDisturbSettings | None = None
    planner: UpdatePlannerSettings | None = None
    timezone: str | None = None

    def apply_to(self, s: UserSettings) -> None:
        """보내진 값만 ORM 객체에 반영한다."""
        if self.notifications is not None:
            n = self.notifications
            if n.enabled is not None:
                s.notif_enabled = n.enabled
            if n.nudge is not None:
                s.notif_nudge = n.nudge
            if n.todo is not None:
                s.notif_todo = n.todo
            if n.deadline is not None:
                s.notif_deadline = n.deadline
        if self.do_not_disturb is not None:
            d = self.do_not_disturb
            if d.enabled is not None:
                s.dnd_enabled = d.enabled
            if d.start_hour is not None:
                s.dnd_start_hour = d.start_hour
            if d.end_hour is not None:
                s.dnd_end_hour = d.end_hour
        if self.planner is not None:
            p = self.planner
            if p.start_hour is not None:
                s.planner_start_hour = p.start_hour
            if p.end_hour is not None:
                s.planner_end_hour = p.end_hour
        if self.timezone is not None:
            # 모르는 타임존 하나 때문에 설정 저장 전체를 막지는 않는다
            s.timezone = self.timezone if is_valid_zone(self.timezone) else DEFAULT_TIMEZONE
