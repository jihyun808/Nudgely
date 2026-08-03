// pages/record/useLongPress.ts
import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';

/** 길게 누른 것으로 볼 시간(ms) */
const HOLD_MS = 500;
/** 이만큼(px) 넘게 움직이면 스크롤·스와이프로 보고 취소한다 */
const MOVE_TOLERANCE = 10;

/**
 * 카드를 길게 눌렀을 때 동작을 실행한다.
 * 캐러셀 안에서 쓰므로 손가락이 움직이면(= 카드를 넘기는 중이면) 취소한다.
 * 버튼 위에서 시작한 누름은 그 버튼의 동작이 우선이라 무시한다.
 *
 * `isPressing`은 누르고 있는 동안 참이다. 길게 누르면 뭔가 일어난다는 걸
 * 눌린 표시로 알려주는 용도이며, 취소되면 바로 거짓으로 돌아간다.
 */
export function useLongPress(onLongPress: () => void, isEnabled = true) {
  const timerRef = useRef<number>(undefined);
  const originRef = useRef<{ x: number; y: number }>(undefined);
  const [isPressing, setIsPressing] = useState(false);

  const cancel = () => {
    window.clearTimeout(timerRef.current);
    timerRef.current = undefined;
    originRef.current = undefined;
    setIsPressing(false);
  };

  // 눌린 채로 화면을 벗어나거나 언마운트돼도 타이머가 남지 않게 한다
  useEffect(() => cancel, []);

  if (!isEnabled) return { isPressing: false, handlers: {} };

  return {
    isPressing,
    handlers: {
      onPointerDown: (e: ReactPointerEvent) => {
        if ((e.target as HTMLElement).closest('button')) return;
        originRef.current = { x: e.clientX, y: e.clientY };
        setIsPressing(true);
        timerRef.current = window.setTimeout(() => {
          cancel();
          onLongPress();
        }, HOLD_MS);
      },
      onPointerMove: (e: ReactPointerEvent) => {
        const origin = originRef.current;
        if (!origin) return;
        const moved = Math.hypot(e.clientX - origin.x, e.clientY - origin.y);
        if (moved > MOVE_TOLERANCE) cancel();
      },
      onPointerUp: cancel,
      onPointerCancel: cancel,
      // 길게 누를 때 뜨는 기본 컨텍스트 메뉴·텍스트 선택을 막는다
      onContextMenu: (e: ReactMouseEvent) => e.preventDefault(),
    },
  };
}
