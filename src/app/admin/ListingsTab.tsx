'use client';

// ─────────────────────────────────────────────────────────────────────────────
// /admin → Listings tab.
//
// Every conference Gavelling lists itself (`conferences.listed_by = 'gavelling'`,
// plan: docs/conferences/claimable-listings.md, types: src/lib/listings.ts):
// public, private (below the bar, or the switch is off) and hidden (archived).
// Two staff actions per row, both asked IN PLACE under the row, never a modal:
//
//   • Hand over to organiser: the organiser's account is found by email through
//     admin_user_directory (an exact, case-insensitive match among its results),
//     confirmed, then transfer_listing_to_organiser runs. That RPC queues ONE
//     email to the organiser; it is the only thing this tab does that sends mail.
//   • Hide / Show again: set_gavelling_listing_hidden.
//
// SECURITY: same model as the sibling tabs. `conferences` is readable by anyone
// (SELECT policy `true`), so the list itself is not a secret; both writes are
// SECURITY DEFINER RPCs that raise 'not authorised' unless the caller is staff.
// A UI that renders here is not a permission.
//
// The switch (store_flags.listings_live) is read only. It is turned on in the
// database, never from this console.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight, Building2, CalendarClock, Check, CircleAlert, EyeOff, Globe,
  History, Lock, MapPin, Power, Search, UserCheck,
} from 'lucide-react';
import Loader from '@/components/Loader';
import { useAuth } from '@/components/AuthProvider';
import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { friendlyError } from '@/lib/friendlyError';
import { notifyOk } from '@/lib/appNotify';
import { formatConferenceDates, DATES_TO_BE_DECIDED } from '@/lib/conferenceDates';
import { isPastListing, listingDisplayName, listingMeta, type ListingMeta } from '@/lib/listings';
import { NEU, NEU_GRADIENTS, OUTFIT, EASE, NeuCard, NeuInset } from '@/components/neu';
import { NUM, RED, fmtDate, int } from './staffBits';

// ── Types ───────────────────────────────────────────────────────────────────

interface ListingRow {
  id: string;
  slug: string;
  full_name: string;
  acronym: string | null;
  start_date: string | null;
  end_date: string | null;
  dates_tbd: boolean | null;
  city: string | null;
  country: string | null;
  format: string | null;
  is_public: boolean;
  status: string;
  listing_meta: unknown;
  created_at: string;
}

interface HandedOverRow {
  id: string;
  slug: string;
  full_name: string;
  acronym: string | null;
  listing_meta: unknown;
}

type ListingState = 'public' | 'private' | 'hidden';
type Filter = 'all' | ListingState;

interface Listing extends ListingRow {
  meta: ListingMeta | null;
  state: ListingState;
  past: boolean;
  /** null when the bar check could not be read. */
  meetsBar: boolean | null;
  /** null when the committee count could not be read. */
  committees: number | null;
}

interface Person { id: string; display_name: string; email: string }

const COLUMNS = 'id, slug, full_name, acronym, start_date, end_date, dates_tbd, city, country, format, is_public, status, listing_meta, created_at';

function stateOf(r: ListingRow): ListingState {
  if (r.status === 'archived') return 'hidden';
  if (r.is_public && r.status === 'public') return 'public';
  return 'private';
}

const STATE_LABEL: Record<ListingState, string> = { public: 'Public', private: 'Private', hidden: 'Hidden' };
const STATE_ICON: Record<ListingState, typeof Globe> = { public: Globe, private: Lock, hidden: EyeOff };

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'public', label: 'Public' },
  { key: 'private', label: 'Private' },
  { key: 'hidden', label: 'Hidden' },
];

function placeOf(r: ListingRow): string {
  if (r.format === 'online') return 'Online';
  const where = [r.city, r.country].map(s => (s ?? '').trim()).filter(Boolean).join(', ');
  if (!where) return 'No place yet';
  return r.format === 'hybrid' ? `${where} and online` : where;
}

/** The shared formatter joins ranges with an en dash; this surface says "to". */
function datesOf(r: ListingRow): string {
  if (r.dates_tbd || !r.start_date) return DATES_TO_BE_DECIDED;
  return formatConferenceDates(r.start_date, r.end_date, { style: 'dmy' }).replace(/\s*[–—]\s*/g, ' to ');
}

/** Newest checked first; a row with no check date sorts by when it was made. */
function checkedKey(l: { meta: ListingMeta | null; created_at?: string }): string {
  return l.meta?.checked_at || l.created_at || '';
}

// ── Small pieces ────────────────────────────────────────────────────────────

function Btn({
  children, onClick, tone = 'plain', disabled, icon: Icon,
}: {
  children: React.ReactNode;
  onClick: () => void;
  tone?: 'main' | 'plain' | 'danger';
  disabled?: boolean;
  icon?: typeof Globe;
}) {
  const main = tone === 'main';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 focus:outline-none"
      style={{
        padding: '7px 13px', borderRadius: 12, border: 'none',
        cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.55 : 1,
        fontFamily: OUTFIT, fontSize: 12, fontWeight: 700,
        color: main ? NEU.gold : tone === 'danger' ? RED : NEU.forest,
        background: main
          ? `linear-gradient(135deg, ${NEU_GRADIENTS.forest[0]}, ${NEU_GRADIENTS.forest[1]})`
          : NEU.surface,
        boxShadow: NEU.outSm,
        transition: `box-shadow 200ms ${EASE}, opacity 200ms ${EASE}`,
      }}
    >
      {Icon && <Icon size={13} strokeWidth={2.4} />}
      {children}
    </button>
  );
}

function Fact({ icon: Icon, children, title, strong }: { icon: typeof Globe; children: React.ReactNode; title?: string; strong?: boolean }) {
  return (
    <span
      title={title}
      className="inline-flex items-center gap-1.5"
      style={{ fontFamily: OUTFIT, fontSize: 12, color: strong ? NEU.ink : NEU.inkSoft, fontWeight: strong ? 700 : 400, ...NUM }}
    >
      <Icon size={13} strokeWidth={2.2} style={{ color: NEU.deepGold, flexShrink: 0 }} />
      {children}
    </span>
  );
}

/** Short form big, the full name smaller beneath (CLAUDE.md §8 rule 11). */
function ListingName({ full_name, acronym }: { full_name: string; acronym: string | null }) {
  const short = listingDisplayName({ full_name, acronym });
  return (
    <div className="min-w-0" style={{ overflowWrap: 'anywhere' }}>
      <p style={{ fontFamily: OUTFIT, fontSize: 15, fontWeight: 800, color: NEU.ink, lineHeight: 1.25 }}>{short}</p>
      {short !== full_name && (
        <p style={{ fontFamily: OUTFIT, fontSize: 12, color: NEU.inkSoft, lineHeight: 1.35, marginTop: 2 }}>{full_name}</p>
      )}
    </div>
  );
}

// ── Hand over, asked in place ───────────────────────────────────────────────

function HandoverPanel({ listing, onCancel, onDone }: {
  listing: Listing;
  onCancel: () => void;
  onDone: () => void;
}) {
  const [email, setEmail] = useState('');
  const [looking, setLooking] = useState(false);
  const [sending, setSending] = useState(false);
  const [person, setPerson] = useState<Person | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const name = listingDisplayName(listing);

  const find = async () => {
    const wanted = email.trim().toLowerCase();
    if (!wanted || !wanted.includes('@')) { setProblem('Type the organiser’s account email'); return; }
    setLooking(true);
    setProblem(null);
    setPerson(null);
    try {
      const supabase = await getFreshAuthedClient();
      if (!supabase) throw new Error('signed out');
      const { data, error } = await supabase.rpc('admin_user_directory', {
        p_search: wanted, p_sort: 'newest', p_limit: 20, p_offset: 0,
      });
      if (error) throw error;
      const matches = ((data ?? []) as Person[]).filter(u => (u.email ?? '').trim().toLowerCase() === wanted);
      if (matches.length === 0) setProblem('No account uses that email. They must sign up on Gavelling first');
      else if (matches.length > 1) setProblem('More than one account uses that email. Check it in the Users tab');
      else setPerson(matches[0]);
    } catch (e) {
      setProblem(friendlyError(e, 'Could not look that account up. Try again'));
    } finally {
      setLooking(false);
    }
  };

  const handOver = async () => {
    if (!person) return;
    setSending(true);
    setProblem(null);
    try {
      const supabase = await getFreshAuthedClient();
      if (!supabase) throw new Error('signed out');
      const { data, error } = await supabase.rpc('transfer_listing_to_organiser', {
        p_conference: listing.id, p_user: person.id,
      });
      if (error) throw error;
      const res = (data ?? {}) as { ok?: boolean; email_queued?: boolean };
      if (!res.ok) throw new Error('not ok');
      const who = person.display_name || person.email;
      notifyOk(res.email_queued
        ? `Handed ${name} over to ${who}. Their email is queued`
        : `Handed ${name} over to ${who}. No email was queued`);
      onDone();
    } catch (e) {
      setProblem(friendlyError(e, 'Could not hand this listing over. Nothing changed'));
      setSending(false);
    }
  };

  const who = person ? (person.display_name || person.email) : '';

  return (
    <NeuInset small style={{ padding: '14px 16px', marginTop: 12 }}>
      {!person ? (
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor={`handover-${listing.id}`} style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 700, color: NEU.ink }}>
            Organiser&apos;s account email
          </label>
          <div
            className="flex items-center gap-2"
            style={{ padding: '7px 12px', borderRadius: 12, backgroundColor: NEU.surface, boxShadow: NEU.outSm }}
          >
            <Search size={13} style={{ color: NEU.muted }} />
            <input
              id={`handover-${listing.id}`}
              type="email"
              value={email}
              autoFocus
              onChange={e => { setEmail(e.target.value); setProblem(null); }}
              onKeyDown={e => { if (e.key === 'Enter') void find(); if (e.key === 'Escape') onCancel(); }}
              placeholder="name@example.com"
              className="focus:outline-none"
              style={{ fontFamily: OUTFIT, fontSize: 12.5, background: 'transparent', border: 'none', color: NEU.ink, width: 240 }}
            />
          </div>
          <Btn tone="main" onClick={() => void find()} disabled={looking || !email.trim()}>
            {looking ? 'Looking' : 'Find account'}
          </Btn>
          <Btn onClick={onCancel} disabled={looking}>Cancel</Btn>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2" style={{ overflowWrap: 'anywhere' }}>
            <UserCheck size={15} style={{ color: NEU.forest, flexShrink: 0 }} />
            <span style={{ fontFamily: OUTFIT, fontSize: 13, color: NEU.ink }}>
              <strong>{person.display_name || 'No name'}</strong>
              <span style={{ color: NEU.inkSoft }}> {person.email}</span>
            </span>
          </div>
          <p style={{ fontFamily: OUTFIT, fontSize: 13, color: NEU.ink, overflowWrap: 'anywhere' }}>
            Hand {name} over to {who}? They get one email.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Btn tone="main" icon={UserCheck} onClick={() => void handOver()} disabled={sending}>
              {sending ? 'Handing over' : 'Hand over'}
            </Btn>
            <Btn onClick={() => { setPerson(null); setProblem(null); }} disabled={sending}>Use another email</Btn>
            <Btn onClick={onCancel} disabled={sending}>Cancel</Btn>
          </div>
        </div>
      )}
      {problem && (
        <p className="flex items-center gap-1.5" style={{ marginTop: 10, fontFamily: OUTFIT, fontSize: 12.5, color: RED, fontWeight: 600 }}>
          <CircleAlert size={13} style={{ flexShrink: 0 }} />
          {problem}
        </p>
      )}
    </NeuInset>
  );
}

// ── Hide, asked in place ────────────────────────────────────────────────────

function HideConfirm({ onCancel, onConfirm, busy, problem }: {
  onCancel: () => void;
  onConfirm: () => void;
  busy: boolean;
  problem: string | null;
}) {
  return (
    <NeuInset small style={{ padding: '14px 16px', marginTop: 12 }}>
      <div className="flex flex-wrap items-center gap-2.5">
        <p style={{ fontFamily: OUTFIT, fontSize: 13, color: NEU.ink }}>Hide this listing? It leaves the site at once.</p>
        <Btn tone="danger" icon={EyeOff} onClick={onConfirm} disabled={busy}>{busy ? 'Hiding' : 'Hide'}</Btn>
        <Btn onClick={onCancel} disabled={busy}>Cancel</Btn>
      </div>
      {problem && (
        <p className="flex items-center gap-1.5" style={{ marginTop: 10, fontFamily: OUTFIT, fontSize: 12.5, color: RED, fontWeight: 600 }}>
          <CircleAlert size={13} style={{ flexShrink: 0 }} />
          {problem}
        </p>
      )}
    </NeuInset>
  );
}

// ── One listing ─────────────────────────────────────────────────────────────

type OpenPanel = { id: string; kind: 'handover' | 'hide' } | null;

function ListingCard({ l, open, setOpen, onChanged }: {
  l: Listing;
  open: OpenPanel;
  setOpen: (p: OpenPanel) => void;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const StateIcon = STATE_ICON[l.state];
  const panel = open?.id === l.id ? open.kind : null;

  const setHidden = async (hidden: boolean) => {
    setBusy(true);
    setProblem(null);
    try {
      const supabase = await getFreshAuthedClient();
      if (!supabase) throw new Error('signed out');
      const { data, error } = await supabase.rpc('set_gavelling_listing_hidden', { p_conference: l.id, p_hidden: hidden });
      if (error) throw error;
      if (!(data as { ok?: boolean } | null)?.ok) throw new Error('not ok');
      notifyOk(hidden ? 'Listing hidden' : 'Listing shown again');
      setOpen(null);
      onChanged();
    } catch (e) {
      const msg = friendlyError(e, hidden ? 'Could not hide this listing. Try again' : 'Could not show this listing again. Try again');
      setProblem(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <NeuCard style={{ padding: '16px 18px' }}>
      <div className="flex flex-col md:flex-row md:items-start gap-3">
        <div className="flex-1 min-w-0">
          <ListingName full_name={l.full_name} acronym={l.acronym} />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5" style={{ marginTop: 8 }}>
            <Fact icon={MapPin}>{placeOf(l)}</Fact>
            <Fact icon={CalendarClock}>{datesOf(l)}</Fact>
            {l.committees !== null && (
              <Fact icon={Building2}>{int(l.committees)} {l.committees === 1 ? 'committee' : 'committees'}</Fact>
            )}
            {l.past && <Fact icon={History}>Past</Fact>}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5" style={{ marginTop: 6 }}>
            <Fact icon={StateIcon} strong>{STATE_LABEL[l.state]}</Fact>
            {l.meetsBar === null
              ? <Fact icon={CircleAlert}>Bar not checked</Fact>
              : l.meetsBar
                ? <Fact icon={Check} strong>Meets the bar</Fact>
                : <Fact icon={CircleAlert} strong>Below the bar</Fact>}
            <Fact icon={Search}>Checked {l.meta ? fmtDate(l.meta.checked_at) : 'never'}</Fact>
            <Fact icon={UserCheck}>Added by {l.meta ? (l.meta.added_by === 'admin' ? 'staff' : 'Claude') : 'unknown'}</Fact>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 md:justify-end" style={{ flexShrink: 0 }}>
          <a
            href={`/conferences/${l.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 focus:outline-none"
            style={{
              padding: '7px 13px', borderRadius: 12, textDecoration: 'none',
              fontFamily: OUTFIT, fontSize: 12, fontWeight: 700, color: NEU.forest,
              backgroundColor: NEU.surface, boxShadow: NEU.outSm,
            }}
          >
            <ArrowUpRight size={13} strokeWidth={2.4} />
            Open page
          </a>
          {l.state !== 'hidden' && (
            <Btn
              icon={UserCheck}
              onClick={() => { setProblem(null); setOpen(panel === 'handover' ? null : { id: l.id, kind: 'handover' }); }}
              disabled={busy}
            >
              Hand over to organiser
            </Btn>
          )}
          {l.state === 'hidden' ? (
            <Btn icon={Globe} onClick={() => void setHidden(false)} disabled={busy}>{busy ? 'Showing' : 'Show again'}</Btn>
          ) : (
            <Btn
              icon={EyeOff}
              tone="danger"
              onClick={() => { setProblem(null); setOpen(panel === 'hide' ? null : { id: l.id, kind: 'hide' }); }}
              disabled={busy}
            >
              Hide
            </Btn>
          )}
        </div>
      </div>

      {panel === 'handover' && (
        <HandoverPanel listing={l} onCancel={() => setOpen(null)} onDone={() => { setOpen(null); onChanged(); }} />
      )}
      {panel === 'hide' && (
        <HideConfirm onCancel={() => setOpen(null)} onConfirm={() => void setHidden(true)} busy={busy} problem={problem} />
      )}
      {!panel && problem && (
        <p className="flex items-center gap-1.5" style={{ marginTop: 10, fontFamily: OUTFIT, fontSize: 12.5, color: RED, fontWeight: 600 }}>
          <CircleAlert size={13} style={{ flexShrink: 0 }} />
          {problem}
        </p>
      )}
    </NeuCard>
  );
}

function SectionTitle({ children, count }: { children: React.ReactNode; count: number }) {
  return (
    <h2 className="flex items-baseline gap-2" style={{ fontFamily: OUTFIT, fontSize: 17, fontWeight: 800, color: NEU.ink, marginTop: 8 }}>
      {children}
      <span style={{ fontSize: 13, fontWeight: 600, color: NEU.inkSoft, ...NUM }}>{int(count)}</span>
    </h2>
  );
}

// ── The tab ─────────────────────────────────────────────────────────────────

export default function ListingsTab() {
  const { session, loading: authLoading } = useAuth();
  const userId = session?.user?.id ?? null;
  const [listings, setListings] = useState<Listing[] | null>(null);
  const [handedOver, setHandedOver] = useState<{ row: HandedOverRow; meta: ListingMeta | null }[]>([]);
  const [live, setLive] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [open, setOpen] = useState<OpenPanel>(null);

  // A re-read after an action keeps the list on screen; only the first read
  // shows the loader (listings stays null until it lands).
  const load = useCallback(async () => {
    try {
      const supabase = await getFreshAuthedClient();
      if (!supabase) throw new Error('signed out');

      const [listRes, liveRes, handedRes] = await Promise.all([
        supabase.from('conferences').select(COLUMNS).eq('listed_by', 'gavelling'),
        supabase.rpc('listings_live'),
        supabase
          .from('conferences')
          .select('id, slug, full_name, acronym, listing_meta')
          .eq('listed_by', 'organiser')
          .not('listing_meta->>transferred_at', 'is', null),
      ]);
      if (listRes.error) throw listRes.error;
      const rows = (listRes.data ?? []) as ListingRow[];

      setLive(liveRes.error ? null : liveRes.data === true);

      // The bar, one anon-callable check per row. A failed check is "not
      // checked", never "below the bar".
      const bars = await Promise.all(rows.map(async r => {
        const { data, error: e } = await supabase.rpc('gavelling_listing_meets_bar', { p_conference: r.id });
        return e ? null : data === true;
      }));

      // Committee counts, read in chunks so the id list never makes a long URL.
      // A failed read leaves the counts off.
      let counts: Map<string, number> | null = new Map();
      const ids = rows.map(r => r.id);
      for (let i = 0; i < ids.length && counts; i += 100) {
        const { data, error: e } = await supabase
          .from('conference_committees')
          .select('conference_id')
          .in('conference_id', ids.slice(i, i + 100));
        if (e) { counts = null; break; }
        for (const c of (data ?? []) as { conference_id: string }[]) {
          counts.set(c.conference_id, (counts.get(c.conference_id) ?? 0) + 1);
        }
      }

      const built: Listing[] = rows.map((r, i) => ({
        ...r,
        meta: listingMeta(r),
        state: stateOf(r),
        past: isPastListing(r),
        meetsBar: bars[i],
        committees: counts ? counts.get(r.id) ?? 0 : null,
      }));
      built.sort((a, b) => checkedKey(b).localeCompare(checkedKey(a)));
      setListings(built);

      if (!handedRes.error) {
        const h = ((handedRes.data ?? []) as HandedOverRow[]).map(row => ({ row, meta: listingMeta(row) }));
        h.sort((a, b) => (b.meta?.transferred_at ?? '').localeCompare(a.meta?.transferred_at ?? ''));
        setHandedOver(h);
      }
      setError(null);
    } catch (e) {
      setError(friendlyError(e, 'Could not load the listings. Try again'));
      setListings(prev => prev ?? []);
    }
  }, []);

  useEffect(() => {
    if (authLoading || !userId) return;
    void Promise.resolve().then(() => load());
  }, [authLoading, userId, load]);

  const counts = useMemo(() => {
    const all = listings ?? [];
    return {
      all: all.length,
      public: all.filter(l => l.state === 'public').length,
      private: all.filter(l => l.state === 'private').length,
      hidden: all.filter(l => l.state === 'hidden').length,
    };
  }, [listings]);

  const shown = useMemo(() => (listings ?? []).filter(l => filter === 'all' || l.state === filter), [listings, filter]);
  const current = shown.filter(l => !l.past);
  const past = shown.filter(l => l.past);

  if (authLoading || (userId && listings === null && !error)) {
    return <div className="flex items-center justify-center py-16"><Loader /></div>;
  }
  if (!userId) {
    return (
      <p className="py-12 text-center" style={{ fontFamily: OUTFIT, fontSize: 13, color: NEU.inkSoft }}>
        Sign in to see the listings.
      </p>
    );
  }

  return (
    <div className="flex flex-col" style={{ gap: 14 }}>
      {/* The switch, read only. */}
      <NeuInset small className="flex flex-wrap items-center gap-x-2 gap-y-1" style={{ padding: '10px 14px' }}>
        <Power size={14} strokeWidth={2.4} style={{ color: live ? NEU.forest : NEU.inkSoft, flexShrink: 0 }} />
        <span style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 800, color: NEU.ink }}>
          {live === null ? 'Listings switch could not be read' : live ? 'Listings are on' : 'Listings are off'}
        </span>
        <span style={{ fontFamily: OUTFIT, fontSize: 12.5, color: NEU.inkSoft }}>
          {live === false
            ? 'Every listing stays private until it is turned on.'
            : live
              ? 'Listings that meet the bar are public.'
              : ''}
          {' '}It is turned on in the database (the chat&apos;s Supabase work), not here.
        </span>
      </NeuInset>

      {error && (
        <NeuCard style={{ padding: '14px 18px' }}>
          <p className="flex items-center gap-2" style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 700, color: RED }}>
            <CircleAlert size={14} />
            {error}
          </p>
          <div style={{ marginTop: 10 }}>
            <Btn onClick={() => void load()}>Try again</Btn>
          </div>
        </NeuCard>
      )}

      {/* Filter by status. */}
      {listings && listings.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map(f => {
            const on = filter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                aria-pressed={on}
                className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 focus:outline-none"
                style={{
                  fontFamily: OUTFIT, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none',
                  background: on ? `linear-gradient(135deg, ${NEU_GRADIENTS.forest[0]}, ${NEU_GRADIENTS.forest[1]})` : NEU.surface,
                  color: on ? NEU.gold : NEU.ink,
                  boxShadow: NEU.outSm,
                  transition: `background 200ms ${EASE}, color 200ms ${EASE}`,
                  ...NUM,
                }}
              >
                {f.label}
                <span style={{ fontWeight: 600, opacity: 0.8 }}>{int(counts[f.key])}</span>
              </button>
            );
          })}
        </div>
      )}

      {listings && listings.length === 0 && !error && (
        <p className="py-12 text-center" style={{ fontFamily: OUTFIT, fontSize: 13, color: NEU.inkSoft }}>
          No Gavelling listings yet.
        </p>
      )}

      {listings && listings.length > 0 && shown.length === 0 && (
        <p className="py-10 text-center" style={{ fontFamily: OUTFIT, fontSize: 13, color: NEU.inkSoft }}>
          No listings with this status.
        </p>
      )}

      {current.length > 0 && (
        <>
          <SectionTitle count={current.length}>Current and Upcoming</SectionTitle>
          <div className="grid grid-cols-1 xl:grid-cols-2" style={{ gap: 12 }}>
            {current.map(l => <ListingCard key={l.id} l={l} open={open} setOpen={setOpen} onChanged={() => void load()} />)}
          </div>
        </>
      )}

      {past.length > 0 && (
        <>
          <SectionTitle count={past.length}>Past Listings</SectionTitle>
          <div className="grid grid-cols-1 xl:grid-cols-2" style={{ gap: 12 }}>
            {past.map(l => <ListingCard key={l.id} l={l} open={open} setOpen={setOpen} onChanged={() => void load()} />)}
          </div>
        </>
      )}

      {handedOver.length > 0 && (
        <>
          <SectionTitle count={handedOver.length}>Handed Over</SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3" style={{ gap: 12 }}>
            {handedOver.map(({ row, meta }) => (
              <NeuCard key={row.id} style={{ padding: '14px 16px' }}>
                <ListingName full_name={row.full_name} acronym={row.acronym} />
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5" style={{ marginTop: 8 }}>
                  <Fact icon={UserCheck}>Handed over {meta?.transferred_at ? fmtDate(meta.transferred_at) : ''}</Fact>
                  <a
                    href={`/conferences/${row.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 focus:outline-none"
                    style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 700, color: NEU.forest, textDecoration: 'underline' }}
                  >
                    Open page
                    <ArrowUpRight size={12} />
                  </a>
                </div>
              </NeuCard>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
