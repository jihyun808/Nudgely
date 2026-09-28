# Nudgely 백엔드 컨테이너.
#
# 한 단계로 끝내지 않고 의존성 설치를 분리한다. 앱 코드는 자주 바뀌고 의존성은
# 거의 안 바뀌는데, 한 덩어리로 두면 코드 한 줄 고칠 때마다 pillow·cryptography 를
# 다시 받는다(배포가 몇 분씩 길어진다).

FROM python:3.13-slim AS deps

WORKDIR /app

# 런타임 의존성만 설치한다(ruff·pytest 는 CI 에서만 쓴다).
# --no-cache-dir: 이미지에 pip 캐시를 남기지 않는다
COPY requirements.txt .
RUN python -m venv /venv \
    && /venv/bin/pip install --no-cache-dir --upgrade pip \
    && /venv/bin/pip install --no-cache-dir -r requirements.txt


FROM python:3.13-slim

# 파이썬이 .pyc 를 쓰지 않고, 로그를 버퍼에 담아두지 않게 한다.
# 버퍼링을 끄지 않으면 컨테이너가 죽을 때 마지막 로그가 통째로 사라진다
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/venv/bin:$PATH"

# root 로 돌리지 않는다. 컨테이너가 뚫려도 할 수 있는 일을 줄인다
RUN useradd --create-home --uid 1000 app

WORKDIR /app

COPY --from=deps /venv /venv
COPY --chown=app:app . .

# 업로드 디렉터리. 볼륨을 붙이지 않으면 재배포 때 사라진다(docs/deploy.md 참고)
RUN mkdir -p /app/media && chown -R app:app /app/media

# ⚠️ USER 를 여기서 바꾸지 않는다. 호스팅이 실행 시점에 /app/media 에 볼륨을
# 덮어씌우는데, 그 볼륨은 root 소유라 빌드 때 맞춰 둔 주인이 가려진다.
# 시작점이 root 로 주인을 맞춘 **뒤에** app 으로 내려간다.
ENTRYPOINT ["/app/docker-entrypoint.sh"]

EXPOSE 8000

CMD ["/app/start.sh"]
