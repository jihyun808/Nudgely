// pages/settings/components/PlannerSection.tsx
import HourSelect from '@/pages/settings/components/HourSelect';
import SettingsRow from '@/pages/settings/components/SettingsRow';
import SettingsSection from '@/pages/settings/components/SettingsSection';
import { PLANNER_HOUR_RANGE, type PlannerSettings } from '@/types/settings';

interface PlannerSectionProps {
  planner: PlannerSettings;
  onChange: (value: PlannerSettings) => void;
}

/** 기록 설정 묶음. 지금은 플래너 표시 시간대만 있다 */
export default function PlannerSection({ planner, onChange }: PlannerSectionProps) {
  return (
    <SettingsSection title="기록">
      <SettingsRow
        label="플래너 표시 시간대"
        description="텐미닛 플래너 표에 그릴 범위예요"
        control={
          <span className="flex items-center gap-1.5">
            <HourSelect
              value={planner.startHour}
              // 시작이 종료를 넘지 않도록 서로 보정한다
              onChange={(startHour) =>
                onChange({ ...planner, startHour: Math.min(startHour, planner.endHour - 1) })
              }
              min={PLANNER_HOUR_RANGE.min}
              max={PLANNER_HOUR_RANGE.max - 1}
              label="플래너 시작 시각"
            />
            <span className="text-sm text-muted-foreground">~</span>
            <HourSelect
              value={planner.endHour}
              onChange={(endHour) =>
                onChange({ ...planner, endHour: Math.max(endHour, planner.startHour + 1) })
              }
              min={PLANNER_HOUR_RANGE.min + 1}
              max={PLANNER_HOUR_RANGE.max}
              label="플래너 종료 시각"
            />
          </span>
        }
      />
    </SettingsSection>
  );
}
