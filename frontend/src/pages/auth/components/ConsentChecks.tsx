// pages/auth/components/ConsentChecks.tsx
import type { ReactNode } from 'react';
import { PRIVACY_URL, TERMS_URL } from '@/constants/app';
import type { Consents } from '@/pages/auth/consents';

const ITEMS: { key: keyof Consents; label: string; required: boolean; url?: string }[] = [
  { key: 'agreedToTerms', label: '이용약관 동의', required: true, url: TERMS_URL },
  { key: 'agreedToPrivacy', label: '개인정보 처리방침 동의', required: true, url: PRIVACY_URL },
  { key: 'isOver14', label: '만 14세 이상입니다', required: true },
  { key: 'agreedToMarketing', label: '광고성 정보 수신 동의', required: false },
];

interface CheckProps {
  checked: boolean;
  onToggle: () => void;
  children: ReactNode;
}

function Check({ checked, onToggle, children }: CheckProps) {
  return (
    <label className="flex items-center gap-2.5 py-1.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="size-4 shrink-0 accent-primary"
      />
      <span className="min-w-0 flex-1 text-sm">{children}</span>
    </label>
  );
}

interface ConsentChecksProps {
  value: Consents;
  onChange: (next: Consents) => void;
}

export default function ConsentChecks({ value, onChange }: ConsentChecksProps) {
  const isAllChecked = ITEMS.every(({ key }) => value[key]);

  const toggleAll = () => {
    const next = !isAllChecked;
    onChange({
      agreedToTerms: next,
      agreedToPrivacy: next,
      isOver14: next,
      agreedToMarketing: next,
    });
  };

  return (
    <div className="mt-6">
      <Check checked={isAllChecked} onToggle={toggleAll}>
        <span className="font-semibold">전체 동의</span>
      </Check>

      <div className="mt-1 border-t border-border pt-1 pl-1">
        {ITEMS.map(({ key, label, required, url }) => (
          <Check
            key={key}
            checked={value[key]}
            onToggle={() => onChange({ ...value, [key]: !value[key] })}
          >
            <span className="text-muted-foreground">[{required ? '필수' : '선택'}] </span>
            {label}
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                // 라벨 안의 링크다. 누르면 체크까지 토글되지 않게 막는다
                onClick={(event) => event.stopPropagation()}
                className="ml-1 text-xs text-primary underline underline-offset-2"
              >
                보기
              </a>
            )}
          </Check>
        ))}
      </div>
    </div>
  );
}
