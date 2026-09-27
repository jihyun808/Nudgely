// pages/focus/components/CurrentPlanNotice.tsx

interface CurrentPlanNoticeProps {
  /** 지금 시간대에 잡힌 계획 제목 */
  planTitle: string;
}

/** 텐미닛 플래너에 잡힌 지금 시간대의 계획을 타이머 위에 알려준다 */
export default function CurrentPlanNotice({ planTitle }: CurrentPlanNoticeProps) {
  return (
    <p className="text-center text-sm text-muted-foreground">
      지금은 <span className="font-semibold text-foreground">{planTitle}</span> 집중하는 시간이에요
    </p>
  );
}
