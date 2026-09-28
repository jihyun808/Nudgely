"""인증 경로의 요청 횟수 제한.

메모리에 센다 — 프로세스가 하나라는 전제다(railway.json numReplicas: 1).
여러 대로 늘리는 날에는 Redis 로 옮겨야 한다.
"""

import time
from collections import defaultdict

from fastapi import Request

from app.core.config import settings
from app.core.errors import AppError

#: 키별 (구간 시작 시각, 그 구간에서 센 횟수)
_hits: dict[str, tuple[float, int]] = defaultdict(lambda: (0.0, 0))

#: 오래된 키를 치우는 주기(초). 안 치우면 IP 마다 항목이 쌓여 메모리가 샌다
_SWEEP_SECONDS = 600
_last_sweep = 0.0


def client_key(request: Request) -> str:
    """요청자 키. 프록시 뒤라 X-Forwarded-For 를 봐야 사용자별로 갈린다."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _sweep(now: float) -> None:
    global _last_sweep
    if now - _last_sweep < _SWEEP_SECONDS:
        return
    _last_sweep = now
    stale = [key for key, (started, _) in _hits.items() if now - started > _SWEEP_SECONDS]
    for key in stale:
        del _hits[key]


def hit(key: str, *, limit: int, window_seconds: int) -> None:
    """한 번 세고, 한도를 넘었으면 429 를 던진다."""
    now = time.monotonic()
    _sweep(now)

    started, count = _hits[key]
    if now - started >= window_seconds:
        _hits[key] = (now, 1)
        return

    if count >= limit:
        retry_after = int(window_seconds - (now - started)) + 1
        raise AppError(
            "TOO_MANY_REQUESTS",
            f"시도가 너무 잦습니다. {retry_after}초 뒤에 다시 해주세요.",
            status_code=429,
        )
    _hits[key] = (started, count + 1)


def reset() -> None:
    """테스트에서 서로 영향을 주지 않도록 비운다."""
    _hits.clear()


class RateLimit:
    """라우트 의존성. scope 를 나눠야 로그인 실패가 가입까지 막지 않는다."""

    def __init__(self, scope: str, *, limit: int, window_seconds: int) -> None:
        self.scope = scope
        self.limit = limit
        self.window_seconds = window_seconds

    async def __call__(self, request: Request) -> None:
        if not settings.rate_limit_enabled:
            return
        hit(
            f"{self.scope}:{client_key(request)}",
            limit=self.limit,
            window_seconds=self.window_seconds,
        )
