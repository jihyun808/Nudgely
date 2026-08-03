// api/focus.ts
import { createMockPlanner } from '@/mocks/planner';
import type { FocusSessionInput, FocusSummary } from '@/types/focus';
import { formatDateKey } from '@/utils/date';

/** mock 지연 (연동 시 삭제) */
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** mock 단계에서 오늘 쌓인 집중 시간을 들고 있는 변수 (새로고침하면 초기화된다) */
let mockFocusedSeconds = 0;

/**
 * 오늘의 집중 요약 조회.
 * 목표 시간은 오늘 텐미닛 플래너의 '계획' 블록 시간을 모두 더해서 정한다.
 * TODO: `api.get<FocusSummary>('/focus/summary', { params: { date } })`로 교체.
 */
export async function fetchFocusSummary(): Promise<FocusSummary> {
  await delay(400);
  const planner = createMockPlanner(formatDateKey(new Date()));
  const targetMinutes = planner.planned.reduce((sum, block) => sum + block.durationMinutes, 0);

  return { focusedSeconds: mockFocusedSeconds, targetMinutes };
}

/**
 * 집중 세션 저장. 타이머를 멈추거나 뽀모도로 한 판이 끝났을 때 보낸다.
 * TODO: `api.post('/focus/sessions', input)`로 교체.
 */
export async function saveFocusSession(input: FocusSessionInput): Promise<void> {
  await delay(300);
  mockFocusedSeconds += input.seconds;
}
