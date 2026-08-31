import { useRef, useState } from 'react';
import type { PointerEventHandler } from 'react';

interface SwipeHandlers {
  onPointerDown: PointerEventHandler<HTMLElement>;
  onPointerMove: PointerEventHandler<HTMLElement>;
  onPointerUp: PointerEventHandler<HTMLElement>;
  onPointerCancel: PointerEventHandler<HTMLElement>;
}

export function useSwipe(onNext: () => void, onPrevious: () => void): { offsetX: number; dragging: boolean; handlers: SwipeHandlers } {
  const startX = useRef<number | null>(null);
  const [offsetX, setOffsetX] = useState(0);
  const [dragging, setDragging] = useState(false);

  const reset = () => {
    startX.current = null;
    setOffsetX(0);
    setDragging(false);
  };

  return {
    offsetX,
    dragging,
    handlers: {
      onPointerDown(event) {
        startX.current = event.clientX;
        setDragging(true);
        event.currentTarget.setPointerCapture?.(event.pointerId);
      },
      onPointerMove(event) {
        if (startX.current === null) return;
        setOffsetX(event.clientX - startX.current);
      },
      onPointerUp(event) {
        if (startX.current === null) return;
        const delta = event.clientX - startX.current;
        if (delta < -70) onNext();
        if (delta > 70) onPrevious();
        reset();
      },
      onPointerCancel: reset,
    },
  };
}

