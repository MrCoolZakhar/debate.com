'use client';

/**
 * "Application in progress": asked once, when the apply page opens on a saved
 * draft (the account's `application_drafts` row, or a signed-out visitor's
 * browser draft) that got past step 1. Continue restores it exactly as the
 * page always did; Start again clears it and begins at step 1; Delete clears
 * it and leaves the form. Both destructive choices ask "are you sure" in place.
 *
 * Presentational only. The page owns every write: `onStartAgain` resolves to
 * null when the draft is gone, or to a sentence to show when it is not.
 * Escape means Continue, because Continue is the safe choice.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Portal from '@/components/Portal';
import { NEU, OUTFIT } from '@/components/neu';
import { FileText, RotateCcw, Trash2 } from 'lucide-react';

const DANGER = '#8B2020';

export interface ResumeDraftDialogProps {
  step: number;
  totalSteps: number;
  stepLabel?: string;
  /** When the draft was last written; null when unknown. */
  savedAt: Date | null;
  onContinue: () => void;
  onStartAgain: () => Promise<string | null>;
  /** Clears the draft and leaves the apply page. */
  onDelete: () => Promise<string | null>;
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
  step, totalSteps, stepLabel, savedAt, onContinue, onStartAgain, onDelete,
}: ResumeDraftDialogProps) {
  const [confirming, setConfirming] = useState<null | 'restart' | 'delete'>(null);
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

  async function runConfirmed(kind: 'restart' | 'delete') {
    if (confirming !== kind) { setConfirming(kind); setError(''); return; }
    if (busy) return;
    setBusy(true);
    setError('');
    const failure = await (kind === 'restart' ? onStartAgain() : onDelete());
    if (failure) {
      setBusy(false);
      setError(failure);
    }
    // On success the page closes the dialog (or leaves).
  }

  const where = stepLabel ? `Step ${step} of ${totalSteps}: ${stepLabel}` : `Step ${step} of ${totalSteps}`;
  const day = savedAt ? formatSavedDay(savedAt) : null;
  const when = !day ? null : day === 'today' || day === 'yesterday' ? `Saved ${day}` : `Saved on ${day}`;
  const pct = Math.round((Math.min(step, totalSteps) / Math.max(1, totalSteps)) * 100);

  const secondary = (kind: 'restart' | 'delete', Icon: typeof RotateCcw, label: string, armedLabel: string) => {
    const armed = confirming === kind;
    return (
      <button
        type="button"
        onClick={() => runConfirmed(kind)}
        disabled={busy}
        className="flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-[0.97] transition-[transform,background-color,color] duration-150"
        style={{
          flex: 1, height: 44, borderRadius: 12,
          background: armed ? DANGER : '#FFFFFF',
          border: armed ? '1px solid transparent' : '1px solid color-mix(in srgb, var(--gv-main) 16%, transparent)',
          boxShadow: armed ? 'none' : '0 1px 2px color-mix(in srgb, var(--gv-main) 6%, transparent)',
          color: armed ? '#FFFFFF' : kind === 'delete' ? DANGER : NEU.ink,
          fontFamily: OUTFIT, fontSize: 13.5, fontWeight: 600,
          cursor: busy ? 'default' : 'pointer', opacity: busy && !armed ? 0.6 : 1,
        }}
      >
        <Icon size={15} strokeWidth={2.2} aria-hidden />
        {busy && armed ? (kind === 'delete' ? 'Deleting' : 'Clearing') : armed ? armedLabel : label}
      </button>
    );
  };

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
          className="conf-rise"
          style={{
            width: 400, maxWidth: '100%',
            background: '#FFFFFF', borderRadius: 24,
            boxShadow: '0 24px 60px -16px color-mix(in srgb, var(--gv-main) 40%, transparent), 0 4px 14px -4px color-mix(in srgb, var(--gv-main) 16%, transparent)',
            padding: 24,
            fontFamily: OUTFIT,
          }}
        >
          <div className="flex items-center gap-3.5">
            <span
              aria-hidden
              className="flex items-center justify-center flex-shrink-0"
              style={{ width: 48, height: 48, borderRadius: 14, background: 'color-mix(in srgb, var(--gv-main) 9%, #FFFFFF)', color: NEU.forest }}
            >
              <FileText size={22} strokeWidth={2} />
            </span>
            <div className="min-w-0">
              <p id="resume-draft-title" style={{ margin: 0, fontSize: 19, fontWeight: 700, color: NEU.ink, lineHeight: 1.25, textWrap: 'balance' }}>
                Application in Progress
              </p>
              {when && (
                <p style={{ margin: '2px 0 0', fontSize: 12.5, fontWeight: 500, color: NEU.inkSoft }}>{when}</p>
              )}
            </div>
          </div>

          <div style={{ marginTop: 18, padding: '14px 16px', borderRadius: 16, background: '#F6F2E8' }}>
            <p id="resume-draft-line" style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: NEU.ink, lineHeight: 1.4 }}>
              {where}
            </p>
            <div aria-hidden style={{ marginTop: 10, height: 6, borderRadius: 6, background: 'color-mix(in srgb, var(--gv-main) 12%, transparent)', overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', borderRadius: 6, background: `linear-gradient(90deg, ${NEU.forest}, color-mix(in srgb, ${NEU.forest} 70%, #3E7A57))` }} />
            </div>
          </div>

          {confirming && (
            <p role="status" style={{ margin: '14px 0 0', fontSize: 12.5, fontWeight: 600, color: DANGER, lineHeight: 1.45 }}>
              {confirming === 'delete' ? 'This deletes your saved answers. Press again to delete.' : 'This clears your saved answers. Press again to start over.'}
            </p>
          )}
          {error && (
            <p role="alert" style={{ margin: '8px 0 0', fontSize: 12.5, fontWeight: 500, color: DANGER, lineHeight: 1.45 }}>
              {error}
            </p>
          )}

          <button
            ref={continueRef}
            type="button"
            onClick={handleContinue}
            disabled={busy}
            className="w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-[0.98] transition-transform"
            style={{
              marginTop: 18, height: 48, borderRadius: 12, border: 'none',
              background: `linear-gradient(180deg, color-mix(in srgb, ${NEU.forest} 82%, #3E7A57), ${NEU.forest})`,
              boxShadow: '0 6px 16px -6px color-mix(in srgb, var(--gv-main) 55%, transparent)',
              color: '#FFFFFF',
              fontFamily: OUTFIT, fontSize: 15, fontWeight: 700,
              cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1,
            }}
          >
            Continue where you left off
          </button>
          <div className="flex items-center gap-2.5" style={{ marginTop: 10 }}>
            {secondary('restart', RotateCcw, 'Start again', 'Clear and restart')}
            {secondary('delete', Trash2, 'Delete', 'Yes, delete')}
          </div>
        </div>
      </div>
    </Portal>
  );
}
