// components/Modal.tsx
import { useEffect, useId, type ReactNode } from 'react';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * 화면 중앙에 뜨는 네모난 팝업의 공통 껍데기.
 * 배경 클릭 또는 ESC로 닫히고, 열려 있는 동안 뒤 화면 스크롤을 막는다.
 * 열림/닫힘은 부모가 조건부 렌더링으로 제어한다(닫으면 언마운트되어 입력값이 초기화된다).
 */
export default function Modal({ title, onClose, children }: ModalProps) {
  const titleId = useId();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 px-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-background p-5 shadow-xl"
      >
        <h2 id={titleId} className="text-lg font-bold">
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}
