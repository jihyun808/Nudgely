// pages/home/components/PreviewSwiper.tsx
import { useEffect, useMemo, useRef } from 'react';
import { cn } from '@/lib/utils';
import PreviewCard from '@/pages/home/components/PreviewCard';
import { PREVIEW_CARD_HEIGHT } from '@/pages/home/components/homeCardHeight';
import type { HomePreview } from '@/types/home';

/** 자동으로 다음 장으로 넘어가는 간격(ms) */
const AUTO_SLIDE_INTERVAL = 4000;
/** 사용자가 직접 넘긴 뒤 자동 넘김을 잠시 멈추는 시간(ms) */
const AUTO_SLIDE_PAUSE = 10000;

interface PreviewSwiperProps {
  previews: HomePreview[];
  onOpen: (preview: HomePreview) => void;
}

/**
 * 안 읽은 메시지(공지·광고 포함) 미리보기를 좌우로 넘겨보는 스와이퍼.
 * 첫 장이 가장 최근에 받은 것이고, 오른쪽에서 왼쪽으로 밀어 다음 장을 본다.
 * 4초마다 자동으로 다음 장으로 넘어가며, 사용자가 직접 넘기면 10초간 멈춘다.
 */
export default function PreviewSwiper({ previews, onOpen }: PreviewSwiperProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  /** 마지막으로 사용자가 직접 조작한 시각 */
  const lastInteractionRef = useRef(0);

  // 최신순으로 정렬해 첫 장이 가장 최근 수신 항목이 되게 한다
  const sorted = useMemo(
    () =>
      [...previews].sort(
        (a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime(),
      ),
    [previews],
  );

  useEffect(() => {
    if (sorted.length <= 1) return;

    const timer = setInterval(() => {
      const track = trackRef.current;
      if (!track) return;
      // 사용자가 방금 만졌으면 이번 차례는 건너뛴다
      if (Date.now() - lastInteractionRef.current < AUTO_SLIDE_PAUSE) return;

      const cardWidth = track.clientWidth;
      const nextIndex = (Math.round(track.scrollLeft / cardWidth) + 1) % sorted.length;
      track.scrollTo({ left: nextIndex * cardWidth, behavior: 'smooth' });
    }, AUTO_SLIDE_INTERVAL);

    return () => clearInterval(timer);
  }, [sorted.length]);

  if (sorted.length === 0) {
    return (
      <p
        className={cn(
          'flex items-center justify-center rounded-2xl bg-muted-foreground/5 text-sm text-muted-foreground',
          PREVIEW_CARD_HEIGHT,
        )}
      >
        모든 메시지를 확인했어요.
      </p>
    );
  }

  return (
    <div
      ref={trackRef}
      onPointerDown={() => (lastInteractionRef.current = Date.now())}
      onTouchStart={() => (lastInteractionRef.current = Date.now())}
      className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {sorted.map((preview) => (
        <div key={preview.id} className="w-full shrink-0 snap-start">
          <PreviewCard preview={preview} onOpen={onOpen} />
        </div>
      ))}
    </div>
  );
}
