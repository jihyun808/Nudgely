// pages/record/components/Calendar.tsx
import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';

const WEEKDAY_HEADERS = ['일', '월', '화', '수', '목', '금', '토'] as const;

interface CalendarProps {
  /** 선택된 날짜 */
  selected: Date;
  onSelect: (date: Date) => void;
}

function isSameDate(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * 월 단위 캘린더.
 * 상단에 'YYYY년 M월'과 이전/다음 달 버튼, 아래에 요일 헤더와 날짜 그리드를 그린다.
 * 선택된 날짜는 브랜드 색 원, 오늘은 연한 브랜드 배경으로 구분한다.
 */
export default function Calendar({ selected, onSelect }: CalendarProps) {
  // 화면에 보여줄 달 (선택 날짜와 별개로 넘겨볼 수 있다)
  const [visibleMonth, setVisibleMonth] = useState(
    () => new Date(selected.getFullYear(), selected.getMonth(), 1),
  );
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

  const moveMonth = (offset: number) => {
    setVisibleMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
  };

  return (
    <section>
      {/* 연월 + 이전/다음 달 */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => moveMonth(-1)}
          aria-label="이전 달"
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
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>

        <h2 aria-live="polite" className="text-lg font-bold">
          {visibleMonth.getFullYear()}년 {visibleMonth.getMonth() + 1}월
        </h2>

        <button
          type="button"
          onClick={() => moveMonth(1)}
          aria-label="다음 달"
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
            <path d="m9 6 6 6-6 6" />
          </svg>
        </button>
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

      {/* 날짜 그리드 */}
      <div className="mt-1 grid grid-cols-7 gap-y-1">
        {Array.from({ length: leadingBlanks }, (_, i) => (
          <span key={`blank-${i}`} />
        ))}

        {days.map((date) => {
          const isSelected = isSameDate(date, selected);
          const isToday = isSameDate(date, today);
          const weekday = date.getDay();

          return (
            <div key={date.toISOString()} className="flex justify-center py-0.5">
              <button
                type="button"
                onClick={() => onSelect(date)}
                aria-pressed={isSelected}
                aria-label={`${date.getMonth() + 1}월 ${date.getDate()}일`}
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-xl text-sm font-medium transition-colors',
                  !isSelected && !isToday && 'text-foreground active:bg-muted-foreground/10',
                  !isSelected && !isToday && weekday === 0 && 'text-destructive',
                  !isSelected && !isToday && weekday === 6 && 'text-primary',
                  // 오늘은 연한 브랜드 배경, 선택된 날은 진한 브랜드 원
                  !isSelected && isToday && 'bg-primary/10 text-primary',
                  isSelected && 'bg-primary font-bold text-primary-foreground',
                )}
              >
                {date.getDate()}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
