// pages/chat/sortChatRooms.ts
import type { ChatRoom } from '@/types/chat';

/**
 * 채팅방 목록 정렬: 최근 메시지가 최신인 방부터.
 *
 * 안 읽음 여부는 정렬에 쓰지 않는다. 읽는 순간 방이 아래로 밀려 순서가 튀기 때문에,
 * 안 읽은 방은 위치를 그대로 두고 배지로만 표시한다.
 *
 * 서버가 정렬해 주더라도 프론트에서 만든 방·읽음 처리 같은 낙관적 갱신까지
 * 순서를 맞춰야 하므로 화면에 그리기 직전에 한 번 더 정렬한다.
 */
export function sortChatRooms(rooms: ChatRoom[]): ChatRoom[] {
  return [...rooms].sort(
    (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime(),
  );
}
