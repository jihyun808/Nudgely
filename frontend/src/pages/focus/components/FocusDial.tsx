// pages/focus/components/FocusDial.tsx
import { cn } from '@/lib/utils';

/** SVG 좌표계 크기 */
const SIZE = 240;
const CENTER = SIZE / 2;
/** 진행 링 반지름 */
const RADIUS = 88;
/** 눈금이 그려지는 반지름 */
const TICK_OUTER = 104;
/** 숫자가 놓이는 반지름 */
const LABEL_RADIUS = 116;

/** 12시 방향을 0으로 두고, 비율(0~1)을 좌표로 바꾼다 */
const toPoint = (ratio: number, radius: number) => {
  const angle = ratio * 2 * Math.PI - Math.PI / 2;
  return { x: CENTER + radius * Math.cos(angle), y: CENTER + radius * Math.sin(angle) };
};

const VARIANT_COLORS = {
  primary: { stroke: 'var(--color-primary)', text: 'text-primary' },
  focus: { stroke: '#E2483D', text: 'text-[#E2483D]' },
  break: { stroke: '#1E9E5A', text: 'text-[#1E9E5A]' },
} as const;

interface FocusDialProps {
  /** 한 바퀴에 해당하는 시간(분) */
  roundMinutes: number;
  /** 지금까지 흐른 시간(초) */
  elapsedSeconds: number;
  /** 가운데 큰 숫자 */
  centerLabel: string;
  /** 가운데 숫자 아래 보조 문구 */
  caption?: string;
  /** 진행 색. 뽀모도로 집중은 빨강, 휴식은 초록, 스톱워치는 브랜드 색 */
  variant?: keyof typeof VARIANT_COLORS;
  /** 숫자 라벨 간격(분) */
  labelStep: number;
}

/**
 * 타이머 다이얼.
 * 한 바퀴가 roundMinutes이고, 흐른 만큼 12시 방향부터 시계방향으로 채워진다.
 * 바깥에 1분 눈금과 labelStep 간격 숫자를 그린다.
 */
export default function FocusDial({
  roundMinutes,
  elapsedSeconds,
  centerLabel,
  caption,
  variant = 'primary',
  labelStep,
}: FocusDialProps) {
  const roundSeconds = roundMinutes * 60;
  // 한 바퀴를 넘으면 다시 0부터 채운다 (스톱워치는 계속 돈다)
  const ratio = (elapsedSeconds % roundSeconds) / roundSeconds;
  const circumference = 2 * Math.PI * RADIUS;
  const color = VARIANT_COLORS[variant];

  const ticks = Array.from({ length: roundMinutes }, (_, i) => i);
  const labels = Array.from(
    { length: Math.ceil(roundMinutes / labelStep) },
    (_, i) => i * labelStep,
  );

  return (
    <div className="relative mx-auto w-full max-w-[17rem]">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full" role="img" aria-label="집중 타이머">
        {/* 눈금 */}
        {ticks.map((minute) => {
          const isMajor = minute % labelStep === 0;
          const outer = toPoint(minute / roundMinutes, TICK_OUTER);
          const inner = toPoint(minute / roundMinutes, isMajor ? TICK_OUTER - 9 : TICK_OUTER - 5);
          return (
            <line
              key={minute}
              x1={outer.x}
              y1={outer.y}
              x2={inner.x}
              y2={inner.y}
              stroke="currentColor"
              strokeWidth={isMajor ? 2 : 1}
              strokeLinecap="round"
              className={isMajor ? 'text-muted-foreground/60' : 'text-muted-foreground/25'}
            />
          );
        })}

        {/* 숫자 */}
        {labels.map((minute) => {
          const point = toPoint(minute / roundMinutes, LABEL_RADIUS);
          return (
            <text
              key={minute}
              x={point.x}
              y={point.y}
              textAnchor="middle"
              dominantBaseline="central"
              className="fill-muted-foreground text-[11px]"
            >
              {minute}
            </text>
          );
        })}

        {/* 진행 링: 12시 방향에서 시작하도록 -90도 회전 */}
        <g transform={`rotate(-90 ${CENTER} ${CENTER})`}>
          <circle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            fill="none"
            stroke="currentColor"
            strokeWidth={26}
            className="text-muted-foreground/10"
          />
          <circle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            fill="none"
            stroke={color.stroke}
            strokeWidth={26}
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - ratio)}
          />
        </g>
      </svg>

      {/* 가운데 시간 */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn('text-3xl font-bold tabular-nums', color.text)}>{centerLabel}</span>
        {caption && <span className="mt-1 text-xs text-muted-foreground">{caption}</span>}
      </div>
    </div>
  );
}
