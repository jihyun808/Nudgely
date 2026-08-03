# API 연동 문서 (목표 · 채팅 · 기록 · 홈)

프론트에서 아직 mock으로 동작하는 지점과, 백엔드에 필요한 API 스펙을 정리한 문서.

**핵심 모델: "목표(Goal) = 채팅방"** — 채팅방, 홈의 진행 중인 목표, 기록의 투두 카드는 모두 **같은 id를 가진 하나의 목표**를 서로 다른 화면에서 보는 것이다.

이름은 두 개로 나뉜다.

| 필드    | 뜻                                      | 표시되는 곳                                                     |
| ------- | --------------------------------------- | --------------------------------------------------------------- |
| `name`  | 채팅방 이름(별명). 예: `Buddy`          | 채팅 목록, 채팅 상세 헤더 **제목**                              |
| `title` | 목표 이름. 예: `UI/UX 디자인 강의 완주` | 홈 목표 카드 제목, 기록 투두 카드 제목, 채팅 상세 헤더 **부제** |

메시지 전송은 **SSE 스트리밍**으로 확정했다 (3.6 참고).

---

## 1. 공통 규칙

- 인스턴스: `src/api/axios.ts`의 `api` (axios). 새 API는 반드시 이걸 통해서 호출한다.
- baseURL: `import.meta.env.VITE_API_BASE_URL ?? '/api'`
- 인증: 요청 인터셉터가 `Authorization: Bearer <accessToken>`을 자동 첨부한다.
- 401 응답: 인터셉터가 토큰을 지우고 `/signin`으로 보낸다. 개별 화면에서 처리할 필요 없다.
- 타임아웃: 10초
- 시간 값: 모든 날짜/시각은 **ISO 8601 문자열(UTC)**. 프론트에서 `src/utils/date.ts`가 상대 시간으로 변환한다.
- 날짜 파라미터(`date=`)는 **사용자 로컬 기준 `YYYY-MM-DD`** (프론트 `formatDateKey()`가 만든다).
- 에러 응답 포맷(합의 필요):
  ```json
  { "code": "GOAL_NOT_FOUND", "message": "목표를 찾을 수 없습니다." }
  ```

---

## 2. 지금 mock으로 돌아가는 지점

mock 데이터는 전부 **`src/mocks/`** 폴더에 있다. 연동이 끝나면 **폴더째 삭제**한다.

| 위치                                                                | 함수                   | 현재 동작                            | 교체할 것                    |
| ------------------------------------------------------------------- | ---------------------- | ------------------------------------ | ---------------------------- |
| `src/api/goal.ts`                                                   | `fetchGoals()`         | 600ms 지연 후 `MOCK_GOALS` 반환      | `GET /goals`                 |
| `src/api/goal.ts`                                                   | `fetchGoal()`          | mock 목록에서 id로 찾기              | `GET /goals/{id}`            |
| `src/api/goal.ts`                                                   | `createGoal()`         | 300ms 지연 후 로컬 객체 생성         | `POST /goals`                |
| `src/api/goal.ts`                                                   | `fetchMessages()`      | 1번 목표 대화를 10개씩 커서 분할     | `GET /goals/{id}/messages`   |
| `src/api/goal.ts`                                                   | `sendMessage()`        | 900ms 후 고정 문구 응답              | `POST /goals/{id}/messages`  |
| `src/api/goal.ts`                                                   | `markGoalAsRead()`     | 아무것도 안 함                       | `POST /goals/{id}/read`      |
| `src/api/record.ts`                                                 | `fetchDailyTodos()`    | 날짜로 mock 필터링                   | `GET /todos?date=`           |
| `src/api/record.ts`                                                 | `fetchDailyPlanner()`  | 날짜와 무관하게 같은 하루 반환       | `GET /planners?date=`        |
| `src/api/home.ts`                                                   | `fetchHomePreviews()`  | 500ms 지연 후 mock 반환              | `GET /home/previews`         |
| `src/api/home.ts`                                                   | `fetchNotifications()` | 500ms 지연 후 mock 반환              | `GET /notifications`         |
| `src/api/user.ts`                                                   | `fetchMyProfile()`     | 500ms 지연 후 mock 반환              | `GET /me`                    |
| `src/api/settings.ts`                                               | `fetchSettings()`      | 모듈 변수에 담아둔 값 반환           | `GET /settings`              |
| `src/api/settings.ts`                                               | `updateSettings()`     | 모듈 변수만 갱신(새로고침 시 초기화) | `PATCH /settings`            |
| `src/api/settings.ts`                                               | `changePassword()`     | 아무것도 안 함                       | `POST /auth/password`        |
| `src/api/settings.ts`                                               | `deleteAccount()`      | 아무것도 안 함                       | `DELETE /me`                 |
| `CreateGoalModal` 사진                                              | `FileReader` data URL  | 브라우저 안에만 존재                 | 서버 업로드 후 받은 URL 사용 |
| `ChatDetail` 메뉴 버튼                                              | `console.log`만        | 미구현                               | 채팅방 메뉴 화면 연결        |
| `Home` 집중 시작하기                                                | 동작 없음              | 미구현                               | 집중 세션 화면 연결          |
| `FocusSummary`, `WeeklyFocusCard`, `FocusHeatmap`, `My`의 요약 카드 | 값 하드코딩            | 미구현                               | 집중 탭 · 집계 API           |

각 함수 내부만 실제 호출로 바꾸면 화면 코드는 손댈 필요 없다. 반환 타입이 `src/types/`에 고정되어 있기 때문이다.

---

## 3. 목표 (= 채팅방)

프론트 타입: `Goal`, `GoalDetail`, `CreateGoalInput` (`src/types/goal.ts`)

### 3.1 목표 목록 조회

```
GET /goals
```

```json
{
  "goals": [
    {
      "id": "g_01H...",
      "name": "Buddy",
      "imageUrl": "https://cdn.../buddy.png",
      "title": "UI/UX 디자인 강의 완주",
      "lastMessage": "오늘 UI/UX 5강 완료 예정이야!",
      "lastMessageAt": "2026-07-30T04:12:00Z",
      "unreadCount": 2,
      "remainingDays": 22,
      "progress": { "current": 21, "total": 50, "unit": "강" }
    }
  ]
}
```

| 필드            | 타입        | 필수 | 쓰이는 화면 · 비고                                      |
| --------------- | ----------- | ---- | ------------------------------------------------------- |
| `id`            | string      | ✅   | 채팅 라우팅(`/chat/{id}`), 투두·알림의 연결 키          |
| `name`          | string      | ✅   | 채팅방 이름(별명). 최대 10자                            |
| `imageUrl`      | string      | ❌   | 없으면 프론트가 이름 첫 글자 아바타를 그린다            |
| `title`         | string      | ❌   | **목표 이름.** 홈·기록 카드 제목 + 채팅 부제. 최대 50자 |
| `lastMessage`   | string      | ✅   | 채팅 목록 미리보기                                      |
| `lastMessageAt` | string(ISO) | ✅   | 채팅 목록 정렬 기준. 메시지가 없으면 생성 시각          |
| `unreadCount`   | number      | ✅   | 0이면 배지 없음. 99 초과는 프론트가 `99+`로 표시        |
| `remainingDays` | number      | ❌   | 홈 목표 카드의 D-day. 기한이 없으면 배지 미표시         |
| `progress`      | object      | ❌   | 홈 목표 카드의 진행률. **아래 TODO 참고**               |

- 정렬은 프론트가 `lastMessageAt` 최신순으로 다시 한다(`sortGoals.ts`).
- **숨긴 목표(`isHidden: true`)는 기본 목록에서 제외**한다. 히스토리 화면은 `GET /goals?hidden=true`로 숨긴 것만 받는다.
- **`progress`는 확정 스펙이 아니다.** 진도를 무엇으로 셀지(강의 수·페이지·회차 등)는 AI가 사용자에게서 어떤 정보를 받을지 정한 뒤 맞춘다. 프론트에도 같은 TODO가 `types/goal.ts`와 `GoalCard`에 있다.
- 채팅 검색은 현재 프론트 필터링(이름 + 최근 메시지). 목표가 수십 개를 넘으면 `GET /goals?q=`로 옮긴다.

### 3.2 목표 단건 조회

```
GET /goals/{goalId}
```

응답: `GoalDetail` = 위 `Goal` + `prompt`(AI 시스템 프롬프트, 최대 500자). 채팅 상세 헤더와 설정 화면에서 쓴다.

> **`title`(목표 이름)의 출처**: 지금은 개설 팝업에서 사용자가 직접 적는다. AI가 대화를 통해 목표를 구체화하면 `PATCH /goals/{id}`로 갱신하는 흐름을 상정하고 있다(미확정).

### 3.3 목표 생성 (= 채팅방 개설)

```
POST /goals
Content-Type: multipart/form-data
```

| 파트     | 타입 | 필수 | 제한                             |
| -------- | ---- | ---- | -------------------------------- |
| `name`   | text | ✅   | 채팅방 이름. 1~10자, 공백만 불가 |
| `title`  | text | ❌   | 목표 이름. 0~50자                |
| `prompt` | text | ❌   | 0~500자                          |
| `image`  | file | ❌   | jpg/jpeg/png/webp/gif, 5MB 이하  |

응답: `201` + 생성된 `Goal`

- 채팅 탭의 `+` 버튼과 홈의 '목표 추가하기'가 **같은 팝업(`CreateGoalModal`)** 을 쓰므로 진입점이 둘이어도 요청은 하나다.
- 글자수 제한은 프론트 상수 `GOAL_LIMITS`로 관리한다.

**서버 측 필수 검증** — 프론트 검증(`src/utils/image.ts`)은 우회 가능하므로 서버에서 반드시 다시 해야 한다:

1. 용량 5MB 제한 (프록시/서버 양쪽)
2. 매직 넘버로 실제 포맷 확인 (확장자·Content-Type만 믿지 않는다)
3. 이미지 재인코딩 또는 메타데이터 제거 후 저장 (EXIF·삽입 스크립트 제거)
4. 저장 파일명은 서버가 새로 생성 (사용자 파일명 그대로 쓰지 않는다 — 경로 조작 방지)
5. 정적 서빙 시 `Content-Type` 고정 + `X-Content-Type-Options: nosniff`
6. 글자수 제한(10/50/500)도 서버에서 재검증
7. `prompt`는 사용자 입력이므로 시스템 프롬프트와 명확히 분리해 넣는다 (프롬프트 주입 방어)

### 3.4 목표 수정 / 완료 / 삭제

화면: 모아보기의 **설정 탭**(`GoalSettings`). 채팅방 이름·목표 이름·사진·프롬프트·기한·알림을 여기서 고친다.

```
PATCH  /goals/{goalId}            # 부분 수정
POST   /goals/{goalId}/complete   # 목표 완료 처리 → 204
DELETE /goals/{goalId}/messages   # 대화 내용만 삭제 → 204
DELETE /goals/{goalId}            # 목표 삭제 → 204
```

`PATCH` 본문 (보낸 필드만 갱신, 응답은 갱신된 `GoalDetail`):

| 필드                  | 뜻                                                    |
| --------------------- | ----------------------------------------------------- |
| `name`                | 채팅방 이름 (1~10자)                                  |
| `title`               | 목표 이름 (0~50자)                                    |
| `prompt`              | AI 시스템 프롬프트 (0~500자)                          |
| `image`               | 대표 사진 (multipart)                                 |
| `dueDate`             | 목표 기한 `YYYY-MM-DD`. 서버가 `remainingDays`를 계산 |
| `isNotificationMuted` | 이 목표의 알림만 끄기. **전역 알림 설정과 별개**      |

- 프론트는 기본 정보(이름·목표·프롬프트·사진)는 **'저장' 버튼을 눌러야** 보내고, 기한·알림 토글은 **바꾸는 즉시** 보낸다(실패 시 되돌리고 토스트로 알림).
- `isNotificationMuted`가 켜진 목표는 **서버가 알림 발송에서 제외**해야 한다.
- **완료 처리**(`/complete`)는 `completedAt`을 채우고, 모아보기 진도 탭이 완주 화면으로 바뀐다. 진도 마일스톤을 모두 `done`으로 바꿀지는 백엔드와 합의 필요.
- **대화 내용 삭제**는 메시지만 지우고 목표·투두·플래너 기록은 남긴다.
- **숨기기**(`isHidden: true`)는 삭제가 아니다. 대화·기록은 그대로 두고 채팅 목록에서만 빼며, 설정 > 히스토리에서 되돌릴 수 있다.
- **목표 삭제 시 데이터 처리 정책은 아직 미합의**다(메시지·투두·플래너를 함께 지울지, 보관할지).

### 3.5 메시지 목록 (커서 페이지네이션) — 프론트 구현 완료

```
GET /goals/{goalId}/messages?limit=10               # 최신 페이지
GET /goals/{goalId}/messages?cursor=m_01H&limit=10  # m_01H보다 더 과거
```

```json
{
  "messages": [
    {
      "id": "m_01H...",
      "role": "assistant",
      "content": "오늘 목표는 뭐야?",
      "createdAt": "2026-07-30T04:12:00Z"
    }
  ],
  "nextCursor": "m_01G..."
}
```

| 필드         | 설명                                                                 |
| ------------ | -------------------------------------------------------------------- |
| `messages`   | **최신 → 과거 순**. 프론트가 뒤집어 오래된 것부터 그린다             |
| `nextCursor` | 이번 페이지에서 **가장 오래된 메시지의 id**. 더 과거가 없으면 `null` |

- `cursor`는 **"이 메시지보다 더 과거"** 를 뜻하고, 커서 자신은 응답에 **포함하지 않는다**(중복 방지).
- `role`: `"user" | "assistant"`
- 파일 첨부 메시지는 `file: { name, caption?, url? }`를 함께 준다.
- 정렬은 `createdAt` 내림차순 + **같은 시각이면 id로 2차 정렬**해야 커서가 어긋나지 않는다.
- `limit`은 프론트가 보내지만 서버에서 상한(예: 100)을 둔다. 프론트 상수는 `MESSAGE_PAGE_SIZE`(현재 10, 연동 시 30 권장).

**프론트 동작** (`ChatDetail.tsx`)

1. 진입 시 커서 없이 최신 페이지를 받아 뒤집어 그린다
2. 위로 스크롤해 상단 80px 안에 들어오면 `nextCursor`로 다음 요청
3. 받은 페이지를 앞쪽에 이어 붙이고, 늘어난 높이만큼 `scrollTop`을 보정해 보던 위치를 유지한다
4. 불러오는 동안 상단에 "이전 대화를 불러오는 중..." 표시, `nextCursor`가 `null`이면 더 요청하지 않는다

### 3.6 메시지 전송 — SSE 스트리밍 (확정)

```
POST /goals/{goalId}/messages
Body: { "content": "오늘 3시간 공부할래" }
Accept: text/event-stream
```

```
event: message_start
data: {"messageId":"m_02...","role":"assistant"}

event: delta
data: {"text":"좋아, "}

event: done
data: {"messageId":"m_02...","createdAt":"2026-07-30T04:13:00Z"}
```

에러 시: `event: error` + `data: {"code":"...","message":"..."}`

**왜 SSE로 정했는가**

| 방식                          | 특징                                 | 이 서비스에                                                                          |
| ----------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------ |
| 일반 REST (한 번에 완성 응답) | 가장 간단                            | AI 답변이 5~10초 걸리는 동안 화면이 멈춘 것처럼 보인다                               |
| **SSE (Server-Sent Events)**  | 서버→클라 단방향 스트림. HTTP 그대로 | ✅ **채택.** 타이핑되듯 나오는 AI 채팅 UX에 맞고, 서버 구현이 WebSocket보다 단순하다 |
| WebSocket                     | 양방향 상시 연결                     | AI 채팅은 "내가 보내면 답이 온다"라서 상시 양방향 연결이 필요하지 않다               |
| 폴링                          | 주기적으로 재조회                    | 서버·배터리 낭비. 쓰지 않는다                                                        |

- 내 메시지는 프론트가 먼저 그려두고(`status: 'sending'`), 실패하면 말풍선 아래에 "다시 시도"를 띄운다.
- **파일 첨부**는 `multipart/form-data`로 `content`(선택) + `file`을 보낸다. 제한 10MB(`ChatInputBar`의 `MAX_ATTACHMENT_SIZE`). pdf 등도 허용하므로 서버에서 확장자 화이트리스트 + 실행 권한 없는 스토리지 저장이 필요하다.
- SSE는 `EventSource`로 GET만 가능하므로 POST 스트리밍은 `fetch` + `ReadableStream`으로 읽는다. 이 경우 axios 인터셉터를 타지 않으니 `Authorization` 헤더를 직접 넣어야 한다.
- 인프라 확인: 프록시 `proxy_buffering off`, 스트리밍 응답 압축 처리, 긴 응답 타임아웃.

### 3.7 모아보기 — 첨부 · 진도

화면: `src/pages/archive/Archive.tsx` (라우트 `/chat/:goalId/archive`, 채팅 상세 우측 상단 버튼에서 진입)

```
GET /goals/{goalId}/attachments?kind=file     # 파일
GET /goals/{goalId}/attachments?kind=image    # 사진
```

```json
{
  "attachments": [
    {
      "id": "a_01H...",
      "kind": "file",
      "name": "20강_요약노트.pdf",
      "sizeBytes": 1258291,
      "uploadedAt": "2026-08-03T09:00:00Z",
      "url": "https://cdn.../a_01H.pdf"
    }
  ]
}
```

프론트 타입: `Attachment` (`src/types/archive.ts`)

- `kind`: `"file"`(문서) / `"image"`(사진). 화면에서 탭이 나뉜다. **동영상은 받지 않는다**(용량이 커서 제외).
- 프론트가 `uploadedAt` 기준으로 **연-월(`2026-08`)로 묶어** 최신 달부터 보여준다.
- **유효기간 개념은 두지 않는다.** 채팅에 올린 파일은 계속 남는다.
- 사진은 목록에 **썸네일 URL**이 필요하다(원본을 그대로 쓰면 목록이 무거워진다).

```
GET /goals/{goalId}/progress
```

```json
{
  "goalId": "g_01H...",
  "goalTitle": "UI/UX 디자인 강의 완주",
  "startedAt": "2026-06-04T00:00:00Z",
  "completedAt": null,
  "milestones": [
    { "id": "p1", "title": "6월까지 기초 10강 완료", "status": "done" },
    { "id": "p3", "title": "8월까지 실습 과제 3개 제출", "status": "current" }
  ],
  "focusedSeconds": 151200,
  "completedTodoCount": 64,
  "bestMonth": "2026-07"
}
```

프론트 타입: `GoalProgress`, `ProgressMilestone`

| 필드                  | 뜻                                        | 만드는 주체 |
| --------------------- | ----------------------------------------- | ----------- |
| `milestones[].title`  | 기간별 계획 문구. 예: '7월까지 20강 완료' | **AI**      |
| `milestones[].status` | `done` / `current` / `upcoming`           | **AI**      |
| `startedAt`           | 목표를 만든 날                            | 백엔드      |
| `completedAt`         | 목표를 끝낸 날. 없으면 진행 중            | 백엔드      |
| `focusedSeconds`      | 이 목표에 쓴 집중 시간                    | 백엔드 집계 |
| `completedTodoCount`  | 이 목표에서 완료한 투두 개수              | 백엔드 집계 |
| `bestMonth`           | 가장 많이 집중한 달 (`YYYY-MM`)           | 백엔드 집계 |

- 진도율(%)은 프론트가 `done` 단계 수 ÷ 전체 단계 수로 계산한다.
- `completedAt`이 있으면 완료된 목표로 보고 진행 기간·걸린 날수와 축하 연출을 보여준다.
- 세 집계 값(`focusedSeconds`·`completedTodoCount`·`bestMonth`)은 **없으면 해당 칸을 그리지 않는다.** 연동 초기에는 빼고 시작해도 된다.

**AI가 해야 할 일**

1. 목표를 만들 때 대화로 **로드맵(마일스톤 목록)을 구성**해 저장한다. 기간 + 분량이 드러나는 짧은 문구가 좋다("7월까지 20강 완료").
2. 대화·인증을 보고 마일스톤 `status`를 **`upcoming` → `current` → `done`으로 갱신**한다.
3. 마지막 마일스톤이 끝나면 목표를 완료 처리하도록 백엔드에 알린다(`completedAt` 설정).
4. 목표 이름(`Goal.title`)과 로드맵이 어긋나지 않게 함께 갱신한다.

**백엔드가 해야 할 일**

1. 마일스톤 저장·수정 API (AI가 쓸 쓰기 엔드포인트. 현재 문서에는 조회만 있다)
2. `completedAt` 설정 규칙 — AI 판단으로만 할지, 진도율 100%면 자동으로 할지 정해야 한다
3. **집중 세션에 목표 id 붙이기** — 지금 `POST /focus/sessions`에는 목표 정보가 없어서 `focusedSeconds`를 목표별로 집계할 수 없다. **스펙 변경이 필요하다.**
4. 투두 완료 개수·월별 집중 시간 집계 (`completedTodoCount`, `bestMonth`)

### 3.8 읽음 처리

```
POST /goals/{goalId}/read
```

응답: `204`. 채팅방 진입 시 호출한다. 정렬은 안 읽음 여부와 무관하므로 **읽어도 목록 순서는 바뀌지 않는다**.

---

## 4. 기록 탭

### 4.1 날짜별 투두 조회

```
GET /todos?date=2026-07-30
```

```json
{
  "todos": [
    {
      "id": "t_01H...",
      "goalId": "g_01H...",
      "goalTitle": "UI/UX 디자인 강의 완주",
      "date": "2026-07-30",
      "items": [{ "id": "ti_01H...", "content": "UI/UX 21강 수강", "isDone": true, "tag": "강의" }]
    }
  ]
}
```

프론트 타입: `DailyTodo`, `TodoItem` (`src/types/record.ts`)

- **투두는 날짜마다 새로 만들어진다.** 목표에 계속 붙어 있는 고정 항목이 아니라, 그날 AI와의 대화로 생성·갱신된다.
- 카드 한 장 = 목표 하나의 그날 할 일. **그날 할 일이 없는 목표는 아예 내려주지 않는다**(프론트가 카드를 그리지 않음).
- `goalTitle`은 카드 제목이며 `Goal.title`(목표 이름)과 같은 값이다. 목표 이름이 바뀌면 함께 따라와야 한다(서버에서 조인해 내려주는 것을 권장).
- 체크 상태(`isDone`)는 **AI가 바꾸고 화면은 읽기 전용**이다. 사용자가 직접 체크하는 UI가 생기면 `PATCH /todos/{todoId}/items/{itemId}`가 필요하다.
- 해당 날짜에 아무것도 없으면 빈 배열 → "이 날짜에는 할 일이 없어요".

### 4.2 텐미닛 플래너 조회

```
GET /planners?date=2026-07-30
```

```json
{
  "date": "2026-07-30",
  "planned": [{ "id": "p1", "title": "미라클 모닝", "startMinutes": 480, "durationMinutes": 40 }],
  "actual": [
    {
      "id": "a1",
      "title": "미라클 모닝",
      "startMinutes": 480,
      "durationMinutes": 40,
      "kind": "manual"
    }
  ]
}
```

프론트 타입: `DailyPlanner`, `PlannerBlock` (`src/types/planner.ts`)

- `startMinutes`는 **자정 기준 분**(08:00 → 480), `durationMinutes`는 길이.
- `kind`(실제 기록에만): `"focus"`(집중 세션) / `"verify"`(학습 인증) / `"manual"`(직접 기록)
- 계획은 AI가 정해 **사용자가 바꿀 수 없고**, 실제 기록은 수정 가능하게 열어둘 예정이다(수정 API 미정).
- 화면은 06:00~24:00 범위에서 **일정이 있는 구간만** 30분 단위로 그린다.
- 달성률·블록 수는 **프론트가 계산**한다(10분 = 1블록, 계획이 있는 칸에 실제가 겹치면 달성).
- 오늘 이후 날짜는 조회하지 않는다(프론트에서 막음).

### 4.3 캘린더 날짜별 점 (미구현)

`GET /records?year=&month=` → 기록이 있는 날짜 목록. 아직 화면에 없다.

---

## 5. 홈 탭

### 5.1 미리보기 조회

```
GET /home/previews
```

```json
{
  "previews": [
    {
      "id": "p_01H...",
      "kind": "message",
      "title": "Buddy",
      "subtitle": "AI 스터디 메이트",
      "content": "오늘 UI/UX 5강 완료 예정이야!",
      "receivedAt": "2026-07-30T09:00:00Z",
      "linkTo": "/chat/g_01H..."
    }
  ]
}
```

프론트 타입: `HomePreview` (`src/types/home.ts`)

- **안 읽은 항목만** 내려준다. **목표(채팅방)당 한 장**(그 방의 가장 최근 안 읽은 메시지).
- `kind`: `"message"` / `"notice"`(공지) / `"ad"`(광고). 메시지는 아이콘 💌 고정 + 본문 2줄 말줄임, 공지·광고는 📢 / 🎁이고 줄 수 제한 없음.
- 정렬은 프론트가 `receivedAt` 최신순으로 다시 한다. 4초마다 자동으로 다음 장으로 넘어간다.
- 메시지 카드를 누르면 프론트가 그 카드를 즉시 제거하고 채팅방으로 이동한다(낙관적). 서버 읽음 확정은 `POST /goals/{id}/read`.
- 홈은 **창 포커스/탭 복귀 시 자동 재조회**한다.
- 빈 배열이면 "모든 메시지를 확인했어요." 안내를 그린다.

> **진행 중인 목표 카드는 `GET /goals`(3.1)를 그대로 쓴다.** 홈 전용 목표 API는 없다.

### 5.2 알림 목록 / 읽음 처리

```
GET /notifications
POST /notifications/read   → 204
```

프론트 타입: `AppNotification` (`src/types/notification.ts`)

| `type`              | 언제                                       | 예시 문구                                      |
| ------------------- | ------------------------------------------ | ---------------------------------------------- |
| `nudge`             | AI가 **독촉 목적으로** 먼저 말을 걸었을 때 | `💌 21강 들을 시간이야!`                       |
| `todoAdded`         | 투두가 새로 추가됐을 때                    | `오늘 목표에 "..."가 새로 추가됐어요.`         |
| `todoDone`          | 투두가 완료 체크됐을 때                    | `"..."을 완료했어요. 좋아요! 🎉`               |
| `todoIncomplete`    | 밤 11시까지 미완료 투두가 남아 있을 때     | `아직 완료하지 않은 항목이 2개 있어요.`        |
| `plannerIncomplete` | 밤 11시까지 플래너가 비어 있을 때          | `오늘이 가기 전에 텐미닛 플래너를 채워주세요!` |

- **일반 채팅 메시지는 알림을 만들지 않는다.** `nudge`(독촉)만 대상이며, 어떤 메시지가 독촉인지는 서버/AI가 플래그로 남겨야 한다.
- 최신순, 프론트는 **최대 5개만 유지**(`MAX_NOTIFICATIONS`). 서버도 5개만 줘도 된다.
- 읽음 처리는 **알림 목록을 닫는 순간** 호출하고, 실패해도 화면을 되돌리지 않는다.
- **밤 11시 알림은 서버 스케줄러 + 푸시**가 필요하다. 앱이 꺼져 있으면 프론트 코드가 돌지 않는다.
- 실시간 수신(푸시/SSE)은 미구현. `useNotificationStore.addNotification()`이 준비돼 있어 채널이 생기면 바로 연결할 수 있다.

### 5.3 오늘의 집중

집중 탭(`/focus`)과 홈의 '오늘의 집중' 카드가 함께 쓴다. 프론트 mock은 `src/api/focus.ts`.

```
GET /focus/summary?date=2026-08-03
```

```json
{
  "focusedSeconds": 5040,
  "targetMinutes": 160,
  "streakDays": 7,
  "bestStreakDays": 7,
  "isBestStreak": true
}
```

| 필드             | 설명                                                                    |
| ---------------- | ----------------------------------------------------------------------- |
| `focusedSeconds` | 오늘 누적 집중 시간(초). 집중 탭에서 기록한 세션의 합                   |
| `targetMinutes`  | 오늘 목표 시간(분). **텐미닛 플래너의 '계획' 블록 시간을 모두 더한 값** |
| `streakDays`     | **투두가 체크된 날**이 연속으로 이어진 일수                             |
| `bestStreakDays` | 역대 최고 연속 일수                                                     |
| `isBestStreak`   | 현재 연속이 최고 기록인지                                               |

- **연속 달성일·최고 기록은 서버가 계산해야 한다.** 판정에 과거 전체 이력이 필요해 프론트에서 만들 수 없다(현재 프론트는 임시값 사용).
- 목표 시간은 플래너에서 파생되는 값이라, 서버가 계산해 주거나 프론트가 플래너를 조회해 더한다(현재는 후자).

### 5.4 집중 세션 저장

```
POST /focus/sessions
Body: { "mode": "stopwatch" | "pomodoro", "seconds": 1500, "startedAt": "2026-08-03T09:00:00Z" }
→ 204
```

- **스톱워치**: '종료'를 누른 시점에 그때까지의 시간을 한 건으로 보낸다.
- **뽀모도로**: 집중 25분이 끝날 때마다 한 건씩 보낸다(휴식은 보내지 않는다). 집중 4번마다 휴식이 15분으로 길어진다.
- 서버는 같은 세션이 중복 저장되지 않도록 클라이언트 요청 id를 두거나 시간 겹침을 검사하는 편이 좋다.

### 5.4-1 집중 중 상주 알림 (미구현 — 앱 전환 후)

집중하는 동안 폰 알림바에 계속 남아 있는 알림은 **웹으로 구현할 수 없다.** 현재는 대체 수단만 있다.

| 지금 되는 것                         | 범위                                          |
| ------------------------------------ | --------------------------------------------- |
| 브라우저 탭 제목에 남은 시간 표시    | 모든 브라우저                                 |
| 단계 전환 시 OS 알림(`Notification`) | 권한 허용 시. iOS는 홈 화면 설치한 PWA만 지원 |

**TODO**: Capacitor 래핑 후 `@capacitor/local-notifications`로 상주 알림을 붙인다
(안드로이드 foreground service, iOS Live Activity). 구현 위치는 `src/utils/notify.ts`.

### 5.5 주간·기간별 집중 (미구현)

마이페이지의 주간 그래프·히트맵은 아직 하드코딩이다. 날짜별 집중 시간 목록이 필요하다.

```
GET /focus/daily?from=2026-07-01&to=2026-08-03
→ [{ "date": "2026-07-01", "focusedSeconds": 4200 }, ...]
```

---

## 6. 인증

프론트 타입: `SigninInput`, `SignupInput`, `SocialLoginInput`, `User` (`src/types/auth.ts`)
화면: `Landing` / `Signin` / `Signup`. 토큰 저장·첨부 구조(`lib/auth.ts` + axios 인터셉터)는 이미 준비돼 있다.

### 6.1 이메일 로그인 / 회원가입

```
POST /auth/login    { "email": "a@b.com", "password": "********" }
POST /auth/signup   { "nickname": "지수", "email": "a@b.com", "password": "********" }
```

두 요청 모두 같은 형태로 응답한다.

```json
{
  "accessToken": "eyJhbGciOi...",
  "user": { "id": "u_01H...", "email": "a@b.com", "nickname": "지수", "imageUrl": null }
}
```

- **가입하면 곧바로 로그인 상태**가 된다(별도 로그인 요구하지 않음).
- 프론트 검증: 닉네임 1~10자, 비밀번호 **8자 이상**(`MIN_PASSWORD_LENGTH`) + 확인 일치. **서버에서도 재검증 필요.**
- 실패 응답은 공통 포맷(`code`/`message`)을 따른다. 프론트는 로그인 실패를 "이메일 또는 비밀번호를 다시 확인해주세요"로 뭉뚱그려 보여준다(계정 존재 여부 노출 방지).
- `accessToken`은 `localStorage`에 저장되고 이후 모든 요청에 `Authorization: Bearer`로 붙는다.

> **리프레시 토큰 정책 미정.** 액세스 토큰 만료 시간과 갱신 방식(리프레시 토큰 / 재로그인)을 정해야 한다. 현재 프론트는 401을 받으면 토큰을 지우고 로그인 화면으로 보낸다.

### 6.2 이메일 중복 확인

```
GET /auth/email-available?email=a@b.com
→ { "isAvailable": false }
```

회원가입 버튼을 누른 직후 호출해 "이미 가입된 이메일이에요"를 먼저 보여준다.
(입력 중 실시간 확인은 하지 않는다 — 요청이 과해진다.)

### 6.3 소셜 로그인 (미연결)

```
POST /auth/social   { "provider": "kakao" | "google", "code": "인가 코드" }
→ 6.1과 같은 응답
```

- 프론트는 각 제공자 SDK로 **인가 코드만 받아 서버에 넘기고**, 서버가 제공자에게 토큰을 교환해 우리 토큰을 발급한다.
- **시작 화면의 카카오·구글 버튼은 아직 동작하지 않는다.** SDK 키 발급과 리다이렉트 URI 등록이 필요하다.
- 이미 같은 이메일로 가입된 계정이 있을 때 연결할지, 별도 계정으로 둘지 정해야 한다.

### 6.4 로그아웃

```
POST /auth/logout   → 204
```

서버의 리프레시 토큰·세션을 무효화한다. 프론트는 **실패해도 기기에서는 로그아웃**시킨다(토큰 삭제 + 전역 상태 초기화 후 시작 화면으로 이동).

---

## 7. 프로필 · 설정

```
GET /me
PATCH /me    # nickname, image (multipart)
```

응답: `User` = `{ id, email, nickname?, imageUrl? }` (`src/types/auth.ts`)

- 결과는 전역 상태(`authStore.user`)에 저장해 여러 화면이 함께 쓴다.
- 닉네임 최대 10자(`NICKNAME_MAX_LENGTH`), 사진 검증은 3.3과 동일.
- 로그인·회원가입은 6장 참고. 화면과 mock API가 연결되어 있고, 서버만 붙이면 된다.

### 7.1 설정 조회 / 수정

화면: `src/pages/settings/Settings.tsx` (라우트 `/settings`, 마이페이지 우측 상단 버튼에서 진입)

```
GET   /settings
PATCH /settings     # 바뀐 항목만 부분 전송
```

```json
{
  "notifications": { "enabled": true, "nudge": true, "todo": true, "deadline": true },
  "doNotDisturb": { "enabled": false, "startHour": 0, "endHour": 7 },
  "planner": { "startHour": 6, "endHour": 24 },
  "linkedProviders": ["kakao"]
}
```

프론트 타입: `AppSettings` (`src/types/settings.ts`)

| 그룹              | 필드                              | 뜻                                                           |
| ----------------- | --------------------------------- | ------------------------------------------------------------ |
| `notifications`   | `enabled`                         | 전체 알림 스위치. 끄면 아래 항목은 모두 무시                 |
|                   | `nudge`                           | AI 선톡·독촉 알림                                            |
|                   | `todo`                            | 투두 추가·완료 알림                                          |
|                   | `deadline`                        | 밤 11시 마감 리마인더                                        |
| `doNotDisturb`    | `enabled`, `startHour`, `endHour` | 이 시간대에는 알림을 보내지 않는다 (시작 > 종료면 자정 넘김) |
| `planner`         | `startHour`, `endHour`            | 텐미닛 플래너 표에 그릴 범위 (기본 6~24)                     |
| `linkedProviders` | `"kakao" \| "google"` 배열        | 연결된 소셜 로그인 (읽기 전용 표시)                          |

- **알림 발송 판단은 서버가 한다.** 프론트는 값만 저장하며, 실제로 푸시를 보낼지 말지는 서버 스케줄러가 이 설정을 보고 결정해야 한다.
- `planner` 범위는 기록 탭 플래너 표에 바로 반영된다(`PlannerTimeline`의 `startHour`/`endHour`).
- 프론트는 값을 바꾸는 즉시 화면에 반영하고 `PATCH`를 보낸다(낙관적). 실패하면 이전 값으로 되돌린다.

### 7.2 비밀번호 변경 / 회원 탈퇴

```
POST   /auth/password         { currentPassword, newPassword }   → 204
POST   /auth/password/reset   { email }                          → 204
DELETE /me                                                        → 204
```

- 새 비밀번호는 프론트에서 8자 이상 + 확인 일치를 검사한다. **서버에서도 재검증 필요.**
- **비밀번호 찾기**(`/auth/password/reset`)는 재설정 링크를 메일로 보낸다. 가입되지 않은 이메일이어도 **계정 존재 여부가 드러나지 않도록 항상 같은 응답**을 준다(계정 열거 방지). 프론트도 "메일을 보냈어요"만 표시한다.
- 재설정 링크의 토큰은 **일회용 + 짧은 만료(예: 30분)** 로 두고, 링크를 열었을 때의 새 비밀번호 입력 화면은 아직 없다(웹 페이지로 서버가 제공하거나 딥링크가 필요).
- 비밀번호 찾기 팝업은 **설정 화면과 로그인 화면 두 곳에서** 같은 컴포넌트(`PasswordResetModal`)로 뜬다.
- 탈퇴는 확인 팝업을 거친 뒤 호출하고, 성공하면 토큰을 지우고 시작 화면으로 보낸다.
- **탈퇴 시 목표·대화·투두·플래너 기록 처리 정책은 미정**이다(즉시 삭제 / 유예 기간 / 익명화).

### 7.3 약관·정책 (미연결)

이용약관, 개인정보 처리방침, 오픈소스 라이선스, 문의하기 항목은 화면에 있지만 **연결할 대상이 없다.** 정적 페이지 URL이 정해지면 링크만 걸면 된다.

---

## 8. 백엔드에 확인해야 할 것

1. 에러 응답 포맷 통일 (`code` / `message`)
2. 사진 업로드 방식: multipart 직접 업로드 vs S3 presigned URL
3. 메시지 전송을 SSE로 갈 수 있는지 (프록시 버퍼링·타임아웃)
4. 목표 삭제 시 메시지·투두·플래너 처리 정책
5. 안 읽은 개수 계산 기준 (마지막 읽은 메시지 id 기반 권장)
6. AI 프롬프트 주입 방어 (사용자 `prompt`와 시스템 프롬프트 분리)
7. 목표 진도(`progress`) 스키마 — AI가 사용자에게서 받을 정보 확정 후
8. 밤 11시 독촉 알림용 스케줄러 + 푸시(FCM/APNs) 구성 — **알림 설정값을 참조해 발송 여부를 판단해야 함**
9. 회원 탈퇴 시 데이터 처리 정책 (즉시 삭제 / 유예 / 익명화)
10. 비밀번호 재설정 링크를 어디로 보낼지 (서버 웹페이지 / 앱 딥링크)
11. 약관·개인정보 처리방침 페이지 URL
12. **집중 세션에 목표 id 추가** — 목표별 집중 시간을 집계하려면 `POST /focus/sessions`에 `goalId`가 필요하다
13. 마일스톤 쓰기 API 형태와 목표 완료(`completedAt`) 판정 주체 (AI / 자동)
14. **액세스 토큰 만료·갱신 정책** (리프레시 토큰 사용 여부, 만료 시간)
15. 소셜 로그인 제공자별 키 발급·리다이렉트 URI, 기존 이메일 계정과의 연결 규칙
