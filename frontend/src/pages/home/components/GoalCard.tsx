// pages/home/components/GoalCard.tsx
import { cn } from '@/lib/utils';
import { GOAL_CARD_HEIGHT } from '@/pages/home/components/homeCardHeight';
import type { Goal } from '@/types/goal';
import { formatDateDot } from '@/utils/date';

interface GoalCardProps {
  goal: Goal;
}

/**
 * 진행 중인 목표 카드.
 * 목표 이름이 가장 굵고, 기한이 있을 때만 D-day 배지를 붙인다.
 * 진도가 정해지지 않은 목표는 진행률 대신 언제부터 진행 중인지 알려준다.
 */
export default function GoalCard({ goal }: GoalCardProps) {
  const { name, title, startedAt, remainingDays, progress } = goal;
  // TODO: 진도(current/total)를 무엇으로 셀지는 AI가 받는 정보 스펙 확정 후 다시 맞춘다
  const percent =
    progress && progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <div
      className={cn(
        'flex flex-col justify-center rounded-2xl border border-border bg-background px-4',
        GOAL_CARD_HEIGHT,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 text-base font-bold">{title ?? name}</h3>
        {remainingDays !== undefined && (
          <span className="shrink-0 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
            D-{remainingDays}
          </span>
        )}
      </div>

      {progress ? (
        <>
          <div
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${title ?? name} 진행률`}
            className="mt-3 h-2 overflow-hidden rounded-full bg-muted-foreground/10"
          >
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-500"
              style={{ width: `${percent}%` }}
            />
          </div>

          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xs text-muted-foreground">
              {progress.current} / {progress.total}
              {progress.unit} 완료
            </span>
            <span className="text-sm font-bold text-primary">{percent}%</span>
          </div>
        </>
      ) : (
        // 진도를 셀 기준이 없는 목표는 진행 기간으로 대신 알려준다
        <p className="mt-3 text-xs text-muted-foreground">
          {startedAt ? `${formatDateDot(startedAt)}부터 진행 중이에요` : '이제 막 시작했어요'}
        </p>
      )}
    </div>
  );
}
