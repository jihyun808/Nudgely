// pages/settings/components/SettingsSection.tsx
import type { ReactNode } from 'react';

interface SettingsSectionProps {
  title: string;
  children: ReactNode;
}

/** 설정 화면의 한 묶음. 제목 아래에 항목들이 카드로 들어간다 */
export default function SettingsSection({ title, children }: SettingsSectionProps) {
  return (
    <section className="mt-6">
      <h2 className="mb-2 text-sm font-bold">{title}</h2>
      <div className="divide-y divide-border rounded-2xl border border-border bg-background">
        {children}
      </div>
    </section>
  );
}
