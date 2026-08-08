// pages/chat/ChatDetail.tsx
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ImageViewer from '@/components/ImageViewer';
import { Button } from '@/components/ui/button';
import DetailHeader from '@/components/DetailHeader';
import ChatInputBar from '@/pages/chat/components/ChatInputBar';
import ChatMessageList from '@/pages/chat/components/ChatMessageList';
import { useChatRoom } from '@/pages/chat/useChatRoom';

/**
 * 채팅방 상세.
 * 헤더(뒤로가기/이름/모아보기) + 말풍선 목록 + 하단 입력 바.
 * 데이터와 전송 동작은 useChatRoom이 담당한다.
 */
export default function ChatDetail() {
  const { goalId = '' } = useParams();
  const navigate = useNavigate();
  const chat = useChatRoom(goalId);

  /** 크게 보고 있는 사진 */
  const [viewerImage, setViewerImage] = useState<{ src: string; name: string }>();

  if (chat.isLoading) {
    return (
      <div className="flex h-dvh items-center justify-center text-sm text-muted-foreground">
        불러오는 중...
      </div>
    );
  }

  if (chat.hasError || !chat.goal) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-3">
        <p className="text-sm text-muted-foreground">채팅방을 불러오지 못했어요</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/chat')}>
            목록으로
          </Button>
          <Button size="sm" onClick={chat.reload}>
            다시 시도
          </Button>
        </div>
      </div>
    );
  }

  return (
    // pt: 헤더가 노치·상태바에 가리지 않도록 안전 영역만큼 내린다
    <div className="mx-auto flex h-dvh max-w-md flex-col bg-background pt-[env(safe-area-inset-top)]">
      <DetailHeader
        title={chat.goal.name}
        subtitle={chat.goal.title}
        onBack={() => navigate('/chat')}
        className="px-3"
        action={
          <button
            type="button"
            onClick={() => navigate(`/chat/${goalId}/archive`)}
            aria-label="모아보기"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors active:bg-primary/20"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
              <rect x="4" y="4" width="7" height="7" rx="1.5" />
              <rect x="13" y="4" width="7" height="7" rx="1.5" />
              <rect x="4" y="13" width="7" height="7" rx="1.5" />
              <rect x="13" y="13" width="7" height="7" rx="1.5" />
            </svg>
          </button>
        }
      />

      <ChatMessageList
        messages={chat.messages}
        goal={chat.goal}
        isReplying={chat.isReplying}
        isLoadingOlder={chat.isLoadingOlder}
        listRef={chat.listRef}
        bottomRef={chat.bottomRef}
        onScroll={chat.onListScroll}
        onRetry={chat.onRetry}
        onOpenImage={(src, name) => setViewerImage({ src, name })}
      />

      {viewerImage && (
        <ImageViewer
          src={viewerImage.src}
          alt={viewerImage.name}
          onClose={() => setViewerImage(undefined)}
        />
      )}

      <ChatInputBar onSend={chat.onSend} onAttach={chat.onAttach} disabled={chat.isReplying} />
    </div>
  );
}
