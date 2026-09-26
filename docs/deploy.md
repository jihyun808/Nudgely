# 배포 (Railway)

백엔드를 컨테이너로 띄운다. `main` 에 push 하면 Railway 가 빌드해서 올린다 —
CD 를 따로 짜지 않는다.

---

## 1. 왜 Railway 인가

**스케줄러가 계속 돌아야 한다.** 선톡은 10분마다 깨어나 "지금 보낼 사람" 을 찾는다
(`app/core/scheduler.py`). 무료 호스팅은 대개 몇 분 무응답이면 컨테이너를 재우는데,
그러면 이 앱의 핵심 기능이 조용히 멈춘다. 깨우려고 외부에서 핑을 쏘느니 돈을 내는 게 낫다.

곁들여 Postgres 와 볼륨이 같은 프로젝트 안에 있어서 첨부 파일 문제도 같이 풀린다.

---

## 2. 컨테이너

`backend/Dockerfile` — 의존성 설치와 앱 복사를 나눴다. 앱 코드는 자주 바뀌고
의존성은 거의 안 바뀌는데 한 덩어리로 두면 코드 한 줄 고칠 때마다
pillow·cryptography 를 다시 받는다.

```
CMD alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
```

**마이그레이션이 먼저다.** 순서가 반대면 새 컬럼을 읽는 코드가 옛 스키마를 만나
첫 요청부터 깨진다. 실패하면 `&&` 에서 멈춰 서버가 아예 안 뜬다 — 반쯤 망가진 채
서비스되는 것보다 낫다.

root 로 돌지 않고, `PORT` 는 호스팅이 주는 값을 쓴다.

로컬에서 확인:

```bash
cd backend
docker build -t nudgely-api .
docker run --rm -p 8000:8000 --env-file .env nudgely-api
```

---

## 3. 복제본은 하나로 둔다

`railway.json` 의 `numReplicas: 1` 은 **바꾸면 안 된다.** 스케줄러가 컨테이너
안에서 돌기 때문에, 두 개로 늘리면 같은 선톡이 두 번 나간다. 중복 방지
(`Notification.ref`)가 있긴 하지만 두 프로세스가 같은 순간에 확인하면 둘 다 통과한다.

트래픽이 늘어 정말 늘려야 할 때는 스케줄러를 별도 서비스로 떼고
`SCHEDULER_ENABLED=false` 로 웹 컨테이너를 띄운다.

---

## 4. Postgres

Railway 에서 Postgres 를 추가하고 `DATABASE_URL` 을 변수 참조로 꽂는다.

주소를 **그대로** 넣어도 된다. 호스팅은 `postgresql://...` 를 주는데 그대로 쓰면
SQLAlchemy 가 동기 드라이버를 찾다 죽는다. `Settings.async_database_url` 이
`postgresql+asyncpg://` 로 고쳐 쓰고, asyncpg 가 모르는 `sslmode` 같은 옵션도 떼어낸다.

SQLite 를 그대로 두면 **서버가 뜨지 않는다**(`assert_production_ready`). 컨테이너가
재시작할 때마다 데이터가 통째로 사라지는 걸 배포 첫날 겪으면 늦다.

---

## 5. 첨부 파일

`/media` 는 컨테이너 안이라 재배포마다 사라진다. Railway 볼륨을 `/app/media` 에
마운트하면 남는다. 베타까지는 이걸로 충분하고, 그 뒤에 S3/R2 로 옮긴다
(`app/core/storage.py` 만 갈아끼우면 된다).

---

## 6. 환경변수

| 키 | 값 | 비고 |
| --- | --- | --- |
| `APP_ENV` | `production` | 이 값이 아니면 안전 검사를 건너뛴다 |
| `JWT_SECRET` | 무작위 48바이트 | `python -c "import secrets; print(secrets.token_urlsafe(48))"` |
| `DATABASE_URL` | Postgres 참조 | Railway 변수 참조로 |
| `AUTO_CREATE_TABLES` | `false` | 스키마는 마이그레이션이 관리한다 |
| `PUBLIC_BASE_URL` | `https://<배포 주소>` | 첨부 URL 에 박혀 나간다 |
| `CORS_ORIGINS` | 아래 참고 | |
| `OPENAI_API_KEY` | | |
| `FCM_CREDENTIALS_JSON` | 서비스 계정 키 JSON 통째로 | 파일 대신 |

위 중 `APP_ENV`·`JWT_SECRET`·`AUTO_CREATE_TABLES`·`PUBLIC_BASE_URL`·`DATABASE_URL` 은
잘못 두면 **서버가 뜨지 않는다.** 경고 로그는 아무도 안 보기 때문에 일부러 막아 뒀다.

### CORS — 앱에서 API 가 전부 막히는 자리

웹뷰의 출처는 사이트 주소가 아니라 Capacitor 가 만든 로컬 출처다. 빠뜨리면 앱에서
모든 요청이 CORS 로 막힌다.

```
CORS_ORIGINS=https://nudgely.app,capacitor://localhost,https://localhost,http://localhost
```

플랫폼·버전마다 달라서 셋 다 넣었다. 실제로 무엇이 오는지는 서버 로그의 `Origin`
헤더로 확인하고 정리하면 된다.

---

## 7. 배포 흐름

1. Railway 프로젝트 생성 → GitHub 저장소 연결
2. 루트 디렉터리를 `backend` 로 지정(모노레포라 이걸 해야 Dockerfile 을 찾는다)
3. Postgres 추가, 볼륨을 `/app/media` 에 마운트
4. 위 환경변수 입력
5. `main` push → 자동 빌드·배포

확인:

```bash
curl https://<배포 주소>/api/health
```

`pushConfigured: true` 와 `env: production` 이 보이면 정상이다.

배포 뒤 프론트의 `.env.production` 에 주소를 넣고 `npm run sync` 해야 앱이 그쪽을
본다([`mobile.md`](./mobile.md) §2).

---

## 8. 아직 안 한 것

- 프론트 웹 배포(앱만 낼 거면 필요 없다)
- 첨부 S3/R2 이전
- `/static` 인증 — 링크가 새면 누구나 받는다
- 로그·에러 수집(Sentry 등)
