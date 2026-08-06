"""접두사가 붙은 문자열 ID 생성기.

프론트는 id 를 불투명한 문자열로 다룬다(예: "u_...", "g_...").
타입별 접두사를 붙여 로그/디버깅에서 구분하기 쉽게 한다.
"""

from uuid import uuid4


def new_id(prefix: str) -> str:
    """예: new_id("u") -> "u_3f9a1c2b..." (uuid4 hex 24자)."""
    return f"{prefix}_{uuid4().hex[:24]}"
