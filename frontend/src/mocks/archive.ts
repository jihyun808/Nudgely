// mocks/archive.ts
// API 연동 전 화면 확인용 임시 데이터. 서버 붙이면 src/mocks 폴더째 삭제한다.
import type { Attachment, GoalProgress } from '@/types/archive';

const DAY = 24 * 60 * 60 * 1000;
const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString();

export const MOCK_ATTACHMENTS: Attachment[] = [
  { id: 'f1', kind: 'file', name: '20강_요약노트.pdf', sizeBytes: 1_258_291, uploadedAt: ago(0) },
  { id: 'f2', kind: 'file', name: '19강_실습코드.zip', sizeBytes: 348_160, uploadedAt: ago(1) },
  {
    id: 'f3',
    kind: 'file',
    name: '18강_와이어프레임.ppt',
    sizeBytes: 2_936_012,
    uploadedAt: ago(4),
  },
  { id: 'f4', kind: 'file', name: '17강_정리.pdf', sizeBytes: 842_000, uploadedAt: ago(38) },
  { id: 'f5', kind: 'file', name: '스터디_계획표.xlsx', sizeBytes: 42_100, uploadedAt: ago(70) },

  { id: 'm1', kind: 'image', name: '노트_인증.jpg', sizeBytes: 2_100_000, uploadedAt: ago(0) },
  { id: 'm2', kind: 'image', name: '강의_화면.png', sizeBytes: 1_450_000, uploadedAt: ago(2) },
  { id: 'm3', kind: 'image', name: '스터디룸.jpg', sizeBytes: 3_300_000, uploadedAt: ago(3) },
  { id: 'm4', kind: 'image', name: '오답_정리.png', sizeBytes: 1_120_000, uploadedAt: ago(35) },
  { id: 'm5', kind: 'image', name: '필기_정리.jpg', sizeBytes: 980_000, uploadedAt: ago(41) },
];

/** 진행 중인 목표 (1번) */
export const MOCK_GOAL_PROGRESS: GoalProgress = {
  goalId: '1',
  goalTitle: 'UI/UX 디자인 강의 완주',
  startedAt: ago(60),
  milestones: [
    { id: 'p1', title: '6월까지 기초 10강 완료', status: 'done' },
    { id: 'p2', title: '7월까지 20강 완료', status: 'done' },
    { id: 'p3', title: '8월까지 실습 과제 3개 제출', status: 'current' },
    { id: 'p4', title: '9월까지 40강 완료', status: 'upcoming' },
    { id: 'p5', title: '10월까지 전체 50강 완주', status: 'upcoming' },
  ],
  focusedSeconds: 151_200,
  completedTodoCount: 64,
  bestMonth: '2026-07',
};

/** 이미 끝난 목표 (2번). 완료 화면 확인용 */
export const MOCK_COMPLETED_PROGRESS: GoalProgress = {
  goalId: '2',
  goalTitle: '매일 영어 단어 30개 외우기',
  startedAt: ago(96),
  completedAt: ago(6),
  milestones: [
    { id: 'c1', title: '1주차 · 기초 단어 200개', status: 'done' },
    { id: 'c2', title: '2~4주차 · 하루 30개 습관 만들기', status: 'done' },
    { id: 'c3', title: '2개월차 · 문장으로 복습하기', status: 'done' },
    { id: 'c4', title: '3개월차 · 900개 전체 복습 완료', status: 'done' },
  ],
  focusedSeconds: 205_200,
  completedTodoCount: 87,
  bestMonth: '2026-06',
};
