"""목표(=채팅방) · 메시지 흐름 테스트."""

from datetime import UTC, datetime, timedelta

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.models.goal import Message


async def _token(client: AsyncClient, email: str = "a@b.com") -> str:
    res = await client.post(
        "/api/auth/signup",
        json={"nickname": "지수", "email": email, "password": "password123"},
    )
    return res.json()["accessToken"]


def _h(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


async def _create_goal(client: AsyncClient, token: str, **form) -> dict:
    data = {"name": "Buddy", "title": "UI/UX 강의 완주", "prompt": "친절하게", **form}
    res = await client.post("/api/goals", headers=_h(token), data=data)
    return res


async def test_create_goal(client: AsyncClient):
    token = await _token(client)
    res = await _create_goal(client, token)
    assert res.status_code == 201
    g = res.json()
    assert g["id"].startswith("g_")
    assert g["name"] == "Buddy"
    assert g["title"] == "UI/UX 강의 완주"
    assert g["unreadCount"] == 0
    assert g["startedAt"] is not None
    # 대화 전이라 안내 문구
    assert "목표" in g["lastMessage"] or g["lastMessage"]
    assert g["isHidden"] is False


async def test_create_goal_requires_name(client: AsyncClient):
    token = await _token(client)
    res = await client.post("/api/goals", headers=_h(token), data={"name": ""})
    assert res.status_code == 422


async def test_invalid_persona_rejected(client: AsyncClient):
    token = await _token(client)
    res = await _create_goal(client, token, persona="robot")
    assert res.status_code == 422
    assert res.json()["code"] == "INVALID_PERSONA"


async def test_list_excludes_hidden_and_completed_filter(client: AsyncClient):
    token = await _token(client)
    g1 = (await _create_goal(client, token, name="A")).json()
    g2 = (await _create_goal(client, token, name="B")).json()

    # g2 숨김
    await client.patch(f"/api/goals/{g2['id']}", headers=_h(token), json={"isHidden": True})

    base = await client.get("/api/goals", headers=_h(token))
    ids = [g["id"] for g in base.json()]
    assert g1["id"] in ids and g2["id"] not in ids

    hidden = await client.get("/api/goals", headers=_h(token), params={"hidden": True})
    assert [g["id"] for g in hidden.json()] == [g2["id"]]

    # g1 완료 → completed 필터에만 등장
    await client.post(f"/api/goals/{g1['id']}/complete", headers=_h(token))
    completed = await client.get("/api/goals", headers=_h(token), params={"completed": True})
    comp_ids = [g["id"] for g in completed.json()]
    assert g1["id"] in comp_ids
    assert completed.json()[0]["completedAt"] is not None


async def test_goal_isolation_between_users(client: AsyncClient):
    t1 = await _token(client, "u1@b.com")
    t2 = await _token(client, "u2@b.com")
    g = (await _create_goal(client, t1)).json()

    # 남의 목표는 404
    res = await client.get(f"/api/goals/{g['id']}", headers=_h(t2))
    assert res.status_code == 404
    assert res.json()["code"] == "GOAL_NOT_FOUND"


async def test_update_and_detail(client: AsyncClient):
    token = await _token(client)
    g = (await _create_goal(client, token)).json()

    patched = await client.patch(
        f"/api/goals/{g['id']}",
        headers=_h(token),
        json={"title": "새 목표", "dueDate": "2026-12-31", "isNotificationMuted": True},
    )
    assert patched.status_code == 200
    d = patched.json()
    assert d["title"] == "새 목표"
    assert d["dueDate"] == "2026-12-31"
    assert d["isNotificationMuted"] is True
    assert d["remainingDays"] is not None


async def test_delete_goal(client: AsyncClient):
    token = await _token(client)
    g = (await _create_goal(client, token)).json()
    res = await client.delete(f"/api/goals/{g['id']}", headers=_h(token))
    assert res.status_code == 204
    assert (await client.get(f"/api/goals/{g['id']}", headers=_h(token))).status_code == 404


async def _seed_messages(session_factory: async_sessionmaker, goal_id: str, n: int) -> list[str]:
    """오래된 것 → 최신 순으로 n개 메시지를 심는다. 반환은 그 순서의 id 목록."""
    base = datetime(2026, 8, 1, tzinfo=UTC)
    ids: list[str] = []
    async with session_factory() as s:
        for i in range(n):
            role = "assistant" if i % 2 == 0 else "user"
            m = Message(
                goal_id=goal_id,
                role=role,
                content=f"메시지 {i}",
                created_at=base + timedelta(minutes=i),
            )
            s.add(m)
            await s.flush()
            ids.append(m.id)
        await s.commit()
    return ids


async def test_messages_pagination(client: AsyncClient, session_factory):
    token = await _token(client)
    g = (await _create_goal(client, token)).json()
    ids = await _seed_messages(session_factory, g["id"], 5)  # ids[0]=가장 오래됨

    # 첫 페이지: 최신 2개 (역순으로 최신 먼저)
    first = await client.get(
        f"/api/goals/{g['id']}/messages", headers=_h(token), params={"limit": 2}
    )
    body = first.json()
    assert [m["content"] for m in body["messages"]] == ["메시지 4", "메시지 3"]
    # nextCursor 는 이번 페이지에서 가장 오래된 메시지(메시지 3)의 id
    assert body["nextCursor"] == ids[3]

    # 다음 페이지: 커서보다 과거
    second = await client.get(
        f"/api/goals/{g['id']}/messages",
        headers=_h(token),
        params={"limit": 2, "cursor": body["nextCursor"]},
    )
    b2 = second.json()
    assert [m["content"] for m in b2["messages"]] == ["메시지 2", "메시지 1"]
    assert b2["nextCursor"] == ids[1]

    # 마지막 페이지: 하나 남고 더 없음
    third = await client.get(
        f"/api/goals/{g['id']}/messages",
        headers=_h(token),
        params={"limit": 2, "cursor": b2["nextCursor"]},
    )
    b3 = third.json()
    assert [m["content"] for m in b3["messages"]] == ["메시지 0"]
    assert b3["nextCursor"] is None


async def test_unread_count_and_read(client: AsyncClient, session_factory):
    token = await _token(client)
    g = (await _create_goal(client, token)).json()
    await _seed_messages(session_factory, g["id"], 5)  # assistant: 0,2,4 → 3개

    listed = await client.get("/api/goals", headers=_h(token))
    goal = next(x for x in listed.json() if x["id"] == g["id"])
    assert goal["unreadCount"] == 3
    assert goal["lastMessage"] == "메시지 4"

    # 읽음 처리 후 0
    assert (await client.post(f"/api/goals/{g['id']}/read", headers=_h(token))).status_code == 204
    listed2 = await client.get("/api/goals", headers=_h(token))
    goal2 = next(x for x in listed2.json() if x["id"] == g["id"])
    assert goal2["unreadCount"] == 0


async def test_clear_messages(client: AsyncClient, session_factory):
    token = await _token(client)
    g = (await _create_goal(client, token)).json()
    await _seed_messages(session_factory, g["id"], 3)

    assert (
        await client.delete(f"/api/goals/{g['id']}/messages", headers=_h(token))
    ).status_code == 204

    got = await client.get(f"/api/goals/{g['id']}/messages", headers=_h(token))
    assert got.json()["messages"] == []
    assert got.json()["nextCursor"] is None
