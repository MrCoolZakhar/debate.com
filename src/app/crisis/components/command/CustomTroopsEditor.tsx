'use client';
// Gavelling Crisis: the Crisis Director's custom troops (Settings, under Map). A type has a name, an optional picture,
// an optional sight range and optional details. Units on the map can be made from a type and then show its picture.
// Saved with settings.customUnitTypes, whole, each time a row is finished (a field left, a picture picked, a type added
// or removed). A type is kept only once it has a name.

import { useRef, useState } from 'react';
import { ImagePlus, Plus, Trash2, X } from 'lucide-react';
import { notifyErr } from '@/lib/appNotify';
import { crisisError, uploadCrisisImage } from '@/lib/crisis/api';
import {
  CUSTOM_UNIT_DETAILS_MAX, CUSTOM_UNIT_NAME_MAX, CUSTOM_UNIT_TYPE_MAX, newCustomUnitKey, safePictureUrl, type CustomUnitType,
} from '@/lib/crisis/unitTypes';
import { Btn, CK, FieldLabel, fieldStyle } from '../../crisisKit';
import { useCrisis } from '../../[conference]/[crisis]/CrisisContext';

export default function CustomTroopsEditor({ types, onSave }: { types: CustomUnitType[]; onSave: (next: CustomUnitType[]) => void }) {
  const { ref } = useCrisis();
  // The rows as typed. A row without a name yet lives only here.
  const [rows, setRows] = useState<CustomUnitType[]>(types);
  const [uploading, setUploading] = useState<string | null>(null);
  const fileFor = useRef<string | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const keep = (list: CustomUnitType[]): CustomUnitType[] => list
    .filter((t) => t.name.trim())
    .map((t) => ({
      key: t.key, name: t.name.trim(), picture_url: t.picture_url || null,
      sight_km: typeof t.sight_km === 'number' ? t.sight_km : null, details: t.details?.trim() ? t.details.trim() : null,
    }));
  const commit = (list: CustomUnitType[]) => {
    const next = keep(list);
    if (JSON.stringify(next) !== JSON.stringify(keep(types))) onSave(next);
  };
  const change = (key: string, patch: Partial<CustomUnitType>, save: boolean) => {
    const list = rows.map((t) => (t.key === key ? { ...t, ...patch } : t));
    setRows(list);
    if (save) commit(list);
  };
  const add = () => {
    if (rows.length >= CUSTOM_UNIT_TYPE_MAX) return;
    setRows([...rows, { key: newCustomUnitKey(), name: '', picture_url: null, sight_km: null, details: null }]);
  };
  const remove = (key: string) => {
    const list = rows.filter((t) => t.key !== key);
    setRows(list);
    commit(list);
  };
  const leaveName = (t: CustomUnitType) => {
    // A saved type cannot lose its name: put the saved one back.
    const saved = types.find((x) => x.key === t.key);
    if (!t.name.trim() && saved) { change(t.key, { name: saved.name }, false); return; }
    commit(rows);
  };
  const picked = async (file: File | undefined) => {
    const key = fileFor.current;
    if (fileInput.current) fileInput.current.value = '';
    if (!file || !key) return;
    setUploading(key);
    try {
      const url = await uploadCrisisImage(ref, file);
      change(key, { picture_url: url }, true);
    } catch (e) {
      notifyErr(crisisError(e, 'Could not upload the picture.'), 'crisis-settings');
    } finally { setUploading(null); }
  };

  return (
    <div style={{ fontFamily: CK.font }}>
      <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={(e) => { void picked(e.target.files?.[0]); }} />
      {rows.length === 0 && (
        <p style={{ margin: '0 0 10px', fontSize: 13, color: CK.inkSoft }}>No custom troops yet. Add one, and it shows up next to Army, Navy and the others when you add a unit.</p>
      )}
      {rows.map((t) => {
        const pic = safePictureUrl(t.picture_url);
        return (
          <div key={t.key} style={{ padding: '12px 0', borderTop: `1px solid ${CK.hair}` }}>
            <div className="flex items-center" style={{ gap: 10 }}>
              <button
                type="button" aria-label={pic ? `Change the picture of ${t.name || 'this troop'}` : `Add a picture for ${t.name || 'this troop'}`}
                title={pic ? 'Change the picture' : 'Add a picture'} disabled={uploading === t.key}
                onClick={() => { fileFor.current = t.key; fileInput.current?.click(); }}
                className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] grid place-items-center"
                style={{
                  width: 48, height: 48, borderRadius: '50%', flex: 'none', padding: 0, cursor: 'pointer', overflow: 'hidden', color: CK.inkSoft,
                  border: pic ? `2px solid ${CK.hair}` : `2px dashed ${CK.muted}`, background: pic ? CK.card : CK.well, opacity: uploading === t.key ? 0.5 : 1,
                }}
              >
                {pic
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={pic} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  : <ImagePlus size={20} strokeWidth={1.5} />}
              </button>
              <input
                style={{ ...fieldStyle, padding: '9px 12px' }} value={t.name} maxLength={CUSTOM_UNIT_NAME_MAX} placeholder="Name, such as Partisans" aria-label="Troop name"
                onChange={(e) => change(t.key, { name: e.target.value }, false)} onBlur={() => leaveName(t)}
                onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
              />
              <button
                type="button" aria-label={`Remove ${t.name || 'this troop'}`} title="Remove this troop" onClick={() => remove(t.key)}
                className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
                style={{ border: 0, background: 'transparent', cursor: 'pointer', color: CK.danger, lineHeight: 0, padding: 6, borderRadius: 8, flex: 'none' }}
              >
                <Trash2 size={16} strokeWidth={1.5} />
              </button>
            </div>
            {pic && (
              <button
                type="button" onClick={() => change(t.key, { picture_url: null }, true)}
                className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] inline-flex items-center"
                style={{ gap: 4, marginTop: 6, border: 0, background: 'transparent', cursor: 'pointer', color: CK.inkSoft, fontSize: 12.5, fontWeight: 700, padding: 2, fontFamily: CK.font }}
              >
                <X size={13} strokeWidth={1.5} />Remove picture
              </button>
            )}
            <div style={{ marginTop: 8, maxWidth: 220 }}>
              <FieldLabel>Sight range (km)</FieldLabel>
              <input
                type="number" min={0} max={5000} inputMode="numeric" style={{ ...fieldStyle, padding: '9px 12px' }} aria-label="Sight range in km"
                placeholder="Usual: 400" value={t.sight_km ?? ''}
                onChange={(e) => change(t.key, { sight_km: e.target.value === '' ? null : Math.max(0, Math.min(5000, Math.round(Number(e.target.value) || 0))) }, false)}
                onBlur={() => commit(rows)}
                onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
              />
            </div>
            <div style={{ marginTop: 8 }}>
              <FieldLabel>Details</FieldLabel>
              <textarea
                style={{ ...fieldStyle, minHeight: 64, resize: 'vertical', padding: '9px 12px' }} value={t.details ?? ''} maxLength={CUSTOM_UNIT_DETAILS_MAX}
                placeholder="What they are and what they can do (optional)" aria-label="Troop details"
                onChange={(e) => change(t.key, { details: e.target.value }, false)} onBlur={() => commit(rows)}
              />
            </div>
          </div>
        );
      })}
      <div className="flex flex-wrap items-center" style={{ gap: 10, paddingTop: rows.length ? 10 : 0, borderTop: rows.length ? `1px solid ${CK.hair}` : 'none' }}>
        <Btn size="sm" tone="ghost" disabled={rows.length >= CUSTOM_UNIT_TYPE_MAX} icon={<Plus size={14} strokeWidth={1.5} />} onClick={add}>Add a troop</Btn>
        <span style={{ fontSize: 12.5, color: CK.muted, fontVariantNumeric: 'tabular-nums' }}>{rows.length} of {CUSTOM_UNIT_TYPE_MAX}</span>
      </div>
    </div>
  );
}
