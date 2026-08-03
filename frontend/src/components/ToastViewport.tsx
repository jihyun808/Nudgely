// components/ToastViewport.tsx
import { useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useToastStore, type Toast } from '@/stores/toastStore';

const VARIANT_STYLES = {
  info: 'bg-foreground text-background',
  success: 'bg-[#1E9E5A] text-white',
  warning: 'bg-[#D9622B] text-white',
} as const;

/** 토스트 한 개. 정해진 시간이 지나면 스스로 사라진다 */
function ToastItem({ toast }: { toast: Toast }) {
  const dismissToast = useToastStore((state) => state.dismissToast);

  useEffect(() => {
    const timer = window.setTimeout(() => dismissToast(toast.id), toast.durationMs);
    return () => window.clearTimeout(timer);
  }, [toast.id, toast.durationMs, dismissToast]);

  return (
    <button
      type="button"
      onClick={() => dismissToast(toast.id)}
      className={cn(
        'panel-enter-top pointer-events-auto w-full rounded-xl px-4 py-3 text-left text-sm font-medium shadow-lg',
        VARIANT_STYLES[toast.variant],
      )}
    >
      {toast.message}
    </button>
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
