// pages/my/components/StatCards.tsx

/**
 * 마이페이지 상단 요약 카드 세 개.
 *
 * 값이 전부 하드코딩이다. 아직 계산할 데이터가 없다.
 * - 연속 달성: 투두 체크 이력 전체가 필요 → 서버 계산
 * - 누적 집중: 집중 세션 기록이 아직 없음 → 집중 탭 구현 후
 * - 인증 완료: 100% 완료한 목표 수. 완료된 목표까지 포함한 목록 API가 생기면 계산 가능
 */
const STATS = [
  { value: '7일', label: '연속 달성' },
  { value: '142h', label: '누적 집중' },
  { value: '23개', label: '인증 완료' },
] as const;

export default function StatCards() {
  return (
    <div className="grid grid-cols-3 gap-3">
      {STATS.map(({ value, label }) => (
        <div key={label} className="rounded-2xl bg-muted-foreground/5 px-2 py-4 text-center">
          <p className="text-lg font-bold">{value}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
        </div>
      ))}
    </div>
  );
}
