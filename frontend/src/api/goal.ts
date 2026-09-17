// api/goal.ts
// 목표(=채팅방) 하나를 다루는 API. 채팅 탭과 홈의 '진행 중인 목표'가 함께 쓴다.
import api, { API_BASE_URL, MULTIPART, handleUnauthorized } from './axios';
import { dataUrlToFile, isDataUrl } from './form';
import { getToken } from '@/lib/auth';
import { createId } from '@/utils/uuid';
import type { ChatMessage } from '@/types/chat';
import type { CreateGoalInput, Goal, GoalDetail, UpdateGoalInput } from '@/types/goal';

/** 목표 목록 조회 (채팅 목록 · 홈의 진행 중인 목표 공용) */
export async function fetchGoals(): Promise<Goal[]> {
  const { data } = await api.get<Goal[]>('/goals');
  return data;
}

/** 숨긴 목표 목록 (설정 > 히스토리) */
export async function fetchHiddenGoals(): Promise<Goal[]> {
  const { data } = await api.get<Goal[]>('/goals', { params: { hidden: true } });
  return data;
}

/** 완주한 목표 목록 (마이페이지) */
export async function fetchCompletedGoals(): Promise<Goal[]> {
  const { data } = await api.get<Goal[]>('/goals', { params: { completed: true } });
  return data;
}

/** 목표 단건 조회 (채팅 상세 헤더 · 설정 화면) */
export async function fetchGoal(goalId: string): Promise<GoalDetail> {
  const { data } = await api.get<GoalDetail>(`/goals/${goalId}`);
  return data;
}

/** 목표 생성 (= 채팅방 개설). 사진은 multipart로 올리고 서버가 준 URL을 받는다 */
export async function createGoal(input: CreateGoalInput): Promise<GoalDetail> {
  const form = new FormData();
  form.append('name', input.name);
  form.append('title', input.title);
  form.append('prompt', input.prompt);
  if (input.persona) form.append('persona', input.persona);
  if (isDataUrl(input.imageUrl)) {
    form.append('image', dataUrlToFile(input.imageUrl, 'goal'));
  }

  const { data } = await api.post<GoalDetail>('/goals', form, MULTIPART);
  return data;
}

/**
 * 목표 수정 (이름·목표 이름·사진·프롬프트·기한·알림 끄기·숨기기).
 *
 * 새로 고른 사진은 data URL로 들어오므로 multipart로 올린다.
 * 사진을 바꾸지 않았으면 imageUrl은 이미 서버에 있는 주소라 되돌려 보낼 필요가 없다.
 */
export async function updateGoal(goalId: string, input: UpdateGoalInput): Promise<GoalDetail> {
  if (isDataUrl(input.imageUrl)) {
    const form = new FormData();
    for (const [key, value] of Object.entries(input)) {
      // 폼은 문자열만 실을 수 있어 불리언도 'true'/'false'로 보낸다(서버가 되돌린다)
      if (key !== 'imageUrl' && value !== undefined) form.append(key, String(value));
    }
    form.append('image', dataUrlToFile(input.imageUrl, 'goal'));
    const { data } = await api.patch<GoalDetail>(`/goals/${goalId}`, form, MULTIPART);
    return data;
  }

  const patch: Record<string, unknown> = { ...input };
  delete patch.imageUrl;
  // 날짜 입력을 비우면 ''가 온다. 서버는 날짜 형식만 받으므로 '기한 없음'으로 바꿔 보낸다
  if (patch.dueDate === '') patch.dueDate = null;

  const { data } = await api.patch<GoalDetail>(`/goals/${goalId}`, patch);
  return data;
}

/** 목표 완료 처리. 진도가 100%가 되고 모아보기에 완주 표시가 뜬다 */
export async function completeGoal(goalId: string): Promise<void> {
  await api.post(`/goals/${goalId}/complete`);
}

/** 대화 내용만 삭제. 목표와 기록은 남는다 */
export async function clearGoalMessages(goalId: string): Promise<void> {
  await api.delete(`/goals/${goalId}/messages`);
}

/** 목표 삭제 */
export async function deleteGoal(goalId: string): Promise<void> {
  await api.delete(`/goals/${goalId}`);
}

/** 한 번에 불러오는 메시지 수 */
export const MESSAGE_PAGE_SIZE = 10;

/** 메시지 목록 조회 응답 */
export interface MessagePage {
  /** 최신 → 과거 순 (화면에서는 뒤집어 오래된 것부터 그린다) */
  messages: ChatMessage[];
  /** 다음(더 과거) 페이지를 부를 커서. 더 없으면 null */
  nextCursor: string | null;
}

/**
 * 메시지 목록 조회 (커서 페이지네이션).
 * 커서가 없으면 최신 페이지를, 있으면 그 메시지보다 더 과거를 돌려준다.
 */
export async function fetchMessages(goalId: string, cursor?: string): Promise<MessagePage> {
  const { data } = await api.get<MessagePage>(`/goals/${goalId}/messages`, {
    params: { cursor, limit: MESSAGE_PAGE_SIZE },
  });
  return data;
}

/** SSE 이벤트 한 덩어리 */
interface StreamEvent {
  name: string;
  data: Record<string, unknown>;
}

/** "event: delta\ndata: {...}" 한 덩어리를 파싱한다. data가 JSON이 아니면 건너뛴다 */
function parseStreamEvent(raw: string): StreamEvent | null {
  let name = 'message';
  const dataLines: string[] = [];

  for (const line of raw.split('\n')) {
    const trimmed = line.replace(/\r$/, '');
    if (trimmed.startsWith('event:')) name = trimmed.slice(6).trim();
    else if (trimmed.startsWith('data:')) dataLines.push(trimmed.slice(5).trim());
  }
  if (dataLines.length === 0) return null;

  try {
    return { name, data: JSON.parse(dataLines.join('\n')) as Record<string, unknown> };
  } catch {
    return null;
  }
}

/**
 * 메시지 전송 후 AI 응답 받기.
 *
 * 서버는 SSE(message_start → delta* → done)로만 응답하므로 스트림을 끝까지 읽는다.
 * 다만 화면에는 카톡처럼 한 번에 띄우기로 했으므로, delta를 흘리지 않고
 * 전부 모았다가 done 시점에 완성된 메시지 하나로 돌려준다.
 * (타이핑 효과를 넣고 싶어지면 이 함수에 onDelta 콜백만 더하면 된다)
 *
 * payload.clientId: 전송 키(멱등키). 재시도 때 같은 값을 다시 보내면
 * 서버가 내 메시지를 중복 저장하지 않고 AI 응답만 새로 만들어 준다.
 */
export async function sendMessage(
  goalId: string,
  payload: { content?: string; file?: File; clientId?: string },
): Promise<ChatMessage> {
  if (!goalId) throw new Error('GOAL_NOT_FOUND');

  // SSE는 axios로 못 읽어서 fetch를 쓴다. 토큰·401 처리는 인터셉터와 같게 맞춘다
  const token = getToken();
  const headers: Record<string, string> = { Accept: 'text/event-stream' };
  if (token) headers.Authorization = `Bearer ${token}`;

  // clientId는 전송 키(멱등키)다. 재시도가 같은 값으로 오면 서버가 내 메시지를
  // 새로 만들지 않고 기존 것을 재사용해, 같은 말이 두 번 쌓이지 않는다.
  let body: BodyInit;
  if (payload.file) {
    const form = new FormData();
    if (payload.content) form.append('content', payload.content);
    if (payload.clientId) form.append('clientId', payload.clientId);
    form.append('file', payload.file);
    body = form; // Content-Type은 브라우저가 boundary와 함께 붙인다
  } else {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify({ content: payload.content ?? '', clientId: payload.clientId });
  }

  const response = await fetch(`${API_BASE_URL}/goals/${goalId}/messages`, {
    method: 'POST',
    headers,
    body,
  });

  if (response.status === 401) {
    handleUnauthorized();
    throw new Error('UNAUTHORIZED');
  }
  if (!response.ok || !response.body) {
    throw new Error(`SEND_FAILED_${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let content = '';
  let messageId: string | undefined;
  let createdAt: string | undefined;
  /** done 을 받아야 완성된 답변이다. 중간에 끊긴 것과 구분한다 */
  let isComplete = false;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // 이벤트는 빈 줄로 구분된다. 덜 온 꼬리는 buffer에 남겨 다음 청크와 이어 붙인다
    let boundary = buffer.indexOf('\n\n');
    while (boundary !== -1) {
      const event = parseStreamEvent(buffer.slice(0, boundary));
      buffer = buffer.slice(boundary + 2);
      boundary = buffer.indexOf('\n\n');
      if (!event) continue;

      if (event.name === 'error') {
        throw new Error(String(event.data.message ?? 'AI_ERROR'));
      }
      if (event.name === 'message_start') {
        messageId = String(event.data.messageId);
      }
      if (event.name === 'delta') {
        content += String(event.data.text ?? '');
      }
      if (event.name === 'done') {
        // TODO: done의 goalCompleted 신호로 완주 축하 연출을 띄운다(화면 쪽 작업)
        messageId = String(event.data.messageId ?? messageId);
        createdAt = String(event.data.createdAt ?? '');
        isComplete = true;
      }
    }
  }

  // done 없이 끊겼다면 답변이 잘린 것이다. 확정된 메시지인 척 그리면 안 된다
  // (화면은 이 예외를 받아 '전송 실패 + 재시도'로 처리한다)
  if (!isComplete) throw new Error('STREAM_INCOMPLETE');

  return {
    id: messageId ?? createId(),
    role: 'assistant',
    content,
    createdAt: createdAt || new Date().toISOString(),
  };
}

/** 읽음 처리 */
export async function markGoalAsRead(goalId: string): Promise<void> {
  await api.post(`/goals/${goalId}/read`);
}
