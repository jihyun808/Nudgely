// pages/archive/components/GoalSettings.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { clearGoalMessages, completeGoal, deleteGoal, updateGoal } from '@/api/goal';
import ConfirmDialog from '@/components/ConfirmDialog';
import { Button } from '@/components/ui/button';
import GoalBasicForm, { type GoalBasicValues } from '@/pages/archive/components/GoalBasicForm';
import GoalManageSection from '@/pages/archive/components/GoalManageSection';
import GoalOptionsSection from '@/pages/archive/components/GoalOptionsSection';
import { showToast } from '@/stores/toastStore';
import type { GoalDetail } from '@/types/goal';

/** 열려 있는 확인 팝업 */
type OpenDialog = 'complete' | 'clearMessages' | 'delete' | null;

interface GoalSettingsProps {
  goal: GoalDetail;
  /** 저장·완료 후 상위 화면의 목표 정보를 갱신한다 */
  onUpdated: (goal: GoalDetail) => void;
}

/**
 * 목표(채팅방) 설정 탭.
 * 기본 정보는 '저장'을 눌러야 반영되고, 기한·알림 토글은 바꾸는 즉시 저장된다.
 */
export default function GoalSettings({ goal, onUpdated }: GoalSettingsProps) {
  const navigate = useNavigate();

  const [basic, setBasic] = useState<GoalBasicValues>({
    name: goal.name,
    title: goal.title ?? '',
    prompt: goal.prompt ?? '',
    imageUrl: goal.imageUrl,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [openDialog, setOpenDialog] = useState<OpenDialog>(null);

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

  /** 기한·알림처럼 바로 반영되는 값. 실패하면 토스트로 알린다 */
  const patchImmediately = (patch: Partial<GoalDetail>) => {
    const previous = goal;
    onUpdated({ ...goal, ...patch });
    void updateGoal(goal.id, patch).catch(() => {
      onUpdated(previous);
      showToast('설정을 저장하지 못했어요', { variant: 'warning' });
    });
  };

  const handleComplete = async () => {
    await completeGoal(goal.id);
    onUpdated({ ...goal, completedAt: new Date().toISOString() });
    showToast('목표를 완료했어요. 수고했어요! 🎉', { variant: 'success' });
  };

  const handleClearMessages = async () => {
    await clearGoalMessages(goal.id);
    showToast('대화 내용을 삭제했어요', { variant: 'info' });
  };

  const handleDelete = async () => {
    await deleteGoal(goal.id);
    showToast('목표를 삭제했어요', { variant: 'info' });
    navigate('/chat', { replace: true });
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
        onClearMessages={() => setOpenDialog('clearMessages')}
        onDelete={() => setOpenDialog('delete')}
      />

      {openDialog === 'complete' && (
        <ConfirmDialog
          title="목표를 완료할까요?"
          description="진도가 100%가 되고 완주한 목표로 기록돼요."
          confirmLabel="완료하기"
          onConfirm={handleComplete}
          onClose={() => setOpenDialog(null)}
        />
      )}

      {openDialog === 'clearMessages' && (
        <ConfirmDialog
          title="대화 내용을 삭제할까요?"
          description="주고받은 메시지가 모두 사라져요. 목표와 기록은 그대로 남아요."
          confirmLabel="삭제하기"
          isDestructive
          onConfirm={handleClearMessages}
          onClose={() => setOpenDialog(null)}
        />
      )}

      {openDialog === 'delete' && (
        <ConfirmDialog
          title="목표를 삭제할까요?"
          description="대화와 투두, 기록이 모두 사라지고 되돌릴 수 없어요."
          confirmLabel="삭제하기"
          isDestructive
          onConfirm={handleDelete}
          onClose={() => setOpenDialog(null)}
        />
      )}
    </div>
  );
}
