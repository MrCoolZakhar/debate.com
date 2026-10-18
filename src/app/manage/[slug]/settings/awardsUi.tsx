'use client';

// ── Settings → Awards (11 Oct 2026) ─────────────────────────────────────────
// Owner: "Make it simple, just like starting from a blank slate, no awards set
// up yet. First asking them if all awards will be the same for all committees
// and that they can change that later. Then a few preset awards in categories,
// then custom awards. If a conference does not set up awards, never offer it
// to chairs."
//
// Three screens, one obvious next step each:
//   1. Blank slate        "No awards yet" + Set up awards
//   2. The one question   Will every committee give the same awards?
//   3. The editor         Placements, Other awards, Custom awards (one shared
//                         set, or a committee picker with per-committee sets)
//
// Everything is a view over `conferences.awards_config` (src/lib/awards.ts:
// `setUp`, `sameForAll`, `perCommittee` were added for this screen). Saves are
// debounced (600 ms), row-counted through `saveAwardsConfig`, and flushed on
// unmount. Answering the question is the moment awards become set up, and
// therefore the moment chairs start to see them.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Award, Check, ChevronRight, Minus, PenLine, Plus, Trophy, X } from 'lucide-react';
import { useManage, type Conference } from '@/app/manage/[slug]/layout';
import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { Emoji3D } from '@/components/neu';
import {
  AWARD_PRESET_GROUPS, awardKeyFromLabel, configForCommittee, freshAwardTypes, getAwardsConfig,
  type AwardPreset, type AwardsConfig, type AwardTypeConfig, type CommitteeAwardSet,
} from '@/lib/awards';
import { saveAwardsConfig } from '@/lib/awardsService';
import { friendlyError } from '@/lib/friendlyError';
import { notifyErr } from '@/lib/appNotify';
import { committeeDisplayName } from '@/lib/presetNames';
import {
  F, INK, INK_SOFT, FOREST, GOLD, AMBER, INPUT,
  SectionHead, Switch, BigCount, Group, SwitchRow, TINT_GOLD_BG, TINT_GREEN_BG, TYPE, TYPE_PX
} from './panelKit';
import { HangingDisc, TINT_GOLD } from '../financials/dashboardKit';
import { AwardsReview } from './awardsReview';
import { AwardsSheet } from './awardsSheet';
import { ConfirmModal } from '@/components/ConfirmModal';

const SAVE_DEBOUNCE_MS = 600;
const MAX_PER_COMMITTEE = 10;
const MAX_LABEL = 60;

interface CommitteeLite {
  id: string;
  name: string;
  abbreviation: string | null;
}

// ── Look ────────────────────────────────────────────────────────────────────

const AWARDS_CSS = `
.gv-aw-grid{display:grid;gap:22px 16px;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));padding-top:14px}
.gv-aw-card{position:relative;background:#FFFFFF;border-radius:18px;padding:30px 16px 16px;
  box-shadow:0 1px 0 rgba(27,56,40,0.08),0 14px 30px -26px rgba(27,56,40,0.45);transition:box-shadow 180ms ease,background 180ms ease}
.gv-aw-card[data-on="true"]{background:linear-gradient(160deg,rgba(61,122,82,0.07),rgba(61,122,82,0.02)) ,#FFFFFF;
  box-shadow:inset 0 0 0 1.5px rgba(61,122,82,0.45),0 14px 30px -24px rgba(27,56,40,0.5)}
.gv-aw-pop{position:absolute;top:-20px;inset-inline-start:14px}
.gv-aw-choice{display:flex;flex-direction:column;align-items:flex-start;gap:8px;text-align:start;width:100%;
  background:#FFFFFF;border:none;border-radius:18px;padding:34px 18px 18px;cursor:pointer;position:relative;
  box-shadow:inset 0 0 0 1.5px rgba(27,56,40,0.12),0 14px 30px -26px rgba(27,56,40,0.45);transition:box-shadow 160ms ease,transform 120ms ease}
.gv-aw-choice:hover{box-shadow:inset 0 0 0 1.5px rgba(27,56,40,0.45),0 18px 34px -24px rgba(27,56,40,0.5)}
.gv-aw-choice:active{transform:scale(0.99)}
.gv-aw-choice:focus{outline:none}
.gv-aw-choice:focus-visible{outline:2px solid ${FOREST};outline-offset:3px}
.gv-aw-step{width:34px;height:34px;border-radius:10px;border:none;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;
  background:#FFFFFF;color:${FOREST};box-shadow:inset 0 0 0 1.5px rgba(27,56,40,0.22)}
.gv-aw-step:disabled{opacity:0.4;cursor:default}
.gv-aw-step:focus{outline:none}
.gv-aw-step:focus-visible{outline:2px solid ${FOREST};outline-offset:2px}
.gv-aw-chip{border:none;cursor:pointer;border-radius:999px;padding:5px 11px;font-family:${F};font-size:12.5px;font-weight:600;
  background:rgba(27,56,40,0.06);color:${INK}}
.gv-aw-chip[aria-pressed="true"],.gv-aw-chip[aria-checked="true"]{background:${FOREST};color:${GOLD}}
.gv-aw-chip:focus{outline:none}
.gv-aw-chip:focus-visible{outline:2px solid ${FOREST};outline-offset:2px}
.gv-aw-com{display:flex;flex-direction:column;align-items:flex-start;gap:2px;text-align:start;border:none;cursor:pointer;
  min-width:150px;max-width:240px;border-radius:14px;padding:10px 12px;background:#FFFFFF;
  box-shadow:inset 0 0 0 1.5px rgba(27,56,40,0.12)}
.gv-aw-com[aria-pressed="true"]{box-shadow:inset 0 0 0 2px ${FOREST},0 10px 22px -18px rgba(27,56,40,0.6);background:linear-gradient(160deg,rgba(61,122,82,0.08),rgba(61,122,82,0.02)),#FFFFFF}
.gv-aw-com:focus{outline:none}
.gv-aw-com:focus-visible{outline:2px solid ${FOREST};outline-offset:2px}
.gv-aw-wrap{container-type:inline-size}
.gv-aw-layout{display:grid;gap:20px;grid-template-columns:minmax(0,1fr);align-items:start}
.gv-aw-layout>.gv-rv-wrap>.gv-rv-main{order:-2}
.gv-aw-layout>.gv-rv-wrap>.gv-rv-pub{order:-1}
@container (min-width: 960px){
  .gv-aw-layout{grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:24px;align-items:stretch}
  .gv-aw-a{grid-column:1;grid-row:1}
  .gv-aw-layout>.gv-rv-wrap>.gv-rv-main{grid-column:2;grid-row:1;order:0}
  .gv-aw-c{grid-column:1;grid-row:2;align-self:start}
  .gv-aw-layout>.gv-rv-wrap>.gv-rv-pub{grid-column:2;grid-row:2;order:0;align-self:start}
}
.gv-aw-row{border:none;cursor:pointer;padding:12px 14px;background:#FFFFFF;box-shadow:inset 0 0 0 1px rgba(27,56,40,0.10);transition:box-shadow 160ms ease}
.gv-aw-row:hover{box-shadow:inset 0 0 0 1.5px rgba(27,56,40,0.35)}
.gv-aw-row:focus{outline:none}
.gv-aw-row:focus-visible{outline:2px solid ${FOREST};outline-offset:2px}
@media (prefers-reduced-motion: reduce){.gv-aw-card,.gv-aw-choice,.gv-aw-row{transition:none}}
`;

/**
 * The custom award's mark (owner: "a trophy with a question mark"): the
 * Fluent 3D Trophy with a small gold "?" badge overlapping its corner.
 */
export function TrophyQuestion({ size = 40 }: { size?: number }) {
  const badge = Math.max(14, Math.round(size * 0.46));
  return (
    <span aria-hidden className="relative inline-flex" style={{ width: size, height: size }}>
      <Emoji3D name="Trophy" size={size} fallback={Trophy} fallbackColor={AMBER} />
      <span
        className="absolute inline-flex items-center justify-center"
        style={{
          width: badge, height: badge, borderRadius: 999,
          insetInlineEnd: -Math.round(badge * 0.28), bottom: -Math.round(badge * 0.12),
          background: 'linear-gradient(150deg, #F6E7A6 0%, #E2C25C 55%, #B6871F 100%)',
          boxShadow: '0 0 0 2px #FFFFFF, 0 4px 8px -3px rgba(138,102,20,0.7), inset 0 1px 0 rgba(255,255,255,0.7)',
          color: FOREST, fontFamily: F, fontWeight: 900, fontSize: Math.round(badge * 0.66), lineHeight: 1,
        }}
      >
        ?
      </span>
    </span>
  );
}

/** A big icon disc that sits over a card's top edge (the owner likes things sticking out). */
function PopDisc({ children, tint = TINT_GOLD_BG, size = 52 }: { children: React.ReactNode; tint?: string; size?: number }) {
  return (
    <span
      aria-hidden
      className="gv-fd-disc"
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.32), background: tint }}
    >
      {children}
    </span>
  );
}

function Stepper({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <div className="inline-flex items-center gap-2" role="group" aria-label={label}>
      <button type="button" className="gv-aw-step" aria-label={`One fewer ${label.toLowerCase()}`}
        disabled={value <= 1} onClick={() => onChange(Math.max(1, value - 1))}>
        <Minus size={16} strokeWidth={2.6} aria-hidden />
      </button>
      <span aria-live="polite" style={{ fontFamily: F, fontSize: 20, fontWeight: 800, color: FOREST, minWidth: 22, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </span>
      <button type="button" className="gv-aw-step" aria-label={`One more ${label.toLowerCase()}`}
        disabled={value >= MAX_PER_COMMITTEE} onClick={() => onChange(Math.min(MAX_PER_COMMITTEE, value + 1))}>
        <Plus size={16} strokeWidth={2.6} aria-hidden />
      </button>
    </div>
  );
}

/** A label edited in place: saved on blur or Enter, Escape puts it back. */
function LabelField({ value, fallback, onCommit, id }: { value: string; fallback: string; onCommit: (v: string) => void; id: string }) {
  const [draft, setDraft] = useState(value);
  const [prev, setPrev] = useState(value);
  if (prev !== value) { setPrev(value); setDraft(value); }
  const commit = () => {
    const v = draft.replace(/\s+/g, ' ').trim().slice(0, MAX_LABEL);
    if (!v) { setDraft(value || fallback); return; }
    if (v !== value) onCommit(v);
  };
  return (
    <input
      id={id}
      value={draft}
      maxLength={MAX_LABEL}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur(); }
        if (e.key === 'Escape') { setDraft(value); (e.target as HTMLInputElement).blur(); }
      }}
      style={{ ...INPUT, width: '100%', minHeight: 40, fontSize: TYPE_PX.body }}
    />
  );
}

// ── One award card ──────────────────────────────────────────────────────────

function AwardCard({ type, preset, onPatch, onRemove }: {
  type: AwardTypeConfig;
  preset: AwardPreset | null;
  onPatch: (patch: Partial<AwardTypeConfig>) => void;
  /** Custom awards only. */
  onRemove?: () => void;
}) {
  const on = type.enabled && type.perCommittee > 0;
  const fieldId = `aw-label-${type.key}`;
  return (
    <div className="gv-aw-card" data-on={on ? 'true' : undefined}>
      <div className="gv-aw-pop">
        <PopDisc tint={on ? TINT_GOLD_BG : 'linear-gradient(150deg, rgba(27,56,40,0.10), rgba(27,56,40,0.04))'}>
          {preset
            ? <Emoji3D name={preset.emoji} size={34} fallback={Award} fallbackColor={FOREST} />
            : <TrophyQuestion size={32} />}
        </PopDisc>
      </div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p style={{ fontFamily: F, fontSize: 16, fontWeight: 800, color: INK, lineHeight: 1.25, overflowWrap: 'anywhere' }}>{type.label}</p>
          <p style={{ fontFamily: F, fontSize: TYPE_PX.hint, color: INK_SOFT, marginTop: 2 }}>{preset ? preset.line : 'Your own award'}</p>
        </div>
        {preset ? (
          <Switch
            label={`Give ${type.label}`}
            checked={on}
            onChange={(next) => onPatch(next
              ? { enabled: true, perCommittee: type.perCommittee > 0 ? type.perCommittee : preset.defaultCount }
              : { enabled: false })}
          />
        ) : (
          <button type="button" onClick={onRemove} aria-label={`Remove ${type.label}`} className="gv-aw-step" style={{ width: 32, height: 32 }}>
            <X size={15} strokeWidth={2.6} aria-hidden />
          </button>
        )}
      </div>

      {on && (
        <div className="mt-3 flex flex-col gap-3">
          {preset && preset.names.length > 1 && (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Name">
              {preset.names.map((n) => (
                <button key={n} type="button" className="gv-aw-chip" aria-pressed={type.label === n} onClick={() => onPatch({ label: n })}>
                  {n}
                </button>
              ))}
            </div>
          )}
          <div>
            <label htmlFor={fieldId} style={{ fontFamily: F, fontSize: TYPE_PX.hint, fontWeight: 600, color: INK_SOFT }}>Name on the certificate</label>
            <div className="mt-1">
              <LabelField id={fieldId} value={type.label} fallback={preset?.names[0] ?? 'Custom award'} onCommit={(v) => onPatch({ label: v })} />
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span style={{ fontFamily: F, fontSize: TYPE_PX.hint, fontWeight: 700, color: INK }}>Per committee</span>
            <Stepper label={type.label} value={Math.max(1, type.perCommittee)} onChange={(v) => onPatch({ perCommittee: v })} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helpers over a set of awards ───────────────────────────────────────────

const PRESETS = new Map(AWARD_PRESET_GROUPS.flatMap((g) => g.presets).map((p) => [p.key, p]));

const isOn = (t: AwardTypeConfig) => t.enabled && t.scope === 'committee' && t.perCommittee > 0;

/**
 * Keep every committee's own set in step with the conference awards (13 Oct
 * 2026). The conference list is the catalogue: a custom award added there is
 * added to every own set, one removed there is removed, and names and the
 * committees a custom award is for follow it. What a committee switched on or
 * off, and how many it gives, stay its own.
 */
function syncOwnSets(
  per: Record<string, CommitteeAwardSet>,
  prev: AwardTypeConfig[],
  next: AwardTypeConfig[],
): Record<string, CommitteeAwardSet> {
  const nextKeys = new Map(next.map((t) => [t.key, t]));
  const removed = new Set(prev.filter((t) => !nextKeys.has(t.key)).map((t) => t.key));
  const out: Record<string, CommitteeAwardSet> = {};
  for (const [id, set] of Object.entries(per)) {
    const kept = set.types
      .filter((t) => !removed.has(t.key))
      .map((t) => {
        const n = nextKeys.get(t.key);
        if (!n) return t;
        const merged: AwardTypeConfig = { ...t, label: n.label };
        if (n.committees && n.committees.length > 0) merged.committees = [...n.committees];
        else delete merged.committees;
        return merged;
      });
    const have = new Set(kept.map((t) => t.key));
    for (const n of next) if (!have.has(n.key)) kept.push({ ...n, ...(n.committees ? { committees: [...n.committees] } : {}) });
    out[id] = { types: kept };
  }
  return out;
}

const short = (c: CommitteeLite) => committeeDisplayName(c.name, c.abbreviation);

// ── Conference Awards: the read-only list ──────────────────────────────────

function ConferenceAwardsList({ types, committees }: { types: AwardTypeConfig[]; committees: CommitteeLite[] }) {
  const on = types.filter(isOn);
  if (on.length === 0) {
    return <p style={{ fontFamily: F, fontSize: TYPE_PX.body, color: INK_SOFT }}>No awards switched on yet. Edit awards to choose them.</p>;
  }
  const names = new Map(committees.map((c) => [c.id, short(c)]));
  return (
    <ul className="flex flex-col gap-2" aria-label="Awards being given">
      {on.map((t) => {
        const preset = PRESETS.get(t.key) ?? null;
        const tier = preset && preset.place !== null ? 'Placement' : 'Other';
        const some = t.committees && t.committees.length > 0
          ? t.committees.map((id) => names.get(id)).filter((x): x is string => !!x)
          : null;
        return (
          <li key={t.key} className="flex items-center gap-3 rounded-2xl" style={{ padding: '10px 12px', background: '#FFFFFF', boxShadow: 'inset 0 0 0 1px rgba(27,56,40,0.08)' }}>
            <span className="shrink-0">
              {preset ? <Emoji3D name={preset.emoji} size={30} fallback={Award} fallbackColor={FOREST} /> : <TrophyQuestion size={28} />}
            </span>
            <span className="min-w-0 flex-1" style={{ fontFamily: F }}>
              <span className="block" style={{ fontSize: TYPE_PX.body, fontWeight: 800, color: INK, overflowWrap: 'anywhere' }}>{t.label}</span>
              <span className="block" style={{ fontSize: TYPE_PX.hint, color: INK_SOFT, overflowWrap: 'anywhere' }}>
                {tier}{some ? ` · ${some.length > 0 ? some.join(', ') : 'No committees'}` : ''}
              </span>
            </span>
            <span className="shrink-0" style={{ fontFamily: F, fontSize: TYPE_PX.hint, color: INK_SOFT, whiteSpace: 'nowrap' }}>
              <b style={{ fontSize: TYPE_PX.card, fontWeight: 800, color: FOREST, fontVariantNumeric: 'tabular-nums' }}>{t.perCommittee}</b> per committee
            </span>
          </li>
        );
      })}
    </ul>
  );
}

// ── Edit awards: the pop-up (the catalogue, and the Custom award form) ──────

type CustomDraft = { key: string | null; name: string; amount: number; all: boolean; picked: string[] };

function EditAwardsSheet({ types, committees, onChange, onClose }: {
  types: AwardTypeConfig[];
  committees: CommitteeLite[];
  onChange: (next: AwardTypeConfig[]) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<CustomDraft | null>(null);
  const [error, setError] = useState('');
  const byKey = new Map(types.map((t) => [t.key, t]));
  const customs = types.filter((t) => !t.builtin && t.scope === 'committee');
  const names = new Map(committees.map((c) => [c.id, short(c)]));

  const patch = (key: string, p: Partial<AwardTypeConfig>) => onChange(types.map((t) => (t.key === key ? { ...t, ...p } : t)));

  const startNew = () => { setDraft({ key: null, name: '', amount: 1, all: true, picked: [] }); setError(''); };
  const startEdit = (t: AwardTypeConfig) => {
    setDraft({ key: t.key, name: t.label, amount: Math.max(1, t.perCommittee), all: !t.committees || t.committees.length === 0, picked: t.committees ?? [] });
    setError('');
  };

  const saveDraft = () => {
    if (!draft) return;
    const label = draft.name.replace(/\s+/g, ' ').trim().slice(0, MAX_LABEL);
    if (!label) { setError('Type a name for the award.'); return; }
    if (types.some((t) => t.key !== draft.key && t.label.toLowerCase() === label.toLowerCase())) { setError('You already have an award with that name.'); return; }
    if (!draft.all && draft.picked.length === 0) { setError('Pick at least one committee, or choose All committees.'); return; }
    const committeesField = draft.all ? undefined : [...draft.picked];
    if (draft.key) {
      onChange(types.map((t) => {
        if (t.key !== draft.key) return t;
        const n: AwardTypeConfig = { ...t, label, perCommittee: draft.amount, enabled: true };
        if (committeesField) n.committees = committeesField; else delete n.committees;
        return n;
      }));
    } else {
      // The key is stable from here on (custom-<slug>), whatever the name becomes.
      let key = awardKeyFromLabel(label);
      let n = 2;
      while (types.some((t) => t.key === key)) key = `${awardKeyFromLabel(label)}-${n++}`;
      onChange([...types, {
        key, label, tier: 'special', scope: 'committee', perCommittee: draft.amount, points: 0,
        enabled: true, builtin: false, description: '', ...(committeesField ? { committees: committeesField } : {}),
      }]);
    }
    setDraft(null);
    setError('');
  };

  if (draft) {
    return (
      <AwardsSheet
        title={draft.key ? 'Edit Custom Award' : 'Custom Award'}
        onClose={onClose}
        onBack={() => { setDraft(null); setError(''); }}
        backLabel="Back to the awards"
        width={620}
        footer={<>
          <button type="button" className="gv-st-link" onClick={() => { setDraft(null); setError(''); }}>Cancel</button>
          <button type="button" className="gv-st-btn gv-st-forest" onClick={saveDraft}>Done</button>
        </>}
      >
        <div className="flex flex-col gap-5" style={{ fontFamily: F }}>
          <div>
            <label htmlFor="aw-custom-name" style={{ fontSize: TYPE_PX.body, fontWeight: 600, color: INK }}>Name on the award</label>
            <input
              id="aw-custom-name"
              value={draft.name}
              maxLength={MAX_LABEL}
              autoFocus
              placeholder="Best Crisis Response"
              onChange={(e) => { setDraft({ ...draft, name: e.target.value }); if (error) setError(''); }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveDraft(); } }}
              style={{ ...INPUT, width: '100%', minHeight: 44, fontSize: 16, marginTop: 6 }}
            />
          </div>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span style={{ fontSize: TYPE_PX.body, fontWeight: 600, color: INK }}>Amount per committee</span>
            <Stepper label="Amount per committee" value={draft.amount} onChange={(v) => setDraft({ ...draft, amount: v })} />
          </div>
          <fieldset>
            <legend style={{ fontSize: TYPE_PX.body, fontWeight: 600, color: INK }}>Which committees get it</legend>
            <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Which committees get it">
              <button type="button" role="radio" aria-checked={draft.all} className="gv-aw-chip" onClick={() => setDraft({ ...draft, all: true })}>All committees</button>
              <button type="button" role="radio" aria-checked={!draft.all} className="gv-aw-chip" onClick={() => setDraft({ ...draft, all: false })}>Pick committees</button>
            </div>
            {!draft.all && (
              <div className="mt-3 grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
                {committees.length === 0 && <p style={{ fontSize: TYPE_PX.hint, color: INK_SOFT }}>Add committees first.</p>}
                {committees.map((c) => {
                  const on = draft.picked.includes(c.id);
                  return (
                    <label key={c.id} className="flex items-start gap-2.5 rounded-xl cursor-pointer" style={{ padding: '10px 12px', background: on ? 'rgba(61,122,82,0.10)' : '#FFFFFF', boxShadow: on ? `inset 0 0 0 1.5px ${FOREST}` : 'inset 0 0 0 1px rgba(27,56,40,0.12)' }}>
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={(e) => { setDraft({ ...draft, picked: e.target.checked ? [...draft.picked, c.id] : draft.picked.filter((x) => x !== c.id) }); if (error) setError(''); }}
                        style={{ marginTop: 3, accentColor: FOREST, width: 16, height: 16 }}
                      />
                      <span className="min-w-0">
                        <span className="block" style={{ fontSize: TYPE_PX.body, fontWeight: 700, color: INK, overflowWrap: 'anywhere' }}>{short(c)}</span>
                        {short(c) !== c.name && <span className="block" style={{ fontSize: TYPE_PX.hint, color: INK_SOFT, overflowWrap: 'anywhere' }}>{c.name}</span>}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </fieldset>
          {error && <p role="alert" style={{ fontSize: TYPE_PX.hint, color: '#8B2020' }}>{error}</p>}
        </div>
      </AwardsSheet>
    );
  }

  return (
    <AwardsSheet title="Edit Awards" onClose={onClose} width={900}
      footer={<button type="button" className="gv-st-btn gv-st-forest" onClick={onClose}>Done</button>}>
      <div className="flex flex-col gap-6">
        {AWARD_PRESET_GROUPS.map((g) => (
          <section key={g.id} aria-label={g.title}>
            <h3 style={{ fontFamily: F, fontSize: TYPE_PX.card, fontWeight: 800, color: INK }}>{g.title}</h3>
            <div className="gv-aw-grid">
              {g.presets.map((p) => {
                const t = byKey.get(p.key);
                return t ? <AwardCard key={p.key} type={t} preset={p} onPatch={(x) => patch(p.key, x)} /> : null;
              })}
            </div>
          </section>
        ))}
        <section aria-label="Custom awards">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h3 style={{ fontFamily: F, fontSize: TYPE_PX.card, fontWeight: 800, color: INK }}>Custom awards</h3>
            <button type="button" className="gv-st-btn gv-st-outline" onClick={startNew}>
              <Plus size={16} strokeWidth={2.6} aria-hidden />Custom award
            </button>
          </div>
          {customs.length === 0 ? (
            <p className="mt-2" style={{ fontFamily: F, fontSize: TYPE_PX.hint, color: INK_SOFT }}>Your own awards, for every committee or only some.</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {customs.map((t) => {
                const some = t.committees && t.committees.length > 0 ? t.committees.map((id) => names.get(id)).filter(Boolean).join(', ') : 'All committees';
                return (
                  <li key={t.key} className="flex items-center gap-3 rounded-2xl" style={{ padding: '10px 12px', background: '#FFFFFF', boxShadow: 'inset 0 0 0 1px rgba(27,56,40,0.08)' }}>
                    <TrophyQuestion size={30} />
                    <span className="min-w-0 flex-1" style={{ fontFamily: F }}>
                      <span className="block" style={{ fontSize: TYPE_PX.body, fontWeight: 800, color: INK, overflowWrap: 'anywhere' }}>{t.label}</span>
                      <span className="block" style={{ fontSize: TYPE_PX.hint, color: INK_SOFT, overflowWrap: 'anywhere' }}>{t.perCommittee} per committee · {some}</span>
                    </span>
                    <button type="button" className="gv-st-link" onClick={() => startEdit(t)}>Edit</button>
                    <button type="button" className="gv-aw-step" style={{ width: 32, height: 32 }} aria-label={`Remove ${t.label}`} title="Remove"
                      onClick={() => onChange(types.filter((x) => x.key !== t.key))}>
                      <X size={15} strokeWidth={2.6} aria-hidden />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </AwardsSheet>
  );
}

// ── Awards per Committee: the pop-up ───────────────────────────────────────

function CommitteesSheet({ config, committees, onPatchCommittee, onRevert, onOpenConferenceAwards, onClose }: {
  config: AwardsConfig;
  committees: CommitteeLite[] | null;
  onPatchCommittee: (id: string, key: string, patch: Partial<AwardTypeConfig>) => void;
  onRevert: (id: string) => void;
  onOpenConferenceAwards: () => void;
  onClose: () => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = openId ? (committees ?? []).find((c) => c.id === openId) ?? null : null;
  const newAwardsLine = (
    <p className="mt-5" style={{ fontFamily: F, fontSize: TYPE_PX.hint, color: INK_SOFT }}>
      New awards are added in{' '}
      <button type="button" className="gv-st-link" style={{ fontSize: TYPE_PX.hint }} onClick={onOpenConferenceAwards}>Conference Awards</button>
    </p>
  );

  if (open) {
    const own = !!config.perCommittee[open.id];
    const types = configForCommittee({ ...config, sameForAll: false }, open.id).types.filter((t) => t.scope === 'committee');
    return (
      <AwardsSheet title={`${short(open)}'s Awards`} onClose={onClose} onBack={() => setOpenId(null)} backLabel="Back to the committees" width={760}
        footer={<button type="button" className="gv-st-btn gv-st-forest" onClick={() => setOpenId(null)}>Done</button>}>
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3" style={{ fontFamily: F }}>
          <p style={{ fontSize: TYPE_PX.hint, color: INK_SOFT }}>{own ? 'This committee gives its own awards.' : 'Same as all. Change anything to give it its own.'}</p>
          {own && <button type="button" className="gv-st-link" onClick={() => onRevert(open.id)}>Use the conference awards again</button>}
        </div>
        <ul className="flex flex-col gap-2">
          {types.map((t) => {
            const on = isOn(t);
            const preset = PRESETS.get(t.key) ?? null;
            return (
              <li key={t.key} className="flex items-center gap-3 flex-wrap rounded-2xl" style={{ padding: '10px 12px', background: on ? 'linear-gradient(150deg, rgba(61,122,82,0.10), rgba(61,122,82,0.03)), #FFFFFF' : '#FFFFFF', boxShadow: on ? 'inset 0 0 0 1.5px rgba(61,122,82,0.45)' : 'inset 0 0 0 1px rgba(27,56,40,0.10)' }}>
                <Switch label={`${short(open)} gives ${t.label}`} checked={on}
                  onChange={(next) => onPatchCommittee(open.id, t.key, next ? { enabled: true, perCommittee: t.perCommittee > 0 ? t.perCommittee : (preset?.defaultCount ?? 1) } : { enabled: false })} />
                <span className="min-w-0 flex-1" style={{ fontFamily: F, fontSize: TYPE_PX.body, fontWeight: 700, color: INK, overflowWrap: 'anywhere' }}>{t.label}</span>
                {on && <Stepper label={t.label} value={Math.max(1, t.perCommittee)} onChange={(v) => onPatchCommittee(open.id, t.key, { perCommittee: v })} />}
              </li>
            );
          })}
        </ul>
        {newAwardsLine}
      </AwardsSheet>
    );
  }

  return (
    <AwardsSheet title="Awards per Committee" onClose={onClose} width={760}
      footer={<button type="button" className="gv-st-btn gv-st-forest" onClick={onClose}>Done</button>}>
      {committees === null ? (
        <p style={{ fontFamily: F, fontSize: TYPE_PX.hint, color: INK_SOFT }}>Loading committees</p>
      ) : committees.length === 0 ? (
        <p style={{ fontFamily: F, fontSize: TYPE_PX.body, color: INK_SOFT }}>Add committees first, then give them their own awards.</p>
      ) : (
        <ul className="flex flex-col gap-2" aria-label="Committees">
          {committees.map((c) => {
            const own = !!config.perCommittee[c.id];
            const list = own ? configForCommittee({ ...config, sameForAll: false }, c.id).types.filter(isOn).map((t) => t.label).join(', ') : '';
            return (
              <li key={c.id}>
                <button type="button" onClick={() => setOpenId(c.id)} className="gv-aw-row w-full flex items-center gap-3 text-left rounded-2xl">
                  <span className="min-w-0 flex-1" style={{ fontFamily: F }}>
                    <span className="block" style={{ fontSize: TYPE_PX.body, fontWeight: 800, color: INK, overflowWrap: 'anywhere' }}>{short(c)}</span>
                    {short(c) !== c.name && <span className="block" style={{ fontSize: TYPE_PX.hint, color: INK_SOFT, overflowWrap: 'anywhere' }}>{c.name}</span>}
                    <span className="mt-1 inline-flex items-center gap-1" style={{ fontSize: TYPE_PX.hint, fontWeight: 700, color: own ? AMBER : FOREST, overflowWrap: 'anywhere' }}>
                      {own ? <Award size={12} strokeWidth={2.6} aria-hidden /> : <Check size={12} strokeWidth={2.8} aria-hidden />}
                      {own ? (list || 'No awards') : 'Same as all'}
                    </span>
                  </span>
                  <ChevronRight size={18} strokeWidth={2.4} aria-hidden style={{ color: INK_SOFT, flexShrink: 0 }} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {newAwardsLine}
    </AwardsSheet>
  );
}

// ── The tab ─────────────────────────────────────────────────────────────────

export function AwardsSettings({ conference }: { conference: Conference }) {
  const { refreshConferenceQuiet } = useManage();
  const [config, setConfig] = useState<AwardsConfig>(() => getAwardsConfig(conference.awards_config));
  const [asking, setAsking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [confirmOff, setConfirmOff] = useState(false);
  const [committees, setCommittees] = useState<CommitteeLite[] | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [perOpen, setPerOpen] = useState(false);
  const [confirmSame, setConfirmSame] = useState(false);

  // ── Committees ────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = await getFreshAuthedClient();
      if (!supabase) { if (!cancelled) setCommittees([]); return; }
      const { data } = await supabase
        .from('conference_committees')
        .select('id, name, abbreviation')
        .eq('conference_id', conference.id)
        .order('name', { ascending: true });
      if (!cancelled) setCommittees((data ?? []) as CommitteeLite[]);
    })();
    return () => { cancelled = true; };
  }, [conference.id]);

  // ── Autosave ──────────────────────────────────────────────────────────
  // The latest config always wins: a save that started on an older snapshot
  // has its outcome ignored (seq), and a pending save flushes on unmount.
  const latestRef = useRef(config);
  const dirtyRef = useRef(false);
  const seqRef = useRef(0);
  const conferenceIdRef = useRef(conference.id);
  const refreshRef = useRef(refreshConferenceQuiet);
  useEffect(() => { refreshRef.current = refreshConferenceQuiet; }, [refreshConferenceQuiet]);
  useEffect(() => { conferenceIdRef.current = conference.id; }, [conference.id]);

  const persist = useCallback(async (snapshot: AwardsConfig, { silent = false } = {}) => {
    const seq = ++seqRef.current;
    if (!silent) { setSaving(true); setSaved(false); }
    const stamped: AwardsConfig = {
      ...snapshot,
      // `enabled` is stored as the set-up answer: there is no separate switch.
      enabled: snapshot.setUp,
      configuredAt: snapshot.configuredAt ?? new Date().toISOString(),
    };
    let err: string | null;
    try {
      const supabase = await getFreshAuthedClient();
      err = supabase
        ? await saveAwardsConfig(supabase, conferenceIdRef.current, stamped)
        : 'Your session has expired. Sign in again and retry.';
    } catch (e) {
      err = friendlyError(e, 'Your awards were not saved. Try again in a moment.');
    }
    if (silent || seq !== seqRef.current) return;
    setSaving(false);
    if (err) {
      notifyErr(err, 'settings-awards');
      return;
    }
    dirtyRef.current = false;
    setSaved(true);
    await refreshRef.current();
  }, []);

  const update = useCallback((patch: (c: AwardsConfig) => AwardsConfig) => {
    setConfig((c) => {
      const next = patch(c);
      latestRef.current = next;
      dirtyRef.current = true;
      return next;
    });
    setSaved(false);
  }, []);

  useEffect(() => {
    if (!dirtyRef.current) return;
    const t = setTimeout(() => { void persist(latestRef.current); }, SAVE_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [config, persist]);

  useEffect(() => () => {
    if (dirtyRef.current) void persist(latestRef.current, { silent: true });
  }, [persist]);

  // ── Answers ───────────────────────────────────────────────────────────
  const answer = (sameForAll: boolean) => {
    update((c) => ({
      ...c,
      setUp: true,
      enabled: true,
      sameForAll,
      // A conference that used the old settings screen keeps the choices it
      // made there; everyone else starts from the three placements.
      types: c.configuredAt ? c.types : freshAwardTypes(),
    }));
    setAsking(false);
  };

  const turnOff = () => {
    update((c) => ({ ...c, setUp: false, enabled: false }));
    setConfirmOff(false);
  };

  /** The conference awards (the catalogue), kept in step in every own set. */
  const setShared = (types: AwardTypeConfig[]) =>
    update((c) => ({ ...c, types, perCommittee: syncOwnSets(c.perCommittee, c.types, types) }));
  /** One committee's award: changing anything gives it its own set (a copy of
   *  the conference awards) first. */
  const patchCommittee = (id: string, key: string, patch: Partial<AwardTypeConfig>) =>
    update((c) => {
      const base = c.perCommittee[id]?.types ?? c.types.map((t) => ({ ...t }));
      return { ...c, perCommittee: { ...c.perCommittee, [id]: { types: base.map((t) => (t.key === key ? { ...t, ...patch } : t)) } } };
    });
  const revertToShared = (id: string) =>
    update((c) => {
      const rest = { ...c.perCommittee };
      delete rest[id];
      return { ...c, perCommittee: rest };
    });
  const revertAll = () => update((c) => ({ ...c, sameForAll: true, perCommittee: {} }));

  const ownCommittees = (committees ?? []).filter((c) => !!config.perCommittee[c.id]);
  const onSameSwitch = (next: boolean) => {
    if (!next) { update((c) => ({ ...c, sameForAll: false })); setPerOpen(true); return; }
    if (Object.keys(config.perCommittee).length > 0) { setConfirmSame(true); return; }
    update((c) => ({ ...c, sameForAll: true }));
  };

  // ── Derived ───────────────────────────────────────────────────────────
  const sharedCount = config.types.filter(isOn).length;

  const head = (
    <SectionHead
      emoji="Trophy" icon={Trophy} tint={TINT_GOLD_BG} title="Awards"
      line={config.setUp
        ? (config.sameForAll ? 'Every committee gives the same awards.' : 'Committees can give their own awards.')
        : 'Chairs see nothing about awards until you set them up.'}
      focal={config.setUp ? <BigCount n={sharedCount} word={sharedCount === 1 ? 'award' : 'awards'} tone="gold" /> : undefined}
    />
  );

  // 1. Blank slate
  if (!config.setUp && !asking) {
    return (
      <div className="flex flex-col gap-5">
        <style>{AWARDS_CSS}</style>
        {head}
        <div className="gv-st-card gv-fd-card relative flex flex-col items-center text-center" style={{ paddingTop: 54, paddingBottom: 30, marginTop: 26 }}>
          <span className="absolute" style={{ top: -34, left: '50%', transform: 'translateX(-50%)' }}>
            <PopDisc size={72}><Emoji3D name="Trophy" size={50} fallback={Trophy} fallbackColor={AMBER} /></PopDisc>
          </span>
          <p style={{ fontFamily: F, fontSize: 20, fontWeight: 800, color: INK }}>No awards yet</p>
          <p className="mt-1" style={{ fontFamily: F, fontSize: TYPE_PX.body, color: INK_SOFT }}>Pick the honours your committees give, then chairs can nominate.</p>
          <button type="button" className="gv-st-btn gv-st-forest mt-5" onClick={() => setAsking(true)}>Set up awards</button>
        </div>
      </div>
    );
  }

  // 2. The one question
  if (!config.setUp && asking) {
    return (
      <div className="flex flex-col gap-5">
        <style>{AWARDS_CSS}</style>
        {head}
        <div className="gv-st-card gv-fd-card">
          <h2 style={{ fontFamily: F, fontSize: 22, fontWeight: 800, color: INK, letterSpacing: '-0.01em' }}>Will every committee give the same awards?</h2>
          <p className="mt-1" style={{ fontFamily: F, fontSize: TYPE_PX.body, color: INK_SOFT }}>
            You can change this later and give any committee its own awards.
          </p>
          <div className="mt-8 grid gap-x-4 gap-y-9" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
            <button type="button" className="gv-aw-choice" onClick={() => answer(true)}>
              <span className="gv-aw-pop"><PopDisc><Emoji3D name="Trophy" size={34} fallback={Trophy} fallbackColor={AMBER} /></PopDisc></span>
              <span className="absolute" style={{ top: 12, insetInlineEnd: 14, fontFamily: F, fontSize: TYPE_PX.hint, fontWeight: 700, color: FOREST, background: 'rgba(61,122,82,0.12)', borderRadius: 999, padding: '3px 10px' }}>Recommended</span>
              <span style={{ fontFamily: F, fontSize: TYPE_PX.card, fontWeight: 800, color: INK }}>Yes, the same for all</span>
              <span style={{ fontFamily: F, fontSize: TYPE_PX.hint, color: INK_SOFT }}>One set of awards for every committee.</span>
            </button>
            <button type="button" className="gv-aw-choice" onClick={() => answer(false)}>
              <span className="gv-aw-pop"><PopDisc tint={TINT_GREEN_BG}><Emoji3D name="Card index dividers" size={34} fallback={Award} fallbackColor={FOREST} /></PopDisc></span>
              <span style={{ fontFamily: F, fontSize: TYPE_PX.card, fontWeight: 800, color: INK }}>No, set them per committee</span>
              <span style={{ fontFamily: F, fontSize: TYPE_PX.hint, color: INK_SOFT }}>Committees start the same, then change any of them.</span>
            </button>
          </div>
          <button type="button" className="gv-st-link mt-6" onClick={() => setAsking(false)}>Not now</button>
        </div>
      </div>
    );
  }

  // 3. The tab: Conference Awards and Awards per Committee on the left,
  //    Review and Publish on the right (first on a phone).
  return (
    <div className="gv-aw-wrap flex flex-col gap-5">
      <style>{AWARDS_CSS}</style>
      {head}

      <div className="gv-aw-layout">
        {/* Conference Awards, level with Review and Publish (prompt 134): the
            two share the grid's first row, each with its 3D emoji hanging over
            the top-left corner (dashboardKit's HangingDisc). */}
        <section id="conference-awards" aria-label="Conference Awards"
          className="gv-st-card gv-fd-card gv-fd-hung gv-fd-wash-gold relative min-w-0 gv-aw-a" style={{ scrollMarginTop: 140 }}>
          <HangingDisc icon={{ emoji: 'Trophy', lucide: Trophy, tint: TINT_GOLD }} side="start" />
          <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
            <h3 style={{ ...TYPE.card, margin: 0, overflowWrap: 'anywhere' }}>Conference Awards</h3>
            <button type="button" className="gv-st-btn gv-st-outline" onClick={() => setEditOpen(true)}><PenLine size={15} strokeWidth={2.4} aria-hidden />Edit awards</button>
          </div>
          <div className="gvk-rows">
            <ConferenceAwardsList types={config.types} committees={committees ?? []} />
          </div>
        </section>

        <div className="gv-aw-c flex flex-col gap-5 min-w-0">

          <Group id="awards-per-committee" title="Awards per Committee" emoji="Card index dividers" icon={Award} tint={TINT_GREEN_BG}>
            <SwitchRow
              label="Same awards for every committee"
              desc={config.sameForAll ? 'Turn off to give a committee its own awards.' : 'Committees use the conference awards until you give them their own.'}
              checked={config.sameForAll}
              onChange={onSameSwitch}
            />
            {!config.sameForAll && (
              <div className="mt-3" style={{ fontFamily: F }}>
                {ownCommittees.length === 0 ? (
                  <p style={{ fontSize: TYPE_PX.hint, color: INK_SOFT }}>
                    Every committee still uses the conference awards.{' '}
                    <button type="button" className="gv-st-link" style={{ fontSize: TYPE_PX.hint }} onClick={() => setPerOpen(true)}>Choose committees</button>
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {ownCommittees.map((c) => (
                      <li key={c.id} className="flex items-center gap-3 rounded-2xl" style={{ padding: '10px 12px', background: '#FFFFFF', boxShadow: 'inset 0 0 0 1px rgba(27,56,40,0.08)' }}>
                        <span className="min-w-0 flex-1">
                          <span className="block" style={{ fontSize: TYPE_PX.body, fontWeight: 800, color: INK, overflowWrap: 'anywhere' }}>{short(c)}</span>
                          <span className="block" style={{ fontSize: TYPE_PX.hint, color: INK_SOFT, overflowWrap: 'anywhere' }}>
                            {configForCommittee(config, c.id).types.filter(isOn).map((t) => t.label).join(', ') || 'No awards'}
                          </span>
                        </span>
                        <button type="button" className="gv-st-link" onClick={() => setPerOpen(true)}>Change</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </Group>

          <div className="flex items-center justify-between gap-3 flex-wrap" style={{ fontFamily: F }}>
            <p aria-live="polite" style={{ fontSize: TYPE_PX.hint, color: saved ? '#3D7A52' : INK_SOFT }}>
              {saving ? 'Saving' : saved ? 'Saved' : 'Changes save by themselves'}
            </p>
            {confirmOff ? (
              <span className="inline-flex items-center gap-3 flex-wrap">
                <span style={{ fontSize: TYPE_PX.hint, color: INK }}>Chairs will stop seeing awards. Turn them off?</span>
                <button type="button" className="gv-st-btn gv-st-outline" style={{ minHeight: 38 }} onClick={() => setConfirmOff(false)}>Keep awards</button>
                <button type="button" className="gv-st-link" style={{ color: '#8B2020' }} onClick={turnOff}>Turn off</button>
              </span>
            ) : (
              <button type="button" className="gv-st-link" style={{ color: INK_SOFT }} onClick={() => setConfirmOff(true)}>Turn off awards</button>
            )}
          </div>
        </div>

        {/* Chairs' slates: approve, return with a note, publish (awardsReview.tsx).
            Its two cards (.gv-rv-main, .gv-rv-pub) are items of this grid. */}
        <AwardsReview conference={conference} config={config} />
      </div>

      {editOpen && (
        <EditAwardsSheet types={config.types} committees={committees ?? []} onChange={setShared} onClose={() => setEditOpen(false)} />
      )}
      {perOpen && (
        <CommitteesSheet
          config={config}
          committees={committees}
          onPatchCommittee={patchCommittee}
          onRevert={revertToShared}
          onOpenConferenceAwards={() => { setPerOpen(false); setEditOpen(true); }}
          onClose={() => setPerOpen(false)}
        />
      )}
      {confirmSame && (
        <ConfirmModal
          title="Same Awards for Every Committee?"
          body={<p>{ownCommittees.length === 1 ? '1 committee has' : `${Math.max(ownCommittees.length, Object.keys(config.perCommittee).length)} committees have`} their own awards. They will use the conference awards again.</p>}
          confirmLabel="Use the same awards"
          cancelLabel="Keep their awards"
          onConfirm={() => { revertAll(); setConfirmSame(false); }}
          onCancel={() => setConfirmSame(false)}
        />
      )}
    </div>
  );
}
