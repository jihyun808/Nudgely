// components/ToastViewport.tsx
import { useEffect } from 'react';
import ToastIcon from '@/components/ToastIcon';
import { cn } from '@/lib/utils';
import { useToastStore, type Toast } from '@/stores/toastStore';

/** 종류별 배경·테두리·글씨 색 */
const VARIANT_STYLES = {
  // 배경은 반투명이 아닌 색으로 둔다 (투명하면 뒤 글자가 비친다)
  info: 'bg-[#EDF3FE] border-primary/30 text-[#1D4ED8]',
  success: 'bg-[#EAF7F0] border-[#1E9E5A]/30 text-[#177A46]',
  warning: 'bg-[#FDF2E9] border-[#D9622B]/30 text-[#B04E1F]',
} as const;

/** 토스트 한 개. 정해진 시간이 지나면 스스로 사라진다 */
function ToastItem({ toast }: { toast: Toast }) {
  const dismissToast = useToastStore((state) => state.dismissToast);

  useEffect(() => {
    const timer = window.setTimeout(() => dismissToast(toast.id), toast.durationMs);
    return () => window.clearTimeout(timer);
  }, [toast.id, toast.durationMs, dismissToast]);

  return (
    <div
      className={cn(
        'panel-enter-top pointer-events-auto flex items-center gap-2.5 rounded-2xl border px-3.5 py-3 shadow-sm',
        VARIANT_STYLES[toast.variant],
      )}
    >
      <ToastIcon variant={toast.variant} />
      <p className="min-w-0 flex-1 text-sm font-medium">{toast.message}</p>

      <button
        type="button"
        onClick={() => dismissToast(toast.id)}
        aria-label="알림 닫기"
        className="shrink-0 text-muted-foreground transition-opacity active:opacity-60"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          className="h-4 w-4"
        >
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  );
}

/**
 * 앱 전체에서 쓰는 상단 토스트 영역.
 * 어느 화면에 있든 화면 위쪽 가운데에 잠깐 떴다가 사라진다.
 */
export default function ToastViewport() {
  const toasts = useToastStore((state) => state.toasts);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] mx-auto flex max-w-md flex-col gap-2 px-4 pt-3"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
