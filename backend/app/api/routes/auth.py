"""인증 엔드포인트 (api.md §2).

    POST /api/auth/signup          회원가입 (즉시 로그인)
    POST /api/auth/login           로그인
    POST /api/auth/logout          로그아웃 (204)
    GET  /api/auth/email-available 이메일 사용 가능 여부
    POST /api/auth/password        비밀번호 변경 (204)
    POST /api/auth/password/reset  비밀번호 재설정 메일 (204)

소셜 로그인(POST /auth/social)은 카카오·구글 키 발급 후 추가 예정.
"""

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.db import get_db
from app.core.errors import AppError
from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import User, UserSettings
from app.schemas.auth import (
    AuthResult,
    ChangePasswordIn,
    EmailAvailableOut,
    LoginIn,
    PasswordResetIn,
    SignupIn,
)
from app.schemas.user import UserOut

router = APIRouter()


async def _find_by_email(db: AsyncSession, email: str) -> User | None:
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


def _issue(user: User) -> AuthResult:
    """사용자에게 액세스 토큰을 발급해 표준 응답으로 감싼다."""
    token = create_access_token(user.id)
    return AuthResult(access_token=token, user=UserOut.model_validate(user))


@router.post("/signup", response_model=AuthResult, status_code=status.HTTP_201_CREATED)
async def signup(body: SignupIn, db: AsyncSession = Depends(get_db)) -> AuthResult:
    email = body.email.lower()
    if await _find_by_email(db, email) is not None:
        raise AppError("EMAIL_TAKEN", "이미 사용 중인 이메일입니다.", status_code=409)

    user = User(
        email=email,
        password_hash=hash_password(body.password),
        nickname=body.nickname.strip(),
    )
    user.settings = UserSettings.defaults(user.id)
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return _issue(user)


@router.post("/login", response_model=AuthResult)
async def login(body: LoginIn, db: AsyncSession = Depends(get_db)) -> AuthResult:
    user = await _find_by_email(db, body.email.lower())
    # 계정 존재 여부를 노출하지 않도록 실패 메시지를 하나로 뭉뚱그린다(api.md §2).
    if (
        user is None
        or user.deleted_at is not None
        or not verify_password(body.password, user.password_hash)
    ):
        raise AppError(
            "INVALID_CREDENTIALS", "이메일 또는 비밀번호를 확인해주세요.", status_code=401
        )
    return _issue(user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(_: User = Depends(get_current_user)) -> Response:
    # 현재는 무상태 JWT 라 서버측에서 폐기할 것이 없다(프론트가 토큰 삭제).
    # 리프레시 토큰 도입 시(api.md §8-2) 여기서 무효화한다.
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/email-available", response_model=EmailAvailableOut)
async def email_available(
    email: str = Query(...), db: AsyncSession = Depends(get_db)
) -> EmailAvailableOut:
    existing = await _find_by_email(db, email.strip().lower())
    return EmailAvailableOut(is_available=existing is None)


@router.post("/password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    body: ChangePasswordIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    if not verify_password(body.current_password, user.password_hash):
        raise AppError("INVALID_PASSWORD", "현재 비밀번호가 올바르지 않습니다.", status_code=400)
    user.password_hash = hash_password(body.new_password)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/password/reset", status_code=status.HTTP_204_NO_CONTENT)
async def request_password_reset(
    body: PasswordResetIn, db: AsyncSession = Depends(get_db)
) -> Response:
    # 가입 여부와 무관하게 항상 204 (계정 존재 노출 방지, api.md §2).
    # TODO: 가입된 경우 일회용·짧은 만료(예: 30분) 재설정 토큰 생성 + 메일 발송.
    _ = await _find_by_email(db, body.email.lower())
    return Response(status_code=status.HTTP_204_NO_CONTENT)
