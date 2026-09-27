// pages/settings/components/HiddenGoalItem.tsx
import ChatAvatar from '@/components/ChatAvatar';
import { Button } from '@/components/ui/button';
import type { Goal } from '@/types/goal';
import { formatChatTime } from '@/utils/date';

interface HiddenGoalItemProps {
  goal: Goal;
  onUnhide: (goal: Goal) => void;
}

/** 히스토리의 숨긴 채팅방 한 줄. 되돌리기 버튼이 붙는다 */
export default function HiddenGoalItem({ goal, onUnhide }: HiddenGoalItemProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <ChatAvatar name={goal.name} imageUrl={goal.imageUrl} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{goal.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          마지막 대화 {formatChatTime(goal.lastMessageAt)}
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={() => onUnhide(goal)}>
        되돌리기
      </Button>
    </div>
  );
}
