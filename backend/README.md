# Nudgely Backend + AI

스터디 페르소나 **Nudgely**의 백엔드 서버입니다.
Python + FastAPI 로 작성했고, AI 로직은 `app/ai/` 모듈에서 OpenAI를 호출합니다.

## 기술 스택

- **FastAPI** — 웹 프레임워크 (자동 문서 `/docs`)
- **pydantic-settings** — `.env` 기반 설정
- **OpenAI Python SDK** — AI 기능
- **pytest / ruff** — 테스트 / 린트·포맷

## 폴더 구조

```
backend/
├── app/
│   ├── main.py            # FastAPI 진입점 (CORS, 라우터 등록)
│   ├── core/
│   │   └── config.py      # .env 설정 로드 (settings)
│   ├── api/
│   │   ├── router.py      # 모든 라우터 취합
│   │   └── routes/
│   │       ├── health.py  # GET /api/health
│   │       └── chat.py    # POST /api/ai/chat, /api/ai/chat/stream
│   └── ai/                # ★ AI 모듈 (핵심)
│       ├── client.py      # OpenAI 클라이언트(싱글턴)
│       ├── prompts.py     # 페르소나/프롬프트
│       ├── schemas.py     # 요청/응답 모델
│       └── service.py     # 비즈니스 로직 (chat + MVP 기능 자리)
└── tests/                 # 스모크 테스트
```

> **아키텍처**: AI는 별도 서버가 아니라 백엔드 안의 한 모듈(`app/ai/`)입니다.
> 새 AI 기능은 `service.py`에 메서드를 추가하고 `routes/`에 엔드포인트를 붙이면 됩니다.

## 시작하기

```bash
cd backend

# 1) 가상환경
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate

# 2) 의존성 (개발용 = 런타임 + 테스트/린트)
pip install -r requirements-dev.txt

# 3) 환경변수
cp .env.example .env
#   .env 를 열어 OPENAI_API_KEY 를 실제 키로 채우세요.

# 4) 서버 실행
uvicorn app.main:app --reload
```

- API 문서(Swagger): http://localhost:8000/docs
- 헬스체크: http://localhost:8000/api/health

## DB 마이그레이션 (Alembic)

개발에서는 `AUTO_CREATE_TABLES=true` 로 앱 시작 시 테이블이 자동 생성됩니다.
**운영에서는 `AUTO_CREATE_TABLES=false` 로 두고 마이그레이션을 사용하세요.**

```bash
# 현재 스키마로 DB 반영
alembic upgrade head

# 모델을 바꾼 뒤 새 마이그레이션 생성(검토 후 커밋)
alembic revision --autogenerate -m "변경 설명"

# 모델과 마이그레이션이 일치하는지 확인(CI 용)
alembic check
```

DB URL 은 `migrations/env.py` 가 `settings.database_url` 에서 읽습니다.

## AI 대화 테스트

```bash
curl -X POST http://localhost:8000/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"이번 주 알고리즘 공부 계획 도와줘"}]}'
```

스트리밍(SSE)은 `POST /api/ai/chat/stream` 을 사용하세요.

## 테스트 / 린트

```bash
pytest            # 테스트 (OpenAI 키 없어도 헬스 테스트는 통과)
ruff check .      # 린트
ruff format .     # 포맷
```

## AI 기능 현황

대화 중 **도구 호출(function calling)** 로 동작한다. 별도 엔드포인트는 없고,
`POST /api/goals/{goalId}/messages` 한 곳에서 모델이 필요한 도구를 부른다.

| 기능 | 도구 | 상태 |
|------|------|------|
| to-do 만들기 | `create_todos` · `check_todo_item` | 구현 |
| 학습 계획 세우기 | `create_planner` · `set_milestones` | 구현 |
| 진도 갱신 · 완주 판정 | `set_progress` · `complete_goal` | 구현 |
| 퀴즈 내기 | — | 미구현 |
| 예습·복습 돕기 | — | 미구현 |

도구를 추가할 땐 (1) 정의·실행 → `ai/tools.py`, (2) 프롬프트 → `ai/prompts.py`,
(3) 저장 로직 → `services/` 순으로 붙이면 된다. 화면에 새로 그릴 게 생기면
프론트 계약(`docs/api.md`)부터 맞추고 시작한다.
