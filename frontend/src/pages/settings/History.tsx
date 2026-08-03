// pages/settings/History.tsx
import { useEffect, useState } from 'react';
import { fetchHiddenGoals, updateGoal } from '@/api/goal';
import ChatAvatar from '@/components/ChatAvatar';
import DetailHeader from '@/components/DetailHeader';
import ErrorRetry from '@/components/ErrorRetry';
import { Button } from '@/components/ui/button';
import { showToast } from '@/stores/toastStore';
import type { Goal } from '@/types/goal';
import { formatChatTime } from '@/utils/date';

/**
 * 히스토리.
 * 숨긴 채팅방만 모아 보여주고, 여기서 다시 꺼낼 수 있다.
 */
export default function History() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let isStale = false;
    fetchHiddenGoals()
      .then((data) => {
        if (isStale) return;
        setGoals(data);
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
  }, [reloadKey]);

  /** 숨김을 풀면 목록에서 빼고 채팅 탭에 다시 나타난다 */
  const handleUnhide = async (goal: Goal) => {
    const previous = goals;
    setGoals((prev) => prev.filter(({ id }) => id !== goal.id));
    try {
      await updateGoal(goal.id, { isHidden: false });
      showToast(`'${goal.name}'을 채팅 목록으로 되돌렸어요`, { variant: 'success' });
    } catch {
      setGoals(previous);
      showToast('되돌리지 못했어요', { variant: 'warning' });
    }
  };

  return (
    <div className="mx-auto min-h-dvh max-w-md bg-background px-6 pt-6 pb-10">
      <DetailHeader title="히스토리" subtitle="숨긴 채팅방을 모아뒀어요" />

      {isLoading ? (
        <div className="mt-6 space-y-3">
          <div className="h-16 animate-pulse rounded-2xl bg-muted-foreground/8" />
          <div className="h-16 animate-pulse rounded-2xl bg-muted-foreground/8" />
        </div>
      ) : hasError ? (
        <ErrorRetry
          message="히스토리를 불러오지 못했어요"
          onRetry={() => {
            setIsLoading(true);
            setHasError(false);
            setReloadKey((key) => key + 1);
          }}
        />
      ) : goals.length === 0 ? (
        <p className="mt-20 text-center text-sm text-muted-foreground">숨긴 채팅방이 없어요</p>
      ) : (
        <ul className="mt-6 divide-y divide-border rounded-2xl border border-border">
          {goals.map((goal) => (
            <li key={goal.id} className="flex items-center gap-3 px-4 py-3">
              <ChatAvatar name={goal.name} imageUrl={goal.imageUrl} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{goal.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  마지막 대화 {formatChatTime(goal.lastMessageAt)}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => void handleUnhide(goal)}>
                되돌리기
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
