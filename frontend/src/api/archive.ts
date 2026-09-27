// api/archive.ts
import api from './axios';
import type { Attachment, AttachmentKind, GoalProgress } from '@/types/archive';

/**
 * 목표(채팅방)에서 주고받은 첨부 목록.
 * @param kind 'file'이면 문서, 'image'면 사진
 */
export async function fetchAttachments(
  goalId: string,
  kind: AttachmentKind,
): Promise<Attachment[]> {
  if (!goalId) throw new Error('GOAL_NOT_FOUND');
  const { data } = await api.get<Attachment[]>(`/goals/${goalId}/attachments`, {
    params: { kind },
  });
  return data;
}

/** 목표의 진도 로드맵 */
export async function fetchGoalProgress(goalId: string): Promise<GoalProgress> {
  if (!goalId) throw new Error('GOAL_NOT_FOUND');
  const { data } = await api.get<GoalProgress>(`/goals/${goalId}/progress`);
  return data;
}
