// pages/chat/useChatRoom.ts
import { useEffect, useRef, useState } from 'react';
import { fetchGoal, fetchMessages, markGoalAsRead, sendMessage } from '@/api/goal';
import { showToast } from '@/stores/toastStore';
import type { ChatMessage } from '@/types/chat';
import type { GoalDetail } from '@/types/goal';
import { isImageFile } from '@/utils/file';

/** 위로 스크롤해 이 거리 안에 들어오면 과거를 더 불러온다(px) */
const LOAD_MORE_THRESHOLD = 80;

/**
 * 채팅방의 데이터와 동작을 모아둔 훅.
 * 목표·메시지 조회, 과거 페이지 이어붙이기, 전송, 스크롤 위치 관리를 담당한다.
 * 화면(ChatDetail.tsx)은 여기서 나온 값을 그리기만 한다.
 */
export function useChatRoom(goalId: string) {
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

  const listRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
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
    if (list.scrollTop > LOAD_MORE_THRESHOLD) return;

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
        showToast('이전 대화를 불러오지 못했어요', { variant: 'warning' });
      })
      .finally(() => setIsLoadingOlder(false));
  };

  /** 낙관적으로 내 메시지를 먼저 그리고, 응답을 받아 확정한다 */
  const send = async (payload: { content?: string; file?: File }) => {
    const localId = crypto.randomUUID();
    const myMessage: ChatMessage = {
      id: localId,
      role: 'user',
      content: payload.content ?? '',
      createdAt: new Date().toISOString(),
      file: payload.file
        ? {
            name: payload.file.name,
            // 사진은 보내는 즉시 미리보기가 보이도록 로컬 URL을 붙인다
            url: isImageFile(payload.file.name) ? URL.createObjectURL(payload.file) : undefined,
          }
        : undefined,
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
      showToast('메시지를 보내지 못했어요', { variant: 'warning' });
    } finally {
      setIsReplying(false);
    }
  };

  /** 실패한 메시지를 목록에서 빼고 같은 내용으로 다시 보낸다 */
  const retry = (failed: ChatMessage) => {
    setMessages((prev) => prev.filter(({ id }) => id !== failed.id));
    void send({ content: failed.content });
  };

  const reload = () => {
    setIsLoading(true);
    setHasError(false);
    setReloadKey((key) => key + 1);
  };

  return {
    goal,
    messages,
    isLoading,
    hasError,
    isReplying,
    isLoadingOlder,
    listRef,
    bottomRef,
    onListScroll: handleListScroll,
    onSend: (content: string) => void send({ content }),
    onAttach: (file: File) => void send({ file }),
    onRetry: retry,
    reload,
  } as const;
}
