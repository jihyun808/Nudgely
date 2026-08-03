// pages/chat/components/ChatInputBar.tsx
import { useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { MESSAGE_MAX_LENGTH } from '@/types/chat';
import { ATTACHMENT_ACCEPT, validateAttachmentFile } from '@/utils/file';

/** 입력창이 늘어날 수 있는 최대 높이(px) */
const MAX_TEXTAREA_HEIGHT = 120;

interface ChatInputBarProps {
  onSend: (content: string) => void;
  onAttach: (file: File) => void;
  /** 전송 중 등으로 입력을 막을 때 */
  disabled?: boolean;
}

/**
 * 채팅방 하단 입력 바.
 * 파일 첨부 버튼 → 메시지 입력 → 보내기 버튼 순서로 배치한다.
 * 첨부는 JPG·PNG·PDF·TXT만 받는다.
 * Enter로 전송하고 Shift+Enter로 줄바꿈한다.
 */
export default function ChatInputBar({ onSend, onAttach, disabled }: ChatInputBarProps) {
  const [content, setContent] = useState('');
  const [fileError, setFileError] = useState<string>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const canSend = content.trim().length > 0 && !disabled;

  const resizeTextarea = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
  };

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    resizeTextarea();
  };

  const handleSend = () => {
    if (!canSend) return;
    onSend(content.trim());
    setContent('');
    // 전송 후 한 줄 높이로 되돌린다
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // 한글 입력 조합 중 Enter는 전송하지 않는다
    if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return;
    e.preventDefault();
    handleSend();
  };

  const handlePickFile = (file: File | undefined) => {
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!file) return;

    const error = validateAttachmentFile(file);
    setFileError(error ?? undefined);
    if (error) return;

    onAttach(file);
  };

  return (
    <footer className="shrink-0 border-t border-border bg-background px-3 py-2.5">
      {fileError && (
        <p role="alert" className="mb-1.5 px-1 text-xs text-destructive">
          {fileError}
        </p>
      )}

      <div className="flex items-end gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          aria-label="파일 첨부"
          className="flex h-10 w-9 shrink-0 items-center justify-center text-muted-foreground transition-colors active:text-foreground disabled:opacity-50"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
          >
            <path d="M21.4 11.1 12 20.5a5.5 5.5 0 0 1-7.8-7.8l8.5-8.5a3.7 3.7 0 0 1 5.2 5.2l-8.5 8.5a1.8 1.8 0 0 1-2.6-2.6l7.6-7.6" />
          </svg>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept={ATTACHMENT_ACCEPT}
          className="hidden"
          onChange={(e) => handlePickFile(e.target.files?.[0])}
        />

        <textarea
          ref={textareaRef}
          rows={1}
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          maxLength={MESSAGE_MAX_LENGTH}
          placeholder="메시지 입력..."
          aria-label="메시지 입력"
          className="max-h-30 min-h-10 flex-1 resize-none rounded-2xl bg-muted-foreground/8 px-4 py-2.5 text-sm leading-snug placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        />

        <button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          aria-label="메시지 보내기"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors active:bg-primary/90 disabled:opacity-40"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-4.5 w-4.5">
            <path d="M3.4 20.4 21 12 3.4 3.6 3.4 10.2 15 12 3.4 13.8Z" />
          </svg>
        </button>
      </div>
    </footer>
  );
}
