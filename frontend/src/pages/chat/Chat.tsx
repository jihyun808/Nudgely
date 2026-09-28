// pages/chat/Chat.tsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { createGoal, fetchGoals } from '@/api/goal';
import CreateGoalModal from '@/components/CreateGoalModal';
import ErrorRetry from '@/components/ErrorRetry';
import { useCachedQuery } from '@/lib/useCachedQuery';
import PageHeader from '@/components/PageHeader';
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

  const [keyword, setKeyword] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(openedFromHome);

  const load = useCallback(() => fetchGoals(), []);
  // 받아둔 목록이 있으면 먼저 그리고 뒤에서 갱신한다(탭을 옮길 때마다 스켈레톤이 뜨지 않게)
  const { data, isLoading, hasError, reload, setData } = useCachedQuery('chat:goals', load);
  // ?? [] 를 그대로 쓰면 렌더마다 새 배열이 되어 아래 useMemo 가 매번 다시 돈다
  const goals: Goal[] = useMemo(() => data ?? [], [data]);

  // 팝업을 띄우라는 신호는 한 번만 쓰고 지운다 (뒤로가기로 돌아왔을 때 다시 열리지 않도록)
  useEffect(() => {
    if (openedFromHome) navigate('/chat', { replace: true, state: null });
  }, [openedFromHome, navigate]);

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
    setData([created, ...goals]);
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
          placeholder="채팅방 검색"
          aria-label="채팅방 검색"
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
        <ErrorRetry message="채팅 목록을 불러오지 못했어요" onRetry={reload} />
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
