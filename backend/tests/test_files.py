"""파일 스토리지: 검증·저장·첨부·모아보기 테스트."""

from collections.abc import AsyncIterator
from io import BytesIO

import pytest
from httpx import AsyncClient
from PIL import Image

from app.ai.streaming import get_reply_streamer
from app.core.errors import AppError
from app.core.storage import image_max_bytes, save_upload
from app.main import app


def _png_bytes(color=(255, 0, 0)) -> bytes:
    buf = BytesIO()
    Image.new("RGB", (12, 12), color).save(buf, format="PNG")
    return buf.getvalue()


PDF_BYTES = b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF"


async def _token(client: AsyncClient, email: str = "a@b.com") -> str:
    res = await client.post(
        "/api/auth/signup",
        json={"nickname": "지수", "email": email, "password": "password123"},
    )
    return res.json()["accessToken"]


def _h(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ── 스토리지 코어 (단위) ──


def test_save_png_makes_image_and_thumb():
    saved = save_upload(
        _png_bytes(), "photo.png", allowed_exts={"png"}, max_bytes=image_max_bytes()
    )
    assert saved.kind == "image"
    assert saved.url.startswith("http://test/static/")
    assert saved.thumb_url is not None
    assert saved.display_name == "photo.png"


def test_save_pdf_is_file_no_thumb():
    saved = save_upload(PDF_BYTES, "note.pdf", allowed_exts={"pdf"}, max_bytes=1_000_000)
    assert saved.kind == "file"
    assert saved.thumb_url is None


def test_reject_oversize():
    with pytest.raises(AppError) as e:
        save_upload(_png_bytes(), "x.png", allowed_exts={"png"}, max_bytes=5)
    assert e.value.code == "FILE_TOO_LARGE"


def test_reject_unsupported_by_magic():
    # 확장자만 png 인 실행 파일 바이트 → 매직 넘버 불일치
    with pytest.raises(AppError) as e:
        save_upload(b"MZ\x00\x01rubbish", "evil.png", allowed_exts={"png"}, max_bytes=1_000_000)
    assert e.value.code == "UNSUPPORTED_FILE"


def test_reject_not_in_allowed():
    # 실제 PDF 지만 허용 목록에 없으면 거부
    with pytest.raises(AppError) as e:
        save_upload(PDF_BYTES, "n.pdf", allowed_exts={"png"}, max_bytes=1_000_000)
    assert e.value.code == "UNSUPPORTED_FILE"


# ── 채팅 첨부 · 모아보기 (통합) ──


class _Fake:
    async def stream(self, *, dispatch=None, **_) -> AsyncIterator[str]:
        yield "받았어!"


async def _make_goal(client: AsyncClient, token: str) -> str:
    res = await client.post("/api/goals", headers=_h(token), data={"name": "Buddy", "title": "T"})
    return res.json()["id"]


async def test_chat_image_attachment(client: AsyncClient):
    app.dependency_overrides[get_reply_streamer] = lambda: _Fake()
    try:
        token = await _token(client)
        goal_id = await _make_goal(client, token)

        res = await client.post(
            f"/api/goals/{goal_id}/messages",
            headers=_h(token),
            data={"content": "이 사진 봐줘"},
            files={"file": ("photo.png", _png_bytes(), "image/png")},
        )
        assert res.status_code == 200

        # 메시지에 file 이 붙는다
        msgs = (await client.get(f"/api/goals/{goal_id}/messages", headers=_h(token))).json()
        user_msg = next(m for m in msgs["messages"] if m["role"] == "user")
        assert user_msg["file"]["name"] == "photo.png"
        assert user_msg["file"]["url"].startswith("http://test/static/")

        # 모아보기(사진)에 뜬다 — url 은 썸네일
        imgs = await client.get(
            f"/api/goals/{goal_id}/attachments", headers=_h(token), params={"kind": "image"}
        )
        body = imgs.json()
        assert len(body) == 1
        assert body[0]["kind"] == "image"
        assert body[0]["name"] == "photo.png"
        assert "thumb_" in body[0]["url"]

        # 문서 탭은 비어 있음
        files = await client.get(
            f"/api/goals/{goal_id}/attachments", headers=_h(token), params={"kind": "file"}
        )
        assert files.json() == []
    finally:
        app.dependency_overrides.pop(get_reply_streamer, None)


async def test_chat_pdf_attachment(client: AsyncClient):
    app.dependency_overrides[get_reply_streamer] = lambda: _Fake()
    try:
        token = await _token(client)
        goal_id = await _make_goal(client, token)

        res = await client.post(
            f"/api/goals/{goal_id}/messages",
            headers=_h(token),
            files={"file": ("note.pdf", PDF_BYTES, "application/pdf")},
        )
        assert res.status_code == 200

        files = await client.get(
            f"/api/goals/{goal_id}/attachments", headers=_h(token), params={"kind": "file"}
        )
        body = files.json()
        assert len(body) == 1
        assert body[0]["name"] == "note.pdf"
    finally:
        app.dependency_overrides.pop(get_reply_streamer, None)


async def test_chat_rejects_unsupported(client: AsyncClient):
    app.dependency_overrides[get_reply_streamer] = lambda: _Fake()
    try:
        token = await _token(client)
        goal_id = await _make_goal(client, token)
        res = await client.post(
            f"/api/goals/{goal_id}/messages",
            headers=_h(token),
            files={"file": ("evil.png", b"MZ\x00rubbish", "image/png")},
        )
        assert res.status_code == 422
        assert res.json()["code"] == "UNSUPPORTED_FILE"
    finally:
        app.dependency_overrides.pop(get_reply_streamer, None)


async def test_attachments_invalid_kind(client: AsyncClient):
    token = await _token(client)
    goal_id = await _make_goal(client, token)
    res = await client.get(
        f"/api/goals/{goal_id}/attachments", headers=_h(token), params={"kind": "video"}
    )
    assert res.status_code == 422
    assert res.json()["code"] == "INVALID_KIND"


# ── 목표·프로필 이미지 ──


async def test_create_goal_with_image(client: AsyncClient):
    token = await _token(client)
    res = await client.post(
        "/api/goals",
        headers=_h(token),
        data={"name": "Buddy", "title": "T"},
        files={"image": ("avatar.png", _png_bytes(), "image/png")},
    )
    assert res.status_code == 201
    assert res.json()["imageUrl"].startswith("http://test/static/")


async def test_update_profile_image_multipart(client: AsyncClient):
    token = await _token(client)
    res = await client.patch(
        "/api/me",
        headers=_h(token),
        data={"nickname": "새이름"},
        files={"image": ("me.png", _png_bytes(), "image/png")},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["nickname"] == "새이름"
    assert body["imageUrl"].startswith("http://test/static/")
