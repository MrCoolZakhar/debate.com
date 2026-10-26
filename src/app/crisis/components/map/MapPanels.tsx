'use client';
// Gavelling Crisis map: the small panels that sit on the map card (top right on a wide screen,
// under the map on a phone): unit picker, editor and viewer, the territory card (a country or a drawn
// area: who holds it, and how to reshape it), drawing new territory, and a character's card.
// Each panel keeps its own form state; the caller gives it a `key` so a new subject starts clean.

import { useState, type ReactNode } from 'react';
import { Check, RotateCcw, Trash2, X, Undo2 } from 'lucide-react';
import GSelect from '@/components/GSelect';
import { amount as fmtAmount } from '@/lib/crisis/format';
import { Btn, CK, FieldLabel, fieldStyle } from '../../crisisKit';
import type { Character, MapUnit, UnitKind } from '@/lib/crisis/types';
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

/**
 * A selected country or drawn area: who holds it and, for staff with map power, how to reshape it.
 * `detailed` outlines (many corners) are reshaped by pressing on the outline; simple ones also show corners.
 */
export function TerritoryCard({
  name, kind, owner, cabinets, editable, detailed, edited, busy, onOwner, onReset, onDelete, onClose,
}: {
  name: string; kind: 'country' | 'area'; owner: string | null; cabinets: PanelCabinet[]; editable: boolean; detailed: boolean;
  edited: boolean; busy: boolean; onOwner: (id: string | null) => void; onReset?: () => void; onDelete?: () => void; onClose: () => void;
}) {
  const [confirm, setConfirm] = useState<'reset' | 'delete' | null>(null);
  const holder = cabinets.find((c) => c.id === owner);
  return (
    <Shell title={name} onClose={onClose}>
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
      {editable && (
        <p style={{ margin: '0 0 10px', fontSize: 12.5, color: CK.inkSoft }}>
          {detailed
            ? 'To move the border, press on the outline and drag. It bends out or in from that point. Do it again elsewhere to change it another way.'
            : 'Drag a white corner to move it, or press anywhere on the outline and drag to add a corner there. Double-click a corner to remove it.'}
        </p>
      )}
      {editable && (onReset || onDelete) && !confirm && (
        <div className="flex flex-wrap" style={{ gap: 8 }}>
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
  phase, owner, pointCount, minPoints, cabinets, busy, onOwner, onUndo, onFinish, onSave, onClose,
}: {
  phase: 'draw' | 'refine'; owner: string | null; pointCount: number; minPoints: number; cabinets: PanelCabinet[]; busy: boolean;
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
          Click the map to add points. Double-click, or click the first point, to close the shape.
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
      <p style={{ margin: '0 0 10px', fontSize: 12.5, color: CK.inkSoft }}>
        You can still drag the corners. Land it covers is taken from whoever holds it now.
      </p>
      <div className="flex flex-wrap items-center" style={{ gap: 8 }}>
        <Btn size="sm" disabled={busy} icon={<Check size={14} strokeWidth={1.5} />} onClick={onSave}>Save territory</Btn>
        <Btn size="sm" tone="ghost" onClick={onClose}>Cancel</Btn>
      </div>
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
