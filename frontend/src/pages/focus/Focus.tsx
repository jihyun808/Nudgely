// pages/focus/Focus.tsx
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import CelebrationOverlay from '@/components/CelebrationOverlay';
import SegmentedTabs from '@/components/SegmentedTabs';
import { cn } from '@/lib/utils';
import CurrentPlanNotice from '@/pages/focus/components/CurrentPlanNotice';
import FocusControls from '@/pages/focus/components/FocusControls';
import FocusDial from '@/pages/focus/components/FocusDial';
import FocusGoalPicker from '@/pages/focus/components/FocusGoalPicker';
import FocusStats from '@/pages/focus/components/FocusStats';
import { useCurrentPlan } from '@/pages/focus/useCurrentPlan';
import { useFocusTimer } from '@/pages/focus/useFocusTimer';
import CameraVerify from '@/pages/verify/Verify';
import type { FocusMode } from '@/types/focus';
import { formatClock } from '@/utils/time';

const MODE_TABS: { value: FocusMode; label: string }[] = [
  { value: 'stopwatch', label: '스톱워치' },
  { value: 'pomodoro', label: '뽀모도로' },
];

type FocusView = 'timer' | 'camera';

/** 다이얼 숫자 라벨 간격(분) */
const DIAL_LABEL_STEP = 5;

/**
 * 집중 탭. 제목 '집중' / '카메라' 를 눌러 타이머와 카메라 인증을 오간다.
 * 타이머: 오늘 집중 요약 / 방식 토글 / 지금 계획 / 원형 타이머 / 조작 버튼.
 * 타이머 동작은 useFocusTimer가, 화면은 이 파일이 담당한다.
 *
 * 한쪽이 도는 동안에는 다른 쪽으로 못 넘어간다. 타이머와 카메라가 함께 돌면
 * 같은 시간이 플래너에 두 번 쌓이고, 카메라는 화면을 떠나는 순간 꺼진다.
 */
export default function Focus() {
  const timer = useFocusTimer();
  const currentPlan = useCurrentPlan();
  // 주소에 둔다. 채팅방 등에 갔다 돌아와도 보던 쪽이 그대로다
  const [searchParams, setSearchParams] = useSearchParams();
  const view: FocusView = searchParams.get('view') === 'camera' ? 'camera' : 'timer';
  const [isCameraLive, setIsCameraLive] = useState(false);

  const isTimerBusy = timer.isRunning || timer.elapsedSeconds > 0;
  const lockedView: FocusView | undefined = isCameraLive
    ? 'timer'
    : isTimerBusy
      ? 'camera'
      : undefined;

  const changeView = (next: FocusView) => {
    if (next === view || next === lockedView) return;
    setSearchParams(next === 'camera' ? { view: 'camera' } : {}, { replace: true });
  };

  const titles: { value: FocusView; label: string }[] = [
    { value: 'timer', label: '집중' },
    { value: 'camera', label: '카메라' },
  ];

  return (
    <div>
      <header role="tablist" aria-label="집중 방식" className="flex min-h-9 items-center gap-3">
        {titles.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={view === value}
            disabled={value === lockedView}
            onClick={() => changeView(value)}
            className={cn(
              'text-2xl font-bold transition-colors',
              view === value ? 'text-foreground' : 'text-muted-foreground/50',
            )}
          >
            {label}
          </button>
        ))}
      </header>

      {view === 'camera' ? (
        <CameraVerify onLiveChange={setIsCameraLive} />
      ) : (
        <>
          <div className="mt-4">
            <FocusStats
              focusedSeconds={timer.todayFocusedSeconds}
              targetMinutes={timer.targetMinutes}
            />
          </div>

          {/* 집중이 시작된 뒤 목표를 바꾸면 이미 흐른 시간까지 새 목표로 넘어간다.
          아직 저장되지 않은 집중이 있는 동안에는 잠근다(멈춰 둔 경우 포함). */}
          <FocusGoalPicker
            value={timer.goalId}
            onChange={timer.selectGoal}
            disabled={timer.isRunning || timer.elapsedSeconds > 0}
          />

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

          <div className={currentPlan ? 'mt-6' : 'mt-12'}>
            <FocusDial
              roundMinutes={timer.roundMinutes}
              elapsedSeconds={timer.elapsedSeconds}
              centerLabel={formatClock(timer.displaySeconds)}
              caption={timer.caption}
              variant={timer.dialVariant}
              labelStep={DIAL_LABEL_STEP}
            />
          </div>

          <div className="mt-12">
            <FocusControls
              isRunning={timer.isRunning}
              elapsedSeconds={timer.elapsedSeconds}
              onStart={timer.onStart}
              onPause={timer.onPause}
              onFinish={timer.onFinish}
            />
          </div>
        </>
      )}

      {timer.isCelebrating && <CelebrationOverlay onClose={timer.dismissCelebration} />}
    </div>
  );
}
