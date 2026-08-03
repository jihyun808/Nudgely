// pages/focus/components/FocusModeHint.tsx
import {
  POMODORO_BREAK_MINUTES,
  POMODORO_FOCUS_MINUTES,
  POMODORO_LONG_BREAK_EVERY,
  POMODORO_LONG_BREAK_MINUTES,
  type FocusMode,
} from '@/types/focus';

interface FocusModeHintProps {
  mode: FocusMode;
}

/** 화면 아래에서 지금 방식이 어떻게 동작하는지 한 줄로 알려준다 */
export default function FocusModeHint({ mode }: FocusModeHintProps) {
  return (
    <p className="text-center text-xs text-muted-foreground">
      {mode === 'stopwatch'
        ? '한 바퀴는 1시간이에요. 종료하면 집중 시간이 기록돼요.'
        : `집중 ${POMODORO_FOCUS_MINUTES}분 → 휴식 ${POMODORO_BREAK_MINUTES}분을 반복하고, ${POMODORO_LONG_BREAK_EVERY}번째마다 ${POMODORO_LONG_BREAK_MINUTES}분 길게 쉬어요.`}
    </p>
  );
}
