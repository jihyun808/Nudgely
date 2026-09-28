"""인증 관련 스키마."""

from pydantic import EmailStr, Field

from app.schemas.common import CamelModel
from app.schemas.user import NICKNAME_MAX, NICKNAME_MIN, UserOut

# 비밀번호 최소 길이(api.md §2, types/auth.ts MIN_PASSWORD_LENGTH)
PASSWORD_MIN = 8


class SignupIn(CamelModel):
    nickname: str = Field(min_length=NICKNAME_MIN, max_length=NICKNAME_MAX)
    email: EmailStr
    password: str = Field(min_length=PASSWORD_MIN)


class LoginIn(CamelModel):
    email: EmailStr
    password: str = Field(min_length=1)


class SocialLoginIn(CamelModel):
    provider: str  # "kakao" | "google"
    code: str


class AuthResult(CamelModel):
    """로그인·회원가입 공통 응답 (api/auth.ts AuthResult)."""

    access_token: str
    user: UserOut


class AccessTokenOut(CamelModel):
    """비밀번호를 바꾼 뒤 받는 새 토큰.

    바꾸는 순간 이미 나가 있던 토큰이 전부 죽으므로(token_version), 지금 쓰는
    기기까지 함께 로그아웃된다. 그건 사용자에게 버그로 보인다 — 새 토큰을 줘서
    이 기기만 이어 가게 한다.
    """

    access_token: str


class ChangePasswordIn(CamelModel):
    current_password: str = Field(min_length=1)
    new_password: str = Field(min_length=PASSWORD_MIN)


class PasswordResetIn(CamelModel):
    email: EmailStr
