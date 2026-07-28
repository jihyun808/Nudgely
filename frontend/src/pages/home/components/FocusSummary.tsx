// pages/home/components/FocusSummary.tsx

/**
 * 오늘의 집중 요약.
 *
 * 값이 전부 하드코딩이다. 아직 연결할 곳이 없다.
 * TODO: 오늘 집중 시간 — 집중 탭 구현 후 그쪽 데이터에서 가져온다
 * TODO: 연속 달성일 — 투두가 체크된 날을 세는 값. 서버에서 계산해 내려받는다
 *       (최고 기록 여부는 과거 전체 기록이 필요해 프론트에서 계산할 수 없다)
 */
export default function FocusSummary() {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-2xl bg-muted-foreground/5 p-4">
        <p className="text-xs text-muted-foreground">오늘 집중 시간</p>
        <p className="mt-1.5 text-xl font-bold">1h 24m</p>
        <p className="mt-1 text-xs text-muted-foreground">목표 3h 중</p>
      </div>

      <div className="rounded-2xl bg-muted-foreground/5 p-4">
        <p className="text-xs text-muted-foreground">연속 달성일</p>
        <p className="mt-1.5 text-xl font-bold">7일 🔥</p>
        <p className="mt-1 text-xs text-muted-foreground">최고 기록 갱신!</p>
      </div>
    </div>
  );
}
