// pages/goalSettings/GoalSettingsPage.tsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { fetchGoal } from '@/api/goal';
import DetailHeader from '@/components/DetailHeader';
import ErrorRetry from '@/components/ErrorRetry';
import GoalSettings from '@/pages/goalSettings/components/GoalSettings';
import type { GoalDetail } from '@/types/goal';

/**
 * 목표(채팅방) 설정 화면.
 * 모아보기 헤더의 톱니바퀴에서 들어온다.
 */
export default function GoalSettingsPage() {
  const { goalId = '' } = useParams();

  const [goal, setGoal] = useState<GoalDetail>();
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let isStale = false;
    fetchGoal(goalId)
      .then((data) => {
        if (isStale) return;
        setGoal(data);
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
  }, [goalId, reloadKey]);

  return (
    <div className="mx-auto min-h-dvh max-w-md bg-background px-6 pt-6 pb-10">
      <DetailHeader title="목표 설정" subtitle={goal?.name} />

      {isLoading ? (
        <div className="mt-6 space-y-3">
          <div className="h-64 animate-pulse rounded-2xl bg-muted-foreground/8" />
          <div className="h-28 animate-pulse rounded-2xl bg-muted-foreground/8" />
        </div>
      ) : hasError || !goal ? (
        <ErrorRetry
          message="목표 정보를 불러오지 못했어요"
          onRetry={() => {
            setIsLoading(true);
            setHasError(false);
            setReloadKey((key) => key + 1);
          }}
        />
      ) : (
        <div className="mt-6">
          <GoalSettings goal={goal} onUpdated={setGoal} />
        </div>
      )}
    </div>
  );
}
