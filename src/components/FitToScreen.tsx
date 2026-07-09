'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

// Vertical reference height. By default everything is laid out at this height and scaled
// to fit the window's height (fixed cockpits like chair/delegate/voting are built to this).
// Pages that can legitimately be TALLER than this (e.g. the join flow's co-chair step) opt
// into `fitContent`, which scales to the actual content height instead so nothing is clipped.
const BASE_H = 820;

export default function FitToScreen({
  children,
  fitContent = false,
}: {
  children: ReactNode;
  fitContent?: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ scale: 1, width: BASE_H * (16 / 9) });

  useEffect(() => {
    const content = rootRef.current?.firstElementChild as HTMLElement | null;
    const compute = () => {
      // Default (fitContent=false): identical to the original behaviour — scale BASE_H to
      // the window. fitContent=true: use the taller of BASE_H and the real content height,
      // so overflowing pages shrink to fit instead of being clipped.
      // NOTE: fit-root height stays fixed at BASE_H; only the scale reacts to content. The
      // content is free to overflow the (unclipped) fit-root and gets scaled down to fit —
      // keeping fit-root fixed avoids a min-height ratchet where content can't shrink back.
      const contentH = fitContent && content ? content.offsetHeight : BASE_H;
      const baseH = Math.max(BASE_H, contentH);
      const scale = window.innerHeight / baseH;
      const width = window.innerWidth / scale;
      setDims((prev) =>
        prev.scale === scale && prev.width === width ? prev : { scale, width },
      );
    };
    compute();
    window.addEventListener('resize', compute);
    window.visualViewport?.addEventListener('resize', compute);
    // Recompute when the content's own height changes (e.g. the join step reveals the
    // co-chair fields). Only needed in fitContent mode.
    let ro: ResizeObserver | undefined;
    if (fitContent && content) {
      ro = new ResizeObserver(compute);
      ro.observe(content);
    }
    return () => {
      window.removeEventListener('resize', compute);
      window.visualViewport?.removeEventListener('resize', compute);
      ro?.disconnect();
    };
  }, [fitContent]);

  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', backgroundColor: '#EDE7D8' }}>
      {/* Pin to the physical top-left so the scale() origin is always at (0,0).
          Without an explicit left:0, an RTL document right-aligns this narrower
          box and shifts all content off the right edge. */}
      <div id="fit-root" ref={rootRef} style={{ position: 'absolute', top: 0, left: 0, width: dims.width, height: BASE_H, transform: `scale(${dims.scale})`, transformOrigin: 'top left' }}>
        {children}
      </div>
    </div>
  );
}
