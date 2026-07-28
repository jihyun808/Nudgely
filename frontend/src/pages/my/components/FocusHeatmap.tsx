// pages/my/components/FocusHeatmap.tsx
import { useEffect, useMemo, useRef } from 'react';
import { MOCK_HEATMAP_PATTERN, MOCK_JOINED_AT } from '@/pages/my/mockMy';

/** 집중량 5단계 색. 0단계는 기록 없음 */
const LEVEL_COLORS = [
  'bg-muted-foreground/10',
  'bg-primary/20',
  'bg-primary/40',
  'bg-primary/65',
  'bg-primary',
] as const;

const DAY = 24 * 60 * 60 * 1000;

/** 월요일을 0으로 두는 요일 인덱스 */
const toMondayFirst = (date: Date) => (date.getDay() + 6) % 7;

interface FocusHeatmapProps {
  /** 가입일 (ISO 문자열). 히트맵은 이 날부터 오늘까지를 그린다 */
  joinedAt?: string;
}

/**
 * 집중 히트맵(잔디).
 * 가입일부터 오늘까지를 세로 7칸(월~일) × 가로 주 단위로 그린다.
 * 왼쪽이 오래된 날, 오른쪽 끝이 오늘이며, 쓸수록 오른쪽으로 늘어난다.
 * 위에는 달이 바뀌는 주에 월 표시를, 오른쪽 아래에는 색 기준표를 둔다.
 *
 * 값은 하드코딩이다.
 * TODO: 집중 탭 구현 후 날짜별 집중량 API로 교체
 */
export default function FocusHeatmap({ joinedAt = MOCK_JOINED_AT }: FocusHeatmapProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  /** 주 단위 열. 각 열은 월~일 7칸이고, 기간 밖은 null이다 */
  const weeks = useMemo(() => {
    const start = new Date(joinedAt);
    start.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 가입일이 속한 주의 월요일부터 시작해 요일 줄을 맞춘다
    const firstMonday = new Date(start.getTime() - toMondayFirst(start) * DAY);
    const columnCount = Math.floor((today.getTime() - firstMonday.getTime()) / (7 * DAY)) + 1;

    return Array.from({ length: columnCount }, (_, columnIndex) => {
      const columnStart = new Date(firstMonday.getTime() + columnIndex * 7 * DAY);
      const days = Array.from({ length: 7 }, (_, dayIndex) => {
        const date = new Date(columnStart.getTime() + dayIndex * DAY);
        if (date < start || date > today) return null;
        const dayOffset = Math.round((date.getTime() - start.getTime()) / DAY);
        return MOCK_HEATMAP_PATTERN[dayOffset % MOCK_HEATMAP_PATTERN.length];
      });
      return { columnStart, days };
    });
  }, [joinedAt]);

  // 기록이 길어지면 가로로 넘치므로, 처음에는 가장 최근(오른쪽 끝)이 보이게 둔다
  useEffect(() => {
    const scroller = scrollRef.current;
    if (scroller) scroller.scrollLeft = scroller.scrollWidth;
  }, [weeks.length]);

  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <div
        ref={scrollRef}
        aria-label="가입일부터 오늘까지의 집중 기록"
        className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className="w-max">
          {/* 월 표시: 달이 바뀌는 주 위에만 붙인다 */}
          <div aria-hidden className="mb-1 flex gap-1">
            {weeks.map(({ columnStart }, index) => {
              const previousMonth = weeks[index - 1]?.columnStart.getMonth();
              const isNewMonth = index === 0 || columnStart.getMonth() !== previousMonth;
              return (
                <div key={columnStart.toISOString()} className="relative h-3.5 w-4">
                  {isNewMonth && (
                    <span className="absolute top-0 left-0 text-[10px] leading-none whitespace-nowrap text-muted-foreground">
                      {columnStart.getMonth() + 1}월
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex gap-1">
            {weeks.map(({ columnStart, days }) => (
              <div key={columnStart.toISOString()} className="flex flex-col gap-1">
                {days.map((level, dayIndex) =>
                  level === null ? (
                    <span key={dayIndex} className="h-4 w-4" />
                  ) : (
                    <span
                      key={dayIndex}
                      className={`h-4 w-4 rounded-[2px] ${LEVEL_COLORS[level]}`}
                    />
                  ),
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 색 기준표 */}
      <div className="mt-3 flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
        <span>Less</span>
        {LEVEL_COLORS.map((color) => (
          <span key={color} className={`h-3 w-3 rounded-[2px] ${color}`} />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}
