// pages/home/components/NotificationBell.tsx
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { markNotificationsAsRead } from '@/api/home';
import NotificationList from '@/pages/home/components/NotificationList';
import { useNotificationStore } from '@/stores/notificationStore';
import type { AppNotification } from '@/types/notification';

/**
 * 헤더 오른쪽 알림 버튼.
 * 안 읽은 알림이 있으면 아이콘 우측 상단에 빨간 점이 뜬다.
 * 버튼을 누르면 아래에 말풍선 모양 목록이 열리고, 닫는 순간 전부 읽음 처리된다.
 */
export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const notifications = useNotificationStore((state) => state.notifications);
  const markAllAsRead = useNotificationStore((state) => state.markAllAsRead);
  const hasUnread = notifications.some(({ isRead }) => !isRead);

  /** 목록을 닫으면서 읽음 처리한다 ('읽었다'의 기준) */
  const close = () => {
    setIsOpen(false);
    if (!hasUnread) return;
    markAllAsRead();
    // 서버 반영은 실패해도 화면을 되돌리지 않는다 (다음 조회 때 맞춰진다)
    void markNotificationsAsRead().catch(() => {});
  };

  // 열려 있는 동안 바깥을 누르거나 ESC를 누르면 닫는다
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) close();
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  });

  const handleSelect = (notification: AppNotification) => {
    close();
    if (notification.linkTo) navigate(notification.linkTo);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => (isOpen ? close() : setIsOpen(true))}
        aria-label={hasUnread ? '읽지 않은 알림 보기' : '알림 보기'}
        aria-expanded={isOpen}
        className="relative flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background text-foreground transition-colors active:bg-muted-foreground/10"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5"
        >
          <path d="M18 8a6 6 0 0 0-12 0c0 6-2 7-2 7h16s-2-1-2-7" />
          <path d="M10.5 20a2 2 0 0 0 3 0" />
        </svg>

        {hasUnread && (
          <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full bg-destructive ring-2 ring-background">
            <span className="sr-only">읽지 않은 알림 있음</span>
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 z-30 mt-2.5 w-[19rem] max-w-[calc(100vw-3rem)]">
          {/* 위쪽으로 삐죽 나온 말풍선 꼭지 */}
          <span
            aria-hidden
            className="absolute -top-1.5 right-4 h-3 w-3 rotate-45 border-t border-l border-border bg-background"
          />
          <div className="max-h-96 overflow-y-auto border border-border bg-background shadow-lg">
            <NotificationList notifications={notifications} onSelect={handleSelect} />
          </div>
        </div>
      )}
    </div>
  );
}
