// components/HorizontalCarousel.tsx
import { useRef, useState, type ReactNode, type UIEvent } from 'react';
import { cn } from '@/lib/utils';

/** 이 개수를 넘으면 점 대신 'n / m' 텍스트로 위치를 표시한다 */
const MAX_DOT_COUNT = 5;

interface HorizontalCarouselProps<T> {
  items: T[];
  getKey: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  className?: string;
}

/**
 * 카드를 좌우로 넘겨보는 캐러셀 (홈의 목표, 기록 탭의 투두 리스트가 함께 쓴다).
 *
 * 슬라이드가 가능하다는 걸 두 가지로 알린다.
 * 1) 카드 너비를 88%로 두어 다음 카드가 살짝 보이게 한다(peek)
 * 2) 아래에 현재 위치 표시를 둔다 (5개 이하는 점, 그보다 많으면 'n / m')
 */
export default function HorizontalCarousel<T>({
  items,
  getKey,
  renderItem,
  className,
}: HorizontalCarouselProps<T>) {
  const [activeIndex, setActiveIndex] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);

  const hasMultiple = items.length > 1;
  const useDots = items.length <= MAX_DOT_COUNT;

  /** 스크롤 위치로 현재 카드 인덱스를 계산한다 */
  const handleScroll = (e: UIEvent<HTMLDivElement>) => {
    const track = e.currentTarget;
    const cardWidth = track.scrollWidth / items.length;
    const index = Math.round(track.scrollLeft / cardWidth);
    setActiveIndex(Math.min(Math.max(index, 0), items.length - 1));
  };

  const scrollToIndex = (index: number) => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollTo({ left: (track.scrollWidth / items.length) * index, behavior: 'smooth' });
  };

  return (
    <div className={className}>
      <div
        ref={trackRef}
        onScroll={hasMultiple ? handleScroll : undefined}
        // -mx-6 px-6: 화면 좌우 여백을 넘어 스크롤되게 하면서 첫 카드는 여백에 맞춘다
        className="-mx-6 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-6 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item) => (
          <div
            key={getKey(item)}
            className={cn('shrink-0 snap-start', hasMultiple ? 'w-[88%]' : 'w-full')}
          >
            {renderItem(item)}
          </div>
        ))}
      </div>

      {hasMultiple &&
        (useDots ? (
          <div className="mt-3 flex justify-center gap-1.5">
            {items.map((item, index) => (
              <button
                key={getKey(item)}
                type="button"
                onClick={() => scrollToIndex(index)}
                aria-label={`${index + 1}번째 카드 보기`}
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
            <span className="font-semibold text-primary">{activeIndex + 1}</span> / {items.length}
          </p>
        ))}
    </div>
  );
}
