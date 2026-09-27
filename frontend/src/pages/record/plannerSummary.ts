// pages/record/plannerSummary.ts
import { PLANNER_BLOCK_MINUTES, type DailyPlanner, type PlannerBlock } from '@/types/planner';

const DAY_MINUTES = 24 * 60;

/** 해당 시각(분)이 블록들 중 하나에 포함되는지 */
function isCovered(blocks: PlannerBlock[], minute: number) {
  return blocks.some(
    ({ startMinutes, durationMinutes }) =>
      minute >= startMinutes && minute < startMinutes + durationMinutes,
  );
}

/**
 * 표를 10분 칸으로 쪼개 계획·달성·미달성 개수를 센다.
 * 계획이 있는 칸에 실제 기록이 겹치면 달성, 없으면 미달성이다.
 */
export function summarizePlanner({ planned, actual }: DailyPlanner) {
  let plannedBlocks = 0;
  let doneBlocks = 0;

  for (let minute = 0; minute < DAY_MINUTES; minute += PLANNER_BLOCK_MINUTES) {
    if (!isCovered(planned, minute)) continue;
    plannedBlocks += 1;
    if (isCovered(actual, minute)) doneBlocks += 1;
  }

  return {
    plannedBlocks,
    doneBlocks,
    missedBlocks: plannedBlocks - doneBlocks,
    achievementRate: plannedBlocks > 0 ? Math.round((doneBlocks / plannedBlocks) * 100) : 0,
  };
}
