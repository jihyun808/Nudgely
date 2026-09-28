// lib/useCachedQuery.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';

/**
 * 탭을 오갈 때 스켈레톤이 매번 뜨지 않게 한다.
 *
 * 라우터는 탭이 바뀌면 화면을 통째로 내린다. 그래서 다시 들어올 때마다
 * "받아온 적 없는 상태"에서 시작해 빈 화면 → 스켈레톤 → 내용을 반복한다.
 * 이미 본 내용인데도 매번 처음 보는 것처럼 군다.
 *
 * 여기서는 **먼저 보여주고 뒤에서 갱신한다**:
 * - 받아둔 게 있으면 즉시 그리고, 조용히 다시 받아 바꿔 끼운다
 * - 처음일 때만 스켈레톤을 띄운다
 *
 * 값은 메모리에만 둔다. 앱을 껐다 켜면 비는 게 맞다 — 오래된 진도나 투두를
 * 되살려 보여주면 '고쳤는데 그대로네' 가 된다.
 */
const cache = new Map<string, unknown>();

/** 로그아웃처럼 사용자가 바뀔 때 비운다. 남의 데이터가 보이면 안 된다 */
export function clearQueryCache(): void {
  cache.clear();
}

interface Result<T> {
  data: T | undefined;
  /** 보여줄 게 아무것도 없을 때만 true. 뒤에서 갱신하는 중에는 false 다 */
  isLoading: boolean;
  hasError: boolean;
  /** 조용히 다시 받아온다. 화면은 그대로 두고 값만 바꿔 끼운다(포커스 복귀 등) */
  refresh: () => void;
  /** 처음부터 다시. 화면을 비우고 스켈레톤을 띄운다(실패 후 '다시 시도' 버튼용) */
  reload: () => void;
  /**
   * 받아온 값을 화면에서 직접 고칠 때(낙관적 갱신). 캐시도 함께 맞춘다.
   * useState 처럼 함수형 갱신도 받는다 — 아직 받아온 게 없으면 무시한다.
   */
  setData: Dispatch<SetStateAction<T>>;
}

export function useCachedQuery<T>(key: string, loader: () => Promise<T>): Result<T> {
  const [data, setRawData] = useState<T | undefined>(() => cache.get(key) as T | undefined);
  const [isLoading, setIsLoading] = useState(!cache.has(key));
  const [hasError, setHasError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // key 가 바뀌면 보여줄 값도 갈아끼운다. 효과에서 setState 하면 한 번 더
  // 그려지며 이전 화면이 잠깐 비친다(렌더 중 조정이 React 가 권하는 방식이다)
  const [renderedKey, setRenderedKey] = useState(key);
  if (renderedKey !== key) {
    setRenderedKey(key);
    setRawData(cache.get(key) as T | undefined);
    setIsLoading(!cache.has(key));
    setHasError(false);
  }

  // loader 는 렌더마다 새로 만들어지기 쉽다. 의존성에 넣으면 끝없이 다시 받는다.
  // 아래 효과보다 먼저 선언해야 최신 값으로 갱신된 뒤에 쓰인다(효과는 위에서부터 돈다)
  const loaderRef = useRef(loader);
  useEffect(() => {
    loaderRef.current = loader;
  });

  useEffect(() => {
    let isStale = false;

    loaderRef
      .current()
      .then((next) => {
        if (isStale) return;
        cache.set(key, next);
        setRawData(next);
        setHasError(false);
      })
      .catch(() => {
        // 갱신에 실패해도 보여주던 건 남긴다. 잠깐 끊겼다고 화면을 비울 이유가 없다
        if (!isStale && cache.get(key) === undefined) setHasError(true);
      })
      .finally(() => {
        if (!isStale) setIsLoading(false);
      });

    return () => {
      isStale = true;
    };
  }, [key, reloadKey]);

  const setData = useCallback<Dispatch<SetStateAction<T>>>(
    (update) => {
      let next: T;
      if (typeof update === 'function') {
        const current = cache.get(key) as T | undefined;
        // 고칠 대상이 아직 없다. 곧 도착할 응답이 덮어쓸 테니 여기서는 아무것도 안 한다
        if (current === undefined) return;
        next = (update as (prev: T) => T)(current);
      } else {
        next = update;
      }
      cache.set(key, next);
      setRawData(next);
    },
    [key],
  );

  const refresh = useCallback(() => {
    setReloadKey((n) => n + 1);
  }, []);

  const reload = useCallback(() => {
    cache.delete(key);
    setRawData(undefined);
    setIsLoading(true);
    setHasError(false);
    setReloadKey((n) => n + 1);
  }, [key]);

  return { data, isLoading, hasError, refresh, reload, setData };
}
