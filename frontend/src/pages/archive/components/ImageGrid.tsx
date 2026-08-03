// pages/archive/components/ImageGrid.tsx
import { groupByMonth } from '@/pages/archive/components/groupByMonth';
import type { Attachment } from '@/types/archive';

interface ImageGridProps {
  images: Attachment[];
}

/** 사진 모아보기. 연-월로 묶어 정사각 3열로 보여준다 */
export default function ImageGrid({ images }: ImageGridProps) {
  if (images.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">주고받은 사진이 없어요</p>
    );
  }

  return (
    <div className="space-y-6">
      {groupByMonth(images).map(({ month, items }) => (
        <section key={month}>
          <h3 className="mb-2 text-xs font-semibold text-muted-foreground">{month}</h3>
          <ul className="grid grid-cols-3 gap-1.5">
            {items.map((item) => (
              <li key={item.id}>
                {/* TODO: 서버 연동 후 실제 썸네일(url)로 교체하고, 누르면 크게 보기 */}
                <div className="aspect-square overflow-hidden rounded-lg bg-muted-foreground/10">
                  {item.url ? (
                    <img src={item.url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-xl">
                      🖼️
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
