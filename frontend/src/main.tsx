// main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import ToastViewport from './components/ToastViewport';
import './styles/index.css';
import { router } from './routes';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
    {/* 어느 화면에서든 뜨는 상단 토스트 */}
    <ToastViewport />
  </StrictMode>,
);
