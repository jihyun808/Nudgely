// pages/chat/useChatRoom.ts
import { useEffect, useRef, useState } from 'react';
import { fetchGoal, fetchMessages, markGoalAsRead, sendMessage } from '@/api/goal';
import { showToast } from '@/stores/toastStore';
import type { ChatMessage } from '@/types/chat';
import type { GoalDetail } from '@/types/goal';
import { isImageFile } from '@/utils/file';
import { createId } from '@/utils/uuid';

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
  /** 내 메시지를 보내는 중(서버가 받아주기 전). 입력창을 잠그는 데 쓴다 */
  const [isSending, setIsSending] = useState(false);
  /** AI 가 물은 보기들. 입력창 위 버튼으로 뜬다 */
  const [quickReplies, setQuickReplies] = useState<string[]>([]);
  /** 방금 이 대화에서 목표를 완주했는지. 축하 연출을 한 번 띄우고 내린다 */
  const [hasJustCompleted, setHasJustCompleted] = useState(false);
  /** 다음(더 과거) 페이지 커서. null이면 더 불러올 과거가 없다 */
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const listRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  /** 과거 메시지를 붙이기 직전의 스크롤 높이. 위치 보정에 쓰고 비운다 */
  const heightBeforePrependRef = useRef<number | null>(null);
  /** 실패한 전송의 첨부 파일. 재시도 때 같이 다시 보내야 해서 들고 있는다 */
  const pendingFilesRef = useRef(new Map<string, File>());

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
        // 이전 방에서 뜬 선택 버튼이 남아 있으면 엉뚱한 방에 그 답이 전송된다
        setQuickReplies([]);
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

  // 방을 떠날 때도 읽음으로 찍는다. 아직 저장되지 않은(생성 중인) 답은
  // 대상이 아니므로, 나간 뒤 도착한 답은 그대로 '안 읽음' 으로 남는다.
  useEffect(
    () => () => {
      void markGoalAsRead(goalId).catch(() => {});
    },
    [goalId],
  );

  /**
   * 낙관적으로 내 메시지를 먼저 그리고, 응답을 받아 확정한다.
   *
   * localId 는 전송 키(멱등키)로 서버에도 함께 보낸다. 재시도가 같은 값으로 가면
   * 서버가 내 메시지를 중복 저장하지 않고 AI 응답만 새로 만들어 준다.
   */
  const send = async (payload: { content?: string; file?: File; localId?: string }) => {
    const localId = payload.localId ?? createId();
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
    setIsSending(true);
    // 보기를 눌렀든 직접 썼든, 답한 순간 버튼은 내린다
    setQuickReplies([]);

    // 내 말이 '전송 중' 인 동안에는 상대가 입력할 수 없다.
    // 서버가 받아준 뒤에야(message_start) 전송 중을 걷고 '입력 중...' 으로 넘어간다.
    const handleAccepted = () => {
      setMessages((prev) => prev.map((m) => (m.id === localId ? { ...m, status: undefined } : m)));
      setIsSending(false);
      setIsReplying(true);
    };

    try {
      const {
        messages: replies,
        goalCompleted,
        quickReplies: asked,
      } = await sendMessage(
        goalId,
        { content: payload.content, file: payload.file, clientId: localId },
        handleAccepted,
      );
      pendingFilesRef.current.delete(localId);
      // 확정 처리는 handleAccepted 에서 이미 했다. 여기서는 답만 붙인다
      // (말이 길면 서버가 여러 말풍선으로 나눠 준다)
      setMessages((prev) => [...prev, ...replies]);
      setQuickReplies(asked);

      // 방에서 보고 있는 중에 온 답이니 읽음으로 찍는다.
      // 입장 때만 찍으면, 그 뒤에 온 답이 홈에 계속 '안 읽음' 으로 남는다.
      void markGoalAsRead(goalId).catch(() => {});

      // AI 가 이번 턴에 완주 처리했으면 그 자리에서 축하한다.
      // 헤더·모아보기가 완주 상태를 반영하도록 목표도 다시 받아온다.
      if (goalCompleted) {
        setHasJustCompleted(true);
        fetchGoal(goalId)
          .then(setGoal)
          .catch(() => {
            // 못 받아도 축하 연출은 그대로 띄운다
          });
      }
    } catch {
      // 재시도 때 파일을 다시 보낼 수 있도록 남겨둔다
      if (payload.file) pendingFilesRef.current.set(localId, payload.file);
      setMessages((prev) =>
        prev.map((m) => (m.id === localId ? { ...m, status: 'failed' as const } : m)),
      );
      showToast('메시지를 보내지 못했어요', { variant: 'warning' });
    } finally {
      setIsSending(false);
      setIsReplying(false);
    }
  };

  /**
   * 실패한 메시지를 목록에서 빼고 같은 내용으로 다시 보낸다.
   * 같은 id(=전송 키)를 그대로 써서 서버에 중복 저장되지 않게 한다.
   */
  const retry = (failed: ChatMessage) => {
    setMessages((prev) => prev.filter(({ id }) => id !== failed.id));
    void send({
      content: failed.content,
      file: pendingFilesRef.current.get(failed.id),
      localId: failed.id,
    });
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
    isSending,
    quickReplies,
    isLoadingOlder,
    listRef,
    bottomRef,
    onListScroll: handleListScroll,
    onSend: (content: string) => void send({ content }),
    onAttach: (file: File) => void send({ file }),
    onRetry: retry,
    reload,
    hasJustCompleted,
    dismissCompletion: () => setHasJustCompleted(false),
  } as const;
}
