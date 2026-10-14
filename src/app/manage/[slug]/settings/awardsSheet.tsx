'use client';

/**
 * The Awards tab's pop-up (13 Oct 2026): the role pop-up's look (roleSetup.tsx)
 * as a small generic sheet. A white header with an optional back arrow, the
 * title and the X; a cream body that scrolls; full screen at 720px and below.
 *
 * It joins the shared Escape stack (useModalEscape), so a ConfirmModal opened
 * over it takes Escape first, and locks the page scroll while open. Focus goes
 * into the sheet on open and back to whatever opened it on close; Tab stays
 * inside. Presentation only: every write is the caller's.
 */

import { useEffect, useRef, type ReactNode } from 'react';
import { ArrowLeft, X } from 'lucide-react';
import Portal from '@/components/Portal';
import { useModalEscape } from '@/components/ModalOverlay';
import { useScrollLock } from '@/hooks/useScrollLock';
import { STORE_CSS } from '../store/storeKit';
import { DASH_CSS } from '../financials/dashboardKit';
import { F, INK, HAIRLINE, ROW_CSS } from './panelKit';

const SHEET_CSS = `
.gva-backdrop { position: fixed; inset: 0; z-index: 50; display: flex; align-items: center; justify-content: center;
  background: rgba(27,20,16,0.42); padding: 24px; }
.gva-backdrop .gv-st-btn { min-height: 38px; padding: 0 14px; font-size: 14px; border-radius: 11px; }
.gva-panel { position: relative; display: flex; flex-direction: column; width: min(var(--gva-w, 820px), 100%); max-height: min(100%, 920px);
  background: #F3EEE2; border-radius: 24px; overflow: hidden; box-shadow: 0 30px 90px rgba(27,20,16,0.35); }
.gva-body { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; -webkit-overflow-scrolling: touch;
  container-type: inline-size; padding: 18px clamp(12px, 3vw, 24px) 24px; }
@media (max-width: 720px) {
  .gva-backdrop { padding: 0; }
  .gva-panel { width: 100%; height: 100%; max-height: none; border-radius: 0;
    padding-top: env(safe-area-inset-top, 0px); padding-bottom: env(safe-area-inset-bottom, 0px); }
}
.gva-icon { width: 44px; height: 44px; border-radius: 999px; border: none; cursor: pointer; display: inline-flex;
  align-items: center; justify-content: center; background: #F3EEE2; color: ${INK}; flex-shrink: 0; }
.gva-icon:focus { outline: none; }
.gva-icon:focus-visible { box-shadow: 0 0 0 2px #1B3828; }
`;

export function AwardsSheet({ title, onClose, onBack, backLabel = 'Back', width = 820, footer, closeOnEscape = true, children }: {
  title: ReactNode;
  onClose: () => void;
  /** Shows a back arrow before the title (a second view inside the same pop-up). */
  onBack?: () => void;
  backLabel?: string;
  width?: number;
  /** A row pinned under the body (Done, Save). */
  footer?: ReactNode;
  /** Off while a field inside owns Escape (the return note). */
  closeOnEscape?: boolean;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  useScrollLock(true);
  useModalEscape(onClose, closeOnEscape);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const t = window.setTimeout(() => closeRef.current?.focus({ preventScroll: true }), 40);
    return () => {
      window.clearTimeout(t);
      if (opener && opener.isConnected && typeof opener.focus === 'function') opener.focus({ preventScroll: true });
    };
  }, []);

  function trapTab(e: React.KeyboardEvent) {
    if (e.key !== 'Tab') return;
    const panel = panelRef.current;
    if (!panel || !panel.contains(document.activeElement)) return;
    const items = Array.from(panel.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )).filter(el => el.getClientRects().length > 0);
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  return (
    <Portal>
      <div className="gva-backdrop" onClick={onClose}>
        <style>{STORE_CSS}</style>
        <style>{DASH_CSS}</style>
        <style>{ROW_CSS}</style>
        <style>{SHEET_CSS}</style>
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="gva-title"
          className="gva-panel"
          style={{ ['--gva-w' as string]: `${width}px` }}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={trapTab}
        >
          <header className="flex items-center gap-3 flex-shrink-0" style={{ backgroundColor: '#FFFFFF', borderBottom: `1px solid ${HAIRLINE}`, padding: '12px clamp(12px, 2.6vw, 20px)' }}>
            {onBack && (
              <button type="button" className="gva-icon" onClick={onBack} aria-label={backLabel} title={backLabel}>
                <ArrowLeft size={20} strokeWidth={2.4} aria-hidden />
              </button>
            )}
            <h2 id="gva-title" className="min-w-0 flex-1" style={{ fontFamily: F, fontSize: 'clamp(19px, 2.4vw, 22px)', fontWeight: 800, color: INK, lineHeight: 1.2, overflowWrap: 'anywhere' }}>
              {title}
            </h2>
            <button ref={closeRef} type="button" className="gva-icon" onClick={onClose} aria-label="Close" title="Close">
              <X size={20} strokeWidth={2.4} aria-hidden />
            </button>
          </header>
          <div className="gva-body">{children}</div>
          {footer && (
            <div className="flex items-center justify-end gap-3 flex-wrap flex-shrink-0" style={{ backgroundColor: '#FFFFFF', borderTop: `1px solid ${HAIRLINE}`, padding: '12px clamp(12px, 2.6vw, 20px)' }}>
              {footer}
            </div>
          )}
        </div>
      </div>
    </Portal>
  );
}
