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

/** 알림 목록에 붙는 시각. '방금' → 'n분 전' → 'n시간 전' → 'n일 전' */
export function formatNotificationTime(isoDate: string, now: Date = new Date()) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '';

  const elapsed = now.getTime() - date.getTime();
  if (elapsed < 5 * MINUTE) return '방금';
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)}분 전`;
  if (elapsed < 24 * HOUR) return `${Math.floor(elapsed / HOUR)}시간 전`;
  return `${Math.floor(elapsed / (24 * HOUR))}일 전`;
}

/** API 파라미터로 쓰는 날짜 키. 예: '2026-07-26' (사용자 기준 로컬 날짜) */
export function formatDateKey(date: Date) {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** 말풍선 옆에 붙는 시각. 예: '오전 9:00' */
export function formatMessageTime(isoDate: string) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '';

  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const meridiem = hours < 12 ? '오전' : '오후';
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${meridiem} ${hour12}:${minutes}`;
}

/** 채팅 중간의 날짜 구분선 라벨. 예: '오늘', '어제', '2026년 7월 20일 월요일' */
export function formatDateDivider(isoDate: string, now: Date = new Date()) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '';

  const dayDiff = diffInDays(date, now);
  if (dayDiff === 0) return '오늘';
  if (dayDiff === 1) return '어제';
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 ${WEEKDAY_LABELS[date.getDay()]}`;
}

/** 두 시각이 같은 날인지 (날짜 구분선을 넣을 위치 판단용) */
export function isSameDay(isoA: string, isoB: string) {
  const a = new Date(isoA);
  const b = new Date(isoB);
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** 두 시각이 같은 분(分)인지 (연속 메시지의 시각 표시를 한 번만 하기 위함) */
export function isSameMinute(isoA: string, isoB: string) {
  const a = new Date(isoA);
  const b = new Date(isoB);
  return (
    isSameDay(isoA, isoB) && a.getHours() === b.getHours() && a.getMinutes() === b.getMinutes()
  );
}
