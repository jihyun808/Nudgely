// api/record.ts
import { createMockPlanner } from '@/mocks/planner';
import { MOCK_DAILY_TODOS } from '@/mocks/todos';
import type { DailyPlanner } from '@/types/planner';
import type { DailyTodo } from '@/types/record';

/** mock 지연 (연동 시 삭제) */
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 특정 날짜의 투두 조회 (목표별로 한 묶음).
 * 투두는 날짜마다 새로 만들어지므로, 그날 할 일이 없는 목표는 아예 내려오지 않는다.
 * @param date 'YYYY-MM-DD' (사용자 기준 로컬 날짜)
 * TODO: `api.get<DailyTodo[]>('/todos', { params: { date } })`로 교체.
 */
export async function fetchDailyTodos(date: string): Promise<DailyTodo[]> {
  await delay(400);
  return MOCK_DAILY_TODOS.filter((todo) => todo.date === date);
}

/**
 * 특정 날짜의 텐미닛 플래너 조회.
 * 계획은 AI가 정해 고정이고, 실제 기록은 수정할 수 있다.
 * TODO: `api.get<DailyPlanner>('/planners', { params: { date } })`로 교체.
 */
export async function fetchDailyPlanner(date: string): Promise<DailyPlanner> {
  await delay(400);
  return createMockPlanner(date);
}
