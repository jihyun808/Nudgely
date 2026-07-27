// pages/chat/components/ChatMessageBubble.tsx
import ChatAvatar from '@/components/ChatAvatar';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/types/chat';
import { formatMessageTime } from '@/utils/date';

interface ChatMessageBubbleProps {
  message: ChatMessage;
  /** 상대(AI) 이름. 말풍선 위에 표시한다 */
  senderName: string;
  senderImageUrl?: string;
  /** 연속 메시지의 첫 번째일 때만 이름·아바타를 보여준다 */
  showSender?: boolean;
  /** 같은 분(分)에 이어진 메시지 중 마지막에만 시각을 보여준다 */
  showTime?: boolean;
  /** 전송 실패한 메시지 재시도 */
  onRetry?: (message: ChatMessage) => void;
}

/** 파일 첨부 말풍선 내용. 아이콘 가독성 때문에 보낸 쪽과 무관하게 흰 카드로 그린다 */
function FileContent({ name, caption }: { name: string; caption?: string }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4"
        >
          <path d="M14 3v5h5" />
          <path d="M19 8v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7Z" />
        </svg>
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-foreground">{name}</span>
        {caption && <span className="block truncate text-xs text-muted-foreground">{caption}</span>}
      </span>
    </span>
  );
}

/**
 * 채팅 말풍선.
 * 내 메시지는 오른쪽 + 브랜드 색, 상대(AI) 메시지는 왼쪽 + 흰색.
 * 시각은 카카오톡처럼 말풍선 바깥쪽(내 것은 왼쪽, 상대 것은 오른쪽) 아래에 붙는다.
 */
export default function ChatMessageBubble({
  message,
  senderName,
  senderImageUrl,
  showSender = true,
  showTime = true,
  onRetry,
}: ChatMessageBubbleProps) {
  const { role, content, createdAt, file, status } = message;
  const isMine = role === 'user';
  const isFailed = status === 'failed';

  const timeLabel = (
    <span className="shrink-0 pb-0.5 text-[11px] leading-none text-muted-foreground">
      {status === 'sending' ? '전송 중' : showTime ? formatMessageTime(createdAt) : ''}
    </span>
  );

  const bubble = (
    <div
      className={cn(
        'max-w-full rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed break-words whitespace-pre-wrap',
        // 파일 카드는 양쪽 모두 흰 배경, 일반 텍스트는 내 것만 브랜드 색
        file || !isMine
          ? 'border border-border bg-background text-foreground'
          : 'bg-primary text-primary-foreground',
        status === 'sending' && 'opacity-60',
        isFailed && 'opacity-60',
      )}
    >
      {file ? <FileContent name={file.name} caption={file.caption} /> : content}
    </div>
  );

  return (
    <div className={cn('flex gap-2', isMine ? 'justify-end' : 'items-start')}>
      {!isMine &&
        (showSender ? (
          <ChatAvatar name={senderName} imageUrl={senderImageUrl} size="sm" className="mt-5" />
        ) : (
          // 연속 메시지는 아바타 자리만 비워 왼쪽 정렬을 유지한다
          <span aria-hidden className="h-8 w-8 shrink-0" />
        ))}

      <div className={cn('flex max-w-[78%] flex-col', isMine ? 'items-end' : 'items-start')}>
        {!isMine && showSender && (
          <span className="mb-1 text-xs text-muted-foreground">{senderName}</span>
        )}
        <div className="flex max-w-full items-end gap-1.5">
          {isMine && timeLabel}
          {bubble}
          {!isMine && timeLabel}
        </div>
        {isFailed && (
          <button
            type="button"
            onClick={() => onRetry?.(message)}
            className="mt-1 text-[11px] text-destructive underline"
          >
            전송 실패 · 다시 시도
          </button>
        )}
      </div>
    </div>
  );
}
