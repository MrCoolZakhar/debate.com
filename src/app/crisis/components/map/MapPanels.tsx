'use client';
// Gavelling Crisis map: the small panels that sit on the map card (top right on a wide screen,
// under the map on a phone): unit picker, editor and viewer, the territory card (a country or a drawn
// area: who holds it, and how to reshape it), drawing new territory, and a character's card.
// Each panel keeps its own form state; the caller gives it a `key` so a new subject starts clean.

import { useEffect, useState, type ReactNode } from 'react';
import { Check, Pencil, Plus, RotateCcw, Trash2, X, Undo2 } from 'lucide-react';
import GSelect from '@/components/GSelect';
import { amount as fmtAmount } from '@/lib/crisis/format';
import { Btn, CK, FieldLabel, fieldStyle } from '../../crisisKit';
import type { Character, MapShape, MapUnit, UnitKind } from '@/lib/crisis/types';
import { ZONE_COLORS, ZONE_NAME_MAX, ZONE_NO_TYPE_COLOR, type ZoneType } from '@/lib/crisis/zones';
import { KIND_META, KIND_ORDER } from './mapData';
import { glyphSvg } from './glyphs';

export interface PanelCabinet { id: string; name: string; short: string; color: string }

export interface UnitDraft {
  name: string;
  kind: UnitKind;
  /** The amount shown on the token (database column `strength`). */
  strength: number;
  owner: string | null;
  note: string;
  revealed: string[];
  /** How far it sees, in km; null = the default for its kind. */
  sight: number | null;
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

/** A unit kind drawn as its glyph in ink. */
export function KindGlyph({ kind, size = 22 }: { kind: UnitKind; size?: number }) {
  return <span aria-hidden style={{ display: 'inline-flex', lineHeight: 0 }} dangerouslySetInnerHTML={{ __html: glyphSvg(kind, size, CK.ink) }} />;
}

/** One row of choices that wraps: the cabinets, and optionally "Nobody". */
export function OwnerPicker({ value, cabinets, withNobody, disabled, ariaLabel, onChange }: {
  /** undefined: nobody has been chosen yet (not even "Nobody"). */
  value: string | null | undefined; cabinets: PanelCabinet[]; withNobody?: boolean; disabled?: boolean; ariaLabel: string; onChange: (id: string | null) => void;
}) {
  const options: Array<{ id: string | null; label: string; title: string; color: string; dashed?: boolean }> = [
    ...cabinets.map((c) => ({ id: c.id as string | null, label: c.short, title: c.name, color: c.color })),
    ...(withNobody ? [{ id: null as string | null, label: 'Nobody', title: 'Nobody', color: CK.inkSoft, dashed: true }] : []),
  ];
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="flex flex-wrap" style={{ background: CK.well, borderRadius: 11, padding: 3, gap: 2 }}>
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button
            key={o.id ?? 'nobody'} type="button" role="radio" aria-checked={on} title={o.title} disabled={disabled}
            onClick={() => onChange(o.id)}
            className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] inline-flex items-center"
            style={{
              gap: 6, border: 0, padding: '5px 10px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
              background: on ? CK.card : 'transparent', color: on ? CK.forest : CK.inkSoft, boxShadow: on ? CK.shadowSm : 'none', fontFamily: CK.font,
            }}
          >
            <Dot color={o.color} dashed={o.dashed} />
            <span style={{ overflowWrap: 'anywhere', textAlign: 'left' }}>{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Step 1 of adding a unit: choose what kind it is. */
export function KindPicker({ onPick, onClose }: { onPick: (k: UnitKind) => void; onClose: () => void }) {
  return (
    <Shell title="Add a Unit" onClose={onClose}>
      <p style={{ margin: '0 0 10px', fontSize: 13, color: CK.inkSoft }}>Choose what kind of unit, then click the map to place it.</p>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
        {KIND_ORDER.map((k) => (
          <button
            key={k} type="button" onClick={() => onPick(k)} title={KIND_META[k].label}
            className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] flex flex-col items-center justify-center active:scale-[0.97] transition-transform"
            style={{ gap: 4, border: 0, borderRadius: 12, padding: '10px 2px 7px', background: CK.well, color: CK.ink, cursor: 'pointer', fontFamily: CK.font, fontSize: 11, fontWeight: 700, minWidth: 0 }}
          >
            <KindGlyph kind={k} size={24} />
            <span style={{ overflowWrap: 'anywhere', textAlign: 'center', lineHeight: 1.15 }}>{KIND_META[k].label}</span>
          </button>
        ))}
      </div>
    </Shell>
  );
}

/** Step 2 of adding a unit: the kind is chosen, now the map is clicked. */
export function PlaceUnitPanel({ kind, onBack, onClose }: { kind: UnitKind; onBack: () => void; onClose: () => void }) {
  return (
    <Shell title="Place the Unit" onClose={onClose}>
      <div className="flex items-center" style={{ gap: 8, marginBottom: 10 }}>
        <KindGlyph kind={kind} size={22} />
        <b style={{ fontSize: 14 }}>{KIND_META[kind].label}</b>
      </div>
      <p style={{ margin: '0 0 10px', fontSize: 13, color: CK.inkSoft }}>Click the map where it should go.</p>
      <Btn size="sm" tone="ghost" onClick={onBack}>Change kind</Btn>
    </Shell>
  );
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
  // The amount stays text while it is typed (so the 0 can be cleared); it is checked when the unit is saved.
  const [amountText, setAmountText] = useState(String(Number.isFinite(initial.strength) ? initial.strength : 0));
  const [amountErr, setAmountErr] = useState(false);
  const others = cabinets.filter((c) => c.id !== d.owner);
  const valid = d.name.trim().length > 0;
  const submit = () => {
    const t = amountText.trim();
    const n = t === '' ? NaN : Number(t);
    if (!Number.isInteger(n) || n < 0 || n > 1000000) { setAmountErr(true); return; }
    onSubmit({ ...d, strength: n });
  };
  const amount = (
    <Field label="Amount">
      <input
        type="text" inputMode="numeric" autoComplete="off" aria-invalid={amountErr} aria-label="Amount"
        style={{ ...fieldStyle, padding: '6px 10px', ...(amountErr ? { boxShadow: `0 0 0 2px ${CK.red}` } : {}) }} value={amountText}
        onChange={(e) => { setAmountText(e.target.value.replace(/[^0-9]/g, '').slice(0, 7)); setAmountErr(false); }}
        onKeyDown={(e) => { if (e.key === 'Enter' && valid && !busy) submit(); }}
      />
    </Field>
  );
  const amountMsg = amountErr ? <p role="alert" style={{ margin: '-4px 0 8px', fontSize: 12, fontWeight: 600, color: CK.red }}>Enter a whole number from 0 to 1,000,000.</p> : null;
  const ownerField = (
    <Field label="Owner">
      <GSelect
        size="sm" value={d.owner ?? ''} aria-label="Owner" options={ownerOptions(cabinets)}
        onChange={(v) => setD({ ...d, owner: v || null, revealed: v ? d.revealed.filter((x) => x !== v) : d.revealed })}
      />
    </Field>
  );
  return (
    <Shell title={isNew ? 'Add a Unit' : 'Unit'} onClose={onClose}>
      {isNew && (
        <div className="flex items-center" style={{ gap: 8, marginBottom: 10 }}>
          <KindGlyph kind={d.kind} size={20} />
          <b style={{ fontSize: 13.5 }}>{KIND_META[d.kind].label}</b>
        </div>
      )}
      <Field label="Name">
        <input
          style={fieldStyle} value={d.name} maxLength={120} autoFocus={isNew}
          onChange={(e) => setD({ ...d, name: e.target.value })}
          onKeyDown={(e) => { if (e.key === 'Enter' && isNew && valid && !busy) submit(); }}
        />
      </Field>
      {isNew ? (
        <>
          <div className="grid" style={{ gridTemplateColumns: '96px 1fr', gap: 8 }}>
            {amount}
            {ownerField}
          </div>
          {amountMsg}
        </>
      ) : (
        <>
          <div className="grid" style={{ gridTemplateColumns: '1fr 96px', gap: 8 }}>
            <Field label="Kind">
              <GSelect size="sm" value={d.kind} onChange={(v) => setD({ ...d, kind: v as UnitKind })} options={KIND_ORDER.map((k) => ({ value: k, label: KIND_META[k].label }))} aria-label="Kind" />
            </Field>
            {amount}
          </div>
          {amountMsg}
          {ownerField}
          <Field label="Sight range (km)">
            <input
              type="number" min={0} max={5000} inputMode="numeric" style={{ ...fieldStyle, padding: '6px 10px' }}
              placeholder={`${KIND_META[d.kind].sight} (usual for ${KIND_META[d.kind].label.toLowerCase()})`}
              value={d.sight === null ? '' : d.sight}
              onChange={(e) => setD({ ...d, sight: e.target.value === '' ? null : Math.max(0, Math.min(5000, Math.round(Number(e.target.value) || 0))) })}
            />
            <p style={{ margin: '4px 0 0', fontSize: 12, color: CK.inkSoft }}>
              {d.kind === 'spy'
                ? 'You can also drag the round handle on its sight ring on the map. Spies are never spotted: only their own side, the crisis team and the sides ticked below can see one, even on their land or inside their sight range.'
                : 'You can also drag the round handle on its sight ring on the map. Other sides see this unit when it is inside one of their sight circles.'}
            </p>
          </Field>
          {others.length > 0 && (
            <Field label="Known to">
              {others.map((c) => (
                <CheckRow
                  key={c.id} label={c.name} color={c.color} checked={d.revealed.includes(c.id)}
                  onChange={(on) => setD({ ...d, revealed: toggled(d.revealed, c.id, on) })}
                />
              ))}
            </Field>
          )}
          <Field label="Note for the crisis team">
            <textarea style={{ ...fieldStyle, minHeight: 56, resize: 'vertical' }} value={d.note} maxLength={600} onChange={(e) => setD({ ...d, note: e.target.value })} />
          </Field>
        </>
      )}
      <div className="flex flex-wrap items-center" style={{ gap: 8 }}>
        <Btn size="sm" disabled={busy || !valid} icon={<Check size={14} strokeWidth={1.5} />} onClick={submit}>{isNew ? 'Add unit' : 'Save'}</Btn>
        {isNew && <Btn size="sm" tone="ghost" onClick={onClose}>Cancel</Btn>}
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
export function UnitViewer({ unit, cabinets, onClose }: { unit: MapUnit; cabinets: PanelCabinet[]; onClose: () => void }) {
  const owner = cabinets.find((c) => c.id === unit.owner_cabinet_id);
  return (
    <Shell title={unit.name} onClose={onClose}>
      <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 12px', fontSize: 13.5 }}>
        <dt style={{ color: CK.muted }}>Kind</dt><dd style={{ margin: 0 }}>{KIND_META[unit.kind].label}</dd>
        <dt style={{ color: CK.muted }}>Amount</dt><dd style={{ margin: 0, fontVariantNumeric: 'tabular-nums' }}>{fmtAmount(unit.strength)}</dd>
        <dt style={{ color: CK.muted }}>Held by</dt>
        <dd className="flex items-center" style={{ margin: 0, gap: 6, overflowWrap: 'anywhere' }}>
          {owner ? (<><Dot color={owner.color} />{owner.name}</>) : 'Nobody'}
        </dd>
      </dl>
    </Shell>
  );
}

function Confirm({ text, yes, busy, onYes, onNo }: { text: string; yes: string; busy: boolean; onYes: () => void; onNo: () => void }) {
  return (
    <div style={{ marginTop: 10, padding: 10, borderRadius: 12, background: CK.well }}>
      <p style={{ margin: '0 0 8px', fontSize: 13, color: CK.ink }}>{text}</p>
      <div className="flex flex-wrap" style={{ gap: 8 }}>
        <Btn size="sm" tone="red" disabled={busy} onClick={onYes}>{yes}</Btn>
        <Btn size="sm" tone="ghost" onClick={onNo}>Keep it</Btn>
      </div>
    </div>
  );
}

/** The details of a drawn territory that are saved with its outline. */
export interface TerritoryInfo { label: string; description: string }

/**
 * A selected country or drawn area: who holds it and, for staff with map power, how to reshape it. Like a map editor's
 * side card: the outline is changed on the map (corners, small dots on the sides, or the outline itself), the name and
 * description are typed here, and Save keeps all of it while Cancel puts everything back. The holder applies at once.
 * `detailed` outlines (many corners) are reshaped by pressing on the outline; simple ones also show corners.
 */
export function TerritoryCard({
  name, kind, owner, cabinets, editable, detailed, edited, busy, info, outlineDirty, canUndo,
  onOwner, onUndo, onSave, onCancel, onReset, onDelete, onClose,
}: {
  name: string; kind: 'country' | 'area'; owner: string | null; cabinets: PanelCabinet[]; editable: boolean; detailed: boolean;
  edited: boolean; busy: boolean;
  /** A drawn area's saved name and description (null for a country). */
  info: TerritoryInfo | null;
  /** The outline has been changed on the map and not saved yet. */
  outlineDirty: boolean; canUndo: boolean;
  onOwner: (id: string | null) => void; onUndo: () => void; onSave: (info: TerritoryInfo | null) => void; onCancel: () => void;
  onReset?: () => void; onDelete?: () => void; onClose: () => void;
}) {
  const [confirm, setConfirm] = useState<'reset' | 'delete' | null>(null);
  const [label, setLabel] = useState(info?.label ?? '');
  const [desc, setDesc] = useState(info?.description ?? '');
  const holder = cabinets.find((c) => c.id === owner);
  const infoDirty = !!info && (label.trim() !== info.label.trim() || desc.trim() !== info.description.trim());
  const dirty = outlineDirty || infoDirty;
  const cancel = () => { setLabel(info?.label ?? ''); setDesc(info?.description ?? ''); onCancel(); };
  return (
    <Shell title={kind === 'area' && (info?.label || '').trim() ? (info?.label ?? name) : name} onClose={() => { cancel(); onClose(); }}>
      <p style={{ margin: '-6px 0 10px', fontSize: 12.5, fontWeight: 600, color: CK.muted }}>
        {kind === 'country' ? (edited ? 'Country, border changed in this crisis' : 'Country') : 'Drawn territory'}
      </p>
      {editable ? (
        <Field label="Held by">
          <OwnerPicker value={owner} cabinets={cabinets} withNobody disabled={busy} ariaLabel="Who holds this territory" onChange={onOwner} />
        </Field>
      ) : (
        <p className="flex items-center" style={{ margin: 0, gap: 6, fontSize: 13.5, color: CK.ink, overflowWrap: 'anywhere' }}>
          <span style={{ color: CK.muted }}>Held by</span>
          {holder ? (<><Dot color={holder.color} /><b>{holder.name}</b></>) : <b>Nobody</b>}
        </p>
      )}
      {kind === 'area' && editable && (
        <>
          <Field label="Name">
            <input style={fieldStyle} value={label} maxLength={ZONE_NAME_MAX} aria-label="Name" onChange={(e) => setLabel(e.target.value)} />
          </Field>
          <Field label="Description">
            <textarea style={{ ...fieldStyle, minHeight: 60, resize: 'vertical' }} value={desc} maxLength={2000} aria-label="Description" onChange={(e) => setDesc(e.target.value)} />
          </Field>
        </>
      )}
      {kind === 'area' && !editable && (info?.description || '').trim() && (
        <p style={{ margin: '8px 0 0', fontSize: 13.5, color: CK.ink, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{info?.description}</p>
      )}
      {editable && (
        <p style={{ margin: '0 0 10px', fontSize: 12.5, color: CK.inkSoft }}>
          {detailed
            ? 'To move the border, press on the outline and drag. It bends out or in from that point; pulling it outward extends this holder\'s land, and saving cuts the new ground out of everyone else\'s. The holder applies at once, the rest when you save.'
            : 'Drag a white corner to move it, or drag a small dot on a side to add a corner there. Double-click a corner to remove it. Pulling outward extends this holder\'s land, and saving cuts the new ground out of everyone else\'s. The holder applies at once, the rest when you save.'}
        </p>
      )}
      {editable && (
        <div className="flex flex-wrap items-center" style={{ gap: 8, marginBottom: confirm ? 0 : 2 }}>
          <Btn size="sm" disabled={busy || !dirty} icon={<Check size={14} strokeWidth={1.5} />} onClick={() => onSave(info ? { label: label.trim(), description: desc.trim() } : null)}>Save</Btn>
          <Btn size="sm" tone="ghost" disabled={busy || !dirty} onClick={cancel}>Cancel</Btn>
          <Btn size="sm" tone="ghost" disabled={busy || !canUndo} icon={<Undo2 size={14} strokeWidth={1.5} />} onClick={onUndo}>Undo</Btn>
        </div>
      )}
      {editable && dirty && (
        <p style={{ margin: '6px 0 0', fontSize: 12, fontWeight: 600, color: CK.red }}>{outlineDirty ? 'The shape on the map is not saved yet.' : 'Your changes are not saved yet.'}</p>
      )}
      {editable && (onReset || onDelete) && !confirm && (
        <div className="flex flex-wrap" style={{ gap: 8, marginTop: 10 }}>
          {onReset && edited && (
            <Btn size="sm" tone="ghost" disabled={busy} icon={<RotateCcw size={14} strokeWidth={1.5} />} onClick={() => setConfirm('reset')}>Back to the real border</Btn>
          )}
          {onDelete && (
            <Btn size="sm" tone="danger" disabled={busy} icon={<Trash2 size={14} strokeWidth={1.5} />} onClick={() => setConfirm('delete')}>Delete</Btn>
          )}
        </div>
      )}
      {confirm === 'reset' && onReset && (
        <Confirm
          text="Put back the real border? Land it covers is taken back from whoever holds it now." yes="Yes, put it back" busy={busy}
          onYes={() => { setConfirm(null); onReset(); }} onNo={() => setConfirm(null)}
        />
      )}
      {confirm === 'delete' && onDelete && (
        <Confirm text="Remove this territory from the map?" yes="Yes, remove it" busy={busy} onYes={onDelete} onNo={() => setConfirm(null)} />
      )}
    </Shell>
  );
}

/** Borders tool: a new territory being drawn on the map, then who holds it. */
export function NewTerritoryPanel({
  phase, owner, ownerHint, canSave, pointCount, minPoints, cabinets, busy, canUndo, onOwner, onUndo, onFinish, onSave, onClose,
}: {
  phase: 'draw' | 'refine'; owner: string | null | undefined; ownerHint?: string; canSave: boolean; pointCount: number; minPoints: number; cabinets: PanelCabinet[]; busy: boolean;
  canUndo: boolean;
  onOwner: (id: string | null) => void; onUndo: () => void; onFinish: () => void; onSave: () => void; onClose: () => void;
}) {
  const ownerPick = (
    <Field label="Held by">
      <OwnerPicker value={owner} cabinets={cabinets} withNobody ariaLabel="Who holds this land" onChange={onOwner} />
    </Field>
  );
  if (phase === 'draw') {
    return (
      <Shell title="New Territory" onClose={onClose}>
        <p style={{ margin: '0 0 10px', fontSize: 13, color: CK.inkSoft }}>
          Click the map to add points, or press and drag to draw the outline freehand. Double-click, or click the first point, to close the shape.
        </p>
        <p style={{ margin: '0 0 10px', fontSize: 13.5 }}>
          <b style={{ fontSize: 20, fontVariantNumeric: 'tabular-nums' }}>{pointCount}</b> <span style={{ color: CK.inkSoft }}>{pointCount === 1 ? 'point' : 'points'}</span>
        </p>
        <div className="flex flex-wrap" style={{ gap: 8 }}>
          <Btn size="sm" disabled={pointCount < minPoints} icon={<Check size={14} strokeWidth={1.5} />} onClick={onFinish}>Close the shape</Btn>
          <Btn size="sm" tone="ghost" disabled={pointCount === 0} icon={<Undo2 size={14} strokeWidth={1.5} />} onClick={onUndo}>Undo point</Btn>
          <Btn size="sm" tone="ghost" onClick={onClose}>Cancel</Btn>
        </div>
      </Shell>
    );
  }
  return (
    <Shell title="New Territory" onClose={onClose}>
      {ownerPick}
      {ownerHint && <p style={{ margin: '0 0 8px', fontSize: 12.5, fontWeight: 600, color: CK.ink }}>{ownerHint}</p>}
      <p style={{ margin: '0 0 10px', fontSize: 12.5, color: CK.inkSoft }}>
        Drag a corner to move it, or drag a small dot on a side to add a corner. Double-click a corner to remove it. Land it covers is taken from whoever holds it now.
      </p>
      <div className="flex flex-wrap items-center" style={{ gap: 8 }}>
        <Btn size="sm" disabled={busy || !canSave} icon={<Check size={14} strokeWidth={1.5} />} onClick={onSave}>Save territory</Btn>
        <Btn size="sm" tone="ghost" onClick={onClose}>Cancel</Btn>
        <Btn size="sm" tone="ghost" disabled={!canUndo} icon={<Undo2 size={14} strokeWidth={1.5} />} onClick={onUndo}>Undo</Btn>
      </div>
    </Shell>
  );
}

// ─────────── Zones ───────────

export interface ZoneForm {
  name: string;
  /** A zone type id, or null for no type. */
  type: string | null;
  /** Used only when there is no type. */
  color: string;
  description: string;
  vis: 'public' | 'cabinets' | 'staff';
  revealed: string[];
}

/** A zone's visibility as the database columns hold it. */
export function zoneVisibility(f: Pick<ZoneForm, 'vis' | 'revealed'>): { public: boolean; revealed_to: string[] } {
  return f.vis === 'public' ? { public: true, revealed_to: [] } : { public: false, revealed_to: f.vis === 'cabinets' ? f.revealed : [] };
}

export function zoneFormOf(z: MapShape, types: ZoneType[]): ZoneForm {
  const typed = z.zone_type && types.some((t) => t.id === z.zone_type) ? z.zone_type : null;
  return {
    name: z.label ?? '', type: typed, color: z.color ?? ZONE_NO_TYPE_COLOR, description: z.description ?? '',
    vis: z.public ? 'public' : z.revealed_to.length ? 'cabinets' : 'staff', revealed: z.revealed_to,
  };
}

/** The colour a zone is drawn in: its type's, else its own. */
export function zoneColorOf(z: Pick<MapShape, 'zone_type' | 'color'>, types: ZoneType[]): string {
  return types.find((t) => t.id === z.zone_type)?.color ?? z.color ?? ZONE_NO_TYPE_COLOR;
}

function Swatch({ color, size = 12 }: { color: string; size?: number }) {
  return <i aria-hidden style={{ display: 'inline-block', width: size, height: size, borderRadius: 4, flex: 'none', background: `${color}33`, border: `2px dashed ${color}`, boxSizing: 'border-box' }} />;
}

/** The 20 colours a zone without a type can take. */
function Palette({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div role="radiogroup" aria-label="Zone colour" className="flex flex-wrap" style={{ gap: 6 }}>
      {ZONE_COLORS.map((c) => (
        <button
          key={c} type="button" role="radio" aria-checked={c.toLowerCase() === value.toLowerCase()} aria-label={c} title={c} onClick={() => onChange(c)}
          className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
          style={{
            width: 22, height: 22, borderRadius: 7, border: 0, cursor: 'pointer', background: c, flex: 'none',
            boxShadow: c.toLowerCase() === value.toLowerCase() ? `0 0 0 2px #fff, 0 0 0 4px ${CK.ink}` : 'none',
          }}
        />
      ))}
    </div>
  );
}

/**
 * A zone being drawn, or an existing zone being edited: the outline is changed on the map, the name, type, description and
 * who sees it are set here, Save keeps all of it and Cancel puts everything back.
 */
export function ZoneEditor({
  isNew, phase, initial, types, cabinets, pointCount, minPoints, canUndo, outlineDirty, busy,
  onColor, onUndo, onFinish, onSave, onCancel, onDelete,
}: {
  isNew: boolean; phase: 'draw' | 'refine'; initial: ZoneForm; types: ZoneType[]; cabinets: PanelCabinet[]; pointCount: number; minPoints: number;
  canUndo: boolean; outlineDirty: boolean; busy: boolean;
  /** The colour the zone is drawn in now (so the map's preview follows the type or the swatch). */
  onColor: (c: string) => void;
  onUndo: () => void; onFinish: () => void; onSave: (f: ZoneForm) => void; onCancel: () => void; onDelete?: () => void;
}) {
  const [f, setF] = useState<ZoneForm>(initial);
  const [confirm, setConfirm] = useState(false);
  const type = types.find((t) => t.id === f.type) ?? null;
  const color = type?.color ?? f.color;
  useEffect(() => { onColor(color); }, [color, onColor]);
  const dirty = outlineDirty || JSON.stringify(f) !== JSON.stringify(initial);
  const valid = f.name.trim().length > 0 && pointCount >= minPoints && (f.vis !== 'cabinets' || f.revealed.length > 0);
  const title = isNew ? 'New Zone' : 'Zone';

  if (phase === 'draw') {
    return (
      <Shell title={title} onClose={onCancel}>
        <p style={{ margin: '0 0 10px', fontSize: 13, color: CK.inkSoft }}>
          Click the map to add points, or press and drag to draw the outline freehand. Double-click, or click the first point, to close the shape.
        </p>
        <p style={{ margin: '0 0 10px', fontSize: 13.5 }}>
          <b style={{ fontSize: 20, fontVariantNumeric: 'tabular-nums' }}>{pointCount}</b> <span style={{ color: CK.inkSoft }}>{pointCount === 1 ? 'point' : 'points'}</span>
        </p>
        <div className="flex flex-wrap" style={{ gap: 8 }}>
          <Btn size="sm" disabled={pointCount < minPoints} icon={<Check size={14} strokeWidth={1.5} />} onClick={onFinish}>Close the shape</Btn>
          <Btn size="sm" tone="ghost" disabled={pointCount === 0} icon={<Undo2 size={14} strokeWidth={1.5} />} onClick={onUndo}>Undo point</Btn>
          <Btn size="sm" tone="ghost" onClick={onCancel}>Cancel</Btn>
        </div>
      </Shell>
    );
  }

  return (
    <Shell title={title} onClose={onCancel}>
      <Field label="Name">
        <input
          style={fieldStyle} value={f.name} maxLength={ZONE_NAME_MAX} aria-label="Zone name" autoFocus={isNew}
          onChange={(e) => setF({ ...f, name: e.target.value })}
        />
      </Field>
      <Field label="Type">
        <GSelect
          size="sm" value={f.type ?? ''} aria-label="Zone type"
          options={[{ value: '', label: 'No type' }, ...types.map((t) => ({ value: t.id, label: t.name }))]}
          onChange={(v) => setF({ ...f, type: v || null })}
        />
        {type ? (
          <p className="flex items-start" style={{ margin: '6px 0 0', gap: 7, fontSize: 12.5, color: CK.inkSoft, overflowWrap: 'anywhere' }}>
            <span style={{ marginTop: 2 }}><Swatch color={type.color} /></span>
            <span>{type.description || type.name}</span>
          </p>
        ) : (
          <div style={{ marginTop: 8 }}>
            <Palette value={f.color} onChange={(c) => setF({ ...f, color: c })} />
            {types.length === 0 && (
              <p style={{ margin: '6px 0 0', fontSize: 12, color: CK.inkSoft }}>The Crisis Director can add zone types in Settings, under Map.</p>
            )}
          </div>
        )}
      </Field>
      <Field label="Description">
        <textarea style={{ ...fieldStyle, minHeight: 60, resize: 'vertical' }} value={f.description} maxLength={2000} aria-label="Zone description" onChange={(e) => setF({ ...f, description: e.target.value })} />
      </Field>
      <Field label="Seen by">
        <div role="radiogroup" aria-label="Who sees this zone" className="flex flex-wrap" style={{ background: CK.well, borderRadius: 11, padding: 3, gap: 2 }}>
          {([['public', 'Everyone'], ['cabinets', 'Chosen cabinets'], ['staff', 'Staff only']] as const).map(([v, l]) => (
            <button
              key={v} type="button" role="radio" aria-checked={f.vis === v} onClick={() => setF({ ...f, vis: v })}
              className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
              style={{
                border: 0, padding: '5px 10px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: CK.font,
                background: f.vis === v ? CK.card : 'transparent', color: f.vis === v ? CK.forest : CK.inkSoft, boxShadow: f.vis === v ? CK.shadowSm : 'none',
              }}
            >
              {l}
            </button>
          ))}
        </div>
        {f.vis === 'cabinets' && (
          <div style={{ marginTop: 6 }}>
            {cabinets.map((c) => (
              <CheckRow key={c.id} label={c.name} color={c.color} checked={f.revealed.includes(c.id)} onChange={(on) => setF({ ...f, revealed: toggled(f.revealed, c.id, on) })} />
            ))}
            {f.revealed.length === 0 && <p style={{ margin: '4px 0 0', fontSize: 12, color: CK.red, fontWeight: 600 }}>Choose at least one cabinet.</p>}
          </div>
        )}
      </Field>
      <p style={{ margin: '0 0 10px', fontSize: 12.5, color: CK.inkSoft }}>
        Drag a white corner to move it, or drag a small dot on a side to add a corner. Double-click a corner to remove it. A zone never changes who holds the land.
      </p>
      <div className="flex flex-wrap items-center" style={{ gap: 8 }}>
        <Btn size="sm" disabled={busy || !valid || (!isNew && !dirty)} icon={<Check size={14} strokeWidth={1.5} />} onClick={() => onSave(f)}>Save zone</Btn>
        <Btn size="sm" tone="ghost" onClick={onCancel}>Cancel</Btn>
        <Btn size="sm" tone="ghost" disabled={!canUndo} icon={<Undo2 size={14} strokeWidth={1.5} />} onClick={onUndo}>Undo</Btn>
        {!isNew && onDelete && !confirm && (
          <Btn size="sm" tone="danger" disabled={busy} icon={<Trash2 size={14} strokeWidth={1.5} />} onClick={() => setConfirm(true)}>Delete</Btn>
        )}
      </div>
      {!isNew && dirty && <p style={{ margin: '6px 0 0', fontSize: 12, fontWeight: 600, color: CK.red }}>Your changes are not saved yet.</p>}
      {confirm && onDelete && <Confirm text="Remove this zone from the map?" yes="Yes, remove it" busy={busy} onYes={onDelete} onNo={() => setConfirm(false)} />}
    </Shell>
  );
}

/** A zone's card for everyone who can see it: its name, type, description. Staff can open it for editing. */
export function ZoneInfoCard({ zone, type, cabinets, staff, canEdit, onEdit, onClose }: {
  zone: MapShape; type: ZoneType | null; cabinets: PanelCabinet[]; staff: boolean; canEdit: boolean; onEdit: () => void; onClose: () => void;
}) {
  const color = type?.color ?? zone.color ?? ZONE_NO_TYPE_COLOR;
  const seen = zone.public ? 'Everyone' : zone.revealed_to.length
    ? zone.revealed_to.map((id) => cabinets.find((c) => c.id === id)?.name ?? 'A cabinet').join(', ') : 'Staff only';
  return (
    <Shell title={zone.label?.trim() || 'Zone'} onClose={onClose}>
      <p className="flex items-start" style={{ margin: '-4px 0 10px', gap: 8, fontSize: 13, color: CK.ink, overflowWrap: 'anywhere' }}>
        <span style={{ marginTop: 3 }}><Swatch color={color} /></span>
        <span><b>{type ? type.name : 'Zone'}</b>{type?.description ? <span style={{ display: 'block', fontSize: 12.5, color: CK.inkSoft }}>{type.description}</span> : null}</span>
      </p>
      {zone.description?.trim() ? (
        <p style={{ margin: '0 0 10px', fontSize: 13.5, color: CK.ink, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{zone.description}</p>
      ) : null}
      {staff && (
        <p style={{ margin: '0 0 10px', fontSize: 12.5, color: CK.inkSoft, overflowWrap: 'anywhere' }}><span style={{ color: CK.muted }}>Seen by</span> {seen}</p>
      )}
      {canEdit && <Btn size="sm" tone="ghost" icon={<Pencil size={14} strokeWidth={1.5} />} onClick={onEdit}>Edit zone</Btn>}
    </Shell>
  );
}

/** The Zones tool with nothing selected: every zone you can see, and a way to draw a new one. */
export function ZonesPanel({ zones, types, cabinets, onDraw, onPick, onClose }: {
  zones: MapShape[]; types: ZoneType[]; cabinets: PanelCabinet[]; onDraw: () => void; onPick: (id: string) => void; onClose: () => void;
}) {
  void cabinets;
  return (
    <Shell title="Zones" onClose={onClose}>
      <p style={{ margin: '0 0 10px', fontSize: 13, color: CK.inkSoft }}>
        Zones sit on top of the map and are not territory: they never cut or merge anyone&apos;s land and may overlap. Click a zone to edit it.
      </p>
      <div style={{ margin: '0 0 10px' }}>
        <Btn size="sm" icon={<Plus size={14} strokeWidth={1.5} />} onClick={onDraw}>Draw a new zone</Btn>
      </div>
      {zones.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: CK.muted }}>No zones yet.</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 2 }}>
          {zones.map((z) => {
            const t = types.find((x) => x.id === z.zone_type);
            return (
              <li key={z.id}>
                <button
                  type="button" onClick={() => onPick(z.id)}
                  className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] flex items-start w-full text-left"
                  style={{ gap: 8, border: 0, background: 'transparent', padding: '6px 6px', borderRadius: 9, cursor: 'pointer', fontFamily: CK.font }}
                >
                  <span style={{ marginTop: 3 }}><Swatch color={zoneColorOf(z, types)} /></span>
                  <span style={{ minWidth: 0 }}>
                    <b style={{ display: 'block', fontSize: 13.5, color: CK.ink, overflowWrap: 'anywhere' }}>{z.label?.trim() || 'Zone'}</b>
                    <span style={{ display: 'block', fontSize: 12, color: CK.inkSoft, overflowWrap: 'anywhere' }}>
                      {t ? t.name : 'No type'}{z.public ? '' : z.revealed_to.length ? ' · Some cabinets' : ' · Staff only'}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Shell>
  );
}

/** A character standing on the map (staff only): who they are. */
export function CharacterCard({ character, cabinet, onClose }: { character: Character; cabinet: PanelCabinet | null; onClose: () => void }) {
  const status = character.status !== 'active' ? character.status.charAt(0).toUpperCase() + character.status.slice(1) : null;
  return (
    <Shell title={character.name} onClose={onClose}>
      <div className="flex items-start" style={{ gap: 12 }}>
        <span
          aria-hidden
          style={{
            width: 52, height: 52, borderRadius: '50%', flex: 'none', overflow: 'hidden', boxSizing: 'border-box',
            border: `3px solid ${cabinet?.color ?? CK.inkSoft}`, background: cabinet?.color ?? CK.inkSoft, display: 'grid', placeItems: 'center',
          }}
        >
          {character.picture_url
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={character.picture_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ color: '#fff', fontWeight: 800, fontSize: 18 }}>{character.name.trim().charAt(0).toUpperCase()}</span>}
        </span>
        <div className="min-w-0" style={{ fontSize: 13.5 }}>
          {character.title && <p style={{ margin: '0 0 4px', color: CK.inkSoft, overflowWrap: 'anywhere' }}>{character.title}</p>}
          <p className="flex items-center" style={{ margin: 0, gap: 6, overflowWrap: 'anywhere' }}>
            {cabinet ? (<><Dot color={cabinet.color} />{cabinet.name}</>) : <span style={{ color: CK.muted }}>No cabinet</span>}
          </p>
          {character.location && <p style={{ margin: '4px 0 0', color: CK.muted, overflowWrap: 'anywhere' }}>{character.location}</p>}
          {status && <p style={{ margin: '4px 0 0', fontWeight: 700, color: CK.red }}>{status}</p>}
        </div>
      </div>
    </Shell>
  );
}
