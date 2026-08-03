// pages/record/components/TodoItemRow.tsx
import { cn } from '@/lib/utils';
import type { TodoItem } from '@/types/record';

interface TodoItemRowProps {
  item: TodoItem;
  /** 오늘, 진행 중인 목표의 투두만 손댈 수 있다 */
  isEditable: boolean;
  onToggle: () => void;
  /** 글씨를 눌렀을 때. AI가 만든 항목이면 수정 대신 안내를 띄운다 */
  onPressContent: () => void;
}

/** 체크 표시 아이콘 */
function CheckIcon() {
  return (
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
  );
}

/** 투두 카드 안의 항목 한 줄: 체크박스 + 내용 + 태그 */
export default function TodoItemRow({
  item,
  isEditable,
  onToggle,
  onPressContent,
}: TodoItemRowProps) {
  const { content, isDone, tag, source } = item;

  const checkboxClassName = cn(
    'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors',
    isDone ? 'border-primary bg-primary' : 'border-border bg-background',
  );
  const contentClassName = cn(
    'min-w-0 flex-1 truncate text-sm',
    isDone ? 'text-muted-foreground line-through' : 'text-foreground',
  );

  return (
    <li className="flex items-center gap-2.5 border-b border-border py-2.5 last:border-b-0">
      {isEditable ? (
        <button
          type="button"
          role="checkbox"
          aria-checked={isDone}
          aria-label={content}
          onClick={onToggle}
          className={checkboxClassName}
        >
          {isDone && <CheckIcon />}
        </button>
      ) : (
        <span
          role="checkbox"
          aria-checked={isDone}
          aria-label={content}
          className={checkboxClassName}
        >
          {isDone && <CheckIcon />}
        </span>
      )}

      {isEditable ? (
        <button
          type="button"
          onClick={onPressContent}
          aria-label={source === 'user' ? `${content} 수정` : content}
          className={cn(contentClassName, 'text-left')}
        >
          {content}
        </button>
      ) : (
        <span className={contentClassName}>{content}</span>
      )}

      {tag && (
        <span className="shrink-0 rounded-md bg-primary/10 px-2 py-0.5 text-xs text-primary">
          {tag}
        </span>
      )}
    </li>
  );
}
