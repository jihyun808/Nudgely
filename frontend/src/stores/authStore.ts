import { create } from 'zustand';
import type { User } from '@/types/auth';
import { getToken, setToken, removeToken } from '@/lib/auth';
import { disablePush, enablePush } from '@/lib/push';

interface AuthState {
  user: User | null;
  isLoggedIn: boolean;
  // 로그인 성공 시: 토큰을 localStorage에 저장하고 전역 상태를 갱신
  login: (token: string, user: User) => void;
  // 로그아웃: 토큰 제거 후 상태 초기화
  logout: () => void;
  // 유저 정보만 갱신 (예: 프로필 조회 후)
  setUser: (user: User | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  // 새로고침 시 localStorage에 토큰이 남아 있으면 로그인 상태로 시작
  user: null,
  isLoggedIn: Boolean(getToken()),

  login: (token, user) => {
    setToken(token);
    set({ user, isLoggedIn: true });
    // 로그인 직후에 알림 권한을 묻는다. 로그인 화면에서 물으면 무엇에 쓰는지
    // 모르는 채로 거절당하고, iOS 는 거절당한 뒤로 다시 묻지 못한다
    void enablePush();
  },

  logout: () => {
    // 토큰을 지우기 전에 부른다(요청에 실을 액세스 토큰이 필요하다).
    // 안 지우면 이 기기에 이전 사용자의 선톡이 계속 뜬다
    disablePush();
    removeToken();
    set({ user: null, isLoggedIn: false });
  },

  setUser: (user) => set({ user }),
}));
