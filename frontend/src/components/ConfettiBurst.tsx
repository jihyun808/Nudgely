// components/ConfettiBurst.tsx
import { useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';

/** 브랜드 톤에 맞춘 조각 색 */
const CONFETTI_COLORS = ['#2563EB', '#1E9E5A', '#E2483D', '#F2B441', '#8B5CF6'];
/** 반복 모드에서 다시 터뜨리는 간격(ms) */
const LOOP_INTERVAL = 1200;

interface ConfettiBurstProps {
  /** 한 번에 터뜨릴 조각 수 */
  particleCount?: number;
  /** true면 계속 반복해서 터진다 (기본은 한 번만) */
  isLooping?: boolean;
}

/**
 * 컨페티 연출 (canvas-confetti).
 * 감싸는 요소에 `relative overflow-hidden`을 주면 그 영역 안에서만 터진다.
 * 집중 탭의 목표 달성 축하와 모아보기의 완료된 목표에서 함께 쓴다.
 */
export default function ConfettiBurst({
  particleCount = 80,
  isLooping = false,
}: ConfettiBurstProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // 모션을 줄이도록 설정한 사용자에게는 연출을 생략한다
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    // 이 캔버스 안에서만 그리도록 묶는다 (전체 화면을 덮지 않는다)
    const fire = confetti.create(canvas, { resize: true, useWorker: true });

    const shoot = () => {
      void fire({
        particleCount,
        spread: 75,
        startVelocity: 32,
        scalar: 0.9,
        origin: { y: 0.5 },
        colors: CONFETTI_COLORS,
      });
    };

    shoot();
    const timer = isLooping ? window.setInterval(shoot, LOOP_INTERVAL) : undefined;

    return () => {
      if (timer) window.clearInterval(timer);
      fire.reset();
    };
  }, [particleCount, isLooping]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
}
