// pages/record/components/CalendarDay.tsx
import { cn } from '@/lib/utils';
import TodoFlower from '@/pages/record/components/TodoFlower';

interface CalendarDayProps {
  date: Date;
  /** 그날 완료한 항목들이 속한 목표 id (꽃잎이 된다) */
  doneGoalIds: string[];
  isSelected: boolean;
  isToday: boolean;
  /** 방금 눌러 흔들리는 중인지 */
  isWiggling: boolean;
  onSelect: () => void;
  onWiggleEnd: () => void;
}

/**
 * 캘린더의 날짜 한 칸.
 * 완료한 항목만큼 꽃잎이 피고 그 위에 날짜 숫자가 올라간다.
 * 오늘은 회색 원, 선택한 날은 브랜드 링으로 구분한다.
 */
export default function CalendarDay({
  date,
  doneGoalIds,
  isSelected,
  isToday,
  isWiggling,
  onSelect,
  onWiggleEnd,
}: CalendarDayProps) {
  const hasFlower = doneGoalIds.length > 0;
  const weekday = date.getDay();

  return (
    <button
      type="button"
      onClick={onSelect}
      onAnimationEnd={onWiggleEnd}
      aria-pressed={isSelected}
      aria-label={`${date.getMonth() + 1}월 ${date.getDate()}일`}
      className={cn(
        'relative flex h-8 w-8 items-center justify-center rounded-full transition-transform',
        // 오늘은 회색 원, 선택한 날은 브랜드 테두리로 구분한다
        isToday && !isSelected && 'bg-muted-foreground/12',
        isSelected && 'scale-105 ring-2 ring-primary',
        isWiggling && 'flower-wiggle',
      )}
    >
      <TodoFlower doneGoalIds={doneGoalIds} />

      <span
        className={cn(
          'relative text-xs transition-colors',
          // 파스텔 꽃잎 위에서는 어두운 글씨가 가장 잘 읽힌다
          hasFlower ? 'font-bold text-foreground' : 'text-foreground',
          !hasFlower && weekday === 0 && 'text-destructive',
          !hasFlower && weekday === 6 && 'text-primary',
          isToday && 'font-bold',
        )}
      >
        {date.getDate()}
      </span>
    </button>
  );
}
