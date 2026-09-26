// components/FormDialog.tsx
import { useState, type ReactNode } from 'react';
import Modal from '@/components/Modal';
import { Button } from '@/components/ui/button';

interface FormDialogProps {
  title: string;
  /** 입력값을 검사해 문제가 있으면 안내 문구를 돌려준다 */
  validate?: () => string | undefined;
  onSubmit: () => Promise<void>;
  /** 있으면 팝업 아래에 작은 삭제 버튼을 둔다 */
  onDelete?: () => Promise<void>;
  deleteLabel?: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * 입력 폼이 든 팝업의 공통 껍데기 (투두 항목, 플래너 실제 기록).
 * 저장 중 잠금·실패 문구·삭제 버튼을 여기서 처리하고, 입력 칸만 children으로 받는다.
 * 되돌리기 어려운 동작을 묻기만 할 때는 ConfirmDialog를 쓴다.
 */
export default function FormDialog({
  title,
  validate,
  onSubmit,
  onDelete,
  deleteLabel,
  onClose,
  children,
}: FormDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>();

  const run = async (action: () => Promise<void>, failMessage: string) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError(undefined);
    try {
      await action();
      onClose();
    } catch {
      setError(failMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = () => {
    const message = validate?.();
    if (message) {
      setError(message);
      return;
    }
    void run(onSubmit, '저장하지 못했어요. 다시 시도해주세요.');
  };

  return (
    <Modal title={title} onClose={onClose}>
      {children}

      {error && (
        <p role="alert" className="mt-3 text-center text-xs text-destructive">
          {error}
        </p>
      )}

      <div className="mt-6 flex gap-2">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={onClose}
          disabled={isSubmitting}
        >
          취소
        </Button>
        <Button type="button" className="flex-1" onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? '저장 중...' : '저장'}
        </Button>
      </div>

      {/* 삭제는 실수로 누르지 않게 아래에 작게 둔다 */}
      {onDelete && (
        <button
          type="button"
          disabled={isSubmitting}
          onClick={() => void run(onDelete, '삭제하지 못했어요. 다시 시도해주세요.')}
          className="mt-4 w-full text-center text-xs text-muted-foreground underline underline-offset-2 disabled:opacity-50"
        >
          {deleteLabel}
        </button>
      )}
    </Modal>
  );
}
