'use client';

// CyclingDots — ".", "..", "..." cycling once a second, the rhythm of
// /pay/go's "Opening in 5" countdown (prompt 101), shared with every money
// document download and send since prompt 109 ("Making your receipt...",
// "Sending..."). It holds a fixed width so the words beside it never move.
// Pass `step` when the caller already ticks (the countdown); otherwise the
// dots tick by themselves while mounted. Hidden from screen readers: the
// words around them carry the meaning.

import { useEffect, useState } from 'react';

export const DOT_STEPS_PER_SECOND = 3;

export function dotsFor(step: number): string {
  return '.'.repeat((step % DOT_STEPS_PER_SECOND) + 1);
}

export default function CyclingDots({ step }: { step?: number }) {
  const [own, setOwn] = useState(0);
  const ticking = step === undefined;
  useEffect(() => {
    if (!ticking) return;
    const t = setInterval(() => setOwn(s => s + 1), 1000 / DOT_STEPS_PER_SECOND);
    return () => clearInterval(t);
  }, [ticking]);
  return (
    <span aria-hidden style={{ display: 'inline-block', width: '1.2em', textAlign: 'left' }}>
      {dotsFor(ticking ? own : step)}
    </span>
  );
}
