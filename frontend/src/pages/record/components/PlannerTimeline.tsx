// pages/record/components/PlannerTimeline.tsx
import { cn } from '@/lib/utils';
import { formatMinutes } from '@/pages/record/plannerTime';
import type { PlannerBlock, PlannerRecordKind } from '@/types/planner';

/** 한 줄이 담는 시간(분) */
const ROW_MINUTES = 60;

/** 실제 기록 출처별 색 */
const KIND_COLORS: Record<PlannerRecordKind, string> = {
  focus: 'bg-primary',
  verify: 'bg-[#1E9E5A]',
  manual: 'bg-[#D9622B]',
};

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
    block: longest.block,
    ratio: Math.min(coveredMinutes / ROW_MINUTES, 1),
  };
}

type RowFill = ReturnType<typeof getRowFill>;

/** 한 칸: 얇은 막대 + 그 아래 작은 제목. 막대 길이가 그 1시간 중 차지한 시간이다 */
function RowCell({ fill, isPlan }: { fill: RowFill; isPlan: boolean }) {
  if (!fill) return <div className="h-7" />;

  return (
    <div className="min-w-0">
      <div
        className={cn(
          'h-2 rounded-full',
          isPlan ? 'bg-primary/30' : KIND_COLORS[fill.block.kind ?? 'manual'],
        )}
        style={{ width: `${fill.ratio * 100}%` }}
      />
      <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{fill.block.title}</p>
    </div>
  );
}

interface PlannerTimelineProps {
  planned: PlannerBlock[];
  actual: PlannerBlock[];
  /** 표에 그릴 시간 범위(시). 설정 화면에서 바꿀 수 있다 */
  startHour: number;
  endHour: number;
  /** 오늘의 기록만 손댈 수 있다. 아니면 표시 전용이다 */
  isEditable: boolean;
  /**
   * 아직 오지 않은 시간대에는 기록을 추가할 수 없다.
   * 이 시각(자정 기준 분)보다 뒤에서 시작하는 빈 줄은 누를 수 없게 한다.
   */
  maxStartMinutes: number;
  /** 실제 기록 막대를 눌렀을 때 (수정) */
  onSelectActual: (block: PlannerBlock) => void;
  /** 실제 기록이 없는 시간대를 눌렀을 때 (추가). 그 줄의 시작 분을 넘긴다 */
  onAddActual: (startMinutes: number) => void;
}

/**
 * 텐미닛 플래너 표.
 * 세로로 1시간씩 한 줄이다.
 * 막대는 오른쪽으로 길어지며 그 줄(1시간) 중 차지한 시간을 나타내고, 제목은 막대 아래에 붙는다.
 *
 * 계획은 AI가 정하므로 읽기 전용이고, 실제 열은 어디를 눌러도 추가·수정 팝업이 열린다.
 */
export default function PlannerTimeline({
  planned,
  actual,
  startHour,
  endHour,
  isEditable,
  maxStartMinutes,
  onSelectActual,
  onAddActual,
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

      {rows.map((minute) => {
        const actualFill = getRowFill(actual, minute);
        const time = formatMinutes(minute);
        // 빈 칸은 지나간 시간에만 채울 수 있다.
        // 기록이 있는 줄은 늘 열어둔다 (정상적으로는 지나간 시간에만 생기지만,
        //  경계에 걸친 기록을 고치지 못하는 일이 없게 한다)
        const canPress = isEditable && (Boolean(actualFill) || minute <= maxStartMinutes);

        return (
          <div key={minute} className="flex items-center gap-2 border-b border-border/60 py-1">
            <span className="w-11 shrink-0 text-[11px] font-semibold text-muted-foreground">
              {time}
            </span>

            <div className="min-w-0 flex-1">
              <RowCell fill={getRowFill(planned, minute)} isPlan />
            </div>

            {/* 실제 열: 막대가 있으면 수정, 비어 있으면 그 시간대로 추가 (오늘의 지나간 시간만) */}
            {canPress ? (
              <button
                type="button"
                onClick={() =>
                  actualFill ? onSelectActual(actualFill.block) : onAddActual(minute)
                }
                aria-label={
                  actualFill ? `${time} ${actualFill.block.title} 기록 수정` : `${time} 기록 추가`
                }
                // 표 전체가 눌리는 칸이라 눌린 배경색은 두지 않는다 (표가 어수선해진다)
                className="min-w-0 flex-1 px-1 text-left"
              >
                <RowCell fill={actualFill} isPlan={false} />
              </button>
            ) : (
              <div className="min-w-0 flex-1 px-1">
                <RowCell fill={actualFill} isPlan={false} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
