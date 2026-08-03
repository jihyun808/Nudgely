import axios, { AxiosError } from 'axios';
import { getToken } from '@/lib/auth';
import { useAuthStore } from '@/stores/authStore';

// 백엔드가 아직 없어 개발 중에는 MSW 등으로 모킹. 기본값은 '/api'.
const baseURL = import.meta.env.VITE_API_BASE_URL ?? '/api';

export const api = axios.create({
  baseURL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 요청 인터셉터: 토큰이 있으면 Authorization 헤더 자동 첨부
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 응답 인터셉터: 401이면 토큰 제거 후 로그인 페이지로
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      // 토큰 제거 + 전역 로그인 상태 초기화
      useAuthStore.getState().logout();
      if (window.location.pathname !== '/signin') {
        window.location.href = '/signin';
      }
    }
    return Promise.reject(error);
  },
);

export default api;
