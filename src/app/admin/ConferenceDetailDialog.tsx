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
  ArrowUpRight, CalendarClock, Check, Globe, Mail, MapPin, PencilLine, Send, Trash2,
  Users, X, AlertTriangle, Building2, History,
} from 'lucide-react';
import GrowDialog from '@/components/GrowDialog';
import Loader from '@/components/Loader';
import Avatar from '@/components/Avatar';
import { LogoDisc } from '@/components/LogoDisc';
import { DatePicker } from '@/components/DatePicker';
import VerifiedCheck from '@/components/VerifiedCheck';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { useScrollLock } from '@/hooks/useScrollLock';
import { NEU, NEU_GRADIENTS, OUTFIT, EASE, NeuInset } from '@/components/neu';
import { Eyebrow, NUM, RED, fmtDate, int } from './staffBits';
import { isPastConference } from './conferenceDates';

interface Detail {
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
  organisers: {
    user_id: string; display_name: string | null; email: string | null;
    avatar_url: string | null; role: string; is_owner: boolean;
  }[];
  counts: {
    applications: number; accepted: number; paid: number; allocations: number;
    committees: number; live_sessions: number; invoices: number;
  };
  fees: { role: string; amount: number; currency: string }[];
}

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

// ── Small presentational pieces ─────────────────────────────────────────────

function Fact({ icon: Icon, label, value }: { icon: typeof Globe; label: string; value: React.ReactNode }) {
  return (
    <NeuInset small style={{ padding: '10px 12px', borderRadius: 14 }}>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon size={12} strokeWidth={2.4} style={{ color: NEU.deepGold, flexShrink: 0 }} aria-hidden />
        <span style={{ fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 700, color: NEU.inkSoft }}>{label}</span>
      </div>
      <div className="break-words" style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 700, color: NEU.ink, ...NUM }}>{value}</div>
    </NeuInset>
  );
}

function Count({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center" style={{ minWidth: 64 }}>
      <span style={{ fontFamily: OUTFIT, fontSize: 20, fontWeight: 900, color: NEU.ink, lineHeight: 1, ...NUM }}>{int(value)}</span>
      <span style={{ fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 600, color: NEU.inkSoft, marginTop: 4 }}>{label}</span>
    </div>
  );
}

function ActionButton({
  icon: Icon, label, onClick, on, danger, disabled, type = 'button',
}: {
  icon: typeof Globe; label: string; onClick?: () => void; on?: boolean; danger?: boolean;
  disabled?: boolean; type?: 'button' | 'submit';
}) {
  const [hover, setHover] = useState(false);
  const fill = danger
    ? `linear-gradient(135deg, #9A3030, #7A1F1F)`
    : `linear-gradient(135deg, ${NEU_GRADIENTS.forest[0]}, ${NEU_GRADIENTS.forest[1]})`;
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={on}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="inline-flex items-center gap-1.5 focus:outline-none focus-visible:ring-2"
      style={{
        padding: '8px 14px', borderRadius: 999, border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
        background: on ? fill : NEU.surface,
        color: on ? (danger ? '#FFFFFF' : NEU.gold) : danger ? RED : NEU.ink,
        boxShadow: hover && !disabled ? NEU.outSmHover : NEU.outSm,
        fontFamily: OUTFIT, fontSize: 12, fontWeight: 800,
        transition: `box-shadow 180ms ${EASE}`,
      }}
    >
      <Icon size={14} strokeWidth={2.4} aria-hidden />
      {label}
    </button>
  );
}

const fieldStyle: React.CSSProperties = {
  width: '100%', border: 'none', borderRadius: 12, padding: '9px 12px',
  backgroundColor: NEU.base, boxShadow: NEU.inSm, color: NEU.ink,
  fontFamily: OUTFIT, fontSize: 13, outline: 'none',
};

function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <label className={wide ? 'sm:col-span-2 block' : 'block'}>
      <span className="block mb-1.5" style={{ fontFamily: OUTFIT, fontSize: 11, fontWeight: 700, color: NEU.inkSoft }}>{label}</span>
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
  conferenceId, onClose, onChanged, onOpenPerson,
}: {
  conferenceId: string;
  onClose: () => void;
  /** Called after an edit or a delete, so the list reloads from the server. */
  onChanged: () => void;
  onOpenPerson: (userId: string) => void;
}) {
  const { session } = useAuth();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pane, setPane] = useState<Pane>('overview');
  const [notice, setNotice] = useState<string | null>(null);

  useScrollLock(true);

  useEffect(() => {
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
  }, [session, conferenceId]);

  const toggle = useCallback((p: Pane) => { setNotice(null); setPane(cur => (cur === p ? 'overview' : p)); }, []);

  const c = detail?.conference;
  const title = c ? (c.acronym?.trim() || c.full_name) : 'Conference';
  const past = c ? isPastConference(c) : false;
  const allFree = !!detail && detail.fees.every(f => !Number(f.amount));

  return (
    <GrowDialog
      originSelector={`[data-admin-conf="${conferenceId}"]`}
      onClose={onClose}
      ariaLabel={title}
      panelClassName="w-full max-w-3xl overflow-y-auto"
      panelStyle={{
        maxHeight: '88vh', backgroundColor: NEU.surface, borderRadius: 24,
        boxShadow: '0 24px 60px rgba(27,56,40,0.30)', padding: 24, fontFamily: OUTFIT,
      }}
      backdropStyle={{ background: 'rgba(16,28,20,0.45)' }}
    >
      {requestClose => (
        <>
          {!detail && !error && <div className="flex items-center justify-center py-16"><Loader /></div>}

          {error && (
            <div className="py-10 text-center">
              <p style={{ fontSize: 13, color: RED }}>{error}</p>
              <div className="mt-4 inline-flex"><ActionButton icon={X} label="Close" onClick={requestClose} /></div>
            </div>
          )}

          {detail && c && (
            <>
              {/* Header */}
              <div className="flex items-start gap-3.5 mb-5">
                <LogoDisc src={c.logo_url} alt={title} size={56} fallbackText={title.slice(0, 3)} />
                <div className="flex-1 min-w-0">
                  <h2 className="flex items-center gap-2 flex-wrap" style={{ fontSize: 21, fontWeight: 900, color: NEU.ink, letterSpacing: '-0.01em' }}>
                    <span className="truncate">{title}</span>
                    <VerifiedCheck verified={c.is_verified} showUnverified size={17}
                      title={c.is_verified ? `Verified${c.verified_at ? ` on ${fmtDate(c.verified_at)}` : ''}` : 'Not verified yet'} />
                  </h2>
                  {title !== c.full_name && (
                    <p className="truncate" style={{ fontSize: 12.5, color: NEU.inkSoft, fontWeight: 600 }}>{c.full_name}</p>
                  )}
                  <div className="flex items-center gap-2 flex-wrap mt-1.5" style={{ fontSize: 11.5, fontWeight: 700, color: NEU.inkSoft }}>
                    <span className="inline-flex items-center gap-1" style={{ color: c.is_public ? NEU.green : NEU.inkSoft }}>
                      {c.is_public ? <Globe size={12} aria-hidden /> : <PencilLine size={12} aria-hidden />}
                      {c.is_public ? `Published${c.published_at ? ` ${fmtDate(c.published_at)}` : ''}` : 'Draft'}
                    </span>
                    {past && <span className="inline-flex items-center gap-1"><History size={12} aria-hidden /> Past</span>}
                    {c.is_demo && <span>Demo</span>}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={requestClose}
                  aria-label="Close"
                  className="flex items-center justify-center focus:outline-none flex-shrink-0"
                  style={{
                    width: 32, height: 32, border: 'none', borderRadius: 11, cursor: 'pointer',
                    backgroundColor: NEU.surface, boxShadow: NEU.outSm, color: NEU.inkSoft,
                  }}
                >
                  <X size={15} />
                </button>
              </div>

              {/* Facts */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 mb-4">
                <Fact icon={CalendarClock} label="Dates" value={datesLabel(c)} />
                <Fact icon={MapPin} label="Location" value={[c.city, c.country].filter(Boolean).join(', ') || 'Not set'} />
                <Fact icon={Building2} label="Created" value={fmtDate(c.created_at)} />
                <Fact icon={Mail} label="Contact email" value={c.contact_email || 'Not set'} />
                <Fact icon={Users} label="Expected delegates" value={int(c.expected_delegates)} />
                <Fact
                  icon={Globe}
                  label="Fees"
                  value={detail.fees.length === 0 || allFree
                    ? 'Free'
                    : detail.fees.filter(f => Number(f.amount) > 0).map(f => `${roleLabel(f.role)} ${feeLabel(f.amount, f.currency)}`).join(', ')}
                />
              </div>

              <NeuInset style={{ padding: '14px 10px', borderRadius: 16, marginBottom: 18 }}>
                <div className="flex items-start justify-around flex-wrap gap-y-3">
                  <Count value={detail.counts.applications} label="Applications" />
                  <Count value={detail.counts.accepted} label="Accepted" />
                  <Count value={detail.counts.paid} label="Paid" />
                  <Count value={detail.counts.allocations} label="Delegates placed" />
                  <Count value={detail.counts.committees} label="Committees" />
                </div>
              </NeuInset>

              {/* Organisers */}
              <Eyebrow style={{ marginBottom: 8 }}>Organisers · {detail.organisers.length}</Eyebrow>
              <div className="flex flex-col gap-1.5 mb-5">
                {detail.organisers.map(o => (
                  <button
                    key={o.user_id}
                    type="button"
                    onClick={() => onOpenPerson(o.user_id)}
                    className="flex items-center gap-2.5 text-left focus:outline-none focus-visible:ring-2 w-full"
                    style={{
                      padding: '8px 12px', borderRadius: 14, border: 'none', cursor: 'pointer',
                      backgroundColor: NEU.surface, boxShadow: NEU.outSm,
                    }}
                    title="Open this account"
                  >
                    <Avatar url={o.avatar_url} name={o.display_name || o.email || '?'} size={28} />
                    <span className="flex-1 min-w-0">
                      <span className="block truncate" style={{ fontSize: 13, fontWeight: 800, color: NEU.ink }}>
                        {o.display_name || 'No name'}
                      </span>
                      <span className="block truncate" style={{ fontSize: 11.5, color: NEU.inkSoft }}>{o.email}</span>
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: o.is_owner ? NEU.deepGold : NEU.inkSoft }}>
                      {roleLabel(o.role)}
                    </span>
                    <ArrowUpRight size={14} style={{ color: NEU.inkSoft, flexShrink: 0 }} aria-hidden />
                  </button>
                ))}
              </div>

              {/* Links and actions */}
              <div className="flex items-center gap-2 flex-wrap mb-4">
                <a
                  href={`/conferences/${c.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 focus:outline-none"
                  style={{ padding: '8px 14px', borderRadius: 999, backgroundColor: NEU.surface, boxShadow: NEU.outSm, color: NEU.forest, fontSize: 12, fontWeight: 800, textDecoration: 'none' }}
                >
                  Public page <ArrowUpRight size={13} aria-hidden />
                </a>
                <a
                  href={`/manage/${c.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 focus:outline-none"
                  style={{ padding: '8px 14px', borderRadius: 999, backgroundColor: NEU.surface, boxShadow: NEU.outSm, color: NEU.forest, fontSize: 12, fontWeight: 800, textDecoration: 'none' }}
                >
                  Manage <ArrowUpRight size={13} aria-hidden />
                </a>
                <span className="flex-1" />
                <ActionButton icon={PencilLine} label="Edit details" on={pane === 'edit'} onClick={() => toggle('edit')} />
                <ActionButton icon={Mail} label="Email organisers" on={pane === 'email'} onClick={() => toggle('email')} />
                <ActionButton icon={Trash2} label="Delete" danger on={pane === 'delete'} onClick={() => toggle('delete')} />
              </div>

              {notice && (
                <p role="status" className="mb-3" style={{ fontSize: 12.5, fontWeight: 700, color: NEU.green }}>{notice}</p>
              )}

              {pane !== 'overview' && (
                <NeuInset style={{ padding: 16, borderRadius: 18 }}>
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
                </NeuInset>
              )}
            </>
          )}
        </>
      )}
    </GrowDialog>
  );
}
