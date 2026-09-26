// types/planner.ts

/**
 * 실제 기록의 출처.
 * - focus: 집중 세션
 * - verify: 학습 인증
 * - manual: 직접 기록
 */
export type PlannerRecordKind = 'focus' | 'verify' | 'manual';

/** 플래너 표에 그려지는 블록 하나 */
export interface PlannerBlock {
  id: string;
  title: string;
  /** 자정 기준 시작 시각(분). 예: 08:20 → 500 */
  startMinutes: number;
  /** 지속 시간(분). 막대 길이가 된다 */
  durationMinutes: number;
  /** 실제 기록일 때만 있는 출처. 계획 블록은 없다 */
  kind?: PlannerRecordKind;
  /** 어느 목표의 블록인지. 목표 없이 그냥 집중한 기록이면 둘 다 없다 */
  goalId?: string;
  /** 표에 '제목 · 목표이름'으로 붙여 쓴다. 지워진 목표면 없다 */
  goalName?: string;
}

/** 실제 기록을 추가·수정할 때 보내는 값 */
export interface PlannerBlockInput {
  title: string;
  /** 자정 기준 시작 시각(분) */
  startMinutes: number;
  /** 지속 시간(분) */
  durationMinutes: number;
}

/** 하루치 텐미닛 플래너 */
export interface DailyPlanner {
  /** 날짜 (YYYY-MM-DD) */
  date: string;
  /** AI가 정한 계획. 사용자는 바꿀 수 없다 */
  planned: PlannerBlock[];
  /** 실제 기록. AI가 넣지만 사용자가 수정할 수 있다 */
  actual: PlannerBlock[];
}

/** 플래너의 최소 단위(분). 달성 여부도 이 단위로 센다 */
export const PLANNER_BLOCK_MINUTES = 10;
