'use client';

// Gavelling staff → Job Board.
//
// Every listing on the board (admin_job_listings), with Hide / Unhide
// (admin_job_hide, which emails the poster when hiding), and Gavelling's own
// premium listings: create, edit, publish, close (admin_job_premium_save) and,
// for a premium listing with a Gavelling form, its applicants with Accept and
// Reject (admin_job_premium_applicants / admin_job_premium_decide, no email).
//
// SECURITY: every RPC here is SECURITY DEFINER and refuses unless
// is_platform_admin(). This component holds no access logic worth trusting.
// Raw errors are shown: this is /admin.
//
// Known limit: admin_job_listings leaves drafts out, so a premium listing saved
// as a draft does not appear in the list until it is published. The editor
// keeps the draft open (with its id) after a save so it can still be published.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ExternalLink, Plus, RefreshCw, Search, Trash2, X } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { NEU, NEU_GRADIENTS, OUTFIT, NeuInset } from '@/components/neu';
import GSelect from '@/components/GSelect';
import { DatePicker } from '@/components/DatePicker';
import Loader from '@/components/Loader';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { UN_COUNTRIES } from '@/lib/countries';
import {
  JOB_OFFER_LABEL, JOB_OFFER_ORDER, JOB_ROLE_LABEL,
  type JobCard, type JobOffer, type JobOffers, type JobQuestionType, type JobRole,
} from '@/lib/jobBoard';
import { Chip, NUM, RED, fmtDate, int } from './staffBits';

const LIMIT = 200;

interface AdminQuestion {
  id: string;
  text: string;
  type: JobQuestionType;
  options: string[];
  ideal: string | null;
  essential: boolean;
}

interface AdminListing extends JobCard {
  status: string | null;
  open: boolean;
  hidden_at: string | null;
  hidden_note: string | null;
  created_by_email: string | null;
  created_at: string | null;
  charged_credits: number | null;
  description: string | null;
  outside_url: string | null;
  premium_apply: 'link' | 'form' | null;
  questions: AdminQuestion[] | null;
  deadline: string | null;
  applicants: number | null;
}

interface Applicant {
  apply_id: string;
  status: string;
  answers: { id: string; answer: string }[] | Record<string, string> | null;
  applied_at: string | null;
  user_id: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
}

type RpcResult = { ok?: boolean; message?: string; field?: string; id?: string } | null;

async function rpc<T = RpcResult>(fn: string, args: Record<string, unknown>): Promise<{ data: T | null; error: string | null }> {
  const client = await getFreshAuthedClient();
  if (!client) return { data: null, error: 'Not signed in.' };
  const { data, error } = await client.rpc(fn, args);
  if (error) return { data: null, error: error.message };
  return { data: data as T, error: null };
}

/** A write is verified only when the RPC answered ok: true. */
function writeError(r: { data: RpcResult; error: string | null }): string | null {
  if (r.error) return r.error;
  if (!r.data || r.data.ok !== true) return r.data?.message ?? 'The database did not confirm the change.';
  return null;
}

// ── Small styled pieces ─────────────────────────────────────────────────────

const INPUT: React.CSSProperties = {
  fontFamily: OUTFIT, fontSize: 13, color: NEU.ink, background: '#FFFFFF',
  border: '1px solid color-mix(in srgb, var(--gv-main) 16%, transparent)', borderRadius: 10,
  padding: '8px 11px', width: '100%',
};

function MainButton({ children, onClick, disabled, busy }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; busy?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      className="inline-flex items-center gap-1.5 focus:outline-none"
      style={{
        fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 700, padding: '8px 14px', borderRadius: 10, border: 'none',
        cursor: disabled || busy ? 'default' : 'pointer', opacity: disabled || busy ? 0.6 : 1,
        color: '#FFFFFF', background: `linear-gradient(135deg, ${NEU_GRADIENTS.forest[0]}, ${NEU_GRADIENTS.forest[1]})`,
        boxShadow: NEU.outSm, whiteSpace: 'nowrap',
      }}
    >
      {busy ? 'Working' : children}
    </button>
  );
}

function SoftButton({ children, onClick, disabled, busy, danger, title }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; busy?: boolean; danger?: boolean; title?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      title={title}
      className="inline-flex items-center gap-1.5 focus:outline-none"
      style={{
        fontFamily: OUTFIT, fontSize: 12, fontWeight: 700, padding: '7px 12px', borderRadius: 10,
        border: '1px solid color-mix(in srgb, var(--gv-main) 14%, transparent)',
        cursor: disabled || busy ? 'default' : 'pointer', opacity: disabled || busy ? 0.55 : 1,
        color: danger ? RED : NEU.forest, background: '#FFFFFF', boxShadow: NEU.outSm, whiteSpace: 'nowrap',
      }}
    >
      {busy ? 'Working' : children}
    </button>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <p style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 700, color: NEU.ink, marginBottom: 5 }}>{children}</p>;
}

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className="focus:outline-none"
      style={{
        fontFamily: OUTFIT, fontSize: 12, fontWeight: 700, padding: '6px 12px', borderRadius: 10, cursor: 'pointer',
        border: on ? '1px solid transparent' : '1px solid color-mix(in srgb, var(--gv-main) 16%, transparent)',
        color: on ? '#FFFFFF' : NEU.ink,
        background: on ? `linear-gradient(135deg, ${NEU_GRADIENTS.forest[0]}, ${NEU_GRADIENTS.forest[1]})` : '#FFFFFF',
      }}
    >
      {children}
    </button>
  );
}

function statusChip(l: AdminListing) {
  if (l.hidden_at) return <Chip text="HIDDEN" bg="rgba(139,32,32,0.1)" fg={RED} />;
  const s = (l.status ?? '').toLowerCase();
  if (s === 'live' && l.open) return <Chip text="LIVE" bg="rgba(27,56,40,0.1)" fg={NEU.forest} />;
  if (s === 'live') return <Chip text="LIVE · NOT OPEN" bg="rgba(184,132,74,0.14)" fg="#8A5A1F" />;
  return <Chip text={(s || 'unknown').toUpperCase()} bg="rgba(28,20,16,0.07)" fg={NEU.inkSoft} />;
}

function whereLabel(l: AdminListing): string {
  if (l.kind === 'premium') return l.conference?.name ? `Premium · ${l.conference.name}` : 'Premium';
  if (l.standalone) return l.conference?.name ? `Standalone · ${l.conference.name}` : 'Standalone';
  return l.conference?.short || l.conference?.name || 'Conference';
}

// ── The tab ─────────────────────────────────────────────────────────────────

export default function JobBoardTab() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<AdminListing[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<'all' | 'premium'>('all');
  /** null = closed; { listing: null } = a new premium listing. */
  const [editor, setEditor] = useState<{ listing: AdminListing | null; key: number } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setSearch(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const apply = useCallback((r: { data: { ok: boolean; listings?: AdminListing[] } | null; error: string | null }) => {
    if (r.error) { setError(r.error); setRows(prev => prev ?? []); return; }
    if (!r.data?.ok) { setError('Not authorised.'); setRows([]); return; }
    setError(null);
    setRows(r.data.listings ?? []);
  }, []);

  const fetchListings = useCallback(
    () => rpc<{ ok: boolean; listings?: AdminListing[] }>('admin_job_listings', { p_q: search || null, p_limit: LIMIT }),
    [search],
  );

  // The reload after a press (and the Reload button).
  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const r = await fetchListings();
    setLoading(false);
    apply(r);
  }, [userId, fetchListings, apply]);

  // The read on open and on every new search, keyed on the user id.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void fetchListings().then(r => { if (!cancelled) apply(r); });
    return () => { cancelled = true; };
  }, [userId, fetchListings, apply]);

  const shown = useMemo(
    () => (rows ?? []).filter(l => view === 'all' || l.kind === 'premium'),
    [rows, view],
  );
  const premiumCount = useMemo(() => (rows ?? []).filter(l => l.kind === 'premium').length, [rows]);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-2 flex-wrap">
        <NeuInset small className="flex items-center gap-2" style={{ padding: '8px 14px', borderRadius: 999 }}>
          <Search size={13} style={{ color: NEU.muted }} />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Title, conference or poster email"
            className="focus:outline-none"
            style={{ fontFamily: OUTFIT, fontSize: 12.5, background: 'transparent', border: 'none', color: NEU.ink, width: 240 }}
          />
          {q && (
            <button type="button" onClick={() => setQ('')} aria-label="Clear search" className="focus:outline-none"
              style={{ background: 'transparent', border: 'none', color: NEU.muted, cursor: 'pointer', lineHeight: 0 }}>
              <X size={13} />
            </button>
          )}
        </NeuInset>
        <Toggle on={view === 'all'} onClick={() => setView('all')}>All listings · {int(rows?.length ?? 0)}</Toggle>
        <Toggle on={view === 'premium'} onClick={() => setView('premium')}>Premium · {int(premiumCount)}</Toggle>
        <SoftButton onClick={() => void load()} busy={loading} title="Reload"><RefreshCw size={13} /> Reload</SoftButton>
        <div className="flex-1" />
        <MainButton onClick={() => setEditor({ listing: null, key: Date.now() })}><Plus size={14} /> New premium listing</MainButton>
      </div>

      {error && <p style={{ fontFamily: OUTFIT, fontSize: 12.5, color: RED }}>{error}</p>}

      {editor && (
        <PremiumEditor
          key={editor.key}
          listing={editor.listing}
          onClose={() => setEditor(null)}
          onSaved={() => void load()}
        />
      )}

      {rows === null ? (
        <div className="py-10 flex justify-center"><Loader /></div>
      ) : shown.length === 0 ? (
        <p style={{ fontFamily: OUTFIT, fontSize: 13, color: NEU.inkSoft, padding: '24px 0' }}>
          {view === 'premium' ? 'No premium listings yet.' : 'No listings match.'}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {shown.map(l => (
            <ListingRow
              key={l.id}
              listing={l}
              onChanged={() => void load()}
              onEdit={() => setEditor({ listing: l, key: Date.now() })}
            />
          ))}
          {rows.length >= LIMIT && (
            <p style={{ fontFamily: OUTFIT, fontSize: 12, color: NEU.inkSoft }}>Showing the newest {LIMIT}. Search to narrow.</p>
          )}
        </div>
      )}
    </section>
  );
}

// ── One listing row ─────────────────────────────────────────────────────────

function ListingRow({ listing: l, onChanged, onEdit }: { listing: AdminListing; onChanged: () => void; onEdit: () => void }) {
  const [mode, setMode] = useState<null | 'hide' | 'close' | 'applicants'>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const isPremium = l.kind === 'premium';
  const closed = (l.status ?? '') === 'closed';

  const hide = async (on: boolean) => {
    if (busy) return;
    setBusy(true);
    const r = await rpc('admin_job_hide', { p_id: l.id, p_hide: on, p_note: on ? (note.trim() || null) : null });
    setBusy(false);
    const e = writeError(r);
    if (e) { notifyErr(e); return; }
    notifyOk(on ? 'Listing hidden' : 'Listing shown again');
    setMode(null); setNote('');
    onChanged();
  };

  const close = async () => {
    if (busy) return;
    setBusy(true);
    const r = await rpc('admin_job_premium_save', { p: { ...premiumPayloadFromListing(l), close: true } });
    setBusy(false);
    const e = writeError(r);
    if (e) { notifyErr(e); return; }
    notifyOk('Listing closed');
    setMode(null);
    onChanged();
  };

  return (
    <div style={{ background: '#FFFFFF', borderRadius: 14, boxShadow: NEU.out, padding: '12px 16px' }}>
      <div className="flex items-start gap-3 flex-wrap">
        <div className="flex-1" style={{ minWidth: 240 }}>
          <div className="flex items-center gap-2 flex-wrap">
            <p style={{ fontFamily: OUTFIT, fontSize: 14, fontWeight: 700, color: NEU.ink, overflowWrap: 'anywhere' }}>{l.title}</p>
            {statusChip(l)}
            {l.promoted && <Chip text="PROMOTED" bg="rgba(238,217,138,0.4)" fg="#6B5410" />}
          </div>
          <p style={{ fontFamily: OUTFIT, fontSize: 12, color: NEU.inkSoft, marginTop: 3, overflowWrap: 'anywhere' }}>
            {whereLabel(l)} · {l.role ? JOB_ROLE_LABEL[l.role] : 'No role'} · {l.created_by_email ?? 'Unknown poster'}
          </p>
          {l.hidden_at && l.hidden_note && (
            <p style={{ fontFamily: OUTFIT, fontSize: 12, color: RED, marginTop: 3, overflowWrap: 'anywhere' }}>Hidden note: {l.hidden_note}</p>
          )}
        </div>
        <div className="flex items-center gap-4" style={{ fontFamily: OUTFIT, fontSize: 12, color: NEU.inkSoft, ...NUM }}>
          <span><b style={{ color: NEU.ink, fontSize: 15 }}>{int(l.applicants)}</b> applicants</span>
          <span><b style={{ color: NEU.ink, fontSize: 15 }}>{int(l.charged_credits)}</b> credits</span>
          <span>{fmtDate(l.created_at)}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap mt-3">
        <a
          href={`/jobs?listing=${encodeURIComponent(l.id)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 focus:outline-none"
          style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 700, padding: '7px 12px', borderRadius: 10, color: NEU.forest, background: '#FFFFFF', border: '1px solid color-mix(in srgb, var(--gv-main) 14%, transparent)', boxShadow: NEU.outSm, textDecoration: 'none' }}
        >
          <ExternalLink size={13} /> View
        </a>
        {l.hidden_at
          ? <SoftButton onClick={() => void hide(false)} busy={busy}>Unhide</SoftButton>
          : <SoftButton onClick={() => setMode(mode === 'hide' ? null : 'hide')} danger>Hide</SoftButton>}
        {isPremium && <SoftButton onClick={onEdit}>Edit</SoftButton>}
        {isPremium && !closed && <SoftButton onClick={() => setMode(mode === 'close' ? null : 'close')} danger>Close</SoftButton>}
        {isPremium && l.premium_apply === 'form' && (
          <SoftButton onClick={() => setMode(mode === 'applicants' ? null : 'applicants')}>
            {mode === 'applicants' ? 'Hide applicants' : 'Applicants'}
          </SoftButton>
        )}
      </div>

      {mode === 'hide' && (
        <div className="mt-3 flex flex-col gap-2" style={{ maxWidth: 640 }}>
          <Label>Note to the poster (optional)</Label>
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} className="focus:outline-none" style={{ ...INPUT, resize: 'vertical' }} />
          <p style={{ fontFamily: OUTFIT, fontSize: 11.5, color: NEU.inkSoft }}>The poster is emailed that the listing was hidden, with this note.</p>
          <div className="flex gap-2">
            <MainButton onClick={() => void hide(true)} busy={busy}>Hide listing</MainButton>
            <SoftButton onClick={() => { setMode(null); setNote(''); }} disabled={busy}>Cancel</SoftButton>
          </div>
        </div>
      )}

      {mode === 'close' && (
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <p style={{ fontFamily: OUTFIT, fontSize: 12.5, color: NEU.ink }}>Close this listing? People can no longer apply.</p>
          <MainButton onClick={() => void close()} busy={busy}>Close listing</MainButton>
          <SoftButton onClick={() => setMode(null)} disabled={busy}>Cancel</SoftButton>
        </div>
      )}

      {mode === 'applicants' && <ApplicantsPanel listing={l} />}
    </div>
  );
}

// ── Premium applicants ──────────────────────────────────────────────────────

function answerList(a: Applicant['answers']): { id: string; answer: string }[] {
  if (!a) return [];
  if (Array.isArray(a)) return a.map(x => ({ id: String(x?.id ?? ''), answer: String(x?.answer ?? '') }));
  if (typeof a === 'object') return Object.entries(a).map(([id, answer]) => ({ id, answer: String(answer ?? '') }));
  return [];
}

function ApplicantsPanel({ listing }: { listing: AdminListing }) {
  const [rows, setRows] = useState<Applicant[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const apply = useCallback((r: { data: { ok: boolean; applicants?: Applicant[] } | null; error: string | null }) => {
    if (r.error) { setError(r.error); setRows([]); return; }
    if (!r.data?.ok) { setError('Not authorised.'); setRows([]); return; }
    setError(null);
    setRows(r.data.applicants ?? []);
  }, []);
  const fetchApplicants = useCallback(
    () => rpc<{ ok: boolean; applicants?: Applicant[] }>('admin_job_premium_applicants', { p_id: listing.id }),
    [listing.id],
  );
  const load = useCallback(async () => { apply(await fetchApplicants()); }, [apply, fetchApplicants]);

  useEffect(() => {
    let cancelled = false;
    void fetchApplicants().then(r => { if (!cancelled) apply(r); });
    return () => { cancelled = true; };
  }, [fetchApplicants, apply]);

  const questionText = useMemo(() => {
    const m: Record<string, string> = {};
    for (const qq of listing.questions ?? []) m[qq.id] = qq.text;
    return m;
  }, [listing.questions]);

  const decide = async (a: Applicant, status: 'accepted' | 'rejected') => {
    if (busyId) return;
    setBusyId(a.apply_id);
    const r = await rpc('admin_job_premium_decide', { p_apply: a.apply_id, p_status: status });
    setBusyId(null);
    const e = writeError(r);
    if (e) { notifyErr(e); return; }
    notifyOk(status === 'accepted' ? 'Accepted' : 'Rejected');
    void load();
  };

  return (
    <div className="mt-3 flex flex-col gap-2">
      <p style={{ fontFamily: OUTFIT, fontSize: 11.5, color: NEU.inkSoft }}>No email is sent.</p>
      {error && <p style={{ fontFamily: OUTFIT, fontSize: 12.5, color: RED }}>{error}</p>}
      {rows === null ? (
        <div className="py-4 flex justify-center"><Loader /></div>
      ) : rows.length === 0 ? (
        <p style={{ fontFamily: OUTFIT, fontSize: 12.5, color: NEU.inkSoft }}>No applicants yet.</p>
      ) : rows.map(a => (
        <div key={a.apply_id} style={{ background: NEU.base, borderRadius: 12, boxShadow: NEU.inSm, padding: '10px 14px' }}>
          <div className="flex items-start gap-3 flex-wrap">
            <div className="flex-1" style={{ minWidth: 200 }}>
              <div className="flex items-center gap-2 flex-wrap">
                <p style={{ fontFamily: OUTFIT, fontSize: 13.5, fontWeight: 700, color: NEU.ink, overflowWrap: 'anywhere' }}>{a.name || 'No name'}</p>
                <Chip
                  text={a.status.toUpperCase()}
                  bg={a.status === 'accepted' ? 'rgba(27,56,40,0.1)' : a.status === 'rejected' ? 'rgba(139,32,32,0.1)' : 'rgba(28,20,16,0.07)'}
                  fg={a.status === 'accepted' ? NEU.forest : a.status === 'rejected' ? RED : NEU.inkSoft}
                />
              </div>
              <p style={{ fontFamily: OUTFIT, fontSize: 12, color: NEU.inkSoft, overflowWrap: 'anywhere' }}>{a.email ?? 'No email'} · {fmtDate(a.applied_at)}</p>
            </div>
            <div className="flex gap-2">
              <SoftButton onClick={() => void decide(a, 'accepted')} busy={busyId === a.apply_id} disabled={!!busyId || a.status === 'accepted'}>Accept</SoftButton>
              <SoftButton onClick={() => void decide(a, 'rejected')} busy={busyId === a.apply_id} disabled={!!busyId || a.status === 'rejected'} danger>Reject</SoftButton>
            </div>
          </div>
          {answerList(a.answers).length > 0 && (
            <dl className="mt-2 flex flex-col gap-1.5">
              {answerList(a.answers).map((x, i) => (
                <div key={`${x.id}-${i}`}>
                  <dt style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 700, color: NEU.ink, overflowWrap: 'anywhere' }}>{questionText[x.id] ?? x.id}</dt>
                  <dd style={{ fontFamily: OUTFIT, fontSize: 12.5, color: NEU.inkSoft, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{x.answer || 'No answer'}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      ))}
    </div>
  );
}

// ── The premium editor ──────────────────────────────────────────────────────

const EMPTY_OFFERS: JobOffers = { paid: false, paid_amount: null, accommodation: false, travel: false, certificate: false, letter: false };

interface Draft {
  id: string | null;
  ext_name: string;
  ext_city: string;
  ext_country: string;
  ext_format: '' | 'in-person' | 'online' | 'hybrid';
  ext_logo_url: string;
  ext_website: string;
  role: '' | JobRole;
  title: string;
  description: string;
  offers: JobOffers;
  premium_apply: 'link' | 'form';
  outside_url: string;
  questions: AdminQuestion[];
  deadline: string; // YYYY-MM-DD or ''
}

function draftFromListing(l: AdminListing | null): Draft {
  if (!l) {
    return {
      id: null, ext_name: '', ext_city: '', ext_country: '', ext_format: '', ext_logo_url: '', ext_website: '',
      role: '', title: '', description: '', offers: { ...EMPTY_OFFERS }, premium_apply: 'link', outside_url: '',
      questions: [], deadline: '',
    };
  }
  const c = l.conference;
  const fmt = c?.format;
  return {
    id: l.id,
    ext_name: c?.name ?? '',
    ext_city: c?.city ?? '',
    ext_country: c?.country ?? '',
    ext_format: fmt === 'in-person' || fmt === 'online' || fmt === 'hybrid' ? fmt : '',
    ext_logo_url: c?.logo_url ?? '',
    ext_website: c?.website ?? '',
    role: l.role ?? '',
    title: l.title ?? '',
    description: l.description ?? '',
    offers: { ...EMPTY_OFFERS, ...(l.offers ?? {}) },
    premium_apply: l.premium_apply === 'form' ? 'form' : 'link',
    outside_url: l.outside_url ?? '',
    questions: (l.questions ?? []).map(qq => ({
      id: qq.id, text: qq.text ?? '', type: qq.type ?? 'text', options: qq.options ?? [],
      ideal: qq.ideal ?? null, essential: !!qq.essential,
    })),
    deadline: l.deadline ? l.deadline.slice(0, 10) : '',
  };
}

function deadlineIso(d: string): string | null {
  return d ? `${d}T23:59:59Z` : null;
}

function payloadFromDraft(d: Draft): Record<string, unknown> {
  const form = d.premium_apply === 'form';
  return {
    ...(d.id ? { id: d.id } : {}),
    title: d.title.trim(),
    description: d.description,
    offers: { ...d.offers, paid_amount: d.offers.paid ? (d.offers.paid_amount?.trim() || null) : null },
    questions: form
      ? d.questions.map(qq => ({
          id: qq.id, text: qq.text.trim(), type: qq.type,
          options: qq.type === 'choice' ? qq.options.map(o => o.trim()).filter(Boolean) : [],
          ideal: qq.type === 'text' ? null : (qq.ideal || null),
          essential: qq.type === 'text' ? false : qq.essential,
        }))
      : [],
    premium_apply: d.premium_apply,
    outside_url: form ? '' : d.outside_url.trim(),
    deadline: deadlineIso(d.deadline),
    role: d.role || null,
    ext_name: d.ext_name, ext_city: d.ext_city, ext_country: d.ext_country, ext_format: d.ext_format || null,
    ext_logo_url: d.ext_logo_url.trim(), ext_website: d.ext_website,
  };
}

/** The full payload from a row, so a close never blanks a field (the save writes every field). */
function premiumPayloadFromListing(l: AdminListing): Record<string, unknown> {
  return payloadFromDraft(draftFromListing(l));
}

function nextQuestionId(qs: AdminQuestion[]): string {
  const used = new Set(qs.map(x => x.id));
  let n = 1;
  while (used.has(`q${n}`)) n += 1;
  return `q${n}`;
}

const FORMAT_OPTIONS = [
  { value: '' as const, label: 'Not set' },
  { value: 'in-person' as const, label: 'In person' },
  { value: 'online' as const, label: 'Online' },
  { value: 'hybrid' as const, label: 'Hybrid' },
];
const ROLE_OPTIONS = [
  { value: '' as const, label: 'None' },
  { value: 'chair' as const, label: JOB_ROLE_LABEL.chair },
  { value: 'secretariat' as const, label: JOB_ROLE_LABEL.secretariat },
  { value: 'staff' as const, label: JOB_ROLE_LABEL.staff },
];
const TYPE_OPTIONS = [
  { value: 'yesno' as const, label: 'Yes or no' },
  { value: 'choice' as const, label: 'Choice' },
  { value: 'text' as const, label: 'Text' },
];
const COUNTRY_OPTIONS = [{ value: '', label: 'Not set' }, ...UN_COUNTRIES.map(c => ({ value: c.name, label: c.name }))];

function PremiumEditor({ listing, onClose, onSaved }: { listing: AdminListing | null; onClose: () => void; onSaved: () => void }) {
  const [d, setD] = useState<Draft>(() => draftFromListing(listing));
  const [busy, setBusy] = useState<null | 'draft' | 'publish'>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD(prev => ({ ...prev, [k]: v }));
  const isLive = (listing?.status ?? '') === 'live';

  const countryOptions = useMemo(() => {
    if (!d.ext_country || COUNTRY_OPTIONS.some(o => o.value === d.ext_country)) return COUNTRY_OPTIONS;
    return [...COUNTRY_OPTIONS, { value: d.ext_country, label: d.ext_country }];
  }, [d.ext_country]);

  const save = async (publish: boolean) => {
    if (busy) return;
    if (d.title.trim().length < 3) { setProblem('Give the listing a title.'); return; }
    setBusy(publish ? 'publish' : 'draft');
    setProblem(null);
    const r = await rpc('admin_job_premium_save', { p: { ...payloadFromDraft(d), publish } });
    setBusy(null);
    // A refused publish still saved the fields, and hands back the id.
    if (r.data?.id && !d.id) set('id', r.data.id);
    const e = writeError(r);
    if (e) {
      setProblem(r.data?.field ? `${r.data.field}: ${e}` : e);
      onSaved();
      return;
    }
    if (publish) {
      notifyOk('Listing published');
      onSaved();
      onClose();
    } else {
      notifyOk(isLive ? 'Changes saved' : 'Draft saved. Drafts do not show in the list until published');
      onSaved();
    }
  };

  const setQuestion = (i: number, patch: Partial<AdminQuestion>) =>
    setD(prev => ({ ...prev, questions: prev.questions.map((x, j) => (j === i ? { ...x, ...patch } : x)) }));
  const moveQuestion = (i: number, dir: -1 | 1) =>
    setD(prev => {
      const qs = [...prev.questions];
      const j = i + dir;
      if (j < 0 || j >= qs.length) return prev;
      [qs[i], qs[j]] = [qs[j], qs[i]];
      return { ...prev, questions: qs };
    });
  const removeQuestion = (i: number) => setD(prev => ({ ...prev, questions: prev.questions.filter((_, j) => j !== i) }));
  const addQuestion = () =>
    setD(prev => prev.questions.length >= 5 ? prev : ({
      ...prev,
      questions: [...prev.questions, { id: nextQuestionId(prev.questions), text: '', type: 'yesno', options: [], ideal: null, essential: false }],
    }));

  const toggleOffer = (k: JobOffer) => setD(prev => ({ ...prev, offers: { ...prev.offers, [k]: !prev.offers[k] } }));

  return (
    <div style={{ background: '#FFFFFF', borderRadius: 16, boxShadow: NEU.out, padding: '18px 20px' }}>
      <div className="flex items-center gap-2 mb-4">
        <h2 style={{ fontFamily: OUTFIT, fontSize: 17, fontWeight: 700, color: NEU.ink }}>
          {listing ? 'Edit Premium Listing' : d.id ? 'Premium Listing Draft' : 'New Premium Listing'}
        </h2>
        <div className="flex-1" />
        <button type="button" onClick={onClose} aria-label="Close editor" className="focus:outline-none"
          style={{ background: 'transparent', border: 'none', color: NEU.inkSoft, cursor: 'pointer', lineHeight: 0 }}>
          <X size={16} />
        </button>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        {/* Left: the organisation and the place */}
        <div className="flex flex-col gap-3">
          <div><Label>Organisation</Label><input value={d.ext_name} onChange={e => set('ext_name', e.target.value)} className="focus:outline-none" style={INPUT} /></div>
          <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div><Label>City</Label><input value={d.ext_city} onChange={e => set('ext_city', e.target.value)} className="focus:outline-none" style={INPUT} /></div>
            <div><Label>Country</Label><GSelect value={d.ext_country} onChange={v => set('ext_country', v)} options={countryOptions} searchable size="sm" /></div>
          </div>
          <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div><Label>Format</Label><GSelect value={d.ext_format} onChange={v => set('ext_format', v)} options={FORMAT_OPTIONS} size="sm" /></div>
            <div><Label>Role (optional)</Label><GSelect value={d.role} onChange={v => set('role', v)} options={ROLE_OPTIONS} size="sm" /></div>
          </div>
          <div><Label>Logo URL (optional)</Label><input value={d.ext_logo_url} onChange={e => set('ext_logo_url', e.target.value)} placeholder="https://" className="focus:outline-none" style={INPUT} /></div>
          <div><Label>Website (optional)</Label><input value={d.ext_website} onChange={e => set('ext_website', e.target.value)} placeholder="https://" className="focus:outline-none" style={INPUT} /></div>
          <div><Label>Deadline (optional)</Label><DatePicker value={d.deadline} onChange={v => set('deadline', v)} futureOnly clearable /></div>
        </div>

        {/* Right: the listing */}
        <div className="flex flex-col gap-3">
          <div><Label>Title</Label><input value={d.title} onChange={e => set('title', e.target.value)} maxLength={80} className="focus:outline-none" style={INPUT} /></div>
          <div>
            <Label>Description</Label>
            <textarea value={d.description} onChange={e => set('description', e.target.value)} rows={6} maxLength={4000} className="focus:outline-none" style={{ ...INPUT, resize: 'vertical' }} />
          </div>
          <div>
            <Label>Offers</Label>
            <div className="flex flex-wrap gap-2">
              {JOB_OFFER_ORDER.map(k => (
                <Toggle key={k} on={!!d.offers[k]} onClick={() => toggleOffer(k)}>{JOB_OFFER_LABEL[k]}</Toggle>
              ))}
            </div>
            {d.offers.paid && (
              <input value={d.offers.paid_amount ?? ''} onChange={e => set('offers', { ...d.offers, paid_amount: e.target.value })}
                placeholder="Amount, like $200" maxLength={40} className="focus:outline-none mt-2" style={{ ...INPUT, maxWidth: 240 }} />
            )}
          </div>
        </div>
      </div>

      {/* How people apply */}
      <div className="mt-5 flex flex-col gap-3">
        <Label>How people apply</Label>
        <div className="flex gap-2 flex-wrap">
          <Toggle on={d.premium_apply === 'link'} onClick={() => set('premium_apply', 'link')}>Outside link</Toggle>
          <Toggle on={d.premium_apply === 'form'} onClick={() => set('premium_apply', 'form')}>Gavelling form</Toggle>
        </div>
        {d.premium_apply === 'link' ? (
          <input value={d.outside_url} onChange={e => set('outside_url', e.target.value)} placeholder="https://" className="focus:outline-none" style={{ ...INPUT, maxWidth: 560 }} />
        ) : (
          <div className="flex flex-col gap-3">
            {d.questions.map((qq, i) => (
              <div key={qq.id} style={{ background: NEU.base, borderRadius: 12, boxShadow: NEU.inSm, padding: '12px 14px' }}>
                <div className="flex items-center gap-2 mb-2">
                  <p style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 700, color: NEU.inkSoft }}>Question {i + 1}</p>
                  <div className="flex-1" />
                  <button type="button" onClick={() => moveQuestion(i, -1)} disabled={i === 0} aria-label="Move up" className="focus:outline-none"
                    style={{ background: 'transparent', border: 'none', cursor: i === 0 ? 'default' : 'pointer', color: NEU.forest, opacity: i === 0 ? 0.35 : 1, lineHeight: 0 }}><ArrowUp size={15} /></button>
                  <button type="button" onClick={() => moveQuestion(i, 1)} disabled={i === d.questions.length - 1} aria-label="Move down" className="focus:outline-none"
                    style={{ background: 'transparent', border: 'none', cursor: i === d.questions.length - 1 ? 'default' : 'pointer', color: NEU.forest, opacity: i === d.questions.length - 1 ? 0.35 : 1, lineHeight: 0 }}><ArrowDown size={15} /></button>
                  <button type="button" onClick={() => removeQuestion(i)} aria-label="Remove question" className="focus:outline-none"
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: RED, lineHeight: 0 }}><Trash2 size={15} /></button>
                </div>
                <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <input value={qq.text} onChange={e => setQuestion(i, { text: e.target.value })} maxLength={200} placeholder="The question" className="focus:outline-none" style={INPUT} />
                  </div>
                  <div>
                    <Label>Type</Label>
                    <GSelect value={qq.type} size="sm" options={TYPE_OPTIONS}
                      onChange={v => setQuestion(i, {
                        type: v, ideal: null,
                        essential: v === 'text' ? false : qq.essential,
                        options: v === 'choice' ? (qq.options.length >= 2 ? qq.options : ['', '']) : [],
                      })} />
                  </div>
                  {qq.type !== 'text' && (
                    <div>
                      <Label>Ideal answer (optional)</Label>
                      <GSelect
                        value={qq.ideal ?? ''}
                        size="sm"
                        onChange={v => setQuestion(i, { ideal: v || null })}
                        options={[
                          { value: '', label: 'None' },
                          ...(qq.type === 'yesno'
                            ? [{ value: 'Yes', label: 'Yes' }, { value: 'No', label: 'No' }]
                            : Array.from(new Set(qq.options.map(o => o.trim()).filter(Boolean))).map(o => ({ value: o, label: o }))),
                        ]}
                      />
                    </div>
                  )}
                  {qq.type !== 'text' && (
                    <div className="flex items-end">
                      <Toggle on={qq.essential} onClick={() => setQuestion(i, { essential: !qq.essential })}>Essential</Toggle>
                    </div>
                  )}
                </div>
                {qq.type === 'choice' && (
                  <div className="mt-3 flex flex-col gap-2">
                    <Label>Choices (2 to 6)</Label>
                    {qq.options.map((o, oi) => (
                      <div key={oi} className="flex items-center gap-2">
                        <input value={o} onChange={e => setQuestion(i, { options: qq.options.map((x, xj) => (xj === oi ? e.target.value : x)) })}
                          placeholder={`Choice ${oi + 1}`} className="focus:outline-none" style={{ ...INPUT, maxWidth: 360 }} />
                        <button type="button" onClick={() => setQuestion(i, { options: qq.options.filter((_, xj) => xj !== oi), ideal: qq.ideal === o ? null : qq.ideal })}
                          disabled={qq.options.length <= 2} aria-label="Remove choice" className="focus:outline-none"
                          style={{ background: 'transparent', border: 'none', cursor: qq.options.length <= 2 ? 'default' : 'pointer', color: RED, opacity: qq.options.length <= 2 ? 0.35 : 1, lineHeight: 0 }}>
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                    {qq.options.length < 6 && (
                      <div><SoftButton onClick={() => setQuestion(i, { options: [...qq.options, ''] })}><Plus size={13} /> Add choice</SoftButton></div>
                    )}
                  </div>
                )}
              </div>
            ))}
            {d.questions.length < 5 && (
              <div><SoftButton onClick={addQuestion}><Plus size={13} /> Add question</SoftButton></div>
            )}
            <p style={{ fontFamily: OUTFIT, fontSize: 11.5, color: NEU.inkSoft }}>Up to 5 screening questions.</p>
          </div>
        )}
      </div>

      {problem && <p style={{ fontFamily: OUTFIT, fontSize: 12.5, color: RED, marginTop: 14, overflowWrap: 'anywhere' }}>{problem}</p>}

      <div className="flex items-center gap-2 flex-wrap mt-5">
        <MainButton onClick={() => void save(true)} busy={busy === 'publish'} disabled={!!busy}>{isLive ? 'Save and publish' : 'Publish'}</MainButton>
        <SoftButton onClick={() => void save(false)} busy={busy === 'draft'} disabled={!!busy}>{isLive ? 'Save changes' : 'Save draft'}</SoftButton>
        <SoftButton onClick={onClose} disabled={!!busy}>Cancel</SoftButton>
      </div>
    </div>
  );
}
