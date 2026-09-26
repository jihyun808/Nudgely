"""말풍선에 내보내기 전 글을 다듬는 도구.

대화 답변(reply_service)과 선톡 문구(nudge_writer)가 같은 규칙을 써야 해서
한곳에 둔다 — 한쪽만 고치면 선톡에만 별표가 남는 식으로 갈린다.
"""

import re

#: 메신저 말풍선에 그대로 보이면 안 되는 마크다운 표기들.
#: 프롬프트로 금지해 두었지만 모델이 자주 새서, 화면에 나가기 전에 떼어낸다.
#: (요청만으로 막는 데는 한계가 있고, 별표가 보이는 건 바로 눈에 띈다)
_MARKDOWN_SUBS = (
    # **굵게** / __굵게__ → 안쪽 글자만
    (re.compile(r"\*\*(.+?)\*\*", re.DOTALL), r"\1"),
    (re.compile(r"__(.+?)__", re.DOTALL), r"\1"),
    # 줄 앞 제목 기호(#, ##, …)
    (re.compile(r"^#{1,6}[ \t]+", re.MULTILINE), ""),
    # 줄 앞 목록 기호(-, *, +). 들여쓰기도 함께 없앤다
    (re.compile(r"^[ \t]*[-*+][ \t]+", re.MULTILINE), ""),
)


def strip_markdown(text: str) -> str:
    """말풍선에 보이면 안 되는 마크다운 표기를 떼어낸다.

    *한 개* 기울임이나 코드블록(```)은 건드리지 않는다 — 곱셈이나 실제 코드일 수
    있어서 잘못 떼면 뜻이 바뀐다. 눈에 제일 거슬리는 것만 보수적으로 지운다.
    """
    for pattern, replacement in _MARKDOWN_SUBS:
        text = pattern.sub(replacement, text)
    return text


__all__ = ["strip_markdown"]
