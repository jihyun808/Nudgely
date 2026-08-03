import { useId } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface InputFieldProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  /** 글자수 제한 */
  maxLength?: number;
  autoFocus?: boolean;
}

const InputField = ({
  label,
  value,
  onChange,
  placeholder = '',
  type = 'text',
  maxLength,
  autoFocus,
}: InputFieldProps) => {
  const id = useId();

  return (
    <div className="mb-4 flex flex-col gap-1.5">
      {label && <Label htmlFor={id}>{label}</Label>}
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
