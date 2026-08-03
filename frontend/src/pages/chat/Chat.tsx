// pages/chat/Chat.tsx
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { createGoal, fetchGoals } from '@/api/goal';
import CreateGoalModal from '@/components/CreateGoalModal';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import ChatListItem from '@/pages/chat/components/ChatListItem';
import ChatListItemSkeleton from '@/pages/chat/components/ChatListItemSkeleton';
import { sortGoals } from '@/pages/chat/sortGoals';
import { showToast } from '@/stores/toastStore';
import type { CreateGoalInput, Goal } from '@/types/goal';

/**
 * 채팅 탭.
 * 목표 하나가 채팅방 하나다. 상단 헤더(+ 버튼) / 검색창 / 목록으로 구성된다.
 * 목록은 로딩(스켈레톤) → 성공 / 실패(다시 시도) 세 상태를 가진다.
 */
export default function Chat() {
  const navigate = useNavigate();
  const location = useLocation();
  // 홈의 '목표 추가하기'로 들어오면 개설 팝업을 띄운 상태로 시작한다
  const openedFromHome = Boolean(
    (location.state as { openCreateGoal?: boolean } | null)?.openCreateGoal,
  );

  const [goals, setGoals] = useState<Goal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(openedFromHome);

  // 값을 늘려 목록 조회를 다시 트리거한다 (다시 시도 버튼용)
  const [reloadKey, setReloadKey] = useState(0);

  // 첫 진입은 isLoading=true로 시작하므로 여기서는 응답 결과만 반영한다
  useEffect(() => {
    let isStale = false;
    fetchGoals()
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
    // 언마운트/재요청 시 이전 응답이 늦게 도착해 상태를 덮어쓰지 않게 막는다
    return () => {
      isStale = true;
    };
  }, [reloadKey]);

  // 팝업을 띄우라는 신호는 한 번만 쓰고 지운다 (뒤로가기로 돌아왔을 때 다시 열리지 않도록)
  useEffect(() => {
    if (openedFromHome) navigate('/chat', { replace: true, state: null });
  }, [openedFromHome, navigate]);

  const handleRetry = () => {
    setIsLoading(true);
    setHasError(false);
    setReloadKey((key) => key + 1);
  };

  // 최신순으로 정렬한 뒤, 이름/최근 메시지로 검색한다
  const visibleGoals = useMemo(() => {
    const sorted = sortGoals(goals);
    const query = keyword.trim().toLowerCase();
    if (!query) return sorted;
    return sorted.filter(
      ({ name, lastMessage }) =>
        name.toLowerCase().includes(query) || lastMessage.toLowerCase().includes(query),
    );
  }, [goals, keyword]);

  const handleCreate = async (input: CreateGoalInput) => {
    const created = await createGoal(input);
    setGoals((prev) => [created, ...prev]);
    showToast(`'${created.name}' 목표를 만들었어요`, { variant: 'success' });
    navigate(`/chat/${created.id}`);
  };

  const handleOpenGoal = (goal: Goal) => {
    navigate(`/chat/${goal.id}`);
  };

  return (
    <div>
      <PageHeader
        title="채팅"
        action={
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            aria-label="새 목표 만들기"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-muted-foreground/10 text-muted-foreground transition-colors active:bg-muted-foreground/20"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              className="h-5 w-5"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        }
      />

      {/* 검색 */}
      <div className="relative mt-4">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          type="search"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="채팅 검색"
          aria-label="채팅 검색"
          className="h-11 w-full rounded-xl bg-muted-foreground/8 pr-4 pl-10 text-sm placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        />
      </div>

      {/* 목록: Layout의 좌우 여백을 -mx-6로 상쇄해 구분선을 화면 끝까지 잇는다 */}
      {isLoading ? (
        <div
          className="-mx-6 mt-4 divide-y divide-border border-t border-border"
          aria-busy="true"
          aria-label="채팅 목록을 불러오는 중"
        >
          {Array.from({ length: 6 }, (_, i) => (
            <ChatListItemSkeleton key={i} />
          ))}
        </div>
      ) : hasError ? (
        <div className="mt-20 flex flex-col items-center gap-3">
          <p className="text-sm text-muted-foreground">채팅 목록을 불러오지 못했어요</p>
          <Button variant="outline" size="sm" onClick={handleRetry}>
            다시 시도
          </Button>
        </div>
      ) : visibleGoals.length > 0 ? (
        <ul className="-mx-6 mt-4 divide-y divide-border border-t border-border">
          {visibleGoals.map((goal) => (
            <li key={goal.id}>
              <ChatListItem goal={goal} onClick={handleOpenGoal} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-20 text-center text-sm text-muted-foreground">
          {keyword.trim() ? '검색 결과가 없어요' : '아직 목표가 없어요'}
        </p>
      )}

      {isCreateOpen && (
        <CreateGoalModal onClose={() => setIsCreateOpen(false)} onCreate={handleCreate} />
      )}
    </div>
  );
}
