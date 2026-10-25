'use client';
// Gavelling Crisis war map: the small panels that sit on the map card (top right on a wide screen,
// under the map on a phone): unit editor and viewer, shape editor and the border picker.
// Each panel keeps its own form state; the caller gives it a `key` so a new subject starts clean.

import { useState, type ReactNode } from 'react';
import { Check, Trash2, X, Undo2 } from 'lucide-react';
import GSelect from '@/components/GSelect';
import { Btn, CK, FieldLabel, fieldStyle } from '../../crisisKit';
import type { MapUnit, UnitKind } from '@/lib/crisis/types';
import { KIND_META, KIND_ORDER } from './mapData';

export interface PanelCabinet { id: string; name: string; short: string; color: string }

export interface UnitDraft {
  name: string;
  kind: UnitKind;
  strength: number;
  owner: string | null;
  note: string;
  revealed: string[];
  suspected: string[];
}

function Shell({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="wm-panel" style={{ fontFamily: CK.font }}>
      <div className="flex items-start justify-between" style={{ gap: 10, marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 800, color: CK.ink, overflowWrap: 'anywhere' }}>{title}</h3>
        <button
          type="button" onClick={onClose} aria-label="Close"
          className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
          style={{ border: 0, background: 'transparent', cursor: 'pointer', color: CK.inkSoft, lineHeight: 0, padding: 2, borderRadius: 8 }}
        >
          <X size={17} strokeWidth={1.5} />
        </button>
      </div>
      {children}
    </div>
  );
}

function Dot({ color, dashed }: { color: string; dashed?: boolean }) {
  return (
    <i
      aria-hidden
      style={{
        display: 'inline-block', width: 11, height: 11, borderRadius: '50%', flex: 'none',
        background: dashed ? 'transparent' : color, border: dashed ? `1.5px dashed ${CK.inkSoft}` : 'none',
      }}
    />
  );
}

function CheckRow({ label, color, checked, onChange }: { label: string; color: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center" style={{ gap: 8, fontSize: 13, color: CK.ink, cursor: 'pointer', padding: '3px 0' }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ accentColor: CK.forest, width: 15, height: 15, flex: 'none' }} />
      <Dot color={color} />
      <span style={{ overflowWrap: 'anywhere' }}>{label}</span>
    </label>
  );
}

function toggled(list: string[], id: string, on: boolean): string[] {
  const without = list.filter((x) => x !== id);
  return on ? [...without, id] : without;
}

function ownerOptions(cabinets: PanelCabinet[]) {
  return [{ value: '', label: 'Nobody' }, ...cabinets.map((c) => ({ value: c.id, label: c.name }))];
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div style={{ marginBottom: 10 }}><FieldLabel>{label}</FieldLabel>{children}</div>;
}

/** The editor for a unit (staff) and for a unit about to be added. */
export function UnitEditor({
  isNew, initial, cabinets, busy, onSubmit, onDelete, onClose,
}: {
  isNew: boolean; initial: UnitDraft; cabinets: PanelCabinet[]; busy: boolean;
  onSubmit: (d: UnitDraft) => void; onDelete?: () => void; onClose: () => void;
}) {
  const [d, setD] = useState<UnitDraft>(initial);
  const [confirm, setConfirm] = useState(false);
  const others = cabinets.filter((c) => c.id !== d.owner);
  const valid = d.name.trim().length > 0;
  return (
    <Shell title={isNew ? 'Add a Unit' : 'Unit'} onClose={onClose}>
      <Field label="Name">
        <input
          style={fieldStyle} value={d.name} maxLength={120} autoFocus={isNew}
          onChange={(e) => setD({ ...d, name: e.target.value })}
        />
      </Field>
      <div className="grid" style={{ gridTemplateColumns: '1fr 96px', gap: 8 }}>
        <Field label="Kind">
          <GSelect size="sm" value={d.kind} onChange={(v) => setD({ ...d, kind: v as UnitKind })} options={KIND_ORDER.map((k) => ({ value: k, label: KIND_META[k].label }))} aria-label="Kind" />
        </Field>
        <Field label="Strength">
          <input
            type="number" min={0} max={1000000} inputMode="numeric" style={{ ...fieldStyle, padding: '6px 10px' }} value={Number.isFinite(d.strength) ? d.strength : 0}
            onChange={(e) => setD({ ...d, strength: Math.max(0, Math.min(1000000, Math.round(Number(e.target.value) || 0))) })}
          />
        </Field>
      </div>
      <Field label="Owner">
        <GSelect
          size="sm" value={d.owner ?? ''} aria-label="Owner" options={ownerOptions(cabinets)}
          onChange={(v) => setD({ ...d, owner: v || null, revealed: v ? d.revealed.filter((x) => x !== v) : d.revealed, suspected: v ? d.suspected.filter((x) => x !== v) : d.suspected })}
        />
      </Field>
      {others.length > 0 && (
        <>
          <Field label="Known to">
            {others.map((c) => (
              <CheckRow
                key={c.id} label={c.name} color={c.color} checked={d.revealed.includes(c.id)}
                onChange={(on) => setD({ ...d, revealed: toggled(d.revealed, c.id, on), suspected: on ? d.suspected.filter((x) => x !== c.id) : d.suspected })}
              />
            ))}
          </Field>
          <Field label="Suspected by">
            {others.map((c) => (
              <CheckRow
                key={c.id} label={c.name} color={c.color} checked={d.suspected.includes(c.id) && !d.revealed.includes(c.id)}
                onChange={(on) => setD({ ...d, suspected: toggled(d.suspected, c.id, on), revealed: on ? d.revealed.filter((x) => x !== c.id) : d.revealed })}
              />
            ))}
          </Field>
        </>
      )}
      <Field label="Note for the crisis team">
        <textarea style={{ ...fieldStyle, minHeight: 56, resize: 'vertical' }} value={d.note} maxLength={600} onChange={(e) => setD({ ...d, note: e.target.value })} />
      </Field>
      <div className="flex flex-wrap items-center" style={{ gap: 8 }}>
        <Btn size="sm" disabled={busy || !valid} icon={<Check size={14} strokeWidth={1.5} />} onClick={() => onSubmit(d)}>{isNew ? 'Add unit' : 'Save'}</Btn>
        {!isNew && onDelete && !confirm && (
          <Btn size="sm" tone="danger" disabled={busy} icon={<Trash2 size={14} strokeWidth={1.5} />} onClick={() => setConfirm(true)}>Delete</Btn>
        )}
      </div>
      {confirm && onDelete && (
        <div style={{ marginTop: 10, padding: 10, borderRadius: 12, background: CK.well }}>
          <p style={{ margin: '0 0 8px', fontSize: 13, color: CK.ink }}>Remove this unit from the map?</p>
          <div className="flex" style={{ gap: 8 }}>
            <Btn size="sm" tone="red" disabled={busy} onClick={onDelete}>Yes, remove it</Btn>
            <Btn size="sm" tone="ghost" onClick={() => setConfirm(false)}>Keep it</Btn>
          </div>
        </div>
      )}
    </Shell>
  );
}

/** What a cabinet (or a delegate) is allowed to see about a unit. */
export function UnitViewer({ unit, suspected, cabinets, onClose }: { unit: MapUnit; suspected: boolean; cabinets: PanelCabinet[]; onClose: () => void }) {
  const owner = cabinets.find((c) => c.id === unit.owner_cabinet_id);
  return (
    <Shell title={suspected ? 'Suspected Site' : unit.name} onClose={onClose}>
      {suspected ? (
        <p style={{ margin: 0, fontSize: 13.5, color: CK.inkSoft }}>Your people think something is here. You do not know what it is yet.</p>
      ) : (
        <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 12px', fontSize: 13.5 }}>
          <dt style={{ color: CK.muted }}>Kind</dt><dd style={{ margin: 0 }}>{KIND_META[unit.kind].label}</dd>
          <dt style={{ color: CK.muted }}>Strength</dt><dd style={{ margin: 0, fontVariantNumeric: 'tabular-nums' }}>{unit.strength.toLocaleString('en-GB')}</dd>
          <dt style={{ color: CK.muted }}>Held by</dt>
          <dd className="flex items-center" style={{ margin: 0, gap: 6, overflowWrap: 'anywhere' }}>
            {owner ? (<><Dot color={owner.color} />{owner.name}</>) : 'Nobody'}
          </dd>
        </dl>
      )}
    </Shell>
  );
}

export interface ShapeDraft {
  label: string;
  owner: string | null;
  isPublic: boolean;
  revealed: string[];
}

/** Draw, refine and edit an area or a line. */
export function ShapeEditor({
  kind, phase, isNew, initial, pointCount, minPoints, cabinets, busy,
  onUndo, onFinish, onSave, onEditCorners, onDelete, onClose,
}: {
  kind: 'line' | 'area'; phase: 'draw' | 'refine' | 'saved'; isNew: boolean; initial: ShapeDraft; pointCount: number; minPoints: number;
  cabinets: PanelCabinet[]; busy: boolean;
  onUndo: () => void; onFinish: () => void; onSave: (d: ShapeDraft) => void; onEditCorners?: () => void; onDelete?: () => void; onClose: () => void;
}) {
  const [d, setD] = useState<ShapeDraft>(initial);
  const [confirm, setConfirm] = useState(false);
  const noun = kind === 'area' ? 'area' : 'line';
  const others = cabinets.filter((c) => c.id !== d.owner);
  const title = isNew ? (kind === 'area' ? 'Draw an Area' : 'Draw a Line') : (kind === 'area' ? 'Area' : 'Line');

  if (phase === 'draw') {
    return (
      <Shell title={title} onClose={onClose}>
        <p style={{ margin: '0 0 10px', fontSize: 13, color: CK.inkSoft }}>
          Click the map to add points. Double-click or press Finish to close the {noun}. You can drag the corners afterwards.
        </p>
        <p style={{ margin: '0 0 10px', fontSize: 13.5 }}>
          <b style={{ fontSize: 20, fontVariantNumeric: 'tabular-nums' }}>{pointCount}</b> <span style={{ color: CK.inkSoft }}>{pointCount === 1 ? 'point' : 'points'}</span>
        </p>
        <div className="flex flex-wrap" style={{ gap: 8 }}>
          <Btn size="sm" disabled={pointCount < minPoints} icon={<Check size={14} strokeWidth={1.5} />} onClick={onFinish}>Finish</Btn>
          <Btn size="sm" tone="ghost" disabled={pointCount === 0} icon={<Undo2 size={14} strokeWidth={1.5} />} onClick={onUndo}>Undo point</Btn>
          <Btn size="sm" tone="ghost" onClick={onClose}>Cancel</Btn>
        </div>
      </Shell>
    );
  }

  return (
    <Shell title={title} onClose={onClose}>
      {phase === 'refine' && (
        <p style={{ margin: '0 0 10px', fontSize: 13, color: CK.inkSoft }}>
          Drag the corners to fit the {noun}. Click a small dot to add a corner. Double-click a corner to remove it.
        </p>
      )}
      <Field label="Label">
        <input style={fieldStyle} value={d.label} maxLength={120} onChange={(e) => setD({ ...d, label: e.target.value })} />
      </Field>
      <Field label={kind === 'area' ? 'Held by' : 'Belongs to'}>
        <GSelect
          size="sm" value={d.owner ?? ''} aria-label="Owner" options={ownerOptions(cabinets)}
          onChange={(v) => setD({ ...d, owner: v || null, revealed: v ? d.revealed.filter((x) => x !== v) : d.revealed })}
        />
      </Field>
      <Field label="Who can see it">
        <CheckRow label="Everyone" color={CK.muted} checked={d.isPublic} onChange={(v) => setD({ ...d, isPublic: v })} />
        {!d.isPublic && others.map((c) => (
          <CheckRow key={c.id} label={c.name} color={c.color} checked={d.revealed.includes(c.id)} onChange={(on) => setD({ ...d, revealed: toggled(d.revealed, c.id, on) })} />
        ))}
      </Field>
      <div className="flex flex-wrap items-center" style={{ gap: 8 }}>
        <Btn size="sm" disabled={busy} icon={<Check size={14} strokeWidth={1.5} />} onClick={() => onSave(d)}>{isNew ? `Save ${noun}` : 'Save'}</Btn>
        {phase === 'saved' && onEditCorners && <Btn size="sm" tone="ghost" disabled={busy} onClick={onEditCorners}>Edit corners</Btn>}
        {phase === 'refine' && <Btn size="sm" tone="ghost" onClick={onClose}>Cancel</Btn>}
        {!isNew && onDelete && !confirm && (
          <Btn size="sm" tone="danger" disabled={busy} icon={<Trash2 size={14} strokeWidth={1.5} />} onClick={() => setConfirm(true)}>Delete</Btn>
        )}
      </div>
      {confirm && onDelete && (
        <div style={{ marginTop: 10, padding: 10, borderRadius: 12, background: CK.well }}>
          <p style={{ margin: '0 0 8px', fontSize: 13, color: CK.ink }}>Remove this {noun} from the map?</p>
          <div className="flex" style={{ gap: 8 }}>
            <Btn size="sm" tone="red" disabled={busy} onClick={onDelete}>Yes, remove it</Btn>
            <Btn size="sm" tone="ghost" onClick={() => setConfirm(false)}>Keep it</Btn>
          </div>
        </div>
      )}
    </Shell>
  );
}

/** Borders tool: the country that was clicked and who holds it. */
export function BorderPanel({ name, ownerId, cabinets, busy, onPick, onClose }: {
  name: string | null; ownerId: string | null; cabinets: PanelCabinet[]; busy: boolean; onPick: (id: string | null) => void; onClose: () => void;
}) {
  return (
    <Shell title="Borders" onClose={onClose}>
      {name ? (
        <>
          <p style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 700, overflowWrap: 'anywhere' }}>{name}</p>
          <Field label="Give this country to">
            <GSelect size="sm" value={ownerId ?? ''} aria-label="Owner of this country" disabled={busy} options={ownerOptions(cabinets)} onChange={(v) => onPick(v || null)} />
          </Field>
          <p style={{ margin: 0, fontSize: 12, color: CK.muted }}>The change is saved as soon as you pick.</p>
        </>
      ) : (
        <p style={{ margin: 0, fontSize: 13.5, color: CK.inkSoft }}>Click a country on the map, then pick who holds it.</p>
      )}
    </Shell>
  );
}
