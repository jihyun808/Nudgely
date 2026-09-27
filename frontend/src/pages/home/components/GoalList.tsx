// pages/home/components/GoalList.tsx
import { useRef, useState, type UIEvent } from 'react';
import AddGoalCard from '@/pages/home/components/AddGoalCard';
import GoalCard from '@/pages/home/components/GoalCard';
import type { Goal } from '@/types/goal';

/** 한 페이지에 보여줄 카드 개수. '목표 추가하기' 카드도 한 칸으로 센다 */
const CARDS_PER_PAGE = 3;

/** 페이지에 놓이는 카드 한 칸. 마지막 칸은 항상 목표 추가하기 카드다 */
type GoalSlot = { type: 'goal'; goal: Goal } | { type: 'add' };

interface GoalListProps {
  goals: Goal[];
  onAddGoal: () => void;
}

/**
 * 진행 중인 목표 목록.
 * 세로로 카드를 쌓아 보여주고, 카드가 3개를 넘으면 페이지 단위로 좌우로 넘겨본다.
 * '목표 추가하기' 카드는 맨 끝에 하나 붙으며, 자리가 모자라면 다음 페이지로 넘어간다.
 * 페이지가 여러 장일 때만 아래에 'n / m' 숫자를 표시한다.
 */
export default function GoalList({ goals, onAddGoal }: GoalListProps) {
  const [pageIndex, setPageIndex] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);

  const slots: GoalSlot[] = [
    ...goals.map((goal) => ({ type: 'goal' as const, goal })),
    { type: 'add' as const },
  ];
  const pages = Array.from({ length: Math.ceil(slots.length / CARDS_PER_PAGE) }, (_, i) =>
    slots.slice(i * CARDS_PER_PAGE, (i + 1) * CARDS_PER_PAGE),
  );
  const hasMultiplePages = pages.length > 1;

  const handleScroll = (e: UIEvent<HTMLDivElement>) => {
    const track = e.currentTarget;
    const index = Math.round(track.scrollLeft / track.clientWidth);
    setPageIndex(Math.min(Math.max(index, 0), pages.length - 1));
  };

  const renderSlot = (slot: GoalSlot) =>
    slot.type === 'goal' ? (
      <GoalCard key={slot.goal.id} goal={slot.goal} />
    ) : (
      <AddGoalCard key="add" onClick={onAddGoal} />
    );

  if (!hasMultiplePages) {
    return <div className="space-y-3">{pages[0].map(renderSlot)}</div>;
  }

  return (
    <div>
      <div
        ref={trackRef}
        onScroll={handleScroll}
        className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {pages.map((page, index) => (
          <div
            key={page[0].type === 'goal' ? page[0].goal.id : `add-${index}`}
            className="w-full shrink-0 snap-start space-y-3 self-start"
          >
            {page.map(renderSlot)}
          </div>
        ))}
      </div>

      <p aria-live="polite" className="mt-3 text-center text-xs text-muted-foreground">
        <span className="font-semibold text-primary">{pageIndex + 1}</span> / {pages.length}
      </p>
    </div>
  );
}
