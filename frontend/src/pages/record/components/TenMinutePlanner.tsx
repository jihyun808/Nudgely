// pages/record/components/TenMinutePlanner.tsx
import { useEffect, useMemo, useState } from 'react';
import { fetchDailyPlanner } from '@/api/record';
import { Button } from '@/components/ui/button';
import PlannerSummary from '@/pages/record/components/PlannerSummary';
import PlannerTimeline from '@/pages/record/components/PlannerTimeline';
import { summarizePlanner } from '@/pages/record/plannerSummary';
import type { DailyPlanner } from '@/types/planner';
import { formatDateKey } from '@/utils/date';

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'] as const;

/** 'M월 D일 요일' */
function formatPlannerDate(date: Date) {
  return `${date.getMonth() + 1}월 ${date.getDate()}일 ${WEEKDAY_LABELS[date.getDay()]}요일`;
}

/**
 * 텐미닛 플래너.
 * 날짜를 좌우로 넘겨 지난 기록도 볼 수 있고, 표와 요약은 그 날짜 데이터로 다시 그려진다.
 * 계획은 AI가 정해 고정이며, 실제 기록은 추후 수정 가능하게 열어둘 예정이다.
 */
export default function TenMinutePlanner() {
  const [date, setDate] = useState(() => new Date());
  /** 날짜가 미래로 이동했는지 (전환 애니메이션 방향) */
  const [isMovingForward, setIsMovingForward] = useState(true);
  const [planner, setPlanner] = useState<DailyPlanner>();
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const dateKey = useMemo(() => formatDateKey(date), [date]);
  // 아직 오지 않은 날은 볼 수 없다 (오늘이 마지막)
  const isToday = dateKey === formatDateKey(new Date());

  useEffect(() => {
    let isStale = false;
    fetchDailyPlanner(dateKey)
      .then((data) => {
        if (isStale) return;
        setPlanner(data);
        setHasError(false);
      })
      .catch(() => {
        if (!isStale) setHasError(true);
      })
      .finally(() => {
        if (!isStale) setIsLoading(false);
      });
    return () => {
      isStale = true;
    };
  }, [dateKey, reloadKey]);

  const moveDate = (offset: number) => {
    setIsMovingForward(offset > 0);
    setIsLoading(true);
    setDate((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + offset);
      return next;
    });
  };

  const summary = planner ? summarizePlanner(planner) : undefined;

  return (
    <div>
      {/* 날짜 이동 */}
      <div className="mt-5 flex items-center justify-between">
        <button
          type="button"
          onClick={() => moveDate(-1)}
          aria-label="이전 날"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-muted-foreground/8 text-muted-foreground transition-colors active:bg-muted-foreground/15"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>

        <h2 aria-live="polite" className="text-lg font-bold">
          {formatPlannerDate(date)}
        </h2>

        <button
          type="button"
          onClick={() => moveDate(1)}
          disabled={isToday}
          aria-label="다음 날"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-muted-foreground/8 text-muted-foreground transition-colors active:bg-muted-foreground/15 disabled:opacity-30"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
          >
            <path d="m9 6 6 6-6 6" />
          </svg>
        </button>
      </div>

      {/* key를 바꿔 날짜가 넘어갈 때마다 진입 애니메이션이 실행되게 한다 */}
      <div key={dateKey} className={isMovingForward ? 'panel-enter-right' : 'panel-enter-left'}>
        {isLoading ? (
          <div className="mt-5 h-64 animate-pulse rounded-2xl bg-muted-foreground/8" />
        ) : hasError || !planner || !summary ? (
          <div className="mt-20 flex flex-col items-center gap-3">
            <p className="text-sm text-muted-foreground">플래너를 불러오지 못했어요</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsLoading(true);
                setHasError(false);
                setReloadKey((key) => key + 1);
              }}
            >
              다시 시도
            </Button>
          </div>
        ) : (
          <>
            <div className="mt-4">
              <PlannerTimeline planned={planner.planned} actual={planner.actual} />
            </div>
            <div className="mt-5">
              <PlannerSummary {...summary} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
