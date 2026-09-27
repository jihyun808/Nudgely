"""테스트 공용 헬퍼.

가입·인증 헤더·목표 생성은 거의 모든 테스트가 첫 줄에서 한다.
파일마다 같은 함수를 다시 쓰고 있어서(한때 15개 파일에 복붙돼 있었다) 여기로 모았다.

테스트는 파일마다 새 인메모리 DB 를 쓰므로 이메일이 겹쳐도 상관없다.
"""

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker


async def token_for(client: AsyncClient, email: str = "a@b.com") -> str:
    """가입하고 액세스 토큰을 받는다."""
    res = await client.post(
        "/api/auth/signup",
        json={"nickname": "지수", "email": email, "password": "password123"},
    )
    return res.json()["accessToken"]


def auth(token: str) -> dict[str, str]:
    """Authorization 헤더."""
    return {"Authorization": f"Bearer {token}"}


async def create_goal(
    client: AsyncClient,
    token: str,
    *,
    name: str = "Buddy",
    title: str = "T",
) -> str:
    """목표를 만들고 id 를 돌려준다."""
    res = await client.post("/api/goals", headers=auth(token), data={"name": name, "title": title})
    return res.json()["id"]


async def user_id_of(client: AsyncClient, token: str) -> str:
    return (await client.get("/api/me", headers=auth(token))).json()["id"]


async def call_tool(
    session_factory: async_sessionmaker, goal_id: str, name: str, args: dict
) -> str:
    """AI 도구를 직접 호출한다(키 없이 디스패처만 검증할 때).

    매번 새 세션을 열어 실제 대화 한 턴처럼 커밋 경계를 맞춘다.
    """
    from app.ai.tools import dispatch_tool_call
    from app.models.goal import Goal

    async with session_factory() as db:
        return await dispatch_tool_call(db, await db.get(Goal, goal_id), name, args)
