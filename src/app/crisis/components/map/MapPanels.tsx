'use client';
// Gavelling Crisis war map: the small panels that sit on the map card (top right on a wide screen,
// under the map on a phone): unit picker, editor and viewer, the territory editor and the border panel.
// Each panel keeps its own form state; the caller gives it a `key` so a new subject starts clean.

import { useState, type ReactNode } from 'react';
import { Check, Trash2, X, Undo2 } from 'lucide-react';
import GSelect from '@/components/GSelect';
import { amount as fmtAmount } from '@/lib/crisis/format';
import { Btn, CK, FieldLabel, fieldStyle } from '../../crisisKit';
import type { MapUnit, UnitKind } from '@/lib/crisis/types';
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
  value: string | null; cabinets: PanelCabinet[]; withNobody?: boolean; disabled?: boolean; ariaLabel: string; onChange: (id: string | null) => void;
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
  const others = cabinets.filter((c) => c.id !== d.owner);
  const valid = d.name.trim().length > 0;
  const amount = (
    <Field label="Amount">
      <input
        type="number" min={0} max={1000000} inputMode="numeric" style={{ ...fieldStyle, padding: '6px 10px' }} value={Number.isFinite(d.strength) ? d.strength : 0}
        onChange={(e) => setD({ ...d, strength: Math.max(0, Math.min(1000000, Math.round(Number(e.target.value) || 0))) })}
      />
    </Field>
  );
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
          onKeyDown={(e) => { if (e.key === 'Enter' && isNew && valid && !busy) onSubmit(d); }}
        />
      </Field>
      {isNew ? (
        <div className="grid" style={{ gridTemplateColumns: '88px 1fr', gap: 8 }}>
          {amount}
          {ownerField}
        </div>
      ) : (
        <>
          <div className="grid" style={{ gridTemplateColumns: '1fr 96px', gap: 8 }}>
            <Field label="Kind">
              <GSelect size="sm" value={d.kind} onChange={(v) => setD({ ...d, kind: v as UnitKind })} options={KIND_ORDER.map((k) => ({ value: k, label: KIND_META[k].label }))} aria-label="Kind" />
            </Field>
            {amount}
          </div>
          {ownerField}
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
        <Btn size="sm" disabled={busy || !valid} icon={<Check size={14} strokeWidth={1.5} />} onClick={() => onSubmit(d)}>{isNew ? 'Add unit' : 'Save'}</Btn>
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
export function UnitViewer({ unit, suspected, cabinets, onClose }: { unit: MapUnit; suspected: boolean; cabinets: PanelCabinet[]; onClose: () => void }) {
  const owner = cabinets.find((c) => c.id === unit.owner_cabinet_id);
  return (
    <Shell title={suspected ? 'Suspected Site' : unit.name} onClose={onClose}>
      {suspected ? (
        <p style={{ margin: 0, fontSize: 13.5, color: CK.inkSoft }}>Your people think something is here. You do not know what it is yet.</p>
      ) : (
        <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 12px', fontSize: 13.5 }}>
          <dt style={{ color: CK.muted }}>Kind</dt><dd style={{ margin: 0 }}>{KIND_META[unit.kind].label}</dd>
          <dt style={{ color: CK.muted }}>Amount</dt><dd style={{ margin: 0, fontVariantNumeric: 'tabular-nums' }}>{fmtAmount(unit.strength)}</dd>
          <dt style={{ color: CK.muted }}>Held by</dt>
          <dd className="flex items-center" style={{ margin: 0, gap: 6, overflowWrap: 'anywhere' }}>
            {owner ? (<><Dot color={owner.color} />{owner.name}</>) : 'Nobody'}
          </dd>
        </dl>
      )}
    </Shell>
  );
}

/** Extend territory: draw new land for a cabinet, and reshape saved territory by its corners. */
export function TerritoryPanel({
  phase, isNew, owner, pointCount, minPoints, cabinets, busy, onOwner, onUndo, onFinish, onSave, onDelete, onClose,
}: {
  phase: 'draw' | 'refine'; isNew: boolean; owner: string | null; pointCount: number; minPoints: number; cabinets: PanelCabinet[]; busy: boolean;
  onOwner: (id: string | null) => void; onUndo: () => void; onFinish: () => void; onSave: () => void; onDelete?: () => void; onClose: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const title = isNew ? 'Extend Territory' : 'Territory';
  const ownerPick = (
    <Field label="Land goes to">
      <OwnerPicker value={owner} cabinets={cabinets} ariaLabel="Who holds this land" onChange={onOwner} />
    </Field>
  );

  if (phase === 'draw') {
    return (
      <Shell title={title} onClose={onClose}>
        {ownerPick}
        <p style={{ margin: '0 0 10px', fontSize: 13, color: CK.inkSoft }}>
          Click the map to outline the land. Double-click or press Finish to close the shape. You can drag the corners afterwards.
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
      <p style={{ margin: '0 0 10px', fontSize: 13, color: CK.inkSoft }}>
        Drag the corners to reshape the land. Click a small dot to add a corner. Double-click a corner to remove it.
      </p>
      {ownerPick}
      <div className="flex flex-wrap items-center" style={{ gap: 8 }}>
        <Btn size="sm" disabled={busy || !owner} icon={<Check size={14} strokeWidth={1.5} />} onClick={onSave}>{isNew ? 'Save territory' : 'Save'}</Btn>
        <Btn size="sm" tone="ghost" onClick={onClose}>Cancel</Btn>
        {!isNew && onDelete && !confirm && (
          <Btn size="sm" tone="danger" disabled={busy} icon={<Trash2 size={14} strokeWidth={1.5} />} onClick={() => setConfirm(true)}>Delete</Btn>
        )}
      </div>
      {confirm && onDelete && (
        <div style={{ marginTop: 10, padding: 10, borderRadius: 12, background: CK.well }}>
          <p style={{ margin: '0 0 8px', fontSize: 13, color: CK.ink }}>Remove this territory from the map?</p>
          <div className="flex" style={{ gap: 8 }}>
            <Btn size="sm" tone="red" disabled={busy} onClick={onDelete}>Yes, remove it</Btn>
            <Btn size="sm" tone="ghost" onClick={() => setConfirm(false)}>Keep it</Btn>
          </div>
        </div>
      )}
    </Shell>
  );
}

/** Borders tool: choose who receives countries once, then every click on a country hands it over. */
export function BorderPanel({ brush, cabinets, onBrush, onClose }: {
  brush: string | null; cabinets: PanelCabinet[]; onBrush: (id: string | null) => void; onClose: () => void;
}) {
  return (
    <Shell title="Borders" onClose={onClose}>
      <Field label="Hand countries to">
        <OwnerPicker value={brush} cabinets={cabinets} withNobody ariaLabel="Who receives the countries you click" onChange={onBrush} />
      </Field>
      <p style={{ margin: '0 0 6px', fontSize: 13, color: CK.inkSoft }}>Each click on a country hands it over at once.</p>
      <p style={{ margin: 0, fontSize: 12, color: CK.muted }}>Click inside extended territory to reshape its corners.</p>
    </Shell>
  );
}
