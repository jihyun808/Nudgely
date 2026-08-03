// pages/record/components/PlannerSummary.tsx

interface PlannerSummaryProps {
  plannedBlocks: number;
  doneBlocks: number;
  missedBlocks: number;
  achievementRate: number;
}

/** 표에서 계산한 블록 수와 달성률 (10분이 한 블록) */
export default function PlannerSummary({
  plannedBlocks,
  doneBlocks,
  missedBlocks,
  achievementRate,
}: PlannerSummaryProps) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 rounded-2xl bg-muted-foreground/5 py-4 text-center">
        <div>
          <p className="text-xl font-bold">{plannedBlocks}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">계획 블록</p>
        </div>
        <div>
          <p className="text-xl font-bold text-primary">{doneBlocks}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">달성 블록</p>
        </div>
        <div>
          <p className="text-xl font-bold text-[#D9622B]">{missedBlocks}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">미달성</p>
        </div>
      </div>

      <div className="rounded-2xl bg-muted-foreground/5 p-4">
        <p className="text-sm font-semibold">오늘의 달성률</p>
        <div
          role="progressbar"
          aria-valuenow={achievementRate}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="오늘의 달성률"
          className="mt-3 h-2 overflow-hidden rounded-full bg-muted-foreground/15"
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-500"
            style={{ width: `${achievementRate}%` }}
          />
        </div>
        <p className="mt-2 text-sm font-bold text-primary">{achievementRate}%</p>
      </div>
    </div>
  );
}
