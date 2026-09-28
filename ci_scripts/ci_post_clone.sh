#!/bin/sh
# Xcode Cloud 가 저장소를 받은 직후 실행한다. 웹 빌드를 만들어 ios 에 넣는다.
# (SPM 이 경로로 가리키는 패키지들은 저장소에 있다 — frontend/.gitignore)
set -e

command -v node >/dev/null || brew install node

cd "$CI_PRIMARY_REPOSITORY_PATH/frontend"
npm ci
# 서버 주소는 .env.production 에서 온다(커밋돼 있다). 없으면 앱이 자기 자신을
# 서버로 보고 모든 요청이 실패하므로 여기서 먼저 멈춘다.
test -f .env.production || { echo "frontend/.env.production 이 없습니다" >&2; exit 1; }
npm run build
npx cap sync ios
