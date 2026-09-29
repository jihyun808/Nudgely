"""인증 · 프로필 · 설정 흐름 테스트."""

import pytest
from httpx import AsyncClient

from tests.helpers import CONSENTS, auth, token_for

SIGNUP = {"nickname": "지수", "email": "a@b.com", "password": "password123", **CONSENTS}


async def _signup(client: AsyncClient, **overrides) -> dict:
    body = {**SIGNUP, **overrides}
    res = await client.post("/api/auth/signup", json=body)
    return res


async def test_signup_returns_token_and_user(client: AsyncClient):
    res = await _signup(client)
    assert res.status_code == 201
    data = res.json()
    assert data["accessToken"]
    assert data["user"]["email"] == "a@b.com"
    assert data["user"]["nickname"] == "지수"
    assert data["user"]["id"].startswith("u_")


async def test_signup_duplicate_email_conflicts(client: AsyncClient):
    await _signup(client)
    res = await _signup(client)
    assert res.status_code == 409
    assert res.json()["code"] == "EMAIL_TAKEN"


async def test_signup_validates_password_length(client: AsyncClient):
    res = await _signup(client, password="short")
    assert res.status_code == 422
    assert res.json()["code"] == "VALIDATION_ERROR"


async def test_login_success_and_wrong_password(client: AsyncClient):
    await _signup(client)

    ok = await client.post("/api/auth/login", json={"email": "a@b.com", "password": "password123"})
    assert ok.status_code == 200
    assert ok.json()["accessToken"]

    bad = await client.post("/api/auth/login", json={"email": "a@b.com", "password": "wrongpass"})
    assert bad.status_code == 401
    # 계정 존재 여부를 노출하지 않는 뭉뚱그린 코드
    assert bad.json()["code"] == "INVALID_CREDENTIALS"

    missing = await client.post(
        "/api/auth/login", json={"email": "nope@b.com", "password": "password123"}
    )
    assert missing.status_code == 401
    assert missing.json()["code"] == "INVALID_CREDENTIALS"


async def test_duplicate_email_is_rejected(client: AsyncClient):
    """가입 여부를 미리 알려주던 엔드포인트는 없앴다.

    그거 하나로 가입자 명단을 통째로 뽑을 수 있었고, 화면에서도 가입 직전에
    한 번 부르는 게 전부여서 이 409 로 같은 일을 한다.
    """
    await _signup(client)

    again = await _signup(client)

    assert again.status_code == 409
    assert again.json()["code"] == "EMAIL_TAKEN"


async def test_me_requires_auth(client: AsyncClient):
    res = await client.get("/api/me")
    assert res.status_code == 401
    assert res.json()["code"] == "UNAUTHORIZED"


def _auth_header(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


async def test_me_and_profile_update(client: AsyncClient):
    token = (await _signup(client)).json()["accessToken"]

    me = await client.get("/api/me", headers=_auth_header(token))
    assert me.status_code == 200
    assert me.json()["email"] == "a@b.com"

    patched = await client.patch(
        "/api/me",
        headers=_auth_header(token),
        json={"nickname": "새이름", "imageUrl": "http://test/static/f_abc.png"},
    )
    assert patched.status_code == 200
    assert patched.json()["nickname"] == "새이름"
    assert patched.json()["imageUrl"] == "http://test/static/f_abc.png"


@pytest.mark.parametrize(
    "url",
    ["https://evil.example/x.png", "http://test/static/../secret", "javascript:alert(1)"],
)
async def test_profile_image_must_be_ours(client: AsyncClient, url: str):
    """아무 주소나 받으면 프로필 사진이 남의 서버를 가리키고,

    그 서버는 화면을 여는 사람의 IP 를 그대로 본다(추적 픽셀).
    """
    token = (await _signup(client)).json()["accessToken"]

    res = await client.patch("/api/me", headers=_auth_header(token), json={"imageUrl": url})

    assert res.status_code == 422


async def test_settings_defaults_and_patch(client: AsyncClient):
    token = (await _signup(client)).json()["accessToken"]

    got = await client.get("/api/settings", headers=_auth_header(token))
    assert got.status_code == 200
    body = got.json()
    assert body["notifications"]["enabled"] is True
    assert body["doNotDisturb"]["startHour"] == 0
    assert body["planner"]["endHour"] == 24
    assert body["linkedProviders"] == []

    patched = await client.patch(
        "/api/settings",
        headers=_auth_header(token),
        json={"notifications": {"nudge": False}, "planner": {"startHour": 8}},
    )
    assert patched.status_code == 200
    data = patched.json()
    assert data["notifications"]["nudge"] is False
    # 보내지 않은 항목은 그대로
    assert data["notifications"]["enabled"] is True
    assert data["planner"]["startHour"] == 8


async def test_change_password(client: AsyncClient):
    token = (await _signup(client)).json()["accessToken"]

    wrong = await client.post(
        "/api/auth/password",
        headers=_auth_header(token),
        json={"currentPassword": "nope12345", "newPassword": "newpass123"},
    )
    assert wrong.status_code == 400
    assert wrong.json()["code"] == "INVALID_PASSWORD"

    ok = await client.post(
        "/api/auth/password",
        headers=_auth_header(token),
        json={"currentPassword": "password123", "newPassword": "newpass123"},
    )
    # 바꾸는 순간 이미 나가 있던 토큰이 전부 죽는다. 이 기기까지 끊기면
    # 사용자에게는 버그로 보이므로 새 토큰을 돌려받는다
    assert ok.status_code == 200
    new_token = ok.json()["accessToken"]
    assert (await client.get("/api/me", headers=_auth_header(new_token))).status_code == 200

    # 바꾸기 전에 받아 둔 토큰은 더 이상 안 통한다(기기를 잃어버렸을 때 끊는 방법)
    assert (await client.get("/api/me", headers=_auth_header(token))).status_code == 401

    # 새 비밀번호로 로그인 가능
    relogin = await client.post(
        "/api/auth/login", json={"email": "a@b.com", "password": "newpass123"}
    )
    assert relogin.status_code == 200


async def test_password_reset_always_204(client: AsyncClient):
    # 가입 안 된 이메일도 동일하게 204 (계정 존재 노출 방지)
    res = await client.post("/api/auth/password/reset", json={"email": "ghost@b.com"})
    assert res.status_code == 204


async def test_delete_account_then_token_rejected(client: AsyncClient):
    token = (await _signup(client)).json()["accessToken"]

    deleted = await client.delete("/api/me", headers=_auth_header(token))
    assert deleted.status_code == 204

    # 탈퇴 후 같은 토큰은 거부된다
    me = await client.get("/api/me", headers=_auth_header(token))
    assert me.status_code == 401


# ── 탈퇴 ──


async def test_deleted_account_cannot_sign_in(client: AsyncClient):
    """탈퇴하면 기존 토큰도 재로그인도 막힌다."""
    token = await token_for(client, "bye@b.com")

    assert (await client.delete("/api/me", headers=auth(token))).status_code == 204

    # 들고 있던 토큰
    assert (await client.get("/api/me", headers=auth(token))).status_code == 401
    # 다시 로그인
    res = await client.post(
        "/api/auth/login", json={"email": "bye@b.com", "password": "password123"}
    )
    assert res.status_code == 401


async def test_email_is_free_again_after_withdrawal(client: AsyncClient):
    """마음을 바꿔 돌아올 수 있어야 한다.

    email 이 unique 라, 탈퇴한 행이 주소를 붙들고 있으면 같은 주소로 다시
    가입할 수 없다. 사용자는 '이미 사용 중인 이메일' 만 보고 영문을 모른다.
    """
    token = await token_for(client, "again@b.com")
    await client.delete("/api/me", headers=auth(token))

    res = await client.post(
        "/api/auth/signup",
        json={"nickname": "지수", "email": "again@b.com", "password": "password123", **CONSENTS},
    )

    assert res.status_code == 201
    # 예전 계정이 아니라 새 계정이다(기록이 딸려 오면 안 된다)
    assert res.json()["user"]["email"] == "again@b.com"


async def test_withdrawal_does_not_free_other_emails(client: AsyncClient):
    """비켜 주는 건 탈퇴한 사람의 자리뿐이다."""
    token = await token_for(client, "keep@b.com")
    other = await token_for(client, "other@b.com")
    await client.delete("/api/me", headers=auth(token))

    assert (await client.get("/api/me", headers=auth(other))).status_code == 200
    res = await client.post(
        "/api/auth/signup",
        json={"nickname": "지수", "email": "other@b.com", "password": "password123", **CONSENTS},
    )
    assert res.status_code == 409
