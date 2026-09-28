#!/bin/sh
# root 로 시작해 업로드 디렉터리 주인을 맞춘 뒤 앱 사용자로 내려간다.
# 호스팅이 실행 시점에 /app/media 에 root 소유 볼륨을 덮어씌우기 때문이다.
set -e

MEDIA_DIR="${STORAGE_DIR:-/app/media}"

if [ "$(id -u)" = "0" ]; then
    mkdir -p "$MEDIA_DIR"
    chown -R app:app "$MEDIA_DIR"
    exec setpriv --reuid=app --regid=app --init-groups "$@"
fi

exec "$@"
