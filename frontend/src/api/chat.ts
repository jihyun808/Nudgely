// api/chat.ts
import { MOCK_CHAT_ROOMS } from '@/pages/chat/mockChatRooms';
import type { ChatRoom, CreateChatRoomInput } from '@/types/chat';

/**
 * 채팅방 목록 조회.
 * TODO: 백엔드 연동 시 아래 mock 대신 `api.get<ChatRoom[]>('/chat-rooms')`로 교체.
 */
export async function fetchChatRooms(): Promise<ChatRoom[]> {
  // 로딩 스켈레톤이 실제로 보이도록 약간의 지연을 준다 (연동 시 삭제)
  await new Promise((resolve) => setTimeout(resolve, 600));
  return MOCK_CHAT_ROOMS;
}

/**
 * 채팅방 개설.
 * TODO: 백엔드 연동 시 사진은 FormData로 업로드하고 서버가 준 URL을 사용한다.
 */
export async function createChatRoom(input: CreateChatRoomInput): Promise<ChatRoom> {
  await new Promise((resolve) => setTimeout(resolve, 300));
  return {
    id: crypto.randomUUID(),
    name: input.name,
    imageUrl: input.imageUrl,
    lastMessage: input.description || '새로운 채팅방이 만들어졌어요',
    lastMessageAt: new Date().toISOString(),
    unreadCount: 0,
  };
}
