// api/record.ts
import { createMockPlanner } from '@/mocks/planner';
import { MOCK_DAILY_TODOS } from '@/mocks/todos';
import type { DailyPlanner } from '@/types/planner';
import type { DailyTodo, TodoMark } from '@/types/record';

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
 * 한 달치 완료 표시 (캘린더 꽃 모양).
 * 날짜마다 '완료한 항목이 어느 목표의 것인지'를 모아 준다.
 * @param yearMonth 'YYYY-MM'
 * TODO: `api.get<TodoMark[]>('/todos/marks', { params: { month } })`로 교체.
 */
export async function fetchTodoMarks(yearMonth: string): Promise<TodoMark[]> {
  await delay(300);

  const marks = new Map<string, string[]>();
  for (const todo of MOCK_DAILY_TODOS) {
    if (!todo.date.startsWith(yearMonth)) continue;
    // 완료한 항목 하나마다 그 목표 id를 하나씩 넣는다 (항목 = 꽃잎)
    const doneGoalIds = todo.items.filter(({ isDone }) => isDone).map(() => todo.goalId);
    if (doneGoalIds.length === 0) continue;
    marks.set(todo.date, [...(marks.get(todo.date) ?? []), ...doneGoalIds]);
  }

  return [...marks.entries()].map(([date, doneGoalIds]) => ({ date, doneGoalIds }));
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
