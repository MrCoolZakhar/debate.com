'use client';

// DelegationsBoard: the Delegations list inside Applications.
//
// Owner's decision (21 Sep 2026): delegations get their OWN list behind the
// People | Delegations switch, with their own rows, counts and filters. They
// never share rows with individual applications. Rationale, definitions and
// what happened to the old surfaces: docs/delegations-redesign.md.
//
// Reads: the applications the page already loaded (passed in), plus one
// load of its own for the conference's societies, advisor pledges, invoices
// and succeeded payments. Every figure is derived in delegationRows.ts.
//
// Writes: none of its own except "remove from delegation", which goes through
// the canonical removeFromDelegation (delegationShared.tsx). Accept all,
// reject all, message and remind to pay are the PAGE's existing handlers
// (runBulk + handleAccept / handleReject, the one-off composer,
// handleBulkRemindPay), passed in, so a decision made here is byte-identical
// to one made from the people list.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowUpRight, BadgeCheck, Ban, Check, ChevronDown, Crown, Hourglass, Mail, Search, UserMinus, UserRound, UsersRound, Wallet,
} from 'lucide-react';
import { getAuthedClient } from '@/lib/supabase-auth';
import { useAuth } from '@/components/AuthProvider';
import { useConfirmModal } from '@/components/ConfirmModal';
import { FlagImg } from '@/components/FlagImg';
import { NEU, NEU_GRADIENTS, OUTFIT, NeuCard, NeuIconDisc, NeuInset } from '@/components/neu';
import { currencySymbol } from '@/lib/currencies';
import { friendlyError } from '@/lib/friendlyError';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { MemberAvatar, removeFromDelegation, type PoolMember } from '@/app/manage/[slug]/assignment/delegationShared';
import { DelegationIdentity } from './DelegationAvatar';
import {
  buildDelegationRows, sortDelegationRows, memberName, ACCEPTED,
  type DelegationMemberLite, type DelegationRow, type SocietyLite, type InvoiceLite, type PaymentLite,
} from './delegationRows';

type DecideFilter = 'decide' | 'allocate' | 'any';
type MoneyFilter = 'owes' | 'paid' | 'any';

const ROLE_LABEL: Record<string, string> = {
  delegate: 'Delegate',
  'head-delegate': 'Head delegate',
  'faculty-advisor': 'Faculty advisor',
  observer: 'Observer',
  chair: 'Chair',
  secretariat: 'Secretariat',
};

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  submitted: { label: 'Waiting on you', color: '#8A5A12' },
  accepted: { label: 'Accepted', color: 'var(--gv-main)' },
  assigned: { label: 'Allocated', color: 'var(--gv-main)' },
  'checked-in': { label: 'Checked in', color: 'var(--gv-main)' },
  rejected: { label: 'Rejected', color: '#8B2020' },
  withdrawn: { label: 'Withdrawn', color: '#8B2020' },
};

function money(cents: number, cur: string): string {
  const amount = Math.round(cents) / 100;
  return `${currencySymbol(cur)}${amount.toLocaleString('en', { maximumFractionDigits: Number.isInteger(amount) ? 0 : 2 })}`;
}

/** Reads every page of a query (PostgREST caps a response at 1,000 rows), so
 *  a large conference's money is never silently cut off. */
async function pageAll<T>(
  run: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>,
): Promise<{ data: T[]; error: unknown }> {
  const PAGE = 1000;
  const out: T[] = [];
  for (let from = 0; from < 50_000; from += PAGE) {
    const { data, error } = await run(from, from + PAGE - 1);
    if (error) return { data: [], error };
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return { data: out, error: null };
}

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

export interface DelegationsBoardProps<M extends DelegationMemberLite> {
  conference: { id: string; slug: string; fee_currency: string };
  /** Every application the page loaded (all statuses). */
  applications: M[];
  /** Open drafts; those naming a delegation count as "still applying". */
  drafts: { society_id: string | null }[];
  /** The page's debounced, lower-cased search term. */
  search: string;
  /** Open this delegation when the board mounts or the value changes. */
  focusId: string | null;
  canAccept: (app: M) => boolean;
  canReject: (app: M) => boolean;
  onAcceptAll: (apps: M[], delegationName: string) => void;
  onRejectAll: (apps: M[], delegationName: string) => void;
  onMessage: (apps: M[]) => void;
  onRemindPay: (apps: M[]) => void;
  onOpenMember: (id: string) => void;
  /** A write here changed applications: the page reloads them silently. */
  onChanged: () => void;
  busy: boolean;
}

export default function DelegationsBoard<M extends DelegationMemberLite>(props: DelegationsBoardProps<M>) {
  const { conference, applications, drafts, search, focusId } = props;
  const { session } = useAuth();
  const accessToken = session?.access_token;
  const cur = (conference.fee_currency || 'USD').toUpperCase();
  const { confirm, modal: confirmModal } = useConfirmModal();

  const [societies, setSocieties] = useState<SocietyLite[] | null>(null);
  const [advisorsPledged, setAdvisorsPledged] = useState<Map<string, number>>(new Map());
  const [invoices, setInvoices] = useState<InvoiceLite[]>([]);
  const [payments, setPayments] = useState<PaymentLite[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);
  const [moneyUnavailable, setMoneyUnavailable] = useState(false);
  const [decide, setDecide] = useState<DecideFilter>('any');
  const [moneyFilter, setMoneyFilter] = useState<MoneyFilter>('any');
  const [openId, setOpenId] = useState<string | null>(focusId);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const loadSeq = useRef(0);

  // Focus a delegation handed in by the page (the name link on a person row,
  // or ?delegation=). Adjusted during render, not in an effect.
  const [seenFocus, setSeenFocus] = useState(focusId);
  if (focusId !== seenFocus) {
    setSeenFocus(focusId);
    if (focusId) setOpenId(focusId);
  }

  const load = useCallback(async () => {
    if (!accessToken) return;
    const seq = ++loadSeq.current;
    const supabase = getAuthedClient(accessToken);
    const [socRes, advRes, invRes, payRes] = await Promise.all([
      supabase.from('societies')
        .select('id, name, spots_purchased, advisor_spots_purchased, created_at, city, country_code, logo_url')
        .eq('conference_id', conference.id)
        .order('name', { ascending: true }),
      supabase.from('applications')
        .select('id, advisors_pledged')
        .eq('conference_id', conference.id)
        .gt('advisors_pledged', 0),
      pageAll<InvoiceLite>((from, to) => supabase.from('invoices')
        .select('id, application_id, society_id, kind, status, amount_cents, amount_paid_cents, currency')
        .eq('conference_id', conference.id)
        .order('id', { ascending: true })
        .range(from, to)),
      pageAll<PaymentLite>((from, to) => supabase.from('payments')
        .select('id, invoice_id, amount_cents, currency, method, invoices!inner(conference_id)')
        .eq('invoices.conference_id', conference.id)
        .eq('status', 'succeeded')
        .order('id', { ascending: true })
        .range(from, to)),
    ]);
    if (seq !== loadSeq.current) return;
    if (socRes.error) {
      setLoadFailed(true);
      // Logged, never shown: the card below says what failed in plain words.
      friendlyError(socRes.error, 'The delegations could not be loaded.');
      return;
    }
    setLoadFailed(false);
    setSocieties((socRes.data ?? []) as SocietyLite[]);
    const adv = new Map<string, number>();
    for (const r of (advRes.data ?? []) as { id: string; advisors_pledged: number | null }[]) adv.set(r.id, r.advisors_pledged ?? 0);
    setAdvisorsPledged(adv);
    // Money reads failing must not blank the list: the rows still decide
    // and chase, and the money column says it could not be read.
    setInvoices(invRes.error ? [] : invRes.data);
    setPayments(payRes.error ? [] : payRes.data);
    setMoneyUnavailable(!!(invRes.error || payRes.error));
  }, [accessToken, conference.id]);

  // Refetch when the applications change in a way that can move money or
  // spots (a status or payment flip, a member leaving), debounced so a bulk
  // accept of forty rows is one read, not forty.
  const version = useMemo(
    () => applications.map(a => `${a.id}:${a.status}:${a.payment_status}:${a.society_id ?? ''}`).join('|'),
    [applications],
  );
  useEffect(() => {
    const t = setTimeout(() => { void load(); }, societies === null ? 0 : 900);
    return () => clearTimeout(t);
    // `societies` is read only to skip the delay on the first load.
  }, [load, version]); // eslint-disable-line react-hooks/exhaustive-deps

  const draftsBySociety = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of drafts) if (d.society_id) m.set(d.society_id, (m.get(d.society_id) ?? 0) + 1);
    return m;
  }, [drafts]);

  const rows = useMemo(() => {
    if (!societies) return [];
    return sortDelegationRows(buildDelegationRows<M>({
      societies, members: applications, advisorsPledged, draftsBySociety, invoices, payments, currency: cur,
    }));
  }, [societies, applications, advisorsPledged, draftsBySociety, invoices, payments, cur]);

  const visible = useMemo(() => rows.filter(r => {
    if (decide === 'decide' && r.pending.length === 0) return false;
    if (decide === 'allocate' && !(r.seatable > r.allocated)) return false;
    if (moneyFilter === 'owes' && r.dueCents <= 0) return false;
    if (moneyFilter === 'paid' && !(r.dueCents <= 0 && (r.receivedCents + r.offlineCents) > 0)) return false;
    if (search) {
      const hay = [r.name, r.country ?? '', ...r.members.map(m => `${memberName(m)} ${m.profiles?.email ?? m.invited_email ?? ''}`)]
        .join(' ').toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  }), [rows, decide, moneyFilter, search]);

  const totals = useMemo(() => ({
    delegations: rows.length,
    expected: rows.reduce((s, r) => s + (r.expected ?? 0), 0),
    registered: rows.reduce((s, r) => s + r.registered, 0),
    waiting: rows.reduce((s, r) => s + r.pending.length, 0),
    waitingDelegations: rows.filter(r => r.pending.length > 0).length,
    owing: rows.filter(r => r.dueCents > 0).length,
  }), [rows]);

  async function handleRemove(row: DelegationRow<M>, m: M) {
    if (!session || removingId) return;
    const paidByPool = m.payment_status === 'paid' && !m.self_paid;
    const paidSelf = m.payment_status === 'paid' && m.self_paid;
    const { confirmed } = await confirm({
      title: `Remove ${memberName(m)} from ${row.name}?`,
      body: [
        paidSelf
          ? 'They paid for themselves, so their spot leaves with them.'
          : paidByPool
            ? 'Their spot was paid for by the delegation, so it stays behind and shows as open. They will owe their own fee.'
            : 'They will apply as an individual from now on.',
        'Their committee allocation stays. They get an email saying they left the delegation.',
      ].join(' '),
      confirmLabel: 'Remove',
      danger: true,
    });
    if (!confirmed) return;
    setRemovingId(m.id);
    try {
      const supabase = getAuthedClient(session.access_token);
      const { error } = await removeFromDelegation(supabase, conference.id, m as unknown as PoolMember, true, session.user.id);
      if (error) notifyErr(friendlyError(error, `Could not fully remove ${memberName(m)}. Refresh and check their delegation.`), 'applications');
      else notifyOk(`${memberName(m)} left ${row.name}.`, 'applications');
    } catch (e) {
      notifyErr(friendlyError(e, `Could not remove ${memberName(m)}. Please try again.`), 'applications');
    } finally {
      setRemovingId(null);
      props.onChanged();
    }
  }

  if (societies === null && !loadFailed) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: NEU.forest, borderTopColor: 'transparent' }} />
      </div>
    );
  }

  return (
    <div>
      {confirmModal}
      <style>{`
        .dlgRow { transition: background-color 180ms cubic-bezier(0.22,1,0.36,1); }
        .dlgRow:hover { background-color: rgba(27,56,40,0.022); }
        .dlgRowBtn:focus-visible { box-shadow: inset 0 0 0 2.5px var(--gv-main); }
        .dlgMember:hover { background-color: rgba(27,56,40,0.035); }
        .dlgMember:focus-visible { outline: none; box-shadow: inset 0 0 0 2px var(--gv-main); }
        .dlgIconBtn:focus-visible, .dlgAct:focus-visible { outline: none; box-shadow: 0 0 0 2.5px var(--gv-main); }
      `}</style>

      {loadFailed && (
        <NeuCard style={{ padding: '28px 24px', marginBottom: 16 }}>
          <p style={{ fontFamily: OUTFIT, fontSize: 13.5, fontWeight: 700, color: NEU.ink }}>
            The delegations could not be loaded.
          </p>
          <button onClick={() => { void load(); }} className="dlgAct mt-2 focus:outline-none"
            style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 800, color: NEU.forest, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
            Try again
          </button>
        </NeuCard>
      )}

      {/* Own counts. Plain typography, no pills (CLAUDE.md §8). */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
        {[
          { label: 'Delegations', value: totals.delegations },
          { label: 'Expected', value: totals.expected, hint: 'Places pledged, or confirmed as paid for when there is no pledge' },
          { label: 'Registered', value: totals.registered, hint: 'Members who have applied and are coming' },
          { label: 'Waiting on you', value: totals.waiting, hint: `${plural(totals.waitingDelegations, 'delegation')} with members to decide` },
          { label: 'Owe money', value: totals.owing, hint: 'Delegations with an open balance on an accepted member or on their pledge' },
        ].map(t => (
          <div key={t.label} title={t.hint} style={{ padding: '12px 14px', borderRadius: 16, backgroundColor: NEU.surface, boxShadow: NEU.outSm }}>
            <p style={{ fontFamily: OUTFIT, fontSize: 24, fontWeight: 900, color: NEU.ink, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>{t.value}</p>
            <p style={{ fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 700, color: NEU.inkSoft, marginTop: 2 }}>{t.label}</p>
          </div>
        ))}
      </div>

      {/* Own filters: two always-visible segmented controls. */}
      <div className="flex items-center gap-3 flex-wrap mb-4">
        <Segmented
          label="Show"
          value={decide}
          onChange={setDecide}
          options={[{ v: 'decide', label: 'To decide' }, { v: 'allocate', label: 'To allocate' }, { v: 'any', label: 'Any' }]}
        />
        <Segmented
          label="Money"
          value={moneyFilter}
          onChange={setMoneyFilter}
          options={[{ v: 'owes', label: 'Owes money' }, { v: 'paid', label: 'Paid up' }, { v: 'any', label: 'Any' }]}
        />
        {(visible.length !== rows.length) && (
          <span style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 700, color: NEU.inkSoft }}>
            Showing {visible.length} of {rows.length}
          </span>
        )}
      </div>

      {moneyUnavailable && (
        <p className="mb-3" style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 700, color: '#8A5A12' }}>
          Payments could not be read just now, so money is left out below. Refresh to try again.
        </p>
      )}

      {rows.length === 0 && !loadFailed && (
        <NeuCard style={{ padding: '44px 24px' }}>
          <div className="flex flex-col items-center text-center">
            <NeuIconDisc gradient={NEU_GRADIENTS.forest} icon={UsersRound} size={48} />
            <p className="mt-4" style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 15, color: NEU.ink }}>No delegations yet</p>
            <p className="mt-1 max-w-md" style={{ fontFamily: OUTFIT, fontSize: 12.5, color: NEU.inkSoft }}>
              A delegation starts when a head delegate or faculty advisor applies and names their school or society. Its members then join with the delegation&apos;s invite link.
            </p>
          </div>
        </NeuCard>
      )}

      {rows.length > 0 && visible.length === 0 && (
        <NeuCard style={{ padding: '36px 24px' }}>
          <div className="flex flex-col items-center text-center">
            <Search size={22} style={{ color: NEU.muted }} />
            <p className="mt-3" style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 14.5, color: NEU.ink }}>No delegation matches</p>
            <button onClick={() => { setDecide('any'); setMoneyFilter('any'); }} className="dlgAct mt-2 focus:outline-none"
              style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 800, color: NEU.forest, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
              Show every delegation
            </button>
          </div>
        </NeuCard>
      )}

      <div className="flex flex-col gap-3">
        {visible.map(r => (
          <DelegationRowCard
            key={r.id}
            row={r}
            cur={cur}
            open={openId === r.id}
            onToggle={() => setOpenId(id => (id === r.id ? null : r.id))}
            conferenceSlug={conference.slug}
            moneyUnavailable={moneyUnavailable}
            busy={props.busy}
            removingId={removingId}
            canAccept={props.canAccept}
            canReject={props.canReject}
            onAcceptAll={props.onAcceptAll}
            onRejectAll={props.onRejectAll}
            onMessage={props.onMessage}
            onRemindPay={props.onRemindPay}
            onOpenMember={props.onOpenMember}
            onRemove={m => { void handleRemove(r, m); }}
          />
        ))}
      </div>
    </div>
  );
}

// ── Segmented control ────────────────────────────────────────────────────────

function Segmented<V extends string>({ label, value, onChange, options }: {
  label: string; value: V; onChange: (v: V) => void; options: { v: V; label: string }[];
}) {
  return (
    <div className="inline-flex items-center gap-2" role="radiogroup" aria-label={label}>
      <span style={{ fontFamily: OUTFIT, fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', color: NEU.inkSoft, textTransform: 'uppercase' }}>{label}</span>
      <NeuInset className="inline-flex p-1" style={{ borderRadius: 999, gap: 2 }}>
        {options.map(o => {
          const active = o.v === value;
          return (
            <button
              key={o.v}
              role="radio"
              aria-checked={active}
              onClick={() => onChange(o.v)}
              className="dlgAct focus:outline-none"
              style={{
                padding: '6px 13px', borderRadius: 999, border: 'none', cursor: 'pointer',
                fontFamily: OUTFIT, fontSize: 12, fontWeight: 800,
                background: active ? `linear-gradient(135deg, ${NEU_GRADIENTS.forest[0]}, ${NEU_GRADIENTS.forest[1]})` : 'transparent',
                color: active ? NEU.gold : NEU.inkSoft,
                boxShadow: active ? NEU.outSm : 'none',
                transition: 'color 180ms, box-shadow 180ms',
              }}
            >
              {o.label}
            </button>
          );
        })}
      </NeuInset>
    </div>
  );
}

// ── One delegation ───────────────────────────────────────────────────────────

function DelegationRowCard<M extends DelegationMemberLite>({
  row, cur, open, onToggle, conferenceSlug, moneyUnavailable, busy, removingId,
  canAccept, canReject, onAcceptAll, onRejectAll, onMessage, onRemindPay, onOpenMember, onRemove,
}: {
  row: DelegationRow<M>;
  cur: string;
  open: boolean;
  onToggle: () => void;
  conferenceSlug: string;
  moneyUnavailable: boolean;
  busy: boolean;
  removingId: string | null;
  canAccept: (app: M) => boolean;
  canReject: (app: M) => boolean;
  onAcceptAll: (apps: M[], name: string) => void;
  onRejectAll: (apps: M[], name: string) => void;
  onMessage: (apps: M[]) => void;
  onRemindPay: (apps: M[]) => void;
  onOpenMember: (id: string) => void;
  onRemove: (m: M) => void;
}) {
  const acceptable = row.pending.filter(canAccept);
  const rejectable = row.pending.filter(canReject);
  const blocked = row.pending.length - acceptable.length;
  // The delegation's leader: its head delegate, else its faculty advisor
  // (either can found a delegation and pledge for it).
  const head = row.heads[0]
    ?? row.members.find(m => m.role === 'faculty-advisor' && m.status !== 'rejected' && m.status !== 'withdrawn')
    ?? null;
  const headRole = head ? (head.is_head_delegate || head.role === 'head-delegate' ? 'Head Delegate' : 'Faculty Advisor') : null;
  const panelId = `dlg-panel-${row.id}`;
  const messageable = row.members.filter(m => m.status !== 'rejected' && m.status !== 'withdrawn');
  const owing = row.members.filter(m => row.owingMemberIds.includes(m.id));
  const seatPct = row.seatable > 0 ? Math.round((row.allocated / row.seatable) * 100) : 0;
  const empty = row.members.length === 0;

  return (
    <NeuCard style={{ padding: 0, overflow: 'hidden' }}>
      <div className="dlgRow grid grid-cols-3 lg:grid-cols-[minmax(0,2.1fr)_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1.3fr)_minmax(150px,auto)] gap-x-5 gap-y-3 items-center" style={{ padding: '14px 16px' }}>
        {/* Identity: the whole block is the expander. */}
        <button
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={panelId}
          className="dlgRowBtn col-span-3 lg:col-span-1 flex items-center gap-3 min-w-0 text-left focus:outline-none"
          style={{ background: 'none', border: 'none', padding: 4, margin: -4, borderRadius: 14, cursor: 'pointer' }}
        >
          <ChevronDown size={16} strokeWidth={2.6} style={{ color: NEU.muted, flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 200ms' }} />
          <DelegationIdentity
            name={row.name}
            size={56}
            nameSize={17}
            members={row.registered}
            country={row.country}
            city={row.city}
            countryCode={row.countryCode}
            logoUrl={row.logoUrl}
            lead={head ? `${memberName(head)}${row.heads.length > 1 ? ` and ${row.heads.length - 1} more` : ''}` : null}
            leadRole={headRole}
          />
        </button>

        {/* Members: expected over registered. */}
        <div className="min-w-0" title="Expected: places pledged (or confirmed as paid for). Registered: members who applied and are coming.">
          {empty && row.applying === 0 ? (
            <p style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 700, color: NEU.inkSoft }}>No members yet</p>
          ) : (
            <>
              <p style={{ fontFamily: OUTFIT, fontSize: 13.5, fontWeight: 800, color: NEU.ink, fontVariantNumeric: 'tabular-nums' }}>
                {row.expected != null ? `${row.expected} expected` : 'No pledge'}
                <span style={{ color: NEU.inkSoft, fontWeight: 700, display: 'inline-block' }}>&nbsp;/ {row.registered} registered</span>
              </p>
              <p style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 600, color: NEU.inkSoft, fontVariantNumeric: 'tabular-nums' }}>
                {row.accepted} accepted
                {row.applying > 0 ? ` · ${row.applying} still applying` : ''}
              </p>
            </>
          )}
        </div>

        {/* Seats. */}
        <div className="min-w-0">
          {row.seatable > 0 ? (
            <>
              <p style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 800, color: NEU.ink, fontVariantNumeric: 'tabular-nums' }}>
                {row.allocated}/{row.seatable} <span style={{ fontWeight: 700, color: NEU.inkSoft }}>seated</span>
              </p>
              <div role="progressbar" aria-label="Allocated" aria-valuemin={0} aria-valuemax={row.seatable} aria-valuenow={row.allocated}
                style={{ marginTop: 5, height: 5, borderRadius: 999, backgroundColor: 'rgba(27,56,40,0.1)', overflow: 'hidden', maxWidth: 140 }}>
                <div style={{ width: `${seatPct}%`, height: '100%', borderRadius: 999, background: row.allocated === row.seatable ? 'var(--gv-main)' : 'var(--gv-accent)' }} />
              </div>
            </>
          ) : (
            <p style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 700, color: NEU.inkSoft }}>Nobody to seat yet</p>
          )}
        </div>

        {/* Money: the payments ledger, never payment_status x fee. */}
        <div className="min-w-0" title="From the payments ledger. Paid through Gavelling and recorded offline are shown apart.">
          {moneyUnavailable ? (
            <p style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 700, color: NEU.inkSoft }}>Not available</p>
          ) : (
            <>
              <p className="flex items-center gap-1.5" style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 800, color: NEU.ink, fontVariantNumeric: 'tabular-nums' }}>
                <Wallet size={13} strokeWidth={2.4} style={{ color: NEU.deepGold, flexShrink: 0 }} aria-hidden />
                {row.receivedCents > 0
                  ? `${money(row.receivedCents, cur)} paid`
                  : row.offlineCents > 0 ? `${money(row.offlineCents, cur)} offline` : 'Nothing paid yet'}
              </p>
              <p style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 700, color: row.dueCents > 0 ? '#9A3D12' : NEU.inkSoft, fontVariantNumeric: 'tabular-nums' }}>
                {row.receivedCents > 0 && row.offlineCents > 0 ? `${money(row.offlineCents, cur)} offline · ` : ''}
                {row.dueCents > 0 ? `${money(row.dueCents, cur)} due` : 'Nothing due'}
                {row.otherCurrency ? ' · other currency not shown' : ''}
              </p>
            </>
          )}
        </div>

        {/* Decision on the waiting members, through the page's bulk path. */}
        <div className="col-span-3 lg:col-span-1 flex items-center gap-2 lg:justify-end">
          {row.pending.length > 0 ? (
            <>
              <button
                onClick={() => onAcceptAll(acceptable, row.name)}
                disabled={busy || acceptable.length === 0}
                title={blocked > 0 ? `${plural(blocked, 'member')} cannot be accepted here: a required fee is unpaid, or they are secretariat.` : `Accept the ${plural(acceptable.length, 'waiting member')}`}
                className="dlgAct inline-flex items-center gap-1.5 focus:outline-none"
                style={{
                  padding: '9px 14px', borderRadius: 999, border: 'none',
                  cursor: busy || acceptable.length === 0 ? 'not-allowed' : 'pointer',
                  opacity: acceptable.length === 0 ? 0.5 : 1,
                  fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 800, color: '#EED98A',
                  background: `linear-gradient(135deg, ${NEU_GRADIENTS.forest[0]}, ${NEU_GRADIENTS.forest[1]})`, boxShadow: NEU.outSm,
                  whiteSpace: 'nowrap',
                }}
              >
                <Check size={14} strokeWidth={2.8} /> Accept {acceptable.length}
              </button>
              <button
                onClick={() => onRejectAll(rejectable, row.name)}
                disabled={busy || rejectable.length === 0}
                aria-label={`Reject the ${plural(rejectable.length, 'waiting member')} of ${row.name}`}
                title={`Reject the ${plural(rejectable.length, 'waiting member')}`}
                className="dlgIconBtn inline-flex items-center justify-center focus:outline-none"
                style={{ width: 36, height: 36, borderRadius: 999, border: 'none', cursor: 'pointer', color: '#8B2020', backgroundColor: NEU.surface, boxShadow: NEU.outSm }}
              >
                <Ban size={15} strokeWidth={2.5} />
              </button>
            </>
          ) : row.pledgeAwaiting ? (
            <span className="inline-flex items-center gap-1.5" style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 700, color: '#8A5A12' }}>
              <Hourglass size={13} strokeWidth={2.4} /> Pledge not confirmed
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5" style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 700, color: NEU.inkSoft }}>
              <BadgeCheck size={13} strokeWidth={2.4} style={{ color: empty ? NEU.muted : NEU.forest }} /> Nobody waiting
            </span>
          )}
        </div>
      </div>

      {open && (
        <div id={panelId} style={{ borderTop: '1px solid rgba(27,56,40,0.08)', padding: '14px 16px 16px', backgroundColor: 'rgba(27,56,40,0.018)' }}>
          {/* Delegation actions. */}
          <div className="flex items-center gap-2 flex-wrap mb-3">
            <PanelAction icon={Mail} label="Message delegation" disabled={busy || messageable.length === 0}
              title={messageable.length === 0 ? 'Nobody to write to yet' : `Write to ${plural(messageable.length, 'member')}`}
              onClick={() => onMessage(messageable)} />
            <PanelAction icon={Wallet} label={owing.length > 0 ? `Remind ${owing.length} to pay` : 'Remind to pay'} disabled={busy || owing.length === 0}
              title={owing.length === 0 ? 'Nobody in this delegation owes money' : 'Re-sends the "you can pay now" email. Anyone reminded in the last 24 hours is skipped.'}
              onClick={() => onRemindPay(owing)} />
            <Link
              href={`/manage/${conferenceSlug}/assignment?mode=delegations&delegation=${row.id}`}
              className="dlgAct inline-flex items-center gap-1.5 focus:outline-none"
              style={{ padding: '8px 13px', borderRadius: 999, fontFamily: OUTFIT, fontSize: 12, fontWeight: 800, color: NEU.ink, backgroundColor: NEU.surface, boxShadow: NEU.outSm, textDecoration: 'none' }}
            >
              <ArrowUpRight size={14} strokeWidth={2.5} /> Open in Assignment
            </Link>
          </div>

          {(row.pledged > 0 || row.purchased > 0) && (
            <p className="mb-3" style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 600, color: NEU.inkSoft }}>
              {row.pledged > 0 ? `Pledged ${plural(row.pledged, 'place')}. ` : ''}
              {row.purchased > 0 ? `${plural(row.purchased, 'place')} confirmed as paid for. ` : ''}
              {row.pledgeAwaiting ? 'The pledge is not confirmed as paid yet.' : row.pledged > 0 ? 'The pledge is confirmed.' : ''}
            </p>
          )}

          {row.members.length === 0 ? (
            <p style={{ fontFamily: OUTFIT, fontSize: 12.5, color: NEU.inkSoft }}>
              {row.applying > 0 ? `${plural(row.applying, 'person is', 'people are')} still filling in an application for this delegation.` : 'Nobody has applied with this delegation yet.'}
            </p>
          ) : (
            <ul className="flex flex-col" style={{ gap: 4 }}>
              {row.members.map(m => (
                <MemberLine key={m.id} m={m} owes={row.owingMemberIds.includes(m.id)}
                  removing={removingId === m.id} disabled={busy || !!removingId}
                  onOpen={() => onOpenMember(m.id)} onRemove={() => onRemove(m)} />
              ))}
            </ul>
          )}
        </div>
      )}
    </NeuCard>
  );
}

function PanelAction({ icon: Icon, label, title, disabled, onClick }: {
  icon: typeof Mail; label: string; title: string; disabled: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick} disabled={disabled} title={title}
      className="dlgAct inline-flex items-center gap-1.5 focus:outline-none"
      style={{
        padding: '8px 13px', borderRadius: 999, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
        fontFamily: OUTFIT, fontSize: 12, fontWeight: 800, color: NEU.ink, backgroundColor: NEU.surface, boxShadow: NEU.outSm,
      }}>
      <Icon size={14} strokeWidth={2.5} /> {label}
    </button>
  );
}

function MemberLine<M extends DelegationMemberLite>({ m, owes, removing, disabled, onOpen, onRemove }: {
  m: M; owes: boolean; removing: boolean; disabled: boolean; onOpen: () => void; onRemove: () => void;
}) {
  const name = memberName(m);
  const status = STATUS_LABEL[m.status] ?? { label: m.status, color: NEU.inkSoft };
  const allocated = !!m.assigned_committee_id && ACCEPTED.has(m.status);
  const committee = m.assigned_committee?.abbreviation || m.assigned_committee?.name || null;
  const payment = m.payment_status === 'waived' ? 'Waived'
    : m.payment_status === 'paid' ? (m.self_paid ? 'Paid' : 'Covered by delegation')
    : owes ? 'Owes' : 'Not paid';
  const dead = m.status === 'rejected' || m.status === 'withdrawn';
  return (
    <li className="flex items-center gap-2" style={{ opacity: dead || !m.attending ? 0.6 : 1 }}>
      <button onClick={onOpen} className="dlgMember flex-1 min-w-0 flex items-center gap-3 text-left focus:outline-none"
        style={{ padding: '8px 10px', borderRadius: 12, background: 'none', border: 'none', cursor: 'pointer' }}>
        <MemberAvatar name={name} url={m.profiles?.avatar_url ?? null} size={34} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 min-w-0">
            <span className="min-w-0 [overflow-wrap:anywhere]" style={{ fontFamily: OUTFIT, fontSize: 13.5, fontWeight: 800, color: NEU.ink, lineHeight: 1.25 }}>{name}</span>
            {(m.is_head_delegate || m.role === 'head-delegate') && (
              <Crown size={13} strokeWidth={2.4} style={{ color: NEU.deepGold, flexShrink: 0 }} aria-label="Head delegate" />
            )}
          </span>
          <span className="flex items-center gap-1.5 flex-wrap" style={{ fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 600, color: NEU.inkSoft }}>
            <span>{ROLE_LABEL[m.role] ?? m.role}</span>
            <span aria-hidden>·</span>
            <span style={{ color: status.color, fontWeight: 700 }}>{m.attending ? status.label : 'Not attending'}</span>
            {allocated && (
              <>
                <span aria-hidden>·</span>
                <span className="inline-flex items-center gap-1">
                  {m.assigned_country_code && <FlagImg code={m.assigned_country_code} size={15} />}
                  {committee}{m.assigned_country_name ? ` ${m.assigned_country_name}` : ''}
                </span>
              </>
            )}
            <span className="sm:hidden" aria-hidden>·</span>
            <span className="sm:hidden" style={{ color: owes ? '#9A3D12' : undefined }}>{payment}</span>
          </span>
        </span>
        <span className="hidden sm:inline" style={{ fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 700, color: owes ? '#9A3D12' : NEU.inkSoft, whiteSpace: 'nowrap' }}>
          {payment}
        </span>
      </button>
      {!dead && (
        <button onClick={onRemove} disabled={disabled}
          aria-label={`Remove ${name} from the delegation`} title="Remove from the delegation"
          className="dlgIconBtn inline-flex items-center justify-center flex-shrink-0 focus:outline-none"
          style={{ width: 34, height: 34, borderRadius: 999, border: 'none', background: 'none', color: '#8B2020', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled && !removing ? 0.5 : 1 }}>
          {removing
            ? <span className="w-3.5 h-3.5 rounded-full border-2 animate-spin" style={{ borderColor: '#8B2020', borderTopColor: 'transparent' }} />
            : <UserMinus size={15} strokeWidth={2.4} />}
        </button>
      )}
    </li>
  );
}

// ── People | Delegations switch ──────────────────────────────────────────────
// Mounted by the page above its stat tiles. The Delegations side carries the
// number of delegations with members waiting on a decision, so the "clear the
// inbox" signal a unified queue gives is still on screen.

export function PeopleDelegationsSwitch({ view, onChange, applications }: {
  view: 'people' | 'delegations';
  onChange: (v: 'people' | 'delegations') => void;
  applications: { status: string; attending: boolean; society_id: string | null }[];
}) {
  const waiting = useMemo(() => {
    const ids = new Set<string>();
    for (const a of applications) if (a.society_id && a.status === 'submitted' && a.attending) ids.add(a.society_id);
    return ids.size;
  }, [applications]);
  const opts: { v: 'people' | 'delegations'; label: string; icon: typeof Mail }[] = [
    { v: 'people', label: 'People', icon: UserRound },
    { v: 'delegations', label: 'Delegations', icon: UsersRound },
  ];
  return (
    <NeuInset className="inline-flex p-1.5 mb-5" style={{ borderRadius: 999, gap: 4 }}>
      <div role="tablist" aria-label="Show applications by" className="inline-flex" style={{ gap: 4 }}>
        {opts.map(o => {
          const active = view === o.v;
          const Icon = o.icon;
          return (
            <button
              key={o.v}
              role="tab"
              aria-selected={active}
              onClick={() => onChange(o.v)}
              className="dlgSwitch inline-flex items-center gap-2 focus:outline-none"
              style={{
                padding: '8px 16px', borderRadius: 999, border: 'none', cursor: 'pointer',
                fontFamily: OUTFIT, fontSize: 13, fontWeight: 800,
                background: active ? `linear-gradient(135deg, ${NEU_GRADIENTS.forest[0]}, ${NEU_GRADIENTS.forest[1]})` : 'transparent',
                color: active ? NEU.gold : NEU.inkSoft,
                boxShadow: active ? NEU.outSm : 'none',
                transition: 'color 180ms, box-shadow 180ms',
              }}
            >
              <Icon size={15} strokeWidth={2.5} aria-hidden />
              {o.label}
              {o.v === 'delegations' && waiting > 0 && (
                <span title={`${plural(waiting, 'delegation')} with members waiting on you`}
                  style={{ fontVariantNumeric: 'tabular-nums', color: active ? NEU.gold : '#8A5A12' }}>
                  {waiting}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <style>{`.dlgSwitch:focus-visible { box-shadow: 0 0 0 2.5px var(--gv-main); }`}</style>
    </NeuInset>
  );
}
