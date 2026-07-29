// pages/record/Record.tsx
import { useEffect, useMemo, useState } from 'react';
import { fetchTodoLists } from '@/api/record';
import PageHeader from '@/components/PageHeader';
import SegmentedTabs from '@/components/SegmentedTabs';
import { Button } from '@/components/ui/button';
import Calendar from '@/pages/record/components/Calendar';
import TenMinutePlanner from '@/pages/record/components/TenMinutePlanner';
import TodoListCarousel from '@/pages/record/components/TodoListCarousel';
import type { TodoList } from '@/types/record';
import { formatDateKey } from '@/utils/date';

type RecordTab = 'calendar' | 'planner';

const TABS: { value: RecordTab; label: string }[] = [
  { value: 'calendar', label: '캘린더' },
  { value: 'planner', label: '텐미닛 플래너' },
];

/**
 * 기록 탭.
 * 캘린더(투두 리스트)와 텐미닛 플래너를 세그먼트 탭으로 오간다.
 * 캘린더에서 고른 날짜와 투두 리스트는 서로 독립이다.
 */
export default function Record() {
  const [tab, setTab] = useState<RecordTab>('calendar');
  /** 탭이 오른쪽으로 이동했는지 (내용 애니메이션 방향 결정용) */
  const [isMovingRight, setIsMovingRight] = useState(true);
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [todoLists, setTodoLists] = useState<TodoList[]>([]);
  const [isLoadingTodos, setIsLoadingTodos] = useState(true);
  const [hasTodoError, setHasTodoError] = useState(false);
  /** 값을 늘려 같은 날짜로 다시 조회를 트리거한다 (다시 시도 버튼용) */
  const [reloadKey, setReloadKey] = useState(0);

  const dateKey = useMemo(() => formatDateKey(selectedDate), [selectedDate]);

  // 선택한 날짜가 바뀌면 그 날짜에 할당된 투두를 다시 불러온다
  useEffect(() => {
    let isStale = false;
    fetchTodoLists(dateKey)
      .then((data) => {
        if (isStale) return;
        setTodoLists(data);
        setHasTodoError(false);
      })
      .catch(() => {
        if (!isStale) setHasTodoError(true);
      })
      .finally(() => {
        if (!isStale) setIsLoadingTodos(false);
      });
    return () => {
      isStale = true;
    };
  }, [dateKey, reloadKey]);

  const handleSelectDate = (date: Date) => {
    setSelectedDate(date);
    setIsLoadingTodos(true);
  };

  const handleRetryTodos = () => {
    setIsLoadingTodos(true);
    setHasTodoError(false);
    setReloadKey((key) => key + 1);
  };

  const handleTabChange = (next: RecordTab) => {
    const currentIndex = TABS.findIndex(({ value }) => value === tab);
    const nextIndex = TABS.findIndex(({ value }) => value === next);
    setIsMovingRight(nextIndex > currentIndex);
    setTab(next);
  };

  return (
    <div>
      <PageHeader title="기록" />

      <SegmentedTabs items={TABS} value={tab} onChange={handleTabChange} className="mt-4" />

      {/* key를 바꿔 탭이 바뀔 때마다 진입 애니메이션이 다시 실행되게 한다 */}
      <div
        key={tab}
        role="tabpanel"
        className={isMovingRight ? 'panel-enter-right' : 'panel-enter-left'}
      >
        {tab === 'calendar' ? (
          <>
            <div className="mt-5">
              <Calendar selected={selectedDate} onSelect={handleSelectDate} />
            </div>

            {/* TODO: 오늘 총 집중 시간 카드 */}

            <div className="mt-6">
              <h2 className="mb-3 text-sm font-bold">
                {selectedDate.getMonth() + 1}월 {selectedDate.getDate()}일 투두
              </h2>
              {isLoadingTodos ? (
                <div className="h-44 animate-pulse rounded-2xl bg-muted-foreground/8" />
              ) : hasTodoError ? (
                <div className="flex flex-col items-center gap-3 rounded-2xl bg-muted-foreground/5 py-8">
                  <p className="text-sm text-muted-foreground">투두를 불러오지 못했어요</p>
                  <Button variant="outline" size="sm" onClick={handleRetryTodos}>
                    다시 시도
                  </Button>
                </div>
              ) : (
                // key: 날짜가 바뀌면 캐러셀을 첫 장으로 되돌린다
                <TodoListCarousel key={dateKey} todoLists={todoLists} />
              )}
            </div>
          </>
        ) : (
          <TenMinutePlanner />
        )}
      </div>
    </div>
  );
}
