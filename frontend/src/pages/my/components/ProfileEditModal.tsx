// pages/my/components/ProfileEditModal.tsx
import { useState, type FormEvent } from 'react';
import ImagePicker from '@/components/ImagePicker';
import Modal from '@/components/Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { User } from '@/types/auth';
import { NICKNAME_MAX_LENGTH, type UpdateProfileInput } from '@/types/user';

interface ProfileEditModalProps {
  profile: User;
  onClose: () => void;
  onSave: (input: UpdateProfileInput) => Promise<void> | void;
}

/**
 * 프로필 편집 팝업.
 * 채팅방 개설 팝업과 같은 껍데기(Modal)를 쓰고, 사진과 닉네임만 받는다.
 */
export default function ProfileEditModal({ profile, onClose, onSave }: ProfileEditModalProps) {
  const [nickname, setNickname] = useState(profile.nickname ?? '');
  const [imageUrl, setImageUrl] = useState(profile.imageUrl);
  const [submitError, setSubmitError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!nickname.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setSubmitError(undefined);
    try {
      await onSave({ nickname: nickname.trim(), imageUrl });
      onClose();
    } catch {
      setSubmitError('프로필을 저장하지 못했어요. 다시 시도해주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal title="프로필 편집" onClose={onClose}>
      <form onSubmit={(e) => void handleSubmit(e)}>
        <div className="mt-4">
          <ImagePicker imageUrl={imageUrl} onChange={setImageUrl} label="프로필 사진 선택" />
        </div>

        <div className="mt-5 flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between">
            <Label htmlFor="profile-nickname">
              닉네임 <span className="text-destructive">*</span>
            </Label>
            <span className="text-xs text-muted-foreground">
              {nickname.length}/{NICKNAME_MAX_LENGTH}
            </span>
          </div>
          <Input
            id="profile-nickname"
            value={nickname}
            maxLength={NICKNAME_MAX_LENGTH}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Buddy가 이렇게 불러요"
            autoFocus
          />
        </div>

        {submitError && (
          <p role="alert" className="mt-4 text-center text-xs text-destructive">
            {submitError}
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
          <Button type="submit" className="flex-1" disabled={!nickname.trim() || isSubmitting}>
            {isSubmitting ? '저장 중...' : '저장'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
