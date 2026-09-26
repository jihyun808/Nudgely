"""선택 버튼(퀵리플).

"추가할까? (Y/n)" 에 모바일에서 'y' 를 타이핑하는 건 번거롭다. 프롬프트가
마지막 줄에 "[선택: 추가해줘 / 아니]" 를 적게 하고, 서버가 떼어 버튼으로 넘긴다.
표기를 그대로 두면 말풍선에 대괄호가 보인다.
"""

import json
from collections.abc import AsyncIterator

import pytest
from httpx import AsyncClient

from app.ai.streaming import get_reply_streamer
from app.main import app
from app.services.reply_service import MAX_QUICK_REPLIES, extract_quick_replies
from tests.helpers import auth, create_goal, token_for


@pytest.mark.parametrize(
    ("text", "expected_body", "expected_options"),
    [
        (
            "1-1 수업을 오늘 할 일에 추가할까?\n\n[선택: 추가해줘 / 아니]",
            "1-1 수업을 오늘 할 일에 추가할까?",
            ["추가해줘", "아니"],
        ),
        (
            "오늘 할 일 다 끝냈네!\n[선택: 복습해줘 / 검사해줘 / 괜찮아]",
            "오늘 할 일 다 끝냈네!",
            ["복습해줘", "검사해줘", "괜찮아"],
        ),
        # 표기가 없으면 그대로 둔다
        ("그냥 답변이야", "그냥 답변이야", []),
    ],
)
def test_choice_marker_is_extracted(text: str, expected_body: str, expected_options: list[str]):
    assert extract_quick_replies(text) == (expected_body, expected_options)


@pytest.mark.parametrize(
    "text",
    [
        # 보기가 하나면 버튼이 의미 없다
        "응?\n[선택: 응]",
        # 너무 많으면 화면을 덮는다
        "골라\n[선택: " + " / ".join(f"보기{i}" for i in range(MAX_QUICK_REPLIES + 1)) + "]",
        # 버튼에 문장이 들어가면 읽기 어렵다
        "골라\n[선택: " + "가" * 30 + " / 아니]",
        # 마지막 줄이 아니면 본문의 일부로 본다
        "[선택: 응 / 아니]\n이건 설명이야",
    ],
)
def test_bad_markers_are_left_alone(text: str):
    """형식이 어긋나면 아무것도 떼지 않는다. 조용히 내용을 잃지 않는다."""
    body, options = extract_quick_replies(text)
    assert options == []
    assert body == text


class _AskingStreamer:
    async def stream(self, **_) -> AsyncIterator[str]:
        yield "1-1 수업을 오늘 할 일에 추가할까?\n\n[선택: 추가해줘 / 아니]"


async def test_done_carries_quick_replies_and_clean_text(client: AsyncClient):
    """done 에 보기가 실리고, 말풍선에는 표기가 남지 않는다."""
    app.dependency_overrides[get_reply_streamer] = lambda: _AskingStreamer()
    try:
        token = await token_for(client, "qr@b.com")
        goal_id = await create_goal(client, token)

        res = await client.post(
            f"/api/goals/{goal_id}/messages", headers=auth(token), json={"content": "안녕"}
        )

        done = None
        for block in res.text.strip().split("\n\n"):
            if block.startswith("event: done"):
                done = json.loads(block.split("data: ", 1)[1])

        assert done is not None
        assert done["quickReplies"] == ["추가해줘", "아니"]
        contents = [m["content"] for m in done["messages"]]
        assert contents == ["1-1 수업을 오늘 할 일에 추가할까?"]
        assert not any("[선택" in c for c in contents)
    finally:
        app.dependency_overrides.pop(get_reply_streamer, None)


async def test_no_quick_replies_key_when_not_asked(client: AsyncClient):
    """선택지를 안 물었으면 키 자체가 없다(프론트는 빈 배열로 읽는다)."""

    class _PlainStreamer:
        async def stream(self, **_) -> AsyncIterator[str]:
            yield "좋아, 화이팅!"

    app.dependency_overrides[get_reply_streamer] = lambda: _PlainStreamer()
    try:
        token = await token_for(client, "qr2@b.com")
        goal_id = await create_goal(client, token)

        res = await client.post(
            f"/api/goals/{goal_id}/messages", headers=auth(token), json={"content": "안녕"}
        )

        done = None
        for block in res.text.strip().split("\n\n"):
            if block.startswith("event: done"):
                done = json.loads(block.split("data: ", 1)[1])

        assert "quickReplies" not in done
    finally:
        app.dependency_overrides.pop(get_reply_streamer, None)
