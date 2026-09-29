// pages/settings/components/AppInfoSection.tsx
import { APP_VERSION, PRIVACY_URL, TERMS_URL } from '@/constants/app';
import Chevron from '@/pages/settings/components/Chevron';
import SettingsRow from '@/pages/settings/components/SettingsRow';
import SettingsSection from '@/pages/settings/components/SettingsSection';

/** 약관·정책 항목. url 이 없는 것은 아직 문서가 없다 */
const DOCUMENT_LINKS: { label: string; url?: string }[] = [
  { label: '이용약관', url: TERMS_URL },
  { label: '개인정보 처리방침', url: PRIVACY_URL },
  { label: '오픈소스 라이선스' },
  { label: '문의하기' },
];

/** 앱 정보 묶음 */
export default function AppInfoSection() {
  return (
    <SettingsSection title="앱 정보">
      <SettingsRow
        label="버전"
        control={<span className="text-sm text-muted-foreground">{APP_VERSION}</span>}
      />
      {DOCUMENT_LINKS.map(({ label, url }) => (
        <SettingsRow
          key={label}
          label={label}
          control={<Chevron />}
          disabled={!url}
          onClick={url ? () => window.open(url, '_blank', 'noopener') : undefined}
        />
      ))}
    </SettingsSection>
  );
}
