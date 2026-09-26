'use client';

// ─────────────────────────────────────────────────────────────────────────────
// DELEGATION PORTAL: /delegation/[societyId]   (redesigned 23 Sep 2026)
//
// For a delegation's leaders (head delegate or faculty advisor). Four tabs, in
// the manner of the organiser's allocation portal:
//   Overview     who the delegation is, counts, seats, money, what to do next
//   Members      every person, role, status and seat; the head delegate can hand
//                over the role or name a faculty advisor from a row's menu
//   Allocations  the block seats, committee by committee, seated by the leaders
//   Payments     invoice by invoice, from the payments ledger
// The invite link sits above the tabs on every tab.
//
// Reads: ONE call, `delegation_portal_overview(p_society)` (src/components/
// delegation/portalModel.ts). Writes, all SECURITY DEFINER and all re-checked
// on the server:
//   delegation_assign_seat(p_allocation_id, p_user_id)            any leader
//   delegation_transfer_head(p_society, p_application_id)         head delegate only
//   delegation_promote_to_advisor(p_society, p_application_id, p_clear_seat)
//                                                                  head delegate only
//   create_delegation_invite(p_society_id, p_conference_id)       any leader
// The role moves change `applications.role` + `is_head_delegate`, which is what
// the organiser's applications, assignment and dashboard read, so they show the
// change at once. A role move never spends or asks for a credit
// (`app.delegation_role_move`, see applications_credit_gate).
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArmchairIcon, ArrowLeft, LayoutDashboard, Receipt, Users } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { queueLeaderAllocationEmail } from '@/lib/emailEvents';
import { friendlyError, plainOrFallback } from '@/lib/friendlyError';
import { openAuth } from '@/lib/authModal';
import SiteNav from '@/components/SiteNav';
import Loader from '@/components/Loader';
import { useConfirmModal } from '@/components/ConfirmModal';
import { NEU, OUTFIT } from '@/components/neu';
import { LogoDisc } from '@/components/LogoDisc';
import { parsePortal, type PortalData, type PortalMember, type PortalSeat } from '@/components/delegation/portalModel';
import { Notice, Panel, PanelTitle, TabBar, type TabDef } from '@/components/delegation/portalUi';
import { InviteLinkCard } from '@/components/delegation/InviteLinkCard';
import { OverviewTab, type PortalTab } from '@/components/delegation/OverviewTab';
import { MembersTab } from '@/components/delegation/MembersTab';
import { AllocationsTab } from '@/components/delegation/AllocationsTab';
import { PaymentsTab } from '@/components/delegation/PaymentsTab';

const TABS: TabDef<PortalTab>[] = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'members', label: 'Members', icon: Users },
  { key: 'allocations', label: 'Allocations', icon: ArmchairIcon },
  { key: 'payments', label: 'Payments', icon: Receipt },
];

function isTab(v: string | null): v is PortalTab {
  return v === 'overview' || v === 'members' || v === 'allocations' || v === 'payments';
}

type LoadState = 'loading' | 'ok' | 'denied' | 'not_found' | 'error';

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: NEU.base }}>
      <SiteNav hideLanguage />
      <main className="relative z-10 flex-1 w-full mx-auto px-4 sm:px-6 py-6 sm:py-10" style={{ maxWidth: 980 }}>
        {children}
      </main>
    </div>
  );
}

export default function DelegationPortalClient() {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const { user, session, loading: authLoading } = useAuth();
  const societyId = (Array.isArray(params.societyId) ? params.societyId[0] : params.societyId) ?? '';

  const [state, setState] = useState<LoadState>('loading');
  const [data, setData] = useState<PortalData | null>(null);
  const [busySeatId, setBusySeatId] = useState<string | null>(null);
  const [busyMemberId, setBusyMemberId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const loadSeq = useRef(0);
  const tokenRef = useRef<string | null>(null);
  const accessToken = session?.access_token ?? null;
  useEffect(() => { tokenRef.current = accessToken; }, [accessToken]);
  const { confirm, modal } = useConfirmModal();

  const tabParam = search.get('tab');
  const tab: PortalTab = isTab(tabParam) ? tabParam : 'overview';
  const setTab = useCallback((t: PortalTab) => {
    const p = new URLSearchParams(search.toString());
    if (t === 'overview') p.delete('tab'); else p.set('tab', t);
    const qs = p.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false });
  }, [router, pathname, search]);

  // Signed out: the sign-in pop-up, then back here.
  useEffect(() => {
    if (!authLoading && !user) openAuth({ next: pathname });
  }, [authLoading, user, pathname]);

  const userId = user?.id ?? null;
  const load = useCallback(async (opts?: { silent?: boolean }) => {
    const token = tokenRef.current;
    if (!userId || !token || !societyId) return;
    const seq = ++loadSeq.current;
    if (!opts?.silent) setState('loading');
    const { data: raw, error } = await getAuthedClient(token).rpc('delegation_portal_overview', { p_society: societyId });
    if (seq !== loadSeq.current) return;
    if (error) {
      if (!opts?.silent) setState('error');
      else setNotice({ tone: 'error', text: friendlyError(error, 'We could not refresh the delegation. Reload the page.') });
      return;
    }
    const parsed = parsePortal(raw);
    if (parsed.kind === 'ok') { setData(parsed.data); setState('ok'); }
    else setState(parsed.kind);
  }, [userId, societyId]);

  useEffect(() => {
    if (authLoading || !userId || !accessToken) return;
    tokenRef.current = accessToken;
    void Promise.resolve().then(() => load());
  }, [authLoading, userId, accessToken, load]);

  // ── Seats (any leader) ─────────────────────────────────────────────────────
  const assignSeat = useCallback(async (seat: PortalSeat, member: PortalMember | null) => {
    const token = tokenRef.current;
    if (!token || !data || busySeatId) return;
    setBusySeatId(seat.id);
    setNotice(null);
    const prev = data;
    setData({ ...data, seats: data.seats.map((s) => (s.id === seat.id ? { ...s, user_id: member?.user_id ?? null, application_id: member?.id ?? null } : s)) });
    const { data: res, error } = await getAuthedClient(token).rpc('delegation_assign_seat', {
      p_allocation_id: seat.id, p_user_id: member?.user_id ?? null,
    });
    const r = res as { ok: boolean; error?: string } | null;
    if (error || !r?.ok) {
      setData(prev);
      setBusySeatId(null);
      setNotice({ tone: 'error', text: error ? friendlyError(error, 'That seat was not saved. Try again.') : plainOrFallback(r?.error, 'That seat was not saved. Try again.') });
      return;
    }
    // Tell the delegate where they sit: the same announcement the organiser's own
    // seat write sends. Fire-and-forget; the seat is already saved. Unseating says nothing.
    if (member) void queueLeaderAllocationEmail(token, data.society.conference_id, seat.id);
    await load({ silent: true });
    setBusySeatId(null);
  }, [data, busySeatId, load]);

  // ── Hand over the head delegate role (head delegate only) ─────────────────
  const makeHead = useCallback(async (m: PortalMember) => {
    const token = tokenRef.current;
    if (!token || !data) return;
    const res = await confirm({
      title: `Make ${m.name} head delegate?`,
      body: (
        <div style={{ fontFamily: OUTFIT, fontSize: 14, lineHeight: 1.5 }}>
          <p>{m.name} will lead {data.society.name}. You become a delegate and keep your seat.</p>
          <p style={{ marginTop: 8 }}>You lose access to this portal unless you are also the faculty advisor. The organiser sees the change straight away. Delegation spots you pledged stay on your bill.</p>
        </div>
      ),
      confirmLabel: 'Make head delegate',
      danger: true,
    });
    if (!res.confirmed) return;
    setBusyMemberId(m.id);
    const { data: out, error } = await getAuthedClient(token).rpc('delegation_transfer_head', { p_society: data.society.id, p_application_id: m.id });
    setBusyMemberId(null);
    const r = out as { ok: boolean; error?: string } | null;
    if (error || !r?.ok) {
      setNotice({ tone: 'error', text: error ? friendlyError(error, 'The role was not handed over. Try again.') : plainOrFallback(r?.error, 'The role was not handed over. Try again.') });
      return;
    }
    setNotice({ tone: 'ok', text: `${m.name} is now head delegate.` });
    await load({ silent: true });
  }, [data, confirm, load]);

  // ── Name a faculty advisor (head delegate only) ───────────────────────────
  const makeAdvisor = useCallback(async (m: PortalMember) => {
    const token = tokenRef.current;
    if (!token || !data) return;
    const self = m.id === data.me.application_id;
    const seat = m.assigned_country_name;
    const res = await confirm({
      title: self ? 'Become the faculty advisor?' : `Make ${m.name} faculty advisor?`,
      body: (
        <div style={{ fontFamily: OUTFIT, fontSize: 14, lineHeight: 1.5 }}>
          <p>{self ? 'You' : m.name} will be {data.society.name}&apos;s faculty advisor{self ? ' and stop being head delegate' : ''}. The organiser sees the change straight away.</p>
          {seat && <p style={{ marginTop: 8 }}>Advisors hold no committee seat, so {self ? 'your' : 'their'} seat, {seat}, is given up.</p>}
          <p style={{ marginTop: 8 }}>No new credit is used. An unpaid registration fee follows the advisor price.</p>
        </div>
      ),
      confirmLabel: seat ? 'Make advisor and free the seat' : 'Make faculty advisor',
      danger: !!seat,
    });
    if (!res.confirmed) return;
    setBusyMemberId(m.id);
    const rpc = (clear: boolean) => getAuthedClient(token).rpc('delegation_promote_to_advisor', {
      p_society: data.society.id, p_application_id: m.id, p_clear_seat: clear,
    });
    let { data: out, error } = await rpc(!!seat);
    let r = out as { ok: boolean; error?: string; needs_confirm?: boolean; seat?: string } | null;
    // A seat we did not know about (given moments ago): ask again, naming it.
    if (!error && r && !r.ok && r.needs_confirm) {
      const again = await confirm({
        title: 'This frees a seat',
        body: <p style={{ fontFamily: OUTFIT, fontSize: 14, lineHeight: 1.5 }}>{self ? 'You hold' : `${m.name} holds`} {r.seat}. Advisors hold no seat, so it will be given up.</p>,
        confirmLabel: 'Free the seat',
        danger: true,
      });
      if (!again.confirmed) { setBusyMemberId(null); return; }
      ({ data: out, error } = await rpc(true));
      r = out as typeof r;
    }
    setBusyMemberId(null);
    if (error || !r?.ok) {
      setNotice({ tone: 'error', text: error ? friendlyError(error, 'That change was not saved. Try again.') : plainOrFallback(r?.error, 'That change was not saved. Try again.') });
      return;
    }
    setNotice({ tone: 'ok', text: self ? 'You are now the faculty advisor.' : `${m.name} is now the faculty advisor.` });
    await load({ silent: true });
  }, [data, confirm, load]);

  // ── Render ────────────────────────────────────────────────────────────────
  if (authLoading || !user || state === 'loading' && !data) {
    return <Shell><div className="flex items-center justify-center py-24"><Loader size={72} label="Loading delegation" /></div></Shell>;
  }

  if (state !== 'ok' || !data) {
    const text = state === 'denied'
      ? { title: 'You Do Not Lead This Delegation', body: 'Only its head delegate or faculty advisor can open this page. If you just handed over the role, the new head delegate has it now.' }
      : state === 'not_found'
        ? { title: 'Delegation Not Found', body: 'This delegation no longer exists, or the link is wrong.' }
        : { title: 'We Could Not Load This Delegation', body: 'Check your connection and try again.' };
    return (
      <Shell>
        <Panel style={{ padding: '32px 20px', textAlign: 'center' }}>
          <PanelTitle title={text.title} />
          <p style={{ fontFamily: OUTFIT, fontSize: 14, color: NEU.inkSoft, marginBottom: 18 }}>{text.body}</p>
          <div className="flex flex-wrap justify-center gap-2">
            {state === 'error' && (
              <button type="button" onClick={() => load()} className="focus:outline-none focus-visible:ring-2"
                style={{ padding: '10px 16px', borderRadius: 12, border: 'none', backgroundColor: NEU.forest, color: NEU.gold, fontFamily: OUTFIT, fontWeight: 700, cursor: 'pointer' }}>
                Try again
              </button>
            )}
            <Link href="/account/conferences" className="focus:outline-none focus-visible:ring-2"
              style={{ padding: '10px 16px', borderRadius: 12, border: NEU.hairline, color: NEU.forest, fontFamily: OUTFIT, fontWeight: 700, textDecoration: 'none' }}>
              My conferences
            </Link>
          </div>
        </Panel>
      </Shell>
    );
  }

  const conf = data.conference;
  const confName = conf.acronym || conf.full_name || 'Conference';

  return (
    <Shell>
      {modal}
      <div className="flex items-center justify-between gap-3 mb-4">
        <Link href="/account/conferences" className="inline-flex items-center gap-1.5 focus:outline-none focus-visible:ring-2"
          style={{ color: NEU.inkSoft, fontFamily: OUTFIT, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
          <ArrowLeft size={15} strokeWidth={2.4} aria-hidden /> My conferences
        </Link>
        <Link href={`/conferences/${conf.slug}`} className="inline-flex items-center gap-2 min-w-0 focus:outline-none focus-visible:ring-2"
          style={{ color: NEU.ink, fontFamily: OUTFIT, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
          <LogoDisc src={conf.logo_url} size={24} fallbackText={confName.slice(0, 3)} alt="" style={{ boxShadow: 'none' }} />
          <span className="[overflow-wrap:anywhere]" style={{ lineHeight: 1.25 }}>{confName}</span>
        </Link>
      </div>

      <div id="dp-invite" className="mb-5">
        <InviteLinkCard
          accessToken={session?.access_token ?? ''}
          societyId={data.society.id}
          conferenceId={data.society.conference_id}
          societyName={data.society.name}
          conferenceName={confName}
          initialToken={data.inviteToken}
        />
      </div>

      <div className="mb-5"><TabBar tabs={TABS} active={tab} onChange={setTab} /></div>

      {notice && <div className="mb-4"><Notice tone={notice.tone} onClose={() => setNotice(null)}>{notice.text}</Notice></div>}

      <div role="tabpanel" id={`dp-panel-${tab}`} aria-labelledby={`dp-tab-${tab}`}>
        {tab === 'overview' && (
          <OverviewTab data={data} onGo={(t) => {
            if (t === 'invite') document.getElementById('dp-invite')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            else setTab(t);
          }} />
        )}
        {tab === 'members' && <MembersTab data={data} busyId={busyMemberId} onMakeHead={makeHead} onMakeAdvisor={makeAdvisor} />}
        {tab === 'allocations' && <AllocationsTab data={data} busySeatId={busySeatId} onAssign={assignSeat} />}
        {tab === 'payments' && <PaymentsTab data={data} />}
      </div>
    </Shell>
  );
}
