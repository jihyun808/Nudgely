// pages/record/components/TodoListCarousel.tsx
import { useRef, useState, type UIEvent } from 'react';
import { cn } from '@/lib/utils';
import TodoListCard from '@/pages/record/components/TodoListCard';
import type { TodoList } from '@/types/record';

/** 이 개수를 넘으면 점 대신 'n/m' 텍스트로 위치를 표시한다 */
const MAX_DOT_COUNT = 5;

interface TodoListCarouselProps {
  todoLists: TodoList[];
}

/**
 * 여러 투두 리스트를 좌우 슬라이드로 넘겨보는 캐러셀.
 *
 * 슬라이드가 가능하다는 걸 두 가지로 알린다.
 * 1) 카드 너비를 88%로 두어 다음 카드가 살짝 보이게 한다(peek)
 * 2) 아래에 현재 위치를 나타내는 점을 두고, 점을 눌러도 이동할 수 있게 한다
 */
export default function TodoListCarousel({ todoLists }: TodoListCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);

  /** 스크롤 위치로 현재 카드 인덱스를 계산한다 */
  const handleScroll = (e: UIEvent<HTMLDivElement>) => {
    const track = e.currentTarget;
    const cardWidth = track.scrollWidth / todoLists.length;
    const index = Math.round(track.scrollLeft / cardWidth);
    setActiveIndex(Math.min(Math.max(index, 0), todoLists.length - 1));
  };

  const scrollToIndex = (index: number) => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollTo({ left: (track.scrollWidth / todoLists.length) * index, behavior: 'smooth' });
  };

  if (todoLists.length === 0) {
    return (
      <p className="rounded-2xl bg-muted-foreground/5 py-10 text-center text-sm text-muted-foreground">
        이 날짜에는 투두 리스트가 없어요
      </p>
    );
  }

  const hasMultiple = todoLists.length > 1;
  // 개수가 많으면 점이 지나치게 길어지므로 텍스트 표시로 바꾼다
  const useDots = todoLists.length <= MAX_DOT_COUNT;

  return (
    <div>
      <div
        ref={trackRef}
        onScroll={hasMultiple ? handleScroll : undefined}
        // -mx-6 px-6: 화면 좌우 여백을 넘어 스크롤되게 하면서 첫 카드는 여백에 맞춘다
        className={cn(
          '-mx-6 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-6 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        )}
      >
        {todoLists.map((todoList) => (
          <div
            key={todoList.id}
            className={cn('shrink-0 snap-start', hasMultiple ? 'w-[88%]' : 'w-full')}
          >
            <TodoListCard todoList={todoList} />
          </div>
        ))}
      </div>

      {hasMultiple &&
        (useDots ? (
          <div className="mt-3 flex justify-center gap-1.5">
            {todoLists.map((todoList, index) => (
              <button
                key={todoList.id}
                type="button"
                onClick={() => scrollToIndex(index)}
                aria-label={`${index + 1}번째 투두 리스트 보기`}
                aria-current={index === activeIndex}
                className={cn(
                  'h-1.5 rounded-full transition-all duration-300',
                  index === activeIndex ? 'w-4 bg-primary' : 'w-1.5 bg-muted-foreground/30',
                )}
              />
            ))}
          </div>
        ) : (
          <p aria-live="polite" className="mt-3 text-center text-xs text-muted-foreground">
            <span className="font-semibold text-primary">{activeIndex + 1}</span> /{' '}
            {todoLists.length}
          </p>
        ))}
    </div>
  );
}
