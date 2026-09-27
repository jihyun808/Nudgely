// pages/focus/components/FocusControls.tsx
import { Button } from '@/components/ui/button';

interface FocusControlsProps {
  isRunning: boolean;
  /** 0보다 크면 '종료'로 기록을 남길 수 있다 */
  elapsedSeconds: number;
  onStart: () => void;
  onPause: () => void;
  onFinish: () => void;
}

/** 타이머 조작 버튼. 시작·일시정지·이어서 하기·종료 */
export default function FocusControls({
  isRunning,
  elapsedSeconds,
  onStart,
  onPause,
  onFinish,
}: FocusControlsProps) {
  return (
    <div className="flex gap-2">
      {isRunning ? (
        <Button variant="outline" size="lg" className="flex-1 rounded-2xl" onClick={onPause}>
          일시정지
        </Button>
      ) : (
        <Button size="lg" className="flex-1 rounded-2xl" onClick={onStart}>
          {elapsedSeconds > 0 ? '이어서 하기' : '집중 시작하기'}
        </Button>
      )}

      {elapsedSeconds > 0 && (
        <Button variant="outline" size="lg" className="flex-1 rounded-2xl" onClick={onFinish}>
          종료
        </Button>
      )}
    </div>
  );
}
