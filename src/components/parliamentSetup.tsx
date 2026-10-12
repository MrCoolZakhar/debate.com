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
import { GROUP_COLORS, PARLIAMENT_PRESETS, type SlotGroup } from '@/lib/slotGroups';
import type { CommitteeType } from '@/components/committeeSetupKit';

const INK = '#1C1410';
const INK_SOFT = '#5A5046';
const FOREST = '#1B3828';

// ── Committee types ──────────────────────────────────────────────────────────

export const COMMITTEE_TYPE_EMOJI: Record<CommitteeType, string> = {
  'general-assembly': 'Globe showing europe-africa',
  specialised: 'Balance scale',
  crisis: 'High voltage',
  custom: 'Classical building',
  press: 'Newspaper',
};

/** The tinted disc behind each type's emoji. */
const TYPE_TINT: Record<CommitteeType, string> = {
  'general-assembly': 'rgba(27,56,40,0.08)',
  specialised: 'rgba(61,122,82,0.12)',
  crisis: 'rgba(139,32,32,0.09)',
  custom: 'rgba(238,217,138,0.42)',
  press: 'rgba(47,96,118,0.12)',
};

/** What the type choice and the editor's header call each type. `custom` is
 *  the parliamentary type, so it says so; COMMITTEE_TYPE_LABEL keeps 'Custom'
 *  for every other surface that reads it. */
export const COMMITTEE_TYPE_TITLE: Record<CommitteeType, string> = {
  'general-assembly': 'General Assembly',
  specialised: 'Specialised',
  crisis: 'Crisis',
  custom: 'Parliament or custom',
  press: 'Press',
};

const TYPE_DESC: Record<CommitteeType, string> = {
  'general-assembly': 'Country delegations in a large, formal room.',
  specialised: 'Expert bodies: Security Council, ECOSOC, HRC, courts.',
  crisis: 'Character roles and live, fast-moving crises.',
  custom: 'Parties and benches with their own crests, or any format of your own.',
  press: 'Outlets and journalists who report on every committee, with a Press Desk.',
};

export function CommitteeTypeEmoji({ type, size = 18 }: { type: CommitteeType; size?: number }) {
  return <Emoji3D name={COMMITTEE_TYPE_EMOJI[type] ?? COMMITTEE_TYPE_EMOJI['general-assembly']} size={size} />;
}

/** The create flow's first screen: five white cards (four while press is off), an emoji in a tinted disc,
 *  the name and one short line. Two columns from 560px, one below. */
export function CommitteeTypeChooser({ types, onSelect }: { types: CommitteeType[]; onSelect: (t: CommitteeType) => void }) {
  return (
    <div className="gv-pk-types">
      <style>{PARLIAMENT_CSS}</style>
      {types.map((t) => (
        <button key={t} type="button" className="gv-pk-type" onClick={() => onSelect(t)}>
          <span className="gv-pk-type-disc" style={{ backgroundColor: TYPE_TINT[t] }}>
            <CommitteeTypeEmoji type={t} size={32} />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="gv-pk-type-name">{COMMITTEE_TYPE_TITLE[t]}</span>
            <span className="gv-pk-type-desc">{TYPE_DESC[t]}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

// ── Group colours ────────────────────────────────────────────────────────────

/** Accessible names for GROUP_COLORS, index for index. */
export const GROUP_COLOR_NAMES = ['Forest', 'Crimson', 'Gold', 'Blue', 'Purple', 'Green', 'Copper', 'Slate'];

export function GroupColorSwatches({ value, onPick }: { value: string | null; onPick: (color: string) => void }) {
  return (
    <div role="radiogroup" aria-label="Group colour" className="gv-pk-swatches">
      {GROUP_COLORS.map((c, i) => {
        const on = (value ?? FOREST).toLowerCase() === c.toLowerCase();
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
            {on && <Check size={12} strokeWidth={3} color="#FFFFFF" aria-hidden />}
          </button>
        );
      })}
    </div>
  );
}

/** "Add N seats" for one group. A parliament seats MPs by number, not by name,
 *  so the seats are named after the group ("EPP 1", "EPP 2"); every one can be
 *  renamed on its row. */
export function AddSeatsToGroup({ groupName, onAdd }: { groupName: string; onAdd: (n: number) => void }) {
  const [n, setN] = useState('5');
  const count = Math.max(0, Math.min(200, Math.floor(Number(n) || 0)));
  return (
    <div className="gv-pk-addseats">
      <label htmlFor="gv-pk-addseats-n" className="gv-pk-addseats-label">Add seats</label>
      <div className="flex items-center gap-2">
        <input
          id="gv-pk-addseats-n"
          type="number"
          inputMode="numeric"
          min={1}
          max={200}
          value={n}
          onChange={(e) => setN(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && count > 0) { e.preventDefault(); onAdd(count); } }}
          className="gv-pk-num"
          aria-describedby="gv-pk-addseats-hint"
        />
        <button type="button" className="gv-pk-btn" disabled={count === 0} onClick={() => onAdd(count)}>
          Add {count > 0 ? count : ''} {count === 1 ? 'seat' : 'seats'}
        </button>
      </div>
      <p id="gv-pk-addseats-hint" className="gv-pk-hint">Named {groupName} 1, {groupName} 2 and so on. Rename any of them on its row.</p>
    </div>
  );
}

// ── Presets ──────────────────────────────────────────────────────────────────

function PresetIcon({ flag, emoji, label }: { flag?: string; emoji?: string; label: string }) {
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
        const added = p.groups.every((n) => have.has(n.toLowerCase()));
        return (
          <button
            key={p.key}
            type="button"
            className="gv-pk-preset"
            data-added={added ? '' : undefined}
            disabled={added}
            title={`${p.hint}: ${p.groups.join(', ')}`}
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

// ── The groups bar ───────────────────────────────────────────────────────────

/** A custom committee's groups, above its seat list: each group a small white
 *  card with its crest (or its colour as a disc), its name and its seat count,
 *  opening the caller's group menu; then "Add group"; then the parliaments to
 *  start from (always open while there are no groups, behind "Add a
 *  parliament" afterwards). */
export function SeatGroupsBar({
  groups, counts, seatTotal, menuOpenId, onOpenMenu, onAddGroup, onApplyPreset,
}: {
  groups: SlotGroup[];
  counts: Map<string, number>;
  seatTotal: number;
  menuOpenId: string | null;
  /** Toggle: the caller closes the menu when `id` is already open. */
  onOpenMenu: (id: string, el: HTMLElement) => void;
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
        else if (e.key === 'Escape') { setAdding(false); setDraft(''); }
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
          : `${groups.length} ${groups.length === 1 ? 'group' : 'groups'}, ${placed} of ${seatTotal} ${seatTotal === 1 ? 'seat' : 'seats'} placed`}
      </p>

      {!empty && (
        <div className="gv-pk-groups">
          {groups.map((g) => {
            const n = counts.get(g.id) ?? 0;
            const color = g.color ?? FOREST;
            return (
              <button
                key={g.id}
                type="button"
                className="gv-pk-group"
                style={{ ['--gc' as string]: color }}
                aria-expanded={menuOpenId === g.id}
                aria-haspopup="menu"
                title={`${g.name}: ${n} ${n === 1 ? 'seat' : 'seats'}. Rename, colour, crest or seats`}
                onClick={(e) => onOpenMenu(g.id, e.currentTarget)}
              >
                <CircleFlag
                  logoUrl={g.logo_url}
                  label={g.name}
                  size={24}
                  logoFit="contain"
                  monogramColors={{ bg: color, fg: '#FFFFFF' }}
                  ring={g.logo_url ? true : false}
                  decorative
                />
                <span className="min-w-0 text-left [overflow-wrap:anywhere]">{g.name}</span>
                <span className="gv-pk-group-n">{n}</span>
              </button>
            );
          })}
          {addControl}
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

.gv-pk-groups{display:flex;flex-wrap:wrap;gap:6px}
.gv-pk-group{display:inline-flex;align-items:center;gap:8px;max-width:100%;min-height:40px;padding:5px 11px 5px 6px;border-radius:12px;cursor:pointer;font-family:${OUTFIT};font-size:13px;font-weight:600;line-height:1.25;color:${INK};box-shadow:inset 3px 0 0 var(--gc),0 1px 0 rgba(27,56,40,0.08),0 10px 24px -20px rgba(27,56,40,0.5),inset 0 0 0 1px rgba(27,56,40,0.06);transition:box-shadow 140ms ease,transform 140ms ease}
.gv-pk-group:hover{transform:translateY(-1px)}
.gv-pk-group:focus{outline:none}
.gv-pk-group:focus-visible,.gv-pk-group[aria-expanded="true"]{box-shadow:inset 3px 0 0 var(--gc),0 0 0 2px ${FOREST}}
.gv-pk-group-n{font-size:13px;font-weight:800;color:${FOREST};font-variant-numeric:tabular-nums}
.gv-pk-add{display:inline-flex;align-items:center;gap:6px;min-height:40px;padding:0 12px;border-radius:12px;border:1.5px dashed rgba(27,56,40,0.32);background:transparent;cursor:pointer;font-family:${OUTFIT};font-size:13px;font-weight:700;color:${FOREST};transition:background-color 140ms ease}
.gv-pk-add:hover{background:rgba(27,56,40,0.05)}
.gv-pk-add:focus{outline:none}
.gv-pk-add:focus-visible{outline:2px solid ${FOREST};outline-offset:2px}
.gv-pk-input{min-height:40px;width:190px;max-width:100%;padding:0 12px;border-radius:12px;border:1.5px solid rgba(27,56,40,0.28);background:#FFFFFF;font-family:${OUTFIT};font-size:16px;color:${INK};outline:none}
.gv-pk-input:focus{border-color:${FOREST};box-shadow:0 0 0 3px rgba(27,56,40,0.12)}

.gv-pk-swatches{display:flex;flex-wrap:wrap;gap:5px}
.gv-pk-sw{display:inline-flex;align-items:center;justify-content:center;width:23px;height:23px;border-radius:999px;border:none;padding:0;cursor:pointer;box-shadow:inset 0 0 0 1px rgba(0,0,0,0.12);transition:transform 120ms ease}
.gv-pk-sw:hover{transform:scale(1.08)}
.gv-pk-sw:focus{outline:none}
.gv-pk-sw:focus-visible,.gv-pk-sw[aria-checked="true"]{box-shadow:0 0 0 2px #FFFFFF,0 0 0 4px ${FOREST}}

.gv-pk-addseats-label{display:block;margin:0 0 6px;font-size:12.5px;font-weight:700;color:${INK}}
.gv-pk-num{width:72px;min-height:40px;padding:0 10px;border-radius:10px;border:1.5px solid rgba(27,56,40,0.28);background:#FFFFFF;font-family:${OUTFIT};font-size:16px;font-weight:700;color:${INK};font-variant-numeric:tabular-nums;outline:none}
.gv-pk-num:focus{border-color:${FOREST};box-shadow:0 0 0 3px rgba(27,56,40,0.12)}
.gv-pk-btn{display:inline-flex;align-items:center;justify-content:center;min-height:40px;padding:0 14px;border-radius:10px;border:none;cursor:pointer;background:linear-gradient(90deg,#1B3828 0%,#2A5A3C 100%);color:#EED98A;font-family:${OUTFIT};font-size:13px;font-weight:700;white-space:nowrap;transition:opacity 140ms ease,transform 120ms ease}
.gv-pk-btn:active:not(:disabled){transform:scale(0.98)}
.gv-pk-btn:disabled{opacity:0.5;cursor:default}
.gv-pk-btn:focus{outline:none}
.gv-pk-btn:focus-visible{outline:2px solid ${FOREST};outline-offset:2px}

.gv-pk-types{display:grid;grid-template-columns:minmax(0,1fr);gap:10px}
@media (min-width:560px){.gv-pk-types{grid-template-columns:repeat(2,minmax(0,1fr))}}
.gv-pk-type{display:flex;align-items:center;gap:14px;padding:14px 16px 14px 14px;border-radius:18px;text-align:left;cursor:pointer;font-family:${OUTFIT};transition:transform 180ms cubic-bezier(0.22,1,0.36,1),box-shadow 180ms ease}
@media (min-width:560px){.gv-pk-type{flex-direction:column;align-items:flex-start;gap:12px;padding:16px 16px 18px}}
.gv-pk-type:hover{transform:translateY(-2px);box-shadow:0 1px 0 rgba(27,56,40,0.1),0 18px 32px -22px rgba(27,56,40,0.6),inset 0 0 0 1px rgba(27,56,40,0.16)}
.gv-pk-type:active{transform:scale(0.985)}
.gv-pk-type:focus{outline:none}
.gv-pk-type:focus-visible{box-shadow:0 0 0 2px #FFFFFF,0 0 0 4px ${FOREST}}
.gv-pk-type-disc{display:flex;align-items:center;justify-content:center;width:52px;height:52px;border-radius:999px;flex-shrink:0}
.gv-pk-type-name{font-size:15.5px;font-weight:800;letter-spacing:-0.01em;color:${INK}}
.gv-pk-type-desc{margin-top:3px;font-size:13px;line-height:1.45;color:${INK_SOFT}}

@media (hover:none){
  .gv-pk-group,.gv-pk-add,.gv-pk-input,.gv-pk-num,.gv-pk-btn{min-height:44px}
  .gv-pk-sw{width:32px;height:32px}
  .gv-pk-link{padding:10px 0}
}
`;
