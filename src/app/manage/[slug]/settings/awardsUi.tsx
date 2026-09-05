'use client';

// ── Settings → Awards ───────────────────────────────────────────────────────
// The organiser's half of the awards feature: which honours exist, how many
// each committee gives, what they are worth, whether the secretariat ratifies
// each slate, and when chairs must submit by. Everything here is a view over
// `conferences.awards_config` (see src/lib/awards.ts for the model and the
// vocabulary). Saves are debounced and fire-and-forget; the local state is
// the source of truth while the organiser is on the tab.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Minus, Plus, Trophy, X } from 'lucide-react';
import { useManage, type Conference } from '@/app/manage/[slug]/layout';
import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { DatePicker } from '@/components/DatePicker';
import { InfoHint, Segmented } from './applicationsUi';
import {
  awardKeyFromLabel, chairDeadline, getAwardsConfig,
  type AwardsConfig, type AwardTier, type AwardTypeConfig,
} from '@/lib/awards';
import { saveAwardsConfig } from '@/lib/awardsService';

const OUTFIT = "'Outfit', sans-serif";

// Mirrors the inner grouped sub-card on settings/page.tsx. Kept as a copy on
// purpose: the page's object is local to the page component and a Next.js
// page file cannot export it.
const cardStyle: React.CSSProperties = {
  backgroundColor: '#FFFDF9',
  border: '1.5px solid #D8CDB6',
  borderRadius: '16px',
  padding: '24px',
  marginBottom: '20px',
  boxShadow: '0 1px 2px rgba(27,56,40,0.04)',
};

const inputStyle: React.CSSProperties = {
  border: '1.5px solid #DDD4C0',
  borderRadius: '10px',
  padding: '7px 10px',
  fontFamily: OUTFIT,
  fontSize: '13px',
  color: '#1C1410',
  backgroundColor: '#FAF8F3',
  outline: 'none',
  minWidth: 0,
};

const TIER_COLOUR: Record<AwardTier, string> = {
  gold: '#B6871F',
  silver: '#7A8594',
  bronze: '#96603A',
  special: '#2A5A3C',
};

const TIER_LABEL: Record<AwardTier, string> = {
  gold: 'Gold',
  silver: 'Silver',
  bronze: 'Bronze',
  special: 'Special',
};

const SAVE_DEBOUNCE_MS = 600;

// ── Small local controls ────────────────────────────────────────────────────
// PillToggle and AutoSaveStatus are private to settings/page.tsx (a page file
// cannot export components), so this tab carries identical copies.

function PillToggle({ value, onChange, size = 'md', disabled = false }: {
  value: boolean;
  onChange: (v: boolean) => void;
  size?: 'md' | 'sm';
  disabled?: boolean;
}) {
  const w = size === 'md' ? 40 : 32;
  const h = size === 'md' ? 22 : 18;
  const thumb = size === 'md' ? 18 : 14;
  const onLeft = size === 'md' ? 20 : 16;
  return (
    <button
      type="button"
      onClick={() => { if (!disabled) onChange(!value); }}
      disabled={disabled}
      className="relative flex-shrink-0 focus:outline-none"
      style={{
        width: `${w}px`, height: `${h}px`,
        borderRadius: '9999px',
        backgroundColor: value ? '#1B3828' : '#DDD4C0',
        opacity: disabled ? 0.5 : 1,
        transition: 'background-color 200ms ease, opacity 200ms ease',
        border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      <span
        className="absolute rounded-full transition-all duration-200"
        style={{
          width: `${thumb}px`, height: `${thumb}px`,
          backgroundColor: 'white',
          top: '2px',
          left: value ? `${onLeft}px` : '2px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
        }}
      />
    </button>
  );
}

function AutoSaveStatus({ saving, saved }: { saving: boolean; saved: boolean }) {
  const text = saving ? 'Saving…' : saved ? 'Saved ✓' : 'Changes save automatically';
  return (
    <p className="text-xs mt-2 flex items-center gap-1.5" style={{ color: saved ? '#3D7A52' : '#9A8A78', fontFamily: OUTFIT }}>
      {saving && <span className="w-3 h-3 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#9A8A78', borderTopColor: 'transparent' }} />}
      {text}
    </p>
  );
}

function Stepper({ value, onChange, min = 0, max = 10, disabled = false }: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
}) {
  const btn = (Icon: typeof Minus, delta: number, blocked: boolean) => (
    <button
      type="button"
      disabled={disabled || blocked}
      onClick={() => onChange(Math.max(min, Math.min(max, value + delta)))}
      className="flex items-center justify-center focus:outline-none"
      style={{
        width: 26, height: 26, borderRadius: 8,
        backgroundColor: blocked ? 'transparent' : '#1B3828',
        color: blocked ? '#B8AE9C' : '#EED98A',
        border: blocked ? '1.5px solid #DDD4C0' : '1.5px solid #1B3828',
        cursor: disabled || blocked ? 'not-allowed' : 'pointer',
        transition: 'background-color 150ms',
      }}
    >
      <Icon size={13} strokeWidth={2.6} />
    </button>
  );
  return (
    <div className="inline-flex items-center gap-1.5">
      {btn(Minus, -1, value <= min)}
      <span
        className="text-center tabular-nums"
        style={{ minWidth: 22, fontFamily: OUTFIT, fontSize: 14, fontWeight: 800, color: '#1C1410' }}
      >
        {value}
      </span>
      {btn(Plus, 1, value >= max)}
    </div>
  );
}

function TierDot({ tier }: { tier: AwardTier }) {
  return (
    <span
      title={`${TIER_LABEL[tier]} tier`}
      aria-label={`${TIER_LABEL[tier]} tier`}
      className="inline-block flex-shrink-0 rounded-full"
      style={{ width: 10, height: 10, backgroundColor: TIER_COLOUR[tier], boxShadow: '0 0 0 2px rgba(255,255,255,0.9), 0 1px 3px rgba(27,56,40,0.25)' }}
    />
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontFamily: OUTFIT, fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', color: '#9A8A78', textTransform: 'uppercase' }}>
      {children}
    </span>
  );
}

function clampInt(raw: string, min: number, max: number, fallback: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

// ── Deadline helpers ────────────────────────────────────────────────────────

const pad2 = (n: number) => String(n).padStart(2, '0');

function localDateOf(iso: string | null): string {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function localHourOf(iso: string | null, fallback: number): number {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return fallback;
  return d.getHours();
}

/** Local date + hour → ISO instant. */
function composeDeadline(date: string, hour: number): string | null {
  const [y, m, d] = date.split('-').map(Number);
  if (!y || !m || !d) return null;
  const dt = new Date(y, m - 1, d, hour, 0, 0, 0);
  return Number.isNaN(dt.getTime()) ? null : dt.toISOString();
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function formatDeadline(d: Date): string {
  return d.toLocaleString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── The tab ─────────────────────────────────────────────────────────────────

export function AwardsSettings({ conference, onSaved }: {
  conference: Conference;
  /** Fires after each successful save, once the conference row has been re-read. */
  onSaved?: () => void;
}) {
  const { refreshConferenceQuiet } = useManage();

  const [config, setConfig] = useState<AwardsConfig>(() => getAwardsConfig(conference.awards_config));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ── Autosave ──────────────────────────────────────────────────────────
  // Every edit marks the config dirty and arms a 600 ms timer. The latest
  // config always wins: a save that started with an older snapshot has its
  // status ignored (seq check), and the pending timer flushes on unmount so
  // switching tabs inside the debounce window never drops a change.
  const latestRef = useRef(config);
  const dirtyRef = useRef(false);
  const seqRef = useRef(0);
  const configuredAtRef = useRef<string | null>(config.configuredAt);
  const conferenceIdRef = useRef(conference.id);
  const refreshRef = useRef(refreshConferenceQuiet);
  const onSavedRef = useRef(onSaved);
  useEffect(() => { refreshRef.current = refreshConferenceQuiet; }, [refreshConferenceQuiet]);
  useEffect(() => { onSavedRef.current = onSaved; }, [onSaved]);
  useEffect(() => { conferenceIdRef.current = conference.id; }, [conference.id]);

  const persist = useCallback(async (snapshot: AwardsConfig, { silent = false } = {}) => {
    const seq = ++seqRef.current;
    if (!silent) { setSaving(true); setSaved(false); setSaveError(null); }
    const stamped: AwardsConfig = {
      ...snapshot,
      configuredAt: snapshot.configuredAt ?? configuredAtRef.current ?? new Date().toISOString(),
    };
    configuredAtRef.current = stamped.configuredAt;
    let err: string | null;
    try {
      const supabase = await getFreshAuthedClient();
      err = supabase
        ? await saveAwardsConfig(supabase, conferenceIdRef.current, stamped)
        : 'Your session has expired. Sign in again and retry.';
    } catch (e) {
      err = e instanceof Error ? e.message : 'Your changes were not saved.';
    }
    if (silent || seq !== seqRef.current) return;
    setSaving(false);
    if (err) {
      setSaveError(err);
      return;
    }
    dirtyRef.current = false;
    setSaved(true);
    await refreshRef.current();
    onSavedRef.current?.();
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

  // Flush on unmount. Fire-and-forget: there is nothing left on screen to
  // report to, and the next mount re-reads the row.
  useEffect(() => () => {
    if (dirtyRef.current) void persist(latestRef.current, { silent: true });
  }, [persist]);

  // ── Derived ───────────────────────────────────────────────────────────
  const slug = conference.slug;
  const effectiveDeadline = useMemo(
    () => chairDeadline(config, conference.end_date ?? null),
    [config, conference.end_date],
  );
  const deadlineMode: 'end' | 'custom' = config.chairDeadline ? 'custom' : 'end';
  const customDate = localDateOf(config.chairDeadline);
  const customHour = localHourOf(config.chairDeadline, 18);

  const enabledCount = config.types.filter((t) => t.enabled).length;

  // ── Category edits ────────────────────────────────────────────────────
  const patchType = useCallback((key: string, patch: Partial<AwardTypeConfig>) => {
    update((c) => ({ ...c, types: c.types.map((t) => (t.key === key ? { ...t, ...patch } : t)) }));
  }, [update]);

  const removeType = useCallback((key: string) => {
    update((c) => ({ ...c, types: c.types.filter((t) => t.key !== key || t.builtin) }));
  }, [update]);

  // ── Custom award form ─────────────────────────────────────────────────
  const [newLabel, setNewLabel] = useState('');
  const [newTier, setNewTier] = useState<AwardTier>('special');
  const [newScope, setNewScope] = useState<'committee' | 'conference'>('committee');
  const [newPerCommittee, setNewPerCommittee] = useState(1);
  const [newPoints, setNewPoints] = useState(20);
  const [newError, setNewError] = useState<string | null>(null);

  const addCustom = () => {
    const label = newLabel.trim();
    if (!label) { setNewError('Give the award a name first.'); return; }
    const key = awardKeyFromLabel(label);
    if (config.types.some((t) => t.key === key)) {
      setNewError('An award with that name already exists.');
      return;
    }
    update((c) => ({
      ...c,
      types: [...c.types, {
        key,
        label,
        tier: newTier,
        scope: newScope,
        perCommittee: newScope === 'committee' ? newPerCommittee : 0,
        points: newPoints,
        enabled: true,
        builtin: false,
        description: '',
      }],
    }));
    setNewLabel('');
    setNewTier('special');
    setNewScope('committee');
    setNewPerCommittee(1);
    setNewPoints(20);
    setNewError(null);
  };

  const dimmed: React.CSSProperties = config.enabled
    ? {}
    : { opacity: 0.5, pointerEvents: 'none' };

  const sectionTitle = (text: string) => (
    <h3 className="text-sm font-bold mb-1" style={{ color: '#1C1410', fontFamily: OUTFIT }}>{text}</h3>
  );

  return (
    <>
      {/* ── a. How awards work ── */}
      <div style={cardStyle}>
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <span
              className="flex items-center justify-center flex-shrink-0"
              style={{ width: 36, height: 36, borderRadius: 11, background: 'linear-gradient(135deg, #EED98A, #B6871F)', boxShadow: '0 4px 12px rgba(182,135,31,0.28)' }}
            >
              <Trophy size={18} strokeWidth={2.2} style={{ color: '#1B3828' }} />
            </span>
            <div>
              {sectionTitle('How awards work on Gavelling')}
              <p className="text-xs" style={{ color: '#5B4F42', fontFamily: OUTFIT }}>
                Decided once per conference, announced at the closing ceremony.
              </p>
            </div>
          </div>
          <Link
            href={`/manage/${slug}/awards`}
            className="inline-flex items-center gap-1.5 flex-shrink-0 rounded-xl focus:outline-none"
            style={{
              padding: '8px 14px', backgroundColor: '#1B3828', color: '#EED98A',
              fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 800, letterSpacing: '0.06em',
              boxShadow: '0 4px 12px rgba(27,56,40,0.2)', textDecoration: 'none',
            }}
          >
            OPEN AWARDS <ArrowRight size={13} strokeWidth={2.6} />
          </Link>
        </div>
        <ol className="grid gap-3 sm:grid-cols-2" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {[
            ['You set the categories', 'Which honours exist, how many each committee gives, and what they are worth.'],
            ['Chairs nominate', 'From their conference page after the last session, with the session scoreboard beside them as evidence.'],
            ['The secretariat reviews', 'Each committee slate is checked and approved at Awards. Slates can be returned with a note.'],
            ['Publish', 'The certificates list goes out, every recipient gets a verified MUN CV entry, and Gavelling Points are minted at paid conferences.'],
          ].map(([title, body], i) => (
            <li key={title} className="flex items-start gap-3 rounded-xl" style={{ padding: '10px 12px', backgroundColor: '#FAF8F3', border: '1px solid #EDE7D8' }}>
              <span
                className="flex items-center justify-center flex-shrink-0"
                style={{ width: 24, height: 24, borderRadius: 999, backgroundColor: '#1B3828', color: '#EED98A', fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 800 }}
              >
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-bold" style={{ color: '#1C1410', fontFamily: OUTFIT }}>{title}</p>
                <p className="text-xs mt-0.5" style={{ color: '#5B4F42', fontFamily: OUTFIT, lineHeight: 1.45 }}>{body}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="text-xs mt-3" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
          Delegates never see nominations before publication.
        </p>
      </div>

      {/* ── b. Master toggle ── */}
      <div style={cardStyle}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <label className="text-xs font-semibold flex items-center gap-1.5" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
              Give awards at this conference
              <InfoHint
                label="About turning awards off"
                text="Off hides the nomination card from every chair and the Awards page stays empty. Nothing already nominated is deleted, so you can turn it back on at any time."
              />
            </label>
            <p className="text-xs mt-0.5" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
              {config.enabled
                ? `${enabledCount} categor${enabledCount === 1 ? 'y' : 'ies'} on. Chairs will be asked to nominate after their last session.`
                : 'Awards are off. Chairs will not be asked to nominate.'}
            </p>
          </div>
          <PillToggle value={config.enabled} onChange={(v) => update((c) => ({ ...c, enabled: v }))} size="md" />
        </div>
        <AutoSaveStatus saving={saving} saved={saved} />
        {saveError && (
          <p
            role="alert"
            className="text-xs mt-2 rounded-lg px-3 py-2"
            style={{ color: '#8B2020', backgroundColor: 'rgba(139,32,32,0.08)', border: '1px solid rgba(139,32,32,0.22)', fontFamily: OUTFIT }}
          >
            {saveError}
          </p>
        )}
      </div>

      {/* ── c. Categories ── */}
      <div style={{ ...cardStyle, ...dimmed }} aria-disabled={!config.enabled}>
        <div className="mb-4">
          {sectionTitle('Categories')}
          <p className="text-xs" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
            Rename any honour, set how many each committee gives, and what it is worth. Off categories are hidden from chairs.
          </p>
        </div>

        <div className="flex flex-col" style={{ gap: 10 }}>
          {config.types.map((t) => {
            const off = !t.enabled;
            return (
              <div
                key={t.key}
                className="rounded-xl"
                style={{
                  padding: '12px 14px',
                  backgroundColor: off ? '#FAF8F3' : '#FFFFFF',
                  border: `1.5px solid ${off ? '#EDE7D8' : '#DDD4C0'}`,
                  opacity: off ? 0.7 : 1,
                  transition: 'opacity 150ms, border-color 150ms',
                }}
              >
                <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                  <PillToggle value={t.enabled} onChange={(v) => patchType(t.key, { enabled: v })} size="sm" />
                  <div className="flex items-center gap-2 flex-1 min-w-0" style={{ minWidth: 200 }}>
                    <TierDot tier={t.tier} />
                    <input
                      type="text"
                      value={t.label}
                      maxLength={60}
                      aria-label="Award name"
                      onChange={(e) => patchType(t.key, { label: e.target.value })}
                      onBlur={(e) => { if (!e.target.value.trim()) patchType(t.key, { label: t.builtin ? defaultLabel(t.key) : 'Custom award' }); }}
                      className="flex-1 focus:outline-none"
                      style={{ ...inputStyle, fontWeight: 700 }}
                    />
                  </div>

                  {t.scope === 'committee' ? (
                    <div className="flex items-center gap-2">
                      <Stepper value={t.perCommittee} onChange={(v) => patchType(t.key, { perCommittee: v })} />
                      <FieldLabel>per committee</FieldLabel>
                    </div>
                  ) : (
                    <span className="text-xs" style={{ color: '#5B4F42', fontFamily: OUTFIT, fontStyle: 'italic' }}>
                      One per conference, assigned by the secretariat
                    </span>
                  )}

                  <label className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={1000}
                      value={t.points}
                      aria-label="Points"
                      onChange={(e) => patchType(t.key, { points: clampInt(e.target.value, 0, 1000, t.points) })}
                      className="focus:outline-none tabular-nums"
                      style={{ ...inputStyle, width: 74, textAlign: 'right' }}
                    />
                    <FieldLabel>points</FieldLabel>
                  </label>

                  {!t.builtin && (
                    <button
                      type="button"
                      onClick={() => removeType(t.key)}
                      aria-label={`Remove ${t.label}`}
                      className="flex items-center justify-center focus:outline-none"
                      style={{ width: 26, height: 26, borderRadius: 8, border: '1.5px solid #DDD4C0', backgroundColor: 'transparent', color: '#8B2020', cursor: 'pointer' }}
                    >
                      <X size={13} strokeWidth={2.4} />
                    </button>
                  )}
                </div>
                {(t.description || !t.builtin) && (
                  <p className="text-xs mt-2" style={{ color: '#9A8A78', fontFamily: OUTFIT, paddingLeft: 42 }}>
                    {t.description || `${TIER_LABEL[t.tier]} tier, ${t.scope === 'committee' ? 'per committee' : 'whole conference'}. Custom award.`}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* Add a custom award */}
        <div className="mt-5 rounded-xl" style={{ padding: '14px', border: '1.5px dashed #D8CDB6', backgroundColor: '#FAF8F3' }}>
          <p className="text-xs font-bold mb-3" style={{ color: '#1C1410', fontFamily: OUTFIT }}>Add a custom award</p>
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
            <label className="flex flex-col gap-1" style={{ gridColumn: 'span 2' }}>
              <FieldLabel>Name</FieldLabel>
              <input
                type="text"
                value={newLabel}
                maxLength={60}
                placeholder="e.g. Best Newcomer"
                onChange={(e) => { setNewLabel(e.target.value); setNewError(null); }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }}
                className="focus:outline-none"
                style={inputStyle}
              />
            </label>
            <label className="flex flex-col gap-1">
              <FieldLabel>Tier</FieldLabel>
              <select value={newTier} onChange={(e) => setNewTier(e.target.value as AwardTier)} className="focus:outline-none" style={inputStyle}>
                {(['gold', 'silver', 'bronze', 'special'] as AwardTier[]).map((tier) => (
                  <option key={tier} value={tier}>{TIER_LABEL[tier]}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <FieldLabel>Points</FieldLabel>
              <input
                type="number"
                min={0}
                max={1000}
                value={newPoints}
                onChange={(e) => setNewPoints(clampInt(e.target.value, 0, 1000, newPoints))}
                className="focus:outline-none tabular-nums"
                style={inputStyle}
              />
            </label>
          </div>
          <div className="flex flex-wrap items-end gap-4 mt-3">
            <div className="flex flex-col gap-1" style={{ minWidth: 260 }}>
              <FieldLabel>Scope</FieldLabel>
              <Segmented
                options={[
                  { value: 'committee' as const, label: 'PER COMMITTEE' },
                  { value: 'conference' as const, label: 'WHOLE CONFERENCE' },
                ]}
                value={newScope}
                onChange={setNewScope}
              />
            </div>
            {newScope === 'committee' && (
              <div className="flex items-center gap-2 pb-1">
                <Stepper value={newPerCommittee} onChange={setNewPerCommittee} min={1} />
                <FieldLabel>per committee</FieldLabel>
              </div>
            )}
            <button
              type="button"
              onClick={addCustom}
              className="inline-flex items-center gap-1.5 rounded-xl focus:outline-none ml-auto"
              style={{
                padding: '9px 14px', backgroundColor: '#1B3828', color: '#EED98A',
                fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 800, letterSpacing: '0.06em',
                border: 'none', cursor: 'pointer', boxShadow: '0 4px 12px rgba(27,56,40,0.2)',
              }}
            >
              <Plus size={13} strokeWidth={2.6} /> ADD AWARD
            </button>
          </div>
          {newError && (
            <p role="alert" className="text-xs mt-2" style={{ color: '#8B2020', fontFamily: OUTFIT }}>{newError}</p>
          )}
        </div>

        {/* e. Points note */}
        <p className="text-xs mt-4" style={{ color: '#5B4F42', fontFamily: OUTFIT, lineHeight: 1.5 }}>
          Points only mint at paid conferences (any delegate role with a fee). Free conferences still write the verified MUN CV entry.
        </p>
      </div>

      {/* ── d. Ratification ── */}
      <div style={{ ...cardStyle, ...dimmed }} aria-disabled={!config.enabled}>
        <div className="mb-4">{sectionTitle('Ratification')}</div>

        <div className="flex items-center justify-between gap-3">
          <div>
            <label className="text-xs font-semibold flex items-center gap-1.5" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
              Secretariat approves each slate before publishing
              <InfoHint
                label="About ratification"
                text="With this on, a committee's nominations only go out once someone on the secretariat has approved them at Awards. You can return a slate to its chairs with a note."
              />
            </label>
            <p className="text-xs mt-0.5" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
              Off: publishing announces every chair nomination as submitted.
            </p>
          </div>
          <PillToggle value={config.requireApproval} onChange={(v) => update((c) => ({ ...c, requireApproval: v }))} size="md" />
        </div>

        <div className="mt-6">
          <label className="text-xs font-semibold flex items-center gap-1.5 mb-2" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
            Chair deadline
            <InfoHint
              label="About the chair deadline"
              text="Chairs see this on their nomination card. It is a reminder, not a lock: slates are only locked once approved or published."
            />
          </label>
          <div style={{ maxWidth: 420 }}>
            <Segmented
              options={[
                { value: 'end' as const, label: 'CONFERENCE END DATE' },
                { value: 'custom' as const, label: 'CUSTOM' },
              ]}
              value={deadlineMode}
              onChange={(mode) => {
                if (mode === 'end') {
                  update((c) => ({ ...c, chairDeadline: null }));
                } else {
                  update((c) => ({
                    ...c,
                    chairDeadline: c.chairDeadline ?? composeDeadline(conference.end_date || todayIso(), 18),
                  }));
                }
              }}
            />
          </div>

          {deadlineMode === 'custom' && (
            <div className="flex flex-wrap items-end gap-3 mt-3">
              <div className="flex flex-col gap-1" style={{ minWidth: 220 }}>
                <FieldLabel>Date</FieldLabel>
                <DatePicker
                  value={customDate}
                  onChange={(iso) => {
                    if (!iso) return;
                    update((c) => ({ ...c, chairDeadline: composeDeadline(iso, customHour) }));
                  }}
                  placeholder="Pick a date"
                />
              </div>
              <label className="flex flex-col gap-1">
                <FieldLabel>Hour</FieldLabel>
                <select
                  value={customHour}
                  onChange={(e) => {
                    const h = Number(e.target.value);
                    update((c) => ({ ...c, chairDeadline: composeDeadline(customDate || conference.end_date || todayIso(), h) }));
                  }}
                  className="focus:outline-none tabular-nums"
                  style={{ ...inputStyle, width: 88 }}
                >
                  {Array.from({ length: 24 }, (_, h) => (
                    <option key={h} value={h}>{pad2(h)}:00</option>
                  ))}
                </select>
              </label>
            </div>
          )}

          <p className="text-xs mt-3" style={{ color: '#5B4F42', fontFamily: OUTFIT }}>
            {effectiveDeadline
              ? <>Chairs must submit by <strong style={{ color: '#1C1410' }}>{formatDeadline(effectiveDeadline)}</strong> (your local time).</>
              : 'No deadline yet: set the conference dates, or pick a custom date above.'}
          </p>
        </div>
      </div>
    </>
  );
}

/** The canonical English label for a built-in key, used when a rename is cleared. */
function defaultLabel(key: string): string {
  const found = getAwardsConfig({}).types.find((t) => t.key === key);
  return found?.label ?? 'Award';
}
