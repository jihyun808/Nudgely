// pages/record/components/PlannerTimeline.tsx
import { cn } from '@/lib/utils';
import { PLANNER_BLOCK_MINUTES, type PlannerBlock, type PlannerRecordKind } from '@/types/planner';

/** 한 줄이 담는 시간(분) */
const ROW_MINUTES = 60;

/** 한 줄에 들어가는 10분 칸 수 */
const SLOTS_PER_ROW = ROW_MINUTES / PLANNER_BLOCK_MINUTES;

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

/** 그 시각(분)을 덮는 블록. 없으면 undefined */
function blockAt(blocks: PlannerBlock[], minute: number) {
  return blocks.find(
    ({ startMinutes, durationMinutes }) =>
      minute >= startMinutes && minute < startMinutes + durationMinutes,
  );
}

/**
 * 한 줄(1시간)을 10분 칸 6개로 쪼갠다.
 *
 * 칸이 채워지는 기준은 요약(plannerSummary.ts)이 세는 기준과 같다 — 칸의 시작 시각이
 * 블록에 덮이면 채운다. 그래야 화면에서 센 칸 수와 '계획 N블록'이 어긋나지 않는다.
 */
function getRowSlots(blocks: PlannerBlock[], rowStart: number) {
  return Array.from({ length: SLOTS_PER_ROW }, (_, i) =>
    blockAt(blocks, rowStart + i * PLANNER_BLOCK_MINUTES),
  );
}

/** '1-1 소주제 공부 · 선대냥이'. 목표가 없거나 지워졌으면 제목만 */
function labelOf(block: PlannerBlock) {
  return block.goalName ? `${block.title} · ${block.goalName}` : block.title;
}

/** 그 줄을 가장 오래 차지한 블록의 이름표 (칸 아래에 한 줄로 붙인다) */
function getRowLabel(slots: (PlannerBlock | undefined)[]) {
  const counts = new Map<string, { label: string; count: number }>();
  for (const block of slots) {
    if (!block) continue;
    const label = labelOf(block);
    const entry = counts.get(label) ?? { label, count: 0 };
    entry.count += 1;
    counts.set(label, entry);
  }
  if (counts.size === 0) return undefined;
  return [...counts.values()].sort((a, b) => b.count - a.count)[0].label;
}

interface RowCellProps {
  slots: (PlannerBlock | undefined)[];
  isPlan: boolean;
  /** 줄이 시작하는 시각(자정 기준 분) */
  rowStart: number;
  /** 칸을 눌렀을 때. 계획 열이거나 읽기 전용이면 없다 */
  onPressSlot?: (minute: number, block: PlannerBlock | undefined) => void;
}

/** 한 칸: 10분짜리 칸 6개 + 그 아래 제목 */
function RowCell({ slots, isPlan, rowStart, onPressSlot }: RowCellProps) {
  const label = getRowLabel(slots);

  const slotClassName = (block: PlannerBlock | undefined) =>
    cn(
      'h-2 flex-1 rounded-[2px]',
      // 빈 칸도 옅게 그려야 '10분이 한 칸'이라는 게 눈에 보인다
      block
        ? isPlan
          ? 'bg-primary/40'
          : KIND_COLORS[block.kind ?? 'manual']
        : 'bg-muted-foreground/10',
    );

  return (
    <div className="min-w-0 flex-1">
      <div className="flex gap-px">
        {slots.map((block, i) => {
          const minute = rowStart + i * PLANNER_BLOCK_MINUTES;
          if (!onPressSlot) return <div key={i} aria-hidden className={slotClassName(block)} />;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onPressSlot(minute, block)}
              aria-label={
                block
                  ? `${formatTime(minute)} ${block.title} 수정`
                  : `${formatTime(minute)} 기록 추가`
              }
              className={slotClassName(block)}
            />
          );
        })}
      </div>
      <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

interface PlannerTimelineProps {
  planned: PlannerBlock[];
  actual: PlannerBlock[];
  /** 표에 그릴 시간 범위(시). 설정 화면에서 바꿀 수 있다 */
  startHour: number;
  endHour: number;
  /**
   * '실제' 칸을 눌렀을 때. 없으면 읽기 전용이다(지난 날짜 등).
   * 채워진 칸이면 그 기록을, 빈 칸이면 undefined 를 준다(추가 모드).
   */
  onPressActual?: (minute: number, block: PlannerBlock | undefined) => void;
}

/**
 * 텐미닛 플래너 표.
 *
 * 세로로 1시간씩 한 줄이고, 한 줄은 10분짜리 칸 6개로 나뉜다.
 * 칸이 곧 '블록'이라 요약의 블록 수를 화면에서 그대로 셀 수 있고,
 * 08:20~08:40 처럼 시간 중간에 걸친 계획도 제자리에 그려진다.
 * 설정한 범위(기본 06:00~24:00) 전체를 스크롤 없이 한 화면에 그린다.
 */
export default function PlannerTimeline({
  planned,
  actual,
  startHour,
  endHour,
  onPressActual,
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
          {/* 계획은 AI 가 세우므로 누를 수 없다. 실제 기록만 편집한다 */}
          <RowCell slots={getRowSlots(planned, minute)} isPlan rowStart={minute} />
          <RowCell
            slots={getRowSlots(actual, minute)}
            isPlan={false}
            rowStart={minute}
            onPressSlot={onPressActual}
          />
        </div>
      ))}
    </div>
  );
}
