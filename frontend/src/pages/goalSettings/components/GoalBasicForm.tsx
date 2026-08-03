// pages/goalSettings/components/GoalBasicForm.tsx
import ImagePicker from '@/components/ImagePicker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { GOAL_LIMITS } from '@/types/goal';

export interface GoalBasicValues {
  name: string;
  title: string;
  prompt: string;
  imageUrl?: string;
}

interface GoalBasicFormProps {
  values: GoalBasicValues;
  onChange: (values: GoalBasicValues) => void;
}

/** 글자수 표시가 붙은 입력 한 줄 */
function FieldLabel({
  id,
  label,
  length,
  max,
}: {
  id: string;
  label: string;
  length: number;
  max: number;
}) {
  return (
    <div className="flex items-baseline justify-between">
      <Label htmlFor={id}>{label}</Label>
      <span className="text-xs text-muted-foreground">
        {length}/{max}
      </span>
    </div>
  );
}

/**
 * 목표 기본 정보 입력.
 * 개설 팝업과 같은 항목(사진·채팅방 이름·목표 이름·프롬프트)을 수정한다.
 */
export default function GoalBasicForm({ values, onChange }: GoalBasicFormProps) {
  const update = (patch: Partial<GoalBasicValues>) => onChange({ ...values, ...patch });

  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <ImagePicker
        imageUrl={values.imageUrl}
        onChange={(imageUrl) => update({ imageUrl })}
        label="목표 사진 변경"
      />

      <div className="mt-5 flex flex-col gap-1.5">
        <FieldLabel
          id="goal-setting-name"
          label="채팅방 이름"
          length={values.name.length}
          max={GOAL_LIMITS.name}
        />
        <Input
          id="goal-setting-name"
          value={values.name}
          maxLength={GOAL_LIMITS.name}
          onChange={(e) => update({ name: e.target.value })}
        />
      </div>

      <div className="mt-4 flex flex-col gap-1.5">
        <FieldLabel
          id="goal-setting-title"
          label="목표"
          length={values.title.length}
          max={GOAL_LIMITS.title}
        />
        <Input
          id="goal-setting-title"
          value={values.title}
          maxLength={GOAL_LIMITS.title}
          onChange={(e) => update({ title: e.target.value })}
          placeholder="예) UI/UX 디자인 강의 완주"
        />
      </div>

      <div className="mt-4 flex flex-col gap-1.5">
        <FieldLabel
          id="goal-setting-prompt"
          label="프롬프트"
          length={values.prompt.length}
          max={GOAL_LIMITS.prompt}
        />
        <Textarea
          id="goal-setting-prompt"
          value={values.prompt}
          maxLength={GOAL_LIMITS.prompt}
          onChange={(e) => update({ prompt: e.target.value })}
          placeholder="AI가 어떤 말투와 역할로 대화하면 좋을지 적어주세요"
          className="h-28 resize-none"
        />
      </div>
    </div>
  );
}
