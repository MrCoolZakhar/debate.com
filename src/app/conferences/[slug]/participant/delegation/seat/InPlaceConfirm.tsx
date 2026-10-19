'use client';

// A small confirm asked IN PLACE, anchored to the thing it is about (the row a
// seat was dropped on, the Take out of seat button). Never a modal and never on
// top of another pop-up (CLAUDE.md Owner Decisions): a Portal card at fixed
// coordinates under the anchor, flipped above it near the bottom edge, kept on
// screen, following the anchor on scroll and resize, closed by Cancel, Escape
// or a press outside.

import { useCallback, useEffect, useRef, useState } from 'react';
import Portal from '@/components/Portal';
import { DANGER, FONT, INK, INK_SOFT, LIFT_SHADOW } from '../leaderKit';

const W = 340;

export default function InPlaceConfirm({ anchor, align = 'start', title, line, yes, danger = false, busy = false, onYes, onCancel }: {
  anchor: HTMLElement;
  /** Line the card up with the anchor's left edge ('start') or right edge ('end'). */
  align?: 'start' | 'end';
  title: string;
  line?: string | null;
  yes: string;
  danger?: boolean;
  busy?: boolean;
  onYes: () => void;
  onCancel: () => void;
}) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const place = useCallback(() => {
    const r = anchor.getBoundingClientRect();
    const h = cardRef.current?.offsetHeight ?? 140;
    const width = Math.min(W, window.innerWidth - 16);
    const rawLeft = align === 'end' ? r.right - width : r.left + 12;
    const left = Math.max(8, Math.min(window.innerWidth - width - 8, rawLeft));
    const below = r.bottom + 6;
    const top = below + h + 8 > window.innerHeight ? Math.max(8, r.top - h - 6) : below;
    setPos(p => (p && p.top === top && p.left === left ? p : { top, left }));
  }, [anchor, align]);

  const observer = useRef<ResizeObserver | null>(null);
  const setCardNode = useCallback((node: HTMLDivElement | null) => {
    cardRef.current = node;
    observer.current?.disconnect();
    observer.current = null;
    if (!node) return;
    place();
    // Focus moves into the card: onto Cancel when the answer is destructive.
    node.querySelector<HTMLButtonElement>(danger ? '[data-confirm-no]' : '[data-confirm-yes]')?.focus({ preventScroll: true });
    if (typeof ResizeObserver !== 'undefined') {
      observer.current = new ResizeObserver(() => place());
      observer.current.observe(node);
    }
  }, [place, danger]);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (cardRef.current?.contains(t) || anchor.contains(t)) return;
      onCancel();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [anchor, place, onCancel]);

  return (
    <Portal>
      <div
        ref={setCardNode}
        role="alertdialog"
        aria-label={title}
        style={{
          position: 'fixed', top: pos?.top ?? -9999, left: pos?.left ?? -9999, width: `min(${W}px, calc(100vw - 16px))`, zIndex: 80,
          padding: '14px 14px 12px', borderRadius: 12, background: '#FFFFFF', boxShadow: LIFT_SHADOW,
          visibility: pos ? 'visible' : 'hidden',
        }}
      >
        <p style={{ fontFamily: FONT, fontSize: 14, fontWeight: 600, color: INK, margin: 0, overflowWrap: 'anywhere', lineHeight: 1.4 }}>{title}</p>
        {line && <p style={{ fontFamily: FONT, fontSize: 13, color: INK_SOFT, margin: '4px 0 0 0', lineHeight: 1.45 }}>{line}</p>}
        <div className="flex items-center justify-end gap-2" style={{ marginTop: 12 }}>
          <button type="button" data-confirm-no onClick={onCancel} disabled={busy} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
            style={{ minHeight: 40, padding: '0 12px', borderRadius: 8, border: '1px solid rgba(27,56,40,0.16)', background: '#FFFFFF', color: INK, fontFamily: FONT, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>
            Cancel
          </button>
          <button type="button" data-confirm-yes onClick={onYes} disabled={busy} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
            style={{ minHeight: 40, padding: '0 12px', borderRadius: 8, border: 'none', background: danger ? DANGER : '#1B3828', color: '#FFFFFF', fontFamily: FONT, fontSize: 13.5, fontWeight: 600, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}>
            {yes}
          </button>
        </div>
      </div>
    </Portal>
  );
}
