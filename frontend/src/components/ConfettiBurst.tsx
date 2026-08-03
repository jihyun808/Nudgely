// components/ConfettiBurst.tsx

/** 컨페티 조각 색 */
const CONFETTI_COLORS = ['#2563EB', '#1E9E5A', '#E2483D', '#F2B441', '#8B5CF6'];

interface ConfettiBurstProps {
  /** 조각 개수 */
  pieceCount?: number;
  /** true면 계속 반복해서 떨어진다 (기본은 한 번만 터지고 끝) */
  isLooping?: boolean;
}

/**
 * 컨페티. 라이브러리 없이 CSS 애니메이션으로 떨어뜨린다.
 * 감싸는 요소에 `relative overflow-hidden`을 주면 그 영역 안에서만 터진다.
 * 목표 달성 축하 화면과 모아보기 완료 목표에서 함께 쓴다.
 */
export default function ConfettiBurst({ pieceCount = 36, isLooping = false }: ConfettiBurstProps) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: pieceCount }, (_, i) => (
        <span
          key={i}
          className={`confetti-piece${isLooping ? '' : ' confetti-piece--once'}`}
          style={{
            left: `${(i * 100) / pieceCount}%`,
            backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
            animationDelay: `${(i % 12) * 0.08}s`,
            animationDuration: `${1.6 + (i % 5) * 0.25}s`,
          }}
        />
      ))}
    </div>
  );
}
