// pages/record/components/TenMinutePlanner.tsx
import { useEffect, useMemo, useState } from 'react';
import {
  addPlannerActual,
  deletePlannerActual,
  fetchDailyPlanner,
  updatePlannerActual,
} from '@/api/record';
import { fetchSettings } from '@/api/settings';
import Skeleton from '@/components/Skeleton';
import StepperButton from '@/components/StepperButton';
import { Button } from '@/components/ui/button';
import PlannerBlockDialog from '@/pages/record/components/PlannerBlockDialog';
import PlannerSummary from '@/pages/record/components/PlannerSummary';
import PlannerTimeline from '@/pages/record/components/PlannerTimeline';
import { summarizePlanner } from '@/pages/record/plannerSummary';
import { showToast } from '@/stores/toastStore';
import {
  PLANNER_BLOCK_MINUTES,
  type DailyPlanner,
  type PlannerBlock,
  type PlannerBlockInput,
} from '@/types/planner';
import type { PlannerSettings } from '@/types/settings';
import { formatDateKey } from '@/utils/date';

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'] as const;

/** 'M월 D일 요일' */
function formatPlannerDate(date: Date) {
  return `${date.getMonth() + 1}월 ${date.getDate()}일 ${WEEKDAY_LABELS[date.getDay()]}요일`;
}

/** 열려 있는 실제 기록 팝업. block이 없으면 추가 모드 */
interface PlannerDialogState {
  block?: PlannerBlock;
  /** 추가 모드에서 미리 채울 시작 시각(분) */
  startMinutes: number;
}

/**
 * 텐미닛 플래너.
 * 날짜를 좌우로 넘겨 지난 기록도 볼 수 있고, 표와 요약은 그 날짜 데이터로 다시 그려진다.
 * 계획은 AI가 정해 고정이고, 실제 기록은 사용자가 추가·수정·삭제할 수 있다.
 */
export default function TenMinutePlanner() {
  const [date, setDate] = useState(() => new Date());
  /** 날짜가 미래로 이동했는지 (전환 애니메이션 방향) */
  const [isMovingForward, setIsMovingForward] = useState(true);
  const [planner, setPlanner] = useState<DailyPlanner>();
  /** 표에 그릴 시간 범위. 설정 화면에서 정한다 */
  const [plannerRange, setPlannerRange] = useState<PlannerSettings>({ startHour: 6, endHour: 24 });
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [dialog, setDialog] = useState<PlannerDialogState>();

  const dateKey = useMemo(() => formatDateKey(date), [date]);
  // 아직 오지 않은 날은 볼 수 없다 (오늘이 마지막)
  const isToday = dateKey === formatDateKey(new Date());

  useEffect(() => {
    let isStale = false;
    Promise.all([fetchDailyPlanner(dateKey), fetchSettings()])
      .then(([plannerData, settings]) => {
        if (isStale) return;
        setPlanner(plannerData);
        setPlannerRange(settings.planner);
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
  /** 지금 시각(자정 기준 분). 아직 오지 않은 시간에는 기록을 남길 수 없다 */
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();

  const handleSubmitBlock = async (input: PlannerBlockInput) => {
    const block = dialog?.block;
    const next = block
      ? await updatePlannerActual(dateKey, block.id, input)
      : await addPlannerActual(dateKey, input);
    setPlanner(next);
    showToast(block ? '기록을 수정했어요' : '기록을 추가했어요', { variant: 'success' });
  };

  const handleDeleteBlock = async () => {
    const block = dialog?.block;
    if (!block) return;
    setPlanner(await deletePlannerActual(dateKey, block.id));
    showToast('기록을 삭제했어요');
  };

  return (
    <div>
      {/* 날짜 이동 */}
      <div className="mt-5 flex items-center justify-between">
        <StepperButton direction="prev" label="이전 날" onClick={() => moveDate(-1)} />

        <h2 aria-live="polite" className="text-lg font-bold">
          {formatPlannerDate(date)}
        </h2>

        <StepperButton
          direction="next"
          label="다음 날"
          disabled={isToday}
          onClick={() => moveDate(1)}
        />
      </div>

      {/* key를 바꿔 날짜가 넘어갈 때마다 진입 애니메이션이 실행되게 한다 */}
      <div key={dateKey} className={isMovingForward ? 'panel-enter-right' : 'panel-enter-left'}>
        {isLoading ? (
          <Skeleton className="mt-5 h-64" />
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
              <PlannerTimeline
                planned={planner.planned}
                actual={planner.actual}
                startHour={plannerRange.startHour}
                endHour={plannerRange.endHour}
                isEditable={isToday}
                maxStartMinutes={nowMinutes}
                onSelectActual={(block) => setDialog({ block, startMinutes: block.startMinutes })}
                onAddActual={(startMinutes) => setDialog({ startMinutes })}
              />
            </div>
            <div className="mt-5">
              <PlannerSummary {...summary} />
            </div>
          </>
        )}
      </div>

      {dialog && (
        <PlannerBlockDialog
          block={dialog.block}
          defaultStartMinutes={dialog.startMinutes}
          startHour={plannerRange.startHour}
          endHour={plannerRange.endHour}
          // 10분 단위로 끊어 '지금'까지만 고르게 한다
          maxMinutes={Math.floor(nowMinutes / PLANNER_BLOCK_MINUTES) * PLANNER_BLOCK_MINUTES}
          onSubmit={handleSubmitBlock}
          onDelete={dialog.block ? handleDeleteBlock : undefined}
          onClose={() => setDialog(undefined)}
        />
      )}
    </div>
  );
}
