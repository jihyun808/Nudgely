#!/bin/sh
# Xcode Cloud 가 저장소를 받은 직후 실행한다.
# node_modules 는 커밋하지 않는데 Capacitor 의 SPM 패키지가 그 경로를 가리켜,
# 설치와 sync 를 먼저 해야 빌드가 된다.
set -e

brew install node

cd "$CI_PRIMARY_REPOSITORY_PATH/frontend"
npm ci
# 서버 주소는 .env.production 에서 온다(커밋돼 있다). 없으면 앱이 자기 자신을
# 서버로 보고 모든 요청이 실패하므로 여기서 먼저 멈춘다.
test -f .env.production || { echo "frontend/.env.production 이 없습니다" >&2; exit 1; }
npm run build
npx cap sync ios
