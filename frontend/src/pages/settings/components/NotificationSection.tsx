// pages/settings/components/NotificationSection.tsx
import { Switch } from '@/components/ui/switch';
import HourSelect from '@/pages/settings/components/HourSelect';
import SettingsRow from '@/pages/settings/components/SettingsRow';
import SettingsSection from '@/pages/settings/components/SettingsSection';
import type { DoNotDisturbSettings, NotificationSettings } from '@/types/settings';

interface NotificationSectionProps {
  notifications: NotificationSettings;
  doNotDisturb: DoNotDisturbSettings;
  onChangeNotifications: (value: NotificationSettings) => void;
  onChangeDoNotDisturb: (value: DoNotDisturbSettings) => void;
}

/**
 * 알림 설정 묶음.
 * 전체 알림을 끄면 하위 항목(선톡·투두·마감)은 조작할 수 없다.
 */
export default function NotificationSection({
  notifications,
  doNotDisturb,
  onChangeNotifications,
  onChangeDoNotDisturb,
}: NotificationSectionProps) {
  const isOff = !notifications.enabled;

  return (
    <SettingsSection title="알림">
      <SettingsRow
        label="전체 알림"
        description="끄면 아래 알림을 모두 받지 않아요"
        control={
          <Switch
            checked={notifications.enabled}
            onChange={(enabled) => onChangeNotifications({ ...notifications, enabled })}
            aria-label="전체 알림"
          />
        }
      />
      <SettingsRow
        label="AI 선톡·독촉"
        isNested
        disabled={isOff}
        control={
          <Switch
            checked={notifications.nudge}
            disabled={isOff}
            onChange={(nudge) => onChangeNotifications({ ...notifications, nudge })}
            aria-label="AI 선톡·독촉 알림"
          />
        }
      />
      <SettingsRow
        label="투두 추가·완료"
        isNested
        disabled={isOff}
        control={
          <Switch
            checked={notifications.todo}
            disabled={isOff}
            onChange={(todo) => onChangeNotifications({ ...notifications, todo })}
            aria-label="투두 알림"
          />
        }
      />
      <SettingsRow
        label="마감 리마인더"
        description="밤 11시에 남은 투두와 플래너를 알려줘요"
        isNested
        disabled={isOff}
        control={
          <Switch
            checked={notifications.deadline}
            disabled={isOff}
            onChange={(deadline) => onChangeNotifications({ ...notifications, deadline })}
            aria-label="마감 리마인더"
          />
        }
      />

      <SettingsRow
        label="방해 금지 시간"
        description="이 시간에는 알림이 오지 않아요"
        control={
          <Switch
            checked={doNotDisturb.enabled}
            onChange={(enabled) => onChangeDoNotDisturb({ ...doNotDisturb, enabled })}
            aria-label="방해 금지 시간"
          />
        }
      />
      {doNotDisturb.enabled && (
        <SettingsRow
          label="시간대"
          isNested
          control={
            <span className="flex items-center gap-1.5">
              <HourSelect
                value={doNotDisturb.startHour}
                onChange={(startHour) => onChangeDoNotDisturb({ ...doNotDisturb, startHour })}
                min={0}
                max={23}
                label="방해 금지 시작 시각"
              />
              <span className="text-sm text-muted-foreground">~</span>
              <HourSelect
                value={doNotDisturb.endHour}
                onChange={(endHour) => onChangeDoNotDisturb({ ...doNotDisturb, endHour })}
                min={0}
                max={23}
                label="방해 금지 종료 시각"
              />
            </span>
          }
        />
      )}
    </SettingsSection>
  );
}
