'use client';

// ── The role swap, asked in place (owner, 16 Nov 2026) ────────────────────
//
// Drawn where the Accept button was (the Applications row, its review drawer,
// the Team applicant pop-up), never as a pop-up of its own. Three contents:
//   checking  while accept_role_swap_check answers
//   blocked   the server's sentence and Close; nothing is written
//   confirm   "Accept {name} as {role}?", one line per thing removed, then
//             "Accept and remove {old role}" and Cancel
// The caller owns every write (roleSwap.ts); this file only draws and asks.

import { Loader2 } from 'lucide-react';
import { NEU, OUTFIT } from '@/components/neu';
import { heldFacts, heldWords, type SwapAsk } from './roleSwap';

const INK = '#1C1410';
const FOREST = '#1B3828';
const GOLD = '#EED98A';
const RED = '#8B2020';

const btnBase: React.CSSProperties = {
  minHeight: 44, padding: '0 16px', borderRadius: 12, fontFamily: OUTFIT, fontSize: 14,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, textAlign: 'center',
};

export default function RoleSwapPanel({ ask, busy, error, onConfirm, onCancel }: {
  ask: SwapAsk;
  busy: boolean;
  /** A refusal or failure of the swap itself, shown in place. */
  error: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (ask.phase === 'checking') {
    return (
      <div className="flex items-center gap-2 w-full" role="status" style={{ minHeight: 44, fontFamily: OUTFIT, fontSize: 14, color: NEU.inkSoft }}>
        <Loader2 size={16} className="animate-spin" aria-hidden />
        Checking their other roles
      </div>
    );
  }

  if (ask.phase === 'blocked') {
    return (
      <div className="flex flex-col gap-3 w-full" role="alert" style={{ minWidth: 0, fontFamily: OUTFIT }}>
        <p className="[overflow-wrap:anywhere]" style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: INK }}>{ask.message}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onCancel} className="focus:outline-none"
            style={{ ...btnBase, fontWeight: 700, color: NEU.inkSoft, background: 'transparent', border: '1.5px solid #DDD4C0', cursor: 'pointer' }}>
            Close
          </button>
        </div>
      </div>
    );
  }

  const { check } = ask;
  const words = heldWords(check);
  return (
    <div className="flex flex-col gap-3 w-full" style={{ minWidth: 0, fontFamily: OUTFIT }}>
      <p className="[overflow-wrap:anywhere]" style={{ margin: 0, fontSize: 15.5, fontWeight: 800, lineHeight: 1.3, color: INK }}>
        Accept {check.name} as {check.role_word}?
      </p>
      {check.held.map(h => {
        const facts = heldFacts(h);
        return (
          <div key={h.id || h.role} className="flex flex-col gap-1.5" style={{ minWidth: 0 }}>
            <p className="[overflow-wrap:anywhere]" style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5, color: INK }}>
              This removes their {h.role_word} place:
            </p>
            {facts.length > 0 && (
              <ul className="flex flex-col gap-1" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {facts.map(f => (
                  <li key={f} className="flex gap-2 [overflow-wrap:anywhere]" style={{ fontSize: 13.5, lineHeight: 1.5, color: NEU.inkSoft }}>
                    <span aria-hidden style={{ flexShrink: 0, width: 5, height: 5, marginTop: 8, borderRadius: 999, backgroundColor: FOREST, opacity: 0.55 }} />
                    <span style={{ minWidth: 0 }}>{f}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
      {error && (
        <p role="alert" className="[overflow-wrap:anywhere]" style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5, fontWeight: 700, color: RED }}>{error}</p>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onConfirm} disabled={busy} aria-busy={busy} className="focus:outline-none"
          style={{ ...btnBase, flex: '1 1 220px', fontWeight: 800, border: 'none', backgroundColor: busy ? '#DDD4C0' : FOREST, color: busy ? NEU.inkSoft : GOLD, cursor: busy ? 'default' : 'pointer' }}>
          {busy && <Loader2 size={15} className="animate-spin" aria-hidden />}
          Accept and remove {words}
        </button>
        <button type="button" onClick={onCancel} disabled={busy} className="focus:outline-none"
          style={{ ...btnBase, flex: '0 1 auto', fontWeight: 700, color: NEU.inkSoft, background: 'transparent', border: '1.5px solid #DDD4C0', opacity: busy ? 0.5 : 1, cursor: busy ? 'default' : 'pointer' }}>
          Cancel
        </button>
      </div>
    </div>
  );
}
