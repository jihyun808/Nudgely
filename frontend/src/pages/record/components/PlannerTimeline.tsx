// pages/record/components/PlannerTimeline.tsx
import { cn } from '@/lib/utils';
import type { PlannerBlock, PlannerRecordKind } from '@/types/planner';

/** 한 줄이 담는 시간(분) */
const ROW_MINUTES = 30;

/** 실제 기록 출처별 색 */
const KIND_COLORS: Record<PlannerRecordKind, string> = {
  focus: 'bg-primary',
  verify: 'bg-[#1E9E5A]',
  manual: 'bg-[#D9622B]',
};

/** 분 → 'HH:MM' */
function formatTime(minute: number) {
  const hour = String(Math.floor(minute / 60)).padStart(2, '0');
  const rest = String(minute % 60).padStart(2, '0');
  return `${hour}:${rest}`;
}

/**
 * 한 줄(30분)에서 블록들이 차지하는 시간과, 그 줄에 표시할 제목을 구한다.
 * 차지한 시간이 없으면 undefined (아무것도 그리지 않는다).
 */
function getRowFill(blocks: PlannerBlock[], rowStart: number) {
  const rowEnd = rowStart + ROW_MINUTES;
  let coveredMinutes = 0;
  let longest: { block: PlannerBlock; overlap: number } | undefined;

  for (const block of blocks) {
    const overlap =
      Math.min(block.startMinutes + block.durationMinutes, rowEnd) -
      Math.max(block.startMinutes, rowStart);
    if (overlap <= 0) continue;

    coveredMinutes += overlap;
    // 제목·색은 그 줄을 가장 오래 차지한 블록 것을 쓴다
    if (!longest || overlap > longest.overlap) longest = { block, overlap };
  }

  if (!longest) return undefined;

  return {
    title: longest.block.title,
    kind: longest.block.kind,
    ratio: Math.min(coveredMinutes / ROW_MINUTES, 1),
  };
}

/** 한 칸: 얇은 막대 + 그 아래 작은 제목. 막대 길이가 그 30분 중 차지한 시간이다 */
function RowCell({ fill, isPlan }: { fill: ReturnType<typeof getRowFill>; isPlan: boolean }) {
  if (!fill) return <div className="flex-1" />;

  return (
    <div className="min-w-0 flex-1">
      <div
        className={cn(
          'h-2 rounded-full',
          isPlan ? 'bg-primary/30' : KIND_COLORS[fill.kind ?? 'manual'],
        )}
        style={{ width: `${fill.ratio * 100}%` }}
      />
      <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{fill.title}</p>
    </div>
  );
}

interface PlannerTimelineProps {
  planned: PlannerBlock[];
  actual: PlannerBlock[];
  /** 표에 그릴 시간 범위(시). 설정 화면에서 바꿀 수 있다 */
  startHour: number;
  endHour: number;
}

/**
 * 텐미닛 플래너 표.
 * 세로로 30분씩 한 줄이고, 시각은 1시간 단위로만 적는다.
 * 막대는 오른쪽으로 길어지며 그 줄(30분) 중 차지한 시간을 나타내고, 제목은 막대 아래에 붙는다.
 * 일정이 있는 첫 줄부터 마지막 줄까지만 그려서 스크롤 없이 한눈에 들어오게 한다.
 * 그릴 수 있는 범위(startHour~endHour)는 설정 화면에서 정한다.
 */
export default function PlannerTimeline({
  planned,
  actual,
  startHour,
  endHour,
}: PlannerTimelineProps) {
  const blocks = [...planned, ...actual];

  if (blocks.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">이 날의 기록이 없어요</p>;
  }

  // 일정이 걸쳐 있는 구간만 30분 단위로 잘라 그린다
  const dayStart = startHour * 60;
  const dayEnd = endHour * 60;
  const firstMinute = Math.max(
    Math.min(...blocks.map(({ startMinutes }) => startMinutes)),
    dayStart,
  );
  const lastMinute = Math.min(
    Math.max(...blocks.map((b) => b.startMinutes + b.durationMinutes)),
    dayEnd,
  );
  const rowStart = Math.floor(firstMinute / ROW_MINUTES) * ROW_MINUTES;
  const rowEnd = Math.ceil(lastMinute / ROW_MINUTES) * ROW_MINUTES;
  const rows = Array.from(
    { length: (rowEnd - rowStart) / ROW_MINUTES },
    (_, i) => rowStart + i * ROW_MINUTES,
  );

  return (
    <div>
      {/* 열 제목 */}
      <div className="flex gap-2 border-b border-border pb-1.5 text-xs text-muted-foreground">
        <span className="w-11 shrink-0">시간</span>
        <span className="flex-1 text-center">계획</span>
        <span className="flex-1 text-center">실제</span>
      </div>

      {rows.map((minute) => (
        <div key={minute} className="flex items-center gap-2 border-b border-border/60 py-1.5">
          <span className="w-11 shrink-0 text-[11px] font-semibold text-muted-foreground">
            {/* 시각은 1시간 단위로만 적는다 */}
            {minute % 60 === 0 ? formatTime(minute) : ''}
          </span>
          <RowCell fill={getRowFill(planned, minute)} isPlan />
          <RowCell fill={getRowFill(actual, minute)} isPlan={false} />
        </div>
      ))}
    </div>
  );
}
