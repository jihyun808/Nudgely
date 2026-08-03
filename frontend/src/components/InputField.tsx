// components/InputField.tsx
import { useId } from 'react';
import FieldLabel from '@/components/FieldLabel';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface InputFieldProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  /** 글자수 제한. showsCount와 함께 쓰면 라벨 오른쪽에 '현재/최대'가 뜬다 */
  maxLength?: number;
  showsCount?: boolean;
  /** 라벨에 * 를 붙인다 */
  isRequired?: boolean;
  autoFocus?: boolean;
  /** 바깥 여백 등 간격 조절용 */
  className?: string;
}

/**
 * 라벨 + 입력 칸 한 묶음.
 * 바깥 여백은 두지 않으니 간격은 쓰는 쪽에서 정한다.
 */
const InputField = ({
  label,
  value,
  onChange,
  placeholder = '',
  type = 'text',
  maxLength,
  showsCount,
  isRequired,
  autoFocus,
  className,
}: InputFieldProps) => {
  const id = useId();

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <FieldLabel
          htmlFor={id}
          label={label}
          isRequired={isRequired}
          length={showsCount ? value.length : undefined}
          maxLength={showsCount ? maxLength : undefined}
        />
      )}
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        autoFocus={autoFocus}
      />
    </div>
  );
};

export default InputField;
