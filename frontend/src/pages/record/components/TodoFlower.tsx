// pages/record/components/TodoFlower.tsx

/**
 * 목표별 꽃잎 색.
 * 앱 팔레트를 파스텔로 낮춘 값이다. 겹치면 곱해져 진해지므로 밝게 시작해야
 * 4장이 겹쳐도 날짜 숫자가 읽힌다.
 */
const GOAL_COLORS = ['#A8C4F7', '#A6DCC0', '#F5C4A0', '#CDBDF8', '#F7E0A3'] as const;

/** 같은 목표면 항상 같은 색이 나오도록 id로 색을 고정한다 */
function getGoalColor(goalId: string) {
  const sum = [...goalId].reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return GOAL_COLORS[sum % GOAL_COLORS.length];
}

/** 꽃잎이 놓이는 자리 (좌상 → 우상 → 좌하 → 우하) */
const PETAL_POSITIONS = ['top-0 left-0', 'top-0 right-0', 'bottom-0 left-0', 'bottom-0 right-0'];

/** 한 칸에 그릴 수 있는 최대 꽃잎 수 */
const MAX_PETALS = 4;

interface TodoFlowerProps {
  /** 그날 완료한 항목들이 속한 목표 id (항목 하나가 꽃잎 하나) */
  doneGoalIds: string[];
}

/**
 * 하루의 완료 표시.
 * 완료한 항목 하나마다 꽃잎이 한 장 피고, 색은 그 항목이 속한 목표를 따른다.
 * 겹친 부분은 `mix-blend-multiply`로 색이 곱해져 더 진해진다.
 */
export default function TodoFlower({ doneGoalIds }: TodoFlowerProps) {
  // 많이 한 날도 네 장까지만 그린다 (꽉 찬 꽃 = 아주 잘한 날)
  const petals = doneGoalIds.slice(0, MAX_PETALS);
  if (petals.length === 0) return null;

  // 하나뿐이면 가운데에 둔다
  if (petals.length === 1) {
    return (
      <span
        aria-hidden
        className="petal-pop absolute inset-0 m-auto h-5 w-5 rounded-full"
        style={{ backgroundColor: getGoalColor(petals[0]) }}
      />
    );
  }

  return (
    <span aria-hidden className="absolute inset-0">
      {petals.map((goalId, index) => (
        <span
          key={`${goalId}-${index}`}
          className={`petal-pop absolute h-4.5 w-4.5 rounded-full mix-blend-multiply ${PETAL_POSITIONS[index]}`}
          // 꽃잎이 차례로 피어나게 살짝씩 늦춘다
          style={{ backgroundColor: getGoalColor(goalId), animationDelay: `${index * 45}ms` }}
        />
      ))}
    </span>
  );
}
