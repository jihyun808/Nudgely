// lib/useRefreshOnFocus.ts
import { useEffect, useRef } from 'react';

/**
 * 다른 탭·화면에 다녀와서 이 창을 다시 보게 됐을 때 콜백을 부른다.
 * 홈·집중처럼 '지금 상태'를 보여주는 화면이 낡은 값을 들고 있지 않게 한다.
 */
export function useRefreshOnFocus(refresh: () => void) {
  const refreshRef = useRef(refresh);

  // 매번 새 함수가 들어와도 리스너를 다시 달지 않도록 최신 것만 담아둔다
  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    const handle = () => {
      if (document.visibilityState === 'visible') refreshRef.current();
    };
    window.addEventListener('focus', handle);
    document.addEventListener('visibilitychange', handle);
    return () => {
      window.removeEventListener('focus', handle);
      document.removeEventListener('visibilitychange', handle);
    };
  }, []);
}
