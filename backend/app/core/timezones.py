"""사용자 로컬 시각 계산.

밤 11시 점검, 방해 금지 시간대, "오늘 집중 시간" 은 전부 **그 사람의 하루** 기준이다.
서버 UTC 로 판단하면 한국 사용자에게 밤 11시 알림이 아침 8시에 가고,
자정 직후에 한 집중이 전날 기록으로 붙는다.

타임존은 UserSettings.timezone 에 있고, 값이 이상하면 기본값으로 떨어진다.
"""

from datetime import UTC, date, datetime, time
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

DEFAULT_TIMEZONE = "Asia/Seoul"


def zone_of(name: str | None) -> ZoneInfo:
    """설정값 → ZoneInfo. 모르는 이름이면 기본값."""
    try:
        return ZoneInfo(name or DEFAULT_TIMEZONE)
    except (ZoneInfoNotFoundError, ValueError):
        return ZoneInfo(DEFAULT_TIMEZONE)


def is_valid_zone(name: str) -> bool:
    try:
        ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError):
        return False
    return True


def as_utc(value: datetime) -> datetime:
    """naive 면 UTC 로 간주. SQLite 가 타임존을 떼고 돌려주기 때문."""
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value


def local_now(zone: ZoneInfo, now_utc: datetime | None = None) -> datetime:
    return as_utc(now_utc or datetime.now(UTC)).astimezone(zone)


def local_date_of(value: datetime, zone: ZoneInfo) -> date:
    """UTC 시각을 그 사람 기준 '무슨 날' 인지로 바꾼다."""
    return as_utc(value).astimezone(zone).date()


def day_bounds(day: date, zone: ZoneInfo) -> tuple[datetime, datetime]:
    """그 사람의 하루가 UTC 로 언제부터 언제까지인지."""
    start = datetime.combine(day, time.min, tzinfo=zone)
    end = datetime.combine(day, time.max, tzinfo=zone)
    return start.astimezone(UTC), end.astimezone(UTC)
