// api/record.ts
import api from './axios';
import type { DailyPlanner, PlannerBlockInput } from '@/types/planner';
import type { DailyTodo, TodoItem, TodoItemInput, TodoMark } from '@/types/record';

/**
 * 특정 날짜의 투두 조회 (목표별로 한 묶음).
 * 투두는 날짜마다 새로 만들어지므로, 그날 할 일이 없는 목표는 아예 내려오지 않는다.
 * @param date 'YYYY-MM-DD' (사용자 기준 로컬 날짜)
 */
export async function fetchDailyTodos(date: string): Promise<DailyTodo[]> {
  const { data } = await api.get<DailyTodo[]>('/todos', { params: { date } });
  return data;
}

/**
 * 한 달치 완료 표시 (캘린더 꽃 모양).
 * 날짜마다 '완료한 항목이 어느 목표의 것인지'를 모아 준다.
 * @param yearMonth 'YYYY-MM'
 */
export async function fetchTodoMarks(yearMonth: string): Promise<TodoMark[]> {
  const { data } = await api.get<{ marks: TodoMark[] }>('/todos/marks', {
    params: { month: yearMonth },
  });
  return data.marks;
}

/**
 * 특정 날짜의 텐미닛 플래너 조회.
 * 계획은 AI가 정해 고정이고, 실제 기록은 수정할 수 있다.
 */
export async function fetchDailyPlanner(date: string): Promise<DailyPlanner> {
  const { data } = await api.get<DailyPlanner>('/planners', { params: { date } });
  return data;
}

// ── 투두 항목 수정 (사용자) ────────────────────────────────
//
// AI가 넣은 항목도 고칠 수 있다. 잘못 들어간 걸 바로잡는 길이 있어야 한다.

/** 항목 완료 여부 토글. 진도가 붙은 항목이면 목표 진도도 함께 움직인다 */
export async function setTodoItemDone(
  todoId: string,
  itemId: string,
  isDone: boolean,
): Promise<void> {
  await api.post(`/todos/${todoId}/items/${itemId}/done`, { isDone });
}

/** 항목 추가. 사용자가 넣은 항목은 진도에 관여하지 않는다(서버가 delta 0으로 둔다) */
export async function addTodoItem(todoId: string, input: TodoItemInput): Promise<TodoItem> {
  const { data } = await api.post<TodoItem>(`/todos/${todoId}/items`, input);
  return data;
}

/** 항목 내용·태그 수정 */
export async function updateTodoItem(
  todoId: string,
  itemId: string,
  input: TodoItemInput,
): Promise<TodoItem> {
  const { data } = await api.patch<TodoItem>(`/todos/${todoId}/items/${itemId}`, input);
  return data;
}

/** 항목 삭제. 완료된 항목이면 서버가 올려 둔 진도를 되돌린다 */
export async function deleteTodoItem(todoId: string, itemId: string): Promise<void> {
  await api.delete(`/todos/${todoId}/items/${itemId}`);
}

// ── 플래너 실제 기록 수정 (사용자) ──────────────────────────
//
// 응답은 그날 플래너 전체다. 블록 하나만 받으면 요약(달성률)을 다시 못 맞춘다.

/** 실제 기록 추가 (손으로 넣은 것은 kind='manual') */
export async function addPlannerActual(
  date: string,
  input: PlannerBlockInput,
): Promise<DailyPlanner> {
  const { data } = await api.post<DailyPlanner>(`/planners/${date}/actual`, input);
  return data;
}

/** 실제 기록 수정. 집중 타이머가 자동으로 남긴 것(kind='focus')도 고칠 수 있다 */
export async function updatePlannerActual(
  date: string,
  blockId: string,
  input: PlannerBlockInput,
): Promise<DailyPlanner> {
  const { data } = await api.patch<DailyPlanner>(`/planners/${date}/actual/${blockId}`, input);
  return data;
}

/** 실제 기록 삭제 */
export async function deletePlannerActual(date: string, blockId: string): Promise<DailyPlanner> {
  const { data } = await api.delete<DailyPlanner>(`/planners/${date}/actual/${blockId}`);
  return data;
}
