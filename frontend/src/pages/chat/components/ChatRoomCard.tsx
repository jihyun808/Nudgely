// pages/chat/components/ChatRoomCard.tsx
import ChatAvatar from '@/components/ChatAvatar';
import type { ChatRoom } from '@/types/chat';
import { formatChatTime } from '@/utils/date';

interface ChatRoomCardProps {
  room: ChatRoom;
  onClick?: (room: ChatRoom) => void;
}

/**
 * 채팅 목록의 한 줄.
 * 왼쪽 이미지(없으면 이름 첫 글자 아바타) + 방 이름/최근 메시지 + 최근 시각/안 읽은 개수.
 */
export default function ChatRoomCard({ room, onClick }: ChatRoomCardProps) {
  const { name, imageUrl, lastMessage, lastMessageAt, unreadCount } = room;
  const hasUnread = unreadCount > 0;

  return (
    <button
      type="button"
      onClick={() => onClick?.(room)}
      className="flex w-full items-center gap-3 px-6 py-3.5 text-left transition-colors active:bg-muted-foreground/5"
    >
      <ChatAvatar name={name} imageUrl={imageUrl} />

      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-bold text-foreground">{name}</p>
        <p className="truncate text-sm text-muted-foreground">{lastMessage}</p>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <span className="text-xs text-muted-foreground">{formatChatTime(lastMessageAt)}</span>
        {hasUnread && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground">
            {unreadCount > 99 ? '99+' : unreadCount}
            <span className="sr-only">개의 새 메시지</span>
          </span>
        )}
      </div>
    </button>
  );
}
