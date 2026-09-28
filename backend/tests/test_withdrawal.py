"""회원 탈퇴 시 데이터 파기 (이용약관 §14, 개인정보 보호법 §21).

탈퇴하면 로그인만 막는 게 아니라 **딸린 데이터와 업로드 파일까지 지워져야** 한다.
예전에는 deleted_at 만 찍는 소프트 삭제라 목표·대화·기록이 그대로 남아 있었다.
"""

from collections.abc import AsyncIterator
from io import BytesIO

from httpx import AsyncClient
from PIL import Image
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.ai.streaming import get_reply_streamer
from app.core.storage import storage_root
from app.main import app
from app.models.attachment import Attachment
from app.models.goal import Goal, Message
from app.models.user import User
from tests.helpers import auth, create_goal, token_for


def _png() -> bytes:
    buf = BytesIO()
    Image.new("RGB", (12, 12), (0, 120, 255)).save(buf, format="PNG")
    return buf.getvalue()


class _FakeStreamer:
    async def stream(self, **_) -> AsyncIterator[str]:
        yield "좋아"


async def _count(session_factory: async_sessionmaker, model) -> int:
    async with session_factory() as s:
        return (await s.execute(select(func.count()).select_from(model))).scalar_one()


async def _seed(client: AsyncClient, token: str) -> str:
    """목표 + 대화 + 첨부를 만들어 둔다."""
    goal_id = await create_goal(client, token)
    app.dependency_overrides[get_reply_streamer] = lambda: _FakeStreamer()
    try:
        await client.post(
            f"/api/goals/{goal_id}/messages",
            headers=auth(token),
            data={"content": "인증샷"},
            files={"file": ("proof.png", _png(), "image/png")},
        )
    finally:
        app.dependency_overrides.pop(get_reply_streamer, None)
    return goal_id


async def test_withdrawal_removes_rows(client: AsyncClient, session_factory: async_sessionmaker):
    token = await token_for(client, "bye@b.com")
    await _seed(client, token)

    assert await _count(session_factory, Goal) == 1
    assert await _count(session_factory, Message) > 0
    assert await _count(session_factory, Attachment) == 1

    assert (await client.delete("/api/me", headers=auth(token))).status_code == 204

    # users 를 지우면 FK CASCADE 로 전부 따라 지워진다
    assert await _count(session_factory, User) == 0
    assert await _count(session_factory, Goal) == 0
    assert await _count(session_factory, Message) == 0
    assert await _count(session_factory, Attachment) == 0


async def test_withdrawal_removes_uploaded_files(
    client: AsyncClient, session_factory: async_sessionmaker
):
    """DB 행은 CASCADE 로 지워지지만 디스크 파일은 따로 지워야 한다."""
    token = await token_for(client, "bye@b.com")
    await _seed(client, token)

    async with session_factory() as s:
        attachment = (await s.execute(select(Attachment))).scalars().one()
        names = [attachment.url.rsplit("/", 1)[-1]]
        if attachment.thumb_url:
            names.append(attachment.thumb_url.rsplit("/", 1)[-1])

    root = storage_root()
    assert all((root / n).exists() for n in names), "업로드 파일이 저장되지 않았다"

    await client.delete("/api/me", headers=auth(token))

    left = [n for n in names if (root / n).exists()]
    assert left == [], f"디스크에 파일이 남았다: {left}"


async def test_withdrawal_keeps_other_users_data(
    client: AsyncClient, session_factory: async_sessionmaker
):
    """한 명이 나간다고 남의 데이터가 지워지면 안 된다."""
    leaving = await token_for(client, "bye@b.com")
    staying = await token_for(client, "stay@b.com")
    await _seed(client, leaving)
    await _seed(client, staying)

    await client.delete("/api/me", headers=auth(leaving))

    assert await _count(session_factory, User) == 1
    assert await _count(session_factory, Goal) == 1
    assert await _count(session_factory, Attachment) == 1
    # 남은 사람은 그대로 쓸 수 있다
    assert (await client.get("/api/me", headers=auth(staying))).status_code == 200


async def test_withdrawal_leaves_no_soft_deleted_row(
    client: AsyncClient, session_factory: async_sessionmaker
):
    """행을 남겨두고 로그인만 막는 방식이면 '파기한다' 는 약관과 어긋난다."""
    token = await token_for(client, "bye@b.com")
    await client.delete("/api/me", headers=auth(token))

    async with session_factory() as s:
        assert (await s.execute(select(User))).scalars().all() == []


async def test_withdrawal_without_any_data_works(client: AsyncClient):
    """가입만 하고 아무것도 안 한 계정도 문제없이 나간다."""
    token = await token_for(client, "empty@b.com")
    assert (await client.delete("/api/me", headers=auth(token))).status_code == 204
