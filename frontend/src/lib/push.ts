// lib/push.ts
// 네이티브 푸시 알림 (Capacitor + FCM).
//
// 앱이 꺼져 있을 때 선톡이 닿는 유일한 길. 웹에서는 아무것도 하지 않는다.
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
 * 알림 권한을 받고 토큰을 서버에 등록한다. 로그인한 뒤에 부른다 —
 * iOS 는 한 번 거절당하면 다시 묻지 못한다.
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
      // 재발급 때 다시 등록하지 않으면 푸시가 조용히 끊긴다
      await FirebaseMessaging.addListener('tokenReceived', ({ token: next }) => {
        if (next && getToken()) void sendToken(next).catch(() => {});
      });
      // 알림을 눌러도 아무 데도 이동하지 않는다(api.md §5.2)
      await FirebaseMessaging.addListener('notificationActionPerformed', () => {});
    }
  } catch (error) {
    console.warn('푸시 등록 실패', error);
  }
}

/** 로그아웃 직전에 부른다. 토큰이 지워지기 전에 붙잡아 둬야 한다. */
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
