// pages/record/components/TodoItemDialog.tsx
import { useState } from 'react';
import FormDialog from '@/components/FormDialog';
import InputField from '@/components/InputField';
import { TODO_CONTENT_MAX, TODO_TAG_MAX, type TodoItem, type TodoItemInput } from '@/types/record';

interface TodoItemDialogProps {
  /** 수정할 항목. 없으면 추가 모드 */
  item?: TodoItem;
  /** 어느 목표의 투두인지 (팝업 부제로 보여준다) */
  goalTitle: string;
  onSubmit: (input: TodoItemInput) => Promise<void>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
}

/**
 * 투두 항목을 추가·수정하는 팝업.
 * 카드를 길게 누르면 추가 모드로, 내가 추가한 항목의 글씨를 누르면 수정 모드로 열린다.
 */
export default function TodoItemDialog({
  item,
  goalTitle,
  onSubmit,
  onDelete,
  onClose,
}: TodoItemDialogProps) {
  const [content, setContent] = useState(item?.content ?? '');
  const [tag, setTag] = useState(item?.tag ?? '');

  return (
    <FormDialog
      title={item ? '할 일 수정' : '할 일 추가'}
      validate={() => (content.trim() ? undefined : '할 일을 적어주세요.')}
      onSubmit={() => onSubmit({ content: content.trim(), tag: tag.trim() || undefined })}
      onDelete={onDelete}
      deleteLabel="이 할 일 삭제"
      onClose={onClose}
    >
      <p className="mt-1 mb-4 truncate text-xs text-muted-foreground">{goalTitle}</p>

      <InputField
        label="할 일"
        value={content}
        onChange={setContent}
        placeholder="예: UI/UX 21강 수강"
        maxLength={TODO_CONTENT_MAX}
        autoFocus
      />

      <InputField
        label="태그 (선택)"
        value={tag}
        onChange={setTag}
        placeholder="예: 강의"
        maxLength={TODO_TAG_MAX}
      />
    </FormDialog>
  );
}
