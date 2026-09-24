'use client';

/**
 * "Application in progress": asked once, when the apply page opens on a saved
 * draft (the account's `application_drafts` row, or a signed-out visitor's
 * browser draft) that got past step 1. Continue restores it exactly as the
 * page always did; Start again clears it (after an inline "are you sure")
 * and begins at step 1.
 *
 * Presentational only. The page owns every write: `onStartAgain` resolves to
 * null when the draft is gone, or to a sentence to show when it is not.
 * Escape means Continue, because Continue is the safe choice.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Portal from '@/components/Portal';
import { NEU, OUTFIT } from '@/components/neu';

const DANGER = '#8B2020';

export interface ResumeDraftDialogProps {
  step: number;
  totalSteps: number;
  stepLabel?: string;
  /** When the draft was last written; null when unknown. */
  savedAt: Date | null;
  onContinue: () => void;
  onStartAgain: () => Promise<string | null>;
}

function formatSavedDay(d: Date): string {
  const now = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(d)) / 86_400_000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' };
  if (d.getFullYear() !== now.getFullYear()) opts.year = 'numeric';
  return d.toLocaleDateString('en-GB', opts);
}

export default function ResumeDraftDialog({
  step, totalSteps, stepLabel, savedAt, onContinue, onStartAgain,
}: ResumeDraftDialogProps) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const panelRef = useRef<HTMLDivElement | null>(null);

  // Portal mounts its children a render later, so focus through a callback ref.
  const continueRef = useCallback((node: HTMLButtonElement | null) => {
    if (node) node.focus({ preventScroll: true });
  }, []);

  const handleContinue = useCallback(() => {
    if (busy) return;
    onContinue();
  }, [busy, onContinue]);

  // Escape = Continue; Tab stays inside. Capture phase, stopped here, so no
  // other layer on the page also reacts to the key.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        handleContinue();
        return;
      }
      if (e.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>('button:not([disabled])'));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (!active || !panel.contains(active)) { e.preventDefault(); first.focus(); return; }
      if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
    }
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [handleContinue]);

  // No page scroll behind the dialog.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  async function handleStartAgain() {
    if (!confirming) { setConfirming(true); setError(''); return; }
    if (busy) return;
    setBusy(true);
    setError('');
    const failure = await onStartAgain();
    if (failure) {
      setBusy(false);
      setError(failure);
    }
    // On success the page closes the dialog.
  }

  const where = stepLabel ? `step ${step} of ${totalSteps} (${stepLabel})` : `step ${step} of ${totalSteps}`;
  const day = savedAt ? formatSavedDay(savedAt) : null;
  const when = !day ? '' : day === 'today' || day === 'yesterday' ? ` ${day}` : ` on ${day}`;
  const line = `You got to ${where}${when}.`;

  return (
    <Portal>
      <div
        className="fixed inset-0 flex items-center justify-center"
        style={{ zIndex: 1200, background: 'rgba(20, 30, 24, 0.42)', padding: 16 }}
      >
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="resume-draft-title"
          aria-describedby="resume-draft-line"
          style={{
            width: 360, maxWidth: '100%',
            background: '#FAF8F3', borderRadius: 20,
            boxShadow: '0 1px 0 rgba(255,255,255,0.7) inset, 0 18px 48px -12px rgba(27,56,40,0.35), 0 4px 12px -4px rgba(27,56,40,0.18)',
            padding: '22px 22px 18px',
            fontFamily: OUTFIT,
          }}
        >
          <p id="resume-draft-title" style={{ margin: 0, fontSize: 18, fontWeight: 700, color: NEU.ink, lineHeight: 1.3, textWrap: 'balance' }}>
            Application in progress
          </p>
          <p id="resume-draft-line" style={{ margin: '6px 0 0', fontSize: 13.5, fontWeight: 500, color: NEU.inkSoft, lineHeight: 1.5 }}>
            {line} Would you like to continue or start again?
          </p>

          {confirming && (
            <p role="status" style={{ margin: '12px 0 0', fontSize: 12.5, fontWeight: 600, color: DANGER, lineHeight: 1.45 }}>
              This clears your saved answers.
            </p>
          )}
          {error && (
            <p role="alert" style={{ margin: '8px 0 0', fontSize: 12.5, fontWeight: 500, color: DANGER, lineHeight: 1.45 }}>
              {error}
            </p>
          )}

          <div className="flex items-center gap-2.5" style={{ marginTop: 18 }}>
            <button
              ref={continueRef}
              type="button"
              onClick={handleContinue}
              disabled={busy}
              className="focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-[0.97] transition-transform"
              style={{
                flex: 1, height: 42, borderRadius: 999, border: 'none',
                background: NEU.forest, color: NEU.gold,
                fontFamily: OUTFIT, fontSize: 14, fontWeight: 700,
                cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1,
              }}
            >
              Continue
            </button>
            <button
              type="button"
              onClick={handleStartAgain}
              disabled={busy}
              className="focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-[0.97] transition-transform"
              style={{
                flex: 1, height: 42, borderRadius: 999,
                background: confirming ? DANGER : 'transparent',
                border: confirming ? 'none' : '1.5px solid color-mix(in srgb, var(--gv-main) 28%, transparent)',
                color: confirming ? '#FFFFFF' : NEU.ink,
                fontFamily: OUTFIT, fontSize: 14, fontWeight: 600,
                cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.7 : 1,
              }}
            >
              {busy ? 'Clearing...' : confirming ? 'Clear and start' : 'Start again'}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
