// pages/record/components/TodoCard.tsx
import TodoItemRow from '@/pages/record/components/TodoItemRow';
import type { DailyTodo, TodoItem } from '@/types/record';

interface TodoCardProps {
  todo: DailyTodo;
  /**
   * 손댈 수 있는 카드인지. 지난 날짜나 완주한 목표는 읽기 전용이다.
   * 지난 기록을 나중에 고치면 캘린더 꽃 표시와 진도가 뒤늦게 흔들린다.
   */
  isEditable: boolean;
  onToggleItem: (item: TodoItem) => void;
  /** 항목 글씨를 눌렀을 때 (수정) */
  onPressItem: (item: TodoItem) => void;
  /** '할 일 추가' 를 눌렀을 때 */
  onAddItem: () => void;
}

/**
 * 목표 하나의 하루치 투두 카드.
 * 제목은 목표 이름(Goal.title)이고, 항목은 AI 가 만든 것과 내가 넣은 것이 섞인다.
 * 둘 다 체크·수정·삭제할 수 있다(AI 가 잘못 넣은 것을 바로잡는 길).
 */
export default function TodoCard({
  todo,
  isEditable,
  onToggleItem,
  onPressItem,
  onAddItem,
}: TodoCardProps) {
  const { goalTitle, items } = todo;
  const doneCount = items.filter(({ isDone }) => isDone).length;

  return (
    <div className="rounded-2xl bg-muted-foreground/5 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="min-w-0 truncate text-sm font-bold">{goalTitle}</h3>
        <span className="shrink-0 text-xs text-muted-foreground">
          {doneCount}/{items.length}
        </span>
      </div>

      <ul className="mt-3 space-y-1">
        {items.map((item) => (
          <TodoItemRow
            key={item.id}
            item={item}
            isEditable={isEditable}
            onToggle={() => onToggleItem(item)}
            onPressContent={() => onPressItem(item)}
          />
        ))}

        {items.length === 0 && (
          <li className="py-6 text-center text-xs text-muted-foreground">
            아직 할 일이 없어요. AI와 대화하면 자동으로 채워져요
          </li>
        )}
      </ul>

      {isEditable && (
        <button
          type="button"
          onClick={onAddItem}
          className="mt-3 w-full rounded-xl border border-dashed border-border py-2 text-xs text-muted-foreground transition-colors active:bg-muted-foreground/10"
        >
          + 할 일 추가
        </button>
      )}
    </div>
  );
}
