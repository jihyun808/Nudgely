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


class EmailAvailableOut(CamelModel):
    is_available: bool


class ChangePasswordIn(CamelModel):
    current_password: str = Field(min_length=1)
    new_password: str = Field(min_length=PASSWORD_MIN)


class PasswordResetIn(CamelModel):
    email: EmailStr
