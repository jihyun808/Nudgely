// pages/home/components/NotificationList.tsx
import { cn } from '@/lib/utils';
import type { AppNotification, NotificationType } from '@/types/notification';
import { formatNotificationTime } from '@/utils/date';

/** 알림 종류별 앞머리 아이콘 */
const TYPE_ICON: Record<NotificationType, string> = {
  nudge: '💌',
  todoAdded: '📝',
  todoDone: '✅',
  todoIncomplete: '⏰',
  plannerIncomplete: '🗓️',
};

interface NotificationListProps {
  notifications: AppNotification[];
  onSelect: (notification: AppNotification) => void;
}

/**
 * 알림 목록 본문.
 * 읽지 않은 알림은 연한 브랜드 색조, 읽은 알림은 흰 배경.
 * 항목 사이에 구분선은 두지 않는다.
 */
export default function NotificationList({ notifications, onSelect }: NotificationListProps) {
  if (notifications.length === 0) {
    return <p className="px-4 py-8 text-center text-sm text-muted-foreground">새 알림이 없어요</p>;
  }

  return (
    <ul>
      {notifications.map((notification) => {
        const { id, type, title, body, createdAt, isRead } = notification;
        return (
          <li key={id}>
            <button
              type="button"
              onClick={() => onSelect(notification)}
              className={cn(
                'w-full px-4 py-3 text-left transition-colors',
                isRead ? 'bg-background' : 'bg-primary/6',
              )}
            >
              <div className="flex items-center gap-1.5">
                <span aria-hidden>{TYPE_ICON[type]}</span>
                <span className="min-w-0 flex-1 truncate text-xs font-semibold text-muted-foreground">
                  {title}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatNotificationTime(createdAt)}
                </span>
              </div>
              <p className="mt-1 text-sm break-words text-foreground">{body}</p>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
