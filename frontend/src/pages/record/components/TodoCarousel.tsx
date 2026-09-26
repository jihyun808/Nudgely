// pages/record/components/TodoCarousel.tsx
import { useState } from 'react';
import HorizontalCarousel from '@/components/HorizontalCarousel';
import TodoCard from '@/pages/record/components/TodoCard';
import TodoItemDialog from '@/pages/record/components/TodoItemDialog';
import { useTodoItems, type TodoTarget } from '@/pages/record/useTodoItems';
import type { DailyTodo, TodoItem } from '@/types/record';
import type { Dispatch, SetStateAction } from 'react';

interface TodoCarouselProps {
  todos: DailyTodo[];
  /** 목록을 직접 갈아끼운다(체크·추가·수정을 화면에 바로 반영) */
  setTodos: Dispatch<SetStateAction<DailyTodo[]>>;
  /**
   * 오늘 날짜인지. 지난 날짜는 읽기 전용이다 —
   * 나중에 고치면 캘린더 꽃 표시와 목표 진도가 뒤늦게 흔들린다.
   */
  isToday: boolean;
  /** 완료 개수가 바뀌었을 때 (캘린더 꽃 표시를 다시 세야 한다) */
  onCompletionChanged: () => void;
}

/** 목표별 투두 카드를 좌우 슬라이드로 넘겨보는 캐러셀 */
export default function TodoCarousel({
  todos,
  setTodos,
  isToday,
  onCompletionChanged,
}: TodoCarouselProps) {
  /** 열려 있는 편집 팝업의 대상. item 이 없으면 추가 모드 */
  const [target, setTarget] = useState<TodoTarget>();
  const { toggleItem, submitItem, deleteItem } = useTodoItems(setTodos, onCompletionChanged);

  if (todos.length === 0) {
    return (
      <p className="rounded-2xl bg-muted-foreground/5 py-10 text-center text-sm text-muted-foreground">
        이 날짜에는 할 일이 없어요
      </p>
    );
  }

  /** 완주한 목표는 손대지 않는다(알림도 진도도 멈춘 상태다) */
  const canEdit = (todo: DailyTodo) => isToday && !todo.isGoalCompleted;

  return (
    <>
      <HorizontalCarousel
        items={todos}
        getKey={(todo) => todo.id}
        renderItem={(todo) => (
          <TodoCard
            todo={todo}
            isEditable={canEdit(todo)}
            onToggleItem={(item: TodoItem) => void toggleItem(todo, item)}
            onPressItem={(item: TodoItem) => setTarget({ todo, item })}
            onAddItem={() => setTarget({ todo })}
          />
        )}
      />

      {target && (
        <TodoItemDialog
          item={target.item}
          goalTitle={target.todo.goalTitle}
          onSubmit={async (input) => {
            await submitItem(target, input);
            setTarget(undefined);
          }}
          onDelete={
            target.item
              ? async () => {
                  await deleteItem(target);
                  setTarget(undefined);
                }
              : undefined
          }
          onClose={() => setTarget(undefined)}
        />
      )}
    </>
  );
}
