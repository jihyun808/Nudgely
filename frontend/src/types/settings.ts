// types/settings.ts

/** 알림 종류별 수신 여부 */
export interface NotificationSettings {
  /** 전체 알림 스위치. 끄면 아래 항목은 모두 무시된다 */
  enabled: boolean;
  /** AI 선톡·독촉 메시지 */
  nudge: boolean;
  /** 투두 추가·완료 */
  todo: boolean;
  /** 밤 11시 마감 리마인더 (미완료 투두 · 빈 플래너) */
  deadline: boolean;
}

/** 방해 금지 시간대. 이 시간에는 알림을 보내지 않는다 */
export interface DoNotDisturbSettings {
  enabled: boolean;
  /** 시작 시각(시). 예: 0 → 00시 */
  startHour: number;
  /** 종료 시각(시). 시작보다 작으면 자정을 넘긴 것으로 본다 */
  endHour: number;
}

/** 텐미닛 플래너 표시 범위 */
export interface PlannerSettings {
  /** 표에 그리기 시작할 시각(시) */
  startHour: number;
  /** 표를 끝낼 시각(시). 24는 자정을 뜻한다 */
  endHour: number;
}

/** 연결된 소셜 계정 */
export type SocialProvider = 'kakao' | 'google';

/** 설정 화면 전체 */
export interface AppSettings {
  notifications: NotificationSettings;
  doNotDisturb: DoNotDisturbSettings;
  planner: PlannerSettings;
  /** 연결된 소셜 로그인 목록 */
  linkedProviders: SocialProvider[];
}

/** 플래너 시간대 선택 가능한 범위 */
export const PLANNER_HOUR_RANGE = { min: 0, max: 24 } as const;
