// pages/chat/components/CreateChatRoomModal.tsx
import { useState, type FormEvent } from 'react';
import ImagePicker from '@/components/ImagePicker';
import Modal from '@/components/Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CHAT_ROOM_LIMITS, type CreateChatRoomInput } from '@/types/chat';

interface CreateChatRoomModalProps {
  onClose: () => void;
  onCreate: (input: CreateChatRoomInput) => Promise<void> | void;
}

/**
 * 채팅방 개설 팝업.
 * 이름/사진/설명/프롬프트를 받고, 필수값은 이름 하나뿐이다.
 */
export default function CreateChatRoomModal({ onClose, onCreate }: CreateChatRoomModalProps) {
  const [name, setName] = useState('');
  const [imageUrl, setImageUrl] = useState<string>();
  const [description, setDescription] = useState('');
  const [prompt, setPrompt] = useState('');
  const [submitError, setSubmitError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    // 사진·설명·프롬프트는 비워도 되고 나중에 설정에서 수정한다
    if (!name.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setSubmitError(undefined);
    try {
      await onCreate({
        name: name.trim(),
        imageUrl,
        description: description.trim(),
        prompt: prompt.trim(),
      });
      onClose();
    } catch {
      setSubmitError('채팅방을 만들지 못했어요. 다시 시도해주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal title="새 채팅방 만들기" onClose={onClose}>
      <form onSubmit={(e) => void handleSubmit(e)}>
        <div className="mt-4">
          <ImagePicker imageUrl={imageUrl} onChange={setImageUrl} label="채팅방 사진 선택" />
        </div>

        {/* 채팅방 이름 (필수) */}
        <div className="mt-5 flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between">
            <Label htmlFor="chat-room-name">
              채팅방 이름 <span className="text-destructive">*</span>
            </Label>
            <span className="text-xs text-muted-foreground">
              {name.length}/{CHAT_ROOM_LIMITS.name}
            </span>
          </div>
          <Input
            id="chat-room-name"
            value={name}
            maxLength={CHAT_ROOM_LIMITS.name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예) 스터디 메이트"
            autoFocus
          />
        </div>

        {/* 설명 */}
        <div className="mt-4 flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between">
            <Label htmlFor="chat-room-description">설명</Label>
            <span className="text-xs text-muted-foreground">
              {description.length}/{CHAT_ROOM_LIMITS.description}
            </span>
          </div>
          <Input
            id="chat-room-description"
            value={description}
            maxLength={CHAT_ROOM_LIMITS.description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="어떤 채팅방인지 짧게 적어주세요"
          />
        </div>

        {/* 프롬프트 */}
        <div className="mt-4 flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between">
            <Label htmlFor="chat-room-prompt">프롬프트</Label>
            <span className="text-xs text-muted-foreground">
              {prompt.length}/{CHAT_ROOM_LIMITS.prompt}
            </span>
          </div>
          <Textarea
            id="chat-room-prompt"
            value={prompt}
            maxLength={CHAT_ROOM_LIMITS.prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="AI가 어떤 말투와 역할로 대화하면 좋을지 적어주세요"
            className="h-28 resize-none"
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
          <Button type="submit" className="flex-1" disabled={!name.trim() || isSubmitting}>
            {isSubmitting ? '만드는 중...' : '만들기'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
