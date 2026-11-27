'use client';

// ── The site's own hint (owner, 18 Nov 2026, Job Board prompt 50) ──────────
//
// Replaces the browser's native title tooltip. Modelled on
// SpecialFeeInfoButton: a short sentence in a white card drawn through Portal
// at fixed coordinates, flipped and kept inside the screen. It opens on hover
// and on keyboard focus, on a tap on touch screens, and closes on mouse
// leave, an outside tap or Escape.
//
//   <HoverHint text="...">{child}</HoverHint>  wraps ONE child (a button, link,
//     icon or tag). The child keeps its own aria-label; the sentence is also
//     given to it through aria-describedby (a hidden copy that is always in
//     the page, so screen readers find it closed or open).
//   <InfoHint text="..." label="..." />  the small "i" button (lucide Info,
//     fine line, bare ink, no tile) that opens the same hint.

import { cloneElement, isValidElement, useCallback, useEffect, useId, useRef, useState } from 'react';
import { Info } from 'lucide-react';
import Portal from '@/components/Portal';

const W = 280;
const GAP = 8;

function useHint(side: 'top' | 'bottom') {
  const anchorRef = useRef<HTMLElement | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const pinned = useRef(false);
  const closeTimer = useRef<number | null>(null);

  const place = useCallback(() => {
    const r = anchorRef.current?.getBoundingClientRect();
    if (!r) return;
    const w = Math.min(W, window.innerWidth - 16);
    const left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2));
    const h = popRef.current?.offsetHeight ?? 60;
    const above = r.top - h - GAP;
    const below = r.bottom + GAP;
    let top: number;
    if (side === 'top') top = above >= 8 ? above : below;
    else top = below + h + 8 <= window.innerHeight ? below : Math.max(8, above);
    top = Math.max(8, Math.min(window.innerHeight - h - 8, top));
    setPos({ top, left });
  }, [side]);

  const show = useCallback(() => {
    if (closeTimer.current) { window.clearTimeout(closeTimer.current); closeTimer.current = null; }
    place();
  }, [place]);
  const hide = useCallback(() => { pinned.current = false; setPos(null); }, []);
  const hideSoon = useCallback(() => {
    if (pinned.current) return;
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setPos(null), 120);
  }, []);
  const toggleTap = useCallback(() => {
    if (pos && pinned.current) { hide(); return; }
    pinned.current = true;
    show();
  }, [pos, hide, show]);

  // Placed once more after the card has its real height.
  const open = !!pos;
  useEffect(() => {
    if (!open) return;
    const r = window.requestAnimationFrame(place);
    return () => window.cancelAnimationFrame(r);
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (anchorRef.current?.contains(t) || popRef.current?.contains(t)) return;
      hide();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') hide(); };
    // A scroll or a resize closes the hint (prompt 83): it never floats over
    // the top bar after the page moved. The next hover or focus opens it again.
    const onMove = () => hide();
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onMove, { capture: true, passive: true });
    window.addEventListener('resize', onMove);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onMove, { capture: true });
      window.removeEventListener('resize', onMove);
    };
  }, [open, hide]);

  useEffect(() => () => { if (closeTimer.current) window.clearTimeout(closeTimer.current); }, []);

  const setAnchor = useCallback((el: HTMLElement | null) => { anchorRef.current = el; }, []);
  return { setAnchor, popRef, pos, show, hideSoon, toggleTap };
}

function HintCard({ text, pos, popRef, onEnter, onLeave }: {
  text: string;
  pos: { top: number; left: number };
  popRef: React.RefObject<HTMLDivElement | null>;
  onEnter: () => void;
  onLeave: () => void;
}) {
  return (
    <Portal>
      <div
        ref={popRef}
        role="tooltip"
        aria-hidden
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        style={{
          position: 'fixed', top: pos.top, left: pos.left, width: 'max-content', maxWidth: `min(${W}px, calc(100vw - 16px))`, zIndex: 10000,
          padding: '9px 12px', borderRadius: 12, background: '#FFFFFF', color: '#1C1410',
          fontFamily: 'var(--font-brand), sans-serif', fontSize: 13.5, lineHeight: 1.5, fontWeight: 500, textAlign: 'left',
          letterSpacing: 0, textTransform: 'none', whiteSpace: 'normal',
          boxShadow: '0 1px 2px rgba(27,56,40,0.08), 0 12px 28px -12px rgba(27,56,40,0.35)', border: '1px solid rgba(27,56,40,0.08)',
          overflowWrap: 'anywhere', pointerEvents: 'auto',
        }}
      >
        {text}
      </div>
    </Portal>
  );
}

const SR_ONLY: React.CSSProperties = {
  position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0,
};

/** Wraps ONE child and shows `text` beside it on hover, focus or a tap. */
export function HoverHint({ text, children, side = 'top' }: {
  text: string;
  children: React.ReactElement;
  side?: 'top' | 'bottom';
}) {
  const id = useId();
  const { setAnchor, popRef, pos, show, hideSoon, toggleTap } = useHint(side);
  const child = isValidElement(children)
    ? cloneElement(children as React.ReactElement<{ 'aria-describedby'?: string }>, {
      'aria-describedby': [(children.props as { 'aria-describedby'?: string })['aria-describedby'], id].filter(Boolean).join(' '),
    })
    : children;
  return (
    <span
      ref={setAnchor}
      style={{ display: 'inline-flex', position: 'relative', maxWidth: '100%' }}
      onMouseEnter={show}
      onMouseLeave={hideSoon}
      onFocus={show}
      onBlur={hideSoon}
      onPointerUp={(e) => { if (e.pointerType === 'touch') toggleTap(); }}
    >
      {child}
      <span id={id} style={SR_ONLY}>{text}</span>
      {pos && <HintCard text={text} pos={pos} popRef={popRef} onEnter={show} onLeave={hideSoon} />}
    </span>
  );
}

/** The small "i" that opens a hint. */
export function InfoHint({ text, label, side = 'top' }: { text: string; label: string; side?: 'top' | 'bottom' }) {
  const id = useId();
  const { setAnchor, popRef, pos, show, hideSoon, toggleTap } = useHint(side);
  return (
    <>
      <button
        ref={setAnchor}
        type="button"
        aria-label={label}
        aria-describedby={id}
        aria-expanded={!!pos}
        onMouseEnter={show}
        onMouseLeave={hideSoon}
        onFocus={show}
        onBlur={hideSoon}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleTap(); }}
        className="inline-flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] rounded-full"
        style={{ border: 'none', background: 'none', padding: 4, margin: 0, cursor: 'pointer', color: '#1C1410', lineHeight: 0, flexShrink: 0 }}
      >
        <Info size={17} strokeWidth={1.5} aria-hidden />
      </button>
      <span id={id} style={SR_ONLY}>{text}</span>
      {pos && <HintCard text={text} pos={pos} popRef={popRef} onEnter={show} onLeave={hideSoon} />}
    </>
  );
}
