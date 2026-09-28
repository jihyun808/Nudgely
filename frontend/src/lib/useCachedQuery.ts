// lib/useCachedQuery.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';

/**
 * 먼저 보여주고 뒤에서 갱신한다. 탭을 오갈 때 스켈레톤이 매번 뜨지 않게.
 * 값은 메모리에만 둔다 — 앱을 껐다 켜면 비는 게 맞다.
 *
 * ⚠️ key 에는 loader 가 보는 값이 전부 들어가야 한다. 빠뜨리면 화면이
 * 영영 갱신되지 않는다(조용히 틀리는 쪽이라 더 나쁘다).
 */
const cache = new Map<string, unknown>();

/** 로그아웃처럼 사용자가 바뀔 때 비운다. 남의 데이터가 보이면 안 된다 */
export function clearQueryCache(): void {
  cache.clear();
}

interface Result<T> {
  data: T;
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

export function useCachedQuery<T>(key: string, loader: () => Promise<T>): Result<T | undefined>;
export function useCachedQuery<T>(key: string, loader: () => Promise<T>, fallback: T): Result<T>;
export function useCachedQuery<T>(key: string, loader: () => Promise<T>, fallback?: T): Result<T> {
  const [data, setRawData] = useState<T | undefined>(() => cache.get(key) as T | undefined);
  const [isLoading, setIsLoading] = useState(!cache.has(key));
  const [hasError, setHasError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // key 가 바뀌면 값도 갈아끼운다. 효과에서 하면 이전 화면이 한 번 비친다
  const [renderedKey, setRenderedKey] = useState(key);
  if (renderedKey !== key) {
    setRenderedKey(key);
    setRawData(cache.get(key) as T | undefined);
    setIsLoading(!cache.has(key));
    setHasError(false);
  }

  // 의존성에 넣으면 끝없이 다시 받는다. 아래 효과보다 먼저 선언해야 한다
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

  // 첫 렌더의 것을 붙들어 둔다. 호출부가 [] 를 그 자리에 넘겨도 안전하게
  const [emptyValue] = useState(fallback);

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

  return {
    // fallback 이 없으면 undefined 가 섞인다. 오버로드가 그걸 타입에 반영한다
    data: (data ?? emptyValue) as T,
    isLoading,
    hasError,
    refresh,
    reload,
    setData,
  };
}
