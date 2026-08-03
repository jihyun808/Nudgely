// pages/record/Record.tsx
import { useEffect, useMemo, useState } from 'react';
import { fetchDailyTodos, fetchTodoMarks } from '@/api/record';
import Skeleton from '@/components/Skeleton';
import PageHeader from '@/components/PageHeader';
import SegmentedTabs from '@/components/SegmentedTabs';
import { Button } from '@/components/ui/button';
import Calendar from '@/pages/record/components/Calendar';
import TenMinutePlanner from '@/pages/record/components/TenMinutePlanner';
import TodoCarousel from '@/pages/record/components/TodoCarousel';
import TodoItemDialog from '@/pages/record/components/TodoItemDialog';
import { useTodoItems, type TodoTarget } from '@/pages/record/useTodoItems';
import { showToast } from '@/stores/toastStore';
import { TODO_ITEM_MAX, type DailyTodo, type TodoMark } from '@/types/record';
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
  const [todos, setTodos] = useState<DailyTodo[]>([]);
  const [isLoadingTodos, setIsLoadingTodos] = useState(true);
  const [hasTodoError, setHasTodoError] = useState(false);
  /** 값을 늘려 같은 날짜로 다시 조회를 트리거한다 (다시 시도 버튼용) */
  const [reloadKey, setReloadKey] = useState(0);
  const [dialog, setDialog] = useState<TodoTarget>();

  const dateKey = useMemo(() => formatDateKey(selectedDate), [selectedDate]);
  /** 투두는 오늘 것만 고칠 수 있다 (지난 기록은 그대로 두고, 앞날은 AI가 정한다) */
  const isToday = dateKey === formatDateKey(new Date());
  /** 캘린더에 꽃 모양으로 표시할 완료 기록 */
  const [marks, setMarks] = useState<TodoMark[]>([]);
  const [visibleMonth, setVisibleMonth] = useState(() => dateKey.slice(0, 7));
  /** 투두가 바뀌면 값을 늘려 그 달의 꽃 표시를 다시 불러온다 */
  const [marksReloadKey, setMarksReloadKey] = useState(0);

  // 보이는 달이 바뀌면 그 달의 완료 표시를 다시 불러온다
  useEffect(() => {
    let isStale = false;
    fetchTodoMarks(visibleMonth)
      .then((data) => {
        if (!isStale) setMarks(data);
      })
      .catch(() => {
        // 표시를 못 받아도 캘린더는 쓸 수 있다
      });
    return () => {
      isStale = true;
    };
  }, [visibleMonth, marksReloadKey]);
  // 선택한 날짜가 바뀌면 그 날짜에 할당된 투두를 다시 불러온다
  useEffect(() => {
    let isStale = false;
    fetchDailyTodos(dateKey)
      .then((data) => {
        if (isStale) return;
        setTodos(data);
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

  // 완료 개수가 바뀌면 캘린더 꽃잎도 다시 센다
  const { toggleItem, submitItem, deleteItem } = useTodoItems(setTodos, () =>
    setMarksReloadKey((key) => key + 1),
  );

  /** 항목 수가 상한에 닿았으면 추가 팝업 대신 안내만 한다 */
  const handleAddItem = (todo: DailyTodo) => {
    if (todo.items.length >= TODO_ITEM_MAX) {
      showToast(`할 일은 하루 ${TODO_ITEM_MAX}개까지 추가할 수 있어요`, { variant: 'warning' });
      return;
    }
    setDialog({ todo });
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
                  <Button variant="outline" size="sm" onClick={handleRetryTodos}>
                    다시 시도
                  </Button>
                </div>
              ) : (
                // key: 날짜가 바뀌면 캐러셀을 첫 장으로 되돌린다
                <TodoCarousel
                  key={dateKey}
                  todos={todos}
                  isEditable={isToday}
                  onToggleItem={(todo, item) => void toggleItem(todo, item)}
                  onEditItem={(todo, item) => setDialog({ todo, item })}
                  onAddItem={handleAddItem}
                />
              )}
            </div>
          </>
        ) : (
          <TenMinutePlanner />
        )}
      </div>

      {dialog && (
        <TodoItemDialog
          item={dialog.item}
          goalTitle={dialog.todo.goalTitle}
          onSubmit={(input) => submitItem(dialog, input)}
          onDelete={dialog.item ? () => deleteItem(dialog) : undefined}
          onClose={() => setDialog(undefined)}
        />
      )}
    </div>
  );
}
