// mocks/planner.ts
// API 연동 전 화면 확인용 임시 데이터. 서버 붙이면 src/mocks 폴더째 삭제한다.
import type { DailyPlanner, PlannerBlock } from '@/types/planner';

/** 'HH:MM' → 자정 기준 분 */
const at = (time: string) => {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
};

/**
 * 날짜별 플래너 보관소.
 * 사용자가 고친 실제 기록이 날짜를 넘겼다 돌아와도 남아 있게 한다.
 */
const planners = new Map<string, DailyPlanner>();

/** 그날의 플래너. 없으면 만들어서 보관한다 */
export function getMockPlanner(date: string): DailyPlanner {
  const cached = planners.get(date);
  if (cached) return cached;
  const created = createMockPlanner(date);
  planners.set(date, created);
  return created;
}

/** 실제 기록을 갈아끼우고 새 플래너를 돌려준다 */
export function replaceMockActual(date: string, actual: PlannerBlock[]): DailyPlanner {
  const next = { ...getMockPlanner(date), actual };
  planners.set(date, next);
  return next;
}

/** 어느 날짜로 조회해도 같은 하루를 돌려주는 임시 플래너 */
function createMockPlanner(date: string): DailyPlanner {
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
