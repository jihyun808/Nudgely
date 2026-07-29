// api/record.ts
import { createMockPlanner } from '@/pages/record/mockPlanner';
import { MOCK_TODO_LISTS } from '@/pages/record/mockTodoLists';
import type { DailyPlanner } from '@/types/planner';
import type { TodoList } from '@/types/record';

/** mock 지연 (연동 시 삭제) */
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 특정 날짜에 할당된 투두 리스트 조회.
 * @param date 'YYYY-MM-DD' (사용자 기준 로컬 날짜)
 * TODO: `api.get<TodoList[]>('/todo-lists', { params: { date } })`로 교체.
 */
export async function fetchTodoLists(date: string): Promise<TodoList[]> {
  await delay(400);
  return MOCK_TODO_LISTS.filter((todoList) => todoList.date === date);
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
