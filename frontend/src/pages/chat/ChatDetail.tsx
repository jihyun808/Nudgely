// pages/chat/ChatDetail.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchGoal, fetchMessages, markGoalAsRead, sendMessage } from '@/api/goal';
import { Button } from '@/components/ui/button';
import ChatDateDivider from '@/pages/chat/components/ChatDateDivider';
import ChatDetailHeader from '@/pages/chat/components/ChatDetailHeader';
import ChatInputBar from '@/pages/chat/components/ChatInputBar';
import ChatMessageBubble from '@/pages/chat/components/ChatMessageBubble';
import type { ChatMessage } from '@/types/chat';
import type { GoalDetail } from '@/types/goal';
import { isSameDay, isSameMinute } from '@/utils/date';

/**
 * 채팅방 상세.
 * 헤더(뒤로가기/이름/메뉴) + 날짜 구분선과 말풍선 목록 + 하단 입력 바.
 * 내 메시지는 먼저 화면에 그려두고(낙관적 업데이트) 응답이 오면 확정한다.
 */
export default function ChatDetail() {
  const { goalId = '' } = useParams();
  const navigate = useNavigate();

  const [goal, setGoal] = useState<GoalDetail>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  /** AI 응답 대기 중 (입력 잠금 + 타이핑 표시) */
  const [isReplying, setIsReplying] = useState(false);
  /** 다음(더 과거) 페이지 커서. null이면 더 불러올 과거가 없다 */
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const bottomRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  /** 과거 메시지를 붙이기 직전의 스크롤 높이. 위치 보정에 쓰고 비운다 */
  const heightBeforePrependRef = useRef<number | null>(null);

  useEffect(() => {
    let isStale = false;
    Promise.all([fetchGoal(goalId), fetchMessages(goalId)])
      .then(([goalData, page]) => {
        if (isStale) return;
        setGoal(goalData);
        // 응답은 최신 → 과거 순이므로 뒤집어 오래된 것부터 그린다
        setMessages([...page.messages].reverse());
        setNextCursor(page.nextCursor);
        setHasError(false);
        // 방에 들어오면 읽음 처리. 실패해도 화면에는 영향이 없다
        void markGoalAsRead(goalId).catch(() => {});
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
  }, [goalId, reloadKey]);

  /**
   * 목록이 바뀔 때의 스크롤 처리.
   * 과거를 앞에 붙인 직후에는 늘어난 높이만큼 내려 보던 위치를 유지하고,
   * 그 밖에는(새 메시지 등) 맨 아래로 내린다.
   */
  useEffect(() => {
    const list = listRef.current;
    const heightBefore = heightBeforePrependRef.current;

    if (list && heightBefore !== null) {
      list.scrollTop = list.scrollHeight - heightBefore;
      heightBeforePrependRef.current = null;
      return;
    }
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, isReplying]);

  /** 위로 스크롤해 맨 위에 닿으면 이전 대화를 이어 붙인다 */
  const handleListScroll = () => {
    const list = listRef.current;
    if (!list || !nextCursor || isLoadingOlder) return;
    if (list.scrollTop > 80) return;

    setIsLoadingOlder(true);
    // 붙이기 전 높이를 기억해 두었다가 렌더 후 스크롤을 보정한다
    heightBeforePrependRef.current = list.scrollHeight;

    fetchMessages(goalId, nextCursor)
      .then((page) => {
        setMessages((prev) => [...[...page.messages].reverse(), ...prev]);
        setNextCursor(page.nextCursor);
      })
      .catch(() => {
        // 실패하면 보정도 하지 않는다 (다음 스크롤에서 다시 시도)
        heightBeforePrependRef.current = null;
      })
      .finally(() => setIsLoadingOlder(false));
  };

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
      const reply = await sendMessage(goalId, payload);
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

  if (hasError || !goal) {
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
        title={goal.name}
        subtitle={goal.title}
        onBack={() => navigate('/chat')}
        // TODO: 채팅방 메뉴 화면 연결
        onOpenMenu={() => console.log('open menu', goal.id)}
      />

      <div
        ref={listRef}
        onScroll={handleListScroll}
        className="flex-1 space-y-2 overflow-y-auto bg-muted-foreground/5 px-3 py-3"
      >
        {isLoadingOlder && (
          <p className="py-2 text-center text-xs text-muted-foreground">
            이전 대화를 불러오는 중...
          </p>
        )}

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
              senderName={goal.name}
              senderImageUrl={goal.imageUrl}
              showSender={showSender}
              showTime={showTime}
              onRetry={handleRetry}
            />
          </div>
        ))}

        {isReplying && (
          <p className="pl-10 text-xs text-muted-foreground" aria-live="polite">
            {goal.name}님이 입력 중...
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
