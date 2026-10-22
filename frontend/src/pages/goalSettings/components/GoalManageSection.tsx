// pages/goalSettings/components/GoalManageSection.tsx
import SettingsRow from '@/pages/settings/components/SettingsRow';
import SettingsSection from '@/pages/settings/components/SettingsSection';

interface GoalManageSectionProps {
  /** 이미 완료된 목표면 완료 처리 항목을 감춘다 */
  isCompleted: boolean;
  onComplete: () => void;
  onHide: () => void;
  onClearMessages: () => void;
  onDelete: () => void;
}

/** 목표 완료·숨기기·대화 삭제·목표 삭제 묶음. 모두 확인 팝업을 거친다 */
export default function GoalManageSection({
  isCompleted,
  onComplete,
  onHide,
  onClearMessages,
  onDelete,
}: GoalManageSectionProps) {
  return (
    <SettingsSection title="목표 관리">
      {!isCompleted && <SettingsRow label="목표 완료 처리" onClick={onComplete} />}
      <SettingsRow label="채팅방 숨기기" onClick={onHide} />
      <SettingsRow label="대화 내용 삭제" onClick={onClearMessages} />
      <SettingsRow label="목표 삭제" isDestructive onClick={onDelete} />
    </SettingsSection>
  );
}
