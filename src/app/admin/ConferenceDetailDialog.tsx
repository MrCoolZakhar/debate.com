'use client';

// /admin → Conferences → one conference, as a pop-up.
//
// Opened by clicking a row. It reads admin_conference_detail() and offers the
// three staff actions: edit the key details, email the organisers, delete the
// conference. Every write is a SECURITY DEFINER function that raises unless
// is_platform_admin() (migration admin_conference_detail_edit_delete_email):
//
//   • admin_update_conference(id, patch)   whitelisted fields only; the publish
//     payment gate still applies, and the checkmark is refreshed afterwards.
//   • admin_email_conference_organisers()  one email_outbox row per organiser,
//     conference_id NULL (a platform email, so it never lands in the
//     organisers' own outbox), reply_to wearegavelling@gmail.com. The insert
//     trigger renders it and suppresses unsubscribed addresses.
//   • admin_delete_conference(id, name)    re-checks the typed name on the
//     server, deletes the conference (everything under it cascades) and its
//     live session rooms, which would otherwise never expire.
//
// Nothing here is a permission. Hiding this dialog from a non-staff reader is
// a courtesy; the functions are the boundary.

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight, Building2, CalendarClock, Check, Gavel, Globe, History, LayoutTemplate, Link2,
  Mail, MapPin, PencilLine, Rocket, Send, Ticket, Trash2, Users, Wallet, X, AlertTriangle,
  FileText, BadgeCheck, CreditCard, Armchair, Target,
} from 'lucide-react';
import GrowDialog from '@/components/GrowDialog';
import Loader from '@/components/Loader';
import Avatar from '@/components/Avatar';
import { LogoDisc } from '@/components/LogoDisc';
import { CircleFlag } from '@/components/CircleFlag';
import { DatePicker } from '@/components/DatePicker';
import VerifiedCheck, { VERIFIED_BLUE } from '@/components/VerifiedCheck';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { useScrollLock } from '@/hooks/useScrollLock';
import { NEU, OUTFIT, EASE } from '@/components/neu';
import { NUM, RED, fmtDate, int } from './staffBits';
import { isPastConference } from './conferenceDates';

// ── Palette (docs/ui-audit/00-DESIGN-RULEBOOK.md §3) ────────────────────────
// Flat, bordered, coloured. No raised neumorphic tiles: the owner moved away
// from one bubble per fact (rulebook §7, Disliked).
const C = {
  forest: '#1B3828', forestMid: '#2A5A3C', forestLight: '#3D7A52',
  gold: '#EED98A', goldDeep: '#B6871F', amber: '#B8844A',
  ivory: '#EDE7D8', cream: '#FAF8F3', parchment: '#DDD4C0', track: '#E6DECB',
  ink: '#1C1410', inkSoft: '#5E5145', sky: '#4A7896', plum: '#8A6BA0',
} as const;

export interface ConferenceDetail {
  conference: {
    id: string; slug: string; full_name: string; acronym: string;
    start_date: string | null; end_date: string | null; dates_tbd: boolean;
    city: string; country: string; format: string | null;
    contact_email: string | null; website_url: string | null;
    expected_delegates: number;
    is_public: boolean; status: string; published_at: string | null;
    is_verified: boolean; verified_at: string | null; is_demo: boolean;
    logo_url: string | null;
    payment_method: string | null; connect_onboarding_status: string | null;
    created_at: string; updated_at: string;
  };
  /** The seven stages of conference_setup_status() that are ALSO its seven
   *  verification keys (v_ver_keys). setup_total is 7 as well today; the list
   *  is filtered to verification_keys so the ring means "distance from the
   *  blue checkmark" even if a non-criterion step is ever added again. */
  setup: {
    items: { key: string; title: string; done: boolean; todo: string }[];
    seat_capacity: number; required_seats: number; minutes_left: number;
  };
  organisers: {
    user_id: string; display_name: string | null; email: string | null;
    avatar_url: string | null; role: string; is_owner: boolean;
  }[];
  counts: {
    applications: number; submitted: number; accepted: number; rejected: number; withdrawn: number;
    paid: number; allocations: number; committees: number; live_sessions: number; invoices: number;
  };
  fees: { role: string; amount: number; currency: string }[];
}
type Detail = ConferenceDetail;

type Pane = 'overview' | 'edit' | 'email' | 'delete';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** `date` columns: read the string's own parts, never through Date. */
function dayLabel(iso: string | null): string | null {
  const m = iso ? /^(\d{4})-(\d{2})-(\d{2})/.exec(iso) : null;
  return m ? `${+m[3]} ${MONTHS[+m[2] - 1]} ${m[1]}` : null;
}

function datesLabel(c: Detail['conference']): string {
  if (c.dates_tbd) return 'Dates to be decided';
  const s = dayLabel(c.start_date);
  const e = dayLabel(c.end_date);
  if (!s && !e) return 'No dates set';
  if (s && e && c.start_date !== c.end_date) return `${s} to ${e}`;
  return s ?? e ?? '';
}

function roleLabel(role: string): string {
  return role.replace(/[-_]/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase());
}

function feeLabel(amount: number, currency: string): string {
  const n = Number(amount) || 0;
  if (n === 0) return 'Free';
  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: currency || 'USD', maximumFractionDigits: 2 }).format(n);
  } catch {
    return `${n} ${currency}`;
  }
}

/** supabase-js error → the sentence the function raised, without the noise. */
function errText(e: { message?: string } | null | undefined, fallback: string): string {
  const m = e?.message?.trim();
  return m ? m.replace(/^.*?ERROR:\s*/, '') : fallback;
}

const pct = (n: number, of: number) => (of > 0 ? Math.round((n / of) * 100) : 0);

const STAGE_ICON: Record<string, typeof Globe> = {
  page: LayoutTemplate, committees: Building2, chairs: Gavel, email: Mail,
  secretariat: Users, financials: Wallet, publish: Rocket,
};
/** The organiser's checklist titles are imperative ("Invite chairs"); the
 *  staff view names the stage. */
const STAGE_LABEL: Record<string, string> = {
  page: 'Conference page', committees: 'Committees and seats', chairs: 'Chairs on the dais',
  email: 'Applicant emails', secretariat: 'Secretariat', financials: 'Payment method', publish: 'Published',
};

// ── The verification ring ──────────────────────────────────────────────────

function StageRing({ done, total, verified }: { done: number; total: number; verified: boolean }) {
  const size = 124, stroke = 12, r = (size - stroke) / 2, circ = 2 * Math.PI * r;
  const frac = total > 0 ? Math.min(1, done / total) : 0;
  const colour = verified ? VERIFIED_BLUE : frac >= 0.7 ? C.forestLight : frac >= 0.4 ? C.goldDeep : C.amber;
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.track} strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={colour} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={`${circ * frac} ${circ}`}
          style={{ transition: `stroke-dasharray 600ms ${EASE}` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span style={{ fontFamily: OUTFIT, fontSize: 30, fontWeight: 900, color: C.ink, lineHeight: 1, letterSpacing: '-0.03em', ...NUM }}>
          {done}<span style={{ color: C.inkSoft, fontWeight: 700, fontSize: 20 }}>/{total}</span>
        </span>
        <span style={{ fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 700, color: C.inkSoft, marginTop: 3 }}>stages</span>
      </div>
    </div>
  );
}

// ── The delegate funnel ────────────────────────────────────────────────────

function Funnel({ detail }: { detail: Detail }) {
  const k = detail.counts;
  const expected = Number(detail.conference.expected_delegates) || 0;
  const seats = detail.setup.seat_capacity || 0;
  const scale = Math.max(expected, seats, k.applications, 1);
  const target = expected || seats;
  const steps = [
    { key: 'applied', label: 'Applied', value: k.applications, colour: C.sky, icon: FileText },
    { key: 'accepted', label: 'Accepted', value: k.accepted, colour: C.forestLight, icon: BadgeCheck },
    { key: 'paid', label: 'Paid', value: k.paid, colour: C.goldDeep, icon: CreditCard },
    { key: 'placed', label: 'Placed in a seat', value: k.allocations, colour: C.plum, icon: Armchair },
  ];
  const markers: { at: number; label: string; colour: string }[] = [];
  if (expected > 0) markers.push({ at: expected, label: `Expected ${int(expected)}`, colour: C.goldDeep });
  if (seats > 0 && seats !== expected) markers.push({ at: seats, label: `Seats ${int(seats)}`, colour: C.forest });

  return (
    <section aria-labelledby="adm-funnel">
      <div className="flex items-end gap-3 flex-wrap mb-1">
        <h3 id="adm-funnel" style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 800, color: C.forest }}>Delegates</h3>
        <span className="ml-auto" style={{ fontFamily: OUTFIT, fontSize: 12, color: C.inkSoft }}>
          {expected > 0 ? <>Expecting <strong style={{ color: C.ink }}>{int(expected)}</strong></> : 'No expected number set'}
          {seats > 0 && <> · <strong style={{ color: C.ink }}>{int(seats)}</strong> seats</>}
        </span>
      </div>
      <p style={{ fontFamily: OUTFIT, color: C.ink, lineHeight: 1 }}>
        <span style={{ fontSize: 44, fontWeight: 900, letterSpacing: '-0.03em', ...NUM }}>{int(k.applications)}</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: C.inkSoft, marginLeft: 8 }}>
          {k.applications === 1 ? 'application' : 'applications'}
          {target > 0 && k.applications > 0 && <>, {pct(k.applications, target)}% of {expected ? 'the target' : 'the seats'}</>}
        </span>
      </p>
      {k.applications === 0 && (
        <p className="mt-1.5" style={{ fontFamily: OUTFIT, fontSize: 12.5, color: C.inkSoft }}>
          Nobody has applied yet.{target > 0 ? ` The bars fill toward ${int(target)}.` : ''}
        </p>
      )}

      <div className="mt-4 flex flex-col" style={{ gap: 11 }}>
        {steps.map((st, i) => {
          const prev = i === 0 ? null : steps[i - 1].value;
          const Icon = st.icon;
          const w = (st.value / scale) * 100;
          return (
            <div key={st.key} className="grid items-center" style={{ gridTemplateColumns: '132px 1fr 88px', gap: 12 }}>
              <span className="inline-flex items-center gap-2 min-w-0">
                <span className="inline-flex items-center justify-center flex-shrink-0" style={{ width: 24, height: 24, borderRadius: 999, background: st.colour }}>
                  <Icon size={13} strokeWidth={2.4} style={{ color: '#FFFFFF' }} aria-hidden />
                </span>
                <span className="truncate" style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 700, color: C.ink }}>{st.label}</span>
              </span>
              <div className="relative" style={{ height: 14, borderRadius: 999, background: C.track }}>
                <div style={{
                  position: 'absolute', insetInlineStart: 0, top: 0, bottom: 0, width: `${Math.max(w, st.value > 0 ? 2 : 0)}%`,
                  borderRadius: 999, background: `linear-gradient(90deg, ${st.colour}CC, ${st.colour})`,
                  transition: `width 600ms ${EASE}`,
                }} />
                {markers.map(m => (
                  <span key={m.label} aria-hidden style={{
                    position: 'absolute', top: -4, bottom: -4, width: 2, borderRadius: 2,
                    insetInlineStart: `calc(${(m.at / scale) * 100}% - 1px)`, background: m.colour, opacity: 0.8,
                  }} />
                ))}
              </div>
              <span className="text-end" style={{ fontFamily: OUTFIT, ...NUM }}>
                <span style={{ fontSize: 17, fontWeight: 900, color: C.ink }}>{int(st.value)}</span>
                <span
                  title={prev === null ? `Share of the ${expected ? 'expected delegates' : 'seats'}` : `Share of ${steps[i - 1].label.toLowerCase()}`}
                  style={{ fontSize: 11, fontWeight: 700, color: st.value > 0 ? st.colour : C.inkSoft, marginInlineStart: 6 }}
                >
                  {prev === null
                    ? (target > 0 ? `${pct(st.value, target)}%` : '')
                    : `${pct(st.value, prev)}%`}
                </span>
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-4 flex-wrap mt-3" style={{ fontFamily: OUTFIT, fontSize: 11, color: C.inkSoft }}>
        {markers.map(m => (
          <span key={m.label} className="inline-flex items-center gap-1.5">
            <span aria-hidden style={{ width: 2, height: 12, background: m.colour, borderRadius: 2 }} />
            {m.label}
          </span>
        ))}
      </div>
      {(k.submitted > 0 || k.rejected > 0 || k.withdrawn > 0) && (
        <p className="mt-2" style={{ fontFamily: OUTFIT, fontSize: 12, color: C.inkSoft }}>
          <strong style={{ color: C.ink }}>{int(k.submitted)}</strong> waiting for a decision ·{' '}
          <strong style={{ color: RED }}>{int(k.rejected)}</strong> rejected ·{' '}
          <strong style={{ color: C.ink }}>{int(k.withdrawn)}</strong> withdrawn
        </p>
      )}
    </section>
  );
}

// ── Typographic fact rows ──────────────────────────────────────────────────

function FactRow({ icon: Icon, tint, label, children }: { icon: typeof Globe; tint: string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3" style={{ padding: '9px 0', borderTop: `1px solid ${C.parchment}` }}>
      <Icon size={16} strokeWidth={2.2} style={{ color: tint, flexShrink: 0, marginTop: 1 }} aria-hidden />
      <div className="min-w-0 flex-1">
        <p style={{ fontFamily: OUTFIT, fontSize: 11, fontWeight: 600, color: C.inkSoft }}>{label}</p>
        <div className="break-words" style={{ fontFamily: OUTFIT, fontSize: 13.5, fontWeight: 700, color: C.ink, ...NUM }}>{children}</div>
      </div>
    </div>
  );
}

// ── Buttons and fields (flat, bordered) ────────────────────────────────────

/** Icon first, the word small beneath (rulebook §7, Liked). */
function ToolButton({ icon: Icon, label, onClick, on, danger }: {
  icon: typeof Globe; label: string; onClick: () => void; on: boolean; danger?: boolean;
}) {
  const accent = danger ? RED : C.forest;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className="inline-flex flex-col items-center justify-center focus:outline-none focus-visible:ring-2 transition-transform active:scale-[0.97]"
      style={{
        width: 76, height: 58, gap: 4, borderRadius: 14, cursor: 'pointer',
        border: `1.5px solid ${on ? accent : C.parchment}`,
        background: on ? accent : C.cream,
        color: on ? (danger ? '#FFFFFF' : C.gold) : accent,
        transition: `background 160ms ${EASE}, border-color 160ms ${EASE}, color 160ms ${EASE}`,
      }}
    >
      <Icon size={20} strokeWidth={2.2} aria-hidden />
      <span style={{ fontFamily: OUTFIT, fontSize: 11, fontWeight: 700 }}>{label}</span>
    </button>
  );
}

function ActionButton({
  icon: Icon, label, onClick, on, danger, disabled, type = 'button',
}: {
  icon: typeof Globe; label: string; onClick?: () => void; on?: boolean; danger?: boolean;
  disabled?: boolean; type?: 'button' | 'submit';
}) {
  const accent = danger ? RED : C.forest;
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 focus:outline-none focus-visible:ring-2"
      style={{
        padding: '8px 15px', borderRadius: 999, border: `1.5px solid ${on ? accent : C.parchment}`,
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
        background: on ? accent : C.cream,
        color: on ? (danger ? '#FFFFFF' : C.gold) : accent,
        fontFamily: OUTFIT, fontSize: 12, fontWeight: 800,
      }}
    >
      <Icon size={14} strokeWidth={2.4} aria-hidden />
      {label}
    </button>
  );
}

const fieldStyle: React.CSSProperties = {
  width: '100%', borderRadius: 12, padding: '9px 12px',
  backgroundColor: '#FFFFFF', border: `1.5px solid ${C.parchment}`, color: C.ink,
  fontFamily: OUTFIT, fontSize: 13, outline: 'none',
};

function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <label className={wide ? 'sm:col-span-2 block' : 'block'}>
      <span className="block mb-1.5" style={{ fontFamily: OUTFIT, fontSize: 11, fontWeight: 700, color: C.inkSoft }}>{label}</span>
      {children}
    </label>
  );
}

// ── Edit ────────────────────────────────────────────────────────────────────

interface Draft {
  full_name: string; acronym: string; start_date: string; end_date: string; dates_tbd: boolean;
  city: string; country: string; contact_email: string; website_url: string;
  expected_delegates: string; is_public: boolean;
}

function draftOf(c: Detail['conference']): Draft {
  return {
    full_name: c.full_name ?? '', acronym: c.acronym ?? '',
    start_date: c.start_date ?? '', end_date: c.end_date ?? '', dates_tbd: !!c.dates_tbd,
    city: c.city ?? '', country: c.country ?? '', contact_email: c.contact_email ?? '',
    website_url: c.website_url ?? '', expected_delegates: String(c.expected_delegates ?? 0),
    is_public: !!c.is_public,
  };
}

function EditPane({
  detail, onSaved, onCancel,
}: { detail: Detail; onSaved: (d: Detail) => void; onCancel: () => void }) {
  const { session } = useAuth();
  const base = useMemo(() => draftOf(detail.conference), [detail]);
  const [d, setD] = useState<Draft>(base);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD(prev => ({ ...prev, [k]: v }));

  const patch = useMemo(() => {
    const p: Record<string, unknown> = {};
    (Object.keys(d) as (keyof Draft)[]).forEach(k => {
      if (d[k] === base[k]) return;
      if (k === 'expected_delegates') p[k] = Number(d[k]);
      else if (k === 'start_date' || k === 'end_date') p[k] = d[k] || null;
      else p[k] = d[k];
    });
    return p;
  }, [d, base]);
  const changed = Object.keys(patch).length > 0;

  const localError =
    !d.full_name.trim() ? 'The name cannot be empty.'
    : !d.acronym.trim() ? 'The acronym cannot be empty.'
    : !d.contact_email.trim() ? 'The contact email cannot be empty.'
    : !/^\d+$/.test(d.expected_delegates.trim()) ? 'Expected delegates must be a whole number.'
    : d.start_date && d.end_date && d.end_date < d.start_date ? 'The end date is before the start date.'
    : null;

  async function save() {
    if (!session || !changed || localError) return;
    setSaving(true);
    setError(null);
    const supabase = getAuthedClient(session.access_token);
    const { data, error: e } = await supabase.rpc('admin_update_conference', {
      p_conference_id: detail.conference.id, p_patch: patch,
    });
    setSaving(false);
    if (e || !data) { setError(errText(e, 'Not saved. Try again.')); return; }
    onSaved(data as Detail);
  }

  return (
    <form onSubmit={e => { e.preventDefault(); void save(); }}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Full name" wide>
          <input value={d.full_name} onChange={e => set('full_name', e.target.value)} style={fieldStyle} />
        </Field>
        <Field label="Acronym">
          <input value={d.acronym} onChange={e => set('acronym', e.target.value)} style={fieldStyle} />
        </Field>
        <Field label="Expected delegates">
          <input value={d.expected_delegates} inputMode="numeric" onChange={e => set('expected_delegates', e.target.value)} style={fieldStyle} />
        </Field>
        <Field label="Start date">
          <DatePicker value={d.start_date} onChange={v => set('start_date', v)} clearable />
        </Field>
        <Field label="End date">
          <DatePicker value={d.end_date} onChange={v => set('end_date', v)} min={d.start_date || undefined} clearable />
        </Field>
        <label className="sm:col-span-2 inline-flex items-center gap-2 cursor-pointer" style={{ fontFamily: OUTFIT, fontSize: 12.5, color: NEU.ink }}>
          <input type="checkbox" checked={d.dates_tbd} onChange={e => set('dates_tbd', e.target.checked)} />
          Dates to be decided
        </label>
        <Field label="City">
          <input value={d.city} onChange={e => set('city', e.target.value)} style={fieldStyle} />
        </Field>
        <Field label="Country">
          <input value={d.country} onChange={e => set('country', e.target.value)} style={fieldStyle} />
        </Field>
        <Field label="Contact email">
          <input value={d.contact_email} type="email" onChange={e => set('contact_email', e.target.value)} style={fieldStyle} />
        </Field>
        <Field label="Website">
          <input value={d.website_url} onChange={e => set('website_url', e.target.value)} placeholder="https://" style={fieldStyle} />
        </Field>
        <label className="sm:col-span-2 inline-flex items-center gap-2 cursor-pointer" style={{ fontFamily: OUTFIT, fontSize: 12.5, color: NEU.ink }}>
          <input type="checkbox" checked={d.is_public} onChange={e => set('is_public', e.target.checked)} />
          Published (listed publicly)
        </label>
      </div>

      {(error || (changed && localError)) && (
        <p role="alert" className="mt-3" style={{ fontFamily: OUTFIT, fontSize: 12.5, color: RED }}>
          {error ?? localError}
        </p>
      )}

      <div className="flex items-center gap-2 mt-4 flex-wrap">
        <ActionButton type="submit" icon={Check} label={saving ? 'Saving' : 'Save changes'} on disabled={!changed || !!localError || saving} />
        <ActionButton icon={X} label="Cancel" onClick={onCancel} />
        <span style={{ fontFamily: OUTFIT, fontSize: 11.5, color: NEU.inkSoft }}>
          Publishing still needs a payment method set up, exactly as for the organiser.
        </span>
      </div>
    </form>
  );
}

// ── Email organisers ───────────────────────────────────────────────────────

function EmailPane({ detail, onDone }: { detail: Detail; onDone: () => void }) {
  const { session } = useAuth();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ queued: number; suppressed: number } | null>(null);
  const recipients = detail.organisers.filter(o => o.email);

  async function send() {
    if (!session || !subject.trim() || !body.trim() || sending) return;
    setSending(true);
    setError(null);
    const supabase = getAuthedClient(session.access_token);
    const { data, error: e } = await supabase.rpc('admin_email_conference_organisers', {
      p_conference_id: detail.conference.id, p_subject: subject.trim(), p_body: body,
    });
    setSending(false);
    if (e || !data) { setError(errText(e, 'Not sent. Try again.')); return; }
    setResult(data as { queued: number; suppressed: number });
  }

  if (result) {
    return (
      <div>
        <p role="status" style={{ fontFamily: OUTFIT, fontSize: 13.5, fontWeight: 700, color: NEU.green }}>
          Queued for {result.queued} {result.queued === 1 ? 'organiser' : 'organisers'}.
        </p>
        {result.suppressed > 0 && (
          <p className="mt-1" style={{ fontFamily: OUTFIT, fontSize: 12.5, color: NEU.inkSoft }}>
            {result.suppressed} unsubscribed from all Gavelling email and will not get it.
          </p>
        )}
        <div className="mt-3"><ActionButton icon={Check} label="Done" onClick={onDone} /></div>
      </div>
    );
  }

  return (
    <form onSubmit={e => { e.preventDefault(); void send(); }}>
      <p className="mb-3" style={{ fontFamily: OUTFIT, fontSize: 12, color: NEU.inkSoft, lineHeight: 1.5 }}>
        To {recipients.length === 0 ? 'nobody (no organiser has an email)' : recipients.map(r => r.email).join(', ')}.
        {' '}Sent from Gavelling. Replies go to wearegavelling@gmail.com.
      </p>
      <Field label="Subject">
        <input value={subject} onChange={e => setSubject(e.target.value)} maxLength={200} style={fieldStyle} />
      </Field>
      <div className="mt-3">
        <Field label="Message">
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            rows={7}
            placeholder="Hi there,"
            style={{ ...fieldStyle, lineHeight: 1.6, resize: 'vertical' }}
          />
        </Field>
      </div>
      <p className="mt-1.5" style={{ fontFamily: OUTFIT, fontSize: 11, color: NEU.inkSoft }}>
        Leave a blank line between paragraphs.
      </p>
      {error && <p role="alert" className="mt-2" style={{ fontFamily: OUTFIT, fontSize: 12.5, color: RED }}>{error}</p>}
      <div className="flex items-center gap-2 mt-3">
        <ActionButton
          type="submit"
          icon={Send}
          on
          label={sending ? 'Sending' : `Send to ${recipients.length} ${recipients.length === 1 ? 'organiser' : 'organisers'}`}
          disabled={sending || recipients.length === 0 || !subject.trim() || !body.trim()}
        />
      </div>
    </form>
  );
}

// ── Delete ─────────────────────────────────────────────────────────────────

function DeletePane({
  detail, onDeleted, onCancel,
}: { detail: Detail; onDeleted: () => void; onCancel: () => void }) {
  const { session } = useAuth();
  const [armed, setArmed] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = detail.conference.full_name;
  const matches = typed.trim() === name.trim();
  const c = detail.counts;

  async function remove() {
    if (!session || !matches || busy) return;
    setBusy(true);
    setError(null);
    const supabase = getAuthedClient(session.access_token);
    const { error: e } = await supabase.rpc('admin_delete_conference', {
      p_conference_id: detail.conference.id, p_confirm_name: typed.trim(),
    });
    setBusy(false);
    if (e) { setError(errText(e, 'Not deleted. Try again.')); return; }
    onDeleted();
  }

  return (
    <div>
      <div className="flex items-start gap-2.5">
        <AlertTriangle size={18} strokeWidth={2.4} style={{ color: RED, flexShrink: 0, marginTop: 1 }} aria-hidden />
        <div style={{ fontFamily: OUTFIT, fontSize: 12.5, color: NEU.ink, lineHeight: 1.55 }}>
          <p style={{ fontWeight: 800 }}>This cannot be undone.</p>
          <p className="mt-1" style={{ color: NEU.inkSoft }}>
            Deleting removes the conference with its {int(c.applications)} applications, {int(c.invoices)} invoices,
            {' '}{int(c.committees)} committees, {int(c.allocations)} allocations and {int(c.live_sessions)} live
            session rooms. CV entries people already earned stay on their CVs.
          </p>
        </div>
      </div>

      {!armed ? (
        <div className="flex items-center gap-2 mt-4">
          <ActionButton icon={Trash2} label="Continue to delete" danger onClick={() => setArmed(true)} />
          <ActionButton icon={X} label="Keep it" onClick={onCancel} />
        </div>
      ) : (
        <form className="mt-4" onSubmit={e => { e.preventDefault(); void remove(); }}>
          <Field label={`Type the full name to confirm: ${name}`}>
            <input
              value={typed}
              onChange={e => setTyped(e.target.value)}
              autoFocus
              autoComplete="off"
              spellCheck={false}
              aria-invalid={typed.length > 0 && !matches}
              style={fieldStyle}
            />
          </Field>
          {error && <p role="alert" className="mt-2" style={{ fontFamily: OUTFIT, fontSize: 12.5, color: RED }}>{error}</p>}
          <div className="flex items-center gap-2 mt-3">
            <ActionButton type="submit" icon={Trash2} label={busy ? 'Deleting' : 'Delete for ever'} danger on disabled={!matches || busy} />
            <ActionButton icon={X} label="Keep it" onClick={onCancel} />
          </div>
        </form>
      )}
    </div>
  );
}

// ── The dialog ─────────────────────────────────────────────────────────────

export default function ConferenceDetailDialog({
  conferenceId, onClose, onChanged, onOpenPerson, initialDetail,
}: {
  conferenceId: string;
  onClose: () => void;
  /** Called after an edit or a delete, so the list reloads from the server. */
  onChanged: () => void;
  onOpenPerson: (userId: string) => void;
  /** Render this record instead of fetching one (previews only). */
  initialDetail?: Detail;
}) {
  const { session } = useAuth();
  const [detail, setDetail] = useState<Detail | null>(initialDetail ?? null);
  const [error, setError] = useState<string | null>(null);
  const [pane, setPane] = useState<Pane>('overview');
  const [notice, setNotice] = useState<string | null>(null);

  useScrollLock(true);

  useEffect(() => {
    if (initialDetail) return;
    let cancelled = false;
    (async () => {
      if (!session) { setError('Not signed in.'); return; }
      const supabase = getAuthedClient(session.access_token);
      const { data, error: e } = await supabase.rpc('admin_conference_detail', { p_conference_id: conferenceId });
      if (cancelled) return;
      if (e) { setError(errText(e, 'Could not load this conference.')); return; }
      if (!data) { setError('This conference no longer exists.'); return; }
      setDetail(data as Detail);
    })();
    return () => { cancelled = true; };
  }, [session, conferenceId, initialDetail]);

  const toggle = useCallback((p: Pane) => { setNotice(null); setPane(cur => (cur === p ? 'overview' : p)); }, []);

  const c = detail?.conference;
  const title = c ? (c.acronym?.trim() || c.full_name) : 'Conference';
  const past = c ? isPastConference(c) : false;
  const stages = detail?.setup.items ?? [];
  const stagesDone = stages.filter(s => s.done).length;
  const paidFees = (detail?.fees ?? []).filter(f => Number(f.amount) > 0);

  return (
    <GrowDialog
      originSelector={`[data-admin-conf="${conferenceId}"]`}
      onClose={onClose}
      ariaLabel={title}
      panelClassName="w-full max-w-4xl overflow-y-auto"
      panelStyle={{
        maxHeight: '90vh', backgroundColor: C.cream, borderRadius: 26, fontFamily: OUTFIT,
        border: `1.5px solid ${C.parchment}`, boxShadow: '0 28px 70px rgba(27,56,40,0.32)',
      }}
      backdropStyle={{ background: 'rgba(16,28,20,0.5)' }}
    >
      {requestClose => (
        <>
          {!detail && !error && <div className="flex items-center justify-center py-20"><Loader /></div>}

          {error && (
            <div className="py-12 px-6 text-center">
              <p style={{ fontSize: 13, color: RED }}>{error}</p>
              <div className="mt-4 inline-flex"><ActionButton icon={X} label="Close" onClick={requestClose} /></div>
            </div>
          )}

          {detail && c && (
            <>
              {/* ── Hero: the flag is the protagonist ── */}
              <header
                className="relative flex items-center gap-5 flex-wrap"
                style={{
                  padding: '26px 28px 24px',
                  background: `radial-gradient(120% 140% at 0% 0%, ${C.forestMid} 0%, ${C.forest} 60%)`,
                  borderRadius: '24px 24px 0 0', color: C.ivory,
                }}
              >
                <div className="relative flex-shrink-0" style={{ width: 104, height: 104 }}>
                  <CircleFlag
                    country={c.country}
                    size={104}
                    loading="eager"
                    ring={C.gold}
                    label={c.country || 'No country'}
                    fallback={<Globe size={40} style={{ color: C.forest }} />}
                    style={{ boxShadow: '0 10px 26px rgba(0,0,0,0.35)', borderRadius: 999 }}
                  />
                  <span className="absolute" style={{ right: -8, bottom: -6, borderRadius: 999, boxShadow: '0 4px 12px rgba(0,0,0,0.3)', border: `2.5px solid ${C.forest}` }}>
                    <LogoDisc src={c.logo_url} alt={title} size={44} fallbackText={title.slice(0, 3)} />
                  </span>
                </div>

                <div className="flex-1 min-w-0" style={{ minWidth: 220 }}>
                  <h2 className="flex items-center gap-2.5 flex-wrap" style={{ fontSize: 30, fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1.05, color: '#FFFFFF' }}>
                    <span className="truncate">{title}</span>
                    <VerifiedCheck verified={c.is_verified} showUnverified size={22}
                      title={c.is_verified ? `Verified${c.verified_at ? ` on ${fmtDate(c.verified_at)}` : ''}` : 'Not verified yet'} />
                  </h2>
                  {title !== c.full_name && (
                    <p className="truncate mt-1" style={{ fontSize: 14, fontWeight: 600, color: C.gold }}>{c.full_name}</p>
                  )}
                  <div className="flex items-center gap-x-4 gap-y-1 flex-wrap mt-2.5" style={{ fontSize: 12.5, fontWeight: 600, color: 'rgba(237,231,216,0.85)' }}>
                    <span className="inline-flex items-center gap-1.5"><CalendarClock size={14} aria-hidden style={{ color: C.gold }} />{datesLabel(c)}</span>
                    <span className="inline-flex items-center gap-1.5"><MapPin size={14} aria-hidden style={{ color: C.gold }} />{[c.city, c.country].filter(Boolean).join(', ') || 'No location'}</span>
                    <span className="inline-flex items-center gap-1.5" style={{ color: c.is_public ? '#A8E0B8' : 'rgba(237,231,216,0.85)' }}>
                      {c.is_public ? <Globe size={14} aria-hidden /> : <PencilLine size={14} aria-hidden />}
                      {c.is_public ? 'Published' : 'Draft'}
                    </span>
                    {past && <span className="inline-flex items-center gap-1.5"><History size={14} aria-hidden />Past</span>}
                    {c.is_demo && <span>Demo</span>}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={requestClose}
                  aria-label="Close"
                  className="absolute flex items-center justify-center focus:outline-none focus-visible:ring-2"
                  style={{
                    top: 16, right: 16, width: 34, height: 34, borderRadius: 999, cursor: 'pointer',
                    border: '1.5px solid rgba(238,217,138,0.35)', background: 'rgba(0,0,0,0.18)', color: C.ivory,
                  }}
                >
                  <X size={16} />
                </button>
              </header>

              {/* ── Tools bar ── */}
              <div className="flex items-center gap-2 flex-wrap" style={{ padding: '14px 28px', borderBottom: `1px solid ${C.parchment}`, background: C.ivory }}>
                <a href={`/conferences/${c.slug}`} target="_blank" rel="noopener noreferrer"
                   className="inline-flex items-center gap-1 focus:outline-none focus-visible:underline"
                   style={{ fontSize: 12.5, fontWeight: 800, color: C.forest, textDecoration: 'none' }}>
                  Public page <ArrowUpRight size={14} aria-hidden />
                </a>
                <span aria-hidden style={{ color: C.goldDeep, margin: '0 6px' }}>◆</span>
                <a href={`/manage/${c.slug}`} target="_blank" rel="noopener noreferrer"
                   className="inline-flex items-center gap-1 focus:outline-none focus-visible:underline"
                   style={{ fontSize: 12.5, fontWeight: 800, color: C.forest, textDecoration: 'none' }}>
                  Manage <ArrowUpRight size={14} aria-hidden />
                </a>
                <span className="flex-1" />
                <ToolButton icon={PencilLine} label="Edit" on={pane === 'edit'} onClick={() => toggle('edit')} />
                <ToolButton icon={Mail} label="Email" on={pane === 'email'} onClick={() => toggle('email')} />
                <ToolButton icon={Trash2} label="Delete" danger on={pane === 'delete'} onClick={() => toggle('delete')} />
              </div>

              <div style={{ padding: '22px 28px 28px' }}>
                {notice && (
                  <p role="status" className="mb-3 inline-flex items-center gap-1.5" style={{ fontSize: 12.5, fontWeight: 700, color: C.forestLight }}>
                    <Check size={14} aria-hidden /> {notice}
                  </p>
                )}

                {pane !== 'overview' && (
                  <div className="mb-6" style={{ padding: 18, borderRadius: 18, background: '#FFFFFF', border: `1.5px solid ${pane === 'delete' ? 'rgba(139,32,32,0.35)' : C.parchment}` }}>
                    {pane === 'edit' && (
                      <EditPane
                        detail={detail}
                        onCancel={() => setPane('overview')}
                        onSaved={next => { setDetail(next); setPane('overview'); setNotice('Saved.'); onChanged(); }}
                      />
                    )}
                    {pane === 'email' && <EmailPane detail={detail} onDone={() => setPane('overview')} />}
                    {pane === 'delete' && (
                      <DeletePane
                        detail={detail}
                        onCancel={() => setPane('overview')}
                        onDeleted={() => { onChanged(); requestClose(); }}
                      />
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-[1.45fr_1fr]" style={{ gap: 32 }}>
                  {/* ── Left: delegates, then organisers ── */}
                  <div className="min-w-0">
                    <Funnel detail={detail} />

                    <section aria-labelledby="adm-orgs" className="mt-8">
                      <h3 id="adm-orgs" className="mb-1" style={{ fontSize: 13, fontWeight: 800, color: C.forest }}>
                        Organisers <span style={{ color: C.inkSoft, fontWeight: 700 }}>{detail.organisers.length}</span>
                      </h3>
                      <div className="flex flex-col">
                        {detail.organisers.map(o => (
                          <button
                            key={o.user_id}
                            type="button"
                            onClick={() => onOpenPerson(o.user_id)}
                            title="Open this account"
                            className="group flex items-center gap-3 text-left w-full focus:outline-none focus-visible:ring-2"
                            style={{ padding: '9px 6px', border: 'none', borderTop: `1px solid ${C.parchment}`, background: 'transparent', cursor: 'pointer' }}
                          >
                            <Avatar url={o.avatar_url} name={o.display_name || o.email || '?'} size={36} rounded />
                            <span className="flex-1 min-w-0">
                              <span className="block truncate" style={{ fontSize: 13.5, fontWeight: 800, color: C.ink }}>{o.display_name || 'No name'}</span>
                              <span className="block truncate" style={{ fontSize: 12, color: C.inkSoft }}>{o.email}</span>
                            </span>
                            <span style={{ fontSize: 11.5, fontWeight: 800, color: o.is_owner ? C.goldDeep : C.inkSoft }}>{roleLabel(o.role)}</span>
                            <ArrowUpRight size={15} aria-hidden className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" style={{ color: C.forest }} />
                          </button>
                        ))}
                      </div>
                    </section>
                  </div>

                  {/* ── Right: the checkmark, then the facts ── */}
                  <div className="min-w-0">
                    <section aria-labelledby="adm-stages">
                      <div className="flex items-center gap-4">
                        <StageRing done={stagesDone} total={stages.length} verified={c.is_verified} />
                        <div className="min-w-0">
                          <h3 id="adm-stages" style={{ fontSize: 13, fontWeight: 800, color: C.forest }}>Checkmark</h3>
                          <p className="mt-0.5" style={{ fontSize: 17, fontWeight: 900, color: c.is_verified ? VERIFIED_BLUE : C.ink, lineHeight: 1.2 }}>
                            {c.is_verified
                              ? 'Verified'
                              : stagesDone === stages.length
                                ? 'Lands on the next refresh'
                                : `${stages.length - stagesDone} ${stages.length - stagesDone === 1 ? 'stage' : 'stages'} to go`}
                          </p>
                          <p className="mt-1" style={{ fontSize: 11.5, color: C.inkSoft }}>
                            {c.is_verified
                              ? (c.verified_at ? `Since ${fmtDate(c.verified_at)}` : 'Every stage done')
                              : detail.setup.minutes_left > 0 ? `About ${detail.setup.minutes_left} minutes of work` : ''}
                          </p>
                        </div>
                      </div>
                      <ul className="mt-4 flex flex-col" style={{ gap: 7 }}>
                        {stages.map(s => {
                          const Icon = STAGE_ICON[s.key] ?? Target;
                          return (
                            <li key={s.key} className="flex items-center gap-2.5" title={s.done ? undefined : s.todo}>
                              <span className="inline-flex items-center justify-center flex-shrink-0" style={{
                                width: 22, height: 22, borderRadius: 999,
                                background: s.done ? C.forestLight : 'transparent',
                                border: s.done ? 'none' : `2px solid ${C.amber}`,
                              }}>
                                {s.done
                                  ? <Check size={13} strokeWidth={3} style={{ color: '#FFFFFF' }} aria-hidden />
                                  : <Icon size={11} strokeWidth={2.6} style={{ color: C.amber }} aria-hidden />}
                              </span>
                              <span style={{ fontSize: 13, fontWeight: s.done ? 600 : 800, color: s.done ? C.inkSoft : C.ink }}>
                                {STAGE_LABEL[s.key] ?? s.title}
                              </span>
                              <span className="sr-only">{s.done ? 'done' : 'missing'}</span>
                            </li>
                          );
                        })}
                      </ul>
                    </section>

                    <section aria-label="Details" className="mt-7">
                      <FactRow icon={Ticket} tint={C.goldDeep} label="Fees">
                        {paidFees.length === 0
                          ? 'Free for every role'
                          : paidFees.map(f => (
                            <span key={f.role} className="block">{roleLabel(f.role)} <span style={{ color: C.forestLight }}>{feeLabel(f.amount, f.currency)}</span></span>
                          ))}
                      </FactRow>
                      <FactRow icon={Building2} tint={C.forestLight} label="Committees">
                        {int(detail.counts.committees)}
                        {detail.counts.live_sessions > 0 && <span style={{ color: C.inkSoft, fontWeight: 600 }}> · {int(detail.counts.live_sessions)} with a live room</span>}
                      </FactRow>
                      <FactRow icon={Mail} tint={C.sky} label="Contact">{c.contact_email || 'Not set'}</FactRow>
                      {c.website_url && (
                        <FactRow icon={Link2} tint={C.sky} label="Website">
                          <a href={c.website_url} target="_blank" rel="noopener noreferrer" style={{ color: C.forest }}>{c.website_url.replace(/^https?:\/\//, '')}</a>
                        </FactRow>
                      )}
                      <FactRow icon={CalendarClock} tint={C.plum} label="Created">
                        {fmtDate(c.created_at)}
                        {c.published_at && <span style={{ color: C.inkSoft, fontWeight: 600 }}> · published {fmtDate(c.published_at)}</span>}
                      </FactRow>
                    </section>
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </GrowDialog>
  );
}
