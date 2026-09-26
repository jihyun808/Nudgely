import axios, { AxiosError } from 'axios';
import { getToken } from '@/lib/auth';
import { useAuthStore } from '@/stores/authStore';

// 백엔드 주소. 개발에서는 '/api'로 두고 vite 프록시가 백엔드로 넘긴다.
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  // 파일 업로드가 섞여 있어 넉넉하게 잡는다 (AI 응답은 axios를 타지 않는다)
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * FormData를 보낼 때 요청 설정에 펴 넣는다.
 * 인스턴스 기본값인 JSON 헤더를 걷어내야 브라우저가 boundary를 붙인 multipart 헤더를 만든다.
 */
export const MULTIPART = { headers: { 'Content-Type': undefined } };

/** 토큰이 죽었을 때의 공통 처리. 인터셉터와 SSE 호출이 함께 쓴다 */
export function handleUnauthorized() {
  // 토큰 제거 + 전역 로그인 상태 초기화
  useAuthStore.getState().logout();
  if (window.location.pathname !== '/signin') {
    window.location.href = '/signin';
  }
}

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
      handleUnauthorized();
    }
    return Promise.reject(error);
  },
);

export default api;
