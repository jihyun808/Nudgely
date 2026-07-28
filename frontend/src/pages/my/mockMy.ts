// pages/my/mockMy.ts
// API 연동 전 화면 확인용 임시 데이터. 서버 붙이면 이 파일은 삭제한다.
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
 * 이번 주 요일별 집중 시간(시간 단위). 월요일부터 일요일 순.
 * 집중 탭이 없어 실제 값을 만들 수 없으므로 하드코딩이다.
 */
export const MOCK_WEEKLY_FOCUS_HOURS = [1, 2, 1.5, 3, 2.2, 0, 0];

/**
 * 가입일부터 오늘까지의 날짜별 집중량(0~4단계).
 * 날짜 수에 맞춰 반복해 쓰는 임시 패턴이다.
 */
export const MOCK_HEATMAP_PATTERN = [
  0, 1, 2, 0, 3, 4, 1, 2, 0, 1, 3, 4, 4, 2, 0, 0, 1, 2, 3, 1, 4, 2, 3, 0, 1, 2, 4, 3, 2, 1, 0, 2, 3,
  4, 1,
];
