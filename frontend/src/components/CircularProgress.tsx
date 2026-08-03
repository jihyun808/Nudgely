// components/CircularProgress.tsx
import { useEffect, useState } from 'react';

interface CircularProgressProps {
  /** 0~100 */
  percent: number;
  /** 지름(px) */
  size?: number;
  /** 링 두께(px) */
  strokeWidth?: number;
  /** 가운데 표시할 내용. 없으면 'NN%' */
  label?: string;
}

/**
 * 원형 진행률 게이지.
 * 화면에 나타나면 0%에서 실제 값까지 차오른다.
 */
export default function CircularProgress({
  percent,
  size = 72,
  strokeWidth = 7,
  label,
}: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  /** 화면에 그려진 값. 0에서 시작해 목표 값까지 차오른다 */
  const [drawnPercent, setDrawnPercent] = useState(0);

  // 다음 프레임에 목표 값을 넣어 0 → percent 전환이 보이게 한다
  useEffect(() => {
    const frame = requestAnimationFrame(() => setDrawnPercent(percent));
    return () => cancelAnimationFrame(frame);
  }, [percent]);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full">
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-muted-foreground/15"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - drawnPercent / 100)}
            className="text-primary transition-[stroke-dashoffset] duration-1000 ease-out"
          />
        </g>
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-primary">
        {label ?? `${percent}%`}
      </span>
    </div>
  );
}
