#!/bin/sh
# 컨테이너 시작점.
#
# root 로 잠깐 시작해 업로드 디렉터리 주인을 맞춘 뒤, 앱 사용자로 내려가 실행한다.
#
# 왜 필요한가: 이미지를 만들 때 /app/media 를 app 소유로 만들어 두지만,
# 호스팅(Railway)이 **실행 시점에** 그 경로에 볼륨을 덮어씌운다. 볼륨은 root
# 소유로 붙어서, 빌드 때 맞춰 둔 주인이 가려진다. 그러면 사진 업로드가 전부
# 권한 오류로 죽는데, 화면에는 그냥 "안 올라간다" 로만 보인다.
set -e

MEDIA_DIR="${STORAGE_DIR:-/app/media}"

if [ "$(id -u)" = "0" ]; then
    mkdir -p "$MEDIA_DIR"
    chown -R app:app "$MEDIA_DIR"
    # --init-groups: app 의 보조 그룹까지 제대로 붙여 준다
    exec setpriv --reuid=app --regid=app --init-groups "$@"
fi

# root 가 아니면(로컬 docker run --user 등) 그대로 실행한다
exec "$@"
