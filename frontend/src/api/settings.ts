// api/settings.ts
import api from './axios';
import { setToken } from '@/lib/auth';
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

/**
 * 비밀번호 변경.
 *
 * 바꾸는 순간 **다른 기기는 전부 로그아웃된다**(서버가 토큰 번호를 올린다).
 * 이 기기까지 끊기지 않도록 새 토큰을 받아 갈아 끼운다.
 */
export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const { data } = await api.post<{ accessToken: string }>('/auth/password', {
    currentPassword,
    newPassword,
  });
  setToken(data.accessToken);
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
