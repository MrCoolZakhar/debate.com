'use client';
// Gavelling Crisis: one resource tile. Staff with the power change it inline: a stepper and a reason.

import { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { amount } from '@/lib/crisis/format';
import { adjustResource, createResource, crisisError, type CrisisRef } from '@/lib/crisis/api';
import type { Resource, ResourceType } from '@/lib/crisis/types';
import { Avatar, Btn, CK, fieldStyle, resourceIcon } from '../../crisisKit';
import ResourceHistoryDialog from './ResourceHistoryDialog';

export interface LastChange { delta: number; reason: string | null }

export function fmt(n: number): string {
  return amount(n);
}
export function signed(n: number): string { return `${n > 0 ? '+' : n < 0 ? '−' : ''}${fmt(Math.abs(n))}`; }

export default function ResourceTile({ refx, type, resource, target, last, canEdit, who }: {
  refx: CrisisRef; type: ResourceType; resource: Resource | null;
  target: { cabinet_id?: string; character_id?: string };
  last: LastChange | null; canEdit: boolean;
  who?: { name: string; picture_url: string | null; color: string };
}) {
  const [open, setOpen] = useState(false);
  const [delta, setDelta] = useState(0);
  const [initial, setInitial] = useState('0');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [history, setHistory] = useState(false);
  const unit = type.unit ? ` ${type.unit}` : '';

  const save = async () => {
    setBusy(true);
    try {
      if (!resource) {
        const n = Number(initial);
        if (!Number.isFinite(n)) { setHint('Type a number.'); return; }
        await createResource(refx, { type_id: type.id, amount: n, ...target });
        notifyOk(`${type.name} set`, 'crisis-resource');
      } else {
        if (!delta) { setHint('Change the amount first.'); return; }
        if (!reason.trim()) { setHint('Say why it changed.'); return; }
        await adjustResource(refx, resource.id, delta, reason.trim());
        notifyOk(`${type.name} changed`, 'crisis-resource');
      }
      setOpen(false); setDelta(0); setReason(''); setHint(null);
    } catch (e) {
      notifyErr(crisisError(e, 'Could not change the resource.'), 'crisis-resource');
    } finally { setBusy(false); }
  };

  const step = (d: number) => { setHint(null); setDelta((v) => v + d); };

  return (
    <div style={{ background: CK.card, borderRadius: 18, boxShadow: CK.shadow, padding: '12px 14px', minWidth: 0, border: '1px solid rgba(27,56,40,0.08)' }}>
      {/* Clicking the name or the amount opens the history graph. */}
      <button
        type="button"
        disabled={!resource}
        onClick={() => setHistory(true)}
        aria-label={`${type.name}: see how it changed`}
        title={resource ? 'See how it changed' : undefined}
        className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
        style={{ display: 'block', width: '100%', border: 0, background: 'transparent', padding: 0, textAlign: 'left', cursor: resource ? 'pointer' : 'default', fontFamily: CK.font, color: 'inherit', borderRadius: 10 }}
      >
      <span className="flex items-center gap-2" style={{ color: CK.red }}>
        {who ? <Avatar name={who.name} src={who.picture_url} size={30} color={who.color} /> : resourceIcon(type.name, 20)}
        <span style={{ minWidth: 0, display: 'block' }}>
          {who && <span style={{ display: 'block', margin: 0, fontSize: 12.5, fontWeight: 800, color: CK.ink, overflowWrap: 'anywhere' }}>{who.name}</span>}
          <span className="flex items-center gap-1.5" style={{ margin: 0, fontSize: who ? 11.5 : 13, fontWeight: 700, color: who ? CK.inkSoft : CK.ink, overflowWrap: 'anywhere' }}>
            {who && <span style={{ color: CK.red, lineHeight: 0 }}>{resourceIcon(type.name, 14)}</span>}{type.name}
          </span>
        </span>
      </span>
      <span style={{ display: 'block', margin: '8px 0 0', lineHeight: 1 }}>
        {resource ? (
          <><b style={{ fontSize: 30, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: CK.ink }}>{fmt(resource.amount)}</b><span style={{ fontSize: 13, fontWeight: 600, color: CK.inkSoft }}>{unit}</span></>
        ) : <span style={{ fontSize: 13, color: CK.muted, fontWeight: 600 }}>Not set</span>}
      </span>
      </button>
      {last && (
        <p style={{ margin: '8px 0 0', fontSize: 12, color: CK.inkSoft, overflowWrap: 'anywhere' }}>
          <b style={{ color: last.delta < 0 ? CK.danger : CK.ok, fontVariantNumeric: 'tabular-nums' }}>{signed(last.delta)}</b>{last.reason ? `, ${last.reason}` : ''}
        </p>
      )}
      {canEdit && !open && (
        <div style={{ marginTop: 10 }}>
          <Btn tone="ghost" size="sm" onClick={() => setOpen(true)}>{resource ? 'Change' : 'Set amount'}</Btn>
        </div>
      )}
      {canEdit && open && (
        <div className="flex flex-col" style={{ gap: 8, marginTop: 10 }}>
          {resource ? (
            <>
              <div className="flex items-center gap-2">
                <Btn tone="ghost" size="sm" aria-label="Take one off" onClick={() => step(-1)}><Minus size={15} strokeWidth={1.5} aria-hidden /></Btn>
                <input type="number" value={delta} onChange={(e) => { setHint(null); setDelta(Number(e.target.value) || 0); }} aria-label="Change by" style={{ ...fieldStyle, textAlign: 'center', fontVariantNumeric: 'tabular-nums', padding: '6px 8px' }} />
                <Btn tone="ghost" size="sm" aria-label="Add one" onClick={() => step(1)}><Plus size={15} strokeWidth={1.5} aria-hidden /></Btn>
              </div>
              <input value={reason} onChange={(e) => { setReason(e.target.value); setHint(null); }} maxLength={300} aria-label="Reason" placeholder="Why it changed (required)" style={fieldStyle} />
            </>
          ) : (
            <input type="number" value={initial} onChange={(e) => setInitial(e.target.value)} aria-label="Starting amount" style={fieldStyle} />
          )}
          {hint && <span role="alert" style={{ fontSize: 12, fontWeight: 700, color: CK.red }}>{hint}</span>}
          <div className="flex gap-2">
            <Btn tone="green" size="sm" disabled={busy} onClick={save}>{resource ? `Save ${delta ? signed(delta) : ''}`.trim() : 'Save'}</Btn>
            <Btn tone="ghost" size="sm" onClick={() => { setOpen(false); setHint(null); setDelta(0); }}>Back</Btn>
          </div>
        </div>
      )}
      {history && resource && (
        <ResourceHistoryDialog resource={{ id: resource.id, amount: resource.amount }} typeName={type.name} unit={type.unit} color={who?.color ?? CK.red} eyebrow={who?.name} onClose={() => setHistory(false)} />
      )}
    </div>
  );
}
