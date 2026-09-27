// utils/progress.ts

/** 분량 진도. Goal.progress 와 GoalProgress.progress 가 같은 모양이다 */
export interface ProgressAmount {
  current: number;
  total: number;
  /** 단위 (예: '강', '페이지') */
  unit: string;
}

/**
 * 진행률(%) — 홈 목표 카드와 모아보기 진도 탭이 함께 쓴다.
 *
 * 예전에는 두 화면이 각자 계산했고, 모아보기는 마일스톤(done÷전체)을 기준으로 삼아
 * 같은 목표인데 숫자가 달랐다. 세는 기준을 여기 한 군데로 모아 다시 갈라지지 않게 한다.
 * (마일스톤은 '몇 단계까지 왔나' 라 진행률이 아니라 타임라인으로 보여준다)
 *
 * total 이 없으면(아직 AI 가 세우지 않았으면) 0% 다.
 */
export function progressPercent(progress: ProgressAmount | undefined | null): number {
  if (!progress || progress.total <= 0) return 0;
  return Math.round((progress.current / progress.total) * 100);
}

/** '3 / 30강'. 진도가 없으면 undefined */
export function formatProgressAmount(
  progress: ProgressAmount | undefined | null,
): string | undefined {
  if (!progress || progress.total <= 0) return undefined;
  return `${progress.current} / ${progress.total}${progress.unit}`;
}
