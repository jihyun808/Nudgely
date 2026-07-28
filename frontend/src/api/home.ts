// api/home.ts
import { MOCK_HOME_SUMMARY, MOCK_NOTIFICATIONS } from '@/pages/home/mockHome';
import type { HomeSummary } from '@/types/home';
import type { AppNotification } from '@/types/notification';

/** mock 지연 (연동 시 삭제) */
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 홈 화면 요약 조회 (안 읽은 메시지 미리보기 + 진행 중인 목표).
 * TODO: `api.get<HomeSummary>('/home')`로 교체.
 */
export async function fetchHomeSummary(): Promise<HomeSummary> {
  await delay(500);
  return MOCK_HOME_SUMMARY;
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
