// pages/archive/components/ProgressStats.tsx
import type { GoalProgress } from '@/types/archive';
import { formatMinutes } from '@/utils/time';

/** 'YYYY-MM' → '7월' */
function formatMonthLabel(yearMonth: string) {
  const month = Number(yearMonth.split('-')[1]);
  return Number.isNaN(month) ? yearMonth : `${month}월`;
}

interface ProgressStatsProps {
  progress: GoalProgress;
}

/**
 * 끝난 목표의 회고 지표 (집중 시간 · 완료한 할 일 · 가장 열심히 한 달).
 * 진행 중인 목표에는 보여주지 않는다(아직 회고할 시점이 아니라서).
 * 서버가 아직 주지 않는 값은 칸을 그리지 않는다.
 */
export default function ProgressStats({ progress }: ProgressStatsProps) {
  const { focusedSeconds, completedTodoCount, bestMonth } = progress;

  const stats = [
    focusedSeconds !== undefined && {
      label: '집중 시간',
      value: formatMinutes(Math.floor(focusedSeconds / 60)),
    },
    completedTodoCount !== undefined && {
      label: '완료한 할 일',
      value: `${completedTodoCount}개`,
    },
    bestMonth && { label: '가장 열심히 한 달', value: formatMonthLabel(bestMonth) },
  ].filter(Boolean) as { label: string; value: string }[];

  if (stats.length === 0) return null;

  return (
    <div className="relative mt-4 grid grid-cols-3 gap-2 border-t border-border pt-3 text-center">
      {stats.map(({ label, value }) => (
        <div key={label}>
          <p className="text-sm font-bold">{value}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{label}</p>
        </div>
      ))}
    </div>
  );
}
