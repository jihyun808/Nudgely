// stores/focusStore.ts
import { create } from 'zustand';
import type { FocusMode, PomodoroPhase } from '@/types/focus';

interface FocusState {
  mode: FocusMode;
  /** 뽀모도로 단계 (스톱워치에서는 쓰지 않는다) */
  phase: PomodoroPhase;
  isRunning: boolean;
  /** 현재 구간을 시작한 시각(ms). 멈춰 있으면 null */
  startedAt: number | null;
  /** 일시정지까지 쌓인 시간(ms) */
  accumulatedMs: number;
  /** 이번 세션에서 끝낸 뽀모도로 횟수 */
  completedCycles: number;
  /** 서버에서 받아온 오늘 집중 시간(초). 세션이 끝나면 더해준다 */
  todayFocusedSeconds: number;
  /** 오늘 목표 달성 축하를 이미 보여줬는지 */
  hasCelebrated: boolean;
  /** 축하 화면이 떠 있는지 */
  isCelebrating: boolean;

  setMode: (mode: FocusMode) => void;
  start: () => void;
  pause: () => void;
  /** 타이머를 처음 상태로 되돌린다 */
  reset: () => void;
  /** 뽀모도로 단계 전환 (집중 ↔ 휴식) */
  switchPhase: () => void;
  setTodayFocusedSeconds: (seconds: number) => void;
  addTodayFocusedSeconds: (seconds: number) => void;
  /** 목표 달성: 축하 화면을 띄우고 다시 뜨지 않도록 표시한다 */
  celebrate: () => void;
  dismissCelebration: () => void;
}

/** 실행 중이면 지금까지 흐른 시간(ms) */
export function getElapsedMs(
  state: Pick<FocusState, 'isRunning' | 'startedAt' | 'accumulatedMs'>,
  now: number = Date.now(),
) {
  // 시작 시각을 기준으로 계산하므로 화면을 떠났다 와도 시간이 어긋나지 않는다
  return state.accumulatedMs + (state.isRunning && state.startedAt ? now - state.startedAt : 0);
}

export const useFocusStore = create<FocusState>((set, get) => ({
  mode: 'stopwatch',
  phase: 'focus',
  isRunning: false,
  startedAt: null,
  accumulatedMs: 0,
  completedCycles: 0,
  todayFocusedSeconds: 0,
  hasCelebrated: false,
  isCelebrating: false,

  // 방식을 바꾸면 진행 중이던 타이머는 초기화한다
  setMode: (mode) =>
    set({ mode, phase: 'focus', isRunning: false, startedAt: null, accumulatedMs: 0 }),

  start: () => set({ isRunning: true, startedAt: Date.now() }),

  pause: () => set({ isRunning: false, startedAt: null, accumulatedMs: getElapsedMs(get()) }),

  reset: () =>
    set({
      isRunning: false,
      startedAt: null,
      accumulatedMs: 0,
      phase: 'focus',
      completedCycles: 0,
    }),

  switchPhase: () =>
    set((state) => ({
      phase: state.phase === 'focus' ? 'break' : 'focus',
      completedCycles: state.phase === 'focus' ? state.completedCycles + 1 : state.completedCycles,
      // 다음 단계는 처음부터 다시 센다
      accumulatedMs: 0,
      startedAt: Date.now(),
      isRunning: true,
    })),

  setTodayFocusedSeconds: (seconds) => set({ todayFocusedSeconds: seconds }),

  addTodayFocusedSeconds: (seconds) =>
    set((state) => ({ todayFocusedSeconds: state.todayFocusedSeconds + seconds })),

  celebrate: () => set({ hasCelebrated: true, isCelebrating: true }),

  dismissCelebration: () => set({ isCelebrating: false }),
}));
