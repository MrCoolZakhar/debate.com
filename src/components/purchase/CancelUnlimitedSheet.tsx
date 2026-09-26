'use client';

// "Cancel Unlimited?": the sheet Manage Account opens from "Cancel
// subscription". The purchase pop-up shell, narrow, in the light tone. The
// reasons are optional chips (several allowed); "Something else" reveals a
// one-line field (500 characters). "Keep Unlimited" is the primary action
// and just closes; "Cancel subscription" calls manage-subscription cancel with
// the chips and the note, then the caller re-reads my_unlimited_status().

import { useState } from 'react';
import { OUTFIT } from '@/components/neu';
import { PurchaseShell, PURCHASE_CSS, ErrorLine } from './purchaseKit';
import { CANCEL_NOTE_MAX, CANCEL_REASONS, manageErrorText, manageSubscription } from '@/lib/subscriptionManage';

const INK = '#1C1410';
const INK_SOFT = '#5A5046';
const FOREST = '#1B3828';
const IVORY = '#FAF8F3';

export default function CancelUnlimitedSheet({ untilDate, onClose, onCancelled }: {
  /** The long-form date Unlimited runs until. */
  untilDate: string | null;
  onClose: () => void;
  /** The cancel landed; the caller re-reads the status. */
  onCancelled: () => void;
}) {
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const toggle = (id: string) => {
    setPicked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  async function cancel() {
    if (busy) return;
    setBusy(true);
    setErr('');
    try {
      await manageSubscription({
        action: 'cancel',
        reasons: [...picked],
        note: picked.has('other') && note.trim() ? note.trim().slice(0, CANCEL_NOTE_MAX) : undefined,
      });
      onCancelled();
    } catch (e) {
      setErr(manageErrorText(e, 'cancel'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <PurchaseShell tone="light" label="Cancel Unlimited?" onClose={onClose} panelClass="gv-cancel" testId="cancel-unlimited">
      <style>{PURCHASE_CSS}{CSS}</style>
      <div className="gv-cancel-body">
        <h2 className="gv-buy-title" style={{ fontSize: 30 }}>Cancel Unlimited?</h2>
        <p className="gv-buy-sub">
          {untilDate ? `You keep Unlimited until ${untilDate}. You will not be charged again.` : 'You keep Unlimited until the end of the period you paid for. You will not be charged again.'}
        </p>

        <div>
          <p className="gv-cancel-label">
            What made you decide? <span className="gv-cancel-opt">Optional</span>
          </p>
          <div className="gv-cancel-chips" role="group" aria-label="Reasons">
            {CANCEL_REASONS.map(r => (
              <button
                key={r.id}
                type="button"
                aria-pressed={picked.has(r.id)}
                className="gv-cancel-chip"
                onClick={() => toggle(r.id)}
              >
                {r.label}
              </button>
            ))}
          </div>
          {picked.has('other') && (
            <input
              type="text"
              value={note}
              maxLength={CANCEL_NOTE_MAX}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Tell us more"
              aria-label="Tell us more"
              className="gv-cancel-note"
            />
          )}
        </div>

        {err ? <ErrorLine>{err}</ErrorLine> : null}

        <div className="gv-cancel-actions">
          <button type="button" className="gv-cancel-keep" onClick={onClose} disabled={busy}>Keep Unlimited</button>
          <button type="button" className="gv-cancel-go" onClick={() => { void cancel(); }} disabled={busy} aria-busy={busy || undefined}>
            {busy ? 'Cancelling…' : 'Cancel subscription'}
          </button>
        </div>
      </div>
    </PurchaseShell>
  );
}

const CSS = `
.gv-buy-panel.gv-cancel{max-width:520px;min-height:0}
.gv-buy-panel.gv-cancel .gv-buy-body{flex-direction:column}
.gv-cancel-body{padding:30px 28px 26px;display:flex;flex-direction:column;gap:18px;font-family:${OUTFIT}}
.gv-cancel-label{margin:0 0 10px;font-size:14px;font-weight:700;color:${INK}}
.gv-cancel-opt{margin-left:8px;font-size:12px;font-weight:600;color:${INK_SOFT}}
.gv-cancel-chips{display:flex;flex-wrap:wrap;gap:8px}
.gv-cancel-chip{min-height:40px;padding:0 14px;border-radius:999px;border:1.5px solid rgba(27,56,40,0.28);background:transparent;color:${INK};font-family:${OUTFIT};font-size:13.5px;font-weight:600;cursor:pointer;transition:background-color 140ms ease,border-color 140ms ease,color 140ms ease}
.gv-cancel-chip:hover{border-color:${FOREST};background:rgba(27,56,40,0.05)}
.gv-cancel-chip[aria-pressed="true"]{background:${FOREST};border-color:${FOREST};color:#EED98A}
.gv-cancel-note{width:100%;margin-top:10px;height:48px;border-radius:12px;border:1.5px solid rgba(27,56,40,0.28);background:#FFFFFF;padding:0 14px;font-family:${OUTFIT};font-size:16px;color:${INK}}
.gv-cancel-note:focus{outline:none;border-color:${FOREST};box-shadow:0 0 0 3px #FFFFFF,0 0 0 6px ${FOREST}}
.gv-cancel-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:4px}
.gv-cancel-keep{flex:1 1 200px;min-height:52px;padding:0 20px;border:none;border-radius:12px;background:linear-gradient(90deg,#1B3828 0%,#2A5A3C 100%);color:#FFFFFF;font-family:${OUTFIT};font-size:15px;font-weight:700;cursor:pointer}
.gv-cancel-keep:hover:not(:disabled){background:linear-gradient(90deg,#234a35 0%,#33694a 100%)}
.gv-cancel-go{flex:1 1 200px;min-height:52px;padding:0 20px;border:none;border-radius:12px;background:#FFFFFF;box-shadow:inset 0 0 0 1.5px ${INK};color:${INK};font-family:${OUTFIT};font-size:15px;font-weight:700;cursor:pointer}
.gv-cancel-go:hover:not(:disabled){background:${IVORY}}
.gv-cancel-keep:disabled,.gv-cancel-go:disabled{opacity:0.6;cursor:default}
@media (max-width:743px){.gv-cancel-body{padding:calc(22px + env(safe-area-inset-top)) 20px calc(24px + env(safe-area-inset-bottom))}}
`;
