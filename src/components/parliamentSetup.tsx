'use client';

// ============================================================
// src/components/parliamentSetup.tsx
//
// The look of the committee editor's TYPE choice and of a custom
// (parliamentary) committee's GROUPS, kept out of the two big files so they only
// mount it (owner, 12 Oct 2026: "the design in setting up committees is very
// ugly. add icons in the presets and make it slightly better looking").
//
// Presentation only. Every mutation is a callback the caller already owned:
// ConferenceRosterSelected's `mutateGroups` / `applyPreset` / `commitNewGroup`
// and the editor's `setPendingType`. Nothing here reads or writes the database,
// and the slotGroups.ts contract (effectiveSlotArt, loadSlotArtIndex) is
// untouched.
//
// Icons are Fluent 3D emoji (Emoji3D) or round flags (CircleFlag), never
// outline or duotone glyphs. Cards are the organiser kit's white card with the
// soft forest shadow (gv-st-card), drawn small.
// ============================================================

import { useState } from 'react';
import { Plus, Check } from 'lucide-react';
import { Emoji3D, OUTFIT } from '@/components/neu';
import { CircleFlag } from '@/components/CircleFlag';
import { GROUP_COLORS, PARLIAMENT_PRESETS, groupInk, type SlotGroup } from '@/lib/slotGroups';
import type { CommitteeType } from '@/components/committeeSetupKit';

const INK = '#1C1410';
const INK_SOFT = '#5A5046';
const FOREST = '#1B3828';

// ── Committee types ──────────────────────────────────────────────────────────
//
// Four cards (owner, 12 Oct 2026): MUN, Crisis, Custom, Press. "General
// Assembly" is now called MUN (the stored committee_type is still
// 'general-assembly'), and "Specialised" is no longer offered: it was merged
// into Custom. Rows already stored as 'specialised' are NOT rewritten. They
// keep their stored type and behaviour (a country roster), and every surface
// here reads them as Custom (`chooserTypeOf`).

export const COMMITTEE_TYPE_EMOJI: Record<CommitteeType, string> = {
  'general-assembly': 'Globe showing europe-africa',
  specialised: 'Classical building',
  crisis: 'High voltage',
  custom: 'Classical building',
  press: 'Newspaper',
};

/** The tinted disc behind each type's emoji. */
const TYPE_TINT: Record<CommitteeType, string> = {
  'general-assembly': 'rgba(27,56,40,0.09)',
  specialised: 'rgba(238,217,138,0.45)',
  crisis: 'rgba(139,32,32,0.1)',
  custom: 'rgba(238,217,138,0.45)',
  press: 'rgba(47,96,118,0.13)',
};

/** What the type choice and the editor's header call each type. */
export const COMMITTEE_TYPE_TITLE: Record<CommitteeType, string> = {
  'general-assembly': 'MUN',
  specialised: 'Custom',
  crisis: 'Crisis',
  custom: 'Custom',
  press: 'Press',
};

const TYPE_DESC: Record<CommitteeType, string> = {
  'general-assembly': 'Country delegations: General Assembly, Security Council, ECOSOC and every UN body.',
  specialised: 'Parliaments, courts and any format of your own, with parties or seats you name.',
  crisis: 'Character roles and live, fast-moving crises.',
  custom: 'Parliaments, courts and any format of your own, with parties or seats you name.',
  press: 'Outlets and journalists who report on every committee, with a Press Desk.',
};

/** The cards the type choice offers, in order. 'specialised' is never offered. */
export const CHOOSER_TYPES: CommitteeType[] = ['general-assembly', 'crisis', 'custom', 'press'];

/** The card a stored type reads as: 'specialised' reads as Custom. */
export function chooserTypeOf(t: string | null | undefined): CommitteeType | null {
  if (!t) return null;
  if (t === 'specialised') return 'custom';
  return (CHOOSER_TYPES as string[]).includes(t) ? (t as CommitteeType) : null;
}

export function CommitteeTypeEmoji({ type, size = 18 }: { type: CommitteeType; size?: number }) {
  return <Emoji3D name={COMMITTEE_TYPE_EMOJI[type] ?? COMMITTEE_TYPE_EMOJI['general-assembly']} size={size} />;
}

/** The create flow's first screen: white cards, a big 3D emoji rising over
 *  each card's top edge, the name and one short line. Two columns from 560px.
 *  A press marks the card selected (forest edge, green wash, a check) for a
 *  beat before moving on, so the choice is seen. `selected` pre-marks one
 *  ('specialised' marks Custom). */
export function CommitteeTypeChooser({ types, onSelect, selected = null }: {
  types: CommitteeType[];
  onSelect: (t: CommitteeType) => void;
  selected?: string | null;
}) {
  const [picked, setPicked] = useState<CommitteeType | null>(null);
  const shown = picked ?? chooserTypeOf(selected);
  const choose = (t: CommitteeType) => {
    if (picked) return;
    setPicked(t);
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) onSelect(t);
    else window.setTimeout(() => onSelect(t), 180);
  };
  return (
    <div className="gv-pk-types" role="radiogroup" aria-label="Committee type">
      <style>{PARLIAMENT_CSS}</style>
      {types.filter((t) => t !== 'specialised').map((t) => {
        const on = shown === t;
        return (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={on}
            className="gv-pk-type"
            data-selected={on ? '' : undefined}
            onClick={() => choose(t)}
          >
            <span className="gv-pk-type-disc" style={{ backgroundColor: TYPE_TINT[t] }} aria-hidden>
              <CommitteeTypeEmoji type={t} size={46} />
            </span>
            {on && (
              <span className="gv-pk-type-check" aria-hidden><Check size={14} strokeWidth={3.2} /></span>
            )}
            <span className="gv-pk-type-name">{COMMITTEE_TYPE_TITLE[t]}</span>
            <span className="gv-pk-type-desc">{TYPE_DESC[t]}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── Group colours ────────────────────────────────────────────────────────────

/** Accessible names for GROUP_COLORS, index for index. */
export const GROUP_COLOR_NAMES = ['Forest', 'Crimson', 'Gold', 'Blue', 'Purple', 'Green', 'Copper', 'Slate'];

/** The eight house colours, then a "Custom" well that opens the system colour
 *  picker (party colours from a preset are rarely one of the eight). */
export function GroupColorSwatches({ value, onPick }: { value: string | null; onPick: (color: string) => void }) {
  const cur = (value ?? FOREST).toLowerCase();
  const isHouse = GROUP_COLORS.some((c) => c.toLowerCase() === cur);
  return (
    <div role="radiogroup" aria-label="Group colour" className="gv-pk-swatches">
      {GROUP_COLORS.map((c, i) => {
        const on = cur === c.toLowerCase();
        return (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={GROUP_COLOR_NAMES[i] ?? c}
            title={GROUP_COLOR_NAMES[i] ?? c}
            className="gv-pk-sw"
            style={{ backgroundColor: c }}
            onClick={() => onPick(c)}
          >
            {on && <Check size={12} strokeWidth={3} color={groupInk(c)} aria-hidden />}
          </button>
        );
      })}
      <label
        className="gv-pk-sw gv-pk-sw-custom"
        title="Any colour"
        data-on={!isHouse ? '' : undefined}
        style={!isHouse ? { background: value ?? FOREST } : undefined}
      >
        <input
          type="color"
          aria-label="Any colour"
          value={/^#[0-9a-f]{6}$/i.test(value ?? '') ? (value as string) : '#1b3828'}
          onChange={(e) => onPick(e.target.value)}
        />
        {!isHouse ? <Check size={12} strokeWidth={3} color={groupInk(value)} aria-hidden /> : <Plus size={12} strokeWidth={3} aria-hidden />}
      </label>
    </div>
  );
}

/** A group's round picture: its crest, else its colour with its short name
 *  (when short enough to sit in the disc) or its initials. */
export function GroupDisc({ group, size = 32 }: { group: SlotGroup; size?: number }) {
  const color = group.color ?? FOREST;
  const short = (group.short_name ?? '').trim();
  const text = short && short.length <= 4 ? short : undefined;
  return (
    <CircleFlag
      logoUrl={group.logo_url}
      label={group.name}
      size={size}
      logoFit="contain"
      ring={group.logo_url ? true : false}
      monogramColors={{ bg: color, fg: groupInk(color) }}
      fallback={text ? <span style={{ fontSize: Math.max(8, Math.round(size * (text.length <= 2 ? 0.36 : text.length === 3 ? 0.3 : 0.25))), fontWeight: 800, letterSpacing: '-0.01em', color: groupInk(color) }}>{text}</span> : undefined}
      decorative
    />
  );
}

// ── Presets ──────────────────────────────────────────────────────────────────

export function PresetIcon({ flag, emoji, label }: { flag?: string; emoji?: string; label: string }) {
  if (flag) return <CircleFlag code={flag} label={label} size={32} decorative />;
  return <Emoji3D name={emoji ?? 'Classical building'} size={32} />;
}

/** One card per parliament: its flag (or an emoji), its name, how many groups.
 *  A preset whose groups are all on the bar already reads "Added". */
export function ParliamentPresetCards({ groups, onPick }: { groups: SlotGroup[]; onPick: (key: string) => void }) {
  const have = new Set(groups.map((g) => g.name.toLowerCase()));
  return (
    <div className="gv-pk-presets">
      {PARLIAMENT_PRESETS.map((p) => {
        const added = p.groups.every((g) => have.has(g.name.toLowerCase()));
        return (
          <button
            key={p.key}
            type="button"
            className="gv-pk-preset"
            data-added={added ? '' : undefined}
            disabled={added}
            title={`${p.hint}: ${p.groups.map((g) => g.short).join(', ')}`}
            onClick={() => onPick(p.key)}
          >
            <span className="gv-pk-ico"><PresetIcon flag={p.flag} emoji={p.emoji} label={p.label} /></span>
            <span className="flex min-w-0 flex-col">
              <span className="gv-pk-preset-name">{p.label}</span>
              <span className="gv-pk-preset-sub">
                {added ? <><Check size={11} strokeWidth={3} style={{ display: 'inline', verticalAlign: '-1px' }} aria-hidden /> Added</> : `${p.groups.length} groups`}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ── The groups list ──────────────────────────────────────────────────────────

/** A custom committee's groups: the ONE place groups are listed (the seat
 *  list below shows only the unassigned seats). Each group is a white card
 *  (its disc, its short name big with the full name small beneath, its seat
 *  count) that opens the group pop-up, and is a drop target for a dragged
 *  seat (`data-group-drop`). Then "Add group", then the parliaments to start
 *  from (always open while there are no groups, behind "Add a parliament"
 *  afterwards). */
export function SeatGroupsBar({
  groups, counts, seatTotal, openId, dragging, dropTargetId, onOpenGroup, onAddGroup, onApplyPreset,
}: {
  groups: SlotGroup[];
  counts: Map<string, number>;
  seatTotal: number;
  /** The group whose pop-up is open. */
  openId: string | null;
  /** A seat is being dragged: every card shows it can take it. */
  dragging: boolean;
  dropTargetId: string | null;
  onOpenGroup: (id: string) => void;
  onAddGroup: (name: string) => void;
  onApplyPreset: (key: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [presetsOpen, setPresetsOpen] = useState(false);
  const placed = groups.reduce((n, g) => n + (counts.get(g.id) ?? 0), 0);
  const empty = groups.length === 0;

  const commit = () => {
    const name = draft.trim();
    setAdding(false);
    setDraft('');
    if (name) onAddGroup(name);
  };

  const addControl = adding ? (
    <input
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { e.preventDefault(); commit(); }
        else if (e.key === 'Escape') { e.stopPropagation(); setAdding(false); setDraft(''); }
      }}
      onBlur={commit}
      placeholder="Group or party name"
      aria-label="New group name"
      className="gv-pk-input"
    />
  ) : (
    <button type="button" className="gv-pk-add" onClick={() => setAdding(true)}>
      <Plus size={14} strokeWidth={2.5} aria-hidden />
      {empty ? 'Add your own group' : 'Add group'}
    </button>
  );

  return (
    <div className="gv-pk-bar">
      <style>{PARLIAMENT_CSS}</style>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <p className="gv-pk-title">{empty ? 'Start From a Parliament' : 'Groups'}</p>
        {!empty && (
          <button type="button" className="gv-pk-link" aria-expanded={presetsOpen} onClick={() => setPresetsOpen((o) => !o)}>
            {presetsOpen ? 'Hide parliaments' : 'Add a parliament'}
          </button>
        )}
      </div>
      <p className="gv-pk-line">
        {empty
          ? 'Pick one to add its parties, or add your own groups.'
          : dragging
            ? 'Drop the seat on a group.'
            : `${placed} of ${seatTotal} in a group. Drag seats onto a group, or open one.`}
      </p>

      {!empty && (
        <div className="gv-pk-groups" data-dragging={dragging ? '' : undefined}>
          {groups.map((g) => {
            const n = counts.get(g.id) ?? 0;
            const color = g.color ?? FOREST;
            const short = (g.short_name ?? '').trim();
            const showFull = !!short && short.toLowerCase() !== g.name.toLowerCase();
            return (
              <button
                key={g.id}
                type="button"
                className="gv-pk-group"
                data-group-drop={g.id}
                data-drop={dropTargetId === g.id ? '' : undefined}
                style={{ ['--gc' as string]: color }}
                aria-expanded={openId === g.id}
                aria-haspopup="dialog"
                title={`${showFull ? `${short} · ${g.name}` : g.name}: ${n} ${n === 1 ? 'seat' : 'seats'}`}
                aria-label={`${g.name}, ${n} ${n === 1 ? 'seat' : 'seats'}`}
                onClick={() => onOpenGroup(g.id)}
              >
                <GroupDisc group={g} size={24} />
                <span className="gv-pk-group-name">{short || g.name}</span>
                <b className="gv-pk-group-n">{n}</b>
              </button>
            );
          })}
          <div className="gv-pk-group-addcell">{addControl}</div>
        </div>
      )}

      {(empty || presetsOpen) && (
        <div className={empty ? 'mt-2' : 'mt-2.5'}>
          <ParliamentPresetCards groups={groups} onPick={(k) => { onApplyPreset(k); if (!empty) setPresetsOpen(false); }} />
        </div>
      )}
      {empty && <div className="mt-2">{addControl}</div>}
    </div>
  );
}

export const PARLIAMENT_CSS = `
.gv-pk-bar{font-family:${OUTFIT};margin:0 0 10px}
.gv-pk-title{margin:0;font-size:14px;font-weight:700;letter-spacing:-0.005em;color:${INK}}
.gv-pk-line{margin:2px 0 8px;font-size:12.5px;line-height:1.45;color:${INK_SOFT}}
.gv-pk-link{background:none;border:none;padding:0;font-family:${OUTFIT};font-size:12.5px;font-weight:700;color:${FOREST};text-decoration:underline;text-underline-offset:3px;cursor:pointer}
.gv-pk-link:focus{outline:none}
.gv-pk-link:focus-visible{outline:2px solid ${FOREST};outline-offset:2px;border-radius:4px}
.gv-pk-hint{margin:6px 0 0;font-size:12px;line-height:1.45;color:${INK_SOFT}}

.gv-pk-preset,.gv-pk-group,.gv-pk-type{background:#FFFFFF;border:none;box-shadow:0 1px 0 rgba(27,56,40,0.08),0 10px 24px -20px rgba(27,56,40,0.5),inset 0 0 0 1px rgba(27,56,40,0.06)}

.gv-pk-presets{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
@media (max-width:420px){.gv-pk-presets{grid-template-columns:minmax(0,1fr)}}
.gv-pk-preset{display:flex;align-items:center;gap:10px;min-height:56px;padding:9px 12px 9px 10px;border-radius:14px;text-align:left;cursor:pointer;font-family:${OUTFIT};transition:transform 160ms cubic-bezier(0.22,1,0.36,1),box-shadow 160ms ease}
.gv-pk-preset:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 1px 0 rgba(27,56,40,0.1),0 14px 26px -18px rgba(27,56,40,0.55),inset 0 0 0 1px rgba(27,56,40,0.14)}
.gv-pk-preset:active:not(:disabled){transform:scale(0.985)}
.gv-pk-preset:focus{outline:none}
.gv-pk-preset:focus-visible{box-shadow:0 0 0 2px #FFFFFF,0 0 0 4px ${FOREST}}
.gv-pk-preset[data-added]{cursor:default;background:rgba(255,255,255,0.55);box-shadow:inset 0 0 0 1px rgba(27,56,40,0.08)}
.gv-pk-preset[data-added] .gv-pk-ico{opacity:0.55}
.gv-pk-ico{display:flex;align-items:center;justify-content:center;width:34px;height:34px;flex-shrink:0}
.gv-pk-preset-name{font-size:13.5px;font-weight:700;line-height:1.25;color:${INK};overflow-wrap:anywhere}
.gv-pk-preset-sub{margin-top:1px;font-size:12px;font-weight:500;color:${INK_SOFT}}

.gv-pk-groups{display:grid;grid-template-columns:repeat(auto-fill,minmax(112px,1fr));gap:6px;max-height:132px;overflow-y:auto;overscroll-behavior:contain;padding:2px;margin:-2px}
.gv-pk-group{position:relative;display:flex;align-items:center;gap:7px;min-height:38px;padding:5px 9px 5px 6px;border-radius:12px;cursor:pointer;font-family:${OUTFIT};text-align:left;color:${INK};box-shadow:inset 3px 0 0 var(--gc),0 1px 0 rgba(27,56,40,0.08),0 10px 24px -20px rgba(27,56,40,0.5),inset 0 0 0 1px rgba(27,56,40,0.06);transition:box-shadow 140ms ease,transform 140ms ease,background-color 140ms ease;touch-action:manipulation}
.gv-pk-group:hover{transform:translateY(-1px)}
.gv-pk-group:active{transform:scale(0.985)}
.gv-pk-group:focus{outline:none}
.gv-pk-group:focus-visible,.gv-pk-group[aria-expanded="true"]{box-shadow:inset 3px 0 0 var(--gc),0 0 0 2px ${FOREST}}
.gv-pk-groups[data-dragging] .gv-pk-group{box-shadow:inset 3px 0 0 var(--gc),inset 0 0 0 1.5px rgba(27,56,40,0.28)}
.gv-pk-groups[data-dragging] .gv-pk-group[data-drop]{transform:scale(1.03);background:#EEF5EF;box-shadow:inset 3px 0 0 var(--gc),0 0 0 2px ${FOREST},0 14px 26px -16px rgba(27,56,40,0.55)}
.gv-pk-group-name{flex:1;min-width:0;font-size:13px;font-weight:800;line-height:1.15;letter-spacing:-0.005em;overflow-wrap:anywhere}
.gv-pk-group-n{flex-shrink:0;font-size:14px;font-weight:800;color:${FOREST};font-variant-numeric:tabular-nums}
.gv-pk-group-addcell{display:flex;align-items:stretch}
.gv-pk-group-addcell > *{flex:1}
.gv-pk-add{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:38px;padding:0 12px;border-radius:12px;border:1.5px dashed rgba(27,56,40,0.32);background:transparent;cursor:pointer;font-family:${OUTFIT};font-size:13px;font-weight:700;color:${FOREST};transition:background-color 140ms ease}
.gv-pk-add:hover{background:rgba(27,56,40,0.05)}
.gv-pk-add:focus{outline:none}
.gv-pk-add:focus-visible{outline:2px solid ${FOREST};outline-offset:2px}
.gv-pk-input{min-height:40px;width:190px;max-width:100%;padding:0 12px;border-radius:12px;border:1.5px solid rgba(27,56,40,0.28);background:#FFFFFF;font-family:${OUTFIT};font-size:16px;color:${INK};outline:none}
.gv-pk-input:focus{border-color:${FOREST};box-shadow:0 0 0 3px rgba(27,56,40,0.12)}

.gv-pk-swatches{display:flex;flex-wrap:wrap;gap:6px}
.gv-pk-sw{position:relative;display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:999px;border:none;padding:0;cursor:pointer;box-shadow:inset 0 0 0 1px rgba(0,0,0,0.12);transition:transform 120ms ease}
.gv-pk-sw:hover{transform:scale(1.08)}
.gv-pk-sw:focus{outline:none}
.gv-pk-sw:focus-visible,.gv-pk-sw[aria-checked="true"],.gv-pk-sw-custom[data-on],.gv-pk-sw-custom:focus-within{box-shadow:0 0 0 2px #FFFFFF,0 0 0 4px ${FOREST}}
.gv-pk-sw-custom{background:conic-gradient(#E4003B,#FAA61A,#F5C400,#3D9B35,#33B2CC,#1A4FBF,#5A2A7A,#E4003B);color:#FFFFFF}
.gv-pk-sw-custom input{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer;border:0;padding:0}

.gv-pk-types{display:grid;grid-template-columns:minmax(0,1fr);gap:30px 14px;padding-top:24px}
@media (min-width:560px){.gv-pk-types{grid-template-columns:repeat(2,minmax(0,1fr))}}
.gv-pk-type{position:relative;display:flex;flex-direction:column;align-items:flex-start;gap:3px;padding:40px 18px 18px;border-radius:20px;text-align:left;cursor:pointer;font-family:${OUTFIT};transition:transform 200ms cubic-bezier(0.22,1,0.36,1),box-shadow 200ms ease,background-color 200ms ease}
.gv-pk-type:hover{transform:translateY(-3px);box-shadow:0 1px 0 rgba(27,56,40,0.1),0 22px 36px -22px rgba(27,56,40,0.6),inset 0 0 0 1px rgba(27,56,40,0.16)}
.gv-pk-type:active{transform:translateY(-1px) scale(0.99)}
.gv-pk-type:focus{outline:none}
.gv-pk-type:focus-visible{box-shadow:0 0 0 2px #FFFFFF,0 0 0 4px ${FOREST}}
.gv-pk-type[data-selected]{background:#EEF5EF;box-shadow:inset 0 0 0 2px ${FOREST},0 18px 34px -22px rgba(27,56,40,0.6)}
.gv-pk-type-disc{position:absolute;top:-24px;left:16px;display:flex;align-items:center;justify-content:center;width:62px;height:62px;border-radius:999px;box-shadow:0 0 0 4px #FFFFFF,0 10px 18px -10px rgba(27,56,40,0.45);transition:transform 220ms cubic-bezier(0.22,1,0.36,1)}
.gv-pk-type[data-selected] .gv-pk-type-disc{box-shadow:0 0 0 4px #EEF5EF,0 10px 18px -10px rgba(27,56,40,0.45)}
.gv-pk-type:hover .gv-pk-type-disc{transform:translateY(-3px) rotate(-4deg)}
.gv-pk-type-check{position:absolute;top:12px;right:12px;display:flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:999px;background:${FOREST};color:#EED98A;box-shadow:0 4px 10px -4px rgba(27,56,40,0.6)}
.gv-pk-type-name{font-size:18px;font-weight:800;letter-spacing:-0.015em;color:${INK}}
.gv-pk-type-desc{font-size:13px;line-height:1.45;color:${INK_SOFT}}
@media (prefers-reduced-motion:reduce){.gv-pk-type,.gv-pk-type-disc,.gv-pk-group,.gv-pk-preset{transition:none}.gv-pk-type:hover,.gv-pk-type:hover .gv-pk-type-disc{transform:none}}

@media (hover:none){
  .gv-pk-add,.gv-pk-input{min-height:44px}
  .gv-pk-group{min-height:44px}
  .gv-pk-sw{width:32px;height:32px}
  .gv-pk-link{padding:10px 0}
}
`;
