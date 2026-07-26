// pages/chat/components/ChatRoomCardSkeleton.tsx

/**
 * 채팅방 목록 로딩 중 자리를 잡아두는 뼈대 UI.
 * ChatRoomCard와 같은 높이/여백을 써서 로딩이 끝날 때 레이아웃이 튀지 않게 한다.
 */
export default function ChatRoomCardSkeleton() {
  return (
    <div className="flex animate-pulse items-center gap-3 px-6 py-3.5">
      <div className="h-12 w-12 shrink-0 rounded-full bg-muted-foreground/15" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-24 rounded bg-muted-foreground/15" />
        <div className="h-3.5 w-40 rounded bg-muted-foreground/10" />
      </div>
      <div className="h-3 w-10 shrink-0 rounded bg-muted-foreground/10" />
    </div>
  );
}
