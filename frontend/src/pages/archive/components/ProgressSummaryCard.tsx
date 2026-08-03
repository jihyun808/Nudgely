// pages/archive/components/ProgressSummaryCard.tsx
import { useEffect, useState } from 'react';
import CircularProgress from '@/components/CircularProgress';
import ConfettiBurst from '@/components/ConfettiBurst';
import ProgressStats from '@/pages/archive/components/ProgressStats';
import type { GoalProgress } from '@/types/archive';
import { formatDateDot } from '@/utils/date';

/** 완료 목표에서 컨페티가 터져 있는 시간(ms) */
const CONFETTI_MS = 2600;

interface ProgressSummaryCardProps {
  progress: GoalProgress;
  /** 시작일부터 오늘(또는 완료일)까지 걸린 날수 */
  spentDays: number;
}

/**
 * 진도 요약 카드.
 * 왼쪽에 원형 진도율, 오른쪽에 목표 이름과 단계 수를 둔다.
 * 완료된 목표에는 컨페티가 한 번 터지고, 아래에 회고 지표가 붙는다.
 */
export default function ProgressSummaryCard({ progress, spentDays }: ProgressSummaryCardProps) {
  const { goalTitle, startedAt, completedAt, milestones } = progress;

  const doneCount = milestones.filter(({ status }) => status === 'done').length;
  const currentCount = milestones.filter(({ status }) => status === 'current').length;
  const upcomingCount = milestones.filter(({ status }) => status === 'upcoming').length;
  const percent = milestones.length > 0 ? Math.round((doneCount / milestones.length) * 100) : 0;
  const isCompleted = Boolean(completedAt);

  const [isCelebrating, setIsCelebrating] = useState(false);

  // 완료된 목표면 한 번 터뜨리고 정리한다
  useEffect(() => {
    if (!isCompleted) return;
    const frame = requestAnimationFrame(() => setIsCelebrating(true));
    const timer = window.setTimeout(() => setIsCelebrating(false), CONFETTI_MS);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [isCompleted]);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-background p-4">
      {isCelebrating && <ConfettiBurst particleCount={60} />}

      <div className="relative flex items-center gap-4">
        <CircularProgress percent={percent} />

        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 text-base font-bold">
            <span aria-hidden>{isCompleted ? '🏆' : '⚡'}</span>
            <span className="truncate">{goalTitle}</span>
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {isCompleted
              ? `${formatDateDot(startedAt)} ~ ${formatDateDot(completedAt!)} · ${spentDays}일 만에 완주!`
              : `${formatDateDot(startedAt)} 시작 · ${spentDays}일째 달리는 중`}
          </p>

          {/* 단계별 개수 */}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-primary" />
              완료 {doneCount}
            </span>
            {currentCount > 0 && (
              <span className="flex items-center gap-1">
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[#F2B441]" />
                진행 중 {currentCount}
              </span>
            )}
            {upcomingCount > 0 && (
              <span className="flex items-center gap-1">
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                예정 {upcomingCount}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 회고 지표는 끝난 목표에만 보여준다 */}
      {isCompleted && <ProgressStats progress={progress} />}
    </div>
  );
}
