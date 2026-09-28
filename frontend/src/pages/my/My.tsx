// pages/my/My.tsx
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchDailyFocus, fetchFocusSummary } from '@/api/focus';
import { fetchCompletedGoals } from '@/api/goal';
import { fetchMyProfile, updateMyProfile } from '@/api/user';
import Skeleton from '@/components/Skeleton';
import ErrorRetry from '@/components/ErrorRetry';
import GearIcon from '@/components/GearIcon';
import PageHeader from '@/components/PageHeader';
import CompletedGoalList from '@/pages/my/components/CompletedGoalList';
import FocusHeatmap from '@/pages/my/components/FocusHeatmap';
import ProfileEditModal from '@/pages/my/components/ProfileEditModal';
import StatCards from '@/pages/my/components/StatCards';
import WeeklyFocusCard from '@/pages/my/components/WeeklyFocusCard';
import { useCachedQuery } from '@/lib/useCachedQuery';
import { useAuthStore } from '@/stores/authStore';
import { showToast } from '@/stores/toastStore';
import type { Goal } from '@/types/goal';
import type { UpdateProfileInput } from '@/types/user';
import { formatDateKey } from '@/utils/date';

/**
 * 마이페이지.
 * 헤더(+설정) / 프로필 / 요약 카드 3개 / 이번 주 집중 / 집중 히트맵.
 */
export default function My() {
  const navigate = useNavigate();
  // 프로필은 전역 상태에 두고 다른 화면과 함께 쓴다
  const profile = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  // 프로필은 스토어에 남아 있다. 있으면 스켈레톤 없이 바로 그리고 뒤에서 갱신한다
  const [isLoading, setIsLoading] = useState(!profile);
  const [hasError, setHasError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [isEditOpen, setIsEditOpen] = useState(false);

  /** 완주한 목표. 없으면 화면에 섹션 자체가 생기지 않는다 */
  const loadCompleted = useCallback(() => fetchCompletedGoals(), []);
  const { data: completedGoalsData } = useCachedQuery('my:completed', loadCompleted);
  const completedGoals: Goal[] = completedGoalsData ?? [];

  const joinedAt = profile?.createdAt;

  // 집중 기록은 한 번만 받아 요약 카드와 히트맵이 나눠 쓴다.
  // 캐시해 두지 않으면 탭을 옮길 때마다 잔디가 빈 칸에서 다시 그려진다
  const loadFocus = useCallback(async () => {
    if (!joinedAt) return { secondsByDate: {} as Record<string, number>, streakDays: 0 };
    const [secondsByDate, summary] = await Promise.all([
      fetchDailyFocus(formatDateKey(new Date(joinedAt)), formatDateKey(new Date())),
      fetchFocusSummary(),
    ]);
    return { secondsByDate, streakDays: summary.streakDays };
  }, [joinedAt]);
  const { data: focusData } = useCachedQuery(`my:focus:${joinedAt ?? ''}`, loadFocus);
  /** 가입일부터 오늘까지의 날짜별 집중 시간(초) */
  const secondsByDate: Record<string, number> = focusData?.secondsByDate ?? {};
  /** 연속 달성일 (서버 계산) */
  const streakDays = focusData?.streakDays ?? 0;

  useEffect(() => {
    let isStale = false;
    fetchMyProfile()
      .then((data) => {
        if (isStale) return;
        setUser(data);
        setHasError(false);
      })
      .catch(() => {
        // 이미 보여줄 프로필이 있으면 화면을 비우지 않는다. 잠깐 끊긴 것일 수 있다
        if (!isStale && !useAuthStore.getState().user) setHasError(true);
      })
      .finally(() => {
        if (!isStale) setIsLoading(false);
      });
    return () => {
      isStale = true;
    };
  }, [reloadKey, setUser]);

  const handleRetry = () => {
    setIsLoading(true);
    setHasError(false);
    setReloadKey((key) => key + 1);
  };

  const handleSaveProfile = async (input: UpdateProfileInput) => {
    setUser(await updateMyProfile(input));
    showToast('프로필을 저장했어요', { variant: 'success' });
  };

  return (
    <div>
      <PageHeader
        title="마이페이지"
        action={
          <button
            type="button"
            onClick={() => navigate('/settings')}
            aria-label="설정"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background text-foreground transition-colors active:bg-muted-foreground/10"
          >
            <GearIcon />
          </button>
        }
      />

      {isLoading ? (
        <div className="mt-6 space-y-4">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      ) : hasError || !profile ? (
        <ErrorRetry message="프로필을 불러오지 못했어요" onRetry={handleRetry} />
      ) : (
        <>
          {/* 프로필 */}
          <section className="mt-6 flex items-center gap-4">
            {profile.imageUrl ? (
              <img
                src={profile.imageUrl}
                alt=""
                className="h-20 w-20 shrink-0 rounded-full object-cover"
              />
            ) : (
              <span
                aria-hidden
                className="h-20 w-20 shrink-0 rounded-full bg-muted-foreground/15"
              />
            )}

            <div className="min-w-0">
              <p className="truncate text-xl font-bold">{profile.nickname}</p>
              <button
                type="button"
                onClick={() => setIsEditOpen(true)}
                className="mt-2 rounded-md bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary transition-colors active:bg-primary/20"
              >
                프로필 편집
              </button>
            </div>
          </section>

          <hr className="mt-7 border-border" />

          <div className="mt-5">
            <StatCards
              streakDays={streakDays}
              totalFocusedSeconds={Object.values(secondsByDate).reduce((a, b) => a + b, 0)}
              completedGoalCount={completedGoals.length}
            />
          </div>

          <div className="mt-4">
            <WeeklyFocusCard />
          </div>

          <div className="mt-4">
            <FocusHeatmap joinedAt={profile.createdAt} secondsByDate={secondsByDate} />
          </div>

          <CompletedGoalList goals={completedGoals} />
        </>
      )}

      {isEditOpen && profile && (
        <ProfileEditModal
          profile={profile}
          onClose={() => setIsEditOpen(false)}
          onSave={handleSaveProfile}
        />
      )}
    </div>
  );
}
