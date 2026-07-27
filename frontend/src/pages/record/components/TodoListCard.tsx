// pages/record/components/TodoListCard.tsx
import { cn } from '@/lib/utils';
import type { TodoList } from '@/types/record';

interface TodoListCardProps {
  todoList: TodoList;
}

/**
 * 투두 리스트 한 묶음 카드.
 * 제목(습관·공부 이름)과 항목들을 보여준다.
 * 항목의 체크 상태는 AI와의 대화로 갱신되므로 화면에서는 읽기 전용이다.
 */
export default function TodoListCard({ todoList }: TodoListCardProps) {
  const { title, items } = todoList;
  const doneCount = items.filter(({ isDone }) => isDone).length;

  return (
    <div className="rounded-2xl bg-muted-foreground/5 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="min-w-0 truncate text-sm font-bold">{title}</h3>
        <span className="shrink-0 text-xs text-muted-foreground">
          {doneCount}/{items.length}
        </span>
      </div>

      <ul className="mt-3 space-y-1">
        {items.map(({ id, content, isDone, tag }) => (
          <li
            key={id}
            className="flex items-center gap-2.5 border-b border-border py-2.5 last:border-b-0"
          >
            {/* AI가 상태를 바꾸므로 버튼이 아닌 표시 전용 체크박스 */}
            <span
              role="checkbox"
              aria-checked={isDone}
              aria-label={content}
              className={cn(
                'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border',
                isDone ? 'border-primary bg-primary' : 'border-border bg-background',
              )}
            >
              {isDone && (
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-3 w-3 text-primary-foreground"
                >
                  <path d="m5 13 4 4L19 7" />
                </svg>
              )}
            </span>

            <span
              className={cn(
                'min-w-0 flex-1 text-sm',
                isDone ? 'text-muted-foreground line-through' : 'text-foreground',
              )}
            >
              {content}
            </span>

            {tag && (
              <span className="shrink-0 rounded-md bg-primary/10 px-2 py-0.5 text-xs text-primary">
                {tag}
              </span>
            )}
          </li>
        ))}

        {items.length === 0 && (
          <li className="py-6 text-center text-xs text-muted-foreground">
            아직 할 일이 없어요. AI와 대화하면 자동으로 채워져요
          </li>
        )}
      </ul>
    </div>
  );
}
