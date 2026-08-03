// mocks/todos.ts
// API 연동 전 화면 확인용 임시 데이터. 서버 붙이면 src/mocks 폴더째 삭제한다.
// 투두는 날짜마다 새로 만들어지므로 날짜 + 목표 조합으로 들고 있다.
// 캘린더 꽃 모양을 확인할 수 있도록 한 달치를 다양하게 채워뒀다.
import type { DailyTodo, TodoItem } from '@/types/record';
import { formatDateKey } from '@/utils/date';

/** 오늘로부터 offset일 뒤 날짜 키 */
const dateKey = (offset: number) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return formatDateKey(date);
};

/** 목표별 기본 정보 */
const GOALS = {
  uiux: { goalId: '1', goalTitle: 'UI/UX 디자인 강의 완주' },
  english: { goalId: '2', goalTitle: '매일 영어 단어 30개 외우기' },
  algorithm: { goalId: '3', goalTitle: '알고리즘 하루 한 문제 풀기' },
} as const;

let sequence = 0;

/** `[내용, 태그, 완료여부]` 묶음으로 하루치 투두를 만든다 */
function todo(
  goal: (typeof GOALS)[keyof typeof GOALS],
  dayOffset: number,
  items: [content: string, tag: string, isDone: boolean][],
): DailyTodo {
  sequence += 1;
  return {
    id: `d${sequence}`,
    ...goal,
    date: dateKey(dayOffset),
    items: items.map(([content, tag, isDone], index): TodoItem => ({
      id: `d${sequence}-${index + 1}`,
      content,
      tag,
      isDone,
    })),
  };
}

export const MOCK_DAILY_TODOS: DailyTodo[] = [
  // 오늘 — 꽃잎 3장 (강의 · 인증 · 암기)
  todo(GOALS.uiux, 0, [
    ['UI/UX 21강 수강', '강의', true],
    ['20강 요약 노트 인증', '인증', true],
    ['복습 퀴즈 오답 정리', '복습', false],
    ['22강 예습 키워드 정리', '예습', false],
  ]),
  todo(GOALS.english, 0, [
    ['Day 12 단어 30개 암기', '암기', true],
    ['어제 단어 복습 테스트', '복습', false],
    ['문장 3개 만들어보기', '작문', false],
  ]),
  todo(GOALS.algorithm, 0, [
    ['DP 기초 문제 1개 풀기', '풀이', false],
    ['틀린 문제 다시 보기', '복습', false],
  ]),

  // 내일 — 아직 완료 없음 (꽃 없음)
  todo(GOALS.uiux, 1, [
    ['UI/UX 22강 수강', '강의', false],
    ['21강 요약 노트 작성', '인증', false],
  ]),

  // 어제 — 꽃잎 2장
  todo(GOALS.uiux, -1, [
    ['UI/UX 20강 수강', '강의', true],
    ['19강 오답 정리', '복습', true],
  ]),

  // 최근 며칠 — 꽃잎 수를 다양하게
  todo(GOALS.uiux, -2, [
    ['UI/UX 19강 수강', '강의', true],
    ['18강 요약 노트 인증', '인증', true],
  ]),
  todo(GOALS.english, -2, [
    ['Day 10 단어 암기', '암기', true],
    ['문장 만들기', '작문', true],
  ]),

  // 꽃잎 1장
  todo(GOALS.english, -3, [['Day 9 단어 암기', '암기', true]]),

  // 꽃잎 4장 (가득 찬 날)
  todo(GOALS.uiux, -4, [
    ['UI/UX 18강 수강', '강의', true],
    ['17강 오답 정리', '복습', true],
    ['요약 노트 인증', '인증', true],
  ]),
  todo(GOALS.algorithm, -4, [['그리디 문제 풀기', '풀이', true]]),
  todo(GOALS.english, -4, [['Day 8 단어 암기', '암기', true]]),

  // 쉬어간 날 (완료 없음)
  todo(GOALS.uiux, -5, [['UI/UX 17강 수강', '강의', false]]),

  todo(GOALS.uiux, -6, [
    ['UI/UX 16강 수강', '강의', true],
    ['예습 키워드 정리', '예습', true],
  ]),
  todo(GOALS.algorithm, -7, [
    ['DFS 문제 풀기', '풀이', true],
    ['오답 노트 정리', '복습', true],
  ]),
  todo(GOALS.english, -8, [['Day 6 단어 암기', '암기', true]]),
  todo(GOALS.uiux, -9, [
    ['UI/UX 14강 수강', '강의', true],
    ['13강 요약 노트 인증', '인증', true],
    ['예습 키워드 정리', '예습', true],
  ]),
  todo(GOALS.uiux, -11, [['UI/UX 12강 수강', '강의', true]]),
  todo(GOALS.english, -11, [
    ['Day 4 단어 암기', '암기', true],
    ['문장 만들기', '작문', true],
  ]),
  todo(GOALS.algorithm, -13, [['정렬 문제 풀기', '풀이', true]]),
  todo(GOALS.uiux, -14, [
    ['UI/UX 10강 수강', '강의', true],
    ['9강 오답 정리', '복습', true],
  ]),
  todo(GOALS.english, -16, [['Day 2 단어 암기', '암기', true]]),
  todo(GOALS.uiux, -18, [
    ['UI/UX 8강 수강', '강의', true],
    ['7강 요약 노트 인증', '인증', true],
  ]),
  todo(GOALS.algorithm, -20, [
    ['완전탐색 문제 풀기', '풀이', true],
    ['오답 노트 정리', '복습', true],
  ]),
  todo(GOALS.uiux, -22, [['UI/UX 6강 수강', '강의', true]]),
];

/** 특정 투두의 항목 배열. 추가·수정·삭제가 이 배열을 직접 고친다 */
export function getMockTodoItems(todoId: string): TodoItem[] {
  const todo = MOCK_DAILY_TODOS.find(({ id }) => id === todoId);
  if (!todo) throw new Error(`투두를 찾을 수 없습니다: ${todoId}`);
  return todo.items;
}
