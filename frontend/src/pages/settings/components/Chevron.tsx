// pages/settings/components/Chevron.tsx

/** 눌러서 들어가는 설정 항목 오른쪽의 화살표 */
export default function Chevron() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="h-4 w-4 shrink-0 text-muted-foreground"
    >
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}
