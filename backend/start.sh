#!/bin/sh
# 마이그레이션을 먼저 적용하고 서버를 켠다.
# DB 는 컨테이너가 뜨는 순간 아직 안 붙을 수 있어 몇 번 다시 시도한다.
# 끝내 실패하면 서버를 켜지 않는다 — 옛 스키마로 도는 것보다 안 뜨는 게 낫다.
set -e

i=1
until alembic upgrade head; do
    if [ "$i" -ge 5 ]; then
        echo "마이그레이션이 5번 모두 실패했습니다. DATABASE_URL 을 확인하세요." >&2
        exit 1
    fi
    echo "마이그레이션 실패, 재시도 $i/5" >&2
    i=$((i + 1))
    sleep 3
done

exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
