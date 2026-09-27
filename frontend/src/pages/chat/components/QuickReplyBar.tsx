// pages/chat/components/QuickReplyBar.tsx

interface QuickReplyBarProps {
  /** AI가 물은 보기들. 비어 있으면 아무것도 그리지 않는다 */
  replies: string[];
  onPick: (reply: string) => void;
  disabled?: boolean;
}

/**
 * 입력창 위에 뜨는 선택 버튼.
 *
 * "오늘 할 일에 추가할까?" 처럼 AI가 보기를 물었을 때, 모바일에서 'y'를 타이핑하는
 * 대신 눌러서 답한다. 누르면 그 글자를 그대로 보내므로 직접 입력한 것과 같다.
 *
 * 보기가 길면 가로로 넘치므로 줄바꿈해서 쌓는다.
 */
export default function QuickReplyBar({ replies, onPick, disabled }: QuickReplyBarProps) {
  if (replies.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 px-3 pb-2">
      {replies.map((reply) => (
        <button
          key={reply}
          type="button"
          disabled={disabled}
          onClick={() => onPick(reply)}
          className="rounded-full border border-primary/40 bg-primary/10 px-3.5 py-1.5 text-sm font-medium text-primary transition-colors active:bg-primary/20 disabled:opacity-50"
        >
          {reply}
        </button>
      ))}
    </div>
  );
}
