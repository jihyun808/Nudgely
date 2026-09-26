"""목표(=채팅방) · 메시지 흐름 테스트."""

import base64
from datetime import UTC, datetime, timedelta

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.models.goal import Message
from tests.helpers import auth, create_goal, token_for

# 1x1 PNG (multipart 경로 확인용)
_PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
)


async def _create_goal(client: AsyncClient, token: str, **form) -> dict:
    data = {"name": "Buddy", "title": "UI/UX 강의 완주", "prompt": "친절하게", **form}
    res = await client.post("/api/goals", headers=auth(token), data=data)
    return res


async def test_create_goal(client: AsyncClient):
    token = await token_for(client)
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
    token = await token_for(client)
    res = await client.post("/api/goals", headers=auth(token), data={"name": ""})
    assert res.status_code == 422


async def test_invalid_persona_rejected(client: AsyncClient):
    token = await token_for(client)
    res = await _create_goal(client, token, persona="robot")
    assert res.status_code == 422
    assert res.json()["code"] == "INVALID_PERSONA"


async def test_list_excludes_hidden_and_completed_filter(client: AsyncClient):
    token = await token_for(client)
    g1 = (await _create_goal(client, token, name="A")).json()
    g2 = (await _create_goal(client, token, name="B")).json()

    # g2 숨김
    await client.patch(f"/api/goals/{g2['id']}", headers=auth(token), json={"isHidden": True})

    base = await client.get("/api/goals", headers=auth(token))
    ids = [g["id"] for g in base.json()]
    assert g1["id"] in ids and g2["id"] not in ids

    hidden = await client.get("/api/goals", headers=auth(token), params={"hidden": True})
    assert [g["id"] for g in hidden.json()] == [g2["id"]]

    # g1 완료 → completed 필터에만 등장
    await client.post(f"/api/goals/{g1['id']}/complete", headers=auth(token))
    completed = await client.get("/api/goals", headers=auth(token), params={"completed": True})
    comp_ids = [g["id"] for g in completed.json()]
    assert g1["id"] in comp_ids
    assert completed.json()[0]["completedAt"] is not None


async def test_goal_isolation_between_users(client: AsyncClient):
    t1 = await token_for(client, "u1@b.com")
    t2 = await token_for(client, "u2@b.com")
    g = (await _create_goal(client, t1)).json()

    # 남의 목표는 404
    res = await client.get(f"/api/goals/{g['id']}", headers=auth(t2))
    assert res.status_code == 404
    assert res.json()["code"] == "GOAL_NOT_FOUND"


async def test_update_and_detail(client: AsyncClient):
    token = await token_for(client)
    g = (await _create_goal(client, token)).json()

    patched = await client.patch(
        f"/api/goals/{g['id']}",
        headers=auth(token),
        json={"title": "새 목표", "dueDate": "2026-12-31", "isNotificationMuted": True},
    )
    assert patched.status_code == 200
    d = patched.json()
    assert d["title"] == "새 목표"
    assert d["dueDate"] == "2026-12-31"
    assert d["isNotificationMuted"] is True
    assert d["remainingDays"] is not None


async def test_delete_goal(client: AsyncClient):
    token = await token_for(client)
    g = (await _create_goal(client, token)).json()
    res = await client.delete(f"/api/goals/{g['id']}", headers=auth(token))
    assert res.status_code == 204
    assert (await client.get(f"/api/goals/{g['id']}", headers=auth(token))).status_code == 404


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
    token = await token_for(client)
    g = (await _create_goal(client, token)).json()
    ids = await _seed_messages(session_factory, g["id"], 5)  # ids[0]=가장 오래됨

    # 첫 페이지: 최신 2개 (역순으로 최신 먼저)
    first = await client.get(
        f"/api/goals/{g['id']}/messages", headers=auth(token), params={"limit": 2}
    )
    body = first.json()
    assert [m["content"] for m in body["messages"]] == ["메시지 4", "메시지 3"]
    # nextCursor 는 이번 페이지에서 가장 오래된 메시지(메시지 3)의 id
    assert body["nextCursor"] == ids[3]

    # 다음 페이지: 커서보다 과거
    second = await client.get(
        f"/api/goals/{g['id']}/messages",
        headers=auth(token),
        params={"limit": 2, "cursor": body["nextCursor"]},
    )
    b2 = second.json()
    assert [m["content"] for m in b2["messages"]] == ["메시지 2", "메시지 1"]
    assert b2["nextCursor"] == ids[1]

    # 마지막 페이지: 하나 남고 더 없음
    third = await client.get(
        f"/api/goals/{g['id']}/messages",
        headers=auth(token),
        params={"limit": 2, "cursor": b2["nextCursor"]},
    )
    b3 = third.json()
    assert [m["content"] for m in b3["messages"]] == ["메시지 0"]
    assert b3["nextCursor"] is None


async def test_unread_count_and_read(client: AsyncClient, session_factory):
    token = await token_for(client)
    g = (await _create_goal(client, token)).json()
    await _seed_messages(session_factory, g["id"], 5)  # assistant: 0,2,4 → 3개

    listed = await client.get("/api/goals", headers=auth(token))
    goal = next(x for x in listed.json() if x["id"] == g["id"])
    assert goal["unreadCount"] == 3
    assert goal["lastMessage"] == "메시지 4"

    # 읽음 처리 후 0
    assert (await client.post(f"/api/goals/{g['id']}/read", headers=auth(token))).status_code == 204
    listed2 = await client.get("/api/goals", headers=auth(token))
    goal2 = next(x for x in listed2.json() if x["id"] == g["id"])
    assert goal2["unreadCount"] == 0


async def test_clear_messages(client: AsyncClient, session_factory):
    token = await token_for(client)
    g = (await _create_goal(client, token)).json()
    await _seed_messages(session_factory, g["id"], 3)

    assert (
        await client.delete(f"/api/goals/{g['id']}/messages", headers=auth(token))
    ).status_code == 204

    got = await client.get(f"/api/goals/{g['id']}/messages", headers=auth(token))
    assert got.json()["messages"] == []
    assert got.json()["nextCursor"] is None


async def test_due_date_set_and_clear(client: AsyncClient):
    """기한은 None 이 '지움'. 보내지 않은 것과 구분해야 한다."""
    token = await token_for(client)
    goal_id = (await client.post("/api/goals", headers=auth(token), data={"name": "Buddy"})).json()[
        "id"
    ]

    res = await client.patch(
        f"/api/goals/{goal_id}", headers=auth(token), json={"dueDate": "2026-12-01"}
    )
    assert res.json()["dueDate"] == "2026-12-01"

    # 다른 필드만 보내면 기한은 그대로
    res = await client.patch(f"/api/goals/{goal_id}", headers=auth(token), json={"title": "T"})
    assert res.json()["dueDate"] == "2026-12-01"

    # null 을 보내면 지워진다
    res = await client.patch(f"/api/goals/{goal_id}", headers=auth(token), json={"dueDate": None})
    assert res.json()["dueDate"] is None


async def test_due_date_clear_via_form(client: AsyncClient):
    """폼(urlencoded·multipart)에서 날짜를 비워 보내면 기한이 지워진다."""
    token = await token_for(client)
    goal_id = (await client.post("/api/goals", headers=auth(token), data={"name": "Buddy"})).json()[
        "id"
    ]
    await client.patch(f"/api/goals/{goal_id}", headers=auth(token), json={"dueDate": "2026-12-01"})

    res = await client.patch(f"/api/goals/{goal_id}", headers=auth(token), data={"dueDate": ""})
    assert res.status_code == 200
    assert res.json()["dueDate"] is None

    # multipart(사진과 함께 보내는 경로)도 같아야 한다
    await client.patch(f"/api/goals/{goal_id}", headers=auth(token), json={"dueDate": "2026-12-01"})
    res = await client.patch(
        f"/api/goals/{goal_id}",
        headers=auth(token),
        data={"dueDate": ""},
        files={"image": ("cover.png", _PNG, "image/png")},
    )
    assert res.status_code == 200
    assert res.json()["dueDate"] is None
    assert res.json()["imageUrl"].startswith("http://test/static/")


async def test_patch_validation_errors_are_422_not_500(client: AsyncClient):
    """라우터가 손으로 검증하는 본문도 422 로 떨어져야 한다(전에는 500)."""
    token = await token_for(client)
    goal_id = (await client.post("/api/goals", headers=auth(token), data={"name": "Buddy"})).json()[
        "id"
    ]

    for payload in ({"name": ""}, {"name": "가나다라마바사아자차카"}, {"dueDate": "잘못된날짜"}):
        res = await client.patch(f"/api/goals/{goal_id}", headers=auth(token), json=payload)
        assert res.status_code == 422, payload
        assert res.json()["code"] == "VALIDATION_ERROR"

    # 프로필도 같은 경로(손 파싱)라 함께 확인한다
    res = await client.patch(
        "/api/me", headers=auth(token), json={"nickname": "가나다라마바사아자차카"}
    )
    assert res.status_code == 422
    assert res.json()["code"] == "VALIDATION_ERROR"


async def test_broken_json_body_is_400_not_500(client: AsyncClient):
    token = await token_for(client)
    goal_id = (await client.post("/api/goals", headers=auth(token), data={"name": "Buddy"})).json()[
        "id"
    ]
    res = await client.patch(
        f"/api/goals/{goal_id}",
        headers={**auth(token), "Content-Type": "application/json"},
        content=b"{not json",
    )
    assert res.status_code == 400
    assert res.json()["code"] == "INVALID_JSON"


async def test_persona_can_be_changed_and_cleared(client: AsyncClient):
    """AI 성격은 개설 뒤에도 설정 화면에서 바꿀 수 있어야 한다.

    null 로 비우는 것도 된다 — is not None 으로만 보면 '선택 안 함' 이 먹지 않는다.
    """
    token = await token_for(client)
    goal_id = create_goal_id = (
        await client.post("/api/goals", headers=auth(token), data={"name": "Buddy", "title": "T"})
    ).json()["id"]
    assert create_goal_id

    changed = await client.patch(
        f"/api/goals/{goal_id}", headers=auth(token), json={"persona": "instructor"}
    )
    assert changed.json()["persona"] == "instructor"

    cleared = await client.patch(
        f"/api/goals/{goal_id}", headers=auth(token), json={"persona": None}
    )
    assert cleared.json()["persona"] is None


async def test_unknown_persona_is_rejected(client: AsyncClient):
    token = await token_for(client)
    goal_id = (
        await client.post("/api/goals", headers=auth(token), data={"name": "Buddy", "title": "T"})
    ).json()["id"]

    res = await client.patch(f"/api/goals/{goal_id}", headers=auth(token), json={"persona": "해적"})
    assert res.status_code in (400, 422)


async def test_persona_can_be_cleared_via_form(client: AsyncClient):
    """사진과 함께 저장할 때도 '선택 안 함'이 먹어야 한다.

    폼은 null 을 실을 수 없어 빈 문자열로 온다. 그걸 '지움'으로 읽지 않으면
    새 사진과 함께 저장하는 순간에만 조용히 성격이 남는다.
    """
    token = await token_for(client)
    goal_id = (
        await client.post("/api/goals", headers=auth(token), data={"name": "Buddy", "title": "T"})
    ).json()["id"]
    await client.patch(f"/api/goals/{goal_id}", headers=auth(token), json={"persona": "teacher"})

    res = await client.patch(
        f"/api/goals/{goal_id}", headers=auth(token), data={"persona": "", "name": "Buddy"}
    )

    assert res.status_code == 200
    assert res.json()["persona"] is None


async def test_progress_can_be_edited_by_user(client: AsyncClient):
    """AI 가 잘못 세운 진도를 사용자가 바로잡을 수 있어야 한다.

    실제로 '24개 중 1개' 인데 4로 저장된 적이 있었고, 그때는 고칠 길이 없었다.
    """
    token = await token_for(client)
    goal_id = await create_goal(client, token)

    res = await client.patch(
        f"/api/goals/{goal_id}",
        headers=auth(token),
        json={"progress": {"current": 1, "total": 24, "unit": "소주제"}},
    )

    assert res.status_code == 200
    assert res.json()["progress"] == {"current": 1, "total": 24, "unit": "소주제"}


async def test_edited_progress_is_clamped(client: AsyncClient):
    """전체보다 큰 값을 넣어도 서버가 자른다(AI 경로와 같은 규칙)."""
    token = await token_for(client)
    goal_id = await create_goal(client, token)

    res = await client.patch(
        f"/api/goals/{goal_id}",
        headers=auth(token),
        json={"progress": {"current": 99, "total": 24, "unit": "소주제"}},
    )

    assert res.json()["progress"]["current"] == 24


async def test_editing_progress_moves_milestones(
    client: AsyncClient, session_factory: async_sessionmaker
):
    """직접 고친 진도도 로드맵 단계에 반영돼야 한다(AI 가 고칠 때와 같이)."""
    from sqlalchemy import select

    from app.models.goal import Goal
    from app.models.milestone import Milestone
    from app.services.progress_service import set_milestones

    token = await token_for(client)
    goal_id = await create_goal(client, token)
    async with session_factory() as db:
        goal = await db.get(Goal, goal_id)
        await set_milestones(db, goal, [{"title": f"{i}장"} for i in range(1, 5)])
        await db.commit()

    await client.patch(
        f"/api/goals/{goal_id}",
        headers=auth(token),
        json={"progress": {"current": 12, "total": 24, "unit": "소주제"}},
    )

    async with session_factory() as db:
        rows = await db.execute(
            select(Milestone).where(Milestone.goal_id == goal_id).order_by(Milestone.order)
        )
        statuses = [m.status for m in rows.scalars().all()]
    assert statuses == ["done", "done", "current", "upcoming"]
