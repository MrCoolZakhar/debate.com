'use client';

// The delegation LEADER card (a head delegate or faculty advisor viewing their
// delegation), taste board 1A "Roster", 19 Oct 2026. Mounted by DelegationPanel
// in the You view's Delegation section; plain members keep DelegationPanel's
// own view. DelegationPanel owns the roster, the leaders' applications read,
// the import pop-up and the swap; this card draws them and adds its own reads
// (useLeaderData).
//
//   Header        the crest (round), the name in bold, "Delegation · City,
//                 Country" with the home country's round flag; the invite link
//                 itself, always shown with Copy (owner, 20 Oct 2026), and
//                 Import delegates. The page's next step lives in Overview now.
//   Stats         joined, seats given, paid, and Expected size with a stepper
//                 (the plus is "Buy another ticket": add_pledged_spots +1, which
//                 raises the size and makes the ticket; remove_pledged_spot_invoice on one of
//                 this leader's unpaid spots). The number moves on the tap;
//                 taps queue and are sent one at a time, each re-reading
//                 my_pay_overview in place, and a refusal puts the server's
//                 number back. Nothing here ever shows a loader. The minus
//                 stops at the delegates who rely on the delegation's tickets
//                 (Christian's answer 5: delegates, and head delegates who
//                 bought no tickets; a ticket-buying leader's own ticket is
//                 separate), so it drops when a delegate leaves.
//   People        PeopleTable, with the row menu (MemberMenu); it opens the
//                 committee pop-up itself. Swap allocations sits in its header
//                 beside Search people and opens its picker in that same spot
//                 (owner, 21 Oct 2026); a pending swap request and the recent
//                 swap notice stay under the table.
//   Right column  FinancialsCard, then the Open allocations list and the
//                 reshuffle line (both DELEGATIONS_V2_DB only)

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Minus, Plus, UserPlus } from 'lucide-react';
import { CircleFlag } from '@/components/CircleFlag';
import DelegationCrest from '@/components/DelegationCrest';
import { getCountryByCode } from '@/lib/countries';
import { committeeDisplayName } from '@/lib/presetNames';
import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { friendlyError, plainOrFallback } from '@/lib/friendlyError';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import type { PoolMember } from '@/app/manage/[slug]/assignment/delegationShared';
import DelegationInviteLink from '../DelegationInviteLink';
import type { RosterMember } from '../DelegationPanel';
import { removePledgedTicket, type PayOverview } from '../../pay/payApi';
import { DELEGATIONS_V2_DB } from './v2';
import { useLeaderData } from './useLeaderData';
import PeopleTable, { type PayTone, type PersonRow } from './PeopleTable';
import FinancialsCard from './FinancialsCard';
import { OpenSeatsCard, ReshuffleLine } from './OpenSeatsCard';
import {
  BTN_CLASS, cardStyle, committeeEmblemSrc, FONT, INK, INK_SOFT, primaryBtn, StatNumber, STROKE,
} from './leaderKit';

function payWord(m: RosterMember, pool: PoolMember | undefined): { word: string; tone: PayTone } | null {
  const s = m.payment_status;
  if (!s) return null;
  if (s === 'paid') return { word: pool?.self_paid === false ? 'Paid by delegation' : 'Paid', tone: 'ok' };
  if (s === 'waived') return { word: 'Waived', tone: 'soft' };
  if (s === 'refunded') return { word: 'Refunded', tone: 'soft' };
  return { word: m.role === 'faculty-advisor' ? 'Owes advisor fee' : 'Owes delegate fee', tone: 'owe' };
}

/** The position paper in words. Nothing for a person with no allocation, and
 *  nothing for a seated person with no paper yet: the table draws the Upload
 *  action in that cell instead (owner, 21 Oct 2026). */
function paperWord(status: string | undefined, role: RosterMember['role'], seated: boolean): { word: string; tone: PayTone } | null {
  if (role === 'faculty-advisor') return { word: 'Not needed', tone: 'soft' };
  if (!seated) return null;
  if (!status) return null;
  if (status === 'approved' || status === 'accepted') return { word: 'Accepted', tone: 'ok' };
  if (status === 'submitted' || status === 'reviewed') return { word: 'Submitted', tone: 'ok' };
  if (status === 'rejected' || status === 'needs_revision' || status === 'returned') return { word: 'Sent back', tone: 'owe' };
  return { word: status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' '), tone: 'soft' };
}

export default function LeaderCard({
  conferenceId, conferenceSlug, societyId, societyName, members, pool, paidCount, seatLogoFor,
  importAvailable, onImport, onChanged, swap, swapButton, swapTools, overlays,
}: {
  conferenceId: string;
  conferenceSlug: string;
  societyId: string;
  societyName: string;
  /** my_delegation_roster's members, the viewer first. */
  members: RosterMember[];
  /** The leaders' read of the accepted applications (POOL_MEMBER_SELECT). */
  pool: PoolMember[];
  paidCount: number;
  seatLogoFor: (m: PoolMember) => string | null;
  importAvailable: boolean;
  onImport: () => void;
  onChanged: () => Promise<void>;
  swap: { on: boolean; selected: string[]; toggle: (applicationId: string) => void };
  /** DelegationPanel's Swap allocations button, or its picker while swapping, drawn in the People header. */
  swapButton?: React.ReactNode;
  /** DelegationPanel's pending swap request and recent swap notice, drawn under the table. */
  swapTools: React.ReactNode;
  overlays: React.ReactNode;
}) {
  const poolById = useMemo(() => new Map(pool.map(p => [p.id, p] as const)), [pool]);
  const committeeIds = useMemo(() => pool.map(p => p.assigned_committee_id).filter((x): x is string => !!x), [pool]);
  const memberUserIds = useMemo(() => pool.map(p => p.user_id).filter((x): x is string => !!x), [pool]);
  const data = useLeaderData({ conferenceId, societyId, committeeIds, memberUserIds });
  const { pay, reloadPay, reloadV2 } = data;
  // Expected size, optimistic: the number shown while taps are queued or in
  // flight (null = the server's number). Taps wait in stepQueue and one
  // drain sends them in order, so the shown number and the server agree.
  const [shownExpected, setShownExpected] = useState<number | null>(null);
  const stepQueue = useRef<Array<1 | -1>>([]);
  const draining = useRef(false);
  const payRef = useRef<PayOverview | null>(pay);
  useEffect(() => { payRef.current = pay; }, [pay]);

  const rows: PersonRow[] = useMemo(() => members.map(m => {
    const p = poolById.get(m.application_id);
    const a = m.allocation;
    const committeeId = p?.assigned_committee_id ?? null;
    const info = committeeId ? data.committees.get(committeeId) : undefined;
    const cName = info?.name ?? a?.committee ?? p?.assigned_committee?.name ?? null;
    const cAbbr = info?.abbreviation ?? a?.committee_abbr ?? p?.assigned_committee?.abbreviation ?? null;
    const country = a?.country_name ?? p?.assigned_country_name ?? null;
    const code = a?.country_code ?? p?.assigned_country_code ?? null;
    const seated = !!(country && (cName || cAbbr)) && m.role !== 'faculty-advisor';
    return {
      application_id: m.application_id,
      name: m.name,
      avatar_url: m.avatar_url,
      role: m.role,
      is_me: m.is_me,
      claimed: m.claimed,
      user_id: p?.user_id ?? null,
      attending: p?.attending !== false,
      seat: seated ? {
        country_name: country,
        country_code: code,
        seatLogo: p ? seatLogoFor(p) : null,
        committee_id: committeeId,
        committee_label: (cAbbr ?? '').trim() || committeeDisplayName(cName, cAbbr),
        committee_full: cName,
        emblem: committeeEmblemSrc(info?.logo_url, cName, cAbbr),
      } : null,
      paper: DELEGATIONS_V2_DB && data.papers
        ? paperWord(p?.user_id ? data.papers.get(p.user_id) : undefined, m.role, seated)
        : null,
      paperDue: DELEGATIONS_V2_DB && !!data.papers && seated && !(p?.user_id && data.papers.has(p.user_id)),
      pay: payWord(m, p),
    };
  }), [members, poolById, data.committees, data.papers, seatLogoFor]);

  const joined = members.filter(m => m.claimed).length;
  const seated = rows.filter(r => !!r.seat).length;
  const openSeats = DELEGATIONS_V2_DB ? (data.openSeats ?? []) : [];
  const seatsGiven = seated + openSeats.length;
  const membersOwing = rows.filter(r => !r.is_me && r.pay?.tone === 'owe').length;

  // Expected size: the delegation's delegate tickets, every leader's together.
  const myDelegation = pay?.delegation?.find(d => d.society_id === societyId) ?? null;
  const expected = myDelegation?.delegate_tickets ?? null;
  const myLeaderApp = pay?.me.find(m => m.society_id === societyId && m.is_leader) ?? null;
  const removableCount = useMemo(
    () => (pay?.items ?? []).filter(i => i.kind === 'pledge_spot' && i.owner_is_me && i.removable).length,
    [pay],
  );
  const leaderAppId = myLeaderApp?.application_id ?? null;
  const shown = shownExpected ?? expected ?? 0;
  // The floor: delegates, plus head delegates who bought no tickets (a buyer's
  // own ticket is separate), who are not withdrawn or turned down.
  const floor = useMemo(() => members.filter(m => {
    if (m.status === 'withdrawn' || m.status === 'rejected') return false;
    if (m.role === 'delegate') return true;
    if (m.role !== 'head-delegate') return false;
    return (poolById.get(m.application_id)?.spots_pledged ?? 0) <= 0;
  }).length, [members, poolById]);
  const floorHint = `You have ${floor} ${floor === 1 ? 'delegate' : 'delegates'}, so you need at least ${floor} ${floor === 1 ? 'ticket' : 'tickets'}`;
  // Spots this leader could still take off: the unpaid ones they added, plus
  // the ones queued on top that the server has not drawn yet.
  const lowerable = removableCount + (shown - (expected ?? 0));

  // Re-reads everything in place after a row action (a role change, a move):
  // DelegationPanel's own re-read keeps the card mounted, never a loader.
  const refresh = useCallback(async () => {
    await Promise.all([onChanged(), reloadPay(), reloadV2()]);
  }, [onChanged, reloadPay, reloadV2]);

  /** One queued tap against the server. Null when it landed, else the sentence to show. */
  const sendStep = useCallback(async (dir: 1 | -1, current: PayOverview | null): Promise<string | null> => {
    if (dir > 0) {
      if (!leaderAppId) return 'The expected size could not be raised. Try again.';
      const fallback = 'The expected size could not be raised. Try again.';
      const c = await getFreshAuthedClient();
      if (!c) return 'Your session has expired. Refresh the page and sign in again.';
      const { data: out, error } = await c.rpc('add_pledged_spots', { p_application_id: leaderAppId, p_count: 1 });
      const r = out as { ok?: boolean; error?: string } | null;
      if (error) return friendlyError(error, fallback);
      if (!r?.ok) return plainOrFallback(r?.error, fallback);
      return null;
    }
    const own = (current?.items ?? []).filter(i => i.kind === 'pledge_spot' && i.owner_is_me && i.removable);
    const spot = own.length > 0 ? own[own.length - 1] : null;
    if (!spot) return 'Only a spot you added and have not paid can be removed here.';
    const r = await removePledgedTicket(spot.invoice_id);
    return r.ok ? null : r.error;
  }, [leaderAppId]);

  // Sends the queued taps one at a time. After each landed tap the overview is
  // re-read in place (the next minus needs a fresh unpaid spot); the shown
  // number is handed back to the server's only once the queue is empty, so it
  // never jumps. A refusal drops the taps still waiting and shows the server's
  // number again.
  const drain = useCallback(async () => {
    if (draining.current) return;
    draining.current = true;
    let current = payRef.current;
    let raised = false;
    let failed: string | null = null;
    try {
      while (stepQueue.current.length > 0) {
        const dir = stepQueue.current[0];
        const err = await sendStep(dir, current);
        if (err) { failed = err; break; }
        stepQueue.current.shift();
        if (dir > 0) raised = true;
        current = (await reloadPay()) ?? current;
      }
    } catch (e) {
      failed = friendlyError(e, 'That change was not saved. Try again.');
    } finally {
      if (failed) {
        stepQueue.current = [];
        await reloadPay();
        // A tap made while the number was being put back is dropped with it.
        stepQueue.current = [];
        notifyErr(failed);
      } else if (raised) {
        notifyOk('Expected size saved. New spots are on your Payments page.');
      }
      draining.current = false;
      setShownExpected(null);
    }
  }, [sendStep, reloadPay]);

  const step = useCallback((dir: 1 | -1) => {
    if (dir > 0 ? !leaderAppId : lowerable <= 0 || shown <= 0 || shown <= floor) return;
    stepQueue.current.push(dir);
    setShownExpected(prev => (prev ?? expected ?? 0) + dir);
    void drain();
  }, [leaderAppId, lowerable, shown, floor, expected, drain]);

  const home = data.society;
  const countryName = home?.country_code ? getCountryByCode(home.country_code)?.name ?? null : null;
  const place = [home?.city?.trim() || null, countryName].filter(Boolean).join(', ');
  const crestName = home?.name ?? societyName;

  const stepBtn = (dir: 1 | -1) => {
    const atFloor = dir < 0 && floor > 0 && shown <= floor;
    const off = dir > 0 ? !leaderAppId : lowerable <= 0 || shown <= 0 || atFloor;
    const Icon = dir > 0 ? Plus : Minus;
    return (
      <button
        type="button"
        onClick={() => step(dir)}
        aria-disabled={off}
        aria-label={dir > 0 ? 'Buy another ticket' : atFloor ? `Lower expected size. ${floorHint}` : 'Lower expected size'}
        title={dir > 0 ? 'Buy another ticket' : atFloor ? floorHint : off ? 'Only a spot you added and have not paid can be removed here' : undefined}
        className="inline-flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gv-main)]"
        style={{ width: 44, height: 44, margin: -6, padding: 0, border: 'none', background: 'transparent', cursor: off ? 'default' : 'pointer', opacity: off ? 0.4 : 1 }}
      >
        <span aria-hidden className="inline-flex items-center justify-center" style={{ width: 32, height: 32, borderRadius: 9, border: '1px solid color-mix(in srgb, var(--gv-main) 16%, transparent)', background: '#FFFFFF', color: 'var(--gv-main)' }}>
          <Icon size={17} strokeWidth={STROKE} aria-hidden />
        </span>
      </button>
    );
  };

  const statCell = 'flex items-center min-w-0 px-6 py-2 @[900px]:py-0 @[900px]:border-r @[900px]:border-[#EFEAE0]';

  return (
    <div className="@container flex flex-col gap-6 min-w-0">
      {/* Header */}
      <div className="flex items-center justify-between gap-x-6 gap-y-4 flex-wrap">
        <div className="flex items-center gap-4 min-w-0">
          <span style={{ borderRadius: '50%', boxShadow: '0 6px 18px color-mix(in srgb, var(--gv-main) 10%, transparent)', flexShrink: 0, background: '#FFFFFF' }}>
            <DelegationCrest name={crestName} logoUrl={home?.logo_url ?? null} size={56} />
          </span>
          <div className="min-w-0 flex flex-col gap-1">
            <h2 className="[overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 36, fontWeight: 700, letterSpacing: '-0.015em', color: INK, margin: 0, lineHeight: 1.15 }}>{societyName}</h2>
            <div className="flex items-center gap-2 [overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 14, color: INK_SOFT }}>
              {home?.country_code && <CircleFlag code={home.country_code} size={18} decorative />}
              {place ? `Delegation · ${place}` : 'Delegation'}
            </div>
          </div>
        </div>
        <div className="flex items-end gap-2.5 flex-wrap min-w-0">
          <DelegationInviteLink societyId={societyId} conferenceId={conferenceId} />
          {importAvailable && (
            <button type="button" onClick={onImport} className={BTN_CLASS} style={primaryBtn}>
              <UserPlus size={18} strokeWidth={STROKE} aria-hidden />
              Import delegates
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 @[900px]:grid-cols-4" style={{ ...cardStyle, padding: '20px 0' }}>
        <div className={statCell}><StatNumber n={joined} word="joined" /></div>
        <div className={statCell}><StatNumber n={seatsGiven} word="allocations given" /></div>
        <div className={statCell}><StatNumber n={paidCount} word="paid" /></div>
        <div className="flex items-center justify-between gap-3 min-w-0 px-6 py-2 @[900px]:py-0">
          <span style={{ fontFamily: FONT, fontSize: 15, color: INK_SOFT }}>Expected size</span>
          <div className="flex items-center gap-2.5">
            {stepBtn(-1)}
            <span style={{ fontFamily: FONT, fontSize: 22, fontWeight: 600, color: INK, minWidth: 28, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }} aria-live="polite">
              {shown}
            </span>
            {stepBtn(1)}
          </div>
        </div>
      </div>

      {/* People and Financials */}
      <div className="flex flex-col @[1040px]:flex-row gap-6 items-stretch @[1040px]:items-start">
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          <PeopleTable
            rows={rows}
            societyId={societyId}
            conferenceId={conferenceId}
            openSeats={DELEGATIONS_V2_DB ? data.openSeats : null}
            onChanged={refresh}
            swap={swap}
            societyName={societyName}
            headerAction={swapButton}
          />
          {swapTools}
        </div>
        <div className="w-full @[1040px]:w-[330px] flex-none flex flex-col gap-5">
          <FinancialsCard
            pay={pay}
            payError={data.payError}
            societyId={societyId}
            membersOwing={membersOwing}
            conferenceId={conferenceId}
            slug={conferenceSlug}
          />
          {DELEGATIONS_V2_DB && <OpenSeatsCard seats={openSeats} societyId={societyId} />}
          {DELEGATIONS_V2_DB && data.reshuffleUntil && <ReshuffleLine until={data.reshuffleUntil} />}
        </div>
      </div>

      {overlays}
    </div>
  );
}

