// pages/focus/components/FocusGoalPicker.tsx
import { useEffect, useState } from 'react';
import { fetchGoals } from '@/api/goal';
import { Select } from '@/components/ui/select';
import type { Goal } from '@/types/goal';

interface FocusGoalPickerProps {
  /** 고른 목표 id. 안 골랐으면 undefined */
  value?: string;
  onChange: (goalId: string | undefined) => void;
  /** 아직 저장되지 않은 집중이 진행 중이면 잠근다 */
  disabled?: boolean;
}

/**
 * "무엇에 집중하나요?" — 집중 세션에 붙일 목표를 고른다.
 *
 * 고르면 그 목표의 집중 시간으로 쌓여 모아보기 진도 탭에 나온다.
 * 고르지 않아도 오늘 집중 시간에는 그대로 들어가므로 선택은 어디까지나 선택이다.
 * 진행 중인 목표가 하나도 없으면 고를 게 없으니 아예 그리지 않는다.
 */
export default function FocusGoalPicker({ value, onChange, disabled }: FocusGoalPickerProps) {
  const [goals, setGoals] = useState<Goal[]>([]);

  useEffect(() => {
    let isStale = false;
    fetchGoals()
      .then((data) => {
        if (isStale) return;
        setGoals(data);
        // 고를 수 없게 된 목표(삭제·완주)가 남아 있으면 선택을 비운다
        if (value && !data.some(({ id }) => id === value)) onChange(undefined);
      })
      .catch(() => {
        // 목록을 못 받아도 타이머는 그대로 쓸 수 있어야 한다
      });
    return () => {
      isStale = true;
    };
    // 목록은 화면에 들어올 때 한 번만 받는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
