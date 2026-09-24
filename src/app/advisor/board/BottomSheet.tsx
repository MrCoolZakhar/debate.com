'use client';

// A bottom sheet on a phone, a centred dialog from 640px. Portal, focus trap, Escape,
// backdrop, focus returned to what opened it. Motion only when the reader allows it.

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import Portal from '@/components/Portal';
import { C, FONT, SHADOW } from './tokens';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function BottomSheet({
  open,
  onClose,
  title,
  closeLabel,
  children,
  footer,
  initialFocus,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  closeLabel: string;
  children: ReactNode;
  footer?: ReactNode;
  /** A selector inside the sheet to focus first (else the panel itself). */
  initialFocus?: string;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();
  const closeRef = useRef(onClose);
  const focusRef = useRef(initialFocus);
  useEffect(() => { closeRef.current = onClose; focusRef.current = initialFocus; }, [onClose, initialFocus]);

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const t = window.setTimeout(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const sel = focusRef.current;
      // Without a named target the panel itself takes focus (no ring on the close button);
      // Tab then walks into the sheet.
      const target = (sel && panel.querySelector<HTMLElement>(sel)) || panel;
      target.focus({ preventScroll: true });
    }, 30);
    const onKey = (e: KeyboardEvent) => {
      const panel = panelRef.current;
      if (!panel) return;
      if (e.key === 'Escape') { e.stopPropagation(); closeRef.current(); return; }
      if (e.key !== 'Tab') return;
      const nodes = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((n) => n.offsetParent !== null || n === document.activeElement);
      if (nodes.length === 0) { e.preventDefault(); panel.focus(); return; }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !panel.contains(active))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (active === last || !panel.contains(active))) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey, true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = prevOverflow;
      if (opener && typeof opener.focus === 'function' && document.contains(opener)) opener.focus({ preventScroll: true });
    };
  }, [open]);

  if (!open) return null;
  return (
    <Portal>
      <div className="adv-sheet-root fixed inset-0 z-[1200] flex items-end justify-center sm:items-center sm:p-6" style={{ fontFamily: FONT }}>
        <div aria-hidden className="adv-sheet-backdrop absolute inset-0" style={{ backgroundColor: 'rgba(28,20,16,0.42)' }} onClick={onClose} />
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          className="adv-sheet-panel relative flex w-full flex-col rounded-t-3xl focus:outline-none sm:max-w-[520px] sm:rounded-3xl"
          style={{
            backgroundColor: C.cream,
            maxHeight: 'min(92dvh, 900px)',
            boxShadow: SHADOW.lift,
            paddingBottom: 'env(safe-area-inset-bottom)',
          }}
        >
          <div aria-hidden className="mx-auto mt-2.5 h-1.5 w-10 rounded-full sm:hidden" style={{ backgroundColor: 'rgba(27,56,40,0.18)' }} />
          <div className="flex items-center gap-3 px-5 pb-2 pt-3">
            <h2 id={titleId} className="min-w-0 flex-1 truncate" style={{ fontSize: 19, fontWeight: 800, color: C.ink, letterSpacing: '-0.01em' }}>{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label={closeLabel}
              title={closeLabel}
              className="adv-focus flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-[#1B3828]/[0.07]"
              style={{ color: C.forest }}
            >
              <X size={20} strokeWidth={2.2} aria-hidden />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5" style={{ overscrollBehavior: 'contain' }}>{children}</div>
          {footer && (
            <div className="px-5 pb-4 pt-3" style={{ boxShadow: `0 -1px 0 ${C.hairline}` }}>{footer}</div>
          )}
        </div>
      </div>
    </Portal>
  );
}
