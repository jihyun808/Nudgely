// pages/focus/useFocusTimer.ts
import { useEffect, useState } from 'react';
import { fetchFocusSummary, saveFocusSession } from '@/api/focus';
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
import { requestNotificationPermission, showNotification } from '@/utils/notify';
import { playBeep } from '@/utils/sound';
import { formatClock } from '@/utils/time';

/** 화면 갱신 주기(ms). 초 단위 표시라 250ms면 충분하다 */
const TICK_MS = 250;

/** 마지막에 고른 집중 목표를 기억해 둘 키. 보통 같은 목표를 이어서 하기 때문 */
const GOAL_STORAGE_KEY = 'nudgely.focus.goalId';

function readStoredGoalId(): string | undefined {
  try {
    return localStorage.getItem(GOAL_STORAGE_KEY) ?? undefined;
  } catch {
    // 사파리 비공개 모드 등 저장소를 막아둔 환경
    return undefined;
  }
}

function storeGoalId(goalId: string | undefined): void {
  try {
    if (goalId) localStorage.setItem(GOAL_STORAGE_KEY, goalId);
    else localStorage.removeItem(GOAL_STORAGE_KEY);
  } catch {
    // 못 적어도 이번 세션 동안은 상태로 유지된다
  }
}

/**
 * 집중 타이머의 모든 동작을 모아둔 훅.
 * 시간 계산, 뽀모도로 단계 전환, 세션 저장, 목표 달성 축하, 탭 제목 갱신을 담당한다.
 * 화면(Focus.tsx)은 여기서 나온 값을 그리기만 한다.
 */
export function useFocusTimer() {
  /** 집중 세션에 붙일 목표. 안 고르면 오늘 집중 시간에만 들어간다 */
  const [goalId, setGoalId] = useState<string | undefined>(readStoredGoalId);

  const selectGoal = (next: string | undefined) => {
    setGoalId(next);
    storeGoalId(next);
  };

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

  /** 오늘 목표 시간(분). 텐미닛 플래너의 계획 시간 합계 */
  const [targetMinutes, setTargetMinutes] = useState(0);
  /** 화면을 다시 그리기 위한 현재 시각 */
  const [now, setNow] = useState(() => Date.now());

  // 오늘 집중 요약 조회
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

  // 돌아가는 동안 화면 갱신
  useEffect(() => {
    if (!isRunning) return;
    // 시작 직후 한 번 바로 맞춰 첫 프레임이 밀리지 않게 한다
    const frame = requestAnimationFrame(() => setNow(Date.now()));
    const timer = window.setInterval(() => setNow(Date.now()), TICK_MS);
    return () => {
      cancelAnimationFrame(frame);
      window.clearInterval(timer);
    };
  }, [isRunning]);

  const elapsedSeconds = Math.floor(getElapsedMs(useFocusStore.getState(), now) / 1000);
  const isBreak = mode === 'pomodoro' && phase === 'break';
  /** 집중 4번마다 긴 휴식(15분)을 준다 */
  const isLongBreak =
    isBreak && completedCycles > 0 && completedCycles % POMODORO_LONG_BREAK_EVERY === 0;
  const phaseMinutes = isBreak
    ? isLongBreak
      ? POMODORO_LONG_BREAK_MINUTES
      : POMODORO_BREAK_MINUTES
    : POMODORO_FOCUS_MINUTES;
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
        goalId,
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
    goalId,
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

  /** 타이머를 시작한다. 처음 시작할 때 알림 권한을 물어본다 */
  const handleStart = () => {
    void requestNotificationPermission();
    start();
  };

  /**
   * 아직 저장되지 않은 집중 시간을 기록으로 남긴다.
   *
   * 뽀모도로는 25분을 채울 때마다 저장되는데, 그 전에 끝내면 남은 시간이
   * reset() 으로 그냥 사라졌다. 20분 집중하고 끝내면 20분이 통째로 날아갔다.
   * 휴식 중에는 남길 집중이 없으므로 건너뛴다.
   */
  const flushElapsed = () => {
    if (elapsedSeconds <= 0 || isBreak) return;
    addTodayFocusedSeconds(elapsedSeconds);
    void saveFocusSession({
      mode,
      seconds: elapsedSeconds,
      startedAt: new Date(Date.now() - elapsedSeconds * 1000).toISOString(),
      goalId,
    }).catch(() => {});
  };

  /** 타이머를 멈추고 기록으로 남긴다 */
  const handleFinish = () => {
    flushElapsed();
    reset();
  };

  /** 방식을 바꾸면 타이머가 초기화되므로, 흐른 시간을 먼저 남긴다 */
  const handleModeChange = (next: FocusMode) => {
    if (next === mode) return;
    flushElapsed();
    setMode(next);
  };

  /** 다이얼 아래 문구 */
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

  return {
    goalId,
    selectGoal,
    mode,
    setMode: handleModeChange,
    isRunning,
    elapsedSeconds,
    displaySeconds,
    /** 다이얼 한 바퀴에 해당하는 시간(분) */
    roundMinutes: mode === 'stopwatch' ? STOPWATCH_ROUND_MINUTES : phaseMinutes,
    /** 다이얼 색: 스톱워치는 브랜드 색, 뽀모도로는 집중 빨강 / 휴식 초록 */
    dialVariant: mode === 'stopwatch' ? 'primary' : isBreak ? 'break' : 'focus',
    caption,
    todayFocusedSeconds,
    targetMinutes,
    isCelebrating,
    dismissCelebration,
    onStart: handleStart,
    onPause: pause,
    onFinish: handleFinish,
  } as const;
}
