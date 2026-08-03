// pages/settings/components/HourSelect.tsx

interface HourSelectProps {
  value: number;
  onChange: (hour: number) => void;
  /** 고를 수 있는 시각 범위 (끝 포함) */
  min: number;
  max: number;
  label: string;
  disabled?: boolean;
}

/** 시각(시 단위) 선택 드롭다운. 예: 06:00 */
export default function HourSelect({
  value,
  onChange,
  min,
  max,
  label,
  disabled,
}: HourSelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      aria-label={label}
      disabled={disabled}
      className="rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm disabled:opacity-40"
    >
      {Array.from({ length: max - min + 1 }, (_, i) => min + i).map((hour) => (
        <option key={hour} value={hour}>
          {String(hour).padStart(2, '0')}:00
        </option>
      ))}
    </select>
  );
}
