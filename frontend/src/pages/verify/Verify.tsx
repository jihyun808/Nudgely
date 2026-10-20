// pages/verify/Verify.tsx
import { useState } from 'react';
import Modal from '@/components/Modal';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import FocusGoalPicker from '@/pages/focus/components/FocusGoalPicker';
import ConsentModal from '@/pages/verify/components/ConsentModal';
import { useCameraVerify } from '@/pages/verify/useCameraVerify';
import { formatClock } from '@/utils/time';

export default function Verify() {
  const [goalId, setGoalId] = useState<string>();
  const [isConsentOpen, setIsConsentOpen] = useState(false);
  const {
    videoRef,
    phase,
    seconds,
    isScored,
    isCalibrating,
    notice,
    wasInterrupted,
    dismissInterrupted,
    session,
    error,
    start,
    stop,
  } = useCameraVerify(goalId);

  const isLive = phase === 'running' || phase === 'preparing';

  return (
    <div>
      <PageHeader title="카메라" />

      <FocusGoalPicker value={goalId} onChange={setGoalId} disabled={isLive} />

      {error && (
        <p role="alert" className="mt-3 text-center text-xs text-destructive">
          {error}
        </p>
      )}

      <div className="relative mt-4 overflow-hidden rounded-2xl bg-foreground/90">
        <video
          ref={videoRef}
          muted
          playsInline
          // 거울처럼 보여야 자기 모습으로 읽힌다
          className="aspect-[3/4] w-full scale-x-[-1] object-cover"
        />

        {phase === 'running' && (
          <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-foreground/55 px-2.5 py-1 backdrop-blur-sm">
            <span className="h-2 w-2 animate-pulse rounded-full bg-destructive" />
            <span className="text-xs font-medium text-background">인증 중</span>
          </div>
        )}

        {phase === 'running' && (isCalibrating || notice) && (
          <div className="absolute top-3 right-3 rounded-full bg-foreground/55 px-2.5 py-1 text-xs text-background backdrop-blur-sm">
            {isCalibrating ? '자세를 익히는 중' : notice}
          </div>
        )}

        {!isLive && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-background/70">
            시작하면 카메라가 켜져요
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-foreground/70 to-transparent pt-10 pb-4">
          <p className="text-center text-4xl font-bold text-background tabular-nums">
            {formatClock(seconds)}
          </p>

          {session && isScored && (
            <div className="mt-1.5 flex justify-center gap-4 text-xs text-background/80">
              <span>
                집중 <span className="font-bold text-background">{session.focusScore}%</span>
              </span>
              {session.awayCount > 0 && <span>자리 비움 {session.awayCount}회</span>}
            </div>
          )}
        </div>
      </div>

      <div className="mt-6">
        {phase === 'running' ? (
          <Button variant="outline" size="lg" className="w-full" onClick={() => void stop()}>
            집중 끝내기
          </Button>
        ) : (
          <Button
            size="lg"
            className="w-full"
            disabled={phase === 'preparing'}
            onClick={() => setIsConsentOpen(true)}
          >
            {phase === 'preparing' ? '카메라 켜는 중...' : '집중 시작'}
          </Button>
        )}
      </div>

      {wasInterrupted && (
        <Modal title="기록이 멈췄어요" onClose={dismissInterrupted}>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            앱을 나가 있는 동안 카메라가 꺼져서 거기까지만 기록했어요. 이어서 하려면 다시
            시작해주세요.
          </p>
          <Button className="mt-5 w-full" onClick={dismissInterrupted}>
            알겠어요
          </Button>
        </Modal>
      )}

      {isConsentOpen && (
        <ConsentModal
          onClose={() => setIsConsentOpen(false)}
          onAgree={() => {
            setIsConsentOpen(false);
            void start();
          }}
        />
      )}
    </div>
  );
}
