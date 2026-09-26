"""FCM 푸시 발송 (api.md §5.3).

**앱이 꺼져 있을 때 사용자에게 닿는 유일한 길이다.** 종 아이콘 목록은 앱을 열어야
보이고, SSE 는 채팅방을 보고 있어야 살아 있다. 선톡을 밤 11시에 보내 봐야 다음 날
앱을 열 때 읽히면 선톡이 아니다.

설계에서 고집한 것 세 가지:

1. **절대 호출자를 깨뜨리지 않는다.** 푸시는 부가 기능이다. FCM 이 죽었다고 투두
   저장이 실패하면 안 된다. 모든 예외를 여기서 삼키고 로그만 남긴다.
2. **자격 증명이 없으면 조용히 건너뛴다.** 개발·테스트·CI 에서 푸시 설정 없이
   전부 돌아가야 한다(push_configured 가 False 면 아무 일도 안 한다).
3. **죽은 토큰은 그 자리에서 지운다.** 토큰은 앱 재설치·오랜 미사용으로 조용히
   만료된다. 안 지우면 보낼 때마다 실패하는 토큰이 계정마다 쌓인다.

인증은 서비스 계정 키로 OAuth2 액세스 토큰을 받아 쓴다(FCM HTTP v1). 토큰은
한 시간짜리라 메모리에 캐시한다 — 푸시 한 번에 토큰 요청 한 번이면 두 배로 느리다.
"""

import asyncio
import json
import logging
import time
from pathlib import Path

import httpx
import jwt
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.device import DeviceToken

logger = logging.getLogger(__name__)

_TOKEN_URL = "https://oauth2.googleapis.com/token"
_SCOPE = "https://www.googleapis.com/auth/firebase.messaging"
_GRANT = "urn:ietf:params:oauth:grant-type:jwt-bearer"

#: 액세스 토큰 유효 시간(초). 구글이 주는 값은 3600 이다.
_TOKEN_TTL = 3600
#: 만료 직전에 미리 갱신할 여유(초). 딱 맞춰 쓰면 전송 중에 만료된다.
_TOKEN_MARGIN = 300

#: FCM 응답을 기다릴 시간. 알림 하나 때문에 요청이나 스케줄러 틱이 밀리면 안 된다.
TIMEOUT_SECONDS = 10

#: 푸시 본문 길이 상한. 안드로이드·iOS 모두 알림 한 줄에서 잘린다.
MAX_BODY = 200

#: 이 응답을 받은 토큰은 죽은 것으로 보고 지운다.
#: UNREGISTERED = 앱을 지웠거나 토큰이 재발급됐다. INVALID_ARGUMENT = 형식이 깨졌다.
_DEAD_TOKEN_ERRORS = ("UNREGISTERED", "INVALID_ARGUMENT")

#: 캐시된 (액세스 토큰, 만료 시각)
_access_token: tuple[str, float] | None = None
_token_lock = asyncio.Lock()

#: 보내는 중인 백그라운드 태스크. asyncio 가 약참조로만 들고 있어 놓으면 GC 가 거둔다
_running: set[asyncio.Task] = set()


def _new_client() -> httpx.AsyncClient:
    """HTTP 클라이언트. 테스트에서 갈아끼울 수 있게 한 겹 둔다."""
    return httpx.AsyncClient()


def _credentials() -> dict:
    return json.loads(Path(settings.fcm_credentials_file).read_text(encoding="utf-8"))


async def _fetch_access_token(client: httpx.AsyncClient) -> str:
    """서비스 계정 키로 서명한 JWT 를 액세스 토큰과 교환한다."""
    creds = _credentials()
    now = int(time.time())
    assertion = jwt.encode(
        {
            "iss": creds["client_email"],
            "scope": _SCOPE,
            "aud": _TOKEN_URL,
            "iat": now,
            "exp": now + _TOKEN_TTL,
        },
        creds["private_key"],
        algorithm="RS256",
    )
    resp = await client.post(
        _TOKEN_URL, data={"grant_type": _GRANT, "assertion": assertion}, timeout=TIMEOUT_SECONDS
    )
    resp.raise_for_status()
    return resp.json()["access_token"]


async def _get_access_token(client: httpx.AsyncClient) -> str:
    """캐시된 액세스 토큰. 만료가 가까우면 새로 받는다.

    락을 잡는 이유: 스케줄러가 여러 사용자에게 동시에 보낼 때 락이 없으면
    같은 순간 열 번 토큰을 요청한다.
    """
    global _access_token
    async with _token_lock:
        if _access_token is not None and time.time() < _access_token[1]:
            return _access_token[0]
        token = await _fetch_access_token(client)
        _access_token = (token, time.time() + _TOKEN_TTL - _TOKEN_MARGIN)
        return token


def reset_access_token() -> None:
    """캐시를 비운다(자격 증명 교체·테스트용)."""
    global _access_token
    _access_token = None


def _message(token: str, title: str, body: str, data: dict[str, str] | None) -> dict:
    """FCM HTTP v1 메시지 한 통.

    누르면 앱만 열린다 — 이동 경로를 싣지 않는다(§5.2 에서 정한 규칙).
    data 는 프론트가 필요하면 쓰는 부가 정보이고, 없어도 알림은 뜬다.
    """
    return {
        "message": {
            "token": token,
            "notification": {"title": title, "body": body[:MAX_BODY]},
            # 잠금화면에 바로 뜨게 한다. 기본값은 조용히 쌓이기만 한다
            "android": {"priority": "high", "notification": {"default_sound": True}},
            "apns": {"payload": {"aps": {"sound": "default"}}},
            **({"data": data} if data else {}),
        }
    }


async def _send_one(
    client: httpx.AsyncClient, access_token: str, url: str, token: str, payload: dict
) -> bool:
    """한 기기로 보낸다. 토큰이 죽었으면 False (호출자가 지운다)."""
    resp = await client.post(
        url,
        json=payload,
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=TIMEOUT_SECONDS,
    )
    if resp.status_code < 300:
        return True

    detail = resp.text[:300]
    if resp.status_code in (400, 403, 404) and any(e in detail for e in _DEAD_TOKEN_ERRORS):
        logger.info("죽은 푸시 토큰을 지운다: %s", token[:12])
        return False
    # 그 밖의 실패(500·할당량 등)는 토큰 문제가 아니다. 남겨두고 다음에 다시 보낸다
    logger.warning("푸시 전송 실패(%s): %s", resp.status_code, detail)
    return True


async def send_to_user(
    db: AsyncSession,
    user_id: str,
    *,
    title: str,
    body: str,
    data: dict[str, str] | None = None,
) -> int:
    """한 사용자의 모든 기기로 보낸다. 성공한 기기 수를 반환.

    발송 여부(알림 설정·방해 금지) 판단은 **호출하는 쪽** 책임이다. 여기서 또 보면
    notification_service 와 규칙이 두 군데로 갈라진다.
    """
    if not settings.push_configured:
        return 0

    tokens = (
        (await db.execute(select(DeviceToken.token).where(DeviceToken.user_id == user_id)))
        .scalars()
        .all()
    )
    if not tokens:
        return 0

    url = f"https://fcm.googleapis.com/v1/projects/{settings.fcm_project_id}/messages:send"
    dead: list[str] = []
    sent = 0

    async with _new_client() as client:
        access_token = await _get_access_token(client)
        for token in tokens:
            try:
                alive = await _send_one(
                    client, access_token, url, token, _message(token, title, body, data)
                )
            except Exception:  # noqa: BLE001 - 한 기기가 실패해도 나머지에 보낸다
                logger.exception("푸시 전송 중 오류(token=%s)", token[:12])
                continue
            if alive:
                sent += 1
            else:
                dead.append(token)

    if dead:
        await db.execute(delete(DeviceToken).where(DeviceToken.token.in_(dead)))
        await db.flush()
    return sent


def push_in_background(
    user_id: str, *, title: str, body: str, data: dict[str, str] | None = None
) -> None:
    """푸시를 백그라운드로 던진다. 호출자는 기다리지 않는다.

    FCM 왕복은 수백 ms 다. 대화 응답이나 도구 실행 경로에서 이걸 기다리면
    사용자가 그만큼 더 기다린다. 결과도, 실패도 호출자에게 돌려주지 않는다.

    세션은 따로 연다. 호출한 쪽의 세션은 요청이 끝나면 닫히고, 죽은 토큰을
    지우는 것이 남의 트랜잭션에 섞여 들어가서도 안 된다.
    """
    if not settings.push_configured:
        return

    from app.core.db import async_session

    async def run() -> None:
        try:
            async with async_session() as db:
                await send_to_user(db, user_id, title=title, body=body, data=data)
                await db.commit()
        except Exception:  # noqa: BLE001 - 푸시 실패로 아무것도 깨지지 않는다
            logger.exception("백그라운드 푸시 실패(user=%s)", user_id)

    task = asyncio.create_task(run())
    _running.add(task)
    task.add_done_callback(_running.discard)


__all__ = ["push_in_background", "reset_access_token", "send_to_user"]
