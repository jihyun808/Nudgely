// pages/archive/components/ProgressSummaryCard.tsx
import { useEffect, useState } from 'react';
import ConfettiBurst from '@/components/ConfettiBurst';
import type { GoalProgress } from '@/types/archive';
import { formatDateDot } from '@/utils/date';
import { formatMinutes } from '@/utils/time';

/** 원형 게이지 크기 */
const SIZE = 72;
const STROKE = 7;
const RADIUS = (SIZE - STROKE) / 2;
/** 완료 목표에서 컨페티가 터져 있는 시간(ms) */
const CONFETTI_MS = 2600;

interface ProgressSummaryCardProps {
  progress: GoalProgress;
  /** 시작일부터 오늘(또는 완료일)까지 걸린 날수 */
  spentDays: number;
}

/** 'YYYY-MM' → '7월' */
function formatMonthLabel(yearMonth: string) {
  const month = Number(yearMonth.split('-')[1]);
  return Number.isNaN(month) ? yearMonth : `${month}월`;
}

/**
 * 진도 요약 카드.
 * 왼쪽에 원형 진도율, 오른쪽에 목표 이름과 단계 수를 두고, 아래에 회고 지표를 붙인다.
 * 화면에 들어오면 0%에서 실제 진도까지 채워지고, 완료된 목표는 컨페티가 한 번 터진다.
 */
export default function ProgressSummaryCard({ progress, spentDays }: ProgressSummaryCardProps) {
  const {
    goalTitle,
    startedAt,
    completedAt,
    milestones,
    focusedSeconds,
    completedTodoCount,
    bestMonth,
  } = progress;

  const doneCount = milestones.filter(({ status }) => status === 'done').length;
  const currentCount = milestones.filter(({ status }) => status === 'current').length;
  const upcomingCount = milestones.filter(({ status }) => status === 'upcoming').length;
  const percent = milestones.length > 0 ? Math.round((doneCount / milestones.length) * 100) : 0;
  const isCompleted = Boolean(completedAt);

  /** 화면에 그려진 진도율. 0에서 시작해 실제 값까지 차오른다 */
  const [drawnPercent, setDrawnPercent] = useState(0);
  const [isCelebrating, setIsCelebrating] = useState(false);

  // 다음 프레임에 목표 값을 넣어 0 → percent 전환이 보이게 한다
  useEffect(() => {
    const frame = requestAnimationFrame(() => setDrawnPercent(percent));
    return () => cancelAnimationFrame(frame);
  }, [percent]);

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

  const circumference = 2 * Math.PI * RADIUS;

  const stats = [
    focusedSeconds !== undefined && {
      label: '집중 시간',
      value: formatMinutes(Math.floor(focusedSeconds / 60)),
    },
    completedTodoCount !== undefined && { label: '완료한 할 일', value: `${completedTodoCount}개` },
    bestMonth && { label: '가장 열심히 한 달', value: formatMonthLabel(bestMonth) },
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-background p-4">
      {isCelebrating && <ConfettiBurst particleCount={60} />}

      <div className="relative flex items-center gap-4">
        {/* 원형 진도율 */}
        <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
          <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="h-full w-full">
            <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
              <circle
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                fill="none"
                stroke="currentColor"
                strokeWidth={STROKE}
                className="text-muted-foreground/15"
              />
              <circle
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                fill="none"
                stroke="currentColor"
                strokeWidth={STROKE}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - drawnPercent / 100)}
                className="text-primary transition-[stroke-dashoffset] duration-1000 ease-out"
              />
            </g>
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-primary">
            {percent}%
          </span>
        </div>

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

      {/* 회고 지표 */}
      {stats.length > 0 && (
        <div className="relative mt-4 grid grid-cols-3 gap-2 border-t border-border pt-3 text-center">
          {stats.map(({ label, value }) => (
            <div key={label}>
              <p className="text-sm font-bold">{value}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
