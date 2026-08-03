// types/goal.ts

/**
 * 목표 하나. 채팅방·홈의 목표 카드·기록의 투두가 모두 이 하나를 가리킨다.
 * (사용자에게는 화면마다 '채팅방' / '진행 중인 목표'로 달리 보인다)
 */
export interface Goal {
  id: string;
  /** 채팅방 이름(별명). 예: 'Buddy'. 채팅 목록·상세 헤더의 제목이 된다 */
  name: string;
  /** 대표 이미지. 없으면 이름 첫 글자 아바타로 대체된다 */
  imageUrl?: string;
  /**
   * 목표 이름. 예: 'UI/UX 디자인 강의 완주'.
   * 홈의 목표 카드 제목 · 기록의 투두 카드 제목 · 채팅 상세 헤더의 부제가 모두 이 값을 공유한다.
   * TODO: 개설 시 사용자가 적은 값으로 시작하고, 이후 AI가 대화를 통해 다듬어 갱신한다
   */
  title?: string;

  /** 채팅 목록용 — 최근 메시지 미리보기 */
  lastMessage: string;
  /** 채팅 목록용 — 최근 메시지 시각 (ISO 8601) */
  lastMessageAt: string;
  /** 채팅 목록용 — 안 읽은 메시지 수. 0이면 배지를 표시하지 않는다 */
  unreadCount: number;

  /** 목표 기한까지 남은 일수. 기한이 없으면 D-day 배지를 표시하지 않는다 */
  remainingDays?: number;
  /**
   * 진도. 아직 없을 수도 있다(막 만든 목표 등).
   * TODO: 진도를 무엇으로 셀지(강의 수, 페이지, 회차 등)는 AI가 사용자에게서
   *       어떤 정보를 받아 정할지 확정한 뒤 스키마를 다시 맞춘다.
   */
  progress?: {
    current: number;
    total: number;
    /** 단위 (예: '강', '페이지') */
    unit: string;
  };
}

/** 목표 상세. 설정 화면에서 쓰는 값까지 포함한다 */
export interface GoalDetail extends Goal {
  /** AI의 역할·말투를 정하는 시스템 프롬프트 */
  prompt?: string;
  /** 목표 기한 (YYYY-MM-DD). 설정하면 D-day가 표시된다 */
  dueDate?: string;
  /** 이 목표의 알림만 꺼둔 상태 (전역 알림 설정과 별개) */
  isNotificationMuted?: boolean;
  /** 목표를 끝낸 날 (ISO 8601). 있으면 완료된 목표 */
  completedAt?: string;
}

/** 목표 수정 입력값. 바뀐 항목만 보낸다 */
export interface UpdateGoalInput {
  name?: string;
  title?: string;
  imageUrl?: string;
  prompt?: string;
  dueDate?: string;
  isNotificationMuted?: boolean;
}

/** 목표 생성 폼 입력값. 이름만 필수이고 나머지는 나중에 수정할 수 있다 */
export interface CreateGoalInput {
  /** 채팅방 이름(별명) */
  name: string;
  /** 업로드한 이미지의 data URL (미선택 시 undefined) */
  imageUrl?: string;
  /** 목표 이름 */
  title: string;
  prompt: string;
}

/** 입력 글자수 제한 */
export const GOAL_LIMITS = {
  name: 10,
  title: 50,
  prompt: 500,
} as const;
