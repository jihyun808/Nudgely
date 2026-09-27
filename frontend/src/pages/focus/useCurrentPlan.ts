// pages/focus/useCurrentPlan.ts
import { useEffect, useState } from 'react';
import { fetchDailyPlanner } from '@/api/record';
import { formatDateKey } from '@/utils/date';

/**
 * 지금 시각에 걸쳐 있는 텐미닛 플래너 계획의 제목.
 * 잡힌 계획이 없으면 undefined를 돌려준다.
 */
export function useCurrentPlan() {
  const [currentPlan, setCurrentPlan] = useState<string>();

  useEffect(() => {
    let isStale = false;
    fetchDailyPlanner(formatDateKey(new Date()))
      .then((planner) => {
        if (isStale) return;
        const now = new Date();
        const nowMinutes = now.getHours() * 60 + now.getMinutes();
        const plan = planner.planned.find(
          ({ startMinutes, durationMinutes }) =>
            nowMinutes >= startMinutes && nowMinutes < startMinutes + durationMinutes,
        );
        setCurrentPlan(plan?.title);
      })
      .catch(() => {
        // 계획을 못 받아도 타이머는 쓸 수 있다
      });
    return () => {
      isStale = true;
    };
  }, []);

  return currentPlan;
}
