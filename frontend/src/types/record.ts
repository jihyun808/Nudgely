// types/record.ts

/** 투두 항목 하나. AI와 대화하면서 생성·갱신되고 체크 상태도 AI가 바꾼다 */
export interface TodoItem {
  id: string;
  content: string;
  isDone: boolean;
  /** 항목 오른쪽에 붙는 분류 태그 (예: 강의, 복습). 없으면 표시하지 않는다 */
  tag?: string;
}

/**
 * 투두 리스트 한 묶음.
 * 채팅방에서 정한 습관·공부 단위로 만들어지고, 여러 개가 동시에 존재할 수 있다.
 */
export interface TodoList {
  id: string;
  /** 습관/공부 이름. AI와 대화하면서 자동 생성된다 (예: '이지현의 UIUX 유튜브 강의') */
  title: string;
  /** 이 투두가 할당된 날짜 (YYYY-MM-DD) */
  date: string;
  items: TodoItem[];
}
