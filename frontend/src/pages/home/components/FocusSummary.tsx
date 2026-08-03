// pages/home/components/FocusSummary.tsx
import { formatMinutes } from '@/utils/time';

interface FocusSummaryProps {
  /** 오늘 누적 집중 시간(초) */
  focusedSeconds: number;
  /** 오늘 목표 시간(분). 텐미닛 플래너 계획 시간 합계 */
  targetMinutes: number;
  /** 연속 달성일 */
  streakDays: number;
  /** 연속 달성일이 최고 기록인지 */
  isBestStreak: boolean;
}

/**
 * 오늘의 집중 요약 두 칸 (집중 시간 / 연속 달성일).
 *
 * TODO: 연속 달성일은 투두가 체크된 날을 세는 값이라 서버에서 계산해 내려받아야 한다.
 *       지금은 홈 조회 응답이 없어 화면에서 기본값을 쓴다.
 */
export default function FocusSummary({
  focusedSeconds,
  targetMinutes,
  streakDays,
  isBestStreak,
}: FocusSummaryProps) {
  const focusedMinutes = Math.floor(focusedSeconds / 60);

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-2xl bg-muted-foreground/5 p-4">
        <p className="text-xs text-muted-foreground">오늘 집중 시간</p>
        <p className="mt-1.5 text-xl font-bold">{formatMinutes(focusedMinutes)}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          목표 {targetMinutes > 0 ? formatMinutes(targetMinutes) : '없음'} 중
        </p>
      </div>

      <div className="rounded-2xl bg-muted-foreground/5 p-4">
        <p className="text-xs text-muted-foreground">연속 달성일</p>
        <p className="mt-1.5 text-xl font-bold">{streakDays}일 🔥</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {isBestStreak ? '최고 기록 갱신!' : '이어서 달려볼까요?'}
        </p>
      </div>
    </div>
  );
}
