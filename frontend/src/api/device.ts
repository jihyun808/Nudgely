// api/device.ts
// 푸시를 받을 기기 등록 (api.md §5.3).
import api from './axios';

export type DevicePlatform = 'ios' | 'android' | 'web';

/** 앱이 켜질 때마다 부른다. FCM 토큰은 조용히 바뀌고 알려주는 신호가 없다. */
export async function registerDevice(token: string, platform: DevicePlatform): Promise<void> {
  await api.post('/devices', { token, platform });
}

/**
 * 로그아웃할 때 반드시 부른다. 안 지우면 그 기기에 이전 사용자의 선톡이 뜬다.
 * accessToken 을 따로 받는 건, 로그아웃이 토큰을 지우면서 진행되기 때문이다.
 */
export async function unregisterDevice(token: string, accessToken: string): Promise<void> {
  await api.delete(`/devices/${encodeURIComponent(token)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}
