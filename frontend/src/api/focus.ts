// api/focus.ts
import { fetchDailyPlanner } from '@/api/record';
import { delay } from '@/mocks/delay';
import { createMockWeeklyFocus } from '@/mocks/my';
import type { FocusSessionInput, FocusSummary } from '@/types/focus';
import { formatDateKey } from '@/utils/date';

/** mock 단계에서 오늘 쌓인 집중 시간을 들고 있는 변수 (새로고침하면 초기화된다) */
let mockFocusedSeconds = 0;

/**
 * 오늘의 집중 요약 조회.
 * 목표 시간은 오늘 텐미닛 플래너의 '계획' 블록 시간을 모두 더해서 정한다.
 * TODO: `api.get<FocusSummary>('/focus/summary', { params: { date } })`로 교체.
 */
export async function fetchFocusSummary(): Promise<FocusSummary> {
  // 플래너를 고치면 집중 탭에도 바로 반영되도록 같은 데이터를 본다
  const planner = await fetchDailyPlanner(formatDateKey(new Date()));
  const targetMinutes = planner.planned.reduce((sum, block) => sum + block.durationMinutes, 0);

  return { focusedSeconds: mockFocusedSeconds, targetMinutes };
}

/** 주간 집중 조회 결과 */
export interface WeeklyFocus {
  /** 월요일부터 일요일까지의 집중 시간(시간 단위) */
  hours: number[];
  /** 지난 주 대비 증감(시간) */
  diffFromLastWeek: number;
}

/**
 * 한 주의 요일별 집중 시간 조회.
 * @param weekOffset 0이면 이번 주, -1이면 지난 주
 * TODO: `api.get<WeeklyFocus>('/focus/weekly', { params: { weekStart } })`로 교체.
 */
export async function fetchWeeklyFocus(weekOffset: number): Promise<WeeklyFocus> {
  await delay(300);

  const hours = createMockWeeklyFocus(weekOffset);
  const previousHours = createMockWeeklyFocus(weekOffset - 1);
  const sum = (values: number[]) => values.reduce((acc, value) => acc + value, 0);

  return {
    hours,
    diffFromLastWeek: Math.round((sum(hours) - sum(previousHours)) * 10) / 10,
  };
}

/**
 * 집중 세션 저장. 타이머를 멈추거나 뽀모도로 한 판이 끝났을 때 보낸다.
 * TODO: `api.post('/focus/sessions', input)`로 교체.
 */
export async function saveFocusSession(input: FocusSessionInput): Promise<void> {
  await delay(300);
  mockFocusedSeconds += input.seconds;
}
