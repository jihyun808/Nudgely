#!/bin/sh
# root 로 시작해 업로드 디렉터리 주인을 맞춘 뒤 앱 사용자로 내려간다.
# 호스팅이 실행 시점에 /app/media 에 root 소유 볼륨을 덮어씌우기 때문이다.
set -e

MEDIA_DIR="${STORAGE_DIR:-/app/media}"

if [ "$(id -u)" = "0" ]; then
    mkdir -p "$MEDIA_DIR"
    chown -R app:app "$MEDIA_DIR"
    # setpriv 는 uid 만 바꾸고 환경은 물려준다. HOME 이 /root 로 남으면
    # asyncpg 가 SSL 인증서를 /root 에서 찾다가 권한 오류로 죽는다
    export HOME=/home/app
    exec setpriv --reuid=app --regid=app --init-groups "$@"
fi

exec "$@"
