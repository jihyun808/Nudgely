// components/Skeleton.tsx
import { cn } from '@/lib/utils';

interface SkeletonProps {
  /** 높이 등 크기를 정하는 클래스 (예: 'h-28') */
  className?: string;
}

/** 데이터를 불러오는 동안 자리를 잡아두는 회색 상자 */
export default function Skeleton({ className }: SkeletonProps) {
  return <div className={cn('animate-pulse rounded-2xl bg-muted-foreground/8', className)} />;
}
