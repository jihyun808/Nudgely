// lib/closeOnBack.ts
// 뒤로가기로 닫을 팝업들. 라우터를 모르는 쪽에 둬야 팝업 껍데기가 불러도 순환 참조가 안 생긴다.
import { useEffect, useRef } from 'react';

/** 열려 있는 팝업들의 '닫기'. 마지막에 열린 것이 맨 위다 */
export const closers: (() => void)[] = [];

/**
 * 열려 있는 동안 뒤로가기로 닫히게 한다. 팝업 껍데기(Modal 등)가 쓴다.
 * 이게 없으면 팝업은 그대로 두고 뒤 화면만 넘어간다.
 */
export function useCloseOnBack(onClose: () => void) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // 열릴 때 한 번만 올린다. onClose 가 바뀔 때마다 다시 올리면 순서가 뒤집혀
  // 위에 뜬 팝업 대신 아래 팝업이 닫힌다
  useEffect(() => {
    const close = () => onCloseRef.current();
    closers.push(close);
    return () => {
      closers.splice(closers.lastIndexOf(close), 1);
    };
  }, []);
}
