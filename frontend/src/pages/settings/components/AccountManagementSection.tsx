// pages/settings/components/AccountManagementSection.tsx
import SettingsRow from '@/pages/settings/components/SettingsRow';
import SettingsSection from '@/pages/settings/components/SettingsSection';

interface AccountManagementSectionProps {
  onLogout: () => void;
  onWithdraw: () => void;
}

/** 로그아웃·회원 탈퇴 묶음. 둘 다 확인 팝업을 거친다 */
export default function AccountManagementSection({
  onLogout,
  onWithdraw,
}: AccountManagementSectionProps) {
  return (
    <SettingsSection title="계정 관리">
      <SettingsRow label="로그아웃" onClick={onLogout} />
      <SettingsRow label="회원 탈퇴" isDestructive onClick={onWithdraw} />
    </SettingsSection>
  );
}
