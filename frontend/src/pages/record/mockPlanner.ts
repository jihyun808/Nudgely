// pages/record/mockPlanner.ts
// API 연동 전 화면 확인용 임시 데이터. 서버 붙이면 이 파일은 삭제한다.
import type { DailyPlanner } from '@/types/planner';

/** 'HH:MM' → 자정 기준 분 */
const at = (time: string) => {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
};

/** 어느 날짜로 조회해도 같은 하루를 돌려주는 임시 플래너 */
export function createMockPlanner(date: string): DailyPlanner {
  return {
    date,
    planned: [
      { id: 'p1', title: '미라클 모닝', startMinutes: at('08:00'), durationMinutes: 40 },
      { id: 'p2', title: 'UI/UX 21강', startMinutes: at('09:00'), durationMinutes: 60 },
      { id: 'p3', title: '휴식', startMinutes: at('10:00'), durationMinutes: 20 },
      { id: 'p4', title: '요약 노트', startMinutes: at('10:20'), durationMinutes: 40 },
    ],
    actual: [
      {
        id: 'a1',
        title: '미라클 모닝',
        startMinutes: at('08:00'),
        durationMinutes: 40,
        kind: 'manual',
      },
      {
        id: 'a2',
        title: 'UI/UX 21강',
        startMinutes: at('09:00'),
        durationMinutes: 50,
        kind: 'focus',
      },
      {
        id: 'a3',
        title: '요약 노트 인증',
        startMinutes: at('10:20'),
        durationMinutes: 40,
        kind: 'verify',
      },
    ],
  };
}
