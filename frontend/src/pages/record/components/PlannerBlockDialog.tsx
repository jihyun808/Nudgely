// pages/record/components/PlannerBlockDialog.tsx
import { useState } from 'react';
import FormDialog from '@/components/FormDialog';
import InputField from '@/components/InputField';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { buildTimeOptions } from '@/pages/record/plannerTime';
import { PLANNER_BLOCK_MINUTES, type PlannerBlock, type PlannerBlockInput } from '@/types/planner';

/** 제목 글자수 제한 */
const TITLE_MAX = 30;

interface PlannerBlockDialogProps {
  /** 수정할 기록. 없으면 추가 모드 */
  block?: PlannerBlock;
  /** 추가 모드에서 미리 채워둘 시작 시각(분) */
  defaultStartMinutes: number;
  /** 고를 수 있는 시간 범위(시). 플래너 표에 보이는 범위와 같다 */
  startHour: number;
  endHour: number;
  /** 아직 오지 않은 시간은 기록할 수 없다. 고를 수 있는 마지막 시각(자정 기준 분) */
  maxMinutes: number;
  onSubmit: (input: PlannerBlockInput) => Promise<void>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
}

/**
 * 텐미닛 플래너의 실제 기록을 추가·수정하는 팝업.
 * 빈 시간대를 누르면 추가 모드로, 이미 있는 막대를 누르면 수정 모드로 열린다.
 * 계획(AI가 정한 것)은 여기서 건드리지 않는다.
 */
export default function PlannerBlockDialog({
  block,
  defaultStartMinutes,
  startHour,
  endHour,
  maxMinutes,
  onSubmit,
  onDelete,
  onClose,
}: PlannerBlockDialogProps) {
  const rangeStart = startHour * 60;
  const blockEnd = block ? block.startMinutes + block.durationMinutes : 0;
  // 표의 끝과 '지금' 중 이른 쪽까지만 고를 수 있다.
  // 기준 시각은 10분 단위로 내려가므로(14:45 → 14:40) 방금 끝난 집중처럼
  // 그 사이에서 끝난 블록은 자기 끝시각이 목록에서 빠진다. 그 한 칸만 열어둔다.
  const rangeEnd = Math.max(Math.min(endHour * 60, maxMinutes), blockEnd);

  const [title, setTitle] = useState(block?.title ?? '');
  const [startMinutes, setStartMinutes] = useState(block?.startMinutes ?? defaultStartMinutes);
  const [endMinutes, setEndMinutes] = useState(
    block ? blockEnd : Math.min(defaultStartMinutes + 60, rangeEnd),
  );

  // 시작은 마지막 한 칸을 뺀 범위, 종료는 시작 다음 칸부터 고를 수 있다
  const startOptions = buildTimeOptions(rangeStart, rangeEnd - PLANNER_BLOCK_MINUTES);
  const endOptions = buildTimeOptions(startMinutes + PLANNER_BLOCK_MINUTES, rangeEnd);

  const handleChangeStart = (next: number) => {
    setStartMinutes(next);
    // 시작이 종료를 넘어서면 종료를 한 칸 뒤로 밀어준다
    if (next >= endMinutes) setEndMinutes(next + PLANNER_BLOCK_MINUTES);
  };

  return (
    <FormDialog
      title={block ? '기록 수정' : '기록 추가'}
      validate={() => (title.trim() ? undefined : '무엇을 했는지 적어주세요.')}
      onSubmit={() =>
        onSubmit({
          title: title.trim(),
          startMinutes,
          durationMinutes: endMinutes - startMinutes,
        })
      }
      onDelete={onDelete}
      deleteLabel="이 기록 삭제"
      onClose={onClose}
    >
      <div className="mt-4">
        <InputField
          label="무엇을 했나요"
          value={title}
          onChange={setTitle}
          placeholder="예: UI/UX 21강 수강"
          maxLength={TITLE_MAX}
          autoFocus
        />
      </div>

      <div className="flex items-end gap-2">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="planner-start">시작</Label>
          <Select
            id="planner-start"
            value={startMinutes}
            onChange={(e) => handleChangeStart(Number(e.target.value))}
          >
            {startOptions.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>

        <span className="pb-2.5 text-sm text-muted-foreground">~</span>

        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="planner-end">종료</Label>
          <Select
            id="planner-end"
            value={endMinutes}
            onChange={(e) => setEndMinutes(Number(e.target.value))}
          >
            {endOptions.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        {endMinutes - startMinutes}분 ({(endMinutes - startMinutes) / PLANNER_BLOCK_MINUTES}블록)
      </p>
    </FormDialog>
  );
}
