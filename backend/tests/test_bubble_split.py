"""긴 답변을 말풍선 여러 개로 나눠 보내기.

한 덩어리로 다 보내면 카톡에 논문이 오는 것처럼 보인다. 프롬프트에서
'길어지면 빈 줄로 끊어라' 고 일러 두고, 서버가 그 약속대로 자른다.
"""

from collections.abc import AsyncIterator

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.ai.streaming import get_reply_streamer
from app.main import app
from app.models.goal import Message
from app.services.reply_service import MAX_BUBBLES, split_bubbles, strip_markdown
from tests.helpers import auth, create_goal, token_for

# ── 자르기 규칙 ──


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("한 줄만", ["한 줄만"]),
        ("안녕!\n\n1강부터 해볼까?", ["안녕!", "1강부터 해볼까?"]),
        # 빈 줄 안에 공백이 섞여 있어도 경계로 본다
        ("첫째\n   \n둘째", ["첫째", "둘째"]),
        # 한 줄 바꿈은 같은 말풍선 안의 줄바꿈이다
        ("한 말풍선\n안에 두 줄", ["한 말풍선\n안에 두 줄"]),
        ("", []),
        ("\n\n  \n", []),
    ],
)
def test_split_rules(text: str, expected: list[str]):
    assert split_bubbles(text) == expected


def test_too_many_bubbles_are_merged():
    """열 개씩 쏟아지면 도배다. 상한을 넘으면 마지막에 몰아넣는다."""
    parts = [f"덩어리{i}" for i in range(9)]
    result = split_bubbles("\n\n".join(parts))

    assert len(result) == MAX_BUBBLES
    # 내용을 버리지 않는다
    assert "덩어리8" in result[-1]


# ── 실제 저장·응답 ──


class _MultiBubbleStreamer:
    async def stream(self, **_) -> AsyncIterator[str]:
        yield "좋아!\n\n"
        yield "오늘은 1강부터 해볼까?\n\n"
        yield "다 하면 알려줘"


async def test_reply_is_saved_as_separate_messages(
    client: AsyncClient, session_factory: async_sessionmaker
):
    """말풍선마다 메시지 한 건. 보낸 순서가 보존돼야 한다."""
    app.dependency_overrides[get_reply_streamer] = lambda: _MultiBubbleStreamer()
    try:
        token = await token_for(client)
        goal_id = (
            await client.post("/api/goals", headers=auth(token), data={"name": "B", "title": "T"})
        ).json()["id"]

        res = await client.post(
            f"/api/goals/{goal_id}/messages", headers=auth(token), json={"content": "안녕"}
        )
        assert "event: done" in res.text

        page = (await client.get(f"/api/goals/{goal_id}/messages", headers=auth(token))).json()
        # 응답은 최신 → 과거 순
        contents = [m["content"] for m in page["messages"] if m["role"] == "assistant"]
        assert contents == ["다 하면 알려줘", "오늘은 1강부터 해볼까?", "좋아!"]

        async with session_factory() as db:
            rows = (
                (await db.execute(select(Message).where(Message.role == "assistant")))
                .scalars()
                .all()
            )
        # 같은 순간에 저장해도 순서가 섞이지 않게 시각을 띄워 둔다
        times = sorted(m.created_at for m in rows)
        assert len(set(times)) == 3
    finally:
        app.dependency_overrides.pop(get_reply_streamer, None)


async def test_done_carries_every_bubble(client: AsyncClient):
    """화면이 한 번에 다 그릴 수 있게 done 이 말풍선을 전부 실어 준다."""
    import json

    app.dependency_overrides[get_reply_streamer] = lambda: _MultiBubbleStreamer()
    try:
        token = await token_for(client)
        goal_id = (
            await client.post("/api/goals", headers=auth(token), data={"name": "B", "title": "T"})
        ).json()["id"]

        res = await client.post(
            f"/api/goals/{goal_id}/messages", headers=auth(token), json={"content": "안녕"}
        )

        done = None
        for block in res.text.strip().split("\n\n"):
            if block.startswith("event: done"):
                done = json.loads(block.split("data: ", 1)[1])

        assert done is not None
        assert [m["content"] for m in done["messages"]] == [
            "좋아!",
            "오늘은 1강부터 해볼까?",
            "다 하면 알려줘",
        ]
        # id 는 서로 달라야 한다(화면 key 로 쓴다)
        assert len({m["messageId"] for m in done["messages"]}) == 3
    finally:
        app.dependency_overrides.pop(get_reply_streamer, None)


# ── 마크다운 제거 ──


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("내일 할 **1-2 소주제** 계획", "내일 할 1-2 소주제 계획"),
        ("__굵게__ 쓴 말", "굵게 쓴 말"),
        ("## 계획\n- 수업\n- 정리", "계획\n수업\n정리"),
        ("  - 들여쓴 목록", "들여쓴 목록"),
        ("### 제목만", "제목만"),
    ],
)
def test_markdown_is_stripped(text: str, expected: str):
    """프롬프트로 금지했지만 모델이 자주 샌다. 화면에 별표가 보이면 바로 눈에 띈다."""
    assert strip_markdown(text) == expected


@pytest.mark.parametrize(
    "text",
    [
        # 곱셈·뺄셈을 목록 기호로 오해하면 뜻이 바뀐다
        "3 * 4 = 12 이고 2 - 1 = 1",
        # 한 개 별표는 곱셈일 수 있어 건드리지 않는다
        "2*3 은 6",
        # 코드블록은 실제 코드일 수 있다
        "코드는 ```print(1)``` 이야",
        "평범한 문장",
    ],
)
def test_safe_text_is_left_alone(text: str):
    """보수적으로만 지운다. 잘못 떼면 뜻이 바뀐다."""
    assert strip_markdown(text) == text


class _MarkdownStreamer:
    async def stream(self, **_) -> AsyncIterator[str]:
        yield "좋습니다. 내일 할 **1-2 소주제** 계획입니다.\n\n- 수업 듣기\n- 정리하기"


async def test_saved_message_has_no_markdown(client: AsyncClient):
    """저장되는 내용 자체에 표기가 남지 않아야 한다(다음 턴 히스토리에도 들어간다)."""
    app.dependency_overrides[get_reply_streamer] = lambda: _MarkdownStreamer()
    try:
        token = await token_for(client, "md@b.com")
        goal_id = await create_goal(client, token)

        await client.post(
            f"/api/goals/{goal_id}/messages", headers=auth(token), json={"content": "안녕"}
        )

        page = (await client.get(f"/api/goals/{goal_id}/messages", headers=auth(token))).json()
        contents = [m["content"] for m in page["messages"] if m["role"] == "assistant"]

        assert contents, "답변이 저장되지 않았다"
        assert not any("**" in c or c.startswith("- ") for c in contents)
        assert any("1-2 소주제" in c for c in contents)
    finally:
        app.dependency_overrides.pop(get_reply_streamer, None)
