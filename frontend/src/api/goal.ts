// api/goal.ts
// 목표(=채팅방) 하나를 다루는 API. 채팅 탭과 홈의 '진행 중인 목표'가 함께 쓴다.
import { MOCK_GOALS } from '@/mocks/goals';
import { MOCK_MESSAGES } from '@/mocks/messages';
import type { ChatMessage } from '@/types/chat';
import type { CreateGoalInput, Goal, GoalDetail, UpdateGoalInput } from '@/types/goal';

/** mock 지연 (연동 시 삭제) */
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 목표 목록 조회 (채팅 목록 · 홈의 진행 중인 목표 공용).
 * TODO: `api.get<Goal[]>('/goals')`로 교체.
 */
export async function fetchGoals(): Promise<Goal[]> {
  await delay(600);
  // 숨긴 목표는 목록에서 빠진다
  return MOCK_GOALS.filter(({ isHidden }) => !isHidden);
}

/**
 * 숨긴 목표 목록 (설정 > 히스토리).
 * TODO: `api.get<Goal[]>('/goals', { params: { hidden: true } })`로 교체.
 */
export async function fetchHiddenGoals(): Promise<Goal[]> {
  await delay(400);
  return MOCK_GOALS.filter(({ isHidden }) => isHidden);
}

/**
 * 완주한 목표 목록 (마이페이지).
 * TODO: `api.get<Goal[]>('/goals', { params: { completed: true } })`로 교체.
 */
export async function fetchCompletedGoals(): Promise<Goal[]> {
  await delay(400);
  return MOCK_GOALS.filter(({ completedAt }) => completedAt).sort(
    (a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime(),
  );
}

/**
 * 목표 단건 조회 (채팅 상세 헤더 · 설정 화면).
 * TODO: `api.get<GoalDetail>(`/goals/${goalId}`)`로 교체.
 */
export async function fetchGoal(goalId: string): Promise<GoalDetail> {
  await delay(300);
  const goal = MOCK_GOALS.find(({ id }) => id === goalId);
  if (!goal) throw new Error('GOAL_NOT_FOUND');
  return goal;
}

/**
 * 목표 생성 (= 채팅방 개설).
 * TODO: 사진은 FormData로 업로드하고 서버가 준 URL을 사용한다.
 */
export async function createGoal(input: CreateGoalInput): Promise<Goal> {
  await delay(300);
  return {
    id: crypto.randomUUID(),
    name: input.name,
    imageUrl: input.imageUrl,
    title: input.title || undefined,
    lastMessage: '새로운 목표가 만들어졌어요',
    lastMessageAt: new Date().toISOString(),
    unreadCount: 0,
  };
}

/**
 * 목표 수정 (이름·목표 이름·사진·프롬프트·기한·알림 끄기).
 * TODO: `api.patch<GoalDetail>(`/goals/${goalId}`, input)`으로 교체. 사진은 FormData로 보낸다.
 */
export async function updateGoal(goalId: string, input: UpdateGoalInput): Promise<GoalDetail> {
  const goal = await fetchGoal(goalId);
  return { ...goal, ...input };
}

/**
 * 목표 완료 처리. 진도가 100%가 되고 모아보기에 완주 표시가 뜬다.
 * TODO: `api.post(`/goals/${goalId}/complete`)`로 교체.
 */
export async function completeGoal(goalId: string): Promise<void> {
  if (!goalId) throw new Error('GOAL_NOT_FOUND');
  await delay(400);
}

/**
 * 대화 내용만 삭제. 목표와 기록은 남는다.
 * TODO: `api.delete(`/goals/${goalId}/messages`)`로 교체.
 */
export async function clearGoalMessages(goalId: string): Promise<void> {
  if (!goalId) throw new Error('GOAL_NOT_FOUND');
  await delay(400);
}

/**
 * 목표 삭제.
 * TODO: `api.delete(`/goals/${goalId}`)`로 교체.
 *       대화·투두·플래너 기록을 함께 지울지는 백엔드와 합의가 필요하다.
 */
export async function deleteGoal(goalId: string): Promise<void> {
  if (!goalId) throw new Error('GOAL_NOT_FOUND');
  await delay(500);
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
 * TODO: `api.get<MessagePage>(`/goals/${goalId}/messages`, { params: { cursor, limit } })`로 교체.
 */
export async function fetchMessages(goalId: string, cursor?: string): Promise<MessagePage> {
  await delay(600);
  // mock 단계에서는 첫 번째 목표에만 대화 기록이 있다
  if (goalId !== '1') return { messages: [], nextCursor: null };

  // MOCK_MESSAGES는 오래된 것 → 최신 순. 커서 위치 바로 앞에서 한 페이지를 떼어낸다
  const cursorIndex = cursor ? MOCK_MESSAGES.findIndex(({ id }) => id === cursor) : -1;
  const endIndex = cursorIndex >= 0 ? cursorIndex : MOCK_MESSAGES.length;
  const startIndex = Math.max(0, endIndex - MESSAGE_PAGE_SIZE);
  const page = MOCK_MESSAGES.slice(startIndex, endIndex);

  return {
    messages: [...page].reverse(),
    // 이번 페이지에서 가장 오래된 메시지가 다음 커서가 된다
    nextCursor: startIndex > 0 ? page[0].id : null,
  };
}

/**
 * 메시지 전송 후 AI 응답 받기.
 * TODO: SSE 스트리밍으로 교체 (docs/api.md 4.2 참고).
 */
export async function sendMessage(
  goalId: string,
  payload: { content?: string; file?: File },
): Promise<ChatMessage> {
  if (!goalId) throw new Error('GOAL_NOT_FOUND');
  await delay(900);
  return {
    id: crypto.randomUUID(),
    role: 'assistant',
    content: payload.file
      ? `${payload.file.name} 잘 받았어! 내용 확인해볼게.`
      : '좋아, 바로 시작해보자!',
    createdAt: new Date().toISOString(),
  };
}

/**
 * 읽음 처리.
 * TODO: `api.post(`/goals/${goalId}/read`)`로 교체.
 */
export async function markGoalAsRead(goalId: string): Promise<void> {
  if (!goalId) throw new Error('GOAL_NOT_FOUND');
  await delay(100);
}
