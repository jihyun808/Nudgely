// pages/settings/components/HistorySection.tsx
import { useNavigate } from 'react-router-dom';
import Chevron from '@/pages/settings/components/Chevron';
import SettingsRow from '@/pages/settings/components/SettingsRow';
import SettingsSection from '@/pages/settings/components/SettingsSection';

/** 숨긴 채팅방을 다시 볼 수 있는 히스토리로 가는 묶음 */
export default function HistorySection() {
  const navigate = useNavigate();

  return (
    <SettingsSection title="보관함">
      <SettingsRow
        label="히스토리"
        description="숨긴 채팅방을 모아볼 수 있어요"
        onClick={() => navigate('/settings/history')}
        control={<Chevron />}
      />
    </SettingsSection>
  );
}
