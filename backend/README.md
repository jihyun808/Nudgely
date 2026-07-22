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

## MVP 로드맵 (내일 회의 후 구체화)

`app/ai/service.py` 에 자리를 잡아둔 4대 기능:

| 기능 | 서비스 메서드(예정) | 상태 |
|------|--------------------|------|
| 학습 계획 세우기 | `create_study_plan` | TODO |
| 퀴즈 내기 | `generate_quiz` | TODO |
| to-do 만들기 | `create_todos` | TODO |
| 예습·복습 돕기 | `review_helper` | TODO |

각 기능마다 (1) 입출력 스키마 → `schemas.py`, (2) 프롬프트 → `prompts.py`,
(3) 로직 → `service.py`, (4) 엔드포인트 → `routes/` 순으로 추가하면 됩니다.
