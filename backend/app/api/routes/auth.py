"""인증 엔드포인트 (api.md §2).

    POST /api/auth/signup          회원가입 (즉시 로그인)
    POST /api/auth/login           로그인
    POST /api/auth/logout          로그아웃 (204)
    POST /api/auth/password        비밀번호 변경 (새 토큰 반환)
    POST /api/auth/password/reset  비밀번호 재설정 메일 (204)

소셜 로그인(POST /auth/social)은 카카오·구글 키 발급 후 추가 예정.

**모든 경로에 횟수 제한을 건다.** 없으면 로그인을 초당 수백 번 때릴 수 있어
흔한 비밀번호는 그대로 뚫린다. 가입 여부를 알려주던 email-available 은
없앴다 — 그 하나로 가입자 명단을 통째로 뽑을 수 있었고, signup 의 409 가
같은 일을 하므로 화면에서도 필요 없었다.
"""

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.db import get_db
from app.core.errors import AppError
from app.core.ratelimit import RateLimit
from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import User, UserSettings
from app.schemas.auth import (
    AccessTokenOut,
    AuthResult,
    ChangePasswordIn,
    LoginIn,
    PasswordResetIn,
    SignupIn,
)
from app.schemas.user import UserOut

router = APIRouter()

# 사람이 쓰는 속도와 무차별 대입 사이의 선. 오타 몇 번은 넉넉히 통과하고,
# 사전 대입은 하루에 수백 번으로 묶인다(구간마다 IP 별로 센다).
_LOGIN_LIMIT = RateLimit("login", limit=10, window_seconds=300)
_SIGNUP_LIMIT = RateLimit("signup", limit=5, window_seconds=600)
_PASSWORD_LIMIT = RateLimit("password", limit=5, window_seconds=300)


async def _find_by_email(db: AsyncSession, email: str) -> User | None:
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


def _issue(user: User) -> AuthResult:
    """사용자에게 액세스 토큰을 발급해 표준 응답으로 감싼다."""
    token = create_access_token(user.id, user.token_version)
    return AuthResult(access_token=token, user=UserOut.model_validate(user))


@router.post("/signup", response_model=AuthResult, status_code=status.HTTP_201_CREATED)
async def signup(
    body: SignupIn,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(_SIGNUP_LIMIT),
) -> AuthResult:
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
async def login(
    body: LoginIn,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(_LOGIN_LIMIT),
) -> AuthResult:
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


@router.post("/password", response_model=AccessTokenOut)
async def change_password(
    body: ChangePasswordIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _: None = Depends(_PASSWORD_LIMIT),
) -> AccessTokenOut:
    """비밀번호를 바꾸고, 이 기기에서 쓸 새 토큰을 돌려준다.

    바꾸는 순간 **다른 기기는 전부 로그아웃된다.** 기기를 잃어버렸을 때
    끊을 수 있는 유일한 방법이라 일부러 그렇게 둔다.
    """
    if not verify_password(body.current_password, user.password_hash):
        raise AppError("INVALID_PASSWORD", "현재 비밀번호가 올바르지 않습니다.", status_code=400)
    user.password_hash = hash_password(body.new_password)
    user.token_version += 1
    await db.commit()
    return AccessTokenOut(access_token=create_access_token(user.id, user.token_version))


@router.post("/password/reset", status_code=status.HTTP_204_NO_CONTENT)
async def request_password_reset(
    body: PasswordResetIn,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(_PASSWORD_LIMIT),
) -> Response:
    # 가입 여부와 무관하게 항상 204 (계정 존재 노출 방지, api.md §2).
    # TODO: 가입된 경우 일회용·짧은 만료(예: 30분) 재설정 토큰 생성 + 메일 발송.
    _ = await _find_by_email(db, body.email.lower())
    return Response(status_code=status.HTTP_204_NO_CONTENT)
