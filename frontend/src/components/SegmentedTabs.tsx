// components/SegmentedTabs.tsx
import { cn } from '@/lib/utils';

interface SegmentedTabsProps<T extends string> {
  items: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

/**
 * 두 개 이상의 화면을 오가는 세그먼트 탭.
 * 선택된 항목은 흰 배경 + 브랜드 글씨, 나머지는 비활성 색.
 * 흰 배경(인디케이터)이 transform으로 미끄러지듯 이동한다.
 */
export default function SegmentedTabs<T extends string>({
  items,
  value,
  onChange,
  className,
}: SegmentedTabsProps<T>) {
  const activeIndex = Math.max(
    0,
    items.findIndex((item) => item.value === value),
  );

  return (
    <div
      role="tablist"
      className={cn('relative flex rounded-xl bg-muted-foreground/8 p-1.5', className)}
    >
      {/* 미끄러지는 흰 배경. 항목 수에 맞춰 너비를 나누고 인덱스만큼 이동한다 */}
      <span
        aria-hidden
        className="absolute top-1.5 bottom-1.5 left-1.5 rounded-lg bg-background shadow-sm transition-transform duration-300 ease-out"
        style={{
          width: `calc((100% - 0.75rem) / ${items.length})`,
          transform: `translateX(${activeIndex * 100}%)`,
        }}
      />

      {items.map((item) => {
        const isActive = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(item.value)}
            className={cn(
              'relative z-10 flex-1 rounded-lg py-2.5 text-sm font-semibold transition-colors duration-200',
              isActive ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
