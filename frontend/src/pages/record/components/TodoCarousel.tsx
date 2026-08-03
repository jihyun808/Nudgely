// pages/record/components/TodoCarousel.tsx
import HorizontalCarousel from '@/components/HorizontalCarousel';
import TodoCard from '@/pages/record/components/TodoCard';
import type { DailyTodo, TodoItem } from '@/types/record';

interface TodoCarouselProps {
  todos: DailyTodo[];
  /** 오늘의 투두만 손댈 수 있다 (완주한 목표는 오늘 것이어도 읽기 전용) */
  isEditable: boolean;
  onToggleItem: (todo: DailyTodo, item: TodoItem) => void;
  onEditItem: (todo: DailyTodo, item: TodoItem) => void;
  onAddItem: (todo: DailyTodo) => void;
}

/** 목표별 투두 카드를 좌우 슬라이드로 넘겨보는 캐러셀 */
export default function TodoCarousel({
  todos,
  isEditable,
  onToggleItem,
  onEditItem,
  onAddItem,
}: TodoCarouselProps) {
  if (todos.length === 0) {
    return (
      <p className="rounded-2xl bg-muted-foreground/5 py-10 text-center text-sm text-muted-foreground">
        이 날짜에는 할 일이 없어요
      </p>
    );
  }

  return (
    <HorizontalCarousel
      items={todos}
      getKey={(todo) => todo.id}
      renderItem={(todo) => (
        <TodoCard
          todo={todo}
          isEditable={isEditable && !todo.isGoalCompleted}
          onToggleItem={(item) => onToggleItem(todo, item)}
          onEditItem={(item) => onEditItem(todo, item)}
          onAddItem={() => onAddItem(todo)}
        />
      )}
    />
  );
}
