// api/home.ts
import { delay } from '@/mocks/delay';
import { MOCK_NOTIFICATIONS, MOCK_PREVIEWS } from '@/mocks/home';
import type { HomePreview } from '@/types/home';
import type { AppNotification } from '@/types/notification';

/**
 * 홈 상단 미리보기 조회 (안 읽은 메시지 · 공지 · 광고).
 * 목표 목록은 `api/goal.ts`의 `fetchGoals()`를 함께 쓴다.
 * TODO: `api.get<HomePreview[]>('/home/previews')`로 교체.
 */
export async function fetchHomePreviews(): Promise<HomePreview[]> {
  await delay(500);
  return MOCK_PREVIEWS;
}

/**
 * 알림 목록 조회 (최신순, 최대 5개).
 * TODO: `api.get<AppNotification[]>('/notifications')`로 교체.
 */
export async function fetchNotifications(): Promise<AppNotification[]> {
  await delay(500);
  return MOCK_NOTIFICATIONS;
}

/**
 * 알림 읽음 처리. 목록을 닫을 때 호출한다.
 * TODO: `api.post('/notifications/read')`로 교체.
 */
export async function markNotificationsAsRead(): Promise<void> {
  await delay(100);
}
