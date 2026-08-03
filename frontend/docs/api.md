# API 연동 문서

백엔드에 필요한 엔드포인트와 규칙. 화면 동작은 [`features.md`](./features.md)를 참고한다.

**핵심 모델: 목표(Goal) = 채팅방.** 채팅방, 홈의 목표 카드, 기록의 투두, 모아보기가 모두 같은 id의 목표를 다른 각도로 보여준다.

이름은 둘로 나뉜다.

| 필드    | 뜻                                      | 표시되는 곳                                      |
| ------- | --------------------------------------- | ------------------------------------------------ |
| `name`  | 채팅방 이름(별명). 예: `Buddy`          | 채팅 목록, 채팅 상세 헤더 제목                   |
| `title` | 목표 이름. 예: `UI/UX 디자인 강의 완주` | 홈·기록 카드 제목, 채팅 상세 부제, 모아보기 진도 |

---

## 1. 공통 규칙

- 인스턴스: `src/api/axios.ts`의 `api`. 새 API는 반드시 이걸 통해 호출한다.
- baseURL: `import.meta.env.VITE_API_BASE_URL ?? '/api'`
- 인증: 요청 인터셉터가 `Authorization: Bearer <accessToken>`을 자동 첨부한다.
- 401 응답: 인터셉터가 토큰을 지우고 `/signin`으로 보낸다.
- 타임아웃 10초.
- 시각은 **ISO 8601(UTC)**, 날짜 파라미터는 **사용자 로컬 기준 `YYYY-MM-DD`**.
- 에러 응답 포맷(합의 필요): `{ "code": "GOAL_NOT_FOUND", "message": "목표를 찾을 수 없습니다." }`

**현재 모든 API는 mock이다.** 데이터는 `src/mocks/`에 있고 연동 후 폴더째 삭제한다. `src/api/*.ts` 각 함수의 내부만 실제 호출로 바꾸면 화면 코드는 손댈 필요 없다.

---

## 2. 인증 `api/auth.ts`

```
POST /auth/login    { email, password }
POST /auth/signup   { nickname, email, password }
POST /auth/social   { provider: "kakao" | "google", code }
```

세 요청 모두 같은 응답:

```json
{
  "accessToken": "eyJhbGciOi...",
  "user": { "id": "u_01H", "email": "a@b.com", "nickname": "지수", "imageUrl": null }
}
```

```
GET  /auth/email-available?email=   → { "isAvailable": false }
POST /auth/password        { currentPassword, newPassword }  → 204
POST /auth/password/reset  { email }                          → 204
POST /auth/logout                                             → 204
```

- 가입하면 **곧바로 로그인 상태**가 된다.
- 프론트 검증: 닉네임 1~10자, 비밀번호 8자 이상 + 확인 일치. **서버에서도 재검증 필요.**
- 로그인 실패는 "이메일 또는 비밀번호를 확인해주세요"로 뭉뚱그린다. **비밀번호 재설정도 가입 여부와 무관하게 같은 응답**을 준다(계정 존재 여부 노출 방지).
- 재설정 링크 토큰은 일회용 + 짧은 만료(예: 30분).

**소셜 로그인** — 프론트는 SDK 없이 리다이렉트로 인가 코드를 받는다(`src/lib/oauth.ts`).

1. 버튼 클릭 → 제공자 인가 페이지(`client_id`, `redirect_uri`, `state`)
2. `/auth/callback/:provider?code=&state=`로 복귀 → `state` 검증
3. `POST /auth/social`로 코드 전달 → **서버가 토큰 교환 후 계정 생성·연결**

준비물: 카카오·구글 콘솔 앱 등록 + 리다이렉트 URI(`{도메인}/auth/callback/kakao`, `/google`) → `.env`의 `VITE_KAKAO_CLIENT_ID`, `VITE_GOOGLE_CLIENT_ID`. 키가 없으면 버튼을 눌러도 안내 토스트만 뜬다.

---

## 3. 목표 (= 채팅방) `api/goal.ts`

타입: `Goal`, `GoalDetail`, `CreateGoalInput`, `UpdateGoalInput` (`src/types/goal.ts`)

### 3.1 목록 · 단건

```
GET /goals                 # 목록 (채팅 탭 · 홈 목표 카드 공용)
GET /goals?hidden=true     # 숨긴 목표 (설정 > 히스토리)
GET /goals?completed=true  # 완주한 목표 (마이페이지). 숨긴 목표도 포함한다
GET /goals/{goalId}        # 단건 → GoalDetail
```

```json
{
  "id": "g_01H",
  "name": "Buddy",
  "title": "UI/UX 디자인 강의 완주",
  "imageUrl": "https://cdn.../buddy.png",
  "lastMessage": "오늘 UI/UX 5강 완료 예정이야!",
  "lastMessageAt": "2026-08-03T04:12:00Z",
  "unreadCount": 2,
  "startedAt": "2026-06-04T00:00:00Z",
  "remainingDays": 22,
  "progress": { "current": 21, "total": 50, "unit": "강" }
}
```

| 필드            | 필수 | 비고                                              |
| --------------- | ---- | ------------------------------------------------- |
| `name`          | ✅   | 최대 10자                                         |
| `title`         | ❌   | 최대 50자. 홈·기록 카드 제목                      |
| `imageUrl`      | ❌   | 없으면 이름 첫 글자 아바타                        |
| `lastMessage`   | ✅   | 메시지가 없으면 안내 문구                         |
| `lastMessageAt` | ✅   | 정렬 기준. 메시지가 없으면 생성 시각              |
| `unreadCount`   | ✅   | 99 초과는 프론트가 `99+`로 표시                   |
| `startedAt`     | ❌   | **진도가 없을 때** "○월 ○일부터 진행 중"으로 표시 |
| `remainingDays` | ❌   | 있을 때만 D-day 배지                              |
| `progress`      | ❌   | 없으면 진행률 막대 대신 시작일 안내               |

- **숨긴 목표는 기본 목록에서 제외**한다.
- 정렬은 프론트가 `lastMessageAt` 최신순으로 다시 한다. 검색도 프론트 필터링(이름 + 최근 메시지).
- `GoalDetail` = `Goal` + `prompt`, `dueDate`, `isNotificationMuted`, `isHidden`, `completedAt`
- ⚠️ **`progress` 스키마 미확정.** 진도를 무엇으로 셀지는 AI가 받을 정보와 함께 정해야 한다.

### 3.2 생성 · 수정 · 삭제

```
POST   /goals                     # multipart: name, title, prompt, image
PATCH  /goals/{goalId}            # 보낸 필드만 갱신 → GoalDetail
POST   /goals/{goalId}/complete   → 204
DELETE /goals/{goalId}/messages   → 204   # 대화만 삭제
DELETE /goals/{goalId}            → 204
```

`PATCH` 대상: `name`(1~~10자) · `title`(0~~50자) · `prompt`(0~500자) · `image` · `dueDate` · `isNotificationMuted` · `isHidden`

- **`isNotificationMuted`가 켜진 목표는 알림 발송에서 제외**해야 한다.
- **`isHidden`은 삭제가 아니다.** 목록에서만 빼고 히스토리에서 되돌린다.
- 완료 처리는 `completedAt`을 채운다. 마일스톤을 모두 `done`으로 바꿀지는 합의 필요.
- **완주한 목표에는 알림·선톡·투두를 만들지 않는다.** 서버가 스케줄러·AI 대상에서 제외해야 한다.

**완주 흐름 (미확정 — AI 설계와 함께 정한다)**

대화로 완주하는 것이 자연스럽다. AI가 "완주로 바꿀까?"라고 묻고 사용자가 말로 답하면 **서버가 의도를 파악해 완료 처리**한다. 프론트에 별도 버튼을 두지 않는다.

이때 프론트가 축하 연출을 띄우려면 **"방금 완주됐다"는 신호**가 필요하다. SSE 응답의 `done` 이벤트에 `goalCompleted: true`를 얹는 방식을 제안한다.

```
event: done
data: {"messageId":"m_02","createdAt":"...","goalCompleted":true}
```

현재 프론트에서 완주는 **목표 설정의 '목표 완료 처리'** 로만 가능하다(`POST /goals/{id}/complete`).

- ⚠️ **목표 삭제 시 대화·투두·플래너 처리 정책 미합의.**

**사진 업로드 서버 검증** (프론트 검증은 우회 가능):
용량 5MB · 매직 넘버로 실제 포맷 확인 · 재인코딩/메타데이터 제거 · 파일명 서버 생성 · `Content-Type` 고정 + `nosniff` · 글자수 재검증 · `prompt`를 시스템 프롬프트와 분리(주입 방어)

### 3.3 메시지 (커서 페이지네이션)

```
GET /goals/{goalId}/messages?limit=10
GET /goals/{goalId}/messages?cursor=m_01H&limit=10   # m_01H보다 과거
```

```json
{
  "messages": [
    { "id": "m_01H", "role": "assistant", "content": "오늘 목표는?", "createdAt": "..." }
  ],
  "nextCursor": "m_01G"
}
```

- `messages`는 **최신 → 과거 순**. 프론트가 뒤집어 그린다.
- `nextCursor`는 이번 페이지에서 **가장 오래된 메시지 id**, 더 없으면 `null`. **커서 자신은 응답에 포함하지 않는다.**
- 정렬은 `createdAt` 내림차순 + **같은 시각이면 id로 2차 정렬**(커서 어긋남 방지).
- `limit`은 서버에서 상한을 둔다. 프론트 상수 `MESSAGE_PAGE_SIZE`(현재 10, 연동 시 30 권장).
- 번호(`?page=`) 방식을 쓰지 않는 이유: 과거를 보는 중 새 메시지가 오면 순번이 밀려 중복·누락이 생긴다.

### 3.4 메시지 전송 (SSE)

```
POST /goals/{goalId}/messages
Body: { "content": "오늘 3시간 공부할래" }
Accept: text/event-stream
```

```
event: message_start
data: {"messageId":"m_02","role":"assistant"}

event: delta
data: {"text":"좋아, "}

event: done
data: {"messageId":"m_02","createdAt":"..."}
```

에러 시 `event: error` + `data: {"code":"...","message":"..."}`

- 내 메시지는 프론트가 먼저 그리고, 실패하면 "다시 시도"를 띄운다.
- **파일 첨부는 multipart**(`content` 선택 + `file`). 허용: **jpg·jpeg·png·pdf·txt, 10MB 이하**. 서버에서 재검증하고 실행 권한 없는 스토리지에 저장한다.
- 사진은 말풍선에 썸네일로 그리므로 `file.url`이 바로 표시 가능한 URL이어야 한다.
- SSE는 `EventSource`가 GET만 지원 → `fetch` + `ReadableStream`으로 읽는다. axios 인터셉터를 타지 않아 `Authorization` 헤더를 직접 넣어야 한다.
- 인프라: 프록시 `proxy_buffering off`, 스트리밍 압축 처리, 긴 응답 타임아웃.

### 3.5 읽음 처리

```
POST /goals/{goalId}/read   → 204
```

채팅방 진입 시 호출. **읽어도 목록 순서는 바뀌지 않는다**(정렬은 최근 메시지 기준).

### 3.6 모아보기 `api/archive.ts`

```
GET /goals/{goalId}/attachments?kind=file    # 문서
GET /goals/{goalId}/attachments?kind=image   # 사진
```

```json
{
  "id": "a_01H",
  "kind": "file",
  "name": "요약노트.pdf",
  "sizeBytes": 1258291,
  "uploadedAt": "...",
  "url": "..."
}
```

- **동영상은 받지 않는다.** 유효기간 개념도 없다.
- 프론트가 `uploadedAt` 기준 **연-월로 묶어** 최신 달부터 보여준다.
- 사진 목록에는 **썸네일 URL**이 필요하다.

```
GET /goals/{goalId}/progress
```

```json
{
  "goalId": "g_01H",
  "goalTitle": "UI/UX 디자인 강의 완주",
  "startedAt": "...",
  "completedAt": null,
  "milestones": [{ "id": "p1", "title": "6월까지 기초 10강 완료", "status": "done" }],
  "focusedSeconds": 151200,
  "completedTodoCount": 64,
  "bestMonth": "2026-07"
}
```

| 필드                                                  | 만드는 주체 |
| ----------------------------------------------------- | ----------- |
| `milestones[].title` / `.status`                      | **AI**      |
| `startedAt` / `completedAt`                           | 백엔드      |
| `focusedSeconds` / `completedTodoCount` / `bestMonth` | 백엔드 집계 |

- `status`: `done` / `current` / `upcoming`. 진도율(%)은 프론트가 `done ÷ 전체`로 계산한다.
- 집계 3종은 **없으면 해당 칸을 그리지 않는다.** 연동 초기엔 빼도 된다.
- `completedAt`이 있으면 완료 화면(축하 연출 + 회고 지표)이 된다.

**AI**: 목표 생성 대화에서 로드맵 구성 → 대화·인증을 보고 `status` 갱신 → 마지막 단계가 끝나면 완료 처리 요청
**백엔드**: 마일스톤 쓰기 API, `completedAt` 판정 규칙, **집중 세션에 목표 id 추가**(없으면 `focusedSeconds`를 목표별로 집계 불가), 투두·월별 집계

---

## 4. 기록 `api/record.ts`

### 4.1 날짜별 투두

```
GET /todos?date=2026-08-03
```

```json
{
  "id": "t_01H",
  "goalId": "g_01H",
  "goalTitle": "UI/UX 디자인 강의 완주",
  "date": "2026-08-03",
  "items": [{ "id": "ti_01H", "content": "UI/UX 21강 수강", "isDone": true, "tag": "강의" }]
}
```

- **투두는 날짜마다 새로 만들어진다.** 그날 할 일이 없는 목표는 내려주지 않는다.
- `goalTitle`은 `Goal.title`과 같은 값. 목표 이름이 바뀌면 함께 따라와야 한다.
- 체크 상태는 **AI가 바꾸고 화면은 읽기 전용**.

### 4.2 캘린더 완료 표시

```
GET /todos/marks?month=2026-08
→ { "marks": [{ "date": "2026-08-03", "doneGoalIds": ["g_01H", "g_01H", "g_02K"] }] }
```

- **완료한 항목 하나가 꽃잎 하나.** 그 항목이 속한 목표 id를 항목 수만큼 넣는다.
- 최대 4장까지 그리고 색은 프론트가 목표 id로 정한다(파스텔 5색).
- 달을 넘길 때마다 그 달로 다시 조회한다.

> 사용자가 색을 직접 고르게 하려면 `Goal`에 `color`를 추가하고 그 값을 쓰면 된다.

### 4.3 텐미닛 플래너

```
GET /planners?date=2026-08-03
```

```json
{
  "date": "2026-08-03",
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

- `startMinutes`는 자정 기준 분(08:00 → 480).
- `kind`(실제 기록만): `focus` / `verify` / `manual`
- 계획은 AI가 정하며 사용자가 바꿀 수 없다. 실제 기록 수정 API는 미정.
- 달성률·블록 수는 프론트가 계산한다(10분 = 1블록).

---

## 5. 홈 `api/home.ts`

### 5.1 미리보기

```
GET /home/previews
```

```json
{
  "id": "p_01H",
  "kind": "message",
  "title": "Buddy",
  "subtitle": "AI 스터디 메이트",
  "content": "오늘 UI/UX 5강 완료 예정이야!",
  "receivedAt": "...",
  "linkTo": "/chat/g_01H"
}
```

- **안 읽은 항목만**, **목표당 한 장**.
- `kind`: `message`(💌, 2줄 말줄임) / `notice`(📢) / `ad`(🎁)
- 프론트가 최신순 재정렬 + 4초마다 자동 전환. 메시지 카드를 누르면 목록에서 즉시 제거하고 채팅방으로 이동한다.

> 진행 중인 목표 카드는 `GET /goals`를 그대로 쓴다. 홈 전용 목표 API는 없다.

### 5.2 알림

```
GET  /notifications        # 최신순, 최대 5개
POST /notifications/read   → 204
```

| `type`              | 언제                                       |
| ------------------- | ------------------------------------------ |
| `nudge`             | AI가 **독촉 목적으로** 먼저 말을 걸었을 때 |
| `todoAdded`         | 투두가 추가됐을 때                         |
| `todoDone`          | 투두가 완료됐을 때                         |
| `todoIncomplete`    | 밤 11시까지 미완료 투두가 남았을 때        |
| `plannerIncomplete` | 밤 11시까지 플래너가 비었을 때             |

- **일반 채팅은 알림을 만들지 않는다.** 독촉 여부는 서버/AI가 플래그로 남긴다.
- 읽음 처리는 **목록을 닫는 순간** 호출하고, 실패해도 화면을 되돌리지 않는다.
- **밤 11시 알림은 서버 스케줄러 + 푸시**가 필요하며, 알림 설정(7장)을 참조해 발송 여부를 판단한다.
- 실시간 수신(푸시/SSE)은 미구현.

---

## 6. 집중 `api/focus.ts`

```
GET  /focus/summary?date=2026-08-03
POST /focus/sessions   { mode, seconds, startedAt }  → 204
GET  /focus/weekly?weekStart=2026-08-03
```

```json
// summary
{ "focusedSeconds": 5040, "targetMinutes": 160, "streakDays": 7, "bestStreakDays": 7, "isBestStreak": true }
// weekly
{ "hours": [1, 2, 1.5, 3, 2.2, 0, 0], "diffFromLastWeek": 1.2 }
```

- `targetMinutes`는 **오늘 플래너의 계획 시간 합계**(현재는 프론트가 플래너로 계산).
- `streakDays`는 **투두가 체크된 날**의 연속 일수. **연속·최고 기록은 서버가 계산해야 한다**(과거 전체 이력 필요).
- 세션 저장: 스톱워치는 종료 시 한 건, 뽀모도로는 집중 25분마다 한 건(휴식 제외). 중복 저장 방지 수단 필요.
- `weekly.hours`는 **월~일 7개**(시간 단위), `weekStart`는 그 주의 월요일.
- 히트맵용 기간별 집중(`GET /focus/daily?from=&to=`)은 미구현.

---

## 7. 프로필 · 설정 `api/user.ts`, `api/settings.ts`

```
GET    /me           → User
PATCH  /me           # nickname, image (multipart)
DELETE /me           → 204   # 회원 탈퇴
GET    /settings
PATCH  /settings     # 바뀐 항목만
```

```json
{
  "notifications": { "enabled": true, "nudge": true, "todo": true, "deadline": true },
  "doNotDisturb": { "enabled": false, "startHour": 0, "endHour": 7 },
  "planner": { "startHour": 6, "endHour": 24 },
  "linkedProviders": ["kakao"]
}
```

- `notifications.enabled`가 꺼지면 하위 항목은 모두 무시한다.
- `doNotDisturb`는 시작 > 종료면 자정을 넘긴 것으로 본다.
- `planner` 범위는 플래너 표에 바로 반영된다.
- **알림 발송 판단은 서버가 이 설정을 보고** 해야 한다.
- 프로필 결과는 전역 상태(`authStore.user`)에 저장해 화면들이 공유한다.
- ⚠️ **탈퇴 시 데이터 처리 정책 미합의.**

---

## 8. 결정이 필요한 것

1. 에러 응답 포맷 통일 (`code` / `message`)
2. **액세스 토큰 만료·갱신 정책** (리프레시 토큰 여부, 만료 시간)
3. 사진 업로드 방식: multipart 직접 vs S3 presigned URL
4. SSE 스트리밍 가능 여부 (프록시 버퍼링·타임아웃)
5. **목표 진도(`progress`) 스키마** — AI가 받을 정보와 함께
6. 목표 삭제·회원 탈퇴 시 데이터 처리
7. **집중 세션에 목표 id 추가** — 목표별 집중 시간 집계에 필요
8. 마일스톤 쓰기 API와 목표 완료 판정 주체 (AI / 자동)
9. 안 읽은 개수 계산 기준 (마지막 읽은 메시지 id 권장)
10. 소셜 로그인 키 발급·리다이렉트 URI, 기존 계정 연결 규칙
11. 비밀번호 재설정 링크 목적지 (웹페이지 / 앱 딥링크)
12. 밤 11시 독촉 알림 스케줄러 + 푸시(FCM/APNs)
13. 약관·개인정보 처리방침 페이지 URL
