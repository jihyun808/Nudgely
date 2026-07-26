// routes/index.tsx
import { createBrowserRouter, Navigate } from 'react-router-dom';
import Layout from '@/layouts/Layout';
import Home from '@/pages/home/Home';
import Chat from '@/pages/chat/Chat';
import Record from '@/pages/record/Record';
import My from '@/pages/my/My';
import Landing from '@/pages/auth/Landing';
import Signin from '@/pages/auth/Signin';
import Signup from '@/pages/auth/Signup';
import { isAuthenticated } from '@/lib/auth';

export const router = createBrowserRouter([
  // 토큰 유무로 분기: 로그인 상태면 홈, 아니면 시작 화면
  {
    path: '/',
    element: <Navigate to={isAuthenticated() ? '/home' : '/landing'} replace />,
  },

  { path: '/landing', element: <Landing /> },
  { path: '/signin', element: <Signin /> },
  { path: '/signup', element: <Signup /> },

  // 로그인 이후 메인: 하단 탭바로 4개 화면을 오간다
  {
    element: <Layout />,
    children: [
      { path: '/home', element: <Home /> },
      { path: '/chat', element: <Chat /> },
      { path: '/record', element: <Record /> },
      { path: '/my', element: <My /> },
    ],
  },
]);
