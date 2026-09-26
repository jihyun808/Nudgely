"""푸시 기기 등록 (api.md §5.3).

    POST   /api/devices          이 기기로 푸시를 받겠다
    DELETE /api/devices/{token}  그만 받겠다 (로그아웃)

앱이 켜질 때마다 POST 한다. FCM 토큰은 재설치·재발급으로 조용히 바뀌는데,
바뀐 걸 알려주는 신호가 따로 없어서 매번 보내는 게 유일하게 확실한 방법이다.

**로그아웃 때 DELETE 를 꼭 불러야 한다.** 안 지우면 그 기기에 이전 사용자의
선톡이 계속 뜬다 — 기기를 빌려준 사람에게는 남의 공부 알림이 간다.
"""

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.db import get_db
from app.models.device import DeviceToken
from app.models.user import User
from app.schemas.device import RegisterDeviceIn

router = APIRouter()


def _now() -> datetime:
    return datetime.now(UTC)


@router.post("/devices", status_code=status.HTTP_204_NO_CONTENT)
async def register_device(
    body: RegisterDeviceIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """이 기기를 등록한다. 이미 있으면 사용자와 시각만 갱신한다.

    토큰이 기본키라, 같은 기기에서 계정을 바꿔 로그인하면 소유자가 옮겨간다.
    """
    device = await db.get(DeviceToken, body.token)
    if device is None:
        db.add(DeviceToken(token=body.token, user_id=user.id, platform=body.platform))
    else:
        device.user_id = user.id
        device.platform = body.platform
        device.last_seen_at = _now()
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/devices/{token}", status_code=status.HTTP_204_NO_CONTENT)
async def unregister_device(
    token: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """등록을 지운다. 없는 토큰이어도 성공으로 둔다(로그아웃을 막지 않는다).

    남의 토큰은 지울 수 없다 — 토큰만 알면 남의 기기 알림을 끌 수 있으면 안 된다.
    """
    device = await db.get(DeviceToken, token)
    if device is not None and device.user_id == user.id:
        await db.delete(device)
        await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
