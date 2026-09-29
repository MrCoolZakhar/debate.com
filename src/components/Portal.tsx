'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export default function Portal({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  // Resolved once after mount (the whole tree, #fit-root included, is in the
  // DOM by then), a microtask later so no state is set synchronously in the
  // effect. Never re-resolved, so a popover never jumps between targets.
  useEffect(() => {
    let alive = true;
    void Promise.resolve().then(() => {
      if (alive) setTarget(document.getElementById('fit-root') ?? document.body);
    });
    return () => { alive = false; };
  }, []);
  return target ? createPortal(children, target) : null;
}
