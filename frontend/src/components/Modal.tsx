// components/Modal.tsx
import { useEffect, useId, type ReactNode } from 'react';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * 화면 중앙에 뜨는 네모난 팝업의 공통 껍데기.
 *
 * **배경을 눌러도 닫히지 않는다.** 닫는 건 팝업 안의 취소·확인 버튼(또는 ESC)뿐이다.
 * 예전에는 배경에 onClick={onClose} 를 걸었는데, click 은 mousedown 과 mouseup 의
 * 공통 조상에 발생해서 팝업 안에서 드래그를 시작해 밖에서 손을 떼면 그대로 닫혔다.
 * (입력칸 글자를 드래그로 고르다 커서가 살짝 나가면 쓰던 내용이 전부 날아갔다.
 *  닫힌 자리에 있던 목록 버튼이 눌려 채팅방으로 넘어가기까지 했다.)
 *
 * 열려 있는 동안 뒤 화면 스크롤을 막는다.
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 px-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="scroll-touch max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-background p-5 shadow-xl"
      >
        <h2 id={titleId} className="text-lg font-bold">
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}
