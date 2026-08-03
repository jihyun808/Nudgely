// types/home.ts

/**
 * 홈 상단 미리보기 카드의 종류.
 * - message: 안 읽은 채팅 메시지(선톡 포함). 아이콘은 💌로 통일하고 본문은 두 줄까지만 보여준다
 * - notice: 공지사항
 * - ad: 광고/이벤트
 */
export type PreviewKind = 'message' | 'notice' | 'ad';

/** 홈 상단에서 좌우로 넘겨보는 미리보기 카드 하나 */
export interface HomePreview {
  id: string;
  kind: PreviewKind;
  /** 카드 윗줄. 메시지면 목표(채팅방) 이름, 공지/광고면 말머리 */
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
