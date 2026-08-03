// components/FieldLabel.tsx
import { Label } from '@/components/ui/label';

interface FieldLabelProps {
  /** 이 라벨이 가리키는 입력 칸의 id */
  htmlFor: string;
  label: string;
  /** 이름 옆에 빨간 * 를 붙인다 */
  isRequired?: boolean;
  /** 오른쪽에 '현재/최대' 글자수를 보여준다. 둘 다 있어야 표시한다 */
  length?: number;
  maxLength?: number;
}

/** 입력 칸 위에 붙는 이름 줄. 필요하면 오른쪽 끝에 글자수를 함께 보여준다 */
export default function FieldLabel({
  htmlFor,
  label,
  isRequired,
  length,
  maxLength,
}: FieldLabelProps) {
  const showsCount = length !== undefined && maxLength !== undefined;

  return (
    <div className="flex items-baseline justify-between">
      <Label htmlFor={htmlFor}>
        {label}
        {isRequired && <span className="text-destructive"> *</span>}
      </Label>
      {showsCount && (
        <span className="text-xs text-muted-foreground">
          {length}/{maxLength}
        </span>
      )}
    </div>
  );
}
