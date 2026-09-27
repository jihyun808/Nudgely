import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// 개발 중 '/api' 요청을 넘길 백엔드 주소 (uvicorn 기본 포트)
const BACKEND_ORIGIN = process.env.VITE_BACKEND_ORIGIN ?? 'http://localhost:8000';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': BACKEND_ORIGIN,
      // 업로드한 첨부·사진은 백엔드가 /static 으로 서빙한다
      '/static': BACKEND_ORIGIN,
    },
  },
});
