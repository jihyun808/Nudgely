// lib/session.ts
import { refreshToken } from '@/api/auth';
import { fetchMyProfile } from '@/api/user';
import { getToken, isAuthenticated, setToken } from '@/lib/auth';
import { useAuthStore } from '@/stores/authStore';

/**
 * 로그인된 채로 앱을 열었을 때 내 프로필을 받아 둔다.
 * 사용자 정보는 메모리에만 있어서, 이게 없으면 설정의 이메일이 '-' 로 보인다.
 */
export function loadSession(): void {
  if (!isAuthenticated()) return;
  void refreshSession();
  const { user, setUser } = useAuthStore.getState();
  if (user) return;

  void fetchMyProfile()
    .then(setUser)
    .catch(() => {});
}

/** 이만큼 지난 토큰만 바꾼다. 앱으로 돌아올 때마다 바꾸면 요청이 너무 잦다 */
const REFRESH_AFTER_MS = 12 * 60 * 60 * 1000;

/** 토큰이 언제 발급됐는지(초). 읽을 수 없으면 0 — 오래된 것으로 보고 바꾼다 */
function issuedAt(token: string): number {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return (JSON.parse(atob(payload)) as { iat?: number }).iat ?? 0;
  } catch {
    return 0;
  }
}

/**
 * 로그인을 이어 간다. 토큰은 7일이면 만료되는데, 열 때마다 새로 받아 두면
 * 매일 쓰는 사람은 로그아웃되지 않는다(7일 넘게 안 열면 다시 로그인한다).
 * 이미 죽은 토큰이면 401 → 인터셉터가 로그인 화면으로 보낸다.
 */
export async function refreshSession(): Promise<void> {
  const token = getToken();
  if (!token || Date.now() - issuedAt(token) * 1000 < REFRESH_AFTER_MS) return;
  try {
    const next = await refreshToken();
    // 기다리는 사이 로그아웃했거나 다른 계정으로 들어왔으면 덮어쓰지 않는다.
    // 덮어쓰면 로그아웃한 사람이 다시 로그인된 채로 남는다
    if (getToken() === token) setToken(next);
  } catch {
    // 네트워크가 끊긴 것일 수 있다. 다음에 열 때 다시 시도한다
  }
}
