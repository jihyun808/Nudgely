// pages/settings/components/SettingsHeader.tsx
import { useNavigate } from 'react-router-dom';

/** 설정 화면 상단 헤더. 뒤로가기 + 제목 */
export default function SettingsHeader() {
  const navigate = useNavigate();

  return (
    <header className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => navigate(-1)}
        aria-label="뒤로 가기"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-foreground transition-colors active:bg-muted-foreground/10"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5"
        >
          <path d="m15 18-6-6 6-6" />
        </svg>
      </button>
      <h1 className="text-2xl font-bold">설정</h1>
    </header>
  );
}
