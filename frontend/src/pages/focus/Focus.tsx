// pages/focus/Focus.tsx
import { useEffect, useState } from 'react';
import { fetchFocusSummary, saveFocusSession } from '@/api/focus';
import { fetchDailyPlanner } from '@/api/record';
import PageHeader from '@/components/PageHeader';
import SegmentedTabs from '@/components/SegmentedTabs';
import { Button } from '@/components/ui/button';
import CelebrationOverlay from '@/pages/focus/components/CelebrationOverlay';
import FocusDial from '@/pages/focus/components/FocusDial';
import FocusStats from '@/pages/focus/components/FocusStats';
import { getElapsedMs, useFocusStore } from '@/stores/focusStore';
import { showToast } from '@/stores/toastStore';
import {
  POMODORO_BREAK_MINUTES,
  POMODORO_FOCUS_MINUTES,
  POMODORO_LONG_BREAK_EVERY,
  POMODORO_LONG_BREAK_MINUTES,
  STOPWATCH_ROUND_MINUTES,
  type FocusMode,
} from '@/types/focus';
import { formatDateKey } from '@/utils/date';
import { requestNotificationPermission, showNotification } from '@/utils/notify';
import { playBeep } from '@/utils/sound';
import { formatClock } from '@/utils/time';

const MODE_TABS: { value: FocusMode; label: string }[] = [
  { value: 'stopwatch', label: '스톱워치' },
  { value: 'pomodoro', label: '뽀모도로' },
];

/** 화면 갱신 주기(ms). 초 단위 표시라 250ms면 충분하다 */
const TICK_MS = 250;

/**
 * 집중 탭.
 * 위에서부터 오늘 집중 요약 / 방식 토글 / 원형 타이머 / 조작 버튼.
 *
 * - 스톱워치: 한 바퀴 60분, 계속 누적된다
 * - 뽀모도로: 집중 25분 → 휴식 5분을 반복하고, 전환할 때마다 알림음이 울린다
 * - 오늘 목표(플래너 계획 시간 합계)를 넘기면 컨페티와 축하 메시지를 띄운다
 */
export default function Focus() {
  const {
    mode,
    phase,
    isRunning,
    completedCycles,
    todayFocusedSeconds,
    hasCelebrated,
    isCelebrating,
    setMode,
    start,
    pause,
    reset,
    switchPhase,
    setTodayFocusedSeconds,
    addTodayFocusedSeconds,
    celebrate,
    dismissCelebration,
  } = useFocusStore();

  const [targetMinutes, setTargetMinutes] = useState(0);
  /** 지금 시각에 걸쳐 있는 플래너 계획 (없으면 undefined) */
  const [currentPlan, setCurrentPlan] = useState<string>();
  /** 화면을 다시 그리기 위한 현재 시각 */
  const [now, setNow] = useState(() => Date.now());

  // 오늘 집중 요약 조회 (목표 시간 = 텐미닛 플래너 계획 시간 합계)
  useEffect(() => {
    let isStale = false;
    fetchFocusSummary()
      .then(({ focusedSeconds, targetMinutes: target }) => {
        if (isStale) return;
        setTodayFocusedSeconds(focusedSeconds);
        setTargetMinutes(target);
      })
      .catch(() => {
        // 요약을 못 받아도 타이머는 쓸 수 있다
      });
    return () => {
      isStale = true;
    };
  }, [setTodayFocusedSeconds]);

  // 지금 시간대에 잡힌 계획이 있으면 타이머 위에 안내한다
  useEffect(() => {
    let isStale = false;
    fetchDailyPlanner(formatDateKey(new Date()))
      .then((planner) => {
        if (isStale) return;
        const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
        const plan = planner.planned.find(
          ({ startMinutes, durationMinutes }) =>
            nowMinutes >= startMinutes && nowMinutes < startMinutes + durationMinutes,
        );
        setCurrentPlan(plan?.title);
      })
      .catch(() => {
        // 계획을 못 받아도 타이머는 쓸 수 있다
      });
    return () => {
      isStale = true;
    };
  }, []);

  // 돌아가는 동안 화면 갱신
  useEffect(() => {
    if (!isRunning) return;
    const timer = window.setInterval(() => setNow(Date.now()), TICK_MS);
    return () => window.clearInterval(timer);
  }, [isRunning]);

  const elapsedSeconds = Math.floor(getElapsedMs(useFocusStore.getState(), now) / 1000);
  const isBreak = mode === 'pomodoro' && phase === 'break';
  /** 집중 4번마다 긴 휴식(15분)을 준다 */
  const isLongBreak =
    isBreak && completedCycles > 0 && completedCycles % POMODORO_LONG_BREAK_EVERY === 0;
  const breakMinutes = isLongBreak ? POMODORO_LONG_BREAK_MINUTES : POMODORO_BREAK_MINUTES;
  const phaseMinutes = isBreak ? breakMinutes : POMODORO_FOCUS_MINUTES;
  /** 뽀모도로는 남은 시간을, 스톱워치는 흐른 시간을 보여준다 */
  const displaySeconds =
    mode === 'pomodoro' ? Math.max(phaseMinutes * 60 - elapsedSeconds, 0) : elapsedSeconds;

  // 뽀모도로 단계가 끝나면 알림음을 내고 다음 단계로 넘긴다
  useEffect(() => {
    if (mode !== 'pomodoro' || !isRunning) return;
    if (elapsedSeconds < phaseMinutes * 60) return;

    playBeep();

    if (isBreak) {
      // 휴식이 끝났다 → 다시 집중
      showToast('휴식 끝! 다시 집중해볼까요?', { variant: 'info' });
      showNotification('휴식 끝', '다시 집중할 시간이에요.');
    } else {
      // 집중 단계를 마쳤으면 그만큼 오늘 집중 시간에 더하고 서버에 남긴다
      const seconds = POMODORO_FOCUS_MINUTES * 60;
      addTodayFocusedSeconds(seconds);
      void saveFocusSession({
        mode: 'pomodoro',
        seconds,
        startedAt: new Date(Date.now() - seconds * 1000).toISOString(),
      }).catch(() => {});

      const nextBreakMinutes =
        (completedCycles + 1) % POMODORO_LONG_BREAK_EVERY === 0
          ? POMODORO_LONG_BREAK_MINUTES
          : POMODORO_BREAK_MINUTES;
      showToast(`${POMODORO_FOCUS_MINUTES}분 집중 완료! ${nextBreakMinutes}분 쉬어요`, {
        variant: 'success',
      });
      showNotification(
        `${POMODORO_FOCUS_MINUTES}분 집중 완료`,
        `${nextBreakMinutes}분 쉬었다가 이어서 해요.`,
      );
    }

    switchPhase();
  }, [
    mode,
    isRunning,
    elapsedSeconds,
    phaseMinutes,
    isBreak,
    completedCycles,
    switchPhase,
    addTodayFocusedSeconds,
  ]);

  // 오늘 목표를 넘기면 한 번만 축하한다
  useEffect(() => {
    if (hasCelebrated || targetMinutes <= 0) return;
    const liveSeconds = todayFocusedSeconds + (mode === 'stopwatch' ? elapsedSeconds : 0);
    if (liveSeconds < targetMinutes * 60) return;

    celebrate();
    playBeep(3);
    showNotification('오늘의 집중 시간 달성!', '목표한 시간을 모두 채웠어요. 정말 잘했어요!');
  }, [hasCelebrated, targetMinutes, todayFocusedSeconds, elapsedSeconds, mode, celebrate]);

  /** 타이머를 시작한다. 처음 시작할 때 알림 권한을 물어본다 */
  const handleStart = () => {
    void requestNotificationPermission();
    start();
  };

  /** 스톱워치를 멈추고 기록으로 남긴다 */
  const handleFinish = () => {
    if (elapsedSeconds > 0 && mode === 'stopwatch') {
      addTodayFocusedSeconds(elapsedSeconds);
      void saveFocusSession({
        mode: 'stopwatch',
        seconds: elapsedSeconds,
        startedAt: new Date(Date.now() - elapsedSeconds * 1000).toISOString(),
      }).catch(() => {});
    }
    reset();
  };

  // 다른 탭에 있어도 브라우저 탭 제목으로 진행 상황이 보이게 한다
  useEffect(() => {
    if (!isRunning) {
      document.title = 'nudgely';
      return;
    }
    const label = mode === 'pomodoro' ? (isBreak ? '휴식' : '집중') : '집중';
    document.title = `${formatClock(displaySeconds)} ${label} · nudgely`;
    return () => {
      document.title = 'nudgely';
    };
  }, [isRunning, displaySeconds, mode, isBreak]);

  const dialVariant = mode === 'stopwatch' ? 'primary' : isBreak ? 'break' : 'focus';
  const caption =
    mode === 'stopwatch'
      ? isRunning
        ? '집중하는 중'
        : elapsedSeconds > 0
          ? '잠시 멈춤'
          : '시작해볼까요?'
      : isBreak
        ? isLongBreak
          ? `긴 휴식 ${POMODORO_LONG_BREAK_MINUTES}분`
          : '쉬는 시간'
        : `${completedCycles + 1}번째 뽀모도로`;

  return (
    <div>
      <PageHeader title="집중" />

      <div className="mt-4">
        <FocusStats focusedSeconds={todayFocusedSeconds} targetMinutes={targetMinutes} />
      </div>

      <SegmentedTabs items={MODE_TABS} value={mode} onChange={setMode} className="mt-4" />

      {currentPlan && (
        <p className="mt-6 text-center text-sm text-muted-foreground">
          지금은 <span className="font-semibold text-foreground">{currentPlan}</span> 집중하는
          시간이에요
        </p>
      )}

      <div className={currentPlan ? 'mt-3' : 'mt-8'}>
        <FocusDial
          roundMinutes={mode === 'stopwatch' ? STOPWATCH_ROUND_MINUTES : phaseMinutes}
          elapsedSeconds={elapsedSeconds}
          centerLabel={formatClock(displaySeconds)}
          caption={caption}
          variant={dialVariant}
          labelStep={mode === 'stopwatch' ? 5 : 5}
        />
      </div>

      {/* 조작 */}
      <div className="mt-8 flex gap-2">
        {isRunning ? (
          <Button variant="outline" size="lg" className="flex-1 rounded-2xl" onClick={pause}>
            일시정지
          </Button>
        ) : (
          <Button size="lg" className="flex-1 rounded-2xl" onClick={handleStart}>
            {elapsedSeconds > 0 ? '이어서 하기' : '집중 시작하기'}
          </Button>
        )}

        {elapsedSeconds > 0 && (
          <Button variant="outline" size="lg" className="flex-1 rounded-2xl" onClick={handleFinish}>
            종료
          </Button>
        )}
      </div>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        {mode === 'stopwatch'
          ? '한 바퀴는 1시간이에요. 종료하면 집중 시간이 기록돼요.'
          : `집중 ${POMODORO_FOCUS_MINUTES}분 → 휴식 ${POMODORO_BREAK_MINUTES}분을 반복하고, ${POMODORO_LONG_BREAK_EVERY}번째마다 ${POMODORO_LONG_BREAK_MINUTES}분 길게 쉬어요.`}
      </p>

      {isCelebrating && <CelebrationOverlay onClose={dismissCelebration} />}
    </div>
  );
}
