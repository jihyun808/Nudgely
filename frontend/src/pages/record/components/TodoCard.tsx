// pages/record/components/TodoCard.tsx
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import TodoItemRow from '@/pages/record/components/TodoItemRow';
import { useLongPress } from '@/pages/record/useLongPress';
import type { DailyTodo, TodoItem } from '@/types/record';

/** AI가 만든 항목을 눌렀을 때 안내를 띄워두는 시간(ms) */
const HINT_MS = 3000;

interface TodoCardProps {
  todo: DailyTodo;
  /** 오늘, 진행 중인 목표의 투두만 손댈 수 있다 */
  isEditable: boolean;
  onToggleItem: (item: TodoItem) => void;
  /** 내가 추가한 항목의 글씨를 눌렀을 때 (수정 팝업) */
  onEditItem: (item: TodoItem) => void;
  /** 카드를 길게 눌렀을 때 (추가 팝업) */
  onAddItem: () => void;
}

/**
 * 목표 하나의 하루치 투두 카드.
 * 제목은 목표 이름(Goal.title)이고, 항목은 AI가 만들거나 사용자가 직접 적은 할 일이다.
 *
 * 체크는 모든 항목에 되고, 수정·삭제는 내가 추가한 항목만 된다.
 * 추가는 카드를 길게 누르면 된다.
 */
export default function TodoCard({
  todo,
  isEditable,
  onToggleItem,
  onEditItem,
  onAddItem,
}: TodoCardProps) {
  const { goalTitle, items } = todo;
  const doneCount = items.filter(({ isDone }) => isDone).length;
  const { isPressing, handlers } = useLongPress(onAddItem, isEditable);
  /** AI가 만든 항목을 눌렀을 때 카드 아래에 잠깐 뜨는 안내 */
  const [showsAiHint, setShowsAiHint] = useState(false);

  useEffect(() => {
    if (!showsAiHint) return;
    const timer = window.setTimeout(() => setShowsAiHint(false), HINT_MS);
    return () => window.clearTimeout(timer);
  }, [showsAiHint]);

  /** AI가 만든 항목은 수정 팝업 대신 안내만 띄운다 */
  const handlePressContent = (item: TodoItem) => {
    if (item.source === 'user') onEditItem(item);
    else setShowsAiHint(true);
  };

  return (
    <div
      {...handlers}
      className={cn(
        'rounded-2xl p-4 transition-colors select-none',
        // 길게 누르는 중이라는 걸 색이 진해지는 것으로 알린다
        isPressing ? 'bg-muted-foreground/15' : 'bg-muted-foreground/5',
      )}
    >
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
            onPressContent={() => handlePressContent(item)}
          />
        ))}

        {items.length === 0 && (
          <li className="py-6 text-center text-xs text-muted-foreground">
            아직 할 일이 없어요. AI와 대화하면 자동으로 채워져요
          </li>
        )}
      </ul>

      {showsAiHint && (
        <p className="panel-enter-top mt-3 text-center text-[11px] text-muted-foreground">
          AI가 만든 할 일은 대화로 바꿀 수 있어요
        </p>
      )}
    </div>
  );
}
