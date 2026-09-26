// pages/goalSettings/components/GoalOptionsSection.tsx
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import SettingsRow from '@/pages/settings/components/SettingsRow';
import SettingsSection from '@/pages/settings/components/SettingsSection';
import ProgressEditor from '@/pages/goalSettings/components/ProgressEditor';
import type { GoalDetail, GoalProgressAmount } from '@/types/goal';

interface GoalOptionsSectionProps {
  goal: GoalDetail;
  dueDate: string;
  onChangeDueDate: (dueDate: string) => void;
  onChangeProgress: (progress: GoalProgressAmount) => void;
  onToggleMute: (isMuted: boolean) => void;
}

/** 기한 · 진도 · 알림 설정 묶음 */
export default function GoalOptionsSection({
  goal,
  dueDate,
  onChangeDueDate,
  onChangeProgress,
  onToggleMute,
}: GoalOptionsSectionProps) {
  const { progress, isNotificationMuted, completedAt } = goal;
  /** 완주한 목표에는 알림·선톡이 오지 않으므로 토글을 잠근다 */
  const isCompleted = Boolean(completedAt);

  return (
    <>
      <SettingsSection title="목표">
        <SettingsRow
          label="기한"
          description="설정하면 홈 목표 카드에 D-day가 표시돼요"
          control={
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => onChangeDueDate(e.target.value)}
              aria-label="목표 기한"
              className="h-9 w-auto"
            />
          }
        />
        <SettingsRow
          label="진도"
          description="AI와 대화하면서 갱신돼요. 틀렸으면 직접 고칠 수 있어요"
          control={
            <ProgressEditor
              // 저장 뒤 서버가 잘라낸 값이 내려오면 입력칸을 새로 그린다
              key={`${progress?.current}-${progress?.total}-${progress?.unit}`}
              progress={progress}
              onCommit={onChangeProgress}
            />
          }
        />
      </SettingsSection>

      <SettingsSection title="알림">
        <SettingsRow
          label="이 목표 알림 끄기"
          description={
            isCompleted
              ? '완주한 목표라 알림과 선톡이 오지 않아요'
              : '이 방의 선톡·독촉 알림만 받지 않아요'
          }
          disabled={isCompleted}
          control={
            <Switch
              checked={isCompleted || Boolean(isNotificationMuted)}
              disabled={isCompleted}
              onChange={onToggleMute}
              aria-label="이 목표 알림 끄기"
            />
          }
        />
      </SettingsSection>
    </>
  );
}
