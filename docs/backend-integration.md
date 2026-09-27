# 백엔드 연동 가이드

프론트의 `src/api/` 9개 파일은 아직 전부 mock 입니다. 백엔드는 [`api.md`](./api.md) 계약의
**엔드포인트 33개 중 32개가 구현돼 있고** 테스트 103개가 통과합니다. 이제 붙이면 됩니다.

이 문서는 "어느 mock 함수를 어떤 호출로 바꾸면 되는지" 와 "붙일 때 걸릴 것들" 을 정리한 것입니다.

---

## 1. 서버 띄우기

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env          # OPENAI_API_KEY 만 채우면 됩니다 (AI 대화용)
uvicorn app.main:app --reload
```

- API 문서(직접 눌러볼 수 있음): <http://localhost:8000/docs>
- 헬스체크: <http://localhost:8000/api/health>

AI 대화(`POST /goals/{id}/messages`)를 뺀 나머지는 **OpenAI 키 없이도 동작**합니다.

## 2. 프론트에서 바꿀 것

`.env` 에 서버 주소만 넣으면 `src/api/axios.ts` 는 그대로 써도 됩니다.

```
VITE_API_BASE_URL=http://localhost:8000/api
```

서버 CORS 는 `http://localhost:5173` 을 이미 허용합니다. 다른 포트를 쓰면
`backend/.env` 의 `CORS_ORIGINS` 에 추가해주세요.

`axios.ts` 의 토큰 자동 첨부와 401 처리는 서버 동작과 맞습니다. 손댈 필요 없습니다.

---

## 3. mock 함수 → 실제 호출

### `api/auth.ts`

| 함수 | 호출 | 비고 |
|---|---|---|
| `signin` | `POST /auth/login` | `{email, password}` → `{accessToken, user}` |
| `signup` | `POST /auth/signup` | `{nickname, email, password}` → 같은 응답. **201** |
| `checkEmailAvailable` | `GET /auth/email-available?email=` | `{isAvailable}` |
| `signout` | `POST /auth/logout` | 204 |
| `socialLogin` | — | **아직 없음.** 카카오·구글 키가 나오면 붙입니다 |

로그인 실패는 이메일이 없든 비밀번호가 틀리든 **401 + 같은 응답**입니다(계정 존재 여부를 숨김).

### `api/goal.ts`

| 함수 | 호출 |
|---|---|
| `fetchGoals` | `GET /goals` — 숨긴 목표는 빠집니다 |
| `fetchHiddenGoals` | `GET /goals?hidden=true` |
| `fetchCompletedGoals` | `GET /goals?completed=true` — 숨긴 것도 포함 |
| `fetchGoal` | `GET /goals/{goalId}` → `GoalDetail` |
| `createGoal` | `POST /goals` — **multipart** (`name, title, prompt, persona, image`) |
| `updateGoal` | `PATCH /goals/{goalId}` — 보낸 필드만 |
| `completeGoal` | `POST /goals/{goalId}/complete` → 204 |
| `clearGoalMessages` | `DELETE /goals/{goalId}/messages` → 204 |
| `deleteGoal` | `DELETE /goals/{goalId}` → 204 |
| `markGoalAsRead` | `POST /goals/{goalId}/read` → 204 |
| `fetchMessages` | `GET /goals/{goalId}/messages?cursor=&limit=` |
| `sendMessage` | `POST /goals/{goalId}/messages` — **SSE** (아래 5절) |

⚠️ **`dueDate` 는 생성이 아니라 `PATCH` 로 설정합니다.** `POST /goals` 에 넣으면 조용히 무시됩니다
(계약 3.2 의 multipart 목록에 `dueDate` 가 없습니다). 개설 팝업에서 기한을 받는다면
개설 직후 `PATCH` 를 한 번 더 부르면 됩니다.

### `api/record.ts` · `api/archive.ts` · `api/home.ts`

| 함수 | 호출 |
|---|---|
| `fetchDailyTodos` | `GET /todos?date=YYYY-MM-DD` |
| `fetchTodoMarks` | `GET /todos/marks?month=YYYY-MM` |
| `fetchDailyPlanner` | `GET /planners?date=YYYY-MM-DD` |
| `fetchAttachments` | `GET /goals/{goalId}/attachments?kind=image\|file` — **`kind` 필수** |
| `fetchGoalProgress` | `GET /goals/{goalId}/progress` |
| `fetchHomePreviews` | `GET /home/previews` |
| `fetchNotifications` | `GET /notifications` — 최신순 5개 |
| `markNotificationsAsRead` | `POST /notifications/read` → 204 |

### `api/focus.ts` · `api/settings.ts` · `api/user.ts`

| 함수 | 호출 |
|---|---|
| `fetchFocusSummary` | `GET /focus/summary?date=` |
| `fetchWeeklyFocus` | `GET /focus/weekly?weekStart=` (그 주 월요일) |
| `saveFocusSession` | `POST /focus/sessions` → 204 |
| `fetchSettings` | `GET /settings` |
| `updateSettings` | `PATCH /settings` — 바뀐 그룹만 |
| `changePassword` | `POST /auth/password` → 204 |
| `requestPasswordReset` | `POST /auth/password/reset` → **아직 메일이 안 나갑니다** (SMTP 미설정) |
| `deleteAccount` | `DELETE /me` → 204 |
| `fetchMyProfile` | `GET /me` |
| `updateMyProfile` | `PATCH /me` — multipart(`nickname`, `image`) |

히트맵용 기간별 집중은 `GET /focus/daily?from=&to=` 로 준비돼 있습니다(아직 mock 함수가 없습니다).

---

## 4. 붙일 때 걸릴 것들

### 시각은 UTC(`Z`)로 내려갑니다

```json
"lastMessageAt": "2026-09-16T08:30:58.932406Z"
```

`new Date(isoDate)` 를 그대로 쓰시면 됩니다. `src/utils/date.ts` 는 손댈 필요 없습니다.

날짜만 쓰는 값(`dueDate`, 투두의 `date`, 플래너의 `date`)은 `YYYY-MM-DD` 이고
**사용자 로컬 기준**입니다. 쿼리 파라미터로 날짜를 보낼 때도 로컬 기준으로 보내세요.

### id 는 불투명한 문자열입니다

`u_88319997c4b240af93f1c56c`, `g_5aa127b024e943fd975b7536` 처럼 접두사 + hex 입니다.
숫자로 파싱하거나 자르지 말고 그대로 들고 다니면 됩니다.

### 에러는 항상 같은 모양입니다

```json
{ "code": "GOAL_NOT_FOUND", "message": "목표를 찾을 수 없습니다." }
```

검증 실패(422)도 같은 모양입니다. `message` 는 사용자에게 그대로 보여줘도 되는 한국어입니다.
분기가 필요하면 `code` 를 쓰세요. 주요 코드: `INVALID_CREDENTIALS`, `EMAIL_DUPLICATED`,
`GOAL_NOT_FOUND`, `VALIDATION_ERROR`.

남의 리소스에 접근하면 403 이 아니라 **404** 가 옵니다(존재 여부를 숨기려고).

### 첨부 파일 주소는 절대 주소이고 인증이 필요 없습니다

`http://localhost:8000/static/<파일명>` 형태로 내려갑니다. `<img src>` 에 그대로 넣으면 됩니다.
토큰을 붙일 필요 없습니다.

### 모아보기의 `kind` 는 필수입니다

`GET /goals/{goalId}/attachments` 는 `?kind=image` 또는 `?kind=file` 을 **반드시** 받습니다.
빼고 부르면 422 입니다. 사진 탭·문서 탭을 따로 부르는 구조라면 그대로 맞습니다.

### 목록 3종은 같은 엔드포인트입니다

`GET /goals` 하나에 `?hidden=true` / `?completed=true` 로 갈라집니다. 기본 목록에서
숨긴 목표는 이미 빠져 있으니 프론트에서 또 거를 필요 없습니다.

---

## 5. 채팅 스트리밍(SSE)

`POST /goals/{goalId}/messages` 는 `text/event-stream` 으로 답합니다.

```js
// 텍스트만
body: JSON.stringify({ content: "이번 주 계획 짜줘" })

// 파일 첨부 (jpg/png/pdf/txt, 10MB 이하)
const form = new FormData();
form.append("content", "오늘 공부 인증");
form.append("file", file);
```

**`EventSource` 는 GET 만 되므로 쓸 수 없습니다.** `fetch` + `ReadableStream` 으로 읽어야 합니다.

| 이벤트 | data | 쓰임 |
|---|---|---|
| `message_start` | `{messageId, role}` | 빈 AI 말풍선을 먼저 띄운다 |
| `delta` | `{text}` | 여러 번 옴. 이어붙이면 타이핑 효과 |
| `done` | `{messageId, createdAt}` | 저장 완료 |
| `error` | `{code, message}` | 실패 |

`data` 는 항상 JSON 한 줄이라 `JSON.parse` 로 받으면 됩니다.

**`done` 에 `goalCompleted: true` 가 실려 오면** 이번 대화로 목표가 완주된 것입니다.
축하 연출을 띄우시면 됩니다 (api.md 3.2 에서 제안했던 신호입니다).

⚠️ 스트림이 시작된 뒤의 실패는 **HTTP 200 + `event: error`** 로 옵니다.
상태코드만 보면 성공으로 보이니 `error` 이벤트도 처리해주세요.

---

## 6. 아직 안 되는 것

| | 막는 것 |
|---|---|
| 소셜 로그인 (`POST /auth/social`) | **카카오·구글 클라이언트 ID** |
| 비밀번호 재설정 메일 | **SMTP 계정** (엔드포인트는 있고 204 를 주지만 메일은 안 나갑니다) |
| 푸시 알림 | Capacitor 전환 이후 |
| 알림 실시간 수신 | 지금은 폴링만. `?since=` 델타는 추가할 수 있습니다 |

---

## 7. 붙이는 순서 제안

1. **로그인·회원가입** — 여기가 통과하면 CORS·토큰·401 인터셉터가 전부 검증됩니다
2. **목표 목록·개설** — 화면 대부분이 목표에 걸려 있습니다
3. **채팅** — SSE 라 품이 제일 많이 듭니다
4. 나머지(기록·집중·홈·설정) — 단순 GET 이라 빠릅니다

1번만 붙여보고 막히는 게 있으면 바로 알려주세요. 계약과 다른 부분이 있으면 서버를 고치겠습니다.
