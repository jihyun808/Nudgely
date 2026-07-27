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

/**
 * 채팅방 상세 조회 결과.
 * 목록에 필요한 값에 더해, 헤더 부제·설정 화면에서 쓰는 설명과 프롬프트를 포함한다.
 */
export interface ChatRoomDetail extends ChatRoom {
  /** 헤더 부제(세션 이름)로도 쓰인다 */
  description?: string;
  prompt?: string;
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

/** 메시지 작성자. user는 나, assistant는 AI */
export type ChatMessageRole = 'user' | 'assistant';

/** 메시지에 첨부된 파일 */
export interface ChatMessageFile {
  name: string;
  /** 파일 아래에 붙는 보조 문구 (예: '분석 완료') */
  caption?: string;
  /** 다운로드 URL. 업로드 중에는 없다 */
  url?: string;
}

/** 채팅방 상세의 메시지 한 개 */
export interface ChatMessage {
  id: string;
  role: ChatMessageRole;
  content: string;
  /** 작성 시각 (ISO 8601 문자열) */
  createdAt: string;
  file?: ChatMessageFile;
  /**
   * 전송 상태. 서버가 확정한 메시지는 undefined.
   * sending: 낙관적으로 먼저 그려둔 상태, failed: 전송 실패(재시도 가능)
   */
  status?: 'sending' | 'failed';
}

/** 메시지 입력 최대 길이 */
export const MESSAGE_MAX_LENGTH = 1000;
