'use client';

// The small i beside a "Special {ticket}" line (owner, 12 Nov 2026): its
// sentence opens on hover and on tap, through Portal at fixed coordinates
// (flipped and kept inside the screen), and closes on an outside tap or Escape.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Info } from 'lucide-react';
import Portal from '@/components/Portal';

const W = 280;

export default function SpecialFeeInfoButton({ text }: { text: string }) {
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [pinned, setPinned] = useState(false);
  const closeTimer = useRef<number | null>(null);

  const place = useCallback(() => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const left = Math.max(8, Math.min(window.innerWidth - W - 8, r.left + r.width / 2 - W / 2));
    const h = popRef.current?.offsetHeight ?? 90;
    const below = r.bottom + 8;
    const top = below + h + 8 > window.innerHeight ? Math.max(8, r.top - h - 8) : below;
    setPos({ top, left });
  }, []);

  const open = () => { if (closeTimer.current) window.clearTimeout(closeTimer.current); place(); };
  const closeSoon = () => {
    if (pinned) return;
    closeTimer.current = window.setTimeout(() => setPos(null), 120);
  };

  useEffect(() => {
    if (!pos) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || popRef.current?.contains(t)) return;
      setPinned(false); setPos(null);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setPinned(false); setPos(null); } };
    const onMove = () => place();
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
    };
  }, [pos, place]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label="Why this fee"
        aria-expanded={!!pos}
        onMouseEnter={open}
        onMouseLeave={closeSoon}
        onFocus={open}
        onBlur={closeSoon}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (pos && pinned) { setPinned(false); setPos(null); } else { setPinned(true); open(); } }}
        className="inline-flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gv-main,#1B3828)]"
        style={{ border: 'none', background: 'none', padding: 2, margin: '0 0 0 4px', cursor: 'pointer', color: 'var(--gv-main, #1B3828)', verticalAlign: '-2px', lineHeight: 0 }}
      >
        <Info size={15} strokeWidth={1.75} aria-hidden />
      </button>
      {pos && (
        <Portal>
          <div
            ref={popRef}
            role="tooltip"
            onMouseEnter={open}
            onMouseLeave={closeSoon}
            style={{
              position: 'fixed', top: pos.top, left: pos.left, width: W, maxWidth: 'calc(100vw - 16px)', zIndex: 10000,
              padding: '10px 12px', borderRadius: 12, background: '#FFFFFF', color: '#1C1410',
              fontFamily: 'var(--font-brand), sans-serif', fontSize: 13, lineHeight: 1.5, fontWeight: 500,
              boxShadow: '0 1px 2px rgba(27,56,40,0.08), 0 12px 28px -12px rgba(27,56,40,0.35)', overflowWrap: 'anywhere',
            }}
          >
            {text}
          </div>
        </Portal>
      )}
    </>
  );
}
