// types/focus.ts

/** 집중 방식. stopwatch는 계속 누적, pomodoro는 25분/5분을 반복 */
export type FocusMode = 'stopwatch' | 'pomodoro';

/** 뽀모도로 단계 */
export type PomodoroPhase = 'focus' | 'break';

/** 오늘의 집중 요약 */
export interface FocusSummary {
  /** 오늘 누적 집중 시간(초) */
  focusedSeconds: number;
  /** 오늘 목표 시간(분). 텐미닛 플래너의 계획 시간 합계로 정한다 */
  targetMinutes: number;
  /** 연속 달성일. 투두가 체크된 날을 세며 서버가 계산한다 */
  streakDays: number;
  /** 지금까지의 최고 연속 기록(일) */
  bestStreakDays: number;
  /** 지금 연속 기록이 최고 기록인지 */
  isBestStreak: boolean;
}

/** 서버에 남기는 집중 세션 한 건 */
export interface FocusSessionInput {
  mode: FocusMode;
  /** 집중한 시간(초) */
  seconds: number;
  /** 시작 시각 (ISO 8601) */
  startedAt: string;
}

/** 스톱워치 한 바퀴 = 60분 */
export const STOPWATCH_ROUND_MINUTES = 60;
/** 뽀모도로 집중 시간(분) */
export const POMODORO_FOCUS_MINUTES = 25;
/** 뽀모도로 휴식 시간(분) */
export const POMODORO_BREAK_MINUTES = 5;
/** 긴 휴식 시간(분). 집중 4번마다 한 번 */
export const POMODORO_LONG_BREAK_MINUTES = 15;
/** 몇 번 집중할 때마다 긴 휴식을 줄지 */
export const POMODORO_LONG_BREAK_EVERY = 4;
