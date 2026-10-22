// pages/record/plannerTime.ts
import { PLANNER_BLOCK_MINUTES } from '@/types/planner';

/** 자정 기준 분 → 'HH:MM' */
export function formatMinutes(minute: number) {
  const hour = String(Math.floor(minute / 60)).padStart(2, '0');
  const rest = String(minute % 60).padStart(2, '0');
  return `${hour}:${rest}`;
}

/**
 * 시각 선택 드롭다운에 넣을 값 목록.
 * 플래너의 최소 단위(10분) 눈금에 맞춰 끊는다. 집중 타이머가 남긴 기록은
 * 14:37 처럼 눈금 밖에서 시작하므로, 그런 값은 keep 으로 넘겨 목록에 끼워 둔다
 * (없으면 드롭다운이 엉뚱한 시각을 보여준다).
 */
export function buildTimeOptions(fromMinutes: number, toMinutes: number, keep?: number) {
  const minutes: number[] = [];
  const first = Math.ceil(fromMinutes / PLANNER_BLOCK_MINUTES) * PLANNER_BLOCK_MINUTES;
  for (let minute = first; minute <= toMinutes; minute += PLANNER_BLOCK_MINUTES) {
    minutes.push(minute);
  }
  if (keep !== undefined && keep >= fromMinutes && keep <= toMinutes && !minutes.includes(keep)) {
    minutes.push(keep);
    minutes.sort((a, b) => a - b);
  }
  return minutes.map((value) => ({ value, label: formatMinutes(value) }));
}
