// types/chat.ts

/** 채팅 목록에 표시되는 채팅방 한 개 */
export interface ChatRoom {
  id: string;
  /** 채팅방 이름 (채팅방 설정에서 변경 가능) */
  name: string;
  /** 채팅방 대표 이미지 URL. 없으면 이름 첫 글자 아바타로 대체된다 */
  imageUrl?: string;
  /** 최근 채팅 미리보기 */
  lastMessage: string;
  /** 최근 채팅 시각 (ISO 8601 문자열) */
  lastMessageAt: string;
  /** 안 읽은 메시지 수. 0이면 알림 배지를 표시하지 않는다 */
  unreadCount: number;
}

/** 채팅방 개설 폼 입력값. 이름만 필수이고 나머지는 채팅방 설정에서 수정할 수 있다 */
export interface CreateChatRoomInput {
  name: string;
  /** 업로드한 이미지의 data URL (미선택 시 undefined) */
  imageUrl?: string;
  description: string;
  /** AI의 역할·말투를 정하는 시스템 프롬프트 */
  prompt: string;
}

/** 입력 글자수 제한 */
export const CHAT_ROOM_LIMITS = {
  name: 10,
  description: 50,
  prompt: 500,
} as const;
