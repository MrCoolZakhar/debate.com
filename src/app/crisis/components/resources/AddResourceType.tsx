'use client';
// Gavelling Crisis: add a resource type (name, unit, per cabinet or per character). Amounts are set on the tiles.

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { addResourceType, crisisError, type CrisisRef } from '@/lib/crisis/api';
import { Btn, Card, CardTitle, FieldLabel, Segmented, fieldStyle } from '../../crisisKit';

export default function AddResourceType({ refx, onClose }: { refx: CrisisRef; onClose: () => void }) {
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const [scope, setScope] = useState<'cabinet' | 'character'>('cabinet');
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  const save = async () => {
    if (!name.trim()) { setHint('Give the resource a name.'); return; }
    setBusy(true);
    try {
      await addResourceType(refx, { name: name.trim(), unit: unit.trim() || null, scope });
      notifyOk('Resource added. Set the starting amounts on its tiles.', 'crisis-resource');
      onClose();
    } catch (e) {
      notifyErr(crisisError(e, 'Could not add the resource.'), 'crisis-resource');
    } finally { setBusy(false); }
  };

  return (
    <Card warm style={{ marginBottom: 16 }}>
      <CardTitle icon={<Plus size={17} strokeWidth={1.5} aria-hidden />}>Add a resource type</CardTitle>
      <div className="grid" style={{ gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <div><FieldLabel htmlFor="rt-name">Name</FieldLabel><input id="rt-name" value={name} onChange={(e) => { setName(e.target.value); setHint(null); }} maxLength={60} style={fieldStyle} placeholder="For example: Submarines" /></div>
        <div><FieldLabel htmlFor="rt-unit" hint="optional">Unit</FieldLabel><input id="rt-unit" value={unit} onChange={(e) => setUnit(e.target.value)} maxLength={20} style={fieldStyle} placeholder="For example: ships" /></div>
        <div><FieldLabel>Who holds it</FieldLabel><Segmented ariaLabel="Scope" value={scope} onChange={setScope} options={[{ value: 'cabinet', label: 'Each cabinet' }, { value: 'character', label: 'Each character' }]} /></div>
      </div>
      <div className="flex items-center gap-2 flex-wrap" style={{ marginTop: 14 }}>
        <Btn tone="green" disabled={busy} onClick={save}>Add resource</Btn>
        <Btn tone="ghost" onClick={onClose}>Back</Btn>
        {hint && <span role="alert" style={{ fontSize: 13, fontWeight: 700, color: '#8E2424' }}>{hint}</span>}
      </div>
    </Card>
  );
}
