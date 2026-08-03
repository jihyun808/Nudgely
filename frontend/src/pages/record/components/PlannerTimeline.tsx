// pages/record/components/PlannerTimeline.tsx
import { cn } from '@/lib/utils';
import type { PlannerBlock, PlannerRecordKind } from '@/types/planner';

/** 한 줄이 담는 시간(분) */
const ROW_MINUTES = 60;

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
 * 한 줄(1시간)에서 블록들이 차지하는 시간과, 그 줄에 표시할 제목을 구한다.
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

/** 한 칸: 얇은 막대 + 그 아래 작은 제목. 막대 길이가 그 1시간 중 차지한 시간이다 */
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
 * 세로로 1시간씩 한 줄이다.
 * 막대는 오른쪽으로 길어지며 그 줄(1시간) 중 차지한 시간을 나타내고, 제목은 막대 아래에 붙는다.
 * 설정한 범위(기본 06:00~24:00) 전체를 스크롤 없이 한 화면에 그린다.
 */
export default function PlannerTimeline({
  planned,
  actual,
  startHour,
  endHour,
}: PlannerTimelineProps) {
  // 설정한 시간 범위 전체를 1시간 단위로 그린다
  const rows = Array.from({ length: endHour - startHour }, (_, i) => (startHour + i) * ROW_MINUTES);

  return (
    <div>
      {/* 열 제목 */}
      <div className="flex gap-2 border-b border-border pb-1.5 text-xs text-muted-foreground">
        <span className="w-11 shrink-0">시간</span>
        <span className="flex-1 text-center">계획</span>
        <span className="flex-1 text-center">실제</span>
      </div>

      {rows.map((minute) => (
        <div key={minute} className="flex items-center gap-2 border-b border-border/60 py-1">
          <span className="w-11 shrink-0 text-[11px] font-semibold text-muted-foreground">
            {formatTime(minute)}
          </span>
          <RowCell fill={getRowFill(planned, minute)} isPlan />
          <RowCell fill={getRowFill(actual, minute)} isPlan={false} />
        </div>
      ))}
    </div>
  );
}
