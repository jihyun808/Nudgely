// pages/archive/components/ImageGrid.tsx
import { useState } from 'react';
import ImageViewer from '@/components/ImageViewer';
import MonthSection from '@/pages/archive/components/MonthSection';
import { groupByMonth } from '@/pages/archive/components/groupByMonth';
import type { Attachment } from '@/types/archive';

interface ImageGridProps {
  images: Attachment[];
}

/**
 * 사진 모아보기. 연-월로 묶어 정사각 3열로 보여준다.
 * 누르면 채팅방에서와 같은 뷰어로 크게 보인다.
 */
export default function ImageGrid({ images }: ImageGridProps) {
  const [viewerImage, setViewerImage] = useState<{ src: string; name: string }>();

  if (images.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">주고받은 사진이 없어요</p>
    );
  }

  return (
    <div className="space-y-6">
      {groupByMonth(images).map(({ month, items }) => (
        <MonthSection key={month} month={month}>
          <ul className="grid grid-cols-3 gap-1.5">
            {items.map((item) => (
              <li key={item.id}>
                {/* TODO: 서버 연동 후 목록은 썸네일, 뷰어는 원본 URL을 쓰도록 나눈다 */}
                <button
                  type="button"
                  onClick={() => item.url && setViewerImage({ src: item.url, name: item.name })}
                  disabled={!item.url}
                  className="aspect-square w-full overflow-hidden rounded-lg bg-muted-foreground/10"
                >
                  {item.url ? (
                    <img src={item.url} alt={item.name} className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-xl">
                      🖼️
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </MonthSection>
      ))}

      {viewerImage && (
        <ImageViewer
          src={viewerImage.src}
          alt={viewerImage.name}
          onClose={() => setViewerImage(undefined)}
        />
      )}
    </div>
  );
}
