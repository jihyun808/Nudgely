// mocks/my.ts
// API 연동 전 화면 확인용 임시 데이터. 서버 붙이면 src/mocks 폴더째 삭제한다.
import type { User } from '@/types/auth';

export const MOCK_PROFILE: User = {
  id: 'u1',
  email: 'jisoo@example.com',
  nickname: '김지수',
};

/**
 * 가입일. 히트맵은 이 날부터 오늘까지를 그린다.
 *
 * ⚠️ 가로 스크롤 확인용으로 임시로 240일(약 8개월) 전으로 잡아뒀다.
 *    확인이 끝나면 아래 240을 46 정도로 되돌리면 된다.
 */
export const MOCK_JOINED_AT = new Date(Date.now() - 240 * 24 * 60 * 60 * 1000).toISOString();

/**
 * 주차별 요일별 집중 시간(시간 단위). 월요일부터 일요일 순.
 * 실제 집중 기록이 없어 주차를 씨앗 삼아 만들어낸 값이다.
 *
 * @param weekOffset 0이면 이번 주, -1이면 지난 주
 */
export function createMockWeeklyFocus(weekOffset: number): number[] {
  // 이번 주는 눈에 익은 값으로 고정하고, 지난 주들은 규칙적으로 만들어낸다
  if (weekOffset === 0) return [1, 2, 1.5, 3, 2.2, 0, 0];

  const seed = Math.abs(weekOffset);
  return Array.from({ length: 7 }, (_, day) => {
    const value = ((day * 7 + seed * 13) % 9) * 0.5;
    // 주말은 조금 적게
    return day >= 5 ? Math.round(value * 0.6 * 10) / 10 : value;
  });
}

/**
 * 가입일부터 오늘까지의 날짜별 집중량(0~4단계).
 * 날짜 수에 맞춰 반복해 쓰는 임시 패턴이다.
 */
export const MOCK_HEATMAP_PATTERN = [
  0, 1, 2, 0, 3, 4, 1, 2, 0, 1, 3, 4, 4, 2, 0, 0, 1, 2, 3, 1, 4, 2, 3, 0, 1, 2, 4, 3, 2, 1, 0, 2, 3,
  4, 1,
];
