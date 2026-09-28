// lib/native.ts
// Capacitor 안에서만 하는 초기화. 브라우저에서는 전부 건너뛴다.
import { Capacitor } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';
import { StatusBar, Style } from '@capacitor/status-bar';
import { isAuthenticated } from '@/lib/auth';
import { enablePush } from '@/lib/push';

export async function bootstrapNative(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  // 앱 전용 CSS 표식(styles/index.css 맨 아래)
  document.documentElement.classList.add('native');

  try {
    // 배경이 흰색이라 상태바 글씨는 검정이어야 보인다
    await StatusBar.setStyle({ style: Style.Light });
  } catch {
    // 안드로이드 일부 기기에서 막힌다. 색이 안 맞을 뿐이라 넘어간다
  }

  try {
    // 입력창을 누르면 키보드 위 액세서리 바가 뜬다. 채팅 화면에서 자리만 먹는다
    await Keyboard.setAccessoryBarVisible({ isVisible: false });
  } catch {
    // iOS 전용이다
  }

  // 토큰이 바뀌었을 수 있어 열 때마다 확인한다
  if (isAuthenticated()) await enablePush();
}
