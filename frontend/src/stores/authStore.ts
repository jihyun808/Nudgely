import { create } from 'zustand';
import type { User } from '@/types/auth';
import { getToken, setToken, removeToken } from '@/lib/auth';

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
  },

  logout: () => {
    removeToken();
    set({ user: null, isLoggedIn: false });
  },

  setUser: (user) => set({ user }),
}));
