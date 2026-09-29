"""회원가입 동의 기록 (이용약관 §4).

필수 셋(약관·개인정보·만 14세)은 반드시 받아야 가입된다.
"동의를 받았다" 를 입증하려면 시각이 남아야 해서 불리언이 아니라 시각을 저장한다.
"""

from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.core.config import settings
from app.models.user import User

BASE = {"nickname": "지수", "email": "a@b.com", "password": "password123"}
ALL_AGREED = {"agreedToTerms": True, "agreedToPrivacy": True, "isOver14": True}


async def _signup(client: AsyncClient, **extra):
    return await client.post("/api/auth/signup", json={**BASE, **extra})


async def _user(session_factory: async_sessionmaker) -> User:
    async with session_factory() as s:
        return (await s.execute(select(User))).scalars().one()


async def test_consents_are_recorded_with_time_and_version(
    client: AsyncClient, session_factory: async_sessionmaker
):
    res = await _signup(client, **ALL_AGREED)
    assert res.status_code == 201, res.text

    user = await _user(session_factory)
    # 불리언이 아니라 시각을 남겨야 나중에 "언제 동의했다" 를 말할 수 있다
    assert user.terms_agreed_at is not None
    assert user.privacy_agreed_at is not None
    assert user.age_confirmed_at is not None
    # 약관 개정 시 재동의 대상을 고르려면 버전이 필요하다
    assert user.terms_version == settings.terms_version
    # 선택 항목은 안 보냈으므로 비어 있다
    assert user.marketing_agreed_at is None


async def test_marketing_consent_is_optional(
    client: AsyncClient, session_factory: async_sessionmaker
):
    res = await _signup(client, **ALL_AGREED, agreedToMarketing=True)
    assert res.status_code == 201
    assert (await _user(session_factory)).marketing_agreed_at is not None


async def test_refusing_marketing_still_allows_signup(
    client: AsyncClient, session_factory: async_sessionmaker
):
    res = await _signup(client, **ALL_AGREED, agreedToMarketing=False)
    assert res.status_code == 201
    assert (await _user(session_factory)).marketing_agreed_at is None


async def test_refusing_a_required_consent_blocks_signup(client: AsyncClient):
    for field, label in (
        ("agreedToTerms", "이용약관"),
        ("agreedToPrivacy", "개인정보 처리방침"),
        ("isOver14", "만 14세 이상"),
    ):
        res = await _signup(client, **{**ALL_AGREED, field: False})
        assert res.status_code == 400, f"{field} 거부가 막히지 않았다"
        body = res.json()
        assert body["code"] == "CONSENT_REQUIRED"
        assert label in body["message"]


async def test_under_14_cannot_sign_up(client: AsyncClient):
    """만 14세 미만은 이용할 수 없다 (개인정보 보호법 §22조의2 대응)."""
    res = await _signup(client, agreedToTerms=True, agreedToPrivacy=True, isOver14=False)
    assert res.status_code == 400
    assert res.json()["code"] == "CONSENT_REQUIRED"


async def test_refused_signup_creates_no_account(
    client: AsyncClient, session_factory: async_sessionmaker
):
    await _signup(client, **{**ALL_AGREED, "isOver14": False})
    async with session_factory() as s:
        assert (await s.execute(select(User))).scalars().all() == []


async def test_omitting_consents_is_rejected(client: AsyncClient):
    """빠뜨리고 보내면 가입되지 않는다. 동의 없이 계정이 생기면 되돌릴 수 없다."""
    res = await _signup(client)

    assert res.status_code == 422
