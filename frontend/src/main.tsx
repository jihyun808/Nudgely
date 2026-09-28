// main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import ToastViewport from './components/ToastViewport';
import './styles/index.css';
import { bootstrapNative } from './lib/native';
import { loadSession } from './lib/session';
import { router } from './routes';

// 네이티브 앱일 때만 동작한다(브라우저에서는 즉시 끝난다)
void bootstrapNative();
// 로그인된 채로 열었으면 내가 누구인지 받아 둔다(설정의 이메일 등)
loadSession();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
    {/* 어느 화면에서든 뜨는 상단 토스트 */}
    <ToastViewport />
  </StrictMode>,
);
