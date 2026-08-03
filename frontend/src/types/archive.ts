// types/archive.ts

/** 모아보기에 쌓이는 첨부 종류. 동영상은 받지 않는다(용량이 커서 제외) */
export type AttachmentKind = 'file' | 'image';

/** 채팅에서 주고받은 첨부 하나 */
export interface Attachment {
  id: string;
  kind: AttachmentKind;
  name: string;
  /** 파일 크기(byte) */
  sizeBytes: number;
  /** 올린 시각 (ISO 8601). 연-월로 묶는 기준 */
  uploadedAt: string;
  /** 다운로드·미리보기 URL (사진은 썸네일) */
  url?: string;
}

/** 진도 로드맵의 한 지점 */
export interface ProgressMilestone {
  id: string;
  /** 예: '7월까지 20강 완료' */
  title: string;
  /** 완료 / 진행 중 / 예정 */
  status: 'done' | 'current' | 'upcoming';
}

/** 목표 하나의 진도 로드맵 */
export interface GoalProgress {
  goalId: string;
  /** 목표 이름 (Goal.title) */
  goalTitle: string;
  /** 목표를 시작한 날 (ISO 8601) */
  startedAt: string;
  /** 목표를 끝낸 날. 아직 진행 중이면 없다 */
  completedAt?: string;
  milestones: ProgressMilestone[];

  /** 이 목표에 쓴 집중 시간(초). 집중 세션에 목표 id가 붙어야 계산할 수 있다 */
  focusedSeconds?: number;
  /** 이 목표에서 완료한 투두 개수 */
  completedTodoCount?: number;
  /** 가장 많이 집중한 달 (YYYY-MM) */
  bestMonth?: string;
}
