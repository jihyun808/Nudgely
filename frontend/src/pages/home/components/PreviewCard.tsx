// pages/home/components/PreviewCard.tsx
import { cn } from '@/lib/utils';
import { PREVIEW_CARD_HEIGHT } from '@/pages/home/components/homeCardHeight';
import type { HomePreview, PreviewKind } from '@/types/home';

/** 종류별 아이콘. 메시지는 종류를 가리지 않고 💌로 통일한다 */
const KIND_ICON: Record<PreviewKind, string> = {
  message: '💌',
  notice: '📢',
  ad: '🎁',
};

interface PreviewCardProps {
  preview: HomePreview;
  /** 카드를 눌렀을 때. 읽음 처리와 화면 이동은 홈에서 담당한다 */
  onOpen: (preview: HomePreview) => void;
}

/**
 * 홈 상단 미리보기 카드 (브랜드 색).
 * 메시지는 본문을 두 줄까지만 보여주고 넘치면 말줄임표로 자른다.
 * 공지·광고는 길이를 제한하지 않는다.
 */
export default function PreviewCard({ preview, onOpen }: PreviewCardProps) {
  const { kind, title, subtitle, content } = preview;
  const isMessage = kind === 'message';

  return (
    <button
      type="button"
      onClick={() => onOpen(preview)}
      className={cn(
        'flex w-full items-center gap-3.5 rounded-2xl bg-primary px-4 text-left text-primary-foreground transition-opacity active:opacity-90',
        PREVIEW_CARD_HEIGHT,
      )}
    >
      <span
        aria-hidden
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-foreground/15 text-xl"
      >
        {KIND_ICON[kind]}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs opacity-80">
          {title}
          {subtitle && ` · ${subtitle}`}
        </span>
        <span
          className={cn(
            'mt-1 block text-sm leading-relaxed font-semibold',
            isMessage && 'line-clamp-2',
          )}
        >
          {content}
        </span>
      </span>
    </button>
  );
}
