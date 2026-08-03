// components/DetailHeader.tsx
import { useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';

interface DetailHeaderProps {
  title: string;
  /** 제목 아래 작은 보조 문구 */
  subtitle?: string;
  /** 오른쪽에 붙는 액션 버튼 */
  action?: ReactNode;
}

/**
 * 탭바 없이 전체 화면을 쓰는 하위 화면(설정, 모아보기 등)의 상단 헤더.
 * 뒤로가기 + 제목(+부제)로 구성된다.
 */
export default function DetailHeader({ title, subtitle, action }: DetailHeaderProps) {
  const navigate = useNavigate();

  return (
    <header className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => navigate(-1)}
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
        <h1 className="truncate text-2xl font-bold">{title}</h1>
        {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
      </div>

      {action}
    </header>
  );
}
