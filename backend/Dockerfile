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

# 업로드 디렉터리. 볼륨을 붙이지 않으면 재배포 때 사라진다(README 참고)
RUN mkdir -p /app/media && chown -R app:app /app/media

USER app

EXPOSE 8000

# 서버를 켜기 전에 마이그레이션을 적용한다. 순서가 반대면 새 컬럼을 읽는 코드가
# 옛 스키마를 만나 첫 요청부터 깨진다.
# PORT 는 호스팅이 정해준다(Railway·Render 모두 주입한다).
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
