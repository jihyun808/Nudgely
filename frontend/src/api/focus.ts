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

/**
 * 집중 세션 저장. 타이머를 멈추거나 뽀모도로 한 판이 끝났을 때 보낸다.
 * goalId 를 함께 보내면 그 목표의 집중 시간으로 집계된다(모아보기 진도 탭).
 */
export async function saveFocusSession(input: FocusSessionInput): Promise<void> {
  await api.post('/focus/sessions', input);
}

// ── 카메라 집중 인증 ──
// 영상은 서버로 가지 않는다. 기기가 판정한 상태(focus/absent)만 보낸다.

export type FocusCheckStatus = 'focus' | 'absent';

export interface CameraSession {
  id: string;
  /** 집중한 샘플 비율(%) */
  focusScore: number;
  /** 인증 성립 여부 */
  verified: boolean;
  /** 5분 이상 자리 비움 횟수 */
  awayCount: number;
}

export interface FocusCheck {
  status: FocusCheckStatus;
  /** 판정 시각 (ISO 8601) */
  at: string;
  confidence?: number;
}

/** 카메라 인증 세션 시작. consented 없이는 서버가 거부한다 */
export async function startCameraSession(input: {
  startedAt: string;
  goalId?: string;
  consented: boolean;
}): Promise<CameraSession> {
  const { data } = await api.post<CameraSession>('/focus/sessions/camera', input);
  return data;
}

/** 구간 판정 묶음 전송 */
export async function sendFocusChecks(
  sessionId: string,
  samples: FocusCheck[],
): Promise<CameraSession> {
  const { data } = await api.post<CameraSession>(`/focus/sessions/${sessionId}/checks`, {
    samples,
  });
  return data;
}

/** 세션 종료 → 점수·인증 확정 */
export async function finishCameraSession(
  sessionId: string,
  seconds: number,
): Promise<CameraSession> {
  const { data } = await api.post<CameraSession>(`/focus/sessions/${sessionId}/finish`, {
    seconds,
  });
  return data;
}

/**
 * 앱이 백그라운드로 내려가 판정이 끊겼을 때.
 * 거기까지로 끝내고, 서버가 "기록이 멈췄다" 고 알린다.
 */
export async function interruptCameraSession(
  sessionId: string,
  seconds: number,
): Promise<CameraSession> {
  const { data } = await api.post<CameraSession>(`/focus/sessions/${sessionId}/interrupt`, {
    seconds,
  });
  return data;
}
