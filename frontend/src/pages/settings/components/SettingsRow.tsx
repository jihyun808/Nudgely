// pages/settings/components/SettingsRow.tsx
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SettingsRowProps {
  label: string;
  /** 라벨 아래 붙는 보조 설명 */
  description?: string;
  /** 오른쪽에 놓을 요소 (스위치, 값, 화살표 등) */
  control?: ReactNode;
  /** 행 전체를 누를 수 있게 할 때 */
  onClick?: () => void;
  /** 들여쓰기 (전체 알림 아래 하위 항목 등) */
  isNested?: boolean;
  /** 되돌릴 수 없는 동작(탈퇴 등)은 빨간 글씨로 */
  isDestructive?: boolean;
  disabled?: boolean;
}

/** 설정 항목 한 줄. 왼쪽 라벨 + 오른쪽 컨트롤 */
export default function SettingsRow({
  label,
  description,
  control,
  onClick,
  isNested,
  isDestructive,
  disabled,
}: SettingsRowProps) {
  const content = (
    <>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'block text-sm',
            isDestructive ? 'text-destructive' : 'text-foreground',
            disabled && 'opacity-40',
          )}
        >
          {label}
        </span>
        {description && (
          <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span>
        )}
      </span>
      {control}
    </>
  );

  const className = cn('flex w-full items-center gap-3 px-4 py-3.5 text-left', isNested && 'pl-8');

  if (!onClick) return <div className={className}>{content}</div>;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(className, 'transition-colors active:bg-muted-foreground/5')}
    >
      {content}
    </button>
  );
}
