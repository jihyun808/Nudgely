// pages/my/components/StatCards.tsx
import { formatMinutes } from '@/utils/time';

interface StatCardsProps {
  /** 연속 달성일. 투두가 체크된 날을 세며 서버가 계산한다 */
  streakDays: number;
  /** 가입일부터 오늘까지 쌓인 집중 시간(초). 플래너 실제 기록의 합이다 */
  totalFocusedSeconds: number;
  /** 카메라로 인증된 집중 횟수 */
  verifiedCount: number;
}

/** 마이페이지 상단 요약 카드 세 개 */
export default function StatCards({
  streakDays,
  totalFocusedSeconds,
  verifiedCount,
}: StatCardsProps) {
  const stats = [
    { value: `${streakDays}일`, label: '연속 달성' },
    { value: formatMinutes(Math.floor(totalFocusedSeconds / 60)), label: '누적 집중' },
    { value: `${verifiedCount}회`, label: '인증 완료' },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {stats.map(({ value, label }) => (
        <div key={label} className="rounded-2xl bg-muted-foreground/5 px-2 py-4 text-center">
          <p className="text-lg font-bold">{value}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
        </div>
      ))}
    </div>
  );
}
