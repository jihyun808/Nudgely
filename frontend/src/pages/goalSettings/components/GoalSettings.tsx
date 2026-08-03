// pages/goalSettings/components/GoalSettings.tsx
import { useState } from 'react';
import { updateGoal } from '@/api/goal';
import { Button } from '@/components/ui/button';
import GoalBasicForm, { type GoalBasicValues } from '@/pages/goalSettings/components/GoalBasicForm';
import GoalManageDialogs, {
  type GoalDialog,
} from '@/pages/goalSettings/components/GoalManageDialogs';
import GoalManageSection from '@/pages/goalSettings/components/GoalManageSection';
import GoalOptionsSection from '@/pages/goalSettings/components/GoalOptionsSection';
import { useGoalActions } from '@/pages/goalSettings/useGoalActions';
import { showToast } from '@/stores/toastStore';
import type { GoalDetail } from '@/types/goal';

interface GoalSettingsProps {
  goal: GoalDetail;
  /** 저장·완료 후 상위 화면의 목표 정보를 갱신한다 */
  onUpdated: (goal: GoalDetail) => void;
}

/**
 * 목표(채팅방) 설정 본문.
 * 기본 정보는 '저장'을 눌러야 반영되고, 기한·알림 토글은 바꾸는 즉시 저장된다.
 */
export default function GoalSettings({ goal, onUpdated }: GoalSettingsProps) {
  const [basic, setBasic] = useState<GoalBasicValues>({
    name: goal.name,
    title: goal.title ?? '',
    prompt: goal.prompt ?? '',
    imageUrl: goal.imageUrl,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [openDialog, setOpenDialog] = useState<GoalDialog>(null);
  const actions = useGoalActions(goal, onUpdated);

  /** 기본 정보에 바뀐 값이 있는지 (있을 때만 저장 버튼이 살아난다) */
  const isDirty =
    basic.name !== goal.name ||
    basic.title !== (goal.title ?? '') ||
    basic.prompt !== (goal.prompt ?? '') ||
    basic.imageUrl !== goal.imageUrl;

  const handleSave = async () => {
    if (!isDirty || !basic.name.trim() || isSaving) return;
    setIsSaving(true);
    try {
      onUpdated(
        await updateGoal(goal.id, {
          name: basic.name.trim(),
          title: basic.title.trim(),
          prompt: basic.prompt.trim(),
          imageUrl: basic.imageUrl,
        }),
      );
      showToast('목표 정보를 저장했어요', { variant: 'success' });
    } catch {
      showToast('저장하지 못했어요', { variant: 'warning' });
    } finally {
      setIsSaving(false);
    }
  };

  /** 기한·알림처럼 바로 반영되는 값. 실패하면 되돌리고 토스트로 알린다 */
  const patchImmediately = (patch: Partial<GoalDetail>) => {
    const previous = goal;
    onUpdated({ ...goal, ...patch });
    void updateGoal(goal.id, patch).catch(() => {
      onUpdated(previous);
      showToast('설정을 저장하지 못했어요', { variant: 'warning' });
    });
  };

  return (
    <div>
      <GoalBasicForm values={basic} onChange={setBasic} />

      <Button
        className="mt-3 w-full"
        onClick={() => void handleSave()}
        disabled={!isDirty || !basic.name.trim() || isSaving}
      >
        {isSaving ? '저장 중...' : '저장'}
      </Button>

      <GoalOptionsSection
        goal={goal}
        dueDate={goal.dueDate ?? ''}
        onChangeDueDate={(dueDate) => patchImmediately({ dueDate })}
        onToggleMute={(isNotificationMuted) => patchImmediately({ isNotificationMuted })}
      />

      <GoalManageSection
        isCompleted={Boolean(goal.completedAt)}
        onComplete={() => setOpenDialog('complete')}
        onHide={() => setOpenDialog('hide')}
        onClearMessages={() => setOpenDialog('clearMessages')}
        onDelete={() => setOpenDialog('delete')}
      />

      <GoalManageDialogs
        openDialog={openDialog}
        onClose={() => setOpenDialog(null)}
        onComplete={actions.complete}
        onHide={actions.hide}
        onClearMessages={actions.clearMessages}
        onDelete={actions.remove}
      />
    </div>
  );
}
