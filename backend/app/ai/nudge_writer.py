"""선톡 문구 생성 (M3).

템플릿은 세 번째부터 안 읽힌다. 싼 모델로 한 줄을 받되, 실패하면
템플릿으로 떨어지고, 길면 자른다.
"""

import logging
import time
from typing import TYPE_CHECKING

from app.ai.client import get_openai_client
from app.ai.prompts import build_nudge_messages
from app.ai.streaming import log_usage
from app.ai.text import strip_markdown
from app.core.config import settings

if TYPE_CHECKING:  # 런타임 import 는 순환이 된다(서비스 → ai 가 정방향이다)
    from app.services.nudge_service import NudgeContext

logger = logging.getLogger(__name__)

#: 선톡 한 줄의 글자 수 상한. 넘으면 첫 문장만 남긴다.
#: 알림 목록은 두 줄까지만 보여주고, 채팅방에서도 긴 잔소리는 읽히지 않는다.
MAX_LENGTH = 120

#: 모델을 기다릴 시간. 스케줄러의 한 틱 안에 여러 사용자를 도는데,
#: 한 명이 오래 끌면 뒤쪽 사람들의 선톡이 다음 틱으로 밀린다.
TIMEOUT_SECONDS = 15

#: 짧은 한 줄이면 충분하다. 넉넉히 주면 모델이 그만큼 채워 쓴다.
MAX_TOKENS = 120


def _tidy(text: str) -> str:
    """모델 출력에서 말풍선 하나를 뽑는다.

    빈 줄로 나눠 오면(여러 말풍선) 첫 덩어리만 쓴다 — 선톡은 한 번에 하나다.
    """
    text = strip_markdown(text).strip()
    first = text.split("\n\n", 1)[0].strip()
    if len(first) <= MAX_LENGTH:
        return first
    # 문장 끝에서 자른다. 못 찾으면 글자 수로 자르고 말줄임을 붙인다
    head = first[:MAX_LENGTH]
    cut = max(head.rfind("? "), head.rfind(". "), head.rfind("! "))
    return head[: cut + 1].strip() if cut > 0 else head.rstrip() + "…"


async def generate_nudge(ctx: "NudgeContext") -> str:
    """선톡 문구 한 줄. 빈 답이 오면 예외를 던져 템플릿으로 떨어지게 한다."""
    client = get_openai_client()
    model = settings.openai_batch_model
    started = time.monotonic()

    resp = await client.chat.completions.create(
        model=model,
        messages=build_nudge_messages(
            persona=ctx.goal.persona,
            goal_title=ctx.goal.title or ctx.goal.name,
            kind=ctx.kind,
            block_title=ctx.block_title,
            remaining=ctx.remaining,
        ),
        max_tokens=MAX_TOKENS,
        timeout=TIMEOUT_SECONDS,
    )
    log_usage("nudge", model, started, getattr(resp, "usage", None))

    content = _tidy(resp.choices[0].message.content or "")
    if not content:
        raise ValueError("선톡 문구가 비어 있다")
    return content


__all__ = ["MAX_LENGTH", "generate_nudge"]
