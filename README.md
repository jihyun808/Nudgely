테스트 계정
test@nudgely.dev / password123

서버 띄우기
alembic upgrade head 로 마이그레이션 후
.venv/bin/uvicorn app.main:app --reload --port 8001 백엔드
VITE_BACKEND_ORIGIN=http://localhost:8001 npm run dev 프론트엔드

자동 테스트
cd backend && .venv/bin/python -m pytest -q
cd frontend && npx tsc -b && npx eslint src && npm run build
