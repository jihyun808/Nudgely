// components/ConfirmDialog.tsx
import { useState } from 'react';
import Modal from '@/components/Modal';
import { Button } from '@/components/ui/button';

interface ConfirmDialogProps {
  title: string;
  /** 본문 안내 문구 */
  description: string;
  /** 확인 버튼 문구 */
  confirmLabel: string;
  /** 되돌릴 수 없는 동작이면 확인 버튼을 빨간색으로 그린다 */
  isDestructive?: boolean;
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
}

/**
 * 되돌리기 어려운 동작(로그아웃, 회원 탈퇴 등) 전에 한 번 더 묻는 팝업.
 * 채팅방 개설 팝업과 같은 껍데기(Modal)를 쓴다.
 */
export default function ConfirmDialog({
  title,
  description,
  confirmLabel,
  isDestructive,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>();

  const handleConfirm = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError(undefined);
    try {
      await onConfirm();
      onClose();
    } catch {
      setError('처리하지 못했어요. 다시 시도해주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal title={title} onClose={onClose}>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{description}</p>

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
        <Button
          type="button"
          className={isDestructive ? 'flex-1 bg-destructive hover:bg-destructive/90' : 'flex-1'}
          onClick={() => void handleConfirm()}
          disabled={isSubmitting}
        >
          {isSubmitting ? '처리 중...' : confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
