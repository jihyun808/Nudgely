"""AI 도구 스키마 (OpenAI function calling).

모델에게 "무엇을 할 수 있는지" 알려주는 선언만 둔다. 실제 동작은 tools.py 다.
description 은 곧 프롬프트다 — 여기 문구를 고치면 모델의 도구 선택이 바뀐다.
"""

TOOL_SCHEMAS: list[dict] = [
    {
        "type": "function",
        "function": {
            "name": "list_todos",
            "description": (
                "특정 날짜에 이 목표로 잡혀 있는 투두를 읽는다. "
                "항목을 체크하거나 새로 만들기 전에 먼저 불러 무엇이 이미 있는지, "
                "itemId 가 무엇인지 확인해라."
            ),
            "parameters": {
                "type": "object",
                "properties": {"date": {"type": "string", "description": "YYYY-MM-DD"}},
                "required": ["date"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_todos",
            "description": (
                "특정 날짜에 이 목표의 투두(할 일)를 추가한다. "
                "**먼저 list_todos 로 그날 무엇이 있는지 확인해라.** 이미 있는 할 일을 "
                "표현만 바꿔 다시 만들지 말고, 끝난 것이면 check_todo_item 으로 체크해라. "
                "progressDelta 는 '진도 단위 하나' 를 기준으로 나눠 준다 — 한 단위를 여러 "
                "할 일로 쪼갰으면 그 합이 1 이 되게 하고(보통 마지막 단계에만 1), "
                "각각에 1 을 주지 마라. 진도와 무관한 복습·정리 등은 0."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "date": {"type": "string", "description": "YYYY-MM-DD"},
                    "items": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "content": {"type": "string"},
                                "tag": {"type": "string", "description": "예: 강의, 복습"},
                                "progressDelta": {"type": "integer", "default": 0},
                            },
                            "required": ["content"],
                        },
                    },
                },
                "required": ["date", "items"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "check_todo_item",
            "description": (
                "투두 항목의 완료 여부를 바꾼다. "
                "완료하면 목표 진도(current)가 항목의 progressDelta 만큼 자동 반영된다. "
                "itemId 는 반드시 list_todos 로 먼저 확인해라. 지어내지 마라."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "itemId": {"type": "string"},
                    "done": {"type": "boolean", "default": True},
                },
                "required": ["itemId"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_planner",
            "description": (
                "특정 날짜의 텐미닛 플래너 '계획'을 세운다. 시간은 자정 기준 분(08:00→480)."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "date": {"type": "string", "description": "YYYY-MM-DD"},
                    "blocks": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "title": {"type": "string"},
                                "startMinutes": {"type": "integer"},
                                "durationMinutes": {"type": "integer"},
                            },
                            "required": ["title", "startMinutes", "durationMinutes"],
                        },
                    },
                },
                "required": ["date", "blocks"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "set_milestones",
            "description": (
                "목표의 진도 마일스톤(로드맵)을 통째로 교체한다. "
                "각 단계에 target(그 단계가 끝나는 진도 지점)을 주면 진도에 따라 "
                "status 가 자동으로 갱신된다. 예: 24소주제를 1~4장으로 나누면 6/12/18/24. "
                "target 을 주면 status 는 서버가 정하므로 생략해도 된다."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "milestones": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "title": {"type": "string"},
                                "status": {
                                    "type": "string",
                                    "enum": ["done", "current", "upcoming"],
                                },
                                "target": {
                                    "type": "integer",
                                    "description": "이 단계가 끝나는 진도 지점(누적값)",
                                },
                            },
                            "required": ["title"],
                        },
                    }
                },
                "required": ["milestones"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "set_due_date",
            "description": (
                "목표 기한을 정하거나 바꾼다. 목표를 세울 때 '언제까지' 를 들었으면 "
                "대화로만 알고 넘기지 말고 반드시 이 도구로 저장해라. "
                "기한을 없애려면 date 를 비워서 부른다."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "date": {"type": "string", "description": "YYYY-MM-DD. 비우면 기한 없음"}
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "set_routine",
            "description": (
                "이 목표에서 '매일(또는 정해진 요일에) 할 일' 을 통째로 정한다. "
                "목표를 세울 때 '하루에 1소주제씩' 처럼 반복 계획을 들었으면 저장해라. "
                "저장해 두면 다음날부터 '오늘도 이거 할까?' 로 먼저 제안할 수 있다. "
                "진도로 세는 항목에만 progressDelta 를 주고, 한 단위를 여러 줄로 "
                "쪼갰으면 합이 1 이 되게 한다. 없애려면 빈 배열로 부른다."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "items": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "content": {"type": "string"},
                                "tag": {"type": "string", "description": "예: 수업, 복습"},
                                "progressDelta": {"type": "integer", "default": 0},
                                "durationMinutes": {
                                    "type": "integer",
                                    "description": "플래너에 잡을 때 제안할 길이(분)",
                                },
                                "weekdays": {
                                    "type": "string",
                                    "description": "하는 요일. 월=0…일=6 을 이어 붙인다"
                                    "('024'=월수금). 비우면 매일",
                                },
                            },
                            "required": ["content"],
                        },
                    }
                },
                "required": ["items"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "complete_goal",
            "description": (
                "사용자가 목표 완주를 확인하면 완료 처리한다. "
                "반드시 사용자의 명시적 확인('응 완주로 해줘' 등) 뒤에만 호출할 것."
            ),
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "set_progress",
            "description": (
                "목표 진도를 절대값으로 설정/보정한다. 목표 파악 시 total·unit 을 세우고, "
                "사용자가 '30강까지 했어'처럼 말하면 current 를 교정한다. "
                "current 는 사용자가 말한 값을 그대로 쓴다. 투두 개수를 세어 추측하지 마라 "
                "(투두는 한 단위를 여러 개로 쪼개 놓은 것일 수 있다). "
                "큰 변경은 먼저 대화로 확인할 것."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "current": {"type": "integer"},
                    "total": {"type": "integer"},
                    "unit": {"type": "string", "description": "예: 강, 페이지, 회차"},
                },
            },
        },
    },
]
