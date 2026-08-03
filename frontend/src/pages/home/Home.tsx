// pages/home/Home.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchFocusSummary } from '@/api/focus';
import { fetchHomePreviews, fetchNotifications } from '@/api/home';
import { fetchGoals } from '@/api/goal';
import Skeleton from '@/components/Skeleton';
import ErrorRetry from '@/components/ErrorRetry';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { useRefreshOnFocus } from '@/lib/useRefreshOnFocus';
import FocusSummary from '@/pages/home/components/FocusSummary';
import GoalList from '@/pages/home/components/GoalList';
import NotificationBell from '@/pages/home/components/NotificationBell';
import PreviewSwiper from '@/pages/home/components/PreviewSwiper';
import { useNotificationStore } from '@/stores/notificationStore';
import type { Goal } from '@/types/goal';
import type { HomePreview } from '@/types/home';

/**
 * 홈 화면.
 * 헤더(+알림) / 안 읽은 메시지 미리보기 / 오늘의 집중 / 집중 시작 CTA / 진행 중인 목표.
 */
export default function Home() {
  const [previews, setPreviews] = useState<HomePreview[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  /** 오늘 집중 요약 (집중 탭에서 쌓인 값) */
  const [focus, setFocus] = useState({ focusedSeconds: 0, targetMinutes: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const setNotifications = useNotificationStore((state) => state.setNotifications);
  const navigate = useNavigate();

  useEffect(() => {
    let isStale = false;
    Promise.all([fetchHomePreviews(), fetchGoals(), fetchNotifications(), fetchFocusSummary()])
      .then(([previewData, goalData, notificationData, focusData]) => {
        if (isStale) return;
        setPreviews(previewData);
        // 완주한 목표는 '진행 중인 목표'에서 뺀다 (마이페이지에서 볼 수 있다)
        setGoals(goalData.filter(({ completedAt }) => !completedAt));
        setNotifications(notificationData);
        setFocus(focusData);
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
  }, [reloadKey, setNotifications]);

  // 채팅방에 다녀오거나 앱을 다시 열었을 때 안 읽은 메시지·목표를 최신 상태로 맞춘다
  useRefreshOnFocus(() => setReloadKey((key) => key + 1));

  const handleRetry = () => {
    setIsLoading(true);
    setHasError(false);
    setReloadKey((key) => key + 1);
  };

  /**
   * 미리보기 카드를 누르면 해당 화면으로 이동한다.
   * 메시지는 들어가는 순간 읽은 것이 되므로 카드를 목록에서 바로 빼준다.
   * (서버 읽음 처리는 채팅방 진입 시 이뤄지고, 다음 홈 조회 때 최종 반영된다)
   */
  const handleOpenPreview = (preview: HomePreview) => {
    if (preview.kind === 'message') {
      setPreviews((prev) => prev.filter(({ id }) => id !== preview.id));
    }
    if (preview.linkTo) navigate(preview.linkTo);
  };

  /** 목표 추가 = 채팅 탭으로 이동한 뒤 그곳의 채팅방 개설 팝업을 연다 */
  const handleAddGoal = () => {
    navigate('/chat', { state: { openCreateGoal: true } });
  };

  return (
    <div>
      <PageHeader title="Daily Log" action={<NotificationBell />} />

      {isLoading ? (
        <div className="mt-4 space-y-3">
          <Skeleton className="h-30" />
          <Skeleton className="h-30" />
          <Skeleton className="h-12" />
        </div>
      ) : hasError ? (
        <ErrorRetry message="홈 정보를 불러오지 못했어요" onRetry={handleRetry} />
      ) : (
        <>
          <div className="mt-4">
            <PreviewSwiper previews={previews} onOpen={handleOpenPreview} />
          </div>

          <section className="mt-6">
            <h2 className="mb-2.5 text-sm font-bold">오늘의 집중</h2>
            <FocusSummary
              focusedSeconds={focus.focusedSeconds}
              targetMinutes={focus.targetMinutes}
              streakDays={7}
              isBestStreak
            />
          </section>

          <Button
            size="lg"
            className="mt-6 w-full gap-2 rounded-2xl text-base"
            onClick={() => navigate('/focus')}
          >
            <span
              aria-hidden
              className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-foreground/20"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
                <path d="M8 5.5v13l11-6.5z" />
              </svg>
            </span>
            집중 시작하기
          </Button>

          <section className="mt-6">
            <h2 className="mb-2.5 text-sm font-bold">진행 중인 목표</h2>
            <GoalList goals={goals} onAddGoal={handleAddGoal} />
          </section>
        </>
      )}
    </div>
  );
}
