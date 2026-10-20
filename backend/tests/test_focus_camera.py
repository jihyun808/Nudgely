"""카메라 집중 인증: 세션·샘플·점수·이탈 선톡·인증 테스트.

영상은 서버로 오지 않는다 — 상태 샘플(focus/absent)만 검증한다.
"""

from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.models.goal import Message
from app.models.notification import Notification
from app.models.planner import PlannerBlock
from tests.helpers import auth, create_goal, token_for


def _samples(items: list[tuple[str, str]]) -> dict:
    """[(status, iso)] → 요청 바디."""
    return {"samples": [{"status": st, "at": at} for st, at in items]}


async def _start(
    client, token, *, goal_id=None, consented=True, started_at="2026-10-12T10:00:00Z"
) -> dict:
    res = await client.post(
        "/api/focus/sessions/camera",
        headers=auth(token),
        json={"startedAt": started_at, "goalId": goal_id, "consented": consented},
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


async def test_one_missed_frame_is_not_counted(client):
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
    assert res.json()["focusScore"] == 100


async def test_three_in_a_row_counts_as_away(client):
    token = await token_for(client)
    sid = (await _start(client, token)).json()["id"]

    res = await client.post(
        f"/api/focus/sessions/{sid}/checks",
        headers=auth(token),
        json=_samples(
            [
                ("focus", "2026-10-12T10:00:00Z"),
                ("absent", "2026-10-12T10:00:10Z"),
                ("absent", "2026-10-12T10:00:20Z"),
                ("absent", "2026-10-12T10:00:30Z"),
            ]
        ),
    )

    assert res.status_code == 200
    assert res.json()["focusScore"] == 25  # 1/4


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


async def test_verified_count_aggregate(client):
    """마이페이지 '인증 완료': 인증된 카메라 세션만 센다."""
    token = await token_for(client)

    # 인증 성립 세션(점수 100, 1500초)
    sid = (await _start(client, token)).json()["id"]
    await client.post(
        f"/api/focus/sessions/{sid}/checks",
        headers=auth(token),
        json=_samples([("focus", "2026-10-12T10:00:00Z"), ("focus", "2026-10-12T10:00:30Z")]),
    )
    await client.post(
        f"/api/focus/sessions/{sid}/finish", headers=auth(token), json={"seconds": 1500}
    )

    # 미인증 세션(점수 0) — 집계에서 빠져야 함
    sid2 = (await _start(client, token, started_at="2026-10-12T11:00:00Z")).json()["id"]
    await client.post(
        f"/api/focus/sessions/{sid2}/checks",
        headers=auth(token),
        json=_samples(
            [
                ("absent", "2026-10-12T11:00:00Z"),
                ("absent", "2026-10-12T11:00:10Z"),
                ("absent", "2026-10-12T11:00:20Z"),
            ]
        ),
    )
    await client.post(
        f"/api/focus/sessions/{sid2}/finish", headers=auth(token), json={"seconds": 600}
    )

    res = await client.get("/api/focus/verified", headers=auth(token))
    assert res.status_code == 200
    assert res.json() == {"count": 1, "totalSeconds": 1500}


async def test_settings_exposes_camera_toggle(client):
    token = await token_for(client)
    res = await client.get("/api/settings", headers=auth(token))
    assert res.json()["cameraVerifyEnabled"] is True


async def test_camera_disabled_blocks_start(client):
    token = await token_for(client)
    # 설정에서 카메라 인증 끄기
    patched = await client.patch(
        "/api/settings", headers=auth(token), json={"cameraVerifyEnabled": False}
    )
    assert patched.json()["cameraVerifyEnabled"] is False

    res = await _start(client, token)  # 동의는 했어도 설정이 꺼져 있으면 막힌다
    assert res.status_code == 403
    assert res.json()["code"] == "CAMERA_DISABLED"


# ── 백그라운드 중단 ──


async def test_interrupt_finishes_and_tells_the_user(
    client: AsyncClient, session_factory: async_sessionmaker
):
    """화면이 내려가면 판정도 멈춘다. 모르고 계속 공부하면 점수가 안 오른다."""
    token = await token_for(client, "intr@b.com")
    goal_id = await create_goal(client, token)
    session_id = (await _start(client, token, goal_id=goal_id)).json()["id"]
    await client.post(
        f"/api/focus/sessions/{session_id}/checks",
        headers=auth(token),
        json=_samples([("focus", "2026-10-12T10:00:10Z"), ("focus", "2026-10-12T10:00:20Z")]),
    )

    res = await client.post(
        f"/api/focus/sessions/{session_id}/interrupt",
        headers=auth(token),
        json={"seconds": 600},
    )

    assert res.status_code == 200
    async with session_factory() as db:
        rows = await db.execute(select(Message).where(Message.role == "assistant"))
        said = [m.content for m in rows.scalars().all()]
    assert any("멈췄어" in m for m in said)


async def test_interrupt_without_goal_is_silent(client: AsyncClient):
    """목표를 안 고른 세션은 보낼 방이 없다. 조용히 끝낸다."""
    token = await token_for(client, "intr2@b.com")
    session_id = (await _start(client, token)).json()["id"]

    res = await client.post(
        f"/api/focus/sessions/{session_id}/interrupt",
        headers=auth(token),
        json={"seconds": 60},
    )

    assert res.status_code == 200
