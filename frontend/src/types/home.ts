// types/home.ts

/**
 * 홈 상단 미리보기 카드의 종류.
 * - message: 안 읽은 채팅 메시지(선톡 포함). 아이콘은 💌로 통일하고 본문은 두 줄까지만 보여준다
 * - notice: 공지사항
 * - ad: 광고/이벤트
 */
export type PreviewKind = 'message' | 'notice' | 'ad';

/** 홈 상단에서 세로로 넘겨보는 미리보기 카드 하나 */
export interface HomePreview {
  id: string;
  kind: PreviewKind;
  /** 카드 윗줄. 메시지면 채팅방 이름, 공지/광고면 말머리 */
  title: string;
  /** 윗줄 제목 옆 보조 문구 (예: AI 스터디 메이트) */
  subtitle?: string;
  /** 카드 본문 */
  content: string;
  /** 수신 시각 (ISO 8601). 최신일수록 앞쪽에 온다 */
  receivedAt: string;
  /** 누르면 이동할 경로 (메시지는 해당 채팅방) */
  linkTo?: string;
}

/** 진행 중인 목표 카드 */
export interface Goal {
  id: string;
  /** 목표 이름 (카드에서 가장 굵은 글씨) */
  title: string;
  /** 목표 기한까지 남은 일수. 기한이 없으면 undefined (D-day 배지 미표시) */
  remainingDays?: number;
  /**
   * 진도율.
   * TODO: 진도를 무엇으로 셀지(강의 수, 페이지, 회차 등)는 AI가 사용자에게서
   *       어떤 정보를 받아 정할지 확정한 뒤 스키마를 다시 맞춘다.
   */
  current: number;
  total: number;
  /** 단위 (예: '강', '페이지') */
  unit: string;
}

/** 홈 화면에서 한 번에 받아오는 데이터 */
export interface HomeSummary {
  /** 안 읽은 메시지·공지·광고 미리보기 (최신순) */
  previews: HomePreview[];
  goals: Goal[];
}
