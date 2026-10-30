'use client';
// Gavelling Crisis: one entry of the History list. A batch is everything sent together (one Send, one directive
// answer, or a quick burst by one person): a single change reads as itself, several read as "N changes" that open to
// list them. Staff with map and unit power can also bring the map back to the point right after a batch.

import { useState } from 'react';
import { ChevronDown, ChevronUp, Layers, RotateCcw } from 'lucide-react';
import type { HistoryChange } from '@/lib/crisis/history';
import { Btn, CK } from '../../crisisKit';
import { ChangeDisc, PieceLine, describe, type ChangeCtx } from './changeKit';

const timeOf = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

export function ChangeRow({ c, ctx, staff, onOpen, flat }: { c: HistoryChange; ctx: ChangeCtx; staff: boolean; onOpen: () => void; flat?: boolean }) {
  const d = describe(c, ctx);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8E2424] hover:bg-[rgba(142,36,36,0.04)]"
      style={{ gap: 12, padding: '11px 6px', border: 0, borderTop: flat ? 0 : `1px solid ${CK.hair}`, background: 'transparent', cursor: 'pointer', font: 'inherit', borderRadius: 10, minWidth: 0 }}
    >
      <ChangeDisc d={d} />
      <span className="min-w-0 flex-1">
        <b style={{ display: 'block', fontSize: 14.5, fontWeight: 800, color: CK.ink, overflowWrap: 'anywhere' }}>{d.title}</b>
        {d.lines.map((l, i) => <span key={i} style={{ display: 'block', marginTop: 3 }}><PieceLine pieces={l} ctx={ctx} /></span>)}
        <span style={{ display: 'block', marginTop: 3, fontSize: 12.5, fontWeight: 600, color: CK.muted }} title={new Date(c.at).toLocaleString()}>
          {timeOf(c.at)}{staff && c.by ? <> · by <b style={{ color: CK.inkSoft }}>{c.by}</b></> : null}
        </span>
      </span>
    </button>
  );
}

/** "3 troop changes, 1 border, 2 areas". */
function summary(changes: HistoryChange[]): string {
  const troops = changes.filter((c) => c.type === 'unit').length;
  const borders = changes.filter((c) => c.type === 'region').length;
  const areas = changes.filter((c) => c.type === 'shape').length;
  const parts: string[] = [];
  if (troops) parts.push(`${troops} ${troops === 1 ? 'troop change' : 'troop changes'}`);
  if (borders) parts.push(`${borders} ${borders === 1 ? 'border' : 'borders'}`);
  if (areas) parts.push(`${areas} ${areas === 1 ? 'area' : 'areas'}`);
  return parts.join(', ');
}

export default function BatchEntry({ changes, at, by, ctx, staff, canRestore, whenLabel, onOpen, onRestore }: {
  changes: HistoryChange[];
  /** The time of the batch (its newest row). */
  at: string;
  by: string | null;
  ctx: ChangeCtx;
  staff: boolean;
  canRestore: boolean;
  /** "today at 14:32": the point the map would go back to. */
  whenLabel: string;
  onOpen: (c: HistoryChange) => void;
  /** Brings the map back; rejects with the reason (shown by the caller). */
  onRestore: () => Promise<void>;
}) {
  const many = changes.length > 1;
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const expandable = many || canRestore;

  const run = async () => {
    setBusy(true);
    try { await onRestore(); setConfirm(false); } catch { /* the caller said why */ } finally { setBusy(false); }
  };

  return (
    <div style={{ borderTop: `1px solid ${CK.hair}` }}>
      <div className="flex items-start" style={{ gap: 4 }}>
        {many ? (
          <button
            type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)}
            className="flex w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8E2424] hover:bg-[rgba(142,36,36,0.04)]"
            style={{ gap: 12, padding: '11px 6px', border: 0, background: 'transparent', cursor: 'pointer', font: 'inherit', borderRadius: 10, minWidth: 0, flex: 1 }}
          >
            <span className="flex-shrink-0 grid place-items-center" aria-hidden style={{ width: 38, height: 38, borderRadius: '50%', background: CK.red, color: '#fff', boxShadow: CK.shadowSm }}>
              <Layers size={19} strokeWidth={1.6} />
            </span>
            <span className="min-w-0 flex-1">
              <b style={{ display: 'block', fontSize: 14.5, fontWeight: 800, color: CK.ink }}>{changes.length} changes together</b>
              <span style={{ display: 'block', marginTop: 3, fontSize: 13.5, color: CK.inkSoft, overflowWrap: 'anywhere' }}>{summary(changes)}</span>
              <span style={{ display: 'block', marginTop: 3, fontSize: 12.5, fontWeight: 600, color: CK.muted }} title={new Date(at).toLocaleString()}>
                {timeOf(at)}{staff && by ? <> · by <b style={{ color: CK.inkSoft }}>{by}</b></> : null}
              </span>
            </span>
          </button>
        ) : (
          <div style={{ flex: 1, minWidth: 0 }}>
            <ChangeRow c={changes[0]} ctx={ctx} staff={staff} onOpen={() => onOpen(changes[0])} flat />
          </div>
        )}
        {expandable && (
          <button
            type="button" aria-expanded={open} aria-label={open ? 'Hide details' : many ? 'Show the changes' : 'Show more'} onClick={() => setOpen((o) => !o)}
            className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8E2424] hover:bg-[rgba(142,36,36,0.06)]"
            style={{ border: 0, background: 'transparent', cursor: 'pointer', color: CK.inkSoft, lineHeight: 0, padding: 10, marginTop: 6, borderRadius: 10, flex: 'none' }}
          >
            {open ? <ChevronUp size={18} strokeWidth={1.5} /> : <ChevronDown size={18} strokeWidth={1.5} />}
          </button>
        )}
      </div>

      {open && (
        <div style={{ padding: '0 6px 12px 6px' }}>
          {many && (
            <div style={{ marginLeft: 20, paddingLeft: 12, borderLeft: `2px solid ${CK.hair}` }}>
              {changes.map((c) => <ChangeRow key={c.rowId} c={c} ctx={ctx} staff={staff} onOpen={() => onOpen(c)} flat />)}
            </div>
          )}
          {canRestore && !confirm && (
            <div style={{ marginTop: many ? 8 : 0 }}>
              <Btn size="sm" tone="ghost" icon={<RotateCcw size={14} strokeWidth={1.5} />} onClick={() => setConfirm(true)}>Bring the map back to this point</Btn>
            </div>
          )}
          {canRestore && confirm && (
            <div style={{ marginTop: 8, padding: 12, borderRadius: 12, background: CK.well }}>
              <p style={{ margin: '0 0 8px', fontSize: 13.5, color: CK.ink }}>
                Bring the map back to how it was after the changes {whenLabel}? Units, territories and shapes go back to that point and everything changed since is undone. Any unsent changes are replaced.
              </p>
              <div className="flex flex-wrap" style={{ gap: 8 }}>
                <Btn size="sm" tone="red" disabled={busy} onClick={() => { void run(); }}>Yes, bring it back</Btn>
                <Btn size="sm" tone="ghost" disabled={busy} onClick={() => setConfirm(false)}>Keep it as it is</Btn>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
