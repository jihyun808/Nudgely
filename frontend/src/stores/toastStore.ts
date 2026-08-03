// stores/toastStore.ts
import { create } from 'zustand';

/** 토스트 종류. 색과 아이콘이 달라진다 */
export type ToastVariant = 'info' | 'success' | 'warning';

export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
  /** 자동으로 사라지기까지의 시간(ms) */
  durationMs: number;
}

interface ToastState {
  toasts: Toast[];
  /** 화면 위쪽에 잠깐 뜨는 알림을 띄운다 */
  showToast: (message: string, options?: { variant?: ToastVariant; durationMs?: number }) => void;
  dismissToast: (id: string) => void;
}

/** 동시에 쌓아둘 최대 개수 */
const MAX_TOASTS = 3;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  showToast: (message, options) =>
    set((state) => ({
      toasts: [
        ...state.toasts,
        {
          id: crypto.randomUUID(),
          message,
          variant: options?.variant ?? 'info',
          durationMs: options?.durationMs ?? 3000,
        },
      ].slice(-MAX_TOASTS),
    })),

  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

/** 컴포넌트 밖(타이머 콜백 등)에서도 부를 수 있는 단축 함수 */
export const showToast = (
  message: string,
  options?: { variant?: ToastVariant; durationMs?: number },
) => useToastStore.getState().showToast(message, options);
