// pages/focus/components/FocusGoalPicker.tsx
import { useCallback, useEffect } from 'react';
import { fetchGoals } from '@/api/goal';
import { Select } from '@/components/ui/select';
import { useCachedQuery } from '@/lib/useCachedQuery';
import type { Goal } from '@/types/goal';

interface FocusGoalPickerProps {
  /** 고른 목표 id. 안 골랐으면 undefined */
  value?: string;
  onChange: (goalId: string | undefined) => void;
  /** 아직 저장되지 않은 집중이 진행 중이면 잠근다 */
  disabled?: boolean;
}

const EMPTY: Goal[] = [];

/**
 * "무엇에 집중하나요?" — 집중 세션에 붙일 목표를 고른다.
 *
 * 고르면 그 목표의 집중 시간으로 쌓여 모아보기 진도 탭에 나온다.
 * 고르지 않아도 오늘 집중 시간에는 그대로 들어가므로 선택은 어디까지나 선택이다.
 * 진행 중인 목표가 하나도 없으면 고를 게 없으니 아예 그리지 않는다.
 */
export default function FocusGoalPicker({ value, onChange, disabled }: FocusGoalPickerProps) {
  const load = useCallback(() => fetchGoals(), []);
  // 탭에 들어올 때마다 새로 받으면 토글이 한 박자 늦게 나타난다
  const { data: goals } = useCachedQuery<Goal[]>('focus:goals', load, EMPTY);

  // 고를 수 없게 된 목표(삭제·완주)가 남아 있으면 선택을 비운다
  useEffect(() => {
    if (value && goals.length > 0 && !goals.some(({ id }) => id === value)) onChange(undefined);
  }, [goals, value, onChange]);

  if (goals.length === 0) return null;

  return (
    <label className="mt-4 block">
      <Select
        className="mt-1.5 shadow-none"
        value={value ?? ''}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value || undefined)}
      >
        <option value="">선택 안 함</option>
        {goals.map((goal) => (
          <option key={goal.id} value={goal.id}>
            {goal.title || goal.name}
          </option>
        ))}
      </Select>
    </label>
  );
}
