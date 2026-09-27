// stores/notificationStore.ts
import { create } from 'zustand';
import { MAX_NOTIFICATIONS, type AppNotification } from '@/types/notification';

interface NotificationState {
  notifications: AppNotification[];
  /** 서버에서 받아온 목록으로 교체 (최신순, 최대 5개) */
  setNotifications: (notifications: AppNotification[]) => void;
  /** 새 알림 도착. 맨 위에 쌓이고 5개를 넘으면 오래된 것부터 밀려난다 */
  addNotification: (notification: AppNotification) => void;
  /** 목록을 닫을 때 전부 읽음 처리 */
  markAllAsRead: () => void;
}

/** 최신순 정렬 후 최대 개수만큼만 남긴다 */
function takeLatest(notifications: AppNotification[]) {
  return [...notifications]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, MAX_NOTIFICATIONS);
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],

  setNotifications: (notifications) => set({ notifications: takeLatest(notifications) }),

  addNotification: (notification) =>
    set((state) => ({ notifications: takeLatest([notification, ...state.notifications]) })),

  markAllAsRead: () =>
    set((state) => ({
      notifications: state.notifications.map((item) => ({ ...item, isRead: true })),
    })),
}));
