// components/DetailHeader.tsx
import { useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface DetailHeaderProps {
  title: string;
  /** 제목 아래 작은 보조 문구 */
  subtitle?: string;
  /** 오른쪽에 붙는 액션 버튼 */
  action?: ReactNode;
  /** 뒤로가기 동작. 기본은 이전 화면으로 */
  onBack?: () => void;
  className?: string;
}

/**
 * 탭바 없이 전체 화면을 쓰는 하위 화면(채팅방·모아보기·설정 등)의 공통 상단 헤더.
 * 뒤로가기 + 제목(+부제) + 액션으로 구성되고 아래 경계선이 붙는다.
 */
export default function DetailHeader({
  title,
  subtitle,
  action,
  onBack,
  className,
}: DetailHeaderProps) {
  const navigate = useNavigate();

  return (
    <header
      className={cn(
        'flex shrink-0 items-center gap-2 border-b border-border bg-background py-2.5',
        className,
      )}
    >
      <button
        type="button"
        onClick={onBack ?? (() => navigate(-1))}
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

      {action}
    </header>
  );
}
