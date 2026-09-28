// lib/session.ts
import { fetchMyProfile } from '@/api/user';
import { isAuthenticated } from '@/lib/auth';
import { useAuthStore } from '@/stores/authStore';

/**
 * 로그인된 채로 앱을 열었을 때 내 프로필을 한 번 받아 둔다.
 *
 * 토큰은 localStorage 에 남지만 사용자 정보는 메모리에만 있다. 그래서 앱을
 * 다시 열면 '로그인은 돼 있는데 내가 누군지는 모르는' 상태가 된다 — 설정 화면의
 * 이메일이 '-' 로 보이던 이유다(마이페이지에 들렀을 때만 채워졌다).
 *
 * 실패해도 아무것도 막지 않는다. 토큰이 죽었으면 다음 요청의 401 인터셉터가
 * 로그인 화면으로 보낸다.
 */
export function loadSession(): void {
  if (!isAuthenticated()) return;
  const { user, setUser } = useAuthStore.getState();
  if (user) return;

  void fetchMyProfile()
    .then(setUser)
    .catch(() => {});
}
