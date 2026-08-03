// api/settings.ts
import { MOCK_SETTINGS } from '@/mocks/settings';
import type { AppSettings } from '@/types/settings';

/** mock 지연 (연동 시 삭제) */
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** mock 단계에서 화면이 바꾼 값을 들고 있는 사본 (새로고침하면 초기화된다) */
let currentSettings: AppSettings = structuredClone(MOCK_SETTINGS);

/**
 * 설정 조회.
 * TODO: `api.get<AppSettings>('/settings')`로 교체.
 */
export async function fetchSettings(): Promise<AppSettings> {
  await delay(400);
  return structuredClone(currentSettings);
}

/**
 * 설정 부분 수정. 바뀐 항목만 보낸다.
 * TODO: `api.patch<AppSettings>('/settings', patch)`로 교체.
 */
export async function updateSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  await delay(300);
  currentSettings = { ...currentSettings, ...patch };
  return structuredClone(currentSettings);
}

/**
 * 비밀번호 변경.
 * TODO: `api.post('/auth/password', { currentPassword, newPassword })`로 교체.
 */
export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  if (!currentPassword || !newPassword) throw new Error('INVALID_PASSWORD');
  await delay(400);
}

/**
 * 비밀번호 재설정 메일 보내기.
 * 가입되지 않은 이메일이어도 계정 존재 여부가 드러나지 않도록 같은 응답을 준다.
 * TODO: `api.post('/auth/password/reset', { email })`로 교체.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  if (!email) throw new Error('INVALID_EMAIL');
  await delay(500);
}

/**
 * 회원 탈퇴. 계정과 모든 기록이 삭제된다.
 * TODO: `api.delete('/me')`로 교체.
 */
export async function deleteAccount(): Promise<void> {
  await delay(500);
}
