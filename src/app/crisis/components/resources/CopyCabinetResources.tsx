'use client';
// Gavelling Crisis: "Copy a cabinet's resources" to another cabinet (or every other cabinet). Pick the source and the target, untick
// what you do not want to copy, and choose whether the amounts come along or each starts at zero. An amount the target already
// has is never touched. Per-character amounts are not copied: characters differ from cabinet to cabinet.

import { useMemo, useState } from 'react';
import { CopyPlus } from 'lucide-react';
import GSelect from '@/components/GSelect';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { crisisError, type CrisisRef } from '@/lib/crisis/api';
import { amount as fmtAmount } from '@/lib/crisis/format';
import type { Cabinet, Resource, ResourceType } from '@/lib/crisis/types';
import { Btn, Card, CardTitle, CK, cabinetTint, resourceIcon, Segmented } from '../../crisisKit';
import { copyCabinetAmounts } from './resourceApi';

export default function CopyCabinetResources({ refx, types, resources, cabinets, onClose, onChanged }: {
  refx: CrisisRef; types: ResourceType[]; resources: Resource[]; cabinets: Cabinet[]; onClose: () => void; onChanged: () => void;
}) {
  const typeById = useMemo(() => new Map(types.map((t) => [t.id, t])), [types]);
  const withAny = cabinets.filter((c) => resources.some((r) => r.cabinet_id === c.id && typeById.get(r.type_id)?.scope === 'cabinet'));
  const [from, setFrom] = useState(withAny[0]?.id ?? '');
  const [to, setTo] = useState('all');
  const [keepAmounts, setKeepAmounts] = useState<'keep' | 'zero'>('keep');
  const [off, setOff] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const targets = useMemo(() => cabinets.filter((c) => c.id !== from && (to === 'all' || c.id === to)), [cabinets, from, to]);
  const source = useMemo(
    () => resources.filter((r) => r.cabinet_id === from && typeById.get(r.type_id)?.scope === 'cabinet')
      .sort((a, b) => (typeById.get(a.type_id)?.sort ?? 0) - (typeById.get(b.type_id)?.sort ?? 0)),
    [resources, from, typeById],
  );
  const rows = useMemo(() => source.map((r) => {
    const missing = targets.filter((c) => !resources.some((x) => x.type_id === r.type_id && x.cabinet_id === c.id)).length;
    return { r, missing };
  }), [source, targets, resources]);
  const toAdd = rows.filter((x) => !off.has(x.r.id)).reduce((n, x) => n + x.missing, 0);

  const copy = async () => {
    if (busy || toAdd === 0) return;
    setBusy(true);
    try {
      const items = rows.filter((x) => !off.has(x.r.id) && x.missing > 0).map((x) => ({ typeId: x.r.type_id, amount: keepAmounts === 'keep' ? x.r.amount : 0 }));
      const n = await copyCabinetAmounts(refx, items, targets.map((c) => c.id));
      notifyOk(`${n} ${n === 1 ? 'amount' : 'amounts'} copied`, 'crisis-resource');
      onChanged();
      onClose();
    } catch (e) {
      notifyErr(crisisError(e, 'Could not copy the resources.'), 'crisis-resource');
      onChanged();
    } finally { setBusy(false); }
  };

  const toggle = (id: string) => setOff((o) => { const n = new Set(o); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <Card warm style={{ marginBottom: 16 }}>
      <CardTitle icon={<CopyPlus size={17} strokeWidth={1.5} aria-hidden />} sub="Give other cabinets the same resources as one cabinet has." right={<Btn tone="ghost" size="sm" onClick={onClose}>Close</Btn>}>
        Copy a Cabinet&apos;s Resources
      </CardTitle>

      <div className="grid" style={{ gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', marginBottom: 12 }}>
        <div>
          <span style={{ display: 'block', margin: '0 0 5px', fontSize: 12, fontWeight: 700, color: CK.inkSoft }}>Copy from</span>
          <GSelect value={from} onChange={(v) => { setFrom(v); setOff(new Set()); }} options={withAny.map((c) => ({ value: c.id, label: c.name }))} aria-label="Copy from" />
        </div>
        <div>
          <span style={{ display: 'block', margin: '0 0 5px', fontSize: 12, fontWeight: 700, color: CK.inkSoft }}>Copy to</span>
          <GSelect value={to} onChange={setTo} options={[{ value: 'all', label: 'Every other cabinet' }, ...cabinets.filter((c) => c.id !== from).map((c) => ({ value: c.id, label: c.name }))]} aria-label="Copy to" />
        </div>
        <div>
          <span style={{ display: 'block', margin: '0 0 5px', fontSize: 12, fontWeight: 700, color: CK.inkSoft }}>Amounts</span>
          <Segmented<'keep' | 'zero'> ariaLabel="Amounts" value={keepAmounts} onChange={setKeepAmounts} options={[{ value: 'keep', label: 'Copy the amounts' }, { value: 'zero', label: 'Start at zero' }]} />
        </div>
      </div>

      {rows.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13.5, color: CK.inkSoft }}>This cabinet has no resources to copy.</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {rows.map(({ r, missing }) => {
            const t = typeById.get(r.type_id);
            const done = missing === 0;
            const on = !off.has(r.id) && !done;
            return (
              <li key={r.id} className="flex items-center flex-wrap" style={{ gap: '8px 12px', padding: '9px 0', borderTop: `1px solid ${CK.hair}`, opacity: done ? 0.55 : 1 }}>
                <input type="checkbox" checked={on} disabled={done} onChange={() => toggle(r.id)} aria-label={`Copy ${t?.name ?? 'resource'}`} style={{ width: 18, height: 18, accentColor: '#8E2424', flex: 'none' }} />
                <span aria-hidden style={{ width: 32, height: 32, borderRadius: '50%', display: 'grid', placeItems: 'center', color: CK.red, background: cabinetTint(CK.red, 0.1), flex: 'none' }}>{resourceIcon(t?.name ?? '', 16)}</span>
                <b style={{ flex: '1 1 160px', minWidth: 0, fontSize: 14.5, fontWeight: 800, overflowWrap: 'anywhere' }}>{t?.name ?? 'Resource'}</b>
                <span style={{ fontSize: 12.5, color: CK.inkSoft }}>
                  {done ? 'Everyone you picked has it' : `${missing} ${missing === 1 ? 'cabinet' : 'cabinets'} will get it`}
                </span>
                <span className="inline-flex items-baseline gap-1.5" style={{ minWidth: 90, justifyContent: 'flex-end' }}>
                  <b style={{ fontSize: 18, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{keepAmounts === 'keep' ? fmtAmount(r.amount) : '0'}</b>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: CK.inkSoft }}>{t?.unit ?? ''}</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex items-center flex-wrap" style={{ gap: '10px 18px', marginTop: 14 }}>
        <span className="inline-flex items-baseline gap-2"><b style={{ fontSize: 26, fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{toAdd}</b><span style={{ fontSize: 13, fontWeight: 600, color: CK.inkSoft }}>{toAdd === 1 ? 'amount' : 'amounts'} to copy</span></span>
        <span className="flex-1" />
        <Btn tone="green" icon={<CopyPlus size={15} strokeWidth={1.5} aria-hidden />} disabled={busy || toAdd === 0} onClick={() => { void copy(); }}>{busy ? 'Copying' : 'Copy the resources'}</Btn>
      </div>
    </Card>
  );
}
