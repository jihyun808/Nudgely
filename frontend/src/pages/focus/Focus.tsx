// pages/focus/Focus.tsx
import PageHeader from '@/components/PageHeader';

/**
 * 집중 탭.
 * TODO: 집중 세션(타이머) 화면 구현. 이후 홈의 '집중 시작하기' CTA와 연결하고,
 *       홈·마이의 집중 시간·연속 달성일 하드코딩 값을 이 데이터로 교체한다.
 */
export default function Focus() {
  return (
    <div>
      <PageHeader title="집중" />
      <p className="mt-20 text-center text-sm text-muted-foreground">집중 화면은 준비 중이에요</p>
    </div>
  );
}
