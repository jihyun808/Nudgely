// pages/settings/components/AppInfoSection.tsx
import { useNavigate } from 'react-router-dom';
import { APP_VERSION } from '@/constants/app';
import Chevron from '@/pages/settings/components/Chevron';
import SettingsRow from '@/pages/settings/components/SettingsRow';
import SettingsSection from '@/pages/settings/components/SettingsSection';

/** 약관·정책 항목. to 가 없는 것은 아직 문서가 없다 */
const DOCUMENT_LINKS: { label: string; to?: string }[] = [
  { label: '이용약관' },
  { label: '개인정보 처리방침' },
  { label: '오픈소스 라이선스', to: '/settings/licenses' },
  { label: '문의하기' },
];

/** 앱 정보 묶음 */
export default function AppInfoSection() {
  const navigate = useNavigate();

  return (
    <SettingsSection title="앱 정보">
      <SettingsRow
        label="버전"
        control={<span className="text-sm text-muted-foreground">{APP_VERSION}</span>}
      />
      {DOCUMENT_LINKS.map(({ label, to }) => (
        <SettingsRow
          key={label}
          label={label}
          control={<Chevron />}
          disabled={!to}
          onClick={to ? () => navigate(to) : undefined}
        />
      ))}
    </SettingsSection>
  );
}
