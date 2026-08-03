// pages/settings/components/PasswordChangeModal.tsx
import { useState, type FormEvent } from 'react';
import { changePassword } from '@/api/settings';
import Modal from '@/components/Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { showToast } from '@/stores/toastStore';

/** 비밀번호 최소 길이 */
const MIN_PASSWORD_LENGTH = 8;

interface PasswordChangeModalProps {
  onClose: () => void;
  /** '비밀번호를 잊었어요'를 눌렀을 때. 비밀번호 찾기 팝업으로 넘긴다 */
  onForgotPassword: () => void;
}

/** 비밀번호 변경 팝업. 현재 비밀번호 확인 후 새 비밀번호를 두 번 받는다 */
export default function PasswordChangeModal({
  onClose,
  onForgotPassword,
}: PasswordChangeModalProps) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isTooShort = next.length > 0 && next.length < MIN_PASSWORD_LENGTH;
  const isMismatched = confirm.length > 0 && next !== confirm;
  const canSubmit =
    current.length > 0 && next.length >= MIN_PASSWORD_LENGTH && next === confirm && !isSubmitting;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setIsSubmitting(true);
    setError(undefined);
    try {
      await changePassword(current, next);
      showToast('비밀번호를 변경했어요', { variant: 'success' });
      onClose();
    } catch {
      setError('비밀번호를 변경하지 못했어요. 현재 비밀번호를 확인해주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal title="비밀번호 변경" onClose={onClose}>
      <form onSubmit={(e) => void handleSubmit(e)}>
        <div className="mt-4 flex flex-col gap-1.5">
          <Label htmlFor="current-password">현재 비밀번호</Label>
          <Input
            id="current-password"
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoFocus
          />
          <button
            type="button"
            onClick={onForgotPassword}
            className="self-end text-xs text-primary underline"
          >
            비밀번호를 잊었어요
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-1.5">
          <Label htmlFor="new-password">새 비밀번호</Label>
          <Input
            id="new-password"
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            placeholder={`${MIN_PASSWORD_LENGTH}자 이상`}
          />
          {isTooShort && (
            <p className="text-xs text-destructive">{MIN_PASSWORD_LENGTH}자 이상 입력해주세요.</p>
          )}
        </div>

        <div className="mt-4 flex flex-col gap-1.5">
          <Label htmlFor="confirm-password">새 비밀번호 확인</Label>
          <Input
            id="confirm-password"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          {isMismatched && <p className="text-xs text-destructive">비밀번호가 일치하지 않아요.</p>}
        </div>

        {error && (
          <p role="alert" className="mt-4 text-center text-xs text-destructive">
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
          <Button type="submit" className="flex-1" disabled={!canSubmit}>
            {isSubmitting ? '변경 중...' : '변경'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
