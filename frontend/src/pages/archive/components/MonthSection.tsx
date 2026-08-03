// pages/archive/components/MonthSection.tsx
import type { ReactNode } from 'react';

interface MonthSectionProps {
  /** 'YYYY-MM' */
  month: string;
  children: ReactNode;
}

/** 연-월 제목을 단 첨부 묶음 (파일·사진 목록이 함께 쓴다) */
export default function MonthSection({ month, children }: MonthSectionProps) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold text-muted-foreground">{month}</h3>
      {children}
    </section>
  );
}
