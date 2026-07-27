// pages/chat/mockChatRooms.ts
// API 연동 전 화면 확인용 임시 데이터. 서버 붙이면 이 파일은 삭제한다.
import type { ChatRoomDetail } from '@/types/chat';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

export const MOCK_CHAT_ROOMS: ChatRoomDetail[] = [
  {
    id: '1',
    name: 'Buddy',
    description: '온라인 · UI/UX 강의 관리 중',
    lastMessage: '오늘 UI/UX 5강 완료 예정이야! 집중해보자',
    lastMessageAt: ago(1 * MINUTE),
    unreadCount: 2,
  },
  {
    id: '2',
    name: '영어 코치',
    description: '매일 단어 10개 암기 중',
    lastMessage: '어제 외운 단어 10개 복습부터 시작할까?',
    lastMessageAt: ago(12 * MINUTE),
    unreadCount: 1,
  },
  {
    id: '3',
    name: '알고리즘 짝',
    description: 'DP 유형 집중 훈련 중',
    lastMessage: 'DP 문제 하나 더 풀어볼래? 힌트 줄게',
    lastMessageAt: ago(3 * HOUR),
    unreadCount: 0,
  },
  {
    id: '4',
    name: '운동 트레이너',
    description: '주 3회 홈트 루틴 중',
    lastMessage: '오늘 스트레칭 5분이라도 해보자!',
    lastMessageAt: ago(1 * DAY),
    unreadCount: 0,
  },
  {
    id: '5',
    name: '회고 도우미',
    description: '주간 회고 정리 중',
    lastMessage: '이번 주 집중 시간 2시간 넘겼어. 잘하고 있어',
    lastMessageAt: ago(4 * DAY),
    unreadCount: 5,
  },
  {
    id: '6',
    name: '독서 메이트',
    description: '이번 달 책 1권 읽기',
    lastMessage: '지난주에 읽던 책 이어서 볼까?',
    lastMessageAt: ago(10 * DAY),
    unreadCount: 0,
  },
];
