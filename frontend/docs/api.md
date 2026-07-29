# API 연동 문서 (홈 · 채팅 · 기록)

프론트에서 아직 mock으로 동작하는 지점과, 백엔드에 필요한 API 스펙을 정리한 문서.
메시지 전송은 **SSE 스트리밍**으로 확정했다 (4.2 참고).

---

## 1. 공통 규칙

- 인스턴스: `src/api/axios.ts`의 `api` (axios). 새 API는 반드시 이걸 통해서 호출한다.
- baseURL: `import.meta.env.VITE_API_BASE_URL ?? '/api'`
- 인증: 요청 인터셉터가 `Authorization: Bearer <accessToken>`을 자동 첨부한다.
- 401 응답: 인터셉터가 토큰을 지우고 `/signin`으로 보낸다. 개별 화면에서 처리할 필요 없다.
- 타임아웃: 10초
- 시간 값: 모든 날짜/시각은 **ISO 8601 문자열(UTC)**. 프론트에서 `src/utils/date.ts`가 상대 시간으로 변환한다.
- 에러 응답 포맷(합의 필요):
  ```json
  { "code": "CHAT_ROOM_NOT_FOUND", "message": "채팅방을 찾을 수 없습니다." }
  ```

---

## 2. 지금 mock으로 돌아가는 지점

| 위치                              | 함수                   | 현재 동작                            | 교체할 것                     |
| --------------------------------- | ---------------------- | ------------------------------------ | ----------------------------- |
| `src/api/chat.ts`                 | `fetchChatRooms()`     | 600ms 지연 후 `MOCK_CHAT_ROOMS` 반환 | `GET /chat-rooms`             |
| `src/api/chat.ts`                 | `createChatRoom()`     | 300ms 지연 후 로컬 객체 생성         | `POST /chat-rooms`            |
| `src/api/chat.ts`                 | `fetchChatRoom()`      | 300ms 지연 후 mock 목록에서 찾기     | `GET /chat-rooms/{id}`        |
| `src/api/chat.ts`                 | `fetchMessages()`      | 1번 방 mock 대화를 10개씩 커서 분할  | `GET .../messages?cursor=`    |
| `src/api/chat.ts`                 | `sendMessage()`        | 900ms 후 고정 문구 응답              | `POST .../messages` (SSE)     |
| `src/api/chat.ts`                 | `markChatRoomAsRead()` | 아무것도 안 함                       | `POST .../read`               |
| `src/pages/chat/mockChatRooms.ts` | —                      | 임시 데이터                          | 연동 후 **파일 삭제**         |
| `src/pages/chat/mockMessages.ts`  | —                      | 임시 데이터                          | 연동 후 **파일 삭제**         |
| `CreateChatRoomModal` 사진        | `FileReader` data URL  | 브라우저 안에만 존재                 | 서버 업로드 후 받은 URL 사용  |
| `ChatDetail` 메뉴 버튼            | `console.log`만        | 미구현                               | 채팅방 메뉴 화면 연결         |
| `src/api/record.ts`               | `fetchTodoLists()`     | 날짜로 mock 필터링                   | `GET /todo-lists?date=`       |
| `src/api/home.ts`                 | `fetchHomeSummary()`   | 500ms 지연 후 mock 반환              | `GET /home`                   |
| `src/api/home.ts`                 | `fetchNotifications()` | 500ms 지연 후 mock 반환              | `GET /notifications`          |
| `Home` 집중 시작하기 버튼         | 동작 없음              | 미구현                               | 집중 세션 화면 연결           |
| `Home` 목표 추가하기 카드         | 채팅 탭 개설 팝업 열기 | —                                    | 목표/채팅방 모델 확정 시 조정 |
| `FocusSummary`                    | 값 하드코딩            | 미구현                               | 집중 탭 · 연속 달성일 API     |

교체 시 `src/api/chat.ts` 각 함수의 내부만 바꾸면 되고, 화면 코드(`Chat.tsx`, `ChatDetail.tsx`)는 손댈 필요 없다.
반환 타입이 `src/types/chat.ts`의 `ChatRoom` / `ChatRoomDetail` / `ChatMessage`로 고정되어 있기 때문이다.

---

## 3. 구현 완료 화면에 필요한 API

### 3.1 채팅방 목록 조회

```
GET /chat-rooms
```

응답:

```json
{
  "rooms": [
    {
      "id": "c_01H...",
      "name": "Buddy",
      "imageUrl": "https://cdn.../buddy.png",
      "lastMessage": "오늘 UI/UX 5강 완료 예정이야!",
      "lastMessageAt": "2026-07-26T04:12:00Z",
      "unreadCount": 2
    }
  ]
}
```

프론트 타입: `ChatRoom` (`src/types/chat.ts`)

| 필드            | 타입        | 필수 | 비고                                             |
| --------------- | ----------- | ---- | ------------------------------------------------ |
| `id`            | string      | ✅   |                                                  |
| `name`          | string      | ✅   | 최대 10자                                        |
| `imageUrl`      | string      | ❌   | 없으면 프론트가 이름 첫 글자 아바타를 그린다     |
| `lastMessage`   | string      | ✅   | 메시지가 없는 새 방이면 빈 문자열 대신 안내 문구 |
| `lastMessageAt` | string(ISO) | ✅   | 메시지가 없으면 방 생성 시각                     |
| `unreadCount`   | number      | ✅   | 0이면 배지 없음. 99 초과는 프론트가 `99+`로 표시 |

정렬: **프론트에서 다시 정렬한다**(`src/pages/chat/sortChatRooms.ts` — `lastMessageAt` 최신순). 서버도 같은 순서로 주면 첫 렌더가 자연스럽다.

> 검색은 현재 프론트에서 필터링한다(방 이름 + 최근 메시지). 방 개수가 수십 개를 넘어가면 `GET /chat-rooms?q=` 서버 검색으로 옮긴다.

### 3.2 채팅방 개설

```
POST /chat-rooms
Content-Type: multipart/form-data
```

| 파트          | 타입 | 필수 | 제한                            |
| ------------- | ---- | ---- | ------------------------------- |
| `name`        | text | ✅   | 1~10자, 공백만 불가             |
| `description` | text | ❌   | 0~50자                          |
| `prompt`      | text | ❌   | 0~500자. AI 시스템 프롬프트     |
| `image`       | file | ❌   | jpg/jpeg/png/webp/gif, 5MB 이하 |

응답: `201` + 생성된 `ChatRoom` 객체 (위 3.1과 동일 스키마)

프론트 입력 타입: `CreateChatRoomInput`, 글자수 제한은 `CHAT_ROOM_LIMITS` 상수로 관리.

> 현재 프론트는 사진을 data URL로만 들고 있다. 실제 연동 시 `CreateChatRoomInput`에 `imageFile?: File`을 추가하고 `FormData`로 보내는 방식으로 바꾼다.

**서버 측 필수 검증** — 프론트 검증(`src/utils/image.ts`)은 우회 가능하므로 서버에서 반드시 다시 해야 한다:

1. 용량 5MB 제한 (프록시/서버 양쪽)
2. 매직 넘버로 실제 포맷 확인 (확장자·Content-Type만 믿지 않는다)
3. 이미지 재인코딩 또는 메타데이터 제거 후 저장 (EXIF·삽입 스크립트 제거)
4. 저장 파일명은 서버가 새로 생성 (사용자 파일명 그대로 쓰지 않는다 — 경로 조작 방지)
5. 정적 서빙 시 `Content-Type` 고정 + `X-Content-Type-Options: nosniff`
6. 글자수 제한(10/50/500)도 서버에서 재검증

---

## 4. 채팅 상세 화면에 필요한 API

화면은 구현 완료(`src/pages/chat/ChatDetail.tsx`, 라우트 `/chat/:roomId`)이고 mock으로 동작한다.
프론트 타입: `ChatMessage`, `ChatRoomDetail` (`src/types/chat.ts`)

### 4.1 메시지 목록 (커서 페이지네이션) — 프론트 구현 완료

```
GET /chat-rooms/{roomId}/messages?limit=10            # 최신 페이지
GET /chat-rooms/{roomId}/messages?cursor=m_01H&limit=10  # m_01H보다 더 과거
```

```json
{
  "messages": [
    {
      "id": "m_01H...",
      "role": "assistant",
      "content": "오늘 목표는 뭐야?",
      "createdAt": "2026-07-26T04:12:00Z"
    }
  ],
  "nextCursor": "m_01G..."
}
```

| 필드         | 설명                                                                 |
| ------------ | -------------------------------------------------------------------- |
| `messages`   | **최신 → 과거 순**. 프론트가 뒤집어 오래된 것부터 그린다             |
| `nextCursor` | 이번 페이지에서 **가장 오래된 메시지의 id**. 더 과거가 없으면 `null` |

- `cursor`는 **"이 메시지보다 더 과거"** 를 뜻한다. 커서 자신은 응답에 **포함하지 않는다**(중복 방지).
- `role`: `"user" | "assistant"`
- 파일 첨부 메시지는 `file: { name, caption?, url? }`를 함께 준다.
- 페이지 크기는 프론트 상수 `MESSAGE_PAGE_SIZE`(현재 10, 연동 시 30 정도 권장)로 관리하고 `limit`으로 넘긴다.
- **번호 방식(`?page=2`)이 아니라 커서를 쓰는 이유**: 과거를 보는 도중 새 메시지가 오면 전체 순번이 밀려 이미 본 메시지가 다시 나오거나 건너뛰어진다. 기준점(메시지 id)을 쓰면 그런 어긋남이 없다.

**프론트 동작** (`ChatDetail.tsx`)

1. 진입 시 커서 없이 최신 페이지를 받아 뒤집어 그린다
2. 목록을 위로 스크롤해 상단 80px 안에 들어오면 `nextCursor`로 다음 요청
3. 받은 페이지를 목록 **앞쪽에 이어 붙이고**, 늘어난 높이만큼 `scrollTop`을 보정해 보던 위치를 유지한다
4. 불러오는 동안 상단에 "이전 대화를 불러오는 중..." 표시, `nextCursor`가 `null`이면 더 요청하지 않는다

### 4.2 메시지 전송 — SSE 스트리밍 (확정)

```
POST /chat-rooms/{roomId}/messages
Body: { "content": "오늘 3시간 공부할래" }
Accept: text/event-stream
```

응답(SSE):

```
event: message_start
data: {"messageId":"m_02...","role":"assistant"}

event: delta
data: {"text":"좋아, "}

event: delta
data: {"text":"3시간이면 "}

event: done
data: {"messageId":"m_02...","createdAt":"2026-07-26T04:13:00Z"}
```

에러 시: `event: error` + `data: {"code":"...","message":"..."}`

**왜 SSE로 정했는가** (전송 방식 비교):

| 방식                          | 특징                                 | 이 서비스에                                                                                            |
| ----------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| 일반 REST (한 번에 완성 응답) | 가장 간단                            | AI 답변이 5~10초 걸리는 동안 화면이 멈춘 것처럼 보인다                                                 |
| **SSE (Server-Sent Events)**  | 서버→클라 단방향 스트림. HTTP 그대로 | ✅ **채택.** 타이핑되듯 한 글자씩 나오는 AI 채팅 UX에 딱 맞고, 서버 구현이 WebSocket보다 훨씬 단순하다 |
| WebSocket                     | 양방향 상시 연결                     | AI 채팅은 항상 "내가 보내면 답이 온다"라서 상시 양방향 연결이 필요하지 않다                            |
| 폴링                          | 주기적으로 재조회                    | 서버·배터리 낭비. 쓰지 않는다                                                                          |

사용자가 보낸 메시지는 프론트가 먼저 화면에 그려두고(낙관적 업데이트), 스트림이 끝나면 서버 id로 교체한다.
현재 프론트는 `status: 'sending' | 'failed'`로 이 상태를 관리하고, 실패 시 말풍선 아래에 "다시 시도"를 띄운다.

**파일 첨부 전송**은 별도 요청이다:

```
POST /chat-rooms/{roomId}/messages
Content-Type: multipart/form-data   # content(text, 선택) + file
```

- 첨부 파일 제한: 10MB (`ChatInputBar`의 `MAX_ATTACHMENT_SIZE`)
- 이미지 외 확장자(pdf 등)도 허용하므로 서버에서 **확장자 화이트리스트 + 실행 권한 없는 스토리지 저장**이 필요하다.

> SSE는 `EventSource`로 GET만 가능하므로, POST 스트리밍은 `fetch` + `ReadableStream`으로 읽는다. 이 경우 axios 인터셉터를 타지 않으니 `Authorization` 헤더를 직접 넣어야 한다.

### 4.3 읽음 처리

```
POST /chat-rooms/{roomId}/read
```

응답: `204`. 호출 후 목록의 `unreadCount`가 0이 된다.
정렬은 안 읽음 여부와 무관하므로 **읽어도 목록 순서는 바뀌지 않는다**.

### 4.4 채팅방 설정 수정 / 삭제

```
PATCH /chat-rooms/{roomId}   # name, description, prompt, image 부분 수정
DELETE /chat-rooms/{roomId}
```

이름·사진·설명·프롬프트는 모두 개설 후 수정 가능한 값으로 설계되어 있다.
`PATCH`는 보낸 필드만 갱신하고, 응답으로 갱신된 `ChatRoom`을 준다.

### 4.5 채팅방 상세 조회

```
GET /chat-rooms/{roomId}
```

응답: `ChatRoomDetail` = `ChatRoom` + `description`, `prompt`

- `description`은 상세 헤더의 부제(세션 이름)로도 쓴다.
- `prompt`는 설정 화면에서 기존 값을 채우는 데 필요하다.

---

## 5. 기록 탭 (캘린더 · 투두)

화면: `src/pages/record/Record.tsx` (라우트 `/record`). mock은 `src/api/record.ts` → `fetchTodoLists()`.

### 5.1 투두 리스트 목록 조회

```
GET /todo-lists?date=2026-07-26
```

`date`는 **사용자 로컬 기준 YYYY-MM-DD** (프론트 `formatDateKey()`가 만든다). 캘린더에서 날짜를 고를 때마다 재요청한다.

```json
{
  "todoLists": [
    {
      "id": "tl_01H...",
      "title": "이지현의 UIUX 유튜브 강의",
      "date": "2026-07-26",
      "items": [{ "id": "ti_01H...", "content": "UI/UX 21강 수강", "isDone": true, "tag": "강의" }]
    }
  ]
}
```

프론트 타입: `TodoList`, `TodoItem` (`src/types/record.ts`)

- 투두는 **날짜별로 할당**된다. 요청한 `date`에 해당하는 것만 내려준다.
- `title`과 `items`는 **AI와의 대화로 자동 생성·갱신**된다. 화면에는 체크를 바꾸는 UI가 없다(읽기 전용).
- `tag`는 선택값. 없으면 칩을 표시하지 않는다.
- 여러 개를 좌우 슬라이드로 넘겨보므로, 순서가 의미 있다면 서버가 정렬해서 준다.
- 해당 날짜에 투두가 없으면 빈 배열. 프론트는 "이 날짜에는 투두 리스트가 없어요"를 표시한다.
- 실패 시 프론트는 "다시 시도" 버튼을 띄우고 같은 날짜로 재요청한다.

### 5.2 아직 미구현 (스펙만 필요할 때 참고)

| 항목                   | 필요한 것                                              |
| ---------------------- | ------------------------------------------------------ |
| 캘린더 날짜별 기록 점  | `GET /records?year=&month=` → 기록이 있는 날짜 목록    |
| 오늘 총 집중 시간 카드 | `GET /focus-sessions/summary?date=` → 총 집중 시간(초) |
| 텐미닛 플래너          | 스펙 미정                                              |

---

## 6. 홈 탭 (요약 · 알림)

화면: `src/pages/home/Home.tsx` (라우트 `/home`). mock은 `src/api/home.ts`.

### 6.1 홈 요약 조회

```
GET /home
```

```json
{
  "previews": [
    {
      "id": "p_01H...",
      "kind": "message",
      "title": "Buddy",
      "subtitle": "AI 스터디 메이트",
      "content": "오늘 UI/UX 5강 완료 예정이야! 집중 시작해볼까? 💪",
      "receivedAt": "2026-07-28T09:00:00Z",
      "linkTo": "/chat/c_01H..."
    }
  ],
  "goals": [
    {
      "id": "g_01H...",
      "title": "UI/UX 디자인 강의 완주",
      "remainingDays": 22,
      "current": 21,
      "total": 50,
      "unit": "강"
    }
  ]
}
```

프론트 타입: `HomeSummary` (`src/types/home.ts`)

**previews** — 홈 최상단에서 세로로 넘겨보는 미리보기 카드. **안 읽은** 항목만 내려준다.

- `kind`: `"message"`(안 읽은 채팅·선톡) / `"notice"`(공지사항) / `"ad"`(광고·이벤트)
- 정렬은 프론트가 `receivedAt` 최신순으로 다시 한다. 최신이 첫 장.
- `kind: "message"`는 아이콘 💌 고정 + 본문 **2줄 말줄임**. 공지·광고는 각각 📢 / 🎁이고 줄 수를 제한하지 않는다.
- 안 읽은 항목이 없으면 빈 배열 → "모든 메시지를 확인했어요." 안내 카드를 대신 그린다.
- 여러 장일 때 2초마다 자동으로 다음 장으로 넘어간다(사용자가 직접 넘기면 6초간 멈춤).
- 홈 화면은 **창 포커스/탭 복귀 시 자동으로 재조회**한다. 채팅방에 다녀오면 읽은 카드가 사라진다.

**goals** — 진행 중인 목표. 여러 개를 좌우 캐러셀로 넘겨본다.

- `remainingDays`는 **기한이 있을 때만** 준다. 없으면 D-day 배지를 그리지 않는다.
- `current`/`total`/`unit`(진도율)은 **아직 확정 스펙이 아니다.** AI가 사용자에게서 무엇을 받아 진도를 세는지(강의 수·페이지·회차 등) 정한 뒤 스키마를 다시 맞춰야 한다. 프론트에는 같은 내용의 TODO를 `src/types/home.ts`와 `GoalCard`에 달아뒀다.
- 진행률(%)은 프론트가 `current/total`로 계산한다.

**previews의 읽음 처리** — 메시지 카드를 누르면 프론트가 그 카드를 목록에서 즉시 제거하고 채팅방으로 이동한다(낙관적 처리). 서버 쪽 읽음 확정은 채팅방 진입 시의 `POST /chat-rooms/{roomId}/read`이고, 다음 홈 조회에서 최종 반영된다. 미리보기는 **방당 1장**(그 방의 가장 최근 안 읽은 메시지)이다.

### 6.2 오늘의 집중 (미구현 — 스펙 제안)

화면은 **값이 전부 하드코딩**이고 아무 API도 호출하지 않는다. 연결할 때 아래 형태를 제안한다.

```
GET /focus/summary?date=2026-07-28
```

```json
{
  "todayMinutes": 84,
  "targetMinutes": 180,
  "streakDays": 7,
  "bestStreakDays": 7,
  "isBestStreak": true
}
```

| 필드             | 설명                                                                 |
| ---------------- | -------------------------------------------------------------------- |
| `todayMinutes`   | 오늘 누적 집중 시간(분). **집중 탭** 구현 후 그쪽 세션 기록에서 집계 |
| `targetMinutes`  | 하루 목표 시간(분)                                                   |
| `streakDays`     | **투두가 체크된 날**이 연속으로 이어진 일수                          |
| `bestStreakDays` | 역대 최고 연속 일수                                                  |
| `isBestStreak`   | 현재 연속이 최고 기록인지                                            |

> **연속 달성일과 최고 기록은 서버가 계산해서 내려줘야 한다.** 판정에 과거 전체 체크 이력이 필요한데, 프론트는 오늘 화면에 필요한 데이터만 받으므로 계산할 수 없다(전체 이력을 다 내려받는 건 낭비이기도 하다).
> `1h 24m` 같은 표기와 목표 대비 표시는 프론트가 분 단위 원값으로 만든다.

### 6.3 알림 목록 조회

```
GET /notifications
```

```json
{
  "notifications": [
    {
      "id": "n_01H...",
      "type": "nudge",
      "title": "Buddy",
      "body": "💌 21강 들을 시간이야! 30분만 같이 달려볼까?",
      "createdAt": "2026-07-28T09:00:00Z",
      "isRead": false,
      "linkTo": "/chat/c_01H..."
    }
  ]
}
```

프론트 타입: `AppNotification` (`src/types/notification.ts`)

| `type`              | 언제                                       | 예시 문구                                      |
| ------------------- | ------------------------------------------ | ---------------------------------------------- |
| `nudge`             | AI가 **독촉 목적으로** 먼저 말을 걸었을 때 | `💌 21강 들을 시간이야! 30분만 같이 달려볼까?` |
| `todoAdded`         | 투두가 새로 추가됐을 때                    | `7월 28일 목표에 "..."가 새로 추가됐어요.`     |
| `todoDone`          | 투두가 완료 체크됐을 때                    | `"..."을 완료했어요. 좋아요! 🎉`               |
| `todoIncomplete`    | 밤 11시까지 미완료 투두가 남아 있을 때     | `아직 완료하지 않은 항목이 2개 있어요.`        |
| `plannerIncomplete` | 밤 11시까지 텐미닛 플래너가 비어 있을 때   | `오늘이 가기 전에 텐미닛 플래너를 채워주세요!` |

- **일반 채팅 메시지는 알림을 만들지 않는다.** `nudge`(독촉)만 알림 대상이다. 어떤 메시지가 독촉인지는 서버(또는 AI)가 판단해 플래그를 남겨야 한다.
- 최신순 정렬. 프론트는 **최대 5개만 유지**하고 넘치면 오래된 것부터 버린다(`MAX_NOTIFICATIONS`). 서버도 5개만 줘도 된다.
- `linkTo`는 프론트 라우트 경로. 서버가 `roomId` 같은 원본 id를 주고 프론트가 경로를 만드는 방식으로 바꿔도 된다.

### 6.4 알림 읽음 처리

```
POST /notifications/read
```

응답: `204`. 프론트는 **알림 목록을 닫는 순간** 호출하고, 실패해도 화면을 되돌리지 않는다(다음 조회 때 맞춰짐).

> 실시간 수신(푸시/SSE)은 미구현. 지금은 홈 진입 시 조회만 한다. `useNotificationStore.addNotification()`이 준비되어 있어 수신 채널이 생기면 그대로 연결하면 된다.

---

## 7. 백엔드에 확인해야 할 것

1. 에러 응답 포맷 통일 (`code` / `message`)
2. 사진 업로드 방식: multipart 직접 업로드 vs S3 presigned URL
3. `lastMessage`를 목록 API가 함께 주는지 (N+1 없이)
4. 메시지 전송을 SSE로 갈 수 있는지 (인프라가 스트리밍을 끊지 않는지 — nginx `proxy_buffering off` 등)
5. 안 읽은 개수 계산 기준 (마지막 읽은 메시지 id 기반 권장)
6. AI 프롬프트 주입 방어: `prompt`는 사용자 입력이므로 서버에서 시스템 프롬프트와 명확히 분리해 넣어야 한다
