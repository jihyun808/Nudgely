// pages/my/My.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchMyProfile, updateMyProfile } from '@/api/user';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import FocusHeatmap from '@/pages/my/components/FocusHeatmap';
import ProfileEditModal from '@/pages/my/components/ProfileEditModal';
import StatCards from '@/pages/my/components/StatCards';
import WeeklyFocusCard from '@/pages/my/components/WeeklyFocusCard';
import { useAuthStore } from '@/stores/authStore';
import type { UpdateProfileInput } from '@/types/user';

/**
 * 마이페이지.
 * 헤더(+설정) / 프로필 / 요약 카드 3개 / 이번 주 집중 / 집중 히트맵.
 */
export default function My() {
  const navigate = useNavigate();
  // 프로필은 전역 상태에 두고 다른 화면과 함께 쓴다
  const profile = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [isEditOpen, setIsEditOpen] = useState(false);

  useEffect(() => {
    let isStale = false;
    fetchMyProfile()
      .then((data) => {
        if (isStale) return;
        setUser(data);
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
  }, [reloadKey, setUser]);

  const handleRetry = () => {
    setIsLoading(true);
    setHasError(false);
    setReloadKey((key) => key + 1);
  };

  const handleSaveProfile = async (input: UpdateProfileInput) => {
    setUser(await updateMyProfile(input));
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
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 8.9 19a1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 5 8.9a1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9.5a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
            </svg>
          </button>
        }
      />

      {isLoading ? (
        <div className="mt-6 space-y-4">
          <div className="h-20 animate-pulse rounded-2xl bg-muted-foreground/8" />
          <div className="h-20 animate-pulse rounded-2xl bg-muted-foreground/8" />
        </div>
      ) : hasError || !profile ? (
        <div className="mt-20 flex flex-col items-center gap-3">
          <p className="text-sm text-muted-foreground">프로필을 불러오지 못했어요</p>
          <Button variant="outline" size="sm" onClick={handleRetry}>
            다시 시도
          </Button>
        </div>
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
            <StatCards />
          </div>

          <div className="mt-4">
            <WeeklyFocusCard />
          </div>

          <div className="mt-4">
            <FocusHeatmap />
          </div>
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
