'use client';
// Gavelling Crisis: change a resource type's name or measure (the unit it is counted in), or remove it. One row per type; Save checks
// the row landed. Remove asks in place first and says what goes with it.

import { useState } from 'react';
import { Ruler, Trash2 } from 'lucide-react';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { crisisError, saveResourceType, type CrisisRef } from '@/lib/crisis/api';
import type { Resource, ResourceType } from '@/lib/crisis/types';
import { Btn, Card, CardTitle, CK, fieldStyle } from '../../crisisKit';
import { ConfirmInline } from '../command/setupKit';
import { deleteResourceType } from './resourceApi';
import { UnitChips } from './UnitChips';

function TypeRow({ refx, type, amounts, onChanged }: { refx: CrisisRef; type: ResourceType; amounts: number; onChanged: () => void }) {
  const [name, setName] = useState(type.name);
  const [unit, setUnit] = useState(type.unit ?? '');
  const [busy, setBusy] = useState(false);
  const [ask, setAsk] = useState(false);
  const changed = name.trim() !== type.name || unit.trim() !== (type.unit ?? '');

  const save = async () => {
    if (!name.trim()) { notifyErr('Give the resource a name.', 'crisis-resource'); return; }
    setBusy(true);
    try {
      await saveResourceType(refx, type.id, { name: name.trim(), unit: unit.trim() || null });
      notifyOk(`${name.trim()} saved`, 'crisis-resource');
      onChanged();
    } catch (e) {
      notifyErr(crisisError(e, 'Could not save the resource.'), 'crisis-resource');
    } finally { setBusy(false); }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await deleteResourceType(refx, type.id);
      notifyOk(`${type.name} removed`, 'crisis-resource');
      onChanged();
    } catch (e) {
      notifyErr(crisisError(e, 'Could not remove the resource.'), 'crisis-resource');
      setBusy(false);
    }
  };

  return (
    <div style={{ padding: '10px 0', borderTop: `1px solid ${CK.hair}` }}>
      <div className="grid" style={{ gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', alignItems: 'start' }}>
        <label style={{ display: 'block' }}>
          <span style={{ display: 'block', margin: '0 0 4px', fontSize: 12, fontWeight: 700, color: CK.inkSoft }}>Name ({type.scope === 'cabinet' ? 'each cabinet' : 'each character'})</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} style={fieldStyle} />
        </label>
        <div>
          <label style={{ display: 'block' }}>
            <span style={{ display: 'block', margin: '0 0 4px', fontSize: 12, fontWeight: 700, color: CK.inkSoft }}>Measure</span>
            <input value={unit} onChange={(e) => setUnit(e.target.value)} maxLength={20} style={fieldStyle} placeholder="For example: ships, tonnes, $bn" />
          </label>
          <UnitChips value={unit} onPick={setUnit} />
        </div>
      </div>
      <div className="flex items-center flex-wrap gap-2" style={{ marginTop: 8 }}>
        <Btn tone="green" size="sm" disabled={busy || !changed} onClick={save}>Save</Btn>
        <Btn tone="danger" size="sm" icon={<Trash2 size={13} strokeWidth={1.5} aria-hidden />} disabled={busy || ask} onClick={() => setAsk(true)}>Remove</Btn>
      </div>
      {ask && (
        <ConfirmInline
          style={{ marginTop: 8 }}
          text={`Remove ${type.name}? ${amounts > 0
            ? `This takes away its ${amounts} ${amounts === 1 ? 'amount' : 'amounts'} on cabinets and characters, with the history of every change. Nothing else is touched. This cannot be undone.`
            : 'Nothing holds it yet, so nothing else changes.'}`}
          confirmLabel="Remove it"
          keepLabel="Keep it"
          busy={busy}
          onConfirm={() => { void remove(); }}
          onCancel={() => setAsk(false)}
        />
      )}
    </div>
  );
}

export default function EditResourceTypes({ refx, types, resources, onClose, onChanged }: {
  refx: CrisisRef; types: ResourceType[]; resources: Resource[]; onClose: () => void; onChanged: () => void;
}) {
  return (
    <Card warm style={{ marginBottom: 16 }}>
      <CardTitle icon={<Ruler size={17} strokeWidth={1.5} aria-hidden />} right={<Btn tone="ghost" size="sm" onClick={onClose}>Done</Btn>}>Names and Measures</CardTitle>
      {types.length === 0 ? <p style={{ margin: 0, fontSize: 13.5, color: CK.inkSoft }}>No resource types yet.</p>
        : types.map((t) => <TypeRow key={`${t.id}:${t.name}:${t.unit ?? ''}`} refx={refx} type={t} amounts={resources.filter((r) => r.type_id === t.id).length} onChanged={onChanged} />)}
    </Card>
  );
}
