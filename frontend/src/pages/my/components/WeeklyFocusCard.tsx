// pages/my/components/WeeklyFocusCard.tsx
import { useEffect, useState } from 'react';
import { fetchWeeklyFocus } from '@/api/focus';
import { cn } from '@/lib/utils';
import StepperButton from '@/components/StepperButton';
import WeeklyFocusChart from '@/pages/my/components/WeeklyFocusChart';

const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'] as const;
const DAY = 24 * 60 * 60 * 1000;

/** 월요일을 0으로 두는 오늘의 요일 인덱스 */
const getTodayIndex = (now = new Date()) => (now.getDay() + 6) % 7;

/** weekOffset 주의 월요일 날짜 */
function getWeekStart(weekOffset: number) {
  const today = new Date();
  const monday = new Date(today.getTime() - getTodayIndex(today) * DAY);
  monday.setHours(0, 0, 0, 0);
  return new Date(monday.getTime() + weekOffset * 7 * DAY);
}

/** 'M월 N주차' (1일이 속한 주를 1주차로 센다) */
function getWeekLabel(weekStart: Date) {
  const firstDay = new Date(weekStart.getFullYear(), weekStart.getMonth(), 1);
  const weekIndex = Math.ceil((weekStart.getDate() + firstDay.getDay()) / 7);
  return `${weekStart.getMonth() + 1}월 ${weekIndex}주차`;
}

/** 1.5 → '1.5h', 2 → '2h' */
const formatHours = (hours: number) => `${Number(hours.toFixed(1))}h`;

/**
 * 주간 집중 카드.
 * 좌우 버튼으로 지난 주를 볼 수 있고, 이번 주보다 미래로는 갈 수 없다.
 *
 * 값은 아직 실제 집중 기록이 아니다(mock).
 * TODO: 집중 탭 기록이 쌓이면 실제 주간 집계로 교체
 */
export default function WeeklyFocusCard() {
  /** 0이면 이번 주, -1이면 지난 주 */
  const [weekOffset, setWeekOffset] = useState(0);
  /** 과거로 이동했는지 (전환 애니메이션 방향) */
  const [isMovingBack, setIsMovingBack] = useState(true);
  const [hours, setHours] = useState<number[]>([]);
  const [diffFromLastWeek, setDiffFromLastWeek] = useState(0);

  useEffect(() => {
    let isStale = false;
    fetchWeeklyFocus(weekOffset)
      .then((data) => {
        if (isStale) return;
        setHours(data.hours);
        setDiffFromLastWeek(data.diffFromLastWeek);
      })
      .catch(() => {
        // 못 받아도 카드 틀은 그대로 둔다
      });
    return () => {
      isStale = true;
    };
  }, [weekOffset]);

  const moveWeek = (offset: number) => {
    setIsMovingBack(offset < 0);
    setWeekOffset((prev) => Math.min(prev + offset, 0));
  };

  const isThisWeek = weekOffset === 0;
  const total = hours.reduce((sum, value) => sum + value, 0);
  const maxHours = hours.length > 0 ? Math.max(...hours) : 0;
  const bestDayIndex = hours.indexOf(maxHours);

  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold">{isThisWeek ? '이번 주 집중' : '주간 집중'}</h3>
        <div className="flex items-center gap-1">
          <StepperButton
            direction="prev"
            label="이전 주"
            className="h-7 w-7 bg-transparent"
            onClick={() => moveWeek(-1)}
          />
          <span aria-live="polite" className="text-xs text-muted-foreground">
            {getWeekLabel(getWeekStart(weekOffset))}
          </span>
          <StepperButton
            direction="next"
            label="다음 주"
            disabled={isThisWeek}
            className="h-7 w-7 bg-transparent"
            onClick={() => moveWeek(1)}
          />
        </div>
      </div>

      {/* key를 바꿔 주가 넘어갈 때마다 진입 애니메이션이 실행되게 한다 */}
      <div key={weekOffset} className={isMovingBack ? 'panel-enter-left' : 'panel-enter-right'}>
        <div className="mt-4">
          {/* 강조는 이번 주에만, 오늘 요일에 준다 */}
          <WeeklyFocusChart
            hours={hours}
            highlightIndex={isThisWeek ? getTodayIndex() : undefined}
          />
        </div>

        <hr className="my-4 border-border" />

        <div className="grid grid-cols-3 text-center">
          <div>
            <p className="text-base font-bold">{formatHours(total)}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {isThisWeek ? '이번 주 총합' : '주 총합'}
            </p>
          </div>
          <div>
            <p
              className={cn(
                'text-base font-bold',
                diffFromLastWeek >= 0 ? 'text-[#1E9E5A]' : 'text-[#D9622B]',
              )}
            >
              {diffFromLastWeek >= 0 ? '+' : ''}
              {formatHours(diffFromLastWeek)}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">지난 주 대비</p>
          </div>
          <div>
            <p className="text-base font-bold">
              {maxHours > 0 ? `${WEEKDAYS[bestDayIndex]}요일` : '-'}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">최고 집중 요일</p>
          </div>
        </div>
      </div>
    </div>
  );
}
