// pages/home/Home.tsx
import { useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchFocusSummary } from '@/api/focus';
import { fetchHomePreviews, fetchNotifications } from '@/api/home';
import { fetchGoals } from '@/api/goal';
import Skeleton from '@/components/Skeleton';
import ErrorRetry from '@/components/ErrorRetry';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import FocusSummary from '@/pages/home/components/FocusSummary';
import GoalList from '@/pages/home/components/GoalList';
import NotificationBell from '@/pages/home/components/NotificationBell';
import PreviewSwiper from '@/pages/home/components/PreviewSwiper';
import { useCachedQuery } from '@/lib/useCachedQuery';
import { useNotificationStore } from '@/stores/notificationStore';
import type { Goal } from '@/types/goal';
// 같은 이름의 컴포넌트가 있어 타입은 별칭으로 가져온다
import type { FocusSummary as FocusSummaryData } from '@/types/focus';
import type { HomePreview } from '@/types/home';

/**
 * 홈 화면.
 * 헤더(+알림) / 안 읽은 메시지 미리보기 / 오늘의 집중 / 집중 시작 CTA / 진행 중인 목표.
 */
export default function Home() {
  const setNotifications = useNotificationStore((state) => state.setNotifications);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    const [previews, goals, notifications, focus] = await Promise.all([
      fetchHomePreviews(),
      fetchGoals(),
      fetchNotifications(),
      fetchFocusSummary(),
    ]);
    // 완주한 목표는 '진행 중인 목표'에서 뺀다 (마이페이지에서 볼 수 있다)
    return {
      previews,
      goals: goals.filter(({ completedAt }) => !completedAt),
      notifications,
      focus,
    };
  }, []);

  // 받아둔 게 있으면 먼저 그리고 뒤에서 갱신한다 — 탭을 옮길 때마다
  // 스켈레톤이 다시 뜨지 않게(useCachedQuery)
  const { data, isLoading, hasError, refresh, reload, setData } = useCachedQuery('home', load);

  const previews: HomePreview[] = data?.previews ?? [];
  const goals: Goal[] = data?.goals ?? [];
  const focus: FocusSummaryData = data?.focus ?? {
    focusedSeconds: 0,
    targetMinutes: 0,
    streakDays: 0,
    bestStreakDays: 0,
    isBestStreak: false,
  };

  // 알림 목록은 전역 스토어가 들고 있다(종 아이콘이 어디서든 쓴다)
  useEffect(() => {
    if (data) setNotifications(data.notifications);
  }, [data, setNotifications]);

  // 채팅방에 다녀오거나 앱을 다시 열었을 때 안 읽은 메시지·목표를 최신 상태로 맞춘다
  useEffect(() => {
    const refresh = () => {
      // 조용히 갱신한다 — 돌아올 때마다 스켈레톤이 뜨면 안 읽은 표시만 보러 와도 깜빡인다
      if (document.visibilityState === 'visible') refresh();
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [refresh]);

  /**
   * 미리보기 카드를 누르면 해당 화면으로 이동한다.
   * 메시지는 들어가는 순간 읽은 것이 되므로 카드를 목록에서 바로 빼준다.
   * (서버 읽음 처리는 채팅방 진입 시 이뤄지고, 다음 홈 조회 때 최종 반영된다)
   */
  const handleOpenPreview = (preview: HomePreview) => {
    if (preview.kind === 'message' && data) {
      setData({ ...data, previews: previews.filter(({ id }) => id !== preview.id) });
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
        <ErrorRetry message="홈 정보를 불러오지 못했어요" onRetry={reload} />
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
              streakDays={focus.streakDays}
              isBestStreak={focus.isBestStreak}
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
