// lib/push.ts
// 네이티브 푸시 알림 (Capacitor + FCM).
//
// 앱이 꺼져 있을 때 선톡이 닿는 유일한 길이다. 종 아이콘은 앱을 열어야 보이고,
// 채팅 SSE 는 방을 보고 있어야 살아 있다.
//
// 웹에서는 아무것도 하지 않는다. 브라우저는 OS 푸시를 받을 수 없고,
// 개발은 대부분 브라우저에서 하므로 조용히 넘어가야 한다.
import { FirebaseMessaging } from '@capacitor-firebase/messaging';
import { Capacitor } from '@capacitor/core';
import { registerDevice, unregisterDevice, type DevicePlatform } from '@/api/device';
import { getToken } from '@/lib/auth';

/** 마지막으로 서버에 등록한 FCM 토큰. 로그아웃 때 이걸 지운다 */
const FCM_TOKEN_KEY = 'fcmToken';

/** 리스너를 두 번 붙이지 않는다(붙인 만큼 중복으로 불린다) */
let isListening = false;

function readStoredToken(): string | null {
  try {
    return localStorage.getItem(FCM_TOKEN_KEY);
  } catch {
    return null;
  }
}

function storeToken(token: string | null): void {
  try {
    if (token === null) localStorage.removeItem(FCM_TOKEN_KEY);
    else localStorage.setItem(FCM_TOKEN_KEY, token);
  } catch {
    // 시크릿 모드 등에서 막힐 수 있다. 등록 자체는 계속 진행한다
  }
}

async function sendToken(token: string): Promise<void> {
  const platform = Capacitor.getPlatform() as DevicePlatform;
  await registerDevice(token, platform);
  storeToken(token);
}

/**
 * 알림 권한을 받고 토큰을 서버에 등록한다.
 *
 * **로그인한 뒤에 부른다.** 등록은 인증이 필요하고, 로그인 화면에서 권한을
 * 물어봐야 무엇에 쓰는지 모르는 채로 거절당한다. iOS 는 한 번 거절당하면
 * 다시 묻지 못하므로(설정 앱으로 보내야 한다) 묻는 시점이 중요하다.
 *
 * 실패해도 앱은 그대로 쓴다 — 푸시가 없을 뿐이다.
 */
export async function enablePush(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    const { receive } = await FirebaseMessaging.requestPermissions();
    if (receive !== 'granted') return;

    const { token } = await FirebaseMessaging.getToken();
    if (token) await sendToken(token);

    if (!isListening) {
      isListening = true;
      // FCM 이 토큰을 새로 발급하면(재설치·오랜 미사용) 알려준다.
      // 이때 다시 등록하지 않으면 그 뒤로 푸시가 조용히 끊긴다
      await FirebaseMessaging.addListener('tokenReceived', ({ token: next }) => {
        if (next && getToken()) void sendToken(next).catch(() => {});
      });
      // 알림을 눌렀을 때. **아무 데도 이동하지 않는다** — 앱이 열리는 것까지가
      // 알림의 역할이고, 어디로 갈지는 사용자가 정한다(api.md §5.2)
      await FirebaseMessaging.addListener('notificationActionPerformed', () => {});
    }
  } catch (error) {
    console.warn('푸시 등록 실패', error);
  }
}

/**
 * 등록을 지운다. 로그아웃 직전에 부른다.
 *
 * 액세스 토큰을 지금 붙잡아 둔다 — 로그아웃이 곧 토큰을 지우기 때문에
 * 요청이 나갈 때쯤이면 인터셉터가 붙일 게 없다.
 */
export function disablePush(): void {
  const fcmToken = readStoredToken();
  const accessToken = getToken();
  storeToken(null);
  if (!fcmToken || !accessToken) return;

  // 기다리지 않는다. 로그아웃이 서버 응답 때문에 늦어질 이유가 없다
  void unregisterDevice(fcmToken, accessToken).catch(() => {
    // 실패해도 로그아웃은 진행한다. 다음에 그 기기로 로그인하면 덮어써진다
  });
}
