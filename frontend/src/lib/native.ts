// lib/native.ts
// 네이티브 껍데기(Capacitor) 안에서만 해야 하는 초기화.
//
// 브라우저에서는 전부 건너뛴다 — 개발은 대부분 브라우저에서 하고,
// 여기서 실패하면 앱이 아예 안 뜬다.
import { Capacitor } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';
import { StatusBar, Style } from '@capacitor/status-bar';
import { isAuthenticated } from '@/lib/auth';
import { enablePush } from '@/lib/push';

export async function bootstrapNative(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  // 앱 안에서만 켜지는 CSS 를 위한 표식(styles/index.css 맨 아래).
  // 웹뷰라 기본값이 브라우저와 같아서, 손대지 않으면 '웹 티' 가 그대로 난다 —
  // 입력창을 누르면 화면이 확대되고, 길게 누르면 글자가 선택된다.
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

  // 이미 로그인된 채로 앱을 다시 연 경우. 토큰이 바뀌었을 수 있어 매번 확인한다
  if (isAuthenticated()) await enablePush();
}
