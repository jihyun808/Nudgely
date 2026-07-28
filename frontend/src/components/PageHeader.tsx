// components/PageHeader.tsx
import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  /** 오른쪽에 붙는 액션 버튼 (없으면 제목만) */
  action?: ReactNode;
}

/** 하단 탭 화면들(홈·채팅·기록 등)의 공통 상단 헤더 */
export default function PageHeader({ title, action }: PageHeaderProps) {
  return (
    <header className="flex min-h-9 items-center justify-between gap-2">
      <h1 className="min-w-0 truncate text-2xl font-bold">{title}</h1>
      {action}
    </header>
  );
}
