// pages/focus/components/FocusStats.tsx
import { formatMinutes } from '@/utils/time';

interface FocusStatsProps {
  /** 오늘 누적 집중 시간(초) */
  focusedSeconds: number;
  /** 오늘 목표 시간(분) */
  targetMinutes: number;
}

/**
 * 화면 상단의 작은 요약.
 * 오늘 목표 시간과 현재까지 집중한 시간을 보여주고, 아래에 진행 막대를 둔다.
 */
export default function FocusStats({ focusedSeconds, targetMinutes }: FocusStatsProps) {
  const focusedMinutes = Math.floor(focusedSeconds / 60);
  const percent = targetMinutes > 0 ? Math.min((focusedMinutes / targetMinutes) * 100, 100) : 0;

  return (
    <div className="rounded-2xl border border-border bg-background px-4 py-3">
      <div className="flex items-baseline justify-between">
        <span className="text-xs text-muted-foreground">오늘 집중</span>
        <span className="text-sm font-bold">
          {formatMinutes(focusedMinutes)}
          <span className="ml-1 text-xs font-medium text-muted-foreground">
            / 목표 {targetMinutes > 0 ? formatMinutes(targetMinutes) : '없음'}
          </span>
        </span>
      </div>

      <div
        role="progressbar"
        aria-valuenow={Math.round(percent)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="오늘 목표 진행률"
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted-foreground/10"
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
