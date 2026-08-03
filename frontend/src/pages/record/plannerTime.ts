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
 * 플래너의 최소 단위(10분)로 끊는다.
 */
export function buildTimeOptions(fromMinutes: number, toMinutes: number) {
  const options: { value: number; label: string }[] = [];
  for (let minute = fromMinutes; minute <= toMinutes; minute += PLANNER_BLOCK_MINUTES) {
    options.push({ value: minute, label: formatMinutes(minute) });
  }
  return options;
}
