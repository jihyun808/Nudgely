테스트 계정
test@nudgely.dev / password123

서버 띄우기
alembic upgrade head 로 마이그레이션 후
.venv/bin/uvicorn app.main:app --reload --port 8001 백엔드
VITE_BACKEND_ORIGIN=http://localhost:8001 npm run dev 프론트엔드

의존성 (새로 추가된 게 있으면)
cd backend && .venv/bin/pip install -r requirements.txt

자동 테스트
cd backend && .venv/bin/python -m pytest -q
cd frontend && npx tsc -b && npx eslint src && npm run build

이후 프롬프트 수정은 prompts.py에서 \_TOOL_POLICY만 확인하기.
(말투·마크다운 금지 같은 공통 규칙은 \_BASE, 도구 쓰는 규칙은 \_TOOL_POLICY)

모델 티어
.env의 OPENAI_CHAT_MODEL(대화) / OPENAI_BATCH_MODEL(배치).
호출마다 ai_call 로그에 모델·소요시간·토큰이 남는다.
