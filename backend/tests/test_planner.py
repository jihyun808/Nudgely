"""텐미닛 플래너 조회 테스트."""

from datetime import date

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.services.planner_service import add_block


async def _token(client: AsyncClient, email: str = "a@b.com") -> str:
    res = await client.post(
        "/api/auth/signup",
        json={"nickname": "지수", "email": email, "password": "password123"},
    )
    return res.json()["accessToken"]


def _h(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


async def _user_id(client: AsyncClient, token: str) -> str:
    return (await client.get("/api/me", headers=_h(token))).json()["id"]


async def test_empty_planner(client: AsyncClient):
    token = await _token(client)
    res = await client.get("/api/planners", headers=_h(token), params={"date": "2026-08-03"})
    assert res.status_code == 200
    body = res.json()
    assert body == {"date": "2026-08-03", "planned": [], "actual": []}


async def test_planner_splits_planned_and_actual(
    client: AsyncClient, session_factory: async_sessionmaker
):
    token = await _token(client)
    uid = await _user_id(client, token)
    on = date(2026, 8, 3)

    async with session_factory() as s:
        # 계획(kind=None) 하나
        await add_block(s, uid, on, title="미라클 모닝", start_minutes=480, duration_minutes=40)
        # 실제 기록 둘 (출처 다름)
        await add_block(
            s, uid, on, title="집중", start_minutes=540, duration_minutes=50, kind="focus"
        )
        await add_block(
            s, uid, on, title="직접", start_minutes=600, duration_minutes=20, kind="manual"
        )
        await s.commit()

    res = await client.get("/api/planners", headers=_h(token), params={"date": "2026-08-03"})
    body = res.json()

    assert len(body["planned"]) == 1
    assert body["planned"][0]["title"] == "미라클 모닝"
    assert body["planned"][0]["startMinutes"] == 480
    assert body["planned"][0]["kind"] is None

    assert len(body["actual"]) == 2
    kinds = {b["kind"] for b in body["actual"]}
    assert kinds == {"focus", "manual"}
    # 시작 시각 순 정렬
    assert [b["startMinutes"] for b in body["actual"]] == [540, 600]


async def test_planner_isolated_by_user(client: AsyncClient, session_factory: async_sessionmaker):
    t1 = await _token(client, "u1@b.com")
    t2 = await _token(client, "u2@b.com")
    uid1 = await _user_id(client, t1)

    async with session_factory() as s:
        await add_block(
            s, uid1, date(2026, 8, 3), title="내 계획", start_minutes=480, duration_minutes=30
        )
        await s.commit()

    res = await client.get("/api/planners", headers=_h(t2), params={"date": "2026-08-03"})
    assert res.json()["planned"] == []
