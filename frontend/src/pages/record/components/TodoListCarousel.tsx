// pages/record/components/TodoListCarousel.tsx
import HorizontalCarousel from '@/components/HorizontalCarousel';
import TodoListCard from '@/pages/record/components/TodoListCard';
import type { TodoList } from '@/types/record';

interface TodoListCarouselProps {
  todoLists: TodoList[];
}

/** 여러 투두 리스트를 좌우 슬라이드로 넘겨보는 캐러셀 */
export default function TodoListCarousel({ todoLists }: TodoListCarouselProps) {
  if (todoLists.length === 0) {
    return (
      <p className="rounded-2xl bg-muted-foreground/5 py-10 text-center text-sm text-muted-foreground">
        이 날짜에는 투두 리스트가 없어요
      </p>
    );
  }

  return (
    <HorizontalCarousel
      items={todoLists}
      getKey={(todoList) => todoList.id}
      renderItem={(todoList) => <TodoListCard todoList={todoList} />}
    />
  );
}
