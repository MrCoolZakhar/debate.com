'use client';

// The first-allocation pop-up in front of ASSIGN on a suggestion card.
//
// KenyaMUN (18 Sep 2026): 286 delegates were seated and emailed in under two
// minutes with nothing on screen saying each press also sends an email. Owner,
// 21 Oct 2026: say it ONCE, on the organiser's first allocation, not on every
// press. One primary action, a "Don't show this again" box (ticked, so the
// default really is "once"), and a quiet way out to manual release. Closing it
// (X, Escape, the scrim) cancels and writes nothing.

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { ModalOverlay } from '@/components/ModalOverlay';
import { NEU } from '@/components/neu';

const OUTFIT = "var(--font-brand), sans-serif";

/** Per organiser, per browser: has this person been shown the pop-up and
 *  asked not to see it again? Every read and write survives a blocked store. */
const SEEN_KEY = (userId: string) => `gavelling-assign-email-intro:${userId}`;

export function assignIntroSeen(userId: string | null | undefined): boolean {
  if (!userId) return false;
  try { return window.localStorage.getItem(SEEN_KEY(userId)) === '1'; } catch { return false; }
}

export function markAssignIntroSeen(userId: string | null | undefined): void {
  if (!userId) return;
  try { window.localStorage.setItem(SEEN_KEY(userId), '1'); } catch { /* private window: it shows again, harmless */ }
}

export interface AssignConfirmDialogProps {
  delegateName: string;
  countryName: string;
  committeeLabel: string;
  /** True while switching this conference to manual release. */
  switching: boolean;
  onCancel: () => void;
  /** Assign and email. `dontShowAgain` is the box's value. */
  onConfirm: (dontShowAgain: boolean) => void;
  /** Switch the conference to manual release, then assign without emailing. */
  onManualInstead: (dontShowAgain: boolean) => void;
}

export function AssignConfirmDialog({
  delegateName, countryName, committeeLabel, switching, onCancel, onConfirm, onManualInstead,
}: AssignConfirmDialogProps) {
  const [dontShowAgain, setDontShowAgain] = useState(true);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    primaryRef.current?.focus();
    return () => { prev?.focus?.(); };
  }, []);

  // Tab stays inside the dialog.
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key !== 'Tab') return;
    const focusables = Array.from(cardRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled])') ?? []);
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  return (
    <ModalOverlay onClose={onCancel} dialogRole={null} scrimColor="rgba(27,20,16,0.42)">
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="assign-confirm-title"
        aria-describedby="assign-confirm-body"
        onKeyDown={onKeyDown}
        className="flex flex-col gap-4"
        style={{ width: 420, maxWidth: '92vw', backgroundColor: '#FFFFFF', borderRadius: 18, padding: 24, boxShadow: '0 24px 60px rgba(27,56,40,0.22)' }}
      >
        <div className="flex items-start justify-between gap-3">
          <p id="assign-confirm-title" style={{ fontFamily: OUTFIT, fontSize: 18, fontWeight: 800, color: NEU.ink, lineHeight: 1.3 }}>
            Assign and Email
          </p>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close"
            className="focus:outline-none flex-shrink-0 inline-flex items-center justify-center"
            style={{ width: 30, height: 30, borderRadius: 999, border: 'none', background: 'transparent', color: NEU.inkSoft, cursor: 'pointer' }}
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>

        <p id="assign-confirm-body" className="[overflow-wrap:anywhere]" style={{ fontFamily: OUTFIT, fontSize: 14, color: NEU.inkSoft, lineHeight: 1.5 }}>
          <strong style={{ color: NEU.ink }}>{delegateName}</strong> is emailed their seat,{' '}
          <strong style={{ color: NEU.ink }}>{countryName}</strong> in <strong style={{ color: NEU.ink }}>{committeeLabel}</strong>, as soon as you assign.
        </p>

        <button
          ref={primaryRef}
          type="button"
          onClick={() => onConfirm(dontShowAgain)}
          disabled={switching}
          className="focus:outline-none"
          style={{
            minHeight: 46, borderRadius: 12, border: 'none', fontFamily: OUTFIT, fontSize: 14, fontWeight: 700,
            color: NEU.gold, background: 'linear-gradient(135deg, #1B3828, #2A5039)', cursor: switching ? 'wait' : 'pointer',
            opacity: switching ? 0.6 : 1,
          }}
        >
          Assign and email
        </button>

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <label className="inline-flex items-center gap-2 cursor-pointer" style={{ fontFamily: OUTFIT, fontSize: 13, color: NEU.inkSoft }}>
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={e => setDontShowAgain(e.target.checked)}
              style={{ accentColor: '#1B3828', width: 16, height: 16 }}
            />
            Don&apos;t show this again
          </label>
          <button
            type="button"
            onClick={() => onManualInstead(dontShowAgain)}
            disabled={switching}
            className="focus:outline-none"
            style={{
              border: 'none', background: 'transparent', padding: 0, fontFamily: OUTFIT, fontSize: 13, fontWeight: 700,
              color: NEU.ink, textDecoration: 'underline', textUnderlineOffset: 3, cursor: switching ? 'wait' : 'pointer',
            }}
          >
            {switching ? 'Switching…' : 'Send allocation emails manually instead'}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}
