// pages/chat/components/ChatDetailHeader.tsx

interface ChatDetailHeaderProps {
  /** 계정 이름 (채팅방 이름) */
  title: string;
  /** 세션 이름. 예: '온라인 · UI/UX 강의 관리 중' */
  subtitle?: string;
  onBack: () => void;
  onOpenMenu: () => void;
}

/**
 * 채팅방 상세 상단 헤더.
 * 뒤로가기 / 계정 이름 + 세션 이름 / 메뉴 버튼으로 구성된다. 프로필 이미지는 넣지 않는다.
 */
export default function ChatDetailHeader({
  title,
  subtitle,
  onBack,
  onOpenMenu,
}: ChatDetailHeaderProps) {
  return (
    <header className="flex shrink-0 items-center gap-2 border-b border-border bg-background px-3 py-2.5">
      <button
        type="button"
        onClick={onBack}
        aria-label="뒤로 가기"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-foreground transition-colors active:bg-muted-foreground/10"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5"
        >
          <path d="m15 18-6-6 6-6" />
        </svg>
      </button>

      <div className="min-w-0 flex-1">
        <h1 className="truncate text-lg leading-tight font-bold">{title}</h1>
        {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
      </div>

      <button
        type="button"
        onClick={onOpenMenu}
        aria-label="채팅방 메뉴"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors active:bg-primary/20"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
          <rect x="4" y="4" width="7" height="7" rx="1.5" />
          <rect x="13" y="4" width="7" height="7" rx="1.5" />
          <rect x="4" y="13" width="7" height="7" rx="1.5" />
          <rect x="13" y="13" width="7" height="7" rx="1.5" />
        </svg>
      </button>
    </header>
  );
}
