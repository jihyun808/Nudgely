// types/record.ts

/**
 * 투두 항목 하나.
 * AI와 대화하면서 생성·갱신되지만, 체크와 내용 수정은 사용자도 직접 할 수 있다.
 */
export interface TodoItem {
  id: string;
  content: string;
  isDone: boolean;
  /** 항목 오른쪽에 붙는 분류 태그 (예: 강의, 복습). 없으면 표시하지 않는다 */
  tag?: string;
  /**
   * 이 항목을 만든 주체. 없으면 AI가 만든 것으로 본다.
   * AI가 만든 항목은 로드맵과 독촉의 근거이므로 체크만 되고 수정·삭제는 대화로만 한다.
   */
  source?: 'ai' | 'user';
}

/** 투두 항목을 추가·수정할 때 보내는 값 */
export interface TodoItemInput {
  content: string;
  tag?: string;
}

/**
 * 목표 하나의 하루치 항목 수 상한.
 * 투두는 매일 통째로 AI 컨텍스트에 들어가므로 무한정 늘어나면 안 된다.
 */
export const TODO_ITEM_MAX = 10;
/** 투두 항목 내용 글자수 제한 */
export const TODO_CONTENT_MAX = 50;
/** 태그 글자수 제한 */
export const TODO_TAG_MAX = 10;

/**
 * 어떤 목표의 하루치 투두.
 * 항목은 날짜마다 새로 만들어지므로, 할 일이 없는 날은 그 목표의 카드를 그리지 않는다.
 */
export interface DailyTodo {
  id: string;
  /** 어느 목표(=채팅방)의 투두인지 */
  goalId: string;
  /** 카드 제목으로 쓰는 목표 이름 (Goal.title과 같은 값) */
  goalTitle: string;
  /** 날짜 (YYYY-MM-DD) */
  date: string;
  /** 완주한 목표의 투두는 읽기 전용이다 (이미 끝난 목표라 손댈 이유가 없다) */
  isGoalCompleted?: boolean;
  items: TodoItem[];
}

/** 캘린더 한 칸에 꽃 모양으로 그릴 하루치 완료 표시 */
export interface TodoMark {
  /** 날짜 (YYYY-MM-DD) */
  date: string;
  /**
   * 그날 완료한 항목들이 속한 목표 id 목록.
   * 항목 하나가 꽃잎 하나이고, 색은 목표별로 고정된다.
   * (같은 목표에서 3개를 완료했다면 같은 id가 세 번 들어간다)
   */
  doneGoalIds: string[];
}
