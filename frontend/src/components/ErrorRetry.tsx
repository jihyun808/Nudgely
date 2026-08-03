// components/ErrorRetry.tsx
import { Button } from '@/components/ui/button';

interface ErrorRetryProps {
  /** 무엇을 못 불러왔는지 알려주는 문구 */
  message: string;
  onRetry: () => void;
  className?: string;
}

/** 조회에 실패했을 때 보여주는 안내와 다시 시도 버튼 */
export default function ErrorRetry({ message, onRetry, className = 'mt-20' }: ErrorRetryProps) {
  return (
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      <p className="text-sm text-muted-foreground">{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        다시 시도
      </Button>
    </div>
  );
}
