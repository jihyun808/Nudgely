// api/record.ts
import api from './axios';
import type { DailyPlanner } from '@/types/planner';
import type { DailyTodo, TodoMark } from '@/types/record';

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
