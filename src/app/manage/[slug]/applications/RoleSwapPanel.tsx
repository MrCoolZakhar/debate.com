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
//
// Prompt 80 (26 Nov 2026): a refusal because the person holds their
// delegation's tickets (code 'leader_tickets') also offers, in place: hand the
// tickets to another leader, remove the unpaid ones (asked in place), or write
// to Gavelling. Close sits on the right. Without `tickets` it draws as before.

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import GSelect from '@/components/GSelect';
import { NEU, OUTFIT } from '@/components/neu';
import { heldFacts, heldWords, ticketSummary, type SwapAsk, type TicketHold } from './roleSwap';

export type TicketHoldState = { state: 'loading' } | { state: 'ready'; hold: TicketHold } | { state: 'error'; message: string };

const INK = '#1C1410';
const FOREST = '#1B3828';
const GOLD = '#EED98A';
const RED = '#8B2020';

const btnBase: React.CSSProperties = {
  minHeight: 44, padding: '0 16px', borderRadius: 12, fontFamily: OUTFIT, fontSize: 14,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, textAlign: 'center',
};

export default function RoleSwapPanel({ ask, busy, error, onConfirm, onCancel, tickets, onMoveTickets, onRemoveUnpaid }: {
  ask: SwapAsk;
  busy: boolean;
  /** A refusal or failure of the swap itself, shown in place. */
  error: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** The tickets a leader holds (a 'leader_tickets' refusal). */
  tickets?: TicketHoldState | null;
  onMoveTickets?: (toAppId: string, toName: string) => void;
  onRemoveUnpaid?: (ids: string[]) => void;
}) {
  const [moveTo, setMoveTo] = useState('');
  const [askRemove, setAskRemove] = useState(false);
  if (ask.phase === 'checking') {
    return (
      <div className="flex items-center gap-2 w-full" role="status" style={{ minHeight: 44, fontFamily: OUTFIT, fontSize: 14, color: NEU.inkSoft }}>
        <Loader2 size={16} className="animate-spin" aria-hidden />
        Checking their other roles
      </div>
    );
  }

  if (ask.phase === 'blocked') {
    const hold = tickets?.state === 'ready' ? tickets.hold : null;
    const unpaid = hold ? hold.tickets.filter(t => t.removable) : [];
    const name = ask.check?.name ?? 'This person';
    const quiet: React.CSSProperties = { ...btnBase, fontWeight: 700, color: NEU.inkSoft, background: 'transparent', border: '1.5px solid #DDD4C0', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.5 : 1 };
    const main: React.CSSProperties = { ...btnBase, fontWeight: 800, border: 'none', backgroundColor: busy ? '#DDD4C0' : FOREST, color: busy ? NEU.inkSoft : GOLD, cursor: busy ? 'default' : 'pointer' };
    const mail = hold ? `mailto:wearegavelling@gmail.com?subject=${encodeURIComponent(`Move tickets: ${hold.conferenceAcronym}, ${name}`)}&body=${encodeURIComponent(
      `Conference: ${hold.conferenceAcronym}\nPerson: ${name}\nDelegation: ${hold.delegation ?? 'their delegation'}\nTickets: ${ticketSummary(hold.tickets)}\n\nPlease help us move these tickets so we can accept them in another role.`,
    )}` : null;
    return (
      <div className="flex flex-col gap-3 w-full" role="alert" style={{ minWidth: 0, fontFamily: OUTFIT }}>
        <p className="[overflow-wrap:anywhere]" style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: INK }}>{ask.message}</p>

        {tickets?.state === 'loading' && (
          <div className="flex items-center gap-2" role="status" style={{ fontSize: 13.5, color: NEU.inkSoft }}>
            <Loader2 size={15} className="animate-spin" aria-hidden /> Reading their tickets
          </div>
        )}
        {tickets?.state === 'error' && <p style={{ margin: 0, fontSize: 13.5, color: RED, fontWeight: 600 }}>{tickets.message}</p>}

        {hold && (
          <>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: INK }}>{ticketSummary(hold.tickets)}</p>

            <div className="flex flex-col gap-2" style={{ padding: '12px 14px', borderRadius: 14, background: '#FFFFFF', border: '1px solid #E4DAC4' }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: INK }}>Hand the tickets to another leader</p>
              {hold.others.length === 0 ? (
                <p style={{ margin: 0, fontSize: 13.5, color: NEU.inkSoft }}>This delegation has no other leader yet</p>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                    <GSelect value={moveTo} onChange={setMoveTo} placeholder="Pick a leader" aria-label="Leader to hand the tickets to"
                      disabled={busy} options={hold.others.map(o => ({ value: o.appId, label: o.name }))} />
                  </div>
                  <button type="button" className="focus:outline-none" disabled={busy || !moveTo} aria-busy={busy || undefined}
                    style={{ ...main, opacity: !moveTo ? 0.55 : 1 }}
                    onClick={() => { const o = hold.others.find(x => x.appId === moveTo); if (o && onMoveTickets) onMoveTickets(o.appId, o.name); }}>
                    {busy && <Loader2 size={15} className="animate-spin" aria-hidden />}
                    Move tickets
                  </button>
                </div>
              )}
            </div>

            {unpaid.length > 0 && onRemoveUnpaid && (
              <div className="flex flex-col gap-2" style={{ padding: '12px 14px', borderRadius: 14, background: '#FFFFFF', border: '1px solid #E4DAC4' }}>
                {askRemove ? (
                  <>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: INK }}>
                      Remove {unpaid.length} unpaid {unpaid.length === 1 ? 'ticket' : 'tickets'}? The delegates they covered will owe their own fee
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className="focus:outline-none" style={quiet} disabled={busy} onClick={() => setAskRemove(false)}>Back</button>
                      <button type="button" className="focus:outline-none" disabled={busy} aria-busy={busy || undefined}
                        style={{ ...quiet, color: RED, borderColor: 'rgba(139,32,32,0.35)' }}
                        onClick={() => { setAskRemove(false); onRemoveUnpaid(unpaid.map(t => t.id)); }}>
                        {busy && <Loader2 size={15} className="animate-spin" aria-hidden />}
                        Yes, remove them
                      </button>
                    </div>
                  </>
                ) : (
                  <button type="button" className="focus:outline-none self-start" style={quiet} disabled={busy} onClick={() => setAskRemove(true)}>
                    Remove unpaid tickets
                  </button>
                )}
              </div>
            )}
          </>
        )}

        {error && <p role="alert" className="[overflow-wrap:anywhere]" style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5, fontWeight: 700, color: RED }}>{error}</p>}

        <div className="flex flex-wrap items-center gap-2">
          {mail && (
            <a href={mail} className="focus:outline-none" style={{ fontSize: 14, fontWeight: 700, color: FOREST, textDecoration: 'underline', textUnderlineOffset: 3 }}>
              Contact Gavelling
            </a>
          )}
          <button type="button" onClick={onCancel} disabled={busy} className="focus:outline-none"
            style={{ ...quiet, marginLeft: 'auto' }}>
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
