// pages/my/components/WeeklyFocusCard.tsx
import { cn } from '@/lib/utils';
import { MOCK_WEEKLY_FOCUS_HOURS } from '@/mocks/my';

const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'] as const;
/** y축 최대치(시간). 이보다 크면 '7+' 구간으로 본다 */
const MAX_HOURS = 7;
/** 그래프 본문 높이(px) */
const CHART_HEIGHT = 154;
/** 지난 주 대비 증가량(시간). 집중 기록이 없어 하드코딩 */
const DIFF_FROM_LAST_WEEK = 1.2;

/** 월요일을 0으로 두는 오늘의 요일 인덱스 */
const getTodayIndex = (now = new Date()) => (now.getDay() + 6) % 7;

/** 이번 달 기준 몇 주차인지 (1일이 속한 주를 1주차로 센다) */
function getWeekLabel(now = new Date()) {
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const weekIndex = Math.ceil((now.getDate() + firstDay.getDay()) / 7);
  return `${now.getMonth() + 1}월 ${weekIndex}주차`;
}

/** 1.5 → '1.5h', 2 → '2h' */
const formatHours = (hours: number) => `${Number(hours.toFixed(1))}h`;

/**
 * 이번 주 집중 카드.
 * 위쪽은 요일별 막대그래프(오늘 요일을 브랜드 색으로 강조), 아래쪽은 총합·지난 주 대비·최고 집중 요일.
 *
 * 값은 전부 하드코딩이다(집중 탭이 없어 실제 집중 시간을 만들 수 없다).
 * TODO: 집중 탭 구현 후 요일별 집중 시간 API로 교체
 */
export default function WeeklyFocusCard() {
  const hours = MOCK_WEEKLY_FOCUS_HOURS;
  const total = hours.reduce((sum, value) => sum + value, 0);
  const maxHours = Math.max(...hours);
  /** 아래 요약에 쓰는 최고 집중 요일 */
  const bestDayIndex = hours.indexOf(maxHours);
  /** 막대 강조는 오늘 요일에 준다 */
  const todayIndex = getTodayIndex();

  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-bold">이번 주 집중</h3>
        <span className="text-xs text-muted-foreground">{getWeekLabel()}</span>
      </div>

      {/* 그래프: 왼쪽 y축(시간) + 요일별 막대 */}
      <div className="mt-4 flex gap-2">
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
            {hours.map((value, index) => {
              const isToday = index === todayIndex;
              const barHeight = (Math.min(value, MAX_HOURS) / MAX_HOURS) * CHART_HEIGHT;

              return (
                <div key={WEEKDAYS[index]} className="flex flex-1 flex-col items-center gap-1">
                  <div className="flex w-full items-end" style={{ height: CHART_HEIGHT }}>
                    <div
                      className={cn(
                        'w-full rounded-t-md',
                        isToday ? 'bg-primary' : 'bg-primary/25',
                        value === 0 && 'bg-transparent',
                      )}
                      style={{ height: barHeight }}
                    />
                  </div>
                  <span
                    className={cn(
                      'text-xs',
                      isToday ? 'font-bold text-primary' : 'text-muted-foreground',
                    )}
                  >
                    {WEEKDAYS[index]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <hr className="my-4 border-border" />

      <div className="grid grid-cols-3 text-center">
        <div>
          <p className="text-base font-bold">{formatHours(total)}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">이번 주 총합</p>
        </div>
        <div>
          <p className="text-base font-bold text-[#1E9E5A]">
            {DIFF_FROM_LAST_WEEK >= 0 ? '+' : ''}
            {formatHours(DIFF_FROM_LAST_WEEK)}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">지난 주 대비</p>
        </div>
        <div>
          <p className="text-base font-bold">{WEEKDAYS[bestDayIndex]}요일</p>
          <p className="mt-0.5 text-xs text-muted-foreground">최고 집중 요일</p>
        </div>
      </div>
    </div>
  );
}
