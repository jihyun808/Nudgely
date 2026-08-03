// pages/record/components/Calendar.tsx
import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import CalendarDay from '@/pages/record/components/CalendarDay';
import type { TodoMark } from '@/types/record';
import { formatDateKey } from '@/utils/date';

const WEEKDAY_HEADERS = ['일', '월', '화', '수', '목', '금', '토'] as const;

interface CalendarProps {
  /** 선택된 날짜 */
  selected: Date;
  onSelect: (date: Date) => void;
  /** 날짜별 완료 표시 (꽃 모양) */
  marks?: TodoMark[];
  /** 보이는 달이 바뀌면 알린다 (그 달의 표시를 다시 불러오기 위해) */
  onMonthChange?: (yearMonth: string) => void;
}

function isSameDate(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** 이전/다음 달 버튼 */
function MonthButton({ direction, onClick }: { direction: 'prev' | 'next'; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={direction === 'prev' ? '이전 달' : '다음 달'}
      className="flex h-9 w-9 items-center justify-center rounded-full bg-muted-foreground/8 text-muted-foreground transition-colors active:bg-muted-foreground/15"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4"
      >
        <path d={direction === 'prev' ? 'm15 18-6-6 6-6' : 'm9 6 6 6-6 6'} />
      </svg>
    </button>
  );
}

/**
 * 월 단위 캘린더.
 * 상단에 'YYYY년 M월'과 이전/다음 달 버튼, 아래에 요일 헤더와 날짜 그리드를 그린다.
 * 그날 완료한 항목만큼 색 원(꽃잎)이 쌓이고, 그 위에 날짜 숫자가 올라간다.
 */
export default function Calendar({ selected, onSelect, marks = [], onMonthChange }: CalendarProps) {
  // 화면에 보여줄 달 (선택 날짜와 별개로 넘겨볼 수 있다)
  const [visibleMonth, setVisibleMonth] = useState(
    () => new Date(selected.getFullYear(), selected.getMonth(), 1),
  );
  /** 방금 누른 날짜. 꽃이 한 번 흔들리고 비워진다 */
  const [wiggledDate, setWiggledDate] = useState<string>();
  const today = new Date();

  const { leadingBlanks, days } = useMemo(() => {
    const year = visibleMonth.getFullYear();
    const month = visibleMonth.getMonth();
    const lastDate = new Date(year, month + 1, 0).getDate();
    return {
      // 1일이 무슨 요일인지에 따라 앞쪽 빈 칸 개수가 정해진다
      leadingBlanks: new Date(year, month, 1).getDay(),
      days: Array.from({ length: lastDate }, (_, i) => new Date(year, month, i + 1)),
    };
  }, [visibleMonth]);

  /** 날짜로 빠르게 찾기 위한 표 */
  const marksByDate = useMemo(
    () => new Map(marks.map((mark) => [mark.date, mark.doneGoalIds])),
    [marks],
  );

  const moveMonth = (offset: number) => {
    setVisibleMonth((prev) => {
      const next = new Date(prev.getFullYear(), prev.getMonth() + offset, 1);
      onMonthChange?.(formatDateKey(next).slice(0, 7));
      return next;
    });
  };

  return (
    <section>
      {/* 연월 + 이전/다음 달 */}
      <div className="flex items-center justify-between">
        <MonthButton direction="prev" onClick={() => moveMonth(-1)} />
        <h2 aria-live="polite" className="text-lg font-bold">
          {visibleMonth.getFullYear()}년 {visibleMonth.getMonth() + 1}월
        </h2>
        <MonthButton direction="next" onClick={() => moveMonth(1)} />
      </div>

      {/* 요일 헤더: 일요일은 빨강, 토요일은 파랑 */}
      <div className="mt-4 grid grid-cols-7 text-center text-xs">
        {WEEKDAY_HEADERS.map((label, index) => (
          <span
            key={label}
            className={cn(
              'py-1.5',
              index === 0 && 'text-destructive',
              index === 6 && 'text-primary',
              index > 0 && index < 6 && 'text-muted-foreground',
            )}
          >
            {label}
          </span>
        ))}
      </div>

      {/* 날짜 그리드: 완료 표시(꽃) 위에 날짜가 겹쳐 올라간다 */}
      <div className="mt-1 grid grid-cols-7 gap-y-1">
        {Array.from({ length: leadingBlanks }, (_, i) => (
          <span key={`blank-${i}`} />
        ))}

        {days.map((date) => {
          const dateKey = formatDateKey(date);

          return (
            <div key={dateKey} className="flex justify-center py-0.5">
              <CalendarDay
                date={date}
                doneGoalIds={marksByDate.get(dateKey) ?? []}
                isSelected={isSameDate(date, selected)}
                isToday={isSameDate(date, today)}
                isWiggling={wiggledDate === dateKey}
                onSelect={() => {
                  onSelect(date);
                  setWiggledDate(dateKey);
                }}
                onWiggleEnd={() => setWiggledDate(undefined)}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
