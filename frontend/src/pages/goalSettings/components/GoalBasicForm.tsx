// pages/goalSettings/components/GoalBasicForm.tsx
import FieldLabel from '@/components/FieldLabel';
import ImagePicker from '@/components/ImagePicker';
import InputField from '@/components/InputField';
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

      <InputField
        className="mt-5"
        label="채팅방 이름"
        showsCount
        maxLength={GOAL_LIMITS.name}
        value={values.name}
        onChange={(name) => update({ name })}
      />

      <InputField
        className="mt-4"
        label="목표"
        showsCount
        maxLength={GOAL_LIMITS.title}
        value={values.title}
        onChange={(title) => update({ title })}
        placeholder="예) UI/UX 디자인 강의 완주"
      />

      <div className="mt-4 flex flex-col gap-1.5">
        <FieldLabel
          htmlFor="goal-setting-prompt"
          label="프롬프트"
          length={values.prompt.length}
          maxLength={GOAL_LIMITS.prompt}
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
