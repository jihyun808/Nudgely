// components/CreateGoalModal.tsx
import { useState, type FormEvent } from 'react';
import ImagePicker from '@/components/ImagePicker';
import Modal from '@/components/Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { GOAL_LIMITS, GOAL_PERSONAS, type CreateGoalInput, type GoalPersona } from '@/types/goal';

interface CreateGoalModalProps {
  onClose: () => void;
  onCreate: (input: CreateGoalInput) => Promise<void> | void;
}

/**
 * 목표(=채팅방) 개설 팝업.
 * 채팅 탭의 + 버튼과 홈의 '목표 추가하기'가 같은 팝업을 쓴다.
 * 채팅방 이름(별명) / 사진 / AI 성격 / 목표 이름 / 프롬프트를 받고, 필수값은 채팅방 이름 하나뿐이다.
 */
export default function CreateGoalModal({ onClose, onCreate }: CreateGoalModalProps) {
  const [name, setName] = useState('');
  const [imageUrl, setImageUrl] = useState<string>();
  const [title, setTitle] = useState('');
  const [prompt, setPrompt] = useState('');
  /** 빈 문자열이면 '선택 안 함' */
  const [persona, setPersona] = useState<GoalPersona | ''>('');
  const [submitError, setSubmitError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    // 사진·목표 이름·프롬프트는 비워도 되고 나중에 설정에서 수정한다
    if (!name.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setSubmitError(undefined);
    try {
      await onCreate({
        name: name.trim(),
        imageUrl,
        title: title.trim(),
        prompt: prompt.trim(),
        persona: persona || undefined,
      });
      onClose();
    } catch {
      setSubmitError('목표를 만들지 못했어요. 다시 시도해주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal title="새 목표 만들기" onClose={onClose}>
      <form onSubmit={(e) => void handleSubmit(e)}>
        <div className="mt-4">
          <ImagePicker imageUrl={imageUrl} onChange={setImageUrl} label="목표 사진 선택" />
        </div>

        {/* 목표 이름 (필수) */}
        <div className="mt-5 flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between">
            <Label htmlFor="goal-name">
              채팅방 이름 <span className="text-destructive">*</span>
            </Label>
            <span className="text-xs text-muted-foreground">
              {name.length}/{GOAL_LIMITS.name}
            </span>
          </div>
          <Input
            id="goal-name"
            value={name}
            maxLength={GOAL_LIMITS.name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예) 스터디 메이트"
            autoFocus
          />
        </div>

        {/* AI 페르소나 (선택) */}
        <div className="mt-4 flex flex-col gap-1.5">
          <Label htmlFor="goal-persona">AI 성격</Label>
          <Select
            id="goal-persona"
            value={persona}
            onChange={(e) => setPersona(e.target.value as GoalPersona | '')}
          >
            <option value="">선택 안 함</option>
            {GOAL_PERSONAS.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>

        {/* 목표 이름 (홈·기록 카드 제목으로도 쓰인다) */}
        <div className="mt-4 flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between">
            <Label htmlFor="goal-title">목표</Label>
            <span className="text-xs text-muted-foreground">
              {title.length}/{GOAL_LIMITS.title}
            </span>
          </div>
          <Input
            id="goal-title"
            value={title}
            maxLength={GOAL_LIMITS.title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="예) UI/UX 디자인 강의 완주"
          />
        </div>

        {/* 프롬프트 */}
        <div className="mt-4 flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between">
            <Label htmlFor="goal-prompt">프롬프트</Label>
            <span className="text-xs text-muted-foreground">
              {prompt.length}/{GOAL_LIMITS.prompt}
            </span>
          </div>
          <Textarea
            id="goal-prompt"
            value={prompt}
            maxLength={GOAL_LIMITS.prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="AI가 어떤 말투와 역할로 대화하면 좋을지 적어주세요"
            className="h-28 resize-none"
          />
        </div>

        {submitError && (
          <p role="alert" className="mt-4 text-center text-xs text-destructive">
            {submitError}
          </p>
        )}

        <div className="mt-6 flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={onClose}
            disabled={isSubmitting}
          >
            취소
          </Button>
          <Button type="submit" className="flex-1" disabled={!name.trim() || isSubmitting}>
            {isSubmitting ? '만드는 중...' : '만들기'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
