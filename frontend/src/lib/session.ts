// lib/session.ts
import { fetchMyProfile } from '@/api/user';
import { isAuthenticated } from '@/lib/auth';
import { useAuthStore } from '@/stores/authStore';

/**
 * 로그인된 채로 앱을 열었을 때 내 프로필을 받아 둔다.
 * 사용자 정보는 메모리에만 있어서, 이게 없으면 설정의 이메일이 '-' 로 보인다.
 */
export function loadSession(): void {
  if (!isAuthenticated()) return;
  const { user, setUser } = useAuthStore.getState();
  if (user) return;

  void fetchMyProfile()
    .then(setUser)
    .catch(() => {});
}
