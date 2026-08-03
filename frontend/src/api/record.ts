// api/record.ts
import { delay } from '@/mocks/delay';
import { MOCK_GOALS } from '@/mocks/goals';
import { getMockPlanner, replaceMockActual } from '@/mocks/planner';
import { getMockTodoItems, MOCK_DAILY_TODOS } from '@/mocks/todos';
import type { DailyPlanner, PlannerBlock, PlannerBlockInput } from '@/types/planner';
import type { DailyTodo, TodoItem, TodoItemInput, TodoMark } from '@/types/record';

/**
 * 특정 날짜의 투두 조회 (목표별로 한 묶음).
 * 투두는 날짜마다 새로 만들어지므로, 그날 할 일이 없는 목표는 아예 내려오지 않는다.
 * @param date 'YYYY-MM-DD' (사용자 기준 로컬 날짜)
 * TODO: `api.get<DailyTodo[]>('/todos', { params: { date } })`로 교체.
 */
export async function fetchDailyTodos(date: string): Promise<DailyTodo[]> {
  await delay(400);
  // 복사해서 돌려준다. 그대로 주면 mock 저장소와 화면이 같은 배열을 공유해
  // 항목을 추가할 때 화면에 두 번 들어간다 (서버는 매번 새 객체를 준다)
  return MOCK_DAILY_TODOS.filter((todo) => todo.date === date).map((todo) => ({
    ...todo,
    isGoalCompleted: MOCK_GOALS.some(({ id, completedAt }) => id === todo.goalId && completedAt),
    items: todo.items.map((item) => ({ ...item })),
  }));
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
 * 투두 항목 체크/해제.
 * AI도 대화로 갱신하지만 사용자가 직접 체크할 수도 있다.
 * TODO: `api.patch(`/todos/${todoId}/items/${itemId}`, { isDone })`로 교체.
 */
export async function setTodoItemDone(
  todoId: string,
  itemId: string,
  isDone: boolean,
): Promise<void> {
  await delay(200);
  const item = getMockTodoItems(todoId).find(({ id }) => id === itemId);
  if (item) item.isDone = isDone;
}

/**
 * 투두 항목 추가 (사용자가 직접 적은 할 일).
 * TODO: `api.post<TodoItem>(`/todos/${todoId}/items`, input)`으로 교체.
 */
export async function addTodoItem(todoId: string, input: TodoItemInput): Promise<TodoItem> {
  await delay(300);
  const created: TodoItem = {
    id: crypto.randomUUID(),
    content: input.content,
    tag: input.tag,
    isDone: false,
    source: 'user',
  };
  getMockTodoItems(todoId).push(created);
  return created;
}

/**
 * 투두 항목 내용·태그 수정.
 * TODO: `api.patch(`/todos/${todoId}/items/${itemId}`, input)`으로 교체.
 */
export async function updateTodoItem(
  todoId: string,
  itemId: string,
  input: TodoItemInput,
): Promise<void> {
  await delay(300);
  const item = getMockTodoItems(todoId).find(({ id }) => id === itemId);
  if (!item) return;
  item.content = input.content;
  item.tag = input.tag;
}

/**
 * 투두 항목 삭제.
 * TODO: `api.delete(`/todos/${todoId}/items/${itemId}`)`로 교체.
 */
export async function deleteTodoItem(todoId: string, itemId: string): Promise<void> {
  await delay(300);
  const items = getMockTodoItems(todoId);
  const index = items.findIndex(({ id }) => id === itemId);
  if (index >= 0) items.splice(index, 1);
}

/**
 * 특정 날짜의 텐미닛 플래너 조회.
 * 계획은 AI가 정해 고정이고, 실제 기록은 사용자가 추가·수정·삭제할 수 있다.
 * TODO: `api.get<DailyPlanner>('/planners', { params: { date } })`로 교체.
 */
export async function fetchDailyPlanner(date: string): Promise<DailyPlanner> {
  await delay(400);
  return getMockPlanner(date);
}

/**
 * 실제 기록 추가. 사용자가 직접 적은 기록이므로 출처는 항상 manual이다.
 * TODO: `api.post<DailyPlanner>(`/planners/${date}/actual`, input)`으로 교체.
 */
export async function addPlannerActual(
  date: string,
  input: PlannerBlockInput,
): Promise<DailyPlanner> {
  await delay(300);
  const created: PlannerBlock = { id: crypto.randomUUID(), ...input, kind: 'manual' };
  return replaceMockActual(date, [...getMockPlanner(date).actual, created]);
}

/**
 * 실제 기록 수정. 타이머·인증으로 자동 기록된 것도 고칠 수 있다.
 * TODO: `api.patch<DailyPlanner>(`/planners/${date}/actual/${blockId}`, input)`으로 교체.
 */
export async function updatePlannerActual(
  date: string,
  blockId: string,
  input: PlannerBlockInput,
): Promise<DailyPlanner> {
  await delay(300);
  const actual = getMockPlanner(date).actual.map((block) =>
    block.id === blockId ? { ...block, ...input } : block,
  );
  return replaceMockActual(date, actual);
}

/**
 * 실제 기록 삭제.
 * TODO: `api.delete<DailyPlanner>(`/planners/${date}/actual/${blockId}`)`로 교체.
 */
export async function deletePlannerActual(date: string, blockId: string): Promise<DailyPlanner> {
  await delay(300);
  const actual = getMockPlanner(date).actual.filter((block) => block.id !== blockId);
  return replaceMockActual(date, actual);
}
