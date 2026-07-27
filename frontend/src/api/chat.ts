// api/chat.ts
import { MOCK_CHAT_ROOMS } from '@/pages/chat/mockChatRooms';
import { MOCK_MESSAGES } from '@/pages/chat/mockMessages';
import type { ChatMessage, ChatRoom, ChatRoomDetail, CreateChatRoomInput } from '@/types/chat';

/** mock 지연 (연동 시 삭제) */
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 채팅방 목록 조회.
 * TODO: 백엔드 연동 시 `api.get<ChatRoom[]>('/chat-rooms')`로 교체.
 */
export async function fetchChatRooms(): Promise<ChatRoom[]> {
  // 로딩 스켈레톤이 실제로 보이도록 약간의 지연을 준다 (연동 시 삭제)
  await delay(600);
  return MOCK_CHAT_ROOMS;
}

/**
 * 채팅방 개설.
 * TODO: 백엔드 연동 시 사진은 FormData로 업로드하고 서버가 준 URL을 사용한다.
 */
export async function createChatRoom(input: CreateChatRoomInput): Promise<ChatRoom> {
  await delay(300);
  return {
    id: crypto.randomUUID(),
    name: input.name,
    imageUrl: input.imageUrl,
    lastMessage: input.description || '새로운 채팅방이 만들어졌어요',
    lastMessageAt: new Date().toISOString(),
    unreadCount: 0,
  };
}

/**
 * 채팅방 단건 조회 (상세 화면 헤더용).
 * TODO: `api.get<ChatRoom>(`/chat-rooms/${roomId}`)`로 교체.
 */
export async function fetchChatRoom(roomId: string): Promise<ChatRoomDetail> {
  await delay(300);
  const room = MOCK_CHAT_ROOMS.find(({ id }) => id === roomId);
  if (!room) throw new Error('CHAT_ROOM_NOT_FOUND');
  return room;
}

/**
 * 메시지 목록 조회 (오래된 것 → 최신 순으로 화면에 그린다).
 * TODO: `api.get(`/chat-rooms/${roomId}/messages`)` + 커서 페이지네이션으로 교체.
 */
export async function fetchMessages(roomId: string): Promise<ChatMessage[]> {
  await delay(600);
  // mock 단계에서는 첫 번째 방에만 대화 기록이 있다
  return roomId === '1' ? MOCK_MESSAGES : [];
}

/**
 * 메시지 전송 후 AI 응답 받기.
 * TODO: SSE 스트리밍으로 교체 (docs/api.md 4.2 참고).
 *       스트리밍이 붙으면 이 함수는 delta 콜백을 받는 형태로 바뀐다.
 */
export async function sendMessage(
  roomId: string,
  payload: { content?: string; file?: File },
): Promise<ChatMessage> {
  if (!roomId) throw new Error('CHAT_ROOM_NOT_FOUND');
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
 * TODO: `api.post(`/chat-rooms/${roomId}/read`)`로 교체.
 */
export async function markChatRoomAsRead(roomId: string): Promise<void> {
  if (!roomId) throw new Error('CHAT_ROOM_NOT_FOUND');
  await delay(100);
}
