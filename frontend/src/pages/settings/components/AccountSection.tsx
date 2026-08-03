// pages/settings/components/AccountSection.tsx
import Chevron from '@/pages/settings/components/Chevron';
import SettingsRow from '@/pages/settings/components/SettingsRow';
import SettingsSection from '@/pages/settings/components/SettingsSection';
import type { SocialProvider } from '@/types/settings';

/** 소셜 로그인 표시 이름 */
const PROVIDER_LABELS: Record<SocialProvider, string> = { kakao: '카카오', google: '구글' };

interface AccountSectionProps {
  email?: string;
  linkedProviders: SocialProvider[];
  onChangePassword: () => void;
}

/** 계정 설정 묶음. 이메일 표시 · 비밀번호 변경 · 연결된 소셜 계정 */
export default function AccountSection({
  email,
  linkedProviders,
  onChangePassword,
}: AccountSectionProps) {
  return (
    <SettingsSection title="계정">
      <SettingsRow
        label="이메일"
        control={<span className="text-sm text-muted-foreground">{email ?? '-'}</span>}
      />
      <SettingsRow label="비밀번호 변경" onClick={onChangePassword} control={<Chevron />} />
      <SettingsRow
        label="연결된 계정"
        control={
          <span className="text-sm text-muted-foreground">
            {linkedProviders.length > 0
              ? linkedProviders.map((provider) => PROVIDER_LABELS[provider]).join(', ')
              : '없음'}
          </span>
        }
      />
    </SettingsSection>
  );
}
