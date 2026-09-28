"""회원가입 동의 기록 (이용약관 §4).

가입 화면에 동의 UI 가 아직 없어서 동의 항목은 **선택**이다.
- 보내면 시각을 기록하고
- 명시적으로 거부(False)하면 가입을 막고
- 생략하면 그냥 통과시킨다(전환기)

프론트가 보내기 시작하면 SignupIn 의 필드를 필수로 바꾸고 마지막 관용을 없앤다.
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


async def test_omitting_consents_still_works_for_now(
    client: AsyncClient, session_factory: async_sessionmaker
):
    """프론트에 동의 UI 가 붙기 전까지는 생략해도 가입된다.

    이 테스트가 깨지면 필수로 전환된 것이다 — 프론트 배포와 맞물렸는지 확인할 것.
    """
    res = await _signup(client)
    assert res.status_code == 201

    user = await _user(session_factory)
    assert user.terms_agreed_at is None
    assert user.terms_version is None
