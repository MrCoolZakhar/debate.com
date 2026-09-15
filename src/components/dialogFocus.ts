'use client';

import { useEffect, type RefObject } from 'react';

const FOCUSABLE = [
  'a[href]', 'area[href]', 'button:not([disabled])', 'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])', 'textarea:not([disabled])', 'iframe', 'summary',
  '[tabindex]:not([tabindex="-1"])', '[contenteditable="true"]',
].join(',');

function focusablesIn(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE))
    .filter((el) => el.tabIndex >= 0 && el.getClientRects().length > 0 && !el.closest('[inert]'));
}

/**
 * Focus trap used by GrowDialog. Tab and Shift+Tab cycle inside the panel,
 * and focus that lands on the page underneath is pulled back in. A floating layer opened FROM
 * the dialog (DatePicker, a tooltip, a typeahead) portals into the same root AFTER the dialog,
 * so anything that follows the dialog's layer in document order counts as part of it.
 */
export function useDialogFocusTrap(
  panelRef: RefObject<HTMLElement | null>,
  layerRef: RefObject<HTMLElement | null>,
  closingRef: RefObject<boolean>,
): void {
  useEffect(() => {
    const inDialogLayer = (el: Node | null) => {
      const layer = layerRef.current;
      if (!layer || !el) return false;
      if (layer.contains(el)) return true;
      return !!(layer.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || e.defaultPrevented || closingRef.current) return;
      const panel = panelRef.current;
      if (!panel) return;
      const active = document.activeElement as HTMLElement | null;
      // Inside a nested floating layer: that layer owns its own Tab order.
      if (active && !panel.contains(active) && inDialogLayer(active)) return;
      const items = focusablesIn(panel);
      if (items.length === 0) { e.preventDefault(); panel.focus({ preventScroll: true }); return; }
      const first = items[0];
      const last = items[items.length - 1];
      if (!active || !panel.contains(active)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus({ preventScroll: true });
        return;
      }
      if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus({ preventScroll: true });
      }
    };
    const onFocusIn = (e: FocusEvent) => {
      if (closingRef.current) return;
      const panel = panelRef.current;
      const target = e.target as Node | null;
      if (!panel || !target || target === document.body || inDialogLayer(target)) return;
      panel.focus({ preventScroll: true });
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('focusin', onFocusIn);
    };
  }, [panelRef, layerRef, closingRef]);
}

/** Escape closes, unless a field or a nested control already used the key. */
export function useEscapeToClose(onEscape: () => void): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return;
      onEscape();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onEscape]);
}
