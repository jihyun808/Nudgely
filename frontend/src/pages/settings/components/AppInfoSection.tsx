// pages/settings/components/AppInfoSection.tsx
  import { useNavigate } from 'react-router-dom';
  import { APP_VERSION, PRIVACY_URL, TERMS_URL } from '@/constants/app';
  import Chevron from '@/pages/settings/components/Chevron';
  import SettingsRow from '@/pages/settings/components/SettingsRow';
  import SettingsSection from '@/pages/settings/components/SettingsSection';

** url 은 외부 문서, to 는 앱 안 화면. 둘 다 없으면 아직 준비되지 않은 것 */
  const DOCUMENT_LINKS: { label: string; url?: string; to?: string }[] = [
    { label: '이용약관', url: TERMS_URL },
    { label: '개인정보 처리방침', url: PRIVACY_URL },
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
          control={<span className="text-sm 
  text-muted-foreground">{APP_VERSION}</span>}
        />
        {DOCUMENT_LINKS.map(({ label, url, to }) => (
          <SettingsRow
            key={label}
            label={label}
            control={<Chevron />}
            disabled={!url && !to}
            onClick={
              to ? () => navigate(to) : url ? () => window.open(url, '_blank',
  'noopener') : undefined
            }
          />
        ))}
      </SettingsSection>
    );
  }        