"""응답 시각이 ISO 8601 UTC(Z) 로 나가는지 (api.md §1).

타임존 표시가 없으면 프론트의 `new Date(...)` 가 로컬 시각으로 읽어버려
한국에서는 모든 시각이 9시간 어긋난다. 한 군데라도 빠지면 조용히 틀린 값이 보이므로
응답마다 못박아 둔다.
"""

from datetime import UTC, datetime

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.models.goal import Goal, Message
from app.schemas.common import to_utc_iso


async def _token(client: AsyncClient, email: str = "a@b.com") -> str:
    res = await client.post(
        "/api/auth/signup",
        json={"nickname": "지수", "email": email, "password": "password123"},
    )
    return res.json()["accessToken"]


def _h(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


async def _make_goal(client: AsyncClient, token: str) -> str:
    res = await client.post("/api/goals", headers=_h(token), data={"name": "Buddy", "title": "T"})
    return res.json()["id"]


def _assert_utc(value: str | None, where: str) -> None:
    assert value is not None, f"{where} 가 비어 있다"
    assert value.endswith("Z"), f"{where} 에 타임존 표시가 없다: {value}"
    # 실제로 파싱 가능한 시각이어야 한다
    datetime.fromisoformat(value.replace("Z", "+00:00"))


# ── 직렬화 함수 자체 ──


def test_to_utc_iso_marks_naive_as_utc():
    """SQLite 가 돌려주는 naive datetime 은 UTC 로 간주한다."""
    assert to_utc_iso(datetime(2026, 8, 3, 4, 12)) == "2026-08-03T04:12:00Z"


def test_to_utc_iso_converts_other_zones():
    from zoneinfo import ZoneInfo

    seoul_noon = datetime(2026, 8, 3, 12, 0, tzinfo=ZoneInfo("Asia/Seoul"))
    assert to_utc_iso(seoul_noon) == "2026-08-03T03:00:00Z"


def test_to_utc_iso_keeps_utc_as_is():
    assert to_utc_iso(datetime(2026, 8, 3, 4, 12, tzinfo=UTC)) == "2026-08-03T04:12:00Z"


# ── 실제 응답 ──


async def test_goal_timestamps_are_utc(client: AsyncClient):
    token = await _token(client)
    goal_id = await _make_goal(client, token)

    detail = (await client.get(f"/api/goals/{goal_id}", headers=_h(token))).json()
    _assert_utc(detail["lastMessageAt"], "goal.lastMessageAt")
    _assert_utc(detail["startedAt"], "goal.startedAt")

    listed = (await client.get("/api/goals", headers=_h(token))).json()[0]
    _assert_utc(listed["lastMessageAt"], "goals[].lastMessageAt")

    await client.post(f"/api/goals/{goal_id}/complete", headers=_h(token))
    completed = (await client.get(f"/api/goals/{goal_id}", headers=_h(token))).json()
    _assert_utc(completed["completedAt"], "goal.completedAt")


async def test_progress_timestamps_are_utc(client: AsyncClient):
    token = await _token(client)
    goal_id = await _make_goal(client, token)

    body = (await client.get(f"/api/goals/{goal_id}/progress", headers=_h(token))).json()
    _assert_utc(body["startedAt"], "progress.startedAt")


async def test_message_timestamps_are_utc(client: AsyncClient, session_factory: async_sessionmaker):
    token = await _token(client)
    goal_id = await _make_goal(client, token)

    async with session_factory() as s:
        goal = await s.get(Goal, goal_id)
        s.add(Message(goal_id=goal.id, role="assistant", content="안녕"))
        await s.commit()

    page = (await client.get(f"/api/goals/{goal_id}/messages", headers=_h(token))).json()
    _assert_utc(page["messages"][0]["createdAt"], "message.createdAt")


async def test_home_and_notification_timestamps_are_utc(
    client: AsyncClient, session_factory: async_sessionmaker
):
    from app.services.notification_service import create_notification

    token = await _token(client)
    goal_id = await _make_goal(client, token)

    async with session_factory() as s:
        goal = await s.get(Goal, goal_id)
        s.add(Message(goal_id=goal.id, role="assistant", content="오늘 5강 남았어!"))
        await create_notification(
            s, goal.user_id, ntype="todoAdded", title="Buddy", body="새 할 일"
        )
        await s.commit()

    previews = (await client.get("/api/home/previews", headers=_h(token))).json()
    _assert_utc(previews[0]["receivedAt"], "preview.receivedAt")

    notifs = (await client.get("/api/notifications", headers=_h(token))).json()
    _assert_utc(notifs[0]["createdAt"], "notification.createdAt")


async def test_sse_done_created_at_is_utc(client: AsyncClient):
    """SSE 의 done 은 스키마를 안 거치고 직접 만드는 곳이라 따로 확인한다."""
    import json
    from collections.abc import AsyncIterator

    from app.ai.streaming import get_reply_streamer
    from app.main import app

    class _FakeStreamer:
        async def stream(self, **_) -> AsyncIterator[str]:
            yield "좋아"

    app.dependency_overrides[get_reply_streamer] = lambda: _FakeStreamer()
    try:
        token = await _token(client)
        goal_id = await _make_goal(client, token)
        res = await client.post(
            f"/api/goals/{goal_id}/messages", headers=_h(token), json={"content": "안녕"}
        )

        done = None
        for block in res.text.strip().split("\n\n"):
            if block.startswith("event: done"):
                done = json.loads(block.split("data: ", 1)[1])
        assert done is not None, "done 이벤트가 없다"
        _assert_utc(done["createdAt"], "sse done.createdAt")
    finally:
        app.dependency_overrides.pop(get_reply_streamer, None)


async def test_attachment_uploaded_at_is_utc(client: AsyncClient):
    import zlib

    def png() -> bytes:
        def chunk(kind: bytes, data: bytes) -> bytes:
            body = kind + data
            return len(data).to_bytes(4, "big") + body + zlib.crc32(body).to_bytes(4, "big")

        ihdr = (1).to_bytes(4, "big") + (1).to_bytes(4, "big") + bytes([8, 2, 0, 0, 0])
        return (
            b"\x89PNG\r\n\x1a\n"
            + chunk(b"IHDR", ihdr)
            + chunk(b"IDAT", zlib.compress(b"\x00\xff\xff\xff"))
            + chunk(b"IEND", b"")
        )

    from collections.abc import AsyncIterator

    from app.ai.streaming import get_reply_streamer
    from app.main import app

    class _FakeStreamer:
        async def stream(self, **_) -> AsyncIterator[str]:
            yield "확인했어"

    app.dependency_overrides[get_reply_streamer] = lambda: _FakeStreamer()
    try:
        token = await _token(client)
        goal_id = await _make_goal(client, token)
        await client.post(
            f"/api/goals/{goal_id}/messages",
            headers=_h(token),
            data={"content": "인증샷"},
            files={"file": ("proof.png", png(), "image/png")},
        )

        items = (
            await client.get(
                f"/api/goals/{goal_id}/attachments", headers=_h(token), params={"kind": "image"}
            )
        ).json()
        assert items, "첨부가 저장되지 않았다"
        _assert_utc(items[0]["uploadedAt"], "attachment.uploadedAt")
    finally:
        app.dependency_overrides.pop(get_reply_streamer, None)
