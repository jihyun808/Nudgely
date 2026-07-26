# API 연동 문서 (채팅)

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

| 위치                              | 함수                  | 현재 동작                            | 교체할 것                    |
| --------------------------------- | --------------------- | ------------------------------------ | ---------------------------- |
| `src/api/chat.ts`                 | `fetchChatRooms()`    | 600ms 지연 후 `MOCK_CHAT_ROOMS` 반환 | `GET /chat-rooms`            |
| `src/api/chat.ts`                 | `createChatRoom()`    | 300ms 지연 후 로컬 객체 생성         | `POST /chat-rooms`           |
| `src/pages/chat/mockChatRooms.ts` | —                     | 임시 데이터                          | 연동 후 **파일 삭제**        |
| `src/pages/chat/Chat.tsx`         | `handleOpenRoom()`    | `console.log`만                      | 상세 화면 라우팅             |
| `CreateChatRoomModal` 사진        | `FileReader` data URL | 브라우저 안에만 존재                 | 서버 업로드 후 받은 URL 사용 |

교체 시 `src/api/chat.ts` 두 함수의 내부만 바꾸면 되고, 화면 코드(`Chat.tsx`)는 손댈 필요 없다.
반환 타입은 `src/types/chat.ts`의 `ChatRoom`으로 고정되어 있다.

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

## 4. 채팅 상세 화면에 필요한 API (다음 작업)

### 4.1 메시지 목록 (커서 페이지네이션)

```
GET /chat-rooms/{roomId}/messages?cursor={messageId}&limit=30
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

- `role`: `"user" | "assistant"`
- 위로 스크롤하며 과거를 불러오므로 **최신 → 과거 순**으로 주고, `nextCursor`가 `null`이면 끝.

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

응답: `ChatRoom` + `description`, `prompt` (설정 화면에서 기존 값을 채우기 위해 필요)

---

## 5. 백엔드에 확인해야 할 것

1. 에러 응답 포맷 통일 (`code` / `message`)
2. 사진 업로드 방식: multipart 직접 업로드 vs S3 presigned URL
3. `lastMessage`를 목록 API가 함께 주는지 (N+1 없이)
4. 메시지 전송을 SSE로 갈 수 있는지 (인프라가 스트리밍을 끊지 않는지 — nginx `proxy_buffering off` 등)
5. 안 읽은 개수 계산 기준 (마지막 읽은 메시지 id 기반 권장)
6. AI 프롬프트 주입 방어: `prompt`는 사용자 입력이므로 서버에서 시스템 프롬프트와 명확히 분리해 넣어야 한다
