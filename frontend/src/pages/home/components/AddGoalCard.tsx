// pages/home/components/AddGoalCard.tsx
import { cn } from '@/lib/utils';
import { GOAL_CARD_HEIGHT } from '@/pages/home/components/homeCardHeight';

interface AddGoalCardProps {
  onClick?: () => void;
}

/**
 * 목표 추가 카드.
 * 진행 중인 목표 카드와 같은 모양이고, 안에 안내 문구와 원형 + 버튼을 가운데 정렬한다.
 */
export default function AddGoalCard({ onClick }: AddGoalCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-background px-4 transition-colors active:bg-muted-foreground/5',
        GOAL_CARD_HEIGHT,
      )}
    >
      <span className="text-sm font-semibold text-foreground">목표 추가하기</span>
      <span
        aria-hidden
        className="flex h-9 w-9 items-center justify-center rounded-full bg-muted-foreground/10 text-muted-foreground"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          className="h-5 w-5"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
      </span>
    </button>
  );
}
