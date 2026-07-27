// pages/chat/mockMessages.ts
// API 연동 전 화면 확인용 임시 데이터. 서버 붙이면 이 파일은 삭제한다.
import type { ChatMessage } from '@/types/chat';

/** 오늘 날짜의 특정 시각으로 ISO 문자열 만들기 */
const todayAt = (hour: number, minute: number) => {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
};

export const MOCK_MESSAGES: ChatMessage[] = [
  {
    id: 'm1',
    role: 'assistant',
    content: '지수야, 오늘 21강 들을 차례야. 준비됐어?',
    createdAt: todayAt(9, 0),
  },
  {
    id: 'm2',
    role: 'user',
    content: '응! 근데 20강 복습하고 싶어',
    createdAt: todayAt(9, 2),
  },
  {
    id: 'm3',
    role: 'user',
    content: '',
    createdAt: todayAt(9, 3),
    file: { name: '20강_요약노트.pdf', caption: '분석 완료' },
  },
  {
    id: 'm4',
    role: 'assistant',
    content: '정리 잘했어! 핵심 개념 시각화가 특히 좋아.',
    createdAt: todayAt(9, 5),
  },
  {
    id: 'm5',
    role: 'assistant',
    content: '퀴즈 3문항 중 2개 맞혔어. 오답 복습할까?',
    createdAt: todayAt(9, 6),
  },
  {
    id: 'm6',
    role: 'user',
    content: '나중에 볼게, 이따 모아보기에서',
    createdAt: todayAt(9, 7),
  },
];
