// layouts/Layout.tsx
import { Outlet } from 'react-router-dom';
import BottomNav from '@/layouts/BottomNav';

/**
 * 로그인 이후 메인 화면의 공통 골격.
 * 컨텐츠 영역(Outlet) + 하단 고정 탭바(BottomNav)로 구성된다.
 * pb-20: 탭바에 컨텐츠가 가려지지 않도록 하단 여백 확보.
 */
export default function Layout() {
  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-md px-6 pt-6 pb-20">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
