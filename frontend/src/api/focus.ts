// api/focus.ts
import api from './axios';
import type { FocusSessionInput, FocusSummary } from '@/types/focus';
import { formatDateKey } from '@/utils/date';

const DAY = 24 * 60 * 60 * 1000;

/** weekOffset 주의 월요일. 0이면 이번 주, -1이면 지난 주 */
function getWeekStart(weekOffset: number) {
  const today = new Date();
  // 월요일을 0으로 두는 요일 인덱스
  const todayIndex = (today.getDay() + 6) % 7;
  const monday = new Date(today.getTime() - todayIndex * DAY);
  monday.setHours(0, 0, 0, 0);
  return new Date(monday.getTime() + weekOffset * 7 * DAY);
}

/**
 * 오늘의 집중 요약 조회.
 * 목표 시간은 오늘 텐미닛 플래너의 '계획' 블록 시간을 모두 더해 서버가 정한다.
 */
export async function fetchFocusSummary(): Promise<FocusSummary> {
  const { data } = await api.get<FocusSummary>('/focus/summary', {
    params: { date: formatDateKey(new Date()) },
  });
  return data;
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
 */
export async function fetchWeeklyFocus(weekOffset: number): Promise<WeeklyFocus> {
  const { data } = await api.get<WeeklyFocus>('/focus/weekly', {
    params: { weekStart: formatDateKey(getWeekStart(weekOffset)) },
  });
  return data;
}

/**
 * 기간별 집중 시간 조회 (마이페이지 히트맵).
 * 서버는 기록이 있는 날만 주므로, 날짜로 바로 찾을 수 있게 맵으로 바꿔 돌려준다.
 * @param from 'YYYY-MM-DD' 시작일 (포함)
 * @param to   'YYYY-MM-DD' 종료일 (포함)
 */
export async function fetchDailyFocus(from: string, to: string): Promise<Record<string, number>> {
  const { data } = await api.get<{ days: { date: string; seconds: number }[] }>('/focus/daily', {
    params: { from, to },
  });
  return Object.fromEntries(data.days.map(({ date, seconds }) => [date, seconds]));
}

/** 집중 세션 저장. 타이머를 멈추거나 뽀모도로 한 판이 끝났을 때 보낸다 */
export async function saveFocusSession(input: FocusSessionInput): Promise<void> {
  // TODO: 목표별 집중 집계를 하려면 goalId가 필요하다(api.md §8-7).
  //       집중 화면에 목표 선택 UI가 생기면 함께 보낸다.
  await api.post('/focus/sessions', input);
}
