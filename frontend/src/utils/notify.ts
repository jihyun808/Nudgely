// utils/notify.ts

/**
 * 브라우저 알림.
 *
 * 앱이 백그라운드에 있어도 OS 알림 센터에 뜨게 하려는 용도다.
 * 다만 웹에서는 한계가 있다.
 * - 권한을 허용해야 하고, 데스크톱 브라우저에서만 안정적으로 동작한다
 * - iOS 사파리는 홈 화면에 설치한 경우에만 지원한다
 *
 * TODO: 집중하는 동안 폰 알림바에 '계속 남아 있는' 상주 알림은 웹으로 불가능하다.
 *       Capacitor 래핑 후 @capacitor/local-notifications(안드로이드 foreground service,
 *       iOS Live Activity)로 구현한다.
 */

/** 알림 권한을 요청한다. 이미 결정된 상태면 그대로 돌려준다 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied';
  if (Notification.permission !== 'default') return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

/**
 * 알림 띄우기.
 * @param tag 같은 tag를 쓰면 이전 알림을 덮어써서 알림이 쌓이지 않는다
 */
export function showNotification(title: string, body: string, tag = 'nudgely-focus') {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    // requireInteraction: 사용자가 닫기 전까지 남겨둔다 (지원하는 브라우저에서만)
    new Notification(title, { body, tag, requireInteraction: true });
  } catch {
    // 알림을 못 띄워도 타이머 동작에는 영향이 없다
  }
}
