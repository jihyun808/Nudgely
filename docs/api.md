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

- baseURL: `VITE_API_BASE_URL ?? '/api'`, 타임아웃 10초
- 인증: `Authorization: Bearer <accessToken>` 자동 첨부. 401이면 토큰을 지우고 `/signin`으로 보낸다
- 시각은 **ISO 8601(UTC)**, 날짜 파라미터는 **사용자 로컬 기준 `YYYY-MM-DD`**
- 에러 응답 포맷(합의 필요): `{ "code": "GOAL_NOT_FOUND", "message": "목표를 찾을 수 없습니다." }`

**현재 `src/api/`의 9개 파일 전부 mock이다.** 데이터는 `src/mocks/`에 있고 연동 후 폴더째 삭제한다. 각 함수의 내부만 실제 호출로 바꾸면 화면 코드는 손댈 필요 없다.

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
- 프론트 검증: 닉네임 1~10자, 비밀번호 8자 이상. **서버에서도 재검증 필요.**
- 로그인 실패는 "이메일 또는 비밀번호를 확인해주세요"로 뭉뚱그린다. **비밀번호 재설정도 가입 여부와 무관하게 같은 응답**을 준다(계정 존재 여부 노출 방지).
- 재설정 링크 토큰은 일회용 + 짧은 만료(예: 30분).

**소셜 로그인** — 프론트는 SDK 없이 리다이렉트로 인가 코드를 받는다.

1. 버튼 클릭 → 제공자 인가 페이지(`client_id`, `redirect_uri`, `state`)
2. `/auth/callback/:provider?code=&state=`로 복귀 → `state` 검증
3. `POST /auth/social`로 코드 전달 → **서버가 토큰 교환 후 계정 생성·연결**

준비물: 카카오·구글 콘솔 앱 등록 + 리다이렉트 URI(`{도메인}/auth/callback/kakao`, `/google`) → `.env`의 `VITE_KAKAO_CLIENT_ID`, `VITE_GOOGLE_CLIENT_ID`.

---

## 3. 목표 (= 채팅방) `api/goal.ts`

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
| `title`         | ❌   | 최대 50자                                         |
| `imageUrl`      | ❌   | 없으면 이름 첫 글자 아바타                        |
| `lastMessage`   | ✅   | 메시지가 없으면 안내 문구                         |
| `lastMessageAt` | ✅   | 정렬 기준. 메시지가 없으면 생성 시각              |
| `unreadCount`   | ✅   | 99 초과는 프론트가 `99+`로 표시                   |
| `startedAt`     | ❌   | **진도가 없을 때** "○월 ○일부터 진행 중"으로 표시 |
| `remainingDays` | ❌   | 있을 때만 D-day 배지                              |
| `progress`      | ❌   | 없으면 진행률 막대 대신 시작일 안내               |

- **숨긴 목표는 기본 목록에서 제외**한다.
- 정렬·검색은 프론트가 처리한다.
- `GoalDetail` = `Goal` + `prompt`, `persona`, `dueDate`, `isNotificationMuted`, `isHidden`, `completedAt`
- ✅ **`progress` 스키마 확정** — `{ current, total, unit }` (셋 다 필수, 없으면 `progress` 자체가 `null`).
  - `unit`: 세는 단위를 AI가 대화에서 정한다. 예: `강` / `페이지` / `회차`
  - `total`·`unit`은 **AI가 `set_progress` 툴로** 세운다 (목표를 파악한 뒤, 보통 첫 대화).
  - `current`는 두 경로로 바뀐다.
    1. 투두 항목에 붙은 `progressDelta`가 **체크될 때 자동 증감** (해제하면 되돌린다)
    2. 사용자가 "30강까지 했어"처럼 말하면 AI가 `set_progress`로 **절대값 보정**
  - 서버가 `0 ≤ current ≤ total`로 잘라낸다. `progress`가 아직 없으면(AI가 `set_progress`를 안 했으면) `progressDelta`는 무시된다.

### 3.2 생성 · 수정 · 삭제

```
POST   /goals                     # multipart: name, title, prompt, persona, image
PATCH  /goals/{goalId}            # 보낸 필드만 갱신 → GoalDetail
POST   /goals/{goalId}/complete   → 204
DELETE /goals/{goalId}/messages   → 204   # 대화만 삭제
DELETE /goals/{goalId}            → 204
```

`PATCH` 대상: `name`(1~10자) · `title`(0~50자) · `prompt`(0~500자) · `persona` · `image` · `dueDate` · `isNotificationMuted` · `isHidden`

**화면 동작 ↔ 엔드포인트** — 숨기기·되돌리기는 전용 엔드포인트가 아니라 `isHidden` 토글이다. 별도 API로 착각하기 쉬워 표로 정리한다.

| 화면 동작                    | 어디서                   | 호출                                 |
| ---------------------------- | ------------------------ | ------------------------------------ |
| 채팅방 개설                  | 홈 · 채팅 탭의 목표 추가 | `POST /goals`                        |
| 기본 정보·기한·알림 수정     | 목표 설정                | `PATCH /goals/{id}`                  |
| **채팅방 숨기기**            | 목표 설정                | `PATCH /goals/{id}` `{ isHidden: true }` |
| **히스토리에서 되돌리기**    | 설정 > 히스토리          | `PATCH /goals/{id}` `{ isHidden: false }` |
| 숨긴 목표 목록               | 설정 > 히스토리          | `GET /goals?hidden=true`             |
| 목표 완료 처리               | 목표 설정                | `POST /goals/{id}/complete`          |
| 대화 내용만 삭제             | 목표 설정                | `DELETE /goals/{id}/messages`        |
| **채팅방 삭제**              | 목표 설정                | `DELETE /goals/{id}`                 |

- `persona`: `teacher` | `instructor` | `friend`. **선택 사항이고, 고르면 서버가 그에 맞는 기본 시스템 프롬프트를 적용한다.** 현재 화면에서는 개설할 때만 고를 수 있다(수정 UI는 미구현이지만 `PATCH`는 받아두는 편이 낫다).
- **`isNotificationMuted`가 켜진 목표는 알림 발송에서 제외**해야 한다.
- **`isHidden`은 삭제가 아니다.** 목록에서만 빼고 데이터는 그대로 두며, 히스토리에서 되돌린다. 숨긴 동안에도 대화·투두·첨부는 남아 있어야 한다.
- **삭제(`DELETE`)는 되돌릴 수 없다.** 프론트는 두 동작 모두 확인 팝업을 띄운다.
- 완료 처리는 `completedAt`을 채운다.
- **완주한 목표에는 알림·선톡·투두를 만들지 않는다.** 서버가 스케줄러·AI 대상에서 제외해야 한다.
- ⚠️ **목표 삭제 시 대화·투두·플래너 처리 정책 미합의.**

**완주 흐름 (미확정 — AI 설계와 함께 정한다)**

대화로 완주하는 것이 자연스럽다. AI가 "완주로 바꿀까?"라고 묻고 사용자가 말로 답하면 **서버가 의도를 파악해 완료 처리**한다. 이때 프론트가 축하 연출을 띄우려면 "방금 완주됐다"는 신호가 필요하니, SSE `done` 이벤트에 `goalCompleted: true`를 얹는 방식을 제안한다.

현재 프론트에서 완주는 **목표 설정의 '목표 완료 처리'** 버튼(`POST /goals/{id}/complete`)으로만 가능하다.

**사진 업로드 서버 검증** (프론트 검증은 우회 가능): 용량 5MB · 매직 넘버로 실제 포맷 확인 · 재인코딩/메타데이터 제거 · 파일명 서버 생성 · `Content-Type` 고정 + `nosniff` · 글자수 재검증 · **`prompt`를 시스템 프롬프트와 분리(주입 방어)**

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
data: {"messages":[{"messageId":"m_02","content":"좋아, 1강부터 해볼까?","createdAt":"..."}]}
```

에러 시 `event: error` + `data: {"code":"...","message":"..."}`

- **`done.quickReplies`** — AI 가 선택지를 물으면 보기 배열이 온다(없으면 키 자체가 없다).
  프롬프트가 마지막 줄에 `[선택: 추가해줘 / 아니]` 를 적게 하고 서버가 떼어낸다.
  화면은 입력창 위 버튼으로 그리고, 누르면 그 글자를 그대로 보낸다(전송 경로는 직접 입력과 같다).
  보기가 1개거나 5개 이상이거나 20자를 넘으면 떼지 않는다(버튼 없이 글로 남는다).
- **`done.messages` 는 배열이다.** AI 가 길게 답하면 서버가 빈 줄 기준으로 잘라
  여러 말풍선으로 저장한다(카톡처럼 나눠 보내는 모양, 한 턴 최대 5개).
  `delta` 는 자르기 전 원문이 그대로 흐르므로, 화면은 `done` 을 받아 그린다.
- `message_start` 는 서버가 **내 메시지를 저장하고 답을 만들기 시작한** 시점이다.
  화면은 이때 '전송 중' 을 걷고 '입력 중...' 으로 넘어간다.
- 응답 생성은 요청과 분리돼 있다. 답이 오는 중에 채팅방을 나가 SSE 가 끊겨도
  생성은 끝까지 돌아 저장된다(다시 들어오면 답이 와 있다).
- 내 메시지는 프론트가 먼저 그리고, 실패하면 "다시 시도"를 띄운다.
- **파일 첨부는 multipart**(`content` 선택 + `file`). 허용: **jpg·jpeg·png·pdf·txt, 10MB 이하**. 서버에서 재검증하고 실행 권한 없는 스토리지에 저장한다.
- 사진은 말풍선에 썸네일로 그리므로 `file.url`이 바로 표시 가능한 URL이어야 한다.
- **첨부는 내용까지 AI 가 읽는다.** 사진은 이미지로, pdf·txt 는 텍스트를 뽑아
  대화 컨텍스트에 넣는다(텍스트가 없는 스캔 PDF 는 그 사실을 알린다).
  첨부 내용은 사용자가 쓴 글이 아니므로 **'자료' 로 격리해** 넘긴다 — 파일 안의
  지시("이전 지시를 무시하고 …")를 따르지 않게 하는 주입 방어다.
  이번 턴 첨부만 싣는다(매 턴 다시 보내면 비용이 폭증한다).
- 인프라: 프록시 `proxy_buffering off`, 스트리밍 압축 처리, 긴 응답 타임아웃.

### 3.5 읽음 처리

```
POST /goals/{goalId}/read   → 204
```

채팅방 진입 시 호출. **읽어도 목록 순서는 바뀌지 않는다.**

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
- 사진 목록에는 **썸네일 URL**이 필요하다. 지금은 `url` 하나뿐이라 목록·뷰어·다운로드가 같은 값을 쓴다.
  원본이 크면 목록이 무거워지므로 `thumbnailUrl`을 따로 내려주는 편이 낫다. **합의 필요.**

**다운로드** — 파일 카드와 사진 뷰어(`ImageViewer`)의 다운로드 버튼은 모두 `url`을 `<a download>`로 연다.

- `url`이 없으면 프론트가 버튼·링크를 그리지 않는다. **목록 응답에 `url`은 사실상 필수.**
- ⚠️ **브라우저의 `download` 속성은 동일 출처(또는 `blob:`·`data:`) URL에서만 동작한다.**
  첨부를 S3 등 다른 도메인에서 서빙하면 속성이 무시되고 새 탭에서 열리기만 한다. 파일명을 지켜 내려받게 하려면 둘 중 하나가 필요하다.
  1. 서버가 `Content-Disposition: attachment; filename*=UTF-8''<파일명>` 헤더를 붙인다 (presigned URL이면 발급 시 파라미터로 지정)
  2. 첨부를 **우리 도메인 경유**로 서빙한다 (예: `GET /attachments/{id}/download`)
- 파일명이 한글이면 `filename*=UTF-8''` 형식으로 인코딩해야 깨지지 않는다.
- pdf·이미지처럼 브라우저가 그릴 수 있는 형식은 미리보기로 뜨고, zip·xlsx 등은 브라우저가 알아서 내려받는다.

```
GET /goals/{goalId}/progress
```

```json
{
  "goalId": "g_01H",
  "goalTitle": "UI/UX 디자인 강의 완주",
  "startedAt": "...",
  "completedAt": null,
  "progress": { "current": 21, "total": 50, "unit": "강" },
  "milestones": [{ "id": "p1", "title": "6월까지 기초 10강 완료", "status": "done" }],
  "focusedSeconds": 151200,
  "completedTodoCount": 64,
  "bestMonth": "2026-07"
}
```

| 필드                                                  | 만드는 주체 |
| ----------------------------------------------------- | ----------- |
| `milestones[].title` / `.target`                      | **AI**      |
| `milestones[].status`                                 | 백엔드(진도 기준 자동) |
| `progress`                                            | **AI**(set_progress) + 투두 체크 |
| `startedAt` / `completedAt`                           | 백엔드      |
| `focusedSeconds` / `completedTodoCount` / `bestMonth` | 백엔드 집계 |

- **진도율(%)은 `progress`(current/total)로 낸다.** 홈 목표 카드와 같은 값이며,
  프론트는 `utils/progress.ts` 의 같은 함수를 쓴다(두 화면이 갈라지지 않게).
- `milestones` 는 '몇 단계까지 왔나' 를 보여주는 **타임라인**이지 진행률이 아니다.
  `status`(`done`/`current`/`upcoming`)는 **서버가 진도를 보고 자동으로 갱신**한다 —
  경계는 AI 가 준 `target`(그 단계가 끝나는 진도 지점), 없으면 균등 분할이다.
  진도가 아직 없으면(total 미설정) AI 가 준 status 를 그대로 둔다.
- 집계 3종은 **없으면 해당 칸을 그리지 않는다.** 연동 초기엔 빼도 된다.
- `completedAt`이 있으면 완료 화면(축하 연출 + 회고 지표)이 된다.
- 집중 세션의 목표 id 는 집중 탭에서 고른다(선택). 안 고르면 `focusedSeconds` 가 비어 있다.

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
- 최대 4장까지 그리고 색은 프론트가 목표 id로 정한다.
- 달을 넘길 때마다 그 달로 다시 조회한다.

### 4.3 텐미닛 플래너

```
GET /planners?date=2026-08-03
```

```json
{
  "date": "2026-08-03",
  "planned": [{ "id": "p1", "title": "미라클 모닝", "startMinutes": 480, "durationMinutes": 40 }],
  "actual": [
    { "id": "a1", "title": "미라클 모닝", "startMinutes": 480, "durationMinutes": 40, "kind": "manual" }
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
- `kind`: `message` / `notice` / `ad`
- 메시지 카드를 누르면 목록에서 즉시 제거하고 채팅방으로 이동한다.

> 진행 중인 목표 카드는 `GET /goals`를 그대로 쓴다. 홈 전용 목표 API는 없다.

### 5.2 알림

```
GET  /notifications        # 최신순, 최대 5개
POST /notifications/read   → 204   # 전체 읽음
```

```json
{
  "id": "n_01H",
  "type": "nudge",
  "title": "Buddy",
  "body": "오늘 UI/UX 5강 남았어!",
  "createdAt": "2026-08-03T04:12:00Z",
  "isRead": false
}
```

| `type`              | 언제                                       |
| ------------------- | ------------------------------------------ |
| `nudge`             | AI가 **독촉 목적으로** 먼저 말을 걸었을 때 |
| `todoAdded`         | 투두가 추가됐을 때                         |
| `todoDone`          | 투두가 완료됐을 때                         |
| `todoIncomplete`    | 밤 11시까지 미완료 투두가 남았을 때        |
| `plannerIncomplete` | 밤 11시까지 플래너가 비었을 때             |

- `title`은 AI 이름이나 목표 이름, `body`가 본문이다.
- ✅ **경로 문자열은 서버가 만들지 않는다.** 대신 `goalId` 를 내보내고 화면이 경로를
  만든다 — 라우팅이 바뀌어도 지난 알림이 깨지지 않는다.
  - **앱 안 종 아이콘**: 누르면 그 목표의 채팅방으로(`goalId` 가 없으면 기록 탭).
    눌렀는데 아무 일도 없으면 고장으로 보인다.
  - **푸시**: 이동하지 않는다. 앱이 열리는 것까지가 역할이다.
- 대신 `goalId`·`ref` 를 서버가 남긴다(응답에는 없다). `goalId` 는 선톡 하루 상한을
  목표별로 세는 데, `ref`(예: `plan_start:plb_01H`)는 같은 것에 두 번 보내지 않는 데 쓴다.
- **선톡(nudge) 발동 조건 3가지** — 스케줄러가 10분마다 깨어나 사용자 로컬 시각으로 판단한다.
  1. 밤 11시에 오늘 미완료 투두가 있을 때
  2. 계획한 시간이 시작되고 **10분 뒤** (시작 시각에 딱 보내면 이미 하고 있는 사람에게 간다)
  3. 계획한 시간이 끝나고 **30분 뒤**, 그 목표에 아직 미완료 투두가 있을 때
  목표 하나에 **하루 2번까지**. muted·완주 목표와 방해 금지 시간대는 제외한다.
- **문구는 AI가 쓴다.** 목표·계획 이름·남은 할 일을 넣고 페르소나 말투로 한 줄을 받는다
  (2·3번. 1번은 채팅이 아니라 일반 알림이라 고정 문구다). 호출은 **싼 모델**
  (`OPENAI_BATCH_MODEL`)로 한다 — 10분마다 사용자 수만큼 도는 호출이다.
  생성이 실패하거나 키가 없으면 템플릿 문구로 떨어지고, 선톡 자체는 나간다.
- **일반 채팅은 알림을 만들지 않는다.** 독촉 여부는 서버/AI가 플래그로 남긴다.
- 읽음 처리는 **목록을 닫는 순간** 호출하고, 실패해도 화면을 되돌리지 않는다.
- **밤 11시 알림은 서버 스케줄러 + 푸시**가 필요하며, 알림 설정(7장)을 참조해 발송 여부를 판단한다.

**실시간 수신 — 서버 작업 필요**

현재 프론트는 홈 진입 시 + 창 포커스·탭 복귀 시 `GET /notifications`를 다시 부르는 게 전부다. 앱이 열려 있는 동안 새 알림을 밀어주는 채널이 없다. 우선순위 순으로:

1. **폴링 + 델타 (권장, 지금 붙일 수 있음)** — `GET /notifications?since={ISO}`로 그 이후 알림만 받는다. 서버 부담이 거의 없고 프론트만 주기 조회를 추가하면 된다.
2. **SSE 채널** — `GET /notifications/stream`. 채팅 스트리밍(3.4)과 별개 채널이며 프록시 설정이 같이 필요하다.
3. ~~**푸시(FCM/APNs)**~~ → **서버 구현 완료** (5.3). 남은 것은 클라이언트 쪽 — Capacitor 전환과 토큰 발급이다.

---

### 5.3 푸시 `api/device.ts`

| 메서드   | 경로                    | 설명                    |
| ------ | ---------------------- | ---------------------- |
| POST   | `/devices`             | 이 기기로 푸시를 받겠다 (204) |
| DELETE | `/devices/{token}`     | 그만 받겠다 (204)         |

```jsonc
// POST /devices
{ "token": "<FCM 등록 토큰>", "platform": "ios" }  // ios | android | web
```

- **앱이 켜질 때마다 POST 한다.** FCM 토큰은 재설치·데이터 삭제·오랜 미사용으로 조용히
  바뀌는데 바뀌었다고 알려주는 신호가 없다. 매번 보내는 게 유일하게 확실한 방법이다.
- **로그아웃 때 DELETE 를 꼭 부른다.** 안 지우면 그 기기에 이전 사용자의 선톡이 계속 뜬다.
- 토큰이 기본키라 같은 기기에서 계정을 바꿔 로그인하면 소유자만 옮겨간다.
- 남의 토큰은 지울 수 없다(없는 토큰이어도 204 — 로그아웃을 막지 않는다).

**무엇이 푸시로 나가는가**

| | 종 아이콘 | 푸시 |
| --- | --- | --- |
| 선톡(nudge)·투두 추가/완료·밤 11시 점검 | ✅ | ✅ |
| **대화 답변** | ❌ | ✅ (듣는 사람이 없을 때만) |

- 대화 답변은 **목록에 쌓지 않는다.** 내가 방금 말을 걸어서 온 답이라, 남겨 두면 다음에
  앱을 열 때 이미 읽은 말이 안 읽은 알림으로 또 뜬다.
- 채팅방을 보고 있으면(SSE 가 살아 있으면) 보내지 않는다. 화면에 이미 흘렀다.
  앱을 껐거나 방을 나가 SSE 가 끊긴 경우에만 나간다.
- 답변 푸시는 **방해 금지를 보지 않는다.** 사용자가 직접 보낸 말에 대한 답이라
  새벽 2시에 물었으면 새벽 2시에 답이 오는 게 맞다. 전체 알림 스위치는 따른다.

**운영**

- 클라이언트(권한·토큰 발급·등록) 쪽은 [`mobile.md`](./mobile.md) 참고.
- 인증은 서비스 계정 키(FCM HTTP v1). 키가 없으면 발송을 **조용히 건너뛴다** —
  개발·CI 가 푸시 설정 없이 돌아가야 한다. 설정 여부는 `GET /health` 의
  `pushConfigured` 로 확인한다.
  - 로컬: `FCM_CREDENTIALS_FILE` 에 받은 JSON 파일 경로
  - 배포: `FCM_CREDENTIALS_JSON` 에 그 JSON 내용 통째로(호스팅에 파일을 올릴 자리가
    없다). 둘 다 있으면 JSON 이 이긴다.
  - `FCM_PROJECT_ID` 는 비워 두면 키의 `project_id` 를 쓴다.
- 죽은 토큰(`UNREGISTERED`)은 보내다가 알게 되는 즉시 지운다. FCM 이 잠깐 죽은 것
  (5xx)과는 구분한다 — 그걸로 지우면 복구할 길이 없다.
- 푸시 실패는 **절대 호출자를 깨뜨리지 않는다.** 투두 저장이 FCM 때문에 실패하면 안 된다.

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
- 마이페이지 히트맵용 기간별 집중(`GET /focus/daily?from=&to=`)이 필요하다. 현재 하드코딩.

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
- **알림 발송 판단은 서버가 이 설정을 보고** 해야 한다.
- ⚠️ **탈퇴 시 데이터 처리 정책 미합의.**

---

## 8. 결정이 필요한 것

**프론트**: ✅ 끝, 정하면 그대로 붙는다 · 🔧 정해지면 프론트도 고쳐야 한다

|     | 결정할 것                                                     | 프론트                              |
| --- | ------------------------------------------------------------- | ----------------------------------- |
| 1   | 에러 응답 포맷 통일 (`code` / `message`)                      | ✅                                  |
| 2   | **액세스 토큰 만료·갱신 정책** (리프레시 토큰 여부, 만료 시간) | 🔧 지금은 401이면 재로그인. 리프레시 도입 시 인터셉터 수정 |
| 3   | 사진 업로드 방식: multipart 직접 vs S3 presigned URL           | 🔧 presigned면 업로드 흐름 변경     |
| 3-1 | **첨부 다운로드 경로** — 외부 도메인 직링크면 `Content-Disposition` 필요 (3.6) | ✅ `<a download>` 연결 완료 |
| 3-2 | 사진 **썸네일 URL 분리** 여부 (`thumbnailUrl`)                 | ✅ 필드만 늘면 바로 사용            |
| 4   | SSE 스트리밍 가능 여부 (프록시 버퍼링·타임아웃)                | 🔧 스펙 확정 후 구현                |
| 5   | ~~목표 진도(`progress`) 스키마~~ → **확정** (3.1)              | ✅ `{current,total,unit}`, 진도는 AI가 쓴다 |
| 6   | 목표 삭제·회원 탈퇴 시 데이터 처리 (딸린 데이터·보관 기간)     | ✅ 호출·화면 완료                   |
| 7   | **집중 세션에 목표 id 추가** — 목표별 집중 시간 집계에 필요    | 🔧 집중 화면에 목표 선택 UI 없음    |
| 8   | 마일스톤 쓰기 API와 목표 완료 판정 주체 (AI / 자동)            | ✅                                  |
| 9   | 안 읽은 개수 계산 기준 (마지막 읽은 메시지 id 권장)            | ✅ 표시·읽음 호출만                 |
| 10  | 소셜 로그인 키 발급·리다이렉트 URI, 기존 계정 연결 규칙        | ✅ 키만 넣으면 동작                 |
| 11  | 비밀번호 재설정 링크 목적지 (웹페이지 / 앱 딥링크)             | ✅                                  |
| 12  | **알림 실시간 수신 방식** (5.2) 과 밤 11시 스케줄러            | 🔧 방식에 따라 구현                 |
| 13  | ~~알림 `linkTo` 형태~~ → **확정** — 서버는 `goalId` 만 주고 화면이 경로를 만든다(5.2) | ✅ 종 아이콘은 이동, 푸시는 앱만 열림 |
| 14  | 약관·개인정보 처리방침 페이지 URL                              | ✅ 링크만 연결                      |
