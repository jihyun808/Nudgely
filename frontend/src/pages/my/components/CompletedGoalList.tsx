// pages/my/components/CompletedGoalList.tsx
import { useNavigate } from 'react-router-dom';
import type { Goal } from '@/types/goal';
import { formatDateDot } from '@/utils/date';

const DAY = 24 * 60 * 60 * 1000;

interface CompletedGoalListProps {
  goals: Goal[];
}

/** 시작일부터 완료일까지 걸린 날수 */
function getSpentDays(goal: Goal) {
  if (!goal.startedAt || !goal.completedAt) return 0;
  const spent = new Date(goal.completedAt).getTime() - new Date(goal.startedAt).getTime();
  return Math.max(1, Math.round(spent / DAY));
}

/**
 * 완주한 목표 목록.
 * 완주한 목표가 하나도 없으면 아예 그리지 않는다.
 * 누르면 그 목표의 모아보기 진도 탭(회고 화면)으로 바로 간다.
 */
export default function CompletedGoalList({ goals }: CompletedGoalListProps) {
  const navigate = useNavigate();

  if (goals.length === 0) return null;

  return (
    <>
      <hr className="mt-7 border-border" />

      <section className="mt-5">
        <h2 className="mb-3 text-sm font-bold">완주한 목표</h2>

        <ul className="space-y-2">
          {goals.map((goal) => {
            const spentDays = getSpentDays(goal);
            return (
              <li key={goal.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/chat/${goal.id}/archive?tab=progress`)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-border bg-background px-4 py-3 text-left transition-colors active:bg-muted-foreground/5"
                >
                  <span aria-hidden className="text-lg">
                    🏆
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">
                      {goal.title ?? goal.name}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {goal.startedAt && goal.completedAt
                        ? `${formatDateDot(goal.startedAt)} ~ ${formatDateDot(goal.completedAt)} · ${spentDays}일`
                        : '완주'}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
