// pages/goalSettings/components/GoalManageDialogs.tsx
import ConfirmDialog from '@/components/ConfirmDialog';

/** 목표 관리에서 열 수 있는 확인 팝업 */
export type GoalDialog = 'complete' | 'hide' | 'clearMessages' | 'delete' | null;

interface GoalManageDialogsProps {
  openDialog: GoalDialog;
  onClose: () => void;
  onComplete: () => Promise<void>;
  onHide: () => Promise<void>;
  onClearMessages: () => Promise<void>;
  onDelete: () => Promise<void>;
}

/** 목표 완료·숨기기·대화 삭제·목표 삭제 확인 팝업 모음 */
export default function GoalManageDialogs({
  openDialog,
  onClose,
  onComplete,
  onHide,
  onClearMessages,
  onDelete,
}: GoalManageDialogsProps) {
  if (openDialog === 'complete') {
    return (
      <ConfirmDialog
        title="목표를 완료할까요?"
        description="진도가 100%가 되고 완주한 목표로 기록돼요."
        confirmLabel="완료하기"
        onConfirm={onComplete}
        onClose={onClose}
      />
    );
  }

  if (openDialog === 'hide') {
    return (
      <ConfirmDialog
        title="채팅방을 숨길까요?"
        description="채팅 목록에서 사라지지만 대화와 기록은 그대로 남아요. 설정 > 히스토리에서 다시 꺼낼 수 있어요."
        confirmLabel="숨기기"
        onConfirm={onHide}
        onClose={onClose}
      />
    );
  }

  if (openDialog === 'clearMessages') {
    return (
      <ConfirmDialog
        title="대화 내용을 삭제할까요?"
        description="주고받은 메시지가 모두 사라져요. 목표와 기록은 그대로 남아요."
        confirmLabel="삭제하기"
        isDestructive
        onConfirm={onClearMessages}
        onClose={onClose}
      />
    );
  }

  if (openDialog === 'delete') {
    return (
      <ConfirmDialog
        title="목표를 삭제할까요?"
        description="대화와 투두, 기록이 모두 사라지고 되돌릴 수 없어요."
        confirmLabel="삭제하기"
        isDestructive
        onConfirm={onDelete}
        onClose={onClose}
      />
    );
  }

  return null;
}
