// pages/archive/components/GoalManageSection.tsx
import SettingsRow from '@/pages/settings/components/SettingsRow';
import SettingsSection from '@/pages/settings/components/SettingsSection';

interface GoalManageSectionProps {
  /** 이미 완료된 목표면 완료 처리 항목을 감춘다 */
  isCompleted: boolean;
  onComplete: () => void;
  onClearMessages: () => void;
  onDelete: () => void;
}

/** 목표 완료·대화 삭제·목표 삭제 묶음. 모두 확인 팝업을 거친다 */
export default function GoalManageSection({
  isCompleted,
  onComplete,
  onClearMessages,
  onDelete,
}: GoalManageSectionProps) {
  return (
    <SettingsSection title="목표 관리">
      {!isCompleted && (
        <SettingsRow
          label="목표 완료 처리"
          description="진도를 100%로 바꾸고 완주로 기록해요"
          onClick={onComplete}
        />
      )}
      <SettingsRow
        label="대화 내용 삭제"
        description="목표는 그대로 두고 주고받은 메시지만 지워요"
        onClick={onClearMessages}
      />
      <SettingsRow label="목표 삭제" isDestructive onClick={onDelete} />
    </SettingsSection>
  );
}
