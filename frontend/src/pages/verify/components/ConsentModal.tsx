// pages/verify/components/ConsentModal.tsx
import Modal from '@/components/Modal';
import { Button } from '@/components/ui/button';

interface ConsentModalProps {
  onAgree: () => void;
  onClose: () => void;
}

export default function ConsentModal({ onAgree, onClose }: ConsentModalProps) {
  return (
    <Modal title="카메라로 집중을 인증할까요?" onClose={onClose}>
      <ul className="mt-1 space-y-2.5 text-sm leading-relaxed text-muted-foreground">
        <li>• 자리에 있는지만 확인해요.</li>
        <li>
          • <span className="font-semibold text-foreground">영상은 저장되지 않아요.</span> 기기
          안에서 바로 판단하고 버려요.
        </li>
        <li>• 서버에는 집중했는지 여부만 전해져요.</li>
        <li>• 집중을 멈추면 카메라도 함께 꺼져요.</li>
      </ul>

      <p className="mt-4 rounded-xl bg-muted-foreground/5 p-3 text-xs text-muted-foreground">
        만 14세 미만은 보호자 동의가 필요해요. 설정에서 언제든 끌 수 있어요.
      </p>

      <div className="mt-5 flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onClose}>
          안 할래요
        </Button>
        <Button className="flex-1" onClick={onAgree}>
          동의하고 시작
        </Button>
      </div>
    </Modal>
  );
}
