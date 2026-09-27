"""라우터 공통 의존성.

- get_current_user: Authorization 헤더의 Bearer 토큰을 검증하고 사용자를 주입.
  토큰이 없거나 유효하지 않으면 401 을 던진다(프론트가 토큰 삭제 후 재로그인).
"""

import jwt
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.errors import AppError
from app.core.security import decode_access_token
from app.models.user import User

# auto_error=False: 헤더가 없을 때도 우리가 직접 401(코드 포함)로 응답하려고.
_bearer = HTTPBearer(auto_error=False)


def _unauthorized() -> AppError:
    return AppError("UNAUTHORIZED", "로그인이 필요합니다.", status_code=401)


async def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: AsyncSession = Depends(get_db),
) -> User:
    if creds is None or not creds.credentials:
        raise _unauthorized()
    try:
        payload = decode_access_token(creds.credentials)
    except jwt.PyJWTError as exc:
        raise _unauthorized() from exc

    user_id = payload.get("sub")
    if not user_id:
        raise _unauthorized()

    user = await db.get(User, user_id)
    if user is None or user.deleted_at is not None:
        raise _unauthorized()
    return user
