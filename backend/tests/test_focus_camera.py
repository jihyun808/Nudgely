"""카메라 집중 인증: 세션·샘플·점수·이탈 선톡·인증 테스트.

영상은 서버로 오지 않는다 — 상태 샘플(focus/absent)만 검증한다.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.models.goal import Message
from app.models.notification import Notification
from app.models.planner import PlannerBlock
from tests.helpers import auth, create_goal, token_for


def _samples(items: list[tuple[str, str]]) -> dict:
    """[(status, iso)] → 요청 바디."""
    return {"samples": [{"status": st, "at": at} for st, at in items]}


async def _start(client, token, *, goal_id=None, consented=True) -> dict:
    res = await client.post(
        "/api/focus/sessions/camera",
        headers=auth(token),
        json={"startedAt": "2026-10-12T10:00:00Z", "goalId": goal_id, "consented": consented},
    )
    return res


async def test_start_requires_consent(client):
    token = await token_for(client)
    res = await _start(client, token, consented=False)
    assert res.status_code == 403
    assert res.json()["code"] == "CAMERA_NOT_CONSENTED"


async def test_start_returns_session(client):
    token = await token_for(client)
    res = await _start(client, token)
    assert res.status_code == 201
    body = res.json()
    assert body["id"].startswith("fs_")
    assert body["focusScore"] == 0
    assert body["verified"] is False


async def test_checks_compute_focus_score(client):
    token = await token_for(client)
    sid = (await _start(client, token)).json()["id"]

    res = await client.post(
        f"/api/focus/sessions/{sid}/checks",
        headers=auth(token),
        json=_samples(
            [
                ("focus", "2026-10-12T10:00:00Z"),
                ("focus", "2026-10-12T10:00:30Z"),
                ("focus", "2026-10-12T10:01:00Z"),
                ("absent", "2026-10-12T10:01:30Z"),
            ]
        ),
    )
    assert res.status_code == 200
    body = res.json()
    assert body["focusScore"] == 75  # 3/4
    assert body["awayCount"] == 0


async def test_invalid_check_status(client):
    token = await token_for(client)
    sid = (await _start(client, token)).json()["id"]
    res = await client.post(
        f"/api/focus/sessions/{sid}/checks",
        headers=auth(token),
        json=_samples([("sleeping", "2026-10-12T10:00:00Z")]),
    )
    assert res.status_code == 422


async def test_away_5min_triggers_nudge(client, session_factory: async_sessionmaker):
    token = await token_for(client)
    goal_id = await create_goal(client, token)
    sid = (await _start(client, token, goal_id=goal_id)).json()["id"]

    # 5분 연속 자리 비움(마지막까지 absent) → 이탈 + 선톡
    res = await client.post(
        f"/api/focus/sessions/{sid}/checks",
        headers=auth(token),
        json=_samples(
            [
                ("focus", "2026-10-12T10:00:00Z"),
                ("absent", "2026-10-12T10:01:00Z"),
                ("absent", "2026-10-12T10:03:00Z"),
                ("absent", "2026-10-12T10:06:00Z"),  # 10:01~10:06 = 5분
            ]
        ),
    )
    assert res.json()["awayCount"] == 1

    async with session_factory() as s:
        nudges = (
            (await s.execute(select(Notification).where(Notification.type == "nudge")))
            .scalars()
            .all()
        )
        assert len(nudges) == 1
        assert nudges[0].goal_id == goal_id
        # 채팅방에도 assistant 선톡 메시지가 남는다
        msgs = (await s.execute(select(Message).where(Message.goal_id == goal_id))).scalars().all()
        assert any(m.role == "assistant" for m in msgs)


async def test_away_nudge_not_duplicated(client, session_factory: async_sessionmaker):
    token = await token_for(client)
    goal_id = await create_goal(client, token)
    sid = (await _start(client, token, goal_id=goal_id)).json()["id"]

    payload = _samples(
        [
            ("absent", "2026-10-12T10:01:00Z"),
            ("absent", "2026-10-12T10:06:00Z"),
        ]
    )
    await client.post(f"/api/focus/sessions/{sid}/checks", headers=auth(token), json=payload)
    # 같은 이탈 구간으로 또 보내도 선톡은 한 번만
    await client.post(f"/api/focus/sessions/{sid}/checks", headers=auth(token), json=payload)

    async with session_factory() as s:
        nudges = (
            (await s.execute(select(Notification).where(Notification.type == "nudge")))
            .scalars()
            .all()
        )
        assert len(nudges) == 1


async def test_finish_verified_records_planner(client, session_factory: async_sessionmaker):
    token = await token_for(client)
    goal_id = await create_goal(client, token)
    sid = (await _start(client, token, goal_id=goal_id)).json()["id"]

    # 집중 위주(점수 100) → 인증 성립
    await client.post(
        f"/api/focus/sessions/{sid}/checks",
        headers=auth(token),
        json=_samples([("focus", "2026-10-12T10:00:00Z"), ("focus", "2026-10-12T10:00:30Z")]),
    )
    res = await client.post(
        f"/api/focus/sessions/{sid}/finish", headers=auth(token), json={"seconds": 1500}
    )
    body = res.json()
    assert body["focusScore"] == 100
    assert body["verified"] is True

    async with session_factory() as s:
        verify_blocks = (
            (await s.execute(select(PlannerBlock).where(PlannerBlock.kind == "verify")))
            .scalars()
            .all()
        )
        assert len(verify_blocks) == 1
        assert verify_blocks[0].goal_id == goal_id


async def test_finish_low_score_not_verified(client, session_factory: async_sessionmaker):
    token = await token_for(client)
    sid = (await _start(client, token)).json()["id"]

    # 자리 비움 위주(점수 25) → 인증 실패
    await client.post(
        f"/api/focus/sessions/{sid}/checks",
        headers=auth(token),
        json=_samples(
            [
                ("focus", "2026-10-12T10:00:00Z"),
                ("absent", "2026-10-12T10:00:30Z"),
                ("absent", "2026-10-12T10:01:00Z"),
                ("absent", "2026-10-12T10:01:30Z"),
            ]
        ),
    )
    res = await client.post(
        f"/api/focus/sessions/{sid}/finish", headers=auth(token), json={"seconds": 1500}
    )
    assert res.json()["verified"] is False

    async with session_factory() as s:
        verify_blocks = (
            (await s.execute(select(PlannerBlock).where(PlannerBlock.kind == "verify")))
            .scalars()
            .all()
        )
        assert verify_blocks == []


async def test_session_isolated_by_user(client):
    t1 = await token_for(client, "u1@b.com")
    t2 = await token_for(client, "u2@b.com")
    sid = (await _start(client, t1)).json()["id"]

    res = await client.post(
        f"/api/focus/sessions/{sid}/checks",
        headers=auth(t2),
        json=_samples([("focus", "2026-10-12T10:00:00Z")]),
    )
    assert res.status_code == 404
    assert res.json()["code"] == "FOCUS_SESSION_NOT_FOUND"
