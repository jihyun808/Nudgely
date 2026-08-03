// pages/record/useTodoItems.ts
import type { Dispatch, SetStateAction } from 'react';
import { addTodoItem, deleteTodoItem, setTodoItemDone, updateTodoItem } from '@/api/record';
import { showToast } from '@/stores/toastStore';
import type { DailyTodo, TodoItem, TodoItemInput } from '@/types/record';

/** 팝업이 다루는 대상. item이 없으면 추가 모드 */
export interface TodoTarget {
  todo: DailyTodo;
  item?: TodoItem;
}

/**
 * 투두 항목 체크·추가·수정·삭제.
 * 서버에 보내고 화면 목록을 함께 맞춘다.
 *
 * @param onCompletionChanged 완료 개수가 바뀌었을 때 (캘린더 꽃 표시를 다시 세야 한다)
 */
export function useTodoItems(
  setTodos: Dispatch<SetStateAction<DailyTodo[]>>,
  onCompletionChanged: () => void,
) {
  /** 한 투두 묶음의 항목 목록만 갈아끼운다 */
  const replaceItems = (todoId: string, update: (items: TodoItem[]) => TodoItem[]) => {
    setTodos((prev) =>
      prev.map((todo) => (todo.id === todoId ? { ...todo, items: update(todo.items) } : todo)),
    );
  };

  /** 체크는 먼저 그리고, 실패하면 되돌린다 */
  const toggleItem = async (todo: DailyTodo, item: TodoItem) => {
    const nextDone = !item.isDone;
    const toggle = (isDone: boolean) => (items: TodoItem[]) =>
      items.map((it) => (it.id === item.id ? { ...it, isDone } : it));

    replaceItems(todo.id, toggle(nextDone));
    try {
      await setTodoItemDone(todo.id, item.id, nextDone);
      onCompletionChanged();
    } catch {
      replaceItems(todo.id, toggle(item.isDone));
      showToast('바꾸지 못했어요. 다시 시도해주세요', { variant: 'warning' });
    }
  };

  const submitItem = async ({ todo, item }: TodoTarget, input: TodoItemInput) => {
    if (item) {
      await updateTodoItem(todo.id, item.id, input);
      replaceItems(todo.id, (items) =>
        items.map((it) => (it.id === item.id ? { ...it, ...input } : it)),
      );
      showToast('할 일을 수정했어요', { variant: 'success' });
      return;
    }

    const created = await addTodoItem(todo.id, input);
    replaceItems(todo.id, (items) => [...items, created]);
    showToast('할 일을 추가했어요', { variant: 'success' });
  };

  const deleteItem = async ({ todo, item }: TodoTarget) => {
    if (!item) return;
    await deleteTodoItem(todo.id, item.id);
    replaceItems(todo.id, (items) => items.filter(({ id }) => id !== item.id));
    if (item.isDone) onCompletionChanged();
    showToast('할 일을 삭제했어요');
  };

  return { toggleItem, submitItem, deleteItem };
}
