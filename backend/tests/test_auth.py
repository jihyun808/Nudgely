"""인증 · 프로필 · 설정 흐름 테스트."""

from httpx import AsyncClient

SIGNUP = {"nickname": "지수", "email": "a@b.com", "password": "password123"}


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


async def test_email_available(client: AsyncClient):
    before = await client.get("/api/auth/email-available", params={"email": "a@b.com"})
    assert before.json()["isAvailable"] is True

    await _signup(client)

    after = await client.get("/api/auth/email-available", params={"email": "a@b.com"})
    assert after.json()["isAvailable"] is False


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
        json={"nickname": "새이름", "imageUrl": "https://cdn/x.png"},
    )
    assert patched.status_code == 200
    assert patched.json()["nickname"] == "새이름"
    assert patched.json()["imageUrl"] == "https://cdn/x.png"


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
    assert ok.status_code == 204

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
