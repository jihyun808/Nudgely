// api/archive.ts
import { MOCK_ATTACHMENTS, MOCK_COMPLETED_PROGRESS, MOCK_GOAL_PROGRESS } from '@/mocks/archive';
import type { Attachment, AttachmentKind, GoalProgress } from '@/types/archive';

/** mock 지연 (연동 시 삭제) */
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 목표(채팅방)에서 주고받은 첨부 목록.
 * @param kind 'file'이면 문서, 'image'면 사진
 * TODO: `api.get<Attachment[]>(`/goals/${goalId}/attachments`, { params: { kind } })`로 교체.
 */
export async function fetchAttachments(
  goalId: string,
  kind: AttachmentKind,
): Promise<Attachment[]> {
  if (!goalId) throw new Error('GOAL_NOT_FOUND');
  await delay(400);
  return MOCK_ATTACHMENTS.filter((attachment) => attachment.kind === kind);
}

/**
 * 목표의 진도 로드맵.
 * TODO: `api.get<GoalProgress>(`/goals/${goalId}/progress`)`로 교체.
 */
export async function fetchGoalProgress(goalId: string): Promise<GoalProgress> {
  if (!goalId) throw new Error('GOAL_NOT_FOUND');
  await delay(400);
  // mock: 2번 목표는 이미 끝난 목표로 돌려준다 (완료 화면 확인용)
  return goalId === '2' ? MOCK_COMPLETED_PROGRESS : MOCK_GOAL_PROGRESS;
}
