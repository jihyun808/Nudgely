// pages/goalSettings/components/GoalOptionsSection.tsx
import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import SettingsRow from '@/pages/settings/components/SettingsRow';
import SettingsSection from '@/pages/settings/components/SettingsSection';
import ProgressEditor from '@/pages/goalSettings/components/ProgressEditor';
import { GOAL_LIMITS, type GoalDetail, type GoalProgressAmount } from '@/types/goal';

interface GoalOptionsSectionProps {
  goal: GoalDetail;
  dueDate: string;
  onChangeDueDate: (dueDate: string) => void;
  onChangeProgress: (progress: GoalProgressAmount) => void;
  /** 장기 노트. 입력을 멈추면 잠시 뒤, 그리고 화면을 나갈 때 저장한다 */
  onChangeMemory: (memory: string) => void;
  onToggleMute: (isMuted: boolean) => void;
}

/** 입력을 멈추고 이만큼 지나면 장기 노트를 저장한다 */
const MEMORY_SAVE_DELAY_MS = 800;

/** 기한 · 진도 · 장기 노트 · 알림 설정 묶음 */
export default function GoalOptionsSection({
  goal,
  dueDate,
  onChangeDueDate,
  onChangeProgress,
  onChangeMemory,
  onToggleMute,
}: GoalOptionsSectionProps) {
  const { progress, isNotificationMuted, completedAt } = goal;
  const [memory, setMemory] = useState(goal.memory ?? '');

  // 입력칸을 벗어날 때만 저장하면, 쓰다가 바로 뒤로 가기를 눌렀을 때 화면이 먼저
  // 사라져 저장이 안 된다. 입력을 멈추면 저장하고, 화면을 나갈 때 남은 걸 마저 저장한다
  const savedMemoryRef = useRef(goal.memory ?? '');
  const draftRef = useRef(memory);
  const onChangeMemoryRef = useRef(onChangeMemory);
  useEffect(() => {
    draftRef.current = memory;
    onChangeMemoryRef.current = onChangeMemory;
  });

  const saveMemory = () => {
    const next = draftRef.current.trim();
    if (next === savedMemoryRef.current) return;
    savedMemoryRef.current = next;
    onChangeMemoryRef.current(next);
  };

  useEffect(() => {
    const timer = setTimeout(saveMemory, MEMORY_SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [memory]);

  useEffect(() => saveMemory, []);
  /** 완주한 목표에는 알림·선톡이 오지 않으므로 토글을 잠근다 */
  const isCompleted = Boolean(completedAt);

  return (
    <>
      <SettingsSection title="목표">
        <SettingsRow
          label="기한"
          control={
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => onChangeDueDate(e.target.value)}
              aria-label="목표 기한"
              className="h-9 w-auto"
            />
          }
        />
        <SettingsRow
          label="진도"
          control={
            <ProgressEditor
              // 저장 뒤 서버가 잘라낸 값이 내려오면 입력칸을 새로 그린다
              key={`${progress?.current}-${progress?.total}-${progress?.unit}`}
              progress={progress}
              onCommit={onChangeProgress}
            />
          }
        />
      </SettingsSection>

      {/* 이 목표에서 지킬 규칙·약속. AI 가 대화하며 쌓고, 여기서 고친다 */}
      <SettingsSection title="장기 노트">
        <div className="p-3">
          <Textarea
            value={memory}
            maxLength={GOAL_LIMITS.memory}
            onChange={(e) => setMemory(e.target.value)}
            onBlur={saveMemory}
            aria-label="장기 노트"
            className="h-28 resize-none"
          />
          <p className="mt-1 text-right text-xs text-muted-foreground">
            {memory.length}/{GOAL_LIMITS.memory}
          </p>
        </div>
      </SettingsSection>

      <SettingsSection title="알림">
        <SettingsRow
          label="이 목표 알림 끄기"
          disabled={isCompleted}
          control={
            <Switch
              checked={isCompleted || Boolean(isNotificationMuted)}
              disabled={isCompleted}
              onChange={onToggleMute}
              aria-label="이 목표 알림 끄기"
            />
          }
        />
      </SettingsSection>
    </>
  );
}
