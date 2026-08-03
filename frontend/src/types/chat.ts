// types/chat.ts
// 채팅 '내용'에 대한 타입. 채팅방 자체는 목표(`types/goal.ts`의 Goal)와 같은 것이다.

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
