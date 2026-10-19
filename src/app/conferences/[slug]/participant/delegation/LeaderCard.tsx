'use client';

// The delegation LEADER card (a head delegate or faculty advisor viewing their
// delegation), taste board 1A "Roster", 19 Oct 2026. Mounted by DelegationPanel
// in the You view's Delegation section; plain members keep DelegationPanel's
// own view. DelegationPanel owns the roster, the leaders' applications read,
// the import pop-up and the swap; this card draws them and adds its own reads
// (useLeaderData).
//
//   Header        the crest (round), the name, "Delegation · City, Country"
//                 with the home country's round flag; Copy invite link and
//                 Import delegates
//   Stats         joined, seats given, paid, and Expected size with a stepper
//                 (add_pledged_spots +1, remove_pledged_spot_invoice on one of
//                 this leader's unpaid spots)
//   People        PeopleTable, with the row menu (MemberMenu)
//   Financials    FinancialsCard
//   Open seats    and the reshuffle line, DELEGATIONS_V2_DB only

import { useCallback, useMemo, useRef, useState } from 'react';
import { Minus, Plus, UserPlus } from 'lucide-react';
import { CircleFlag } from '@/components/CircleFlag';
import { getCountryByCode } from '@/lib/countries';
import { committeeDisplayName } from '@/lib/presetNames';
import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { friendlyError, plainOrFallback } from '@/lib/friendlyError';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import type { PoolMember } from '@/app/manage/[slug]/assignment/delegationShared';
import DelegationInviteLink from '../DelegationInviteLink';
import type { RosterMember } from '../DelegationPanel';
import { removePledgedTicket } from '../../pay/payApi';
import { DELEGATIONS_V2_DB } from './v2';
import { useLeaderData } from './useLeaderData';
import PeopleTable, { type PayTone, type PersonRow } from './PeopleTable';
import FinancialsCard from './FinancialsCard';
import { OpenSeatsCard, ReshuffleLine } from './OpenSeatsCard';
import CommitteePopup from './CommitteePopup';
import {
  BTN_CLASS, cardStyle, committeeEmblemSrc, FONT, INK, INK_SOFT, primaryBtn, RoundAvatar, secondaryBtn, StatNumber, STROKE,
} from './leaderKit';

function payWord(m: RosterMember, pool: PoolMember | undefined): { word: string; tone: PayTone } | null {
  const s = m.payment_status;
  if (!s) return null;
  if (s === 'paid') return { word: pool?.self_paid === false ? 'Paid by delegation' : 'Paid', tone: 'ok' };
  if (s === 'waived') return { word: 'Waived', tone: 'soft' };
  if (s === 'refunded') return { word: 'Refunded', tone: 'soft' };
  return { word: m.role === 'faculty-advisor' ? 'Owes advisor fee' : 'Owes delegate fee', tone: 'owe' };
}

function paperWord(status: string | undefined, role: RosterMember['role'], seated: boolean): { word: string; tone: PayTone } {
  if (role === 'faculty-advisor') return { word: 'Not needed', tone: 'soft' };
  if (!seated) return { word: 'No seat yet', tone: 'soft' };
  if (!status) return { word: 'Not yet', tone: 'soft' };
  if (status === 'approved' || status === 'accepted') return { word: 'Accepted', tone: 'ok' };
  if (status === 'submitted' || status === 'reviewed') return { word: 'Submitted', tone: 'ok' };
  if (status === 'rejected' || status === 'needs_revision' || status === 'returned') return { word: 'Sent back', tone: 'owe' };
  return { word: status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' '), tone: 'soft' };
}

export default function LeaderCard({
  conferenceId, conferenceSlug, societyId, societyName, members, pool, paidCount, seatLogoFor,
  importAvailable, onImport, onChanged, swap, swapTools, overlays,
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
  /** DelegationPanel's swap banner and control, drawn under the table. */
  swapTools: React.ReactNode;
  overlays: React.ReactNode;
}) {
  const poolById = useMemo(() => new Map(pool.map(p => [p.id, p] as const)), [pool]);
  const committeeIds = useMemo(() => pool.map(p => p.assigned_committee_id).filter((x): x is string => !!x), [pool]);
  const memberUserIds = useMemo(() => pool.map(p => p.user_id).filter((x): x is string => !!x), [pool]);
  const data = useLeaderData({ conferenceId, societyId, committeeIds, memberUserIds });
  const { pay, reloadPay, reloadV2 } = data;
  const [openCommittee, setOpenCommittee] = useState<string | null>(null);
  const [stepBusy, setStepBusy] = useState(false);
  const stepBusyRef = useRef(false);

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
  const removableSpot = useMemo(() => {
    const own = (pay?.items ?? []).filter(i => i.kind === 'pledge_spot' && i.owner_is_me && i.removable);
    return own.length > 0 ? own[own.length - 1] : null;
  }, [pay]);

  const refresh = useCallback(async () => {
    await Promise.all([onChanged(), reloadPay(), reloadV2()]);
  }, [onChanged, reloadPay, reloadV2]);

  const step = useCallback(async (dir: 1 | -1) => {
    if (stepBusyRef.current) return;
    stepBusyRef.current = true;
    setStepBusy(true);
    try {
      if (dir > 0) {
        if (!myLeaderApp) return;
        const fallback = 'The expected size could not be raised. Try again.';
        const c = await getFreshAuthedClient();
        if (!c) { notifyErr('Your session has expired. Refresh the page and sign in again.'); return; }
        const { data: out, error } = await c.rpc('add_pledged_spots', { p_application_id: myLeaderApp.application_id, p_count: 1 });
        const r = out as { ok?: boolean; error?: string } | null;
        if (error) { notifyErr(friendlyError(error, fallback)); return; }
        if (!r?.ok) { notifyErr(plainOrFallback(r?.error, fallback)); return; }
        notifyOk('Expected size raised by one. The new spot is on your Payments page.');
      } else {
        if (!removableSpot) return;
        const r = await removePledgedTicket(removableSpot.invoice_id);
        if (!r.ok) { notifyErr(r.error); return; }
        notifyOk('Expected size lowered by one.');
      }
      await refresh();
    } catch (e) {
      notifyErr(friendlyError(e, 'That change was not saved. Try again.'));
    } finally {
      stepBusyRef.current = false;
      setStepBusy(false);
    }
  }, [myLeaderApp, removableSpot, refresh]);

  const home = data.society;
  const countryName = home?.country_code ? getCountryByCode(home.country_code)?.name ?? null : null;
  const place = [home?.city?.trim() || null, countryName].filter(Boolean).join(', ');
  const crestName = home?.name ?? societyName;

  const stepBtn = (dir: 1 | -1) => {
    const off = stepBusy || (dir > 0 ? !myLeaderApp : !removableSpot);
    const Icon = dir > 0 ? Plus : Minus;
    return (
      <button
        type="button"
        onClick={() => { void step(dir); }}
        aria-disabled={off}
        disabled={stepBusy}
        aria-label={dir > 0 ? 'Raise expected size' : 'Lower expected size'}
        title={dir < 0 && !removableSpot ? 'Only a spot you added and have not paid can be removed here' : undefined}
        className="inline-flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
        style={{ width: 44, height: 44, margin: -6, padding: 0, border: 'none', background: 'transparent', cursor: off ? 'default' : 'pointer', opacity: off ? 0.4 : 1 }}
      >
        <span aria-hidden className="inline-flex items-center justify-center" style={{ width: 32, height: 32, borderRadius: 9, border: '1px solid rgba(27,56,40,0.16)', background: '#FFFFFF', color: '#1B3828' }}>
          <Icon size={17} strokeWidth={STROKE} aria-hidden />
        </span>
      </button>
    );
  };

  const committeePeople = openCommittee
    ? rows.filter(r => r.seat?.committee_id === openCommittee).map(r => ({
        application_id: r.application_id, name: r.name, avatar_url: r.avatar_url,
        country_name: r.seat?.country_name ?? null, country_code: r.seat?.country_code ?? null, seatLogo: r.seat?.seatLogo ?? null,
      }))
    : [];
  const openInfo = openCommittee ? rows.find(r => r.seat?.committee_id === openCommittee)?.seat ?? null : null;

  const statCell = 'flex items-center min-w-0 px-6 py-2 @[900px]:py-0 @[900px]:border-r @[900px]:border-[#EFEAE0]';

  return (
    <div className="@container flex flex-col gap-6 min-w-0">
      {/* Header */}
      <div className="flex items-center justify-between gap-x-6 gap-y-4 flex-wrap">
        <div className="flex items-center gap-4 min-w-0">
          <span style={{ borderRadius: '50%', boxShadow: '0 6px 18px rgba(27,56,40,0.10)', flexShrink: 0, background: '#FFFFFF' }}>
            <RoundAvatar name={crestName} url={home?.logo_url ?? null} size={56} seed={societyId} />
          </span>
          <div className="min-w-0 flex flex-col gap-1">
            <h2 className="[overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 30, fontWeight: 600, letterSpacing: '-0.01em', color: INK, margin: 0, lineHeight: 1.15 }}>{societyName}</h2>
            <div className="flex items-center gap-2 [overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 14, color: INK_SOFT }}>
              {home?.country_code && <CircleFlag code={home.country_code} size={18} decorative />}
              {place ? `Delegation · ${place}` : 'Delegation'}
            </div>
          </div>
        </div>
        <div className="flex items-start gap-2.5 flex-wrap">
          <DelegationInviteLink societyId={societyId} conferenceId={conferenceId} buttonStyle={{ ...secondaryBtn, fontWeight: 600 }} iconStroke={STROKE} />
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
        <div className={statCell}><StatNumber n={seatsGiven} word="seats given" /></div>
        <div className={statCell}><StatNumber n={paidCount} word="paid" /></div>
        <div className="flex items-center justify-between gap-3 min-w-0 px-6 py-2 @[900px]:py-0">
          <span style={{ fontFamily: FONT, fontSize: 15, color: INK_SOFT }}>Expected size</span>
          <div className="flex items-center gap-2.5">
            {stepBtn(-1)}
            <span style={{ fontFamily: FONT, fontSize: 22, fontWeight: 600, color: INK, minWidth: 28, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }} aria-live="polite">
              {expected ?? 0}
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
            onOpenCommittee={setOpenCommittee}
            onChanged={refresh}
            swap={swap}
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
          {DELEGATIONS_V2_DB && data.reshuffleUntil && <ReshuffleLine until={data.reshuffleUntil} />}
        </div>
      </div>

      {DELEGATIONS_V2_DB && <OpenSeatsCard seats={openSeats} />}

      {openCommittee && openInfo && (
        <CommitteePopup
          name={openInfo.committee_full ?? openInfo.committee_label}
          abbreviation={openInfo.committee_label}
          emblem={openInfo.emblem}
          people={committeePeople}
          onClose={() => setOpenCommittee(null)}
        />
      )}
      {overlays}
    </div>
  );
}

