// pages/chat/components/ChatMessageList.tsx
import { useMemo, type RefObject } from 'react';
import ChatDateDivider from '@/pages/chat/components/ChatDateDivider';
import ChatMessageBubble from '@/pages/chat/components/ChatMessageBubble';
import type { ChatMessage } from '@/types/chat';
import type { GoalDetail } from '@/types/goal';
import { isSameDay, isSameMinute } from '@/utils/date';

interface ChatMessageListProps {
  messages: ChatMessage[];
  goal: GoalDetail;
  isReplying: boolean;
  isLoadingOlder: boolean;
  listRef: RefObject<HTMLDivElement | null>;
  bottomRef: RefObject<HTMLDivElement | null>;
  onScroll: () => void;
  onRetry: (message: ChatMessage) => void;
  onOpenImage: (src: string, name: string) => void;
}

/**
 * 말풍선 목록.
 * 날짜가 바뀌면 구분선을 넣고, 같은 사람이 연달아 보내면 이름·아바타를 첫 줄에만 보여준다.
 * 같은 분(分)에 이어진 메시지는 마지막 줄에만 시각을 적는다.
 */
export default function ChatMessageList({
  messages,
  goal,
  isReplying,
  isLoadingOlder,
  listRef,
  bottomRef,
  onScroll,
  onRetry,
  onOpenImage,
}: ChatMessageListProps) {
  const items = useMemo(
    () =>
      messages.map((message, index) => {
        const prev = messages[index - 1];
        const next = messages[index + 1];
        const isNewDay = !prev || !isSameDay(prev.createdAt, message.createdAt);
        return {
          message,
          showDateDivider: isNewDay,
          showSender: isNewDay || prev.role !== message.role,
          showTime:
            !next || next.role !== message.role || !isSameMinute(message.createdAt, next.createdAt),
        };
      }),
    [messages],
  );

  return (
    <div
      ref={listRef}
      onScroll={onScroll}
      className="flex-1 space-y-2 overflow-y-auto bg-muted-foreground/5 px-3 py-3"
    >
      {isLoadingOlder && (
        <p className="py-2 text-center text-xs text-muted-foreground">이전 대화를 불러오는 중...</p>
      )}

      {items.length === 0 && !isReplying && (
        <p className="mt-20 text-center text-sm text-muted-foreground">
          첫 메시지를 보내 대화를 시작해보세요
        </p>
      )}

      {items.map(({ message, showDateDivider, showSender, showTime }) => (
        <div key={message.id} className="space-y-2">
          {showDateDivider && <ChatDateDivider date={message.createdAt} />}
          <ChatMessageBubble
            message={message}
            senderName={goal.name}
            senderImageUrl={goal.imageUrl}
            showSender={showSender}
            showTime={showTime}
            onRetry={onRetry}
            onOpenImage={onOpenImage}
          />
        </div>
      ))}

      {isReplying && (
        <p className="pl-10 text-xs text-muted-foreground" aria-live="polite">
          {goal.name}님이 입력 중...
        </p>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
