// layouts/AuthFrame.tsx
import { Outlet } from 'react-router-dom';

/**
 * 로그인 전 화면(Landing, Signin, Signup)의 공통 골격.
 * 내부 화면(Layout)과 같은 모바일 폭으로 가운데를 잡고,
 * 폭이 남는 바깥 가장자리는 파란 그라데이션으로 채운다.
 * 안쪽 여백은 각 화면(AuthLayout 등)이 알아서 갖는다.
 */
export default function AuthFrame() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#a8c5f0] to-[#d9e4f5]">
      {/* ring/shadow로 화면 경계에서 파란색이 은은하게 번지게 한다 */}
      <main className="mx-auto min-h-screen max-w-md shadow-[0_0_48px_rgba(76,124,204,0.28)] ring-1 ring-white/40">
        <Outlet />
      </main>
    </div>
  );
}
