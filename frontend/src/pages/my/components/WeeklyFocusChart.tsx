// pages/my/components/WeeklyFocusChart.tsx
import { cn } from '@/lib/utils';

const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'] as const;
/** y축 최대치(시간). 이보다 크면 '7+' 구간으로 본다 */
const MAX_HOURS = 7;
/** 그래프 본문 높이(px) */
const CHART_HEIGHT = 154;

interface WeeklyFocusChartProps {
  /** 월요일부터 일요일까지의 집중 시간 */
  hours: number[];
  /** 강조할 요일 인덱스(월=0). 지난 주를 볼 때는 없다 */
  highlightIndex?: number;
}

/** 요일별 집중 시간 막대그래프. 왼쪽에 시간 눈금, 가로줄은 눈금에 맞춘다 */
export default function WeeklyFocusChart({ hours, highlightIndex }: WeeklyFocusChartProps) {
  return (
    <div className="flex gap-2">
      <div
        aria-hidden
        className="flex flex-col justify-between text-[10px] text-muted-foreground"
        style={{ height: CHART_HEIGHT }}
      >
        {[`${MAX_HOURS}+`, 6, 5, 4, 3, 2, 1, 0].map((tick) => (
          <span key={tick} className="leading-none">
            {tick}
          </span>
        ))}
      </div>

      <div className="relative flex-1">
        {/* y축 눈금에 맞춘 희미한 가로줄 */}
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 flex flex-col justify-between"
          style={{ height: CHART_HEIGHT }}
        >
          {Array.from({ length: 8 }, (_, i) => (
            <span key={i} className="h-px w-full bg-border" />
          ))}
        </div>

        <div className="relative flex items-end justify-between gap-1.5">
          {WEEKDAYS.map((weekday, index) => {
            const value = hours[index] ?? 0;
            const isHighlighted = index === highlightIndex;
            const barHeight = (Math.min(value, MAX_HOURS) / MAX_HOURS) * CHART_HEIGHT;

            return (
              <div key={weekday} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex w-full items-end" style={{ height: CHART_HEIGHT }}>
                  <div
                    className={cn(
                      'w-full rounded-t-md transition-[height] duration-300',
                      isHighlighted ? 'bg-primary' : 'bg-primary/25',
                      value === 0 && 'bg-transparent',
                    )}
                    style={{ height: barHeight }}
                  />
                </div>
                <span
                  className={cn(
                    'text-xs',
                    isHighlighted ? 'font-bold text-primary' : 'text-muted-foreground',
                  )}
                >
                  {weekday}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
