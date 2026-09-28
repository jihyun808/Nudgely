"""인증 유틸리티.

- 비밀번호 해싱/검증 (bcrypt)
- JWT 액세스 토큰 발급/해석

현재는 액세스 토큰만 사용한다(리프레시 정책 미확정, api.md §8-2).
"""

from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from passlib.context import CryptContext

from app.core.config import settings

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain: str) -> str:
    return _pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return _pwd_context.verify(plain, hashed)


def create_access_token(subject: str, token_version: int = 0) -> str:
    """subject(보통 user id)를 담은 JWT 를 발급.

    token_version 을 함께 담는다. 사용자 쪽 값이 올라가면(비밀번호 변경 등)
    이미 나가 있던 토큰이 전부 거절된다 — 무상태 JWT 를 끊는 유일한 수단이다.
    """
    now = datetime.now(UTC)
    payload = {
        "sub": subject,
        "ver": token_version,
        "iat": now,
        "exp": now + timedelta(minutes=settings.access_token_expire_minutes),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict[str, Any]:
    """JWT 를 검증·해석. 유효하지 않으면 jwt.PyJWTError 를 던진다."""
    return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
