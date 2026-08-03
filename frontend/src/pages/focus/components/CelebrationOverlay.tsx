// pages/focus/components/CelebrationOverlay.tsx
import ConfettiBurst from '@/components/ConfettiBurst';
import { Button } from '@/components/ui/button';

interface CelebrationOverlayProps {
  onClose: () => void;
}

/**
 * 오늘 목표 시간을 달성했을 때 뜨는 축하 화면.
 * 확인을 누를 때까지 컨페티가 계속 떨어진다.
 */
export default function CelebrationOverlay({ onClose }: CelebrationOverlayProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="오늘의 집중 시간 달성"
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 px-6"
      onClick={onClose}
    >
      <ConfettiBurst isLooping />

      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm rounded-2xl bg-background p-6 text-center shadow-xl"
      >
        <p className="text-4xl">🎉</p>
        <h2 className="mt-3 text-lg font-bold">오늘의 집중 시간 달성!</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          목표한 시간을 모두 채웠어요. 오늘 정말 잘했어요!
        </p>
        <Button className="mt-6 w-full" onClick={onClose}>
          확인
        </Button>
      </div>
    </div>
  );
}
