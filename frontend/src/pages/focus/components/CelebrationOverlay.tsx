// pages/focus/components/CelebrationOverlay.tsx
import { Button } from '@/components/ui/button';

/** 컨페티 조각 색 */
const CONFETTI_COLORS = ['#2563EB', '#1E9E5A', '#E2483D', '#F2B441', '#8B5CF6'];
/** 조각 개수 */
const PIECE_COUNT = 36;

interface CelebrationOverlayProps {
  onClose: () => void;
}

/**
 * 오늘 목표 시간을 달성했을 때 뜨는 축하 화면.
 * 컨페티는 라이브러리 없이 CSS 애니메이션으로 떨어뜨린다.
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
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        {Array.from({ length: PIECE_COUNT }, (_, i) => (
          <span
            key={i}
            className="confetti-piece"
            style={{
              left: `${(i * 100) / PIECE_COUNT}%`,
              backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
              animationDelay: `${(i % 12) * 0.15}s`,
              animationDuration: `${2.4 + (i % 5) * 0.3}s`,
            }}
          />
        ))}
      </div>

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
