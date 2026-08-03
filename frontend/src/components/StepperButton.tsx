// components/StepperButton.tsx
import { cn } from '@/lib/utils';

interface StepperButtonProps {
  direction: 'prev' | 'next';
  onClick: () => void;
  disabled?: boolean;
  /** 스크린리더용 설명 (예: '이전 달') */
  label: string;
  className?: string;
}

/** 달·주·날짜를 앞뒤로 넘기는 화살표 버튼 (캘린더·플래너·주간 집중 공용) */
export default function StepperButton({
  direction,
  onClick,
  disabled,
  label,
  className,
}: StepperButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted-foreground/8 text-muted-foreground transition-colors active:bg-muted-foreground/15 disabled:opacity-30',
        className,
      )}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4"
      >
        <path d={direction === 'prev' ? 'm15 18-6-6 6-6' : 'm9 6 6 6-6 6'} />
      </svg>
    </button>
  );
}
