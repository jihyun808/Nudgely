// mocks/goals.ts
// API 연동 전 화면 확인용 임시 데이터. 서버 붙이면 src/mocks 폴더째 삭제한다.
// 채팅 목록과 홈의 '진행 중인 목표'가 이 하나의 목록을 함께 쓴다.
import type { GoalDetail } from '@/types/goal';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

export const MOCK_GOALS: GoalDetail[] = [
  {
    id: '1',
    name: 'Buddy',
    title: 'UI/UX 디자인 강의 완주',
    prompt: '학습 코치처럼 다정하지만 단호하게 챙겨줘.',
    lastMessage: '오늘 UI/UX 5강 완료 예정이야! 집중해보자',
    lastMessageAt: ago(1 * MINUTE),
    unreadCount: 2,
    remainingDays: 22,
    progress: { current: 21, total: 50, unit: '강' },
  },
  {
    id: '2',
    name: '영어 코치',
    title: '매일 영어 단어 30개 외우기',
    lastMessage: '어제 외운 단어 10개 복습부터 시작할까?',
    lastMessageAt: ago(12 * MINUTE),
    unreadCount: 1,
    progress: { current: 12, total: 30, unit: '일' },
  },
  {
    id: '3',
    name: '알고리즘 짝',
    title: '알고리즘 하루 한 문제 풀기',
    lastMessage: 'DP 문제 하나 더 풀어볼래? 힌트 줄게',
    lastMessageAt: ago(3 * HOUR),
    unreadCount: 0,
    remainingDays: 60,
    progress: { current: 34, total: 100, unit: '문제' },
  },
  {
    id: '4',
    name: '운동 트레이너',
    title: '주 3회 홈트 루틴 지키기',
    lastMessage: '오늘 스트레칭 5분이라도 해보자!',
    lastMessageAt: ago(1 * DAY),
    unreadCount: 0,
  },
  {
    id: '5',
    name: '회고 도우미',
    title: '매주 회고 남기기',
    lastMessage: '이번 주 집중 시간 2시간 넘겼어. 잘하고 있어',
    lastMessageAt: ago(4 * DAY),
    unreadCount: 5,
  },
  {
    id: '6',
    name: '독서 메이트',
    title: '이번 달 책 1권 읽기',
    lastMessage: '지난주에 읽던 책 이어서 볼까?',
    lastMessageAt: ago(10 * DAY),
    unreadCount: 0,
  },
];
