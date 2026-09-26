// api/settings.ts
import api from './axios';
import type { AppSettings } from '@/types/settings';

/** 설정 조회 */
export async function fetchSettings(): Promise<AppSettings> {
  const { data } = await api.get<AppSettings>('/settings');
  return data;
}

/** 설정 부분 수정. 바뀐 항목만 보낸다 */
export async function updateSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const { data } = await api.patch<AppSettings>('/settings', patch);
  return data;
}

/** 비밀번호 변경 */
export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await api.post('/auth/password', { currentPassword, newPassword });
}

/**
 * 비밀번호 재설정 메일 보내기.
 * 가입되지 않은 이메일이어도 계정 존재 여부가 드러나지 않도록 서버가 같은 응답을 준다.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  await api.post('/auth/password/reset', { email });
}

/** 회원 탈퇴. 계정과 모든 기록이 삭제된다 */
export async function deleteAccount(): Promise<void> {
  await api.delete('/me');
}
