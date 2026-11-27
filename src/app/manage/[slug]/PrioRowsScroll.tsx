'use client';

// The Set-up Priorities rows, scrolling inside their card (prompt 81). When
// the rows overflow, a soft fade at the bottom edge with a small ChevronDown
// says there is more; it goes once the list is scrolled to its end. Purely
// presentational: measured with a ResizeObserver and the scroll event, state
// only when the answer changes.

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { NEU } from '@/components/neu';

export default function PrioRowsScroll({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [more, setMore] = useState(false);

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const next = el.scrollHeight - el.clientHeight - el.scrollTop > 4;
    setMore((m) => (m === next ? m : next));
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    // The rows change height as items load or leave.
    const mo = new MutationObserver(measure);
    mo.observe(el, { childList: true, subtree: true });
    const raf = requestAnimationFrame(measure);
    return () => { ro.disconnect(); mo.disconnect(); cancelAnimationFrame(raf); };
  }, [measure]);

  return (
    <div className="relative flex flex-col" style={{ flex: '1 1 auto', minHeight: 0 }}>
      <div ref={ref} onScroll={measure} className="gv-dash-prio-rows flex flex-col" style={{ gap: 5 }}>
        {children}
      </div>
      {more && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-center"
          style={{ height: 34, background: 'linear-gradient(to bottom, rgba(255,255,255,0) 0%, rgba(240,235,221,0.92) 100%)', borderRadius: '0 0 14px 14px' }}
        >
          <ChevronDown size={16} strokeWidth={2.2} style={{ color: NEU.forest, marginBottom: 2 }} />
        </div>
      )}
    </div>
  );
}
