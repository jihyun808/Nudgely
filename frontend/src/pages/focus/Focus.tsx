// pages/focus/Focus.tsx
import PageHeader from '@/components/PageHeader';
import SegmentedTabs from '@/components/SegmentedTabs';
import CelebrationOverlay from '@/pages/focus/components/CelebrationOverlay';
import CurrentPlanNotice from '@/pages/focus/components/CurrentPlanNotice';
import FocusControls from '@/pages/focus/components/FocusControls';
import FocusDial from '@/pages/focus/components/FocusDial';
import FocusModeHint from '@/pages/focus/components/FocusModeHint';
import FocusStats from '@/pages/focus/components/FocusStats';
import { useCurrentPlan } from '@/pages/focus/useCurrentPlan';
import { useFocusTimer } from '@/pages/focus/useFocusTimer';
import type { FocusMode } from '@/types/focus';
import { formatClock } from '@/utils/time';

const MODE_TABS: { value: FocusMode; label: string }[] = [
  { value: 'stopwatch', label: '스톱워치' },
  { value: 'pomodoro', label: '뽀모도로' },
];

/** 다이얼 숫자 라벨 간격(분) */
const DIAL_LABEL_STEP = 5;

/**
 * 집중 탭.
 * 위에서부터 오늘 집중 요약 / 방식 토글 / 지금 계획 / 원형 타이머 / 조작 버튼.
 * 타이머 동작은 useFocusTimer가, 화면은 이 파일이 담당한다.
 */
export default function Focus() {
  const timer = useFocusTimer();
  const currentPlan = useCurrentPlan();

  return (
    <div>
      <PageHeader title="집중" />

      <div className="mt-4">
        <FocusStats
          focusedSeconds={timer.todayFocusedSeconds}
          targetMinutes={timer.targetMinutes}
        />
      </div>

      <SegmentedTabs
        items={MODE_TABS}
        value={timer.mode}
        onChange={timer.setMode}
        className="mt-4"
      />

      {currentPlan && (
        <div className="mt-6">
          <CurrentPlanNotice planTitle={currentPlan} />
        </div>
      )}

      <div className={currentPlan ? 'mt-3' : 'mt-8'}>
        <FocusDial
          roundMinutes={timer.roundMinutes}
          elapsedSeconds={timer.elapsedSeconds}
          centerLabel={formatClock(timer.displaySeconds)}
          caption={timer.caption}
          variant={timer.dialVariant}
          labelStep={DIAL_LABEL_STEP}
        />
      </div>

      <div className="mt-8">
        <FocusControls
          isRunning={timer.isRunning}
          elapsedSeconds={timer.elapsedSeconds}
          onStart={timer.onStart}
          onPause={timer.onPause}
          onFinish={timer.onFinish}
        />
      </div>

      <div className="mt-4">
        <FocusModeHint mode={timer.mode} />
      </div>

      {timer.isCelebrating && <CelebrationOverlay onClose={timer.dismissCelebration} />}
    </div>
  );
}
