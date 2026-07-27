// pages/chat/ChatDetail.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchChatRoom, fetchMessages, markChatRoomAsRead, sendMessage } from '@/api/chat';
import { Button } from '@/components/ui/button';
import ChatDateDivider from '@/pages/chat/components/ChatDateDivider';
import ChatDetailHeader from '@/pages/chat/components/ChatDetailHeader';
import ChatInputBar from '@/pages/chat/components/ChatInputBar';
import ChatMessageBubble from '@/pages/chat/components/ChatMessageBubble';
import type { ChatMessage, ChatRoomDetail } from '@/types/chat';
import { isSameDay, isSameMinute } from '@/utils/date';

/**
 * 채팅방 상세.
 * 헤더(뒤로가기/이름/메뉴) + 날짜 구분선과 말풍선 목록 + 하단 입력 바.
 * 내 메시지는 먼저 화면에 그려두고(낙관적 업데이트) 응답이 오면 확정한다.
 */
export default function ChatDetail() {
  const { roomId = '' } = useParams();
  const navigate = useNavigate();

  const [room, setRoom] = useState<ChatRoomDetail>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  /** AI 응답 대기 중 (입력 잠금 + 타이핑 표시) */
  const [isReplying, setIsReplying] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isStale = false;
    Promise.all([fetchChatRoom(roomId), fetchMessages(roomId)])
      .then(([roomData, messageData]) => {
        if (isStale) return;
        setRoom(roomData);
        setMessages(messageData);
        setHasError(false);
        // 방에 들어오면 읽음 처리. 실패해도 화면에는 영향이 없다
        void markChatRoomAsRead(roomId).catch(() => {});
      })
      .catch(() => {
        if (!isStale) setHasError(true);
      })
      .finally(() => {
        if (!isStale) setIsLoading(false);
      });
    return () => {
      isStale = true;
    };
  }, [roomId, reloadKey]);

  // 메시지가 늘어나거나 응답 대기 표시가 바뀌면 맨 아래로 스크롤
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, isReplying]);

  /**
   * 연속 메시지 묶음 계산.
   * - 날짜가 바뀌면 구분선
   * - 같은 사람이 연달아 보내면 이름·아바타는 첫 줄에만
   * - 같은 분(分)에 이어진 메시지면 시각은 마지막 줄에만
   */
  const items = useMemo(
    () =>
      messages.map((message, index) => {
        const prev = messages[index - 1];
        const next = messages[index + 1];
        const isNewDay = !prev || !isSameDay(prev.createdAt, message.createdAt);
        return {
          message,
          showDateDivider: isNewDay,
          showSender: isNewDay || prev.role !== message.role,
          showTime:
            !next || next.role !== message.role || !isSameMinute(message.createdAt, next.createdAt),
        };
      }),
    [messages],
  );

  /** 낙관적으로 내 메시지를 먼저 그리고, 응답을 받아 확정한다 */
  const send = async (payload: { content?: string; file?: File }) => {
    const localId = crypto.randomUUID();
    const myMessage: ChatMessage = {
      id: localId,
      role: 'user',
      content: payload.content ?? '',
      createdAt: new Date().toISOString(),
      file: payload.file ? { name: payload.file.name } : undefined,
      status: 'sending',
    };
    setMessages((prev) => [...prev, myMessage]);
    setIsReplying(true);

    try {
      const reply = await sendMessage(roomId, payload);
      setMessages((prev) => [
        // 전송 성공한 내 메시지는 status를 지워 확정 상태로 만든다
        ...prev.map((m) => (m.id === localId ? { ...m, status: undefined } : m)),
        reply,
      ]);
    } catch {
      setMessages((prev) =>
        prev.map((m) => (m.id === localId ? { ...m, status: 'failed' as const } : m)),
      );
    } finally {
      setIsReplying(false);
    }
  };

  /** 실패한 메시지를 목록에서 빼고 같은 내용으로 다시 보낸다 */
  const handleRetry = (failed: ChatMessage) => {
    setMessages((prev) => prev.filter(({ id }) => id !== failed.id));
    void send({ content: failed.content });
  };

  if (isLoading) {
    return (
      <div className="flex h-dvh items-center justify-center text-sm text-muted-foreground">
        불러오는 중...
      </div>
    );
  }

  if (hasError || !room) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-3">
        <p className="text-sm text-muted-foreground">채팅방을 불러오지 못했어요</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/chat')}>
            목록으로
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setIsLoading(true);
              setHasError(false);
              setReloadKey((key) => key + 1);
            }}
          >
            다시 시도
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-dvh max-w-md flex-col bg-background">
      <ChatDetailHeader
        title={room.name}
        subtitle={room.description}
        onBack={() => navigate('/chat')}
        // TODO: 채팅방 메뉴 화면 연결
        onOpenMenu={() => console.log('open menu', room.id)}
      />

      <div className="flex-1 space-y-2 overflow-y-auto bg-muted-foreground/5 px-3 py-3">
        {items.length === 0 && !isReplying && (
          <p className="mt-20 text-center text-sm text-muted-foreground">
            첫 메시지를 보내 대화를 시작해보세요
          </p>
        )}

        {items.map(({ message, showDateDivider, showSender, showTime }) => (
          <div key={message.id} className="space-y-2">
            {showDateDivider && <ChatDateDivider date={message.createdAt} />}
            <ChatMessageBubble
              message={message}
              senderName={room.name}
              senderImageUrl={room.imageUrl}
              showSender={showSender}
              showTime={showTime}
              onRetry={handleRetry}
            />
          </div>
        ))}

        {isReplying && (
          <p className="pl-10 text-xs text-muted-foreground" aria-live="polite">
            {room.name}님이 입력 중...
          </p>
        )}

        <div ref={bottomRef} />
      </div>

      <ChatInputBar
        onSend={(content) => void send({ content })}
        onAttach={(file) => void send({ file })}
        disabled={isReplying}
      />
    </div>
  );
}
