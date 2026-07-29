// mocks/todos.ts
// API 연동 전 화면 확인용 임시 데이터. 서버 붙이면 src/mocks 폴더째 삭제한다.
// 투두는 날짜마다 새로 만들어지므로 날짜 + 목표 조합으로 들고 있다.
import type { DailyTodo } from '@/types/record';
import { formatDateKey } from '@/utils/date';

/** 오늘로부터 offset일 뒤 날짜 키 */
const dateKey = (offset: number) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return formatDateKey(date);
};

export const MOCK_DAILY_TODOS: DailyTodo[] = [
  {
    id: 'd1',
    goalId: '1',
    goalTitle: 'UI/UX 디자인 강의 완주',
    date: dateKey(0),
    items: [
      { id: 'd1-1', content: 'UI/UX 21강 수강', isDone: true, tag: '강의' },
      { id: 'd1-2', content: '20강 요약 노트 인증', isDone: true, tag: '인증' },
      { id: 'd1-3', content: '복습 퀴즈 오답 정리', isDone: false, tag: '복습' },
      { id: 'd1-4', content: '22강 예습 키워드 정리', isDone: false, tag: '예습' },
    ],
  },
  {
    id: 'd2',
    goalId: '2',
    goalTitle: '매일 영어 단어 30개 외우기',
    date: dateKey(0),
    items: [
      { id: 'd2-1', content: 'Day 12 단어 30개 암기', isDone: true, tag: '암기' },
      { id: 'd2-2', content: '어제 단어 복습 테스트', isDone: false, tag: '복습' },
      { id: 'd2-3', content: '문장 3개 만들어보기', isDone: false, tag: '작문' },
    ],
  },
  {
    id: 'd3',
    goalId: '3',
    goalTitle: '알고리즘 하루 한 문제 풀기',
    date: dateKey(0),
    items: [
      { id: 'd3-1', content: 'DP 기초 문제 1개 풀기', isDone: false, tag: '풀이' },
      { id: 'd3-2', content: '틀린 문제 다시 보기', isDone: false, tag: '복습' },
    ],
  },
  {
    id: 'd4',
    goalId: '1',
    goalTitle: 'UI/UX 디자인 강의 완주',
    date: dateKey(-1),
    items: [
      { id: 'd4-1', content: 'UI/UX 20강 수강', isDone: true, tag: '강의' },
      { id: 'd4-2', content: '19강 오답 정리', isDone: true, tag: '복습' },
    ],
  },
  {
    id: 'd5',
    goalId: '1',
    goalTitle: 'UI/UX 디자인 강의 완주',
    date: dateKey(1),
    items: [
      { id: 'd5-1', content: 'UI/UX 22강 수강', isDone: false, tag: '강의' },
      { id: 'd5-2', content: '21강 요약 노트 작성', isDone: false, tag: '인증' },
    ],
  },
];
