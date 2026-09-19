// components/CelebrationOverlay.tsx
import ConfettiBurst from '@/components/ConfettiBurst';
import { Button } from '@/components/ui/button';

interface CelebrationOverlayProps {
  onClose: () => void;
  /** 큼직하게 띄울 이모지 */
  emoji?: string;
  title?: string;
  description?: string;
  /** 스크린 리더가 읽을 이름. 기본값은 title */
  ariaLabel?: string;
}

/**
 * 축하 화면. 확인을 누를 때까지 컨페티가 계속 떨어진다.
 *
 * 집중 탭의 '오늘 목표 시간 달성'과 채팅방의 '목표 완주'가 함께 쓴다.
 * 기본 문구는 집중 탭 기준이고, 다른 축하는 문구만 바꿔 넘긴다.
 */
export default function CelebrationOverlay({
  onClose,
  emoji = '🎉',
  title = '오늘의 집중 시간 달성!',
  description = '목표한 시간을 모두 채웠어요. 오늘 정말 잘했어요!',
  ariaLabel,
}: CelebrationOverlayProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel ?? title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 px-6"
      onClick={onClose}
    >
      <ConfettiBurst isLooping />

      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm rounded-2xl bg-background p-6 text-center shadow-xl"
      >
        <p className="text-4xl">{emoji}</p>
        <h2 className="mt-3 text-lg font-bold">{title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
        <Button className="mt-6 w-full" onClick={onClose}>
          확인
        </Button>
      </div>
    </div>
  );
}
