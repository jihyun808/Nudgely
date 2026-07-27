// pages/record/mockTodoLists.ts
// API 연동 전 화면 확인용 임시 데이터. 서버 붙이면 이 파일은 삭제한다.
import type { TodoList } from '@/types/record';
import { formatDateKey } from '@/utils/date';

/** 오늘로부터 offset일 뒤 날짜 키 */
const dateKey = (offset: number) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return formatDateKey(date);
};

export const MOCK_TODO_LISTS: TodoList[] = [
  {
    id: 't1',
    title: '이지현의 UIUX 유튜브 강의',
    date: dateKey(0),
    items: [
      { id: 't1-1', content: 'UI/UX 21강 수강', isDone: true, tag: '강의' },
      { id: 't1-2', content: '20강 요약 노트 인증', isDone: true, tag: '인증' },
      { id: 't1-3', content: '복습 퀴즈 오답 정리', isDone: false, tag: '복습' },
      { id: 't1-4', content: '22강 예습 키워드 정리', isDone: false, tag: '예습' },
    ],
  },
  {
    id: 't2',
    title: '매일 영어 단어 30개',
    date: dateKey(0),
    items: [
      { id: 't2-1', content: 'Day 12 단어 30개 암기', isDone: true, tag: '암기' },
      { id: 't2-2', content: '어제 단어 복습 테스트', isDone: false, tag: '복습' },
      { id: 't2-3', content: '문장 3개 만들어보기', isDone: false, tag: '작문' },
    ],
  },
  {
    id: 't3',
    title: '알고리즘 하루 한 문제',
    date: dateKey(0),
    items: [
      { id: 't3-1', content: 'DP 기초 문제 1개 풀기', isDone: false, tag: '풀이' },
      { id: 't3-2', content: '틀린 문제 다시 보기', isDone: false, tag: '복습' },
    ],
  },
  {
    id: 't4',
    title: '이지현의 UIUX 유튜브 강의',
    date: dateKey(-1),
    items: [
      { id: 't4-1', content: 'UI/UX 20강 수강', isDone: true, tag: '강의' },
      { id: 't4-2', content: '19강 오답 정리', isDone: true, tag: '복습' },
    ],
  },
  {
    id: 't5',
    title: '이지현의 UIUX 유튜브 강의',
    date: dateKey(1),
    items: [
      { id: 't5-1', content: 'UI/UX 22강 수강', isDone: false, tag: '강의' },
      { id: 't5-2', content: '21강 요약 노트 작성', isDone: false, tag: '인증' },
    ],
  },
];
