// pages/goalSettings/components/ProgressEditor.tsx
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import type { GoalProgressAmount } from '@/types/goal';

interface ProgressEditorProps {
  /** 지금 저장된 진도. 아직 없으면 undefined */
  progress?: GoalProgressAmount;
  /** 편집을 마쳤을 때(포커스가 빠질 때) 저장한다 */
  onCommit: (progress: GoalProgressAmount) => void;
}

/**
 * 진도 편집 — "3 / 24 소주제".
 *
 * AI가 set_progress로 잘못 세웠을 때(실제로 1을 4로 저장한 적이 있다) 사용자가
 * 바로잡는 길이다. 그 전에는 읽기 전용이라 고칠 방법이 아예 없었다.
 *
 * 타자마다 저장하면 "2"를 지우고 "24"를 치는 중간에 2가 저장된다.
 * 포커스가 빠질 때 한 번만 보낸다(기한은 날짜 선택이라 즉시 저장해도 된다).
 *
 * 저장 뒤 서버가 잘라낸 값(0 ≤ current ≤ total)을 입력칸에 되비추는 건
 * 부모가 key 로 이 컴포넌트를 새로 만들어 처리한다. effect 안에서 setState 하면
 * 린트가 잡고, 타이핑 중에 값이 튈 위험도 있다.
 */
export default function ProgressEditor({ progress, onCommit }: ProgressEditorProps) {
  const [current, setCurrent] = useState(String(progress?.current ?? 0));
  const [total, setTotal] = useState(String(progress?.total ?? 0));
  const [unit, setUnit] = useState(progress?.unit ?? '');

  const commit = () => {
    const next = {
      current: Number(current) || 0,
      total: Number(total) || 0,
      unit: unit.trim(),
    };
    const unchanged =
      next.current === (progress?.current ?? 0) &&
      next.total === (progress?.total ?? 0) &&
      next.unit === (progress?.unit ?? '');
    if (unchanged) return;
    onCommit(next);
  };

  return (
    <span className="flex items-center gap-1">
      <Input
        type="number"
        min={0}
        value={current}
        onChange={(e) => setCurrent(e.target.value)}
        onBlur={commit}
        aria-label="현재 진도"
        className="h-9 w-14 px-2 text-center"
      />
      <span className="text-sm text-muted-foreground">/</span>
      <Input
        type="number"
        min={0}
        value={total}
        onChange={(e) => setTotal(e.target.value)}
        onBlur={commit}
        aria-label="전체 분량"
        className="h-9 w-14 px-2 text-center"
      />
      <Input
        value={unit}
        onChange={(e) => setUnit(e.target.value)}
        onBlur={commit}
        placeholder="단위"
        aria-label="진도 단위"
        maxLength={10}
        className="h-9 w-16 px-2"
      />
    </span>
  );
}
