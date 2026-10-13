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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Award, Check, Minus, Plus, Trophy, X } from 'lucide-react';
import { useManage, type Conference } from '@/app/manage/[slug]/layout';
import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { Emoji3D } from '@/components/neu';
import {
  AWARD_PRESET_GROUPS, awardKeyFromLabel, freshAwardTypes, getAwardsConfig,
  type AwardPreset, type AwardsConfig, type AwardTypeConfig,
} from '@/lib/awards';
import { saveAwardsConfig } from '@/lib/awardsService';
import { friendlyError } from '@/lib/friendlyError';
import { notifyErr } from '@/lib/appNotify';
import { committeeDisplayName } from '@/lib/presetNames';
import {
  F, INK, INK_SOFT, FOREST, GOLD, AMBER, INPUT,
  SectionHead, Switch, EmojiDisc, BigCount, TINT_GOLD_BG, TINT_GREEN_BG, TYPE_PX
} from './panelKit';
import { AwardsReview } from './awardsReview';

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
.gv-aw-chip[aria-pressed="true"]{background:${FOREST};color:${GOLD}}
.gv-aw-chip:focus{outline:none}
.gv-aw-chip:focus-visible{outline:2px solid ${FOREST};outline-offset:2px}
.gv-aw-com{display:flex;flex-direction:column;align-items:flex-start;gap:2px;text-align:start;border:none;cursor:pointer;
  min-width:150px;max-width:240px;border-radius:14px;padding:10px 12px;background:#FFFFFF;
  box-shadow:inset 0 0 0 1.5px rgba(27,56,40,0.12)}
.gv-aw-com[aria-pressed="true"]{box-shadow:inset 0 0 0 2px ${FOREST},0 10px 22px -18px rgba(27,56,40,0.6);background:linear-gradient(160deg,rgba(61,122,82,0.08),rgba(61,122,82,0.02)),#FFFFFF}
.gv-aw-com:focus{outline:none}
.gv-aw-com:focus-visible{outline:2px solid ${FOREST};outline-offset:2px}
@media (prefers-reduced-motion: reduce){.gv-aw-card,.gv-aw-choice{transition:none}}
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

// ── One set of awards (shared, or one committee's own) ─────────────────────

function AwardSetEditor({ types, onChange }: { types: AwardTypeConfig[]; onChange: (next: AwardTypeConfig[]) => void }) {
  const byKey = useMemo(() => new Map(types.map((t) => [t.key, t])), [types]);
  const customs = types.filter((t) => !t.builtin && t.scope === 'committee');
  const [newName, setNewName] = useState('');
  const [addError, setAddError] = useState('');

  const patch = (key: string, p: Partial<AwardTypeConfig>) =>
    onChange(types.map((t) => (t.key === key ? { ...t, ...p } : t)));

  const addCustom = () => {
    const label = newName.replace(/\s+/g, ' ').trim().slice(0, MAX_LABEL);
    if (!label) { setAddError('Type a name for the award.'); return; }
    let key = awardKeyFromLabel(label);
    if (types.some((t) => t.label.toLowerCase() === label.toLowerCase())) { setAddError('You already have an award with that name.'); return; }
    let n = 2;
    while (types.some((t) => t.key === key)) key = `${awardKeyFromLabel(label)}-${n++}`;
    onChange([...types, {
      key, label, tier: 'special', scope: 'committee', perCommittee: 1, points: 0,
      enabled: true, builtin: false, description: '',
    }]);
    setNewName('');
    setAddError('');
  };

  return (
    <div className="flex flex-col gap-5">
      {AWARD_PRESET_GROUPS.map((g) => (
        <section key={g.id} className="gv-st-card gv-fd-card" aria-label={g.title}
          style={{ background: g.id === 'placements'
            ? 'radial-gradient(120% 90% at 100% 0%, rgba(238,217,138,0.28) 0%, rgba(238,217,138,0) 55%), #FFFFFF'
            : 'radial-gradient(120% 90% at 100% 0%, rgba(61,122,82,0.09) 0%, rgba(61,122,82,0) 55%), #FFFFFF' }}>
          <h2 style={{ fontFamily: F, fontSize: TYPE_PX.card, fontWeight: 800, color: INK, letterSpacing: '-0.01em' }}>{g.title}</h2>
          <div className="gv-aw-grid">
            {g.presets.map((p) => {
              const t = byKey.get(p.key);
              return t ? <AwardCard key={p.key} type={t} preset={p} onPatch={(x) => patch(p.key, x)} /> : null;
            })}
          </div>
        </section>
      ))}

      <section className="gv-st-card gv-fd-card" aria-label="Custom awards"
        style={{ background: 'radial-gradient(120% 90% at 100% 0%, rgba(238,217,138,0.22) 0%, rgba(238,217,138,0) 55%), #FFFFFF' }}>
        <h2 style={{ fontFamily: F, fontSize: TYPE_PX.card, fontWeight: 800, color: INK, letterSpacing: '-0.01em' }}>Custom awards</h2>
        {customs.length > 0 && (
          <div className="gv-aw-grid">
            {customs.map((t) => (
              <AwardCard key={t.key} type={t} preset={null}
                onPatch={(x) => patch(t.key, x)}
                onRemove={() => onChange(types.filter((x) => x.key !== t.key))} />
            ))}
          </div>
        )}
        <form
          className="mt-5 flex flex-wrap items-end gap-3"
          onSubmit={(e) => { e.preventDefault(); addCustom(); }}
        >
          <span className="shrink-0" style={{ marginBottom: 2 }}><TrophyQuestion size={40} /></span>
          <div className="min-w-0" style={{ flex: '1 1 220px' }}>
            <label htmlFor="aw-new-custom" style={{ fontFamily: F, fontSize: TYPE_PX.hint, fontWeight: 600, color: INK_SOFT }}>Name your own award</label>
            <input
              id="aw-new-custom"
              value={newName}
              maxLength={MAX_LABEL}
              placeholder="Best Crisis Response"
              onChange={(e) => { setNewName(e.target.value); if (addError) setAddError(''); }}
              aria-describedby={addError ? 'aw-new-custom-err' : undefined}
              style={{ ...INPUT, width: '100%', minHeight: 44, fontSize: TYPE_PX.body, marginTop: 4 }}
            />
          </div>
          <button type="submit" className="gv-st-btn gv-st-forest">
            <Plus size={16} strokeWidth={2.6} aria-hidden />Add award
          </button>
          {addError && <p id="aw-new-custom-err" role="alert" className="w-full" style={{ fontFamily: F, fontSize: TYPE_PX.hint, color: '#8B2020' }}>{addError}</p>}
        </form>
      </section>
    </div>
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
  /** null = the shared set; otherwise a conference_committee id. */
  const [editing, setEditing] = useState<string | null>(null);

  // ── Committees (for the per-committee picker) ─────────────────────────
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
    setEditing(null);
  };

  const turnOff = () => {
    update((c) => ({ ...c, setUp: false, enabled: false }));
    setConfirmOff(false);
    setEditing(null);
  };

  const setShared = (types: AwardTypeConfig[]) => update((c) => ({ ...c, types }));
  const setOwn = (id: string, types: AwardTypeConfig[]) =>
    update((c) => ({ ...c, perCommittee: { ...c.perCommittee, [id]: { types } } }));
  const giveOwn = (id: string) =>
    update((c) => ({ ...c, perCommittee: { ...c.perCommittee, [id]: { types: c.types.map((t) => ({ ...t })) } } }));
  const revertToShared = (id: string) =>
    update((c) => {
      const rest = { ...c.perCommittee };
      delete rest[id];
      return { ...c, perCommittee: rest };
    });

  // ── Derived ───────────────────────────────────────────────────────────
  const countOn = (types: AwardTypeConfig[]) =>
    types.filter((t) => t.enabled && t.scope === 'committee' && t.perCommittee > 0).length;
  const sharedCount = countOn(config.types);
  const ownCount = config.sameForAll ? 0 : (committees ?? []).filter((c) => config.perCommittee[c.id]).length;
  const editingCommittee = editing ? (committees ?? []).find((c) => c.id === editing) ?? null : null;
  const editingOwn = !!(editing && config.perCommittee[editing]);

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

  // 3. The editor
  return (
    <div className="flex flex-col gap-5">
      <style>{AWARDS_CSS}</style>
      {head}

      <div className="gv-st-card gv-fd-card">
        <div className="flex items-center gap-3.5">
          <div className="flex items-center gap-3.5 min-w-0">
            <EmojiDisc emoji="Card index dividers" icon={Award} tint={TINT_GREEN_BG} size={40} />
            <Switch
              label="Same awards for every committee"
              checked={config.sameForAll}
              onChange={(next) => { update((c) => ({ ...c, sameForAll: next })); if (next) setEditing(null); }}
            />
            <div className="min-w-0">
              <p style={{ fontFamily: F, fontSize: TYPE_PX.body, fontWeight: 700, color: INK }}>Same awards for every committee</p>
              <p style={{ fontFamily: F, fontSize: TYPE_PX.hint, color: INK_SOFT }}>
                {config.sameForAll ? 'Turn off to give a committee its own awards.' : 'Each committee uses the shared awards until you give it its own.'}
              </p>
            </div>
          </div>
        </div>

        {!config.sameForAll && (
          <div className="mt-4">
            <p style={{ fontFamily: F, fontSize: TYPE_PX.hint, fontWeight: 600, color: INK_SOFT }}>
              Editing{ownCount > 0 ? ` · ${ownCount} with their own awards` : ''}
            </p>
            <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Which awards you are editing">
              <button type="button" className="gv-aw-com" aria-pressed={editing === null} onClick={() => setEditing(null)}>
                <span style={{ fontFamily: F, fontSize: TYPE_PX.body, fontWeight: 800, color: INK }}>All committees</span>
                <span style={{ fontFamily: F, fontSize: TYPE_PX.hint, color: INK_SOFT }}>The shared awards</span>
              </button>
              {committees === null && (
                <span style={{ fontFamily: F, fontSize: TYPE_PX.hint, color: INK_SOFT, alignSelf: 'center' }}>Loading committees</span>
              )}
              {(committees ?? []).map((c) => {
                const short = committeeDisplayName(c.name, c.abbreviation);
                const own = !!config.perCommittee[c.id];
                return (
                  <button key={c.id} type="button" className="gv-aw-com" aria-pressed={editing === c.id} onClick={() => setEditing(c.id)}>
                    <span style={{ fontFamily: F, fontSize: TYPE_PX.body, fontWeight: 800, color: INK, overflowWrap: 'anywhere' }}>{short}</span>
                    {short !== c.name && <span style={{ fontFamily: F, fontSize: 11.5, color: INK_SOFT, overflowWrap: 'anywhere' }}>{c.name}</span>}
                    <span className="inline-flex items-center gap-1 mt-1" style={{ fontFamily: F, fontSize: TYPE_PX.hint, fontWeight: 700, color: own ? AMBER : FOREST }}>
                      {own ? <Award size={12} strokeWidth={2.6} aria-hidden /> : <Check size={12} strokeWidth={2.8} aria-hidden />}
                      {own ? 'Own awards' : 'Same as all'}
                    </span>
                  </button>
                );
              })}
              {committees !== null && committees.length === 0 && (
                <span style={{ fontFamily: F, fontSize: TYPE_PX.hint, color: INK_SOFT, alignSelf: 'center' }}>Add committees first, then give them their own awards.</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* The set being edited */}
      {editing && editingCommittee && !editingOwn ? (
        <div className="gv-st-card gv-fd-card flex items-center justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <p style={{ fontFamily: F, fontSize: 16, fontWeight: 800, color: INK, overflowWrap: 'anywhere' }}>
              {committeeDisplayName(editingCommittee.name, editingCommittee.abbreviation)} uses the shared awards
            </p>
            <p style={{ fontFamily: F, fontSize: TYPE_PX.hint, color: INK_SOFT }}>
              {sharedCount === 0 ? 'No awards switched on yet.' : `${sharedCount} ${sharedCount === 1 ? 'award' : 'awards'}, the same as every other committee.`}
            </p>
          </div>
          <button type="button" className="gv-st-btn gv-st-forest" onClick={() => giveOwn(editingCommittee.id)}>Give it its own awards</button>
        </div>
      ) : editing && editingOwn ? (
        <>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p style={{ fontFamily: F, fontSize: TYPE_PX.body, fontWeight: 700, color: INK, overflowWrap: 'anywhere' }}>
              Awards for {editingCommittee ? committeeDisplayName(editingCommittee.name, editingCommittee.abbreviation) : 'this committee'}
            </p>
            <button type="button" className="gv-st-link" onClick={() => revertToShared(editing)}>Use the shared awards again</button>
          </div>
          <AwardSetEditor types={config.perCommittee[editing].types} onChange={(t) => setOwn(editing, t)} />
        </>
      ) : (
        <AwardSetEditor types={config.types} onChange={setShared} />
      )}

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

      {/* Chairs' slates: approve, return with a note, publish (awardsReview.tsx). */}
      <AwardsReview conference={conference} config={config} />
    </div>
  );
}
