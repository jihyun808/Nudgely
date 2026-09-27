// components/ToastIcon.tsx
import type { ToastVariant } from '@/stores/toastStore';

/** 종류별 원형 아이콘 배경색 */
const CIRCLE_COLORS: Record<ToastVariant, string> = {
  info: 'bg-primary',
  success: 'bg-[#1E9E5A]',
  warning: 'bg-[#D9622B]',
};

/** 원 안에 들어가는 흰 글리프 */
function Glyph({ variant }: { variant: ToastVariant }) {
  if (variant === 'success') {
    return <path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" strokeWidth={2.6} fill="none" />;
  }
  if (variant === 'warning') {
    // 느낌표
    return <path d="M12 6.5v7m0 3.2v.6" stroke="currentColor" strokeWidth={2.6} fill="none" />;
  }
  // info: 점 + 세로선
  return <path d="M12 10.5v7m0-10.2v.6" stroke="currentColor" strokeWidth={2.6} fill="none" />;
}

interface ToastIconProps {
  variant: ToastVariant;
}

/** 토스트 왼쪽의 색 채운 원형 아이콘 */
export default function ToastIcon({ variant }: ToastIconProps) {
  return (
    <span
      aria-hidden
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white ${CIRCLE_COLORS[variant]}`}
    >
      <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
        <Glyph variant={variant} />
      </svg>
    </span>
  );
}
