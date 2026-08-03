// layouts/BottomNav.tsx
import { NavLink } from 'react-router-dom';
import type { ComponentType, SVGProps } from 'react';

/**
 * 하단 탭바(바텀시트).
 * 홈 / 채팅 / 집중 / 기록 / 마이 다섯 개의 탭을 오간다.
 * 선택된 탭은 브랜드 색(primary)으로 상단 인디케이터 바 + 아이콘 + 라벨이 표시되고,
 * 나머지는 회색(muted-foreground)으로 표시된다.
 */

type IconProps = SVGProps<SVGSVGElement>;

const HomeIcon = (props: IconProps) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.5V21h14V9.5" />
  </svg>
);

const ChatIcon = (props: IconProps) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M21 11.5a8.5 8.5 0 0 1-12.3 7.6L3 21l1.9-5.7A8.5 8.5 0 1 1 21 11.5Z" />
  </svg>
);

const RecordIcon = (props: IconProps) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <rect x="3" y="4" width="18" height="17" rx="2" />
    <path d="M3 9h18M8 2v4M16 2v4" />
  </svg>
);

const FocusIcon = (props: IconProps) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);

const UserIcon = (props: IconProps) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" />
  </svg>
);

const TABS: { to: string; label: string; Icon: ComponentType<IconProps> }[] = [
  { to: '/home', label: '홈', Icon: HomeIcon },
  { to: '/chat', label: '채팅', Icon: ChatIcon },
  { to: '/focus', label: '집중', Icon: FocusIcon },
  { to: '/record', label: '기록', Icon: RecordIcon },
  { to: '/my', label: '마이', Icon: UserIcon },
];

export default function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-background">
      <ul className="mx-auto flex max-w-md">
        {TABS.map(({ to, label, Icon }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              className="group relative flex flex-col items-center gap-1 py-2 text-muted-foreground [&.active]:text-primary"
            >
              {/* 선택 시 상단 인디케이터 바 */}
              <span className="absolute inset-x-6 top-0 h-0.5 rounded-full bg-transparent group-[.active]:bg-primary" />
              <Icon className="h-6 w-6" />
              <span className="text-xs font-medium">{label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
