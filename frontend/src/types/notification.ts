// types/notification.ts

/**
 * 알림 종류.
 * - nudge: AI가 먼저 보낸 독촉 채팅 (일반 채팅은 알림을 만들지 않는다)
 * - todoAdded / todoDone: 투두가 추가되거나 완료 체크됨
 * - todoIncomplete: 밤 11시까지 완료하지 않은 투두가 남아 있음
 * - plannerIncomplete: 밤 11시까지 텐미닛 플래너가 비어 있음
 */
export type NotificationType =
  'nudge' | 'todoAdded' | 'todoDone' | 'todoIncomplete' | 'plannerIncomplete';

/** 홈 헤더의 알림 목록에 뜨는 알림 하나 */
export interface AppNotification {
  id: string;
  type: NotificationType;
  /** 위쪽 작은 제목. AI 이름이나 목표 이름이 들어간다 */
  title: string;
  /** 아래 본문 */
  body: string;
  /** 발생 시각 (ISO 8601 문자열) */
  createdAt: string;
  isRead: boolean;
  /** 눌렀을 때 이동할 경로 (예: 해당 채팅방) */
  linkTo?: string;
}

/** 목록에 유지하는 최대 알림 개수. 넘치면 오래된 것부터 사라진다 */
export const MAX_NOTIFICATIONS = 5;
