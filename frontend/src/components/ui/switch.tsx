import { cn } from '@/lib/utils';

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  /** 스크린리더용 설명 (라벨이 따로 있을 때 생략 가능) */
  'aria-label'?: string;
}

/** 켜고 끄는 토글 스위치. 켜지면 브랜드 색으로 채워진다 */
function Switch({ checked, onChange, disabled, ...props }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-6 w-11 shrink-0 rounded-full transition-colors',
        checked ? 'bg-primary' : 'bg-muted-foreground/25',
        disabled && 'opacity-40',
      )}
      {...props}
    >
      <span
        aria-hidden
        className={cn(
          'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-background shadow-sm transition-transform',
          checked && 'translate-x-5',
        )}
      />
    </button>
  );
}

export { Switch };
