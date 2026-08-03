// pages/chat/components/ChatDateDivider.tsx
import { formatDateDivider } from '@/utils/date';

interface ChatDateDividerProps {
  /** 이 구분선 아래 메시지들의 날짜 (ISO 문자열) */
  date: string;
}

/** 날짜가 바뀌는 지점에 들어가는 구분선. '오늘' / '어제' / 'YYYY년 M월 D일 요일' */
export default function ChatDateDivider({ date }: ChatDateDividerProps) {
  return (
    <div className="py-2 text-center">
      <span className="text-xs text-muted-foreground">{formatDateDivider(date)}</span>
    </div>
  );
}
