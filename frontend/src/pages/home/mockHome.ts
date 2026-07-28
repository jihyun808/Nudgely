// pages/home/mockHome.ts
// API 연동 전 화면 확인용 임시 데이터. 서버 붙이면 이 파일은 삭제한다.
import type { HomeSummary } from '@/types/home';
import type { AppNotification } from '@/types/notification';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

export const MOCK_HOME_SUMMARY: HomeSummary = {
  previews: [
    {
      id: 'p1',
      kind: 'message',
      title: 'Buddy',
      subtitle: 'AI 스터디 메이트',
      content: '오늘 UI/UX 5강 완료 예정이야! 집중 시작해볼까? 오늘도 같이 달려보자 💪',
      receivedAt: ago(2 * MINUTE),
      linkTo: '/chat/1',
    },
    {
      id: 'p2',
      kind: 'message',
      title: '영어 코치',
      subtitle: '매일 단어 10개 암기 중',
      content: '어제 외운 단어 10개 복습부터 시작할까? 5분이면 충분해!',
      receivedAt: ago(12 * MINUTE),
      linkTo: '/chat/2',
    },
    {
      id: 'p3',
      kind: 'message',
      title: '알고리즘 짝',
      subtitle: 'DP 유형 집중 훈련 중',
      content: 'DP 문제 하나 더 풀어볼래? 힌트 줄게',
      receivedAt: ago(3 * HOUR),
      linkTo: '/chat/3',
    },
    {
      id: 'p4',
      kind: 'message',
      title: '운동 트레이너',
      subtitle: '주 3회 홈트 루틴 중',
      content:
        '오늘 스트레칭 5분이라도 해보자! 어제 하루 쉬었으니까 오늘은 가볍게라도 몸을 풀어주는 게 좋아. 딱 5분만 투자하면 돼 😊',
      receivedAt: ago(5 * HOUR),
      linkTo: '/chat/4',
    },
    {
      id: 'p5',
      kind: 'message',
      title: '회고 도우미',
      subtitle: '주간 회고 정리 중',
      content: '이번 주 집중 시간 2시간 넘겼어. 잘하고 있어!',
      receivedAt: ago(1 * DAY),
      linkTo: '/chat/5',
    },
    {
      id: 'p6',
      kind: 'message',
      title: '독서 메이트',
      subtitle: '이번 달 책 1권 읽기',
      content: '지난주에 읽던 책 이어서 볼까?',
      receivedAt: ago(2 * DAY),
      linkTo: '/chat/6',
    },
  ],
  goals: [
    {
      id: 'g1',
      title: 'UI/UX 디자인 강의 완주',
      remainingDays: 22,
      current: 21,
      total: 50,
      unit: '강',
    },
    {
      id: 'g2',
      title: '매일 영어 단어 30개',
      current: 12,
      total: 30,
      unit: '일',
    },
    {
      id: 'g3',
      title: '알고리즘 하루 한 문제',
      remainingDays: 60,
      current: 34,
      total: 100,
      unit: '문제',
    },
  ],
};

export const MOCK_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'n1',
    type: 'nudge',
    title: 'Buddy',
    body: '💌 21강 들을 시간이야! 30분만 같이 달려볼까?',
    createdAt: ago(2 * MINUTE),
    isRead: false,
    linkTo: '/chat/1',
  },
  {
    id: 'n2',
    type: 'todoAdded',
    title: '이지현의 UIUX 유튜브 강의',
    body: '7월 28일 목표에 "복습 퀴즈 오답 정리"가 새로 추가됐어요.',
    createdAt: ago(3 * HOUR),
    isRead: false,
    linkTo: '/record',
  },
  {
    id: 'n3',
    type: 'todoDone',
    title: '이지현의 UIUX 유튜브 강의',
    body: '"20강 요약 노트 인증"을 완료했어요. 좋아요! 🎉',
    createdAt: ago(7 * HOUR),
    isRead: true,
    linkTo: '/record',
  },
  {
    id: 'n4',
    type: 'todoIncomplete',
    title: '오늘 마감',
    body: '아직 완료하지 않은 항목이 2개 있어요. 서두르세요!',
    createdAt: ago(1 * DAY),
    isRead: true,
    linkTo: '/record',
  },
  {
    id: 'n5',
    type: 'plannerIncomplete',
    title: '텐미닛 플래너',
    body: '오늘이 가기 전에 텐미닛 플래너를 채워주세요!',
    createdAt: ago(2 * DAY),
    isRead: true,
    linkTo: '/record',
  },
];
