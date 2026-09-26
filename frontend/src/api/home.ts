// api/home.ts
import api from './axios';
import type { HomePreview } from '@/types/home';
import type { AppNotification } from '@/types/notification';

/**
 * 홈 상단 미리보기 조회 (안 읽은 메시지 · 공지 · 광고).
 * 목표 목록은 `api/goal.ts`의 `fetchGoals()`를 함께 쓴다.
 */
export async function fetchHomePreviews(): Promise<HomePreview[]> {
  const { data } = await api.get<HomePreview[]>('/home/previews');
  return data;
}

/** 알림 목록 조회 (최신순, 최대 5개) */
export async function fetchNotifications(): Promise<AppNotification[]> {
  const { data } = await api.get<AppNotification[]>('/notifications');
  return data;
}

/** 알림 읽음 처리. 목록을 닫을 때 호출한다 */
export async function markNotificationsAsRead(): Promise<void> {
  await api.post('/notifications/read');
}
