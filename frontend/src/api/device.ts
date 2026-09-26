// api/device.ts
// 푸시를 받을 기기 등록 (api.md §5.3).
import api from './axios';

export type DevicePlatform = 'ios' | 'android' | 'web';

/**
 * 이 기기로 푸시를 받겠다고 알린다.
 *
 * 앱이 켜질 때마다 부른다 — FCM 토큰은 재설치·데이터 삭제·오랜 미사용으로
 * 조용히 바뀌는데 바뀌었다고 알려주는 신호가 없다. 서버는 같은 토큰이면
 * 덮어쓰기만 하므로 여러 번 불러도 안전하다.
 */
export async function registerDevice(token: string, platform: DevicePlatform): Promise<void> {
  await api.post('/devices', { token, platform });
}

/**
 * 등록을 지운다. **로그아웃할 때 반드시 부른다.**
 * 안 지우면 그 기기에 이전 사용자의 선톡이 계속 뜬다.
 *
 * accessToken 을 따로 받는 이유: 로그아웃은 토큰을 지우면서 진행되는데,
 * 인터셉터가 헤더를 붙일 때쯤이면 이미 지워져 있어 401 이 난다.
 */
export async function unregisterDevice(token: string, accessToken: string): Promise<void> {
  await api.delete(`/devices/${encodeURIComponent(token)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}
