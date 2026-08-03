// pages/archive/components/ProgressTimeline.tsx
import { useState } from 'react';
import { cn } from '@/lib/utils';
import ProgressSummaryCard from '@/pages/archive/components/ProgressSummaryCard';
import type { GoalProgress } from '@/types/archive';

const DAY = 24 * 60 * 60 * 1000;

/** 상태별 점 모양 */
const DOT_STYLES = {
  done: 'bg-primary border-primary text-primary-foreground',
  current: 'bg-background border-primary text-primary',
  upcoming: 'bg-background border-border text-muted-foreground',
} as const;

interface ProgressTimelineProps {
  progress: GoalProgress;
}

/**
 * 진도 로드맵.
 * 위에 진도 요약 카드를 두고, 아래에 기간별 계획을 왼쪽 점·선 타임라인으로 잇는다.
 */
export default function ProgressTimeline({ progress }: ProgressTimelineProps) {
  const { startedAt, completedAt, milestones } = progress;

  // 진행 중인 목표는 '오늘'까지로 센다. 화면을 여는 순간의 시각을 한 번만 잡아둔다
  const [openedAt] = useState(() => Date.now());
  const endedAt = completedAt ? new Date(completedAt).getTime() : openedAt;
  const spentDays = Math.max(1, Math.round((endedAt - new Date(startedAt).getTime()) / DAY));

  return (
    <div>
      <ProgressSummaryCard progress={progress} spentDays={spentDays} />

      <ol className="mt-6">
        {milestones.map((milestone, index) => {
          const isLast = index === milestones.length - 1;
          return (
            <li key={milestone.id} className="flex gap-3">
              {/* 왼쪽 점과 잇는 선 */}
              <div className="flex flex-col items-center">
                <span
                  className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-bold',
                    DOT_STYLES[milestone.status],
                  )}
                >
                  {milestone.status === 'done' ? '✓' : index + 1}
                </span>
                {!isLast && (
                  <span
                    className={cn(
                      'w-0.5 flex-1',
                      milestone.status === 'done' ? 'bg-primary/40' : 'bg-border',
                    )}
                  />
                )}
              </div>

              {/* 오른쪽 내용: 카드 없이 텍스트만 */}
              <div className={cn('min-w-0 flex-1', isLast ? 'pb-0' : 'pb-6')}>
                <p
                  className={cn(
                    'text-sm',
                    milestone.status === 'upcoming'
                      ? 'text-muted-foreground'
                      : 'font-semibold text-foreground',
                  )}
                >
                  {milestone.title}
                </p>
                {milestone.status === 'current' && (
                  <p className="mt-0.5 text-xs text-primary">진행 중</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
