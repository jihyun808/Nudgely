// pages/record/Record.tsx
import { useCallback, useMemo, useState } from 'react';
import { fetchDailyTodos, fetchTodoMarks } from '@/api/record';
import Skeleton from '@/components/Skeleton';
import { useCachedQuery } from '@/lib/useCachedQuery';
import PageHeader from '@/components/PageHeader';
import SegmentedTabs from '@/components/SegmentedTabs';
import { Button } from '@/components/ui/button';
import Calendar from '@/pages/record/components/Calendar';
import TenMinutePlanner from '@/pages/record/components/TenMinutePlanner';
import TodoCarousel from '@/pages/record/components/TodoCarousel';
import type { DailyTodo, TodoMark } from '@/types/record';
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
  const dateKey = useMemo(() => formatDateKey(selectedDate), [selectedDate]);
  const [visibleMonth, setVisibleMonth] = useState(() => dateKey.slice(0, 7));

  // 날짜·달을 키로 캐시한다. 어제 본 날짜로 돌아가거나 탭을 옮겨도
  // 스켈레톤이 다시 뜨지 않고, 뒤에서 조용히 갱신된다
  const loadTodos = useCallback(() => fetchDailyTodos(dateKey), [dateKey]);
  const {
    data: todoData,
    isLoading: isLoadingTodos,
    hasError: hasTodoError,
    reload: reloadTodos,
    setData: setTodos,
  } = useCachedQuery(`record:todos:${dateKey}`, loadTodos);
  const todos: DailyTodo[] = useMemo(() => todoData ?? [], [todoData]);

  /** 캘린더에 꽃 모양으로 표시할 완료 기록 */
  const loadMarks = useCallback(() => fetchTodoMarks(visibleMonth), [visibleMonth]);
  const { data: marksData, refresh: refreshMarks } = useCachedQuery(
    `record:marks:${visibleMonth}`,
    loadMarks,
  );
  const marks: TodoMark[] = useMemo(() => marksData ?? [], [marksData]);

  const handleSelectDate = (date: Date) => setSelectedDate(date);

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
              <Calendar
                selected={selectedDate}
                onSelect={handleSelectDate}
                marks={marks}
                onMonthChange={setVisibleMonth}
              />
            </div>

            <div className="mt-6">
              <h2 className="mb-3 text-sm font-bold">
                {selectedDate.getMonth() + 1}월 {selectedDate.getDate()}일 투두
              </h2>
              {isLoadingTodos ? (
                <Skeleton className="h-44" />
              ) : hasTodoError ? (
                <div className="flex flex-col items-center gap-3 rounded-2xl bg-muted-foreground/5 py-8">
                  <p className="text-sm text-muted-foreground">투두를 불러오지 못했어요</p>
                  <Button variant="outline" size="sm" onClick={reloadTodos}>
                    다시 시도
                  </Button>
                </div>
              ) : (
                // key: 날짜가 바뀌면 캐러셀을 첫 장으로 되돌린다
                <TodoCarousel
                  key={dateKey}
                  todos={todos}
                  setTodos={setTodos}
                  // 지난 날짜는 읽기 전용이다 — 나중에 고치면 꽃 표시와 진도가
                  // 뒤늦게 흔들린다
                  isToday={dateKey === formatDateKey(new Date())}
                  onCompletionChanged={refreshMarks}
                />
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
