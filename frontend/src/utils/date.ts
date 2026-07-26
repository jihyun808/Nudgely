// utils/date.ts

const WEEKDAY_LABELS = [
  '일요일',
  '월요일',
  '화요일',
  '수요일',
  '목요일',
  '금요일',
  '토요일',
] as const;

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

/** 자정 기준으로 두 날짜가 며칠 차이인지 */
function diffInDays(from: Date, to: Date) {
  const startOfFrom = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const startOfTo = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((startOfTo.getTime() - startOfFrom.getTime()) / (24 * HOUR));
}

/**
 * 채팅 목록에 표시할 최근 채팅 시각 라벨.
 *
 * 방금 → 10/20/30/40/50분 전 → 1~5시간 전 → 오늘 → 어제 → 월요일~일요일 → 지난주
 * 순서로 점점 거친 단위를 쓴다.
 */
export function formatChatTime(isoDate: string, now: Date = new Date()) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '';

  const elapsed = now.getTime() - date.getTime();
  // 시계 오차 등으로 미래 시각이 들어온 경우도 '방금'으로 처리
  if (elapsed < 5 * MINUTE) return '방금';
  if (elapsed < HOUR) return `${Math.floor(elapsed / (10 * MINUTE)) * 10}분 전`;

  const dayDiff = diffInDays(date, now);

  if (dayDiff === 0) {
    const hours = Math.floor(elapsed / HOUR);
    return hours <= 5 ? `${hours}시간 전` : '오늘';
  }
  if (dayDiff === 1) return '어제';
  // 6일 전까지는 요일로, 그보다 오래되면 '지난주'로 뭉갠다
  if (dayDiff <= 6) return WEEKDAY_LABELS[date.getDay()];
  return '지난주';
}
