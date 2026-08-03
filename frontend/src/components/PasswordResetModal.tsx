// components/PasswordResetModal.tsx
import { useState, type FormEvent } from 'react';
import { requestPasswordReset } from '@/api/settings';
import Modal from '@/components/Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface PasswordResetModalProps {
  /** 미리 채워둘 이메일 (설정 화면에서 열 때 로그인한 계정) */
  defaultEmail?: string;
  onClose: () => void;
}

/**
 * 비밀번호 찾기 팝업.
 * 이메일을 받아 재설정 메일을 보낸다. 설정 화면과 로그인 화면에서 함께 쓴다.
 */
export default function PasswordResetModal({ defaultEmail, onClose }: PasswordResetModalProps) {
  const [email, setEmail] = useState(defaultEmail ?? '');
  const [isSent, setIsSent] = useState(false);
  const [error, setError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setError(undefined);
    try {
      await requestPasswordReset(email.trim());
      setIsSent(true);
    } catch {
      setError('메일을 보내지 못했어요. 잠시 후 다시 시도해주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 보낸 뒤에는 안내만 남긴다 (계정 존재 여부는 알려주지 않는다)
  if (isSent) {
    return (
      <Modal title="메일을 보냈어요" onClose={onClose}>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          <span className="font-semibold text-foreground">{email}</span> 으로 비밀번호 재설정 링크를
          보냈어요. 메일이 오지 않으면 스팸함도 확인해주세요.
        </p>
        <Button type="button" className="mt-6 w-full" onClick={onClose}>
          확인
        </Button>
      </Modal>
    );
  }

  return (
    <Modal title="비밀번호 찾기" onClose={onClose}>
      <form onSubmit={(e) => void handleSubmit(e)}>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          가입한 이메일을 입력하면 비밀번호를 다시 설정할 수 있는 링크를 보내드려요.
        </p>

        <div className="mt-4 flex flex-col gap-1.5">
          <Label htmlFor="reset-email">이메일</Label>
          <Input
            id="reset-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="example@email.com"
            autoFocus
          />
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
          <Button type="submit" className="flex-1" disabled={!email.trim() || isSubmitting}>
            {isSubmitting ? '보내는 중...' : '메일 보내기'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
