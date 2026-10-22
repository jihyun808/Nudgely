// lib/backButton.ts
// 안드로이드 하드웨어 뒤로가기. iOS 에는 없는 버튼이라 그쪽에서는 불리지 않는다.
import { App } from '@capacitor/app';
import { closers } from '@/lib/closeOnBack';
import { router } from '@/routes';
import { showToast } from '@/stores/toastStore';

/** 여기서 뒤로 가면 앱을 나간다(하단 탭 화면·로그인 전 첫 화면) */
const ROOT_PATHS = ['/home', '/chat', '/focus', '/record', '/my', '/landing', '/signin'];
const EXIT_WINDOW_MS = 2000;
let lastRootBackAt = 0;

/** 앞 화면 기록이 없을 때(알림을 눌러 바로 들어온 경우 등) 돌아갈 곳 */
function parentOf(path: string) {
  if (path.startsWith('/chat/')) return '/chat';
  if (path.startsWith('/settings')) return '/my';
  return '/home';
}

function handleBack() {
  const close = closers.at(-1);
  if (close) {
    close();
    return;
  }

  const path = router.state.location.pathname;
  if (!ROOT_PATHS.includes(path)) {
    const hasPrevious = ((window.history.state as { idx?: number } | null)?.idx ?? 0) > 0;
    void (hasPrevious ? router.navigate(-1) : router.navigate(parentOf(path), { replace: true }));
    return;
  }

  // 실수로 눌러 앱이 꺼지지 않게 한 번 더 누를 때만 나간다
  if (Date.now() - lastRootBackAt < EXIT_WINDOW_MS) {
    void App.exitApp();
    return;
  }
  lastRootBackAt = Date.now();
  showToast('한 번 더 누르면 종료돼요');
}

export async function listenBackButton(): Promise<void> {
  await App.addListener('backButton', handleBack);
}
