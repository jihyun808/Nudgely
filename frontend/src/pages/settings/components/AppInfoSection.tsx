// pages/settings/components/AppInfoSection.tsx
import { APP_VERSION } from '@/mocks/settings';
import Chevron from '@/pages/settings/components/Chevron';
import SettingsRow from '@/pages/settings/components/SettingsRow';
import SettingsSection from '@/pages/settings/components/SettingsSection';

/** 약관·정책 항목. TODO: 페이지가 준비되면 링크를 연결한다 */
const DOCUMENT_LINKS = ['이용약관', '개인정보 처리방침', '오픈소스 라이선스', '문의하기'];

/** 앱 정보 묶음 */
export default function AppInfoSection() {
  return (
    <SettingsSection title="앱 정보">
      <SettingsRow
        label="버전"
        control={<span className="text-sm text-muted-foreground">{APP_VERSION}</span>}
      />
      {DOCUMENT_LINKS.map((label) => (
        <SettingsRow key={label} label={label} control={<Chevron />} />
      ))}
    </SettingsSection>
  );
}
