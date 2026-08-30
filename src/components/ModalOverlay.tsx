'use client';

// ── The house modal backdrop ──────────────────────────────────────────────────
//
// One implementation, shared by every dimmed-backdrop dialog in the app. There
// used to be four byte-identical copies of this (CommitteeEditorModal,
// manage/assignment/page.tsx, manage/assignment/delegationShared.tsx,
// manage/documents/page.tsx); they all delegate here now so behaviour that
// belongs to *every* modal only has to be written once.
//
// What every ModalOverlay gets for free:
//   • background scroll lock (`useScrollLock`) — reference counted, so a confirm
//     stacked on a drawer does not release the drawer's lock when it closes
//   • Escape to dismiss, routed to the TOP-MOST overlay only, so one Escape
//     never collapses a whole stack of nested dialogs
//   • `role="dialog"` + `aria-modal` on the backdrop
//
// It is deliberately NOT used for dropdowns, typeaheads, tooltips or hover
// cards — those are non-modal floating layers that must keep the page scrolling
// (see the PaymentMenu portal pattern in AGENTS.md).

import { useEffect, useRef } from 'react';
import Portal from '@/components/Portal';
import { useScrollLock } from '@/hooks/useScrollLock';

// Escape stack. Mounting order is the visual stacking order here (a nested
// modal always mounts after its parent), so the last registered handler is the
// top-most one and is the only one Escape reaches.
const escapeStack: Array<{ close: () => void }> = [];

let escapeBound = false;
function onDocumentKeyDown(e: KeyboardEvent) {
  if (e.key !== 'Escape') return;
  const top = escapeStack[escapeStack.length - 1];
  if (!top) return;
  e.stopPropagation();
  top.close();
}

/**
 * Register a dismissable modal on the shared Escape stack.
 *
 * `ModalOverlay` uses this internally. It is exported for the surfaces that
 * cannot delegate their whole backdrop — `ModalShell` in the live status
 * modals renders a `w-full` card that relies on being a direct flex child, so
 * wrapping it in ModalOverlay's shrink-to-fit div would collapse its width.
 * Those surfaces call this plus `useScrollLock` and keep their own markup.
 *
 * Sharing ONE stack is the point: two independent Escape handlers would both
 * fire for a single keypress and close a dialog the user could not see.
 */
export function useModalEscape(onClose: () => void, enabled: boolean = true) {
  /* The latest `onClose` is parked in a ref so the listener effect below can
     depend only on `enabled`. Assigned in an effect rather than during render:
     writing a ref while rendering is a lint error and is genuinely unsound
     under concurrent rendering, where a render can be thrown away. The stack
     entry closes over the ref, not the value, so it always calls the current
     handler even though it was pushed once on mount. */
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; });

  useEffect(() => {
    if (!enabled) return;
    const entry = { close: () => closeRef.current() };
    escapeStack.push(entry);
    if (!escapeBound) {
      document.addEventListener('keydown', onDocumentKeyDown, true);
      escapeBound = true;
    }
    return () => {
      const i = escapeStack.indexOf(entry);
      if (i !== -1) escapeStack.splice(i, 1);
      if (escapeStack.length === 0 && escapeBound) {
        document.removeEventListener('keydown', onDocumentKeyDown, true);
        escapeBound = false;
      }
    };
  }, [enabled]);
}

export interface ModalOverlayProps {
  children: React.ReactNode;
  onClose: () => void;
  /** Set false for a blocking surface that must not be dismissed with Escape. */
  closeOnEscape?: boolean;
  /** Backdrop padding. The three ex-copies used `px-4`; the house default adds `py-10`. */
  paddingClassName?: string;
  /**
   * ARIA role for the backdrop. Pass `null` when the card inside already
   * declares its own `role="dialog"` / `role="alertdialog"`, so the tree does
   * not end up with two nested dialogs.
   */
  dialogRole?: 'dialog' | 'alertdialog' | null;
  labelledBy?: string;
  label?: string;
  /**
   * Backdrop colour. Defaults to the neutral scrim the four original copies
   * used. The newer surfaces pass the warm `rgba(27,20,16,0.42)`, which is the
   * house language over an ivory app — neutral black reads cold against it.
   * The two should converge on the warm value; kept as a prop rather than a
   * silent global change so that lands as its own reviewable decision.
   */
  scrimColor?: string;
}

export function ModalOverlay({
  children,
  onClose,
  closeOnEscape = true,
  paddingClassName = 'px-4 py-10',
  dialogRole = 'dialog',
  labelledBy,
  label,
  scrimColor = 'rgba(0,0,0,0.4)',
}: ModalOverlayProps) {
  useScrollLock(true);
  // The same hook the stand-alone surfaces use, rather than a second copy of
  // the stack bookkeeping — one implementation, so the ordering rules cannot
  // drift apart between the two entry points.
  useModalEscape(onClose, closeOnEscape);

  // Portal'd to document.body / #fit-root: the manage layout's content wrapper
  // establishes its own stacking context (`relative z-10`), which traps
  // `position: fixed` descendants below the header (z-30) and sidebar (z-25).
  // Portaling out of that subtree is the only way the dim backdrop covers them.
  return (
    <Portal>
      <div
        role={dialogRole ?? undefined}
        aria-modal={dialogRole ? true : undefined}
        aria-labelledby={dialogRole && labelledBy ? labelledBy : undefined}
        aria-label={dialogRole && !labelledBy ? label : undefined}
        className={`fixed inset-0 z-50 flex items-center justify-center ${paddingClassName}`}
        style={{ backgroundColor: scrimColor }}
        onClick={onClose}
      >
        <div onClick={e => e.stopPropagation()}>{children}</div>
      </div>
    </Portal>
  );
}

export default ModalOverlay;
