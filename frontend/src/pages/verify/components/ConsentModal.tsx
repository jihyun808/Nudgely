// pages/verify/components/ConsentModal.tsx
import { useState } from 'react';
import Modal from '@/components/Modal';
import { Button } from '@/components/ui/button';

interface ConsentModalProps {
  /** skipNext: 다음부터 이 창 없이 바로 시작 */
  onAgree: (skipNext: boolean) => void;
  onClose: () => void;
}

export default function ConsentModal({ onAgree, onClose }: ConsentModalProps) {
  const [skipNext, setSkipNext] = useState(false);

  return (
    <Modal title="카메라로 집중을 인증할까요?" onClose={onClose}>
      <ul className="mt-1 space-y-2.5 text-sm leading-relaxed text-muted-foreground">
        <li>• 자리에 있는지, 졸고 있지는 않은지 체크하고 알림을 줍니다.</li>
        <li>• 영상은 기기에 저장되지 않아요.</li>
      </ul>

      <div className="mt-5 flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onClose}>
          안 할래요
        </Button>
        <Button className="flex-1" onClick={() => onAgree(skipNext)}>
          동의하고 시작
        </Button>
      </div>

      <label className="mt-3 flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={skipNext}
          onChange={(e) => setSkipNext(e.target.checked)}
          className="size-4 accent-primary"
        />
        다시 보지 않기
      </label>
    </Modal>
  );
}
