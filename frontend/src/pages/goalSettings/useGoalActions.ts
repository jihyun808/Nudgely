// pages/goalSettings/useGoalActions.ts
import { useNavigate } from 'react-router-dom';
import { clearGoalMessages, completeGoal, deleteGoal, updateGoal } from '@/api/goal';
import { showToast } from '@/stores/toastStore';
import type { GoalDetail } from '@/types/goal';

/**
 * 목표 관리 동작 모음 (완료·숨기기·대화 삭제·목표 삭제).
 * 성공하면 토스트로 알리고, 목록에서 사라지는 동작은 채팅 탭으로 돌려보낸다.
 */
export function useGoalActions(goal: GoalDetail, onUpdated: (goal: GoalDetail) => void) {
  const navigate = useNavigate();

  const complete = async () => {
    await completeGoal(goal.id);
    onUpdated({ ...goal, completedAt: new Date().toISOString() });
    showToast('목표를 완료했어요. 수고했어요! 🎉', { variant: 'success' });
  };

  const hide = async () => {
    await updateGoal(goal.id, { isHidden: true });
    showToast('채팅방을 숨겼어요. 설정 > 히스토리에서 볼 수 있어요', { variant: 'info' });
    navigate('/chat', { replace: true });
  };

  const clearMessages = async () => {
    await clearGoalMessages(goal.id);
    showToast('대화 내용을 삭제했어요', { variant: 'info' });
  };

  const remove = async () => {
    await deleteGoal(goal.id);
    showToast('목표를 삭제했어요', { variant: 'info' });
    navigate('/chat', { replace: true });
  };

  return { complete, hide, clearMessages, remove };
}
