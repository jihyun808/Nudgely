// pages/chat/components/CreateChatRoomModal.tsx
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CHAT_ROOM_LIMITS, type CreateChatRoomInput } from '@/types/chat';
import { validateImageFile } from '@/utils/image';

interface CreateChatRoomModalProps {
  onClose: () => void;
  onCreate: (input: CreateChatRoomInput) => Promise<void> | void;
}

/**
 * 채팅방 개설 팝업.
 * 화면 중앙에 네모난 카드로 떠서 이름/사진/설명/프롬프트를 받는다.
 * 배경 클릭 또는 ESC로 닫힌다.
 * 열림/닫힘은 부모가 조건부 렌더링으로 제어한다(닫으면 언마운트되어 입력값이 초기화된다).
 */
export default function CreateChatRoomModal({ onClose, onCreate }: CreateChatRoomModalProps) {
  const [name, setName] = useState('');
  const [imageUrl, setImageUrl] = useState<string>();
  const [description, setDescription] = useState('');
  const [prompt, setPrompt] = useState('');
  const [imageError, setImageError] = useState<string>();
  const [submitError, setSubmitError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 열려 있는 동안 ESC로 닫고, 뒤 화면 스크롤을 막는다
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  const handlePickImage = async (file: File | undefined) => {
    // 같은 파일을 다시 선택해도 onChange가 뜨도록 input 값을 비워둔다
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!file) return;

    const error = await validateImageFile(file);
    setImageError(error ?? undefined);
    if (error) {
      setImageUrl(undefined);
      return;
    }

    // 서버 연동 전이므로 미리보기용 data URL로만 들고 있는다
    const reader = new FileReader();
    reader.onload = () => setImageUrl(reader.result as string);
    reader.onerror = () => setImageError('사진을 읽지 못했어요. 다시 시도해주세요.');
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    // 필수값은 이름 하나뿐. 사진·설명·프롬프트는 비워도 되고 나중에 설정에서 수정한다
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 px-6"
      onClick={onClose}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-chat-room-title"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => void handleSubmit(e)}
        className="max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-background p-5 shadow-xl"
      >
        <h2 id="create-chat-room-title" className="text-lg font-bold">
          새 채팅방 만들기
        </h2>

        {/* 대표 사진 */}
        <div className="mt-4 flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="relative h-20 w-20 overflow-hidden rounded-full border border-input bg-muted-foreground/5"
            aria-label="채팅방 사진 선택"
          >
            {imageUrl ? (
              <img src={imageUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-2xl text-muted-foreground">
                +
              </span>
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(e) => void handlePickImage(e.target.files?.[0])}
          />
          {imageError && (
            <p role="alert" className="text-center text-xs text-destructive">
              {imageError}
            </p>
          )}
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
    </div>
  );
}
