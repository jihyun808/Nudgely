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
} from '@/types/focus';
import { requestNotificationPermission, showNotification } from '@/utils/notify';
import { playBeep } from '@/utils/sound';
import { formatClock } from '@/utils/time';

/** 화면 갱신 주기(ms). 초 단위 표시라 250ms면 충분하다 */
const TICK_MS = 250;

/**
 * 집중 타이머의 모든 동작을 모아둔 훅.
 * 시간 계산, 뽀모도로 단계 전환, 세션 저장, 목표 달성 축하, 탭 제목 갱신을 담당한다.
 * 화면(Focus.tsx)은 여기서 나온 값을 그리기만 한다.
 */
export function useFocusTimer() {
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
    const timer = window.setInterval(() => setNow(Date.now()), TICK_MS);
    return () => window.clearInterval(timer);
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
    mode,
    setMode,
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
