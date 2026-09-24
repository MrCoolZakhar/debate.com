'use client';

// Confirmation in front of the algorithmic ASSIGN on a suggestion card.
//
// KenyaMUN (18 Sep 2026): the organiser worked through the Suggested
// Assignments strip and 286 delegates were seated and emailed their allocation
// in under two minutes, with nothing on screen saying that each press also
// sends an email. The strip re-flows after every assign, so the next card lands
// under the pointer and a run of clicks keeps going. This dialog states exactly
// what one press does (who, where, and whether an email goes out), offers to
// seat without emailing, and puts focus on Cancel so a stray Enter or a repeated
// click does nothing. Deliberately not the shared ConfirmModal: that one confirms
// on Enter from anywhere, which is the behaviour this exists to stop.

import { useEffect, useRef } from 'react';
import { Mail, MailX, X } from 'lucide-react';
import { ModalOverlay } from '@/components/ModalOverlay';
import { NEU } from '@/components/neu';

const OUTFIT = "var(--font-brand), sans-serif";

export interface AssignConfirmDialogProps {
  delegateName: string;
  countryName: string;
  committeeLabel: string;
  /** The conference's allocation_email_auto: does seating email the delegate? */
  emailsOnAssign: boolean;
  /** Other suggestions still in the strip after this one, for context. */
  remainingSuggestions: number;
  onCancel: () => void;
  onConfirm: (emailNow: boolean) => void;
}

export function AssignConfirmDialog({
  delegateName, countryName, committeeLabel, emailsOnAssign, remainingSuggestions, onCancel, onConfirm,
}: AssignConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    return () => { prev?.focus?.(); };
  }, []);

  // Tab stays inside the dialog.
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key !== 'Tab') return;
    const focusables = Array.from(cardRef.current?.querySelectorAll<HTMLElement>('button:not([disabled])') ?? []);
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  const btn: React.CSSProperties = {
    minHeight: 42, padding: '0 16px', borderRadius: 12, fontFamily: OUTFIT, fontSize: 12.5,
    fontWeight: 800, letterSpacing: '0.03em', cursor: 'pointer',
  };

  return (
    <ModalOverlay onClose={onCancel} dialogRole={null} scrimColor="rgba(27,20,16,0.42)">
      <div
        ref={cardRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="assign-confirm-title"
        aria-describedby="assign-confirm-body"
        onKeyDown={onKeyDown}
        className="flex flex-col gap-4"
        style={{ width: 440, maxWidth: '92vw', backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', borderRadius: 18, padding: 24 }}
      >
        <div className="flex items-start justify-between gap-3">
          <p id="assign-confirm-title" style={{ fontFamily: OUTFIT, fontSize: 17, fontWeight: 800, color: NEU.ink, lineHeight: 1.3 }}>
            Assign 1 delegate{emailsOnAssign ? ' and send 1 email' : ''}?
          </p>
          <button
            onClick={onCancel}
            aria-label="Cancel"
            className="focus:outline-none flex-shrink-0 inline-flex items-center justify-center"
            style={{ width: 30, height: 30, borderRadius: 999, border: 'none', background: 'transparent', color: NEU.inkSoft, cursor: 'pointer' }}
          >
            <X size={16} />
          </button>
        </div>

        <div id="assign-confirm-body" className="flex flex-col gap-2" style={{ fontFamily: OUTFIT, fontSize: 13.5, color: '#4A4238', lineHeight: 1.55 }}>
          <p>
            <strong style={{ color: NEU.ink }}>{delegateName}</strong> will be seated as{' '}
            <strong style={{ color: NEU.ink }}>{countryName}</strong> in{' '}
            <strong style={{ color: NEU.ink }}>{committeeLabel}</strong>.
          </p>
          <p className="flex items-start gap-2" style={{ color: emailsOnAssign ? '#6B4F12' : NEU.inkSoft }}>
            {emailsOnAssign ? <Mail size={15} style={{ flexShrink: 0, marginTop: 3 }} /> : <MailX size={15} style={{ flexShrink: 0, marginTop: 3 }} />}
            <span>
              {emailsOnAssign
                ? 'Allocation emails send automatically, so they are emailed their committee and country right away. An email cannot be taken back.'
                : 'Allocation emails are on manual release, so nobody is emailed now. Send them later from Allocation emails.'}
            </span>
          </p>
          {remainingSuggestions > 0 && (
            <p style={{ fontSize: 12, color: NEU.inkSoft }}>
              {remainingSuggestions} more {remainingSuggestions === 1 ? 'suggestion is' : 'suggestions are'} waiting. Each one is assigned separately.
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2.5 mt-1">
          <button
            ref={cancelRef}
            onClick={onCancel}
            className="flex-1 focus:outline-none focus-visible:ring-2"
            style={{ ...btn, border: '1.5px solid #DDD4C0', color: NEU.ink, backgroundColor: 'transparent' }}
          >
            CANCEL
          </button>
          {emailsOnAssign && (
            <button
              onClick={() => onConfirm(false)}
              className="flex-1 focus:outline-none"
              style={{ ...btn, border: '1.5px solid #1B3828', color: '#1B3828', backgroundColor: 'transparent' }}
            >
              ASSIGN, NO EMAIL
            </button>
          )}
          <button
            onClick={() => onConfirm(emailsOnAssign)}
            className="flex-1 focus:outline-none"
            style={{ ...btn, border: 'none', color: '#EED98A', backgroundColor: '#1B3828' }}
          >
            {emailsOnAssign ? 'ASSIGN AND EMAIL' : 'ASSIGN'}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}
