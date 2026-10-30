'use client';
// Gavelling Crisis: the Crisis Director's list of zone types (Settings, under Map). Each type has a colour, a name and a
// description; there can be up to 20. A zone on the map points at one type and is drawn in its colour. The list is
// saved with settings.zoneTypes, whole, each time a row is finished (a colour picked, a name or description left,
// a type added or removed). A type is kept only once it has a name.

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Btn, CK, fieldStyle } from '../../crisisKit';
import {
  SUGGESTED_ZONE_TYPES, ZONE_COLORS, ZONE_NAME_MAX, ZONE_TYPE_DESCRIPTION_MAX, ZONE_TYPE_MAX, newZoneTypeId, type ZoneType,
} from '@/lib/crisis/zones';

export default function ZoneTypesEditor({ types, onSave }: { types: ZoneType[]; onSave: (next: ZoneType[]) => void }) {
  // The rows as typed. A row without a name yet lives only here.
  const [rows, setRows] = useState<ZoneType[]>(types);
  const [openColor, setOpenColor] = useState<string | null>(null);

  const keep = (list: ZoneType[]) => list.filter((t) => t.name.trim()).map((t) => ({ ...t, name: t.name.trim(), description: t.description.trim() }));
  const commit = (list: ZoneType[]) => {
    const next = keep(list);
    if (JSON.stringify(next) !== JSON.stringify(types)) onSave(next);
  };
  const change = (id: string, patch: Partial<ZoneType>, save: boolean) => {
    const list = rows.map((t) => (t.id === id ? { ...t, ...patch } : t));
    setRows(list);
    if (save) commit(list);
  };
  const add = () => {
    if (rows.length >= ZONE_TYPE_MAX) return;
    const used = new Set(rows.map((t) => t.color.toLowerCase()));
    const color = ZONE_COLORS.find((c) => !used.has(c.toLowerCase())) ?? ZONE_COLORS[rows.length % ZONE_COLORS.length];
    setRows([...rows, { id: newZoneTypeId(), name: '', color, description: '' }]);
  };
  const addSuggested = () => {
    const list = SUGGESTED_ZONE_TYPES.map((t) => ({ ...t, id: newZoneTypeId() }));
    setRows(list);
    commit(list);
  };
  const remove = (id: string) => {
    const list = rows.filter((t) => t.id !== id);
    setRows(list);
    commit(list);
  };
  const leaveName = (t: ZoneType) => {
    // A saved type cannot lose its name: put the saved one back.
    const saved = types.find((x) => x.id === t.id);
    if (!t.name.trim() && saved) { change(t.id, { name: saved.name }, false); return; }
    commit(rows);
  };

  return (
    <div style={{ fontFamily: CK.font }}>
      {rows.length === 0 && (
        <div style={{ padding: '4px 0 10px' }}>
          <p style={{ margin: '0 0 8px', fontSize: 13, color: CK.inkSoft }}>No zone types yet. Staff can still draw a zone and pick any colour, but types keep your zones consistent.</p>
          <Btn size="sm" tone="ghost" onClick={addSuggested}>Add four suggested types</Btn>
        </div>
      )}
      {rows.map((t) => (
        <div key={t.id} style={{ padding: '10px 0', borderTop: `1px solid ${CK.hair}` }}>
          <div className="flex items-center" style={{ gap: 8 }}>
            <button
              type="button" aria-label={`Colour of ${t.name || 'this type'}`} aria-expanded={openColor === t.id} title="Change the colour"
              onClick={() => setOpenColor(openColor === t.id ? null : t.id)}
              className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
              style={{ width: 30, height: 30, borderRadius: 9, border: `2px dashed ${t.color}`, background: `${t.color}33`, cursor: 'pointer', flex: 'none', padding: 0 }}
            />
            <input
              style={{ ...fieldStyle, padding: '6px 10px' }} value={t.name} maxLength={ZONE_NAME_MAX} placeholder="Name, such as No-fly zone" aria-label="Zone type name"
              onChange={(e) => change(t.id, { name: e.target.value }, false)} onBlur={() => leaveName(t)}
              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            />
            <button
              type="button" aria-label={`Remove ${t.name || 'this type'}`} title="Remove this type" onClick={() => remove(t.id)}
              className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
              style={{ border: 0, background: 'transparent', cursor: 'pointer', color: CK.danger, lineHeight: 0, padding: 6, borderRadius: 8, flex: 'none' }}
            >
              <Trash2 size={16} strokeWidth={1.5} />
            </button>
          </div>
          <input
            style={{ ...fieldStyle, padding: '6px 10px', marginTop: 6 }} value={t.description} maxLength={ZONE_TYPE_DESCRIPTION_MAX}
            placeholder="What it means in this crisis" aria-label="Zone type description"
            onChange={(e) => change(t.id, { description: e.target.value }, false)} onBlur={() => commit(rows)}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          />
          {openColor === t.id && (
            <div role="radiogroup" aria-label="Zone type colour" className="flex flex-wrap" style={{ gap: 6, marginTop: 8 }}>
              {ZONE_COLORS.map((c) => {
                const on = c.toLowerCase() === t.color.toLowerCase();
                return (
                  <button
                    key={c} type="button" role="radio" aria-checked={on} aria-label={c} title={c}
                    onClick={() => { change(t.id, { color: c }, true); setOpenColor(null); }}
                    className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
                    style={{ width: 24, height: 24, borderRadius: 7, border: 0, cursor: 'pointer', background: c, boxShadow: on ? `0 0 0 2px #fff, 0 0 0 4px ${CK.ink}` : 'none' }}
                  />
                );
              })}
            </div>
          )}
        </div>
      ))}
      <div className="flex flex-wrap items-center" style={{ gap: 10, paddingTop: rows.length ? 10 : 0, borderTop: rows.length ? `1px solid ${CK.hair}` : 'none' }}>
        <Btn size="sm" tone="ghost" disabled={rows.length >= ZONE_TYPE_MAX} icon={<Plus size={14} strokeWidth={1.5} />} onClick={add}>Add a zone type</Btn>
        <span style={{ fontSize: 12.5, color: CK.muted, fontVariantNumeric: 'tabular-nums' }}>{rows.length} of {ZONE_TYPE_MAX}</span>
      </div>
    </div>
  );
}
