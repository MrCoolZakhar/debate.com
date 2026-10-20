'use client';

// Delegation panel: ONE card for advisors, head delegates AND plain delegates
// (25 Sep 2026). The roster comes from my_delegation_roster(p_society), which
// any member of the delegation may call: members are grouped Advisors / Head
// Delegates / Delegates, the viewer first in their own group with a gold edge
// and "You", paged (advisors 3, head delegates 3, delegates 5 a page, the
// viewer always on page 1). A plain delegate sees their OWN allocation and
// payment chip only; everyone else shows photo, name and role. Leaders keep
// everything below (payment chips, paid spots, pledges, swaps) and, while the
// conference allows leader imports, an "Import delegates" button that opens
// DelegationImportPopup.
//
// Leader extras, as before: a read-only-style mirror
// of the organizer's delegation view: advisors row, head delegates row,
// delegates list, paid-spots counter, pledges block, plus the allocation
// swap control (item C). Visibility of every row here is granted by the
// "Members read society leadership" / "Leaders read society members" RLS
// policies (leaders, advisors/head-delegates, read the whole roster; any
// member reads just the leaders) via the my_society_ids()/is_society_leader()
// SECURITY DEFINER helpers, so this just works with the viewer's own authed
// client.

import { useState, useEffect, useCallback, useContext, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeftRight, ChevronLeft, ChevronRight, Compass, Mail, UserPlus, UserX, X } from 'lucide-react';
import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { useDelegationImport } from './DelegationImportCard';
import DelegationImportPopup from './DelegationImportPopup';
import DelegationInviteLink from './DelegationInviteLink';
import LeaderCard from './delegation/LeaderCard';
import { DelegationLeadContext } from './delegation/DelegationLead';
import MemberDelegationCard from './delegation/member/MemberDelegationCard';
import type { ParticipantAllocation, ParticipantCommittee } from './types';
import { BTN_CLASS, cardStyle, primaryBtn, secondaryBtn, STROKE } from './delegation/leaderKit';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { loadSlotArtIndex, artFromIndex, slotArtKey, type SlotArtIndex } from '@/lib/slotGroups';
import { CircleFlag } from '@/components/CircleFlag';
import { useConfirmModal } from '@/components/ConfirmModal';
import { ModalOverlay } from '@/components/CommitteeEditorModal';
import { NEU, NeuButton } from '@/components/neu';
import ProfileLink from '@/components/ProfileLink';
import Loader from '@/components/Loader';
import { queueParticipantEventEmail } from '@/lib/emailEvents';
import { friendlyError, plainOrFallback } from '@/lib/friendlyError';
import {
  POOL_MEMBER_SELECT, MemberAvatar,
  type PoolMember,
} from '@/app/manage/[slug]/assignment/delegationShared';
import { SectionCard, OUTFIT, PaymentChipMark, derivePaymentChip, formatReleaseDate } from './shared';
import { DashCard, CardHeading, BigCount, AppStatusMark, FOREST_GRADIENT, useDashStacked } from './dashboardKit';

interface Society {
  id: string;
  name: string;
  spots_purchased: number;
}

// perform_delegation_swap's return, the authoritative post-swap state for
// each seat (application_id here refers to p_app_a/p_app_b respectively).
interface SwapSeatResult {
  application_id: string;
  name: string;
  new_committee: string;
  new_country: string;
}

type SwapRpcResult = { ok: true; a: SwapSeatResult; b: SwapSeatResult } | { ok: false; error?: string };

// A swap_request or swap_notice row on conference_requests, the shape both
// the pending banner and the recent-notice line read from.
interface SwapActivityRow {
  id: string;
  user_id: string;
  created_at: string;
  metadata: { society_id?: string; member_a?: string; member_b?: string };
}

// "A few days" window for the quiet completed-swap notice.
const RECENT_SWAP_NOTICE_MS = 3 * 24 * 60 * 60 * 1000;

function allocationLabel(m: PoolMember): string | null {
  if (!m.assigned_committee_id) return null;
  return `${m.assigned_committee?.abbreviation ?? m.assigned_committee?.name ?? 'Committee'}: ${m.assigned_country_name}`;
}

// ── The roster (my_delegation_roster) ───────────────────────────────────────

type RosterRole = 'faculty-advisor' | 'head-delegate' | 'delegate';

export interface RosterMember {
  application_id: string;
  is_me: boolean;
  claimed: boolean;
  name: string;
  avatar_url: string | null;
  role: RosterRole;
  status: string;
  payment_status: string | null;
  allocation: {
    committee: string | null;
    committee_abbr: string | null;
    country_name: string | null;
    country_code: string | null;
    sent: boolean | null;
  } | null;
}

interface Roster {
  society_name: string | null;
  is_leader: boolean;
  members: RosterMember[];
}

const ROLE_WORD: Record<RosterRole, string> = {
  'faculty-advisor': 'Faculty Advisor',
  'head-delegate': 'Head Delegate',
  delegate: 'Delegate',
};

/** The viewer's own row, the same on every view: a gold edge and "You". */
const GOLD_EDGE = 'var(--gv-accent)';

// ── Member row ───────────────────────────────────────────────────────────────
// MyMUN's members table in Gavelling's shape (26 Sep 2026): one row per member
// with three columns from 520px of card width (member, assignment as a round
// flag with the country and the committee acronym over its full name, the
// application as icon + word with payment beneath), stacked on phones. No
// pills, no ellipsis on a name.

const ROW_GRID = '@[520px]:grid @[520px]:grid-cols-[minmax(0,1.35fr)_minmax(0,1.2fr)_minmax(0,0.85fr)] @[520px]:items-center';

export function RosterRow({ member, pool, swapMode, swapSelectable, swapSelected, onToggleSwap, covered, seatLogo, canSeeAllocation }: {
  member: RosterMember;
  /** The leader's own read of this application (swap, CV link, attending). */
  pool?: PoolMember;
  swapMode: boolean;
  swapSelectable: boolean;
  swapSelected: boolean;
  onToggleSwap: () => void;
  covered?: boolean;
  /** The seat's own or group crest, drawn instead of the flag when set. */
  seatLogo?: string | null;
  /** The viewer leads, or this is the viewer's own row: an empty allocation
   *  then means "not assigned yet" rather than "not yours to see". */
  canSeeAllocation: boolean;
}) {
  // payment_status and allocation arrive only for the viewer's own row, or
  // for every row when the viewer leads the delegation.
  const chip = member.payment_status
    ? derivePaymentChip(member.payment_status, !!pool?.self_paid, 0)
    : null;
  const a = member.allocation;
  const committeeShortWord = a ? (a.committee_abbr || a.committee) : null;
  const dimmed = pool?.attending === false;
  const me = member.is_me;

  return (
    <div
      onClick={() => { if (swapMode && swapSelectable) onToggleSwap(); }}
      className="relative flex items-start gap-3 px-3 py-3 rounded-xl transition-colors"
      style={{
        backgroundColor: swapSelected ? 'color-mix(in srgb, var(--gv-main-light) 8%, transparent)' : me ? 'color-mix(in srgb, var(--gv-accent-light) 16%, transparent)' : 'transparent',
        boxShadow: swapSelected ? 'inset 0 0 0 1.5px var(--gv-main)' : me ? `inset 3px 0 0 ${GOLD_EDGE}` : 'none',
        opacity: dimmed ? 0.55 : swapMode && !swapSelectable ? 0.45 : 1,
        cursor: swapMode && swapSelectable ? 'pointer' : 'default',
      }}
      title={swapMode && !swapSelectable ? 'No allocation yet, not swappable' : undefined}
    >
      <div className={`flex-1 min-w-0 flex flex-col gap-2.5 ${ROW_GRID} @[520px]:gap-4`}>
        {/* Member */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative flex-shrink-0">
            <MemberAvatar name={member.name} url={member.avatar_url} size={38} />
            {covered && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src="/gavel-mark.png"
                alt=""
                title="Gavelling Credit Covered"
                style={{ position: 'absolute', bottom: -4, right: -6, width: 18, height: 18, objectFit: 'contain' }}
              />
            )}
          </div>
          <div className="min-w-0">
            {/* Never cut a name off (CLAUDE.md §8): it wraps. `nested`, because
                the row is a clickable div while swapping. */}
            <p className="[overflow-wrap:anywhere]" style={{ color: '#1C1410', fontFamily: OUTFIT, fontSize: 14.5, fontWeight: 700, margin: 0, lineHeight: 1.3 }}>
              {pool?.user_id
                ? <ProfileLink userId={pool.user_id} name={member.name} nested>{member.name}</ProfileLink>
                : member.name}
              {me && <span style={{ fontSize: 12, fontWeight: 800, color: GOLD_EDGE, marginLeft: 6 }}>You</span>}
            </p>
            <div className="flex items-center gap-x-2.5 gap-y-0.5 flex-wrap mt-0.5">
              <span style={{ fontSize: 12, color: '#6B5F52', fontFamily: OUTFIT }}>{ROLE_WORD[member.role]}</span>
              {!member.claimed && (
                <span className="inline-flex items-center gap-1" style={{ fontSize: 12, fontWeight: 600, color: '#6B5F52', fontFamily: OUTFIT }}>
                  <Mail size={13} strokeWidth={2.2} aria-hidden />
                  Invited
                </span>
              )}
              {dimmed && (
                <span className="inline-flex items-center gap-1" style={{ fontSize: 12, fontWeight: 600, color: '#6B5F52', fontFamily: OUTFIT }}>
                  <UserX size={13} strokeWidth={2.2} aria-hidden />
                  Not attending
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Assignment */}
        <div className="flex items-center gap-2.5 min-w-0 pl-[50px] @[520px]:pl-0">
          {a && committeeShortWord ? (
            <>
              <CircleFlag code={a.country_code} logoUrl={seatLogo} label={a.country_name ?? undefined} size={30} decorative />
              <div className="min-w-0">
                <p className="[overflow-wrap:anywhere]" style={{ fontFamily: OUTFIT, fontSize: 13.5, fontWeight: 700, color: '#1C1410', margin: 0, lineHeight: 1.25 }}>
                  {a.country_name}
                </p>
                <p className="[overflow-wrap:anywhere]" style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 700, color: 'var(--gv-main-mid)', margin: '1px 0 0 0', lineHeight: 1.3 }}>
                  {committeeShortWord}
                </p>
                {a.committee_abbr && a.committee && a.committee !== a.committee_abbr && (
                  <p className="[overflow-wrap:anywhere]" style={{ fontFamily: OUTFIT, fontSize: 11, color: '#6B5F52', margin: 0, lineHeight: 1.3 }}>
                    {a.committee}
                  </p>
                )}
              </div>
            </>
          ) : canSeeAllocation && member.role !== 'faculty-advisor' ? (
            <span className="inline-flex items-center gap-1.5" style={{ fontFamily: OUTFIT, fontSize: 12.5, color: '#6B5F52' }}>
              <Compass size={14} strokeWidth={2.2} aria-hidden />
              Not assigned yet
            </span>
          ) : null}
        </div>

        {/* Application + payment */}
        <div className="flex items-center gap-x-3 gap-y-1 flex-wrap pl-[50px] @[520px]:pl-0 @[520px]:flex-col @[520px]:items-start">
          <AppStatusMark status={member.status} size="sm" />
          {chip && !dimmed && <PaymentChipMark chip={chip} size="sm" />}
        </div>
      </div>

      {swapMode && (
        <div
          className="flex items-center justify-center flex-shrink-0 mt-2.5"
          style={{
            width: 18, height: 18, borderRadius: '9999px',
            border: `1.5px solid ${swapSelected ? 'var(--gv-main)' : '#DDD4C0'}`,
            backgroundColor: swapSelected ? 'var(--gv-main)' : 'transparent',
          }}
        >
          {swapSelected && <span style={{ width: 7, height: 7, borderRadius: '9999px', backgroundColor: 'var(--gv-accent-light)' }} />}
        </div>
      )}
    </div>
  );
}

/** One role group, paged so the card never overfills. The roster arrives
 *  with the viewer first, so their row is always on page 1. */
export function RosterGroup({ title, members, pageSize, page, onPage, empty, renderRow }: {
  title: string;
  members: RosterMember[];
  pageSize: number;
  page: number;
  onPage: (p: number) => void;
  empty?: string;
  renderRow: (m: RosterMember) => React.ReactNode;
}) {
  if (members.length === 0 && !empty) return null;
  const pages = Math.max(1, Math.ceil(members.length / pageSize));
  const p = Math.min(page, pages - 1);
  const from = p * pageSize;
  const shown = members.slice(from, from + pageSize);
  const navBtn = (dir: -1 | 1) => {
    const off = dir < 0 ? p === 0 : p >= pages - 1;
    const Icon = dir < 0 ? ChevronLeft : ChevronRight;
    return (
      <button
        type="button"
        onClick={() => onPage(p + dir)}
        disabled={off}
        aria-label={`${dir < 0 ? 'Previous' : 'Next'} ${title.toLowerCase()}`}
        className="inline-flex items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gv-accent)]"
        // A 44px hit area around the 32px disc; the negative margin keeps the header row's height.
        style={{ width: 44, height: 44, margin: '-6px -3px', padding: 0, border: 'none', background: 'transparent', opacity: off ? 0.35 : 1, cursor: off ? 'default' : 'pointer' }}
      >
        <span aria-hidden className="inline-flex items-center justify-center rounded-full" style={{ width: 32, height: 32, background: '#FFFFFF', boxShadow: '0 0 0 1px color-mix(in srgb, var(--gv-main) 12%, transparent), 0 2px 6px -2px color-mix(in srgb, var(--gv-main) 25%, transparent)', color: 'var(--gv-main)' }}>
          <Icon size={15} aria-hidden />
        </span>
      </button>
    );
  };
  return (
    <div className="mb-5">
      <div className="flex items-center justify-between gap-2 mb-1.5 px-3">
        <p style={{ fontSize: 13, fontWeight: 800, color: '#1C1410', fontFamily: OUTFIT, margin: 0 }}>
          {title}{' '}
          <span style={{ fontWeight: 600, color: '#6B5F52', fontVariantNumeric: 'tabular-nums' }}>{members.length}</span>
        </p>
        {pages > 1 && (
          <div className="flex items-center gap-1.5">
            <span style={{ fontSize: 12, color: '#6B5F52', fontFamily: OUTFIT, fontVariantNumeric: 'tabular-nums', marginRight: 4 }}>
              {from + 1} to {Math.min(from + pageSize, members.length)} of {members.length}
            </span>
            {navBtn(-1)}
            {navBtn(1)}
          </div>
        )}
      </div>
      {members.length === 0 ? (
        <p className="text-sm px-3" style={{ color: '#6B5F52', fontFamily: OUTFIT, margin: 0 }}>{empty}</p>
      ) : (
        <div className="flex flex-col" style={{ gap: 2 }}>
          {shown.map((m, i) => (
            <div key={m.application_id} style={i > 0 ? { borderTop: '1px solid color-mix(in srgb, var(--gv-main) 7%, transparent)', paddingTop: 2 } : undefined}>
              {renderRow(m)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Swap result modal ───────────────────────────────────────────────────────
// One-button acknowledgement, neumorphic dialog language matching the rest
// of the participant side, used after both a self-serve swap and a swap
// request so the leader gets visible confirmation instead of the panel just
// quietly resetting (self-serve swaps do execute, but with no on-screen
// feedback the action reads as a no-op).

interface SwapResultInfo {
  title: string;
  body: string;
  detail?: string;
}

function SwapResultModal({ info, onClose }: { info: SwapResultInfo; onClose: () => void }) {
  return (
    <ModalOverlay onClose={onClose}>
      <div
        role="alertdialog"
        aria-modal="true"
        className="p-6 flex flex-col gap-4"
        style={{
          width: 400, maxWidth: '90vw',
          backgroundColor: NEU.surface,
          borderRadius: 24,
          boxShadow: `${NEU.out}, 0 24px 60px color-mix(in srgb, var(--gv-main) 28%, transparent)`,
        }}
      >
        <p className="text-base" style={{ color: NEU.ink, fontWeight: 800, fontFamily: OUTFIT }}>{info.title}</p>
        <div style={{ color: NEU.muted, fontFamily: OUTFIT, lineHeight: 1.55 }}>
          <p className="text-sm">{info.body}</p>
          {info.detail && <p className="text-sm mt-1.5">{info.detail}</p>}
        </div>
        <NeuButton onClick={onClose}>Done</NeuButton>
      </div>
    </ModalOverlay>
  );
}

// ── Panel ────────────────────────────────────────────────────────────────────

export interface DelegationPanelProps {
  conferenceId: string;
  conferenceSlug: string;
  societyId: string;
  allocationSwapMode: string;
  /** Which part of the dashboard is showing (26 Sep 2026). 'overview' draws
   *  the delegation summary only, 'delegation' the full members table and
   *  the leader tools, anything else nothing visible. The panel stays
   *  mounted either way, so its reads and a half-made swap survive a switch. */
  section?: string;
  /** Overview's "See all members": the parent switches to Delegation. */
  onOpenMembers?: () => void;
  /** A delegate's own context for the member card (5B): the conference's
   *  committees (logos), their seat and who paid their fee. */
  member?: { committees: ParticipantCommittee[]; myAllocation: ParticipantAllocation | null; selfPaid: boolean };
}

export default function DelegationPanel({ conferenceId, conferenceSlug, societyId, allocationSwapMode, section = 'delegation', onOpenMembers, member }: DelegationPanelProps) {
  const { user, session } = useAuth();
  const router = useRouter();
  const { confirm, modal: confirmModal } = useConfirmModal();
  // On the one-page phone dashboard (below xl) there are no sections: the
  // full delegation card shows whatever section the desktop has open, and the
  // Overview summary is a desktop-only view of it.
  const stacked = useDashStacked();

  // ── The roster, for every member (my_delegation_roster) ──────────────────
  // Every hook in this component sits ABOVE the early returns further down.
  const [roster, setRoster] = useState<Roster | null>(null);
  const [rosterError, setRosterError] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [conferenceAcronym, setConferenceAcronym] = useState('');
  // The page's next step (DelegationLead): under the leader card's header,
  // above the member card (owner, 20 Oct 2026).
  const lead = useContext(DelegationLeadContext);

  const loadRoster = useCallback(async () => {
    if (!societyId) return;
    try {
      const client = await getFreshAuthedClient();
      if (!client) return;
      const { data, error } = await client.rpc('my_delegation_roster', { p_society: societyId });
      if (error) throw error;
      const a = (data ?? {}) as { ok?: boolean; message?: string; society_name?: string; is_leader?: boolean; members?: RosterMember[] };
      if (a.ok !== true) {
        setRosterError(plainOrFallback(a.message, 'Your delegation could not be read. Refresh the page to try again.'));
        return;
      }
      setRoster({ society_name: a.society_name ?? null, is_leader: a.is_leader === true, members: Array.isArray(a.members) ? a.members : [] });
      setRosterError(null);
    } catch (e) {
      setRosterError(friendlyError(e, 'Your delegation could not be read. Refresh the page to try again.'));
    }
  }, [societyId]);

  useEffect(() => { void loadRoster(); }, [loadRoster]);

  const isLeader = !!roster?.is_leader;
  // Leader imports (DelegationImportCard's read), only for a leader.
  const delegationImport = useDelegationImport(isLeader ? societyId : null);
  const importAvailable = isLeader && !!delegationImport.leader?.enabled;

  useEffect(() => {
    if (!importAvailable || conferenceAcronym || !session) return;
    let cancelled = false;
    void getAuthedClient(session.access_token)
      .from('conferences').select('acronym, full_name').eq('id', conferenceId).maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return;
        const c = data as { acronym?: string | null; full_name?: string | null };
        setConferenceAcronym((c.acronym ?? '').trim() || (c.full_name ?? '').trim());
      });
    return () => { cancelled = true; };
  }, [importAvailable, conferenceAcronym, session, conferenceId]);

  const [society, setSociety] = useState<Society | null>(null);
  const [members, setMembers] = useState<PoolMember[]>([]);
  const [, setCoveredIds] = useState<Set<string>>(new Set());
  // True once the leader extras were read once. Only the FIRST read shows the
  // skeleton: every later read (an import, a swap, a role change, a stepper
  // tap) swaps the data in place and never unmounts the leader card.
  const [leaderLoaded, setLeaderLoaded] = useState(false);
  const userId = user?.id ?? null;
  const [swapMode, setSwapMode] = useState(false);
  const [swapSelection, setSwapSelection] = useState<string[]>([]);
  const [swapError, setSwapError] = useState('');
  const [swapping, setSwapping] = useState(false);
  const [swapResult, setSwapResult] = useState<SwapResultInfo | null>(null);
  const [pendingSwapRequest, setPendingSwapRequest] = useState<SwapActivityRow | null>(null);
  const [recentSwapNotice, setRecentSwapNotice] = useState<SwapActivityRow | null>(null);
  // Custom seat / group crests for the committees this delegation sits in,
  // keyed by committee + seat (`src/lib/slotGroups.ts`).
  const [seatArt, setSeatArt] = useState<SlotArtIndex>(() => new Map());
  const seatLogoFor = useCallback((m: PoolMember): string | null => {
    if (!m.assigned_committee_id || !m.assigned_country_code) return null;
    const art = artFromIndex(seatArt.get(slotArtKey(m.assigned_committee_id, m.assigned_country_code)), m.assigned_country_code);
    return art.kind === 'logo' ? art.url : null;
  }, [seatArt]);

  const load = useCallback(async () => {
    if (!societyId || !userId) return;
    // A plain delegate reads only the roster; the leader extras below need
    // the leaders' RLS and are skipped for everyone else.
    if (!isLeader) return;
    // Keyed on the user id, the client made at call time (CLAUDE.md, Auth clients).
    const supabase = await getFreshAuthedClient();
    if (!supabase) return;
    const [{ data: societyRow }, { data: memberRows }, { data: coveredRows }] = await Promise.all([
      supabase.from('societies').select('id, name, spots_purchased').eq('id', societyId).maybeSingle(),
      supabase.from('applications').select(POOL_MEMBER_SELECT).eq('society_id', societyId).in('status', ['accepted', 'assigned', 'checked-in']),
      supabase.rpc('society_credit_covered_apps', { p_society: societyId }),
    ]);
    const memberList = (memberRows ?? []) as unknown as PoolMember[];
    setSociety((societyRow as Society | null) ?? null);
    setMembers(memberList);
    setCoveredIds(new Set((coveredRows ?? []) as string[]));
    setLeaderLoaded(true);
    const ccIds = memberList.map(m => m.assigned_committee_id).filter((id): id is string => !!id);
    void loadSlotArtIndex(supabase, ccIds).then(setSeatArt).catch(() => {});
  }, [societyId, userId, isLeader]);

  useEffect(() => { void load(); }, [load]);

  // The delegation's swap activity, an open swap_request plus the most recent
  // swap_notice. RLS now lets any leader of this society read
  // conference_requests rows (and their messages) of kind 'swap_request' or
  // 'swap_notice' whose metadata->>'society_id' matches their society, so
  // every leader sees the same state, not just whoever sent it.
  const loadSwapActivity = useCallback(async () => {
    if (!societyId || !session || !isLeader) return;
    const supabase = getAuthedClient(session.access_token);
    const [{ data: reqData }, { data: noticeData }] = await Promise.all([
      supabase
        .from('conference_requests')
        .select('id, user_id, created_at, metadata')
        .eq('conference_id', conferenceId)
        .eq('kind', 'swap_request')
        .eq('status', 'open')
        .eq('metadata->>society_id', societyId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('conference_requests')
        .select('id, user_id, created_at, metadata')
        .eq('conference_id', conferenceId)
        .eq('kind', 'swap_notice')
        .eq('metadata->>society_id', societyId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    setPendingSwapRequest((reqData as SwapActivityRow | null) ?? null);
    const notice = (noticeData as SwapActivityRow | null) ?? null;
    setRecentSwapNotice(
      notice && Date.now() - new Date(notice.created_at).getTime() < RECENT_SWAP_NOTICE_MS ? notice : null
    );
  }, [societyId, conferenceId, session, isLeader]);

  useEffect(() => { loadSwapActivity(); }, [loadSwapActivity]);

  // The roster, grouped; the server already puts the viewer first.
  const rosterMembers = useMemo(() => roster?.members ?? [], [roster]);
  const advisors = useMemo(() => rosterMembers.filter(m => m.role === 'faculty-advisor'), [rosterMembers]);
  const headDelegates = useMemo(() => rosterMembers.filter(m => m.role === 'head-delegate'), [rosterMembers]);
  const delegates = useMemo(() => rosterMembers.filter(m => m.role === 'delegate'), [rosterMembers]);
  const delegatePool = useMemo(() => members.filter(m => m.role === 'delegate' || m.role === 'head-delegate'), [members]);
  const paidCount = delegatePool.filter(m => m.payment_status === 'paid').length;

  function toggleSwapSelect(memberId: string) {
    setSwapError('');
    setSwapSelection(prev => {
      if (prev.includes(memberId)) return prev.filter(id => id !== memberId);
      if (prev.length >= 2) return prev;
      return [...prev, memberId];
    });
  }

  const swapA = swapSelection[0] ? members.find(m => m.id === swapSelection[0]) ?? null : null;
  const swapB = swapSelection[1] ? members.find(m => m.id === swapSelection[1]) ?? null : null;

  async function handleConfirmSwap() {
    if (!swapA || !swapB || !session || !user) return;
    const nameA = swapA.profiles?.display_name ?? 'Member A';
    const nameB = swapB.profiles?.display_name ?? 'Member B';
    const allocA = allocationLabel(swapA) ?? 'their allocation';
    const allocB = allocationLabel(swapB) ?? 'their allocation';

    const { confirmed } = await confirm({
      title: 'Swap Allocations?',
      body: `${nameA}: ${allocA} ↔ ${nameB}: ${allocB}`,
      confirmLabel: allocationSwapMode === 'self_serve' ? 'Swap' : 'Request swap',
    });
    if (!confirmed) return;

    setSwapping(true);
    setSwapError('');
    const supabase = getAuthedClient(session.access_token);
    const subject = `Allocation swap in ${society?.name ?? 'this delegation'}`;
    const metadata = {
      society_id: societyId,
      app_a: swapA.id, app_b: swapB.id,
      member_a: nameA, member_b: nameB,
      before: { a: allocA, b: allocB },
      after: { a: allocB, b: allocA },
    };

    if (allocationSwapMode === 'self_serve') {
      const { data, error } = await supabase.rpc('perform_delegation_swap', { p_app_a: swapA.id, p_app_b: swapB.id });
      if (error) { setSwapError(friendlyError(error, 'Could not swap allocations.')); setSwapping(false); return; }
      const result = data as SwapRpcResult;
      if (!result.ok) { setSwapError(plainOrFallback(result.error, 'Could not swap allocations.')); setSwapping(false); return; }
      // The RPC's own return is the authoritative post-swap state, the
      // panel's locally-fetched allocation labels (allocA/allocB above) can
      // be stale by the time this resolves.
      const { a, b } = result;
      const swapSummary = `${a.name} is now ${a.new_committee}: ${a.new_country}, ${b.name} is now ${b.new_committee}: ${b.new_country}`;

      const { data: reqRow } = await supabase.from('conference_requests').insert({
        conference_id: conferenceId, user_id: user.id, kind: 'swap_notice', subject, metadata,
      }).select('id').single();
      if (reqRow) {
        await supabase.from('conference_request_messages').insert({
          request_id: (reqRow as { id: string }).id, sender_user_id: user.id, is_organizer: false,
          body: `${a.name} and ${b.name} swapped allocations: ${swapSummary}.`,
        });
      }
      // Queued through the participant-events route (server-side, service
      // role) rather than queueEventEmail directly — email_outbox is
      // organizer-only under RLS, a leader's own session can't insert rows.
      await queueParticipantEventEmail(session.access_token, conferenceId, 'delegation_swap', [swapA.id, swapB.id]);

      setSwapMode(false);
      setSwapSelection([]);
      // Refresh the allocation list and swap activity BEFORE showing the
      // confirmation, so dismissing the modal reveals the already-updated
      // state rather than the old one flashing in behind it.
      await Promise.all([load(), loadSwapActivity()]);
      setSwapping(false);
      setSwapResult({ title: 'Allocations swapped', body: `${swapSummary}.` });
      window.dispatchEvent(new CustomEvent('gv-requests-changed'));
    } else {
      const { data: reqRow, error } = await supabase.from('conference_requests').insert({
        conference_id: conferenceId, user_id: user.id, kind: 'swap_request', subject, metadata,
      }).select('id').single();
      if (error || !reqRow) { setSwapError(friendlyError(error, 'Could not send the swap request.')); setSwapping(false); return; }
      await supabase.from('conference_request_messages').insert({
        request_id: (reqRow as { id: string }).id, sender_user_id: user.id, is_organizer: false,
        body: `Requesting to swap allocations: ${nameA} (${allocA}) ↔ ${nameB} (${allocB}).`,
      });
      // See NOTE above, same organizer-only RLS gap applies to request mode.
      await queueParticipantEventEmail(session.access_token, conferenceId, 'delegation_swap', [swapA.id, swapB.id]);

      setSwapMode(false);
      setSwapSelection([]);
      await loadSwapActivity();
      setSwapping(false);
      setSwapResult({
        title: 'Swap Requested',
        body: "An allocation swap has been requested to the conference's organizers.",
        detail: `${nameA} and ${nameB}.`,
      });
      window.dispatchEvent(new CustomEvent('gv-requests-changed'));
    }
  }

  const pendingRequesterName = pendingSwapRequest
    ? members.find(m => m.user_id === pendingSwapRequest.user_id)?.profiles?.display_name ?? 'A delegation leader'
    : null;

  // Modals belong to the panel, not to a section: they render in every state.
  const overlays = (
    <>
      {confirmModal}
      {swapResult && <SwapResultModal info={swapResult} onClose={() => setSwapResult(null)} />}
      {importOpen && importAvailable && delegationImport.leader && (
        <DelegationImportPopup
          societyId={societyId}
          data={delegationImport.leader}
          reload={delegationImport.reload}
          conferenceAcronym={conferenceAcronym || 'this conference'}
          userEmail={user?.email ?? null}
          onPledgeMore={() => { setImportOpen(false); router.push(`/conferences/${conferenceSlug}/pay?open=spots`); }}
          onAdvisorsMore={() => { setImportOpen(false); router.push(`/conferences/${conferenceSlug}/pay?open=advisors`); }}
          onImported={() => { void loadRoster(); void load(); }}
          onClose={() => setImportOpen(false)}
        />
      )}
    </>
  );

  const ownSection = section === 'overview' || section === 'delegation';
  if (!ownSection && !stacked) return overlays;
  // Stacked and on another desktop section: drawn below xl only.
  const phoneOnly = (node: React.ReactNode) => (ownSection ? node : <><div className="xl:hidden">{node}</div>{overlays}</>);

  if (!roster && rosterError) {
    return phoneOnly(
      <>
        <SectionCard>
          <p className="text-sm" role="alert" style={{ color: '#8B2020', fontFamily: OUTFIT, margin: 0 }}>{rosterError}</p>
        </SectionCard>
        {lead}
      </>
    );
  }

  // The first read only; the lead waits under it where the header will be.
  if (!roster || (isLeader && !leaderLoaded)) {
    return phoneOnly(
      <>
        <SectionCard>
          <div className="flex justify-center py-6">
            <Loader size={48} />
          </div>
        </SectionCard>
        {lead}
      </>
    );
  }

  const societyName = roster.society_name ?? society?.name ?? 'Delegation';
  const studentCount = headDelegates.length + delegates.length;
  const allocatedCount = [...headDelegates, ...delegates].filter(m => !!m.allocation?.country_code).length;
  const invitedCount = rosterMembers.filter(m => !m.claimed).length;

  // The leader's tools, the same on both views: the delegation's invite link
  // (always; owners, 11 Oct 2026) and, while the conference allows it,
  // Import delegates. The head delegate's tools are on the member rows.
  const leaderActions = isLeader && societyId ? (
    <>
      <DelegationInviteLink societyId={societyId} conferenceId={conferenceId} />
      {importAvailable && (
        <button
          type="button"
          onClick={() => setImportOpen(true)}
          className="inline-flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--gv-accent)]"
          style={{ minHeight: 44, padding: '0 16px', borderRadius: 10, border: 'none', background: FOREST_GRADIENT, color: '#FFFFFF', fontFamily: OUTFIT, fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: '0 6px 16px -8px color-mix(in srgb, var(--gv-main) 55%, transparent)' }}
        >
          <UserPlus size={16} strokeWidth={2.4} aria-hidden />
          Import delegates
        </button>
      )}
    </>
  ) : null;

  const counts = (
    <div className="grid grid-cols-2 @[520px]:grid-cols-3 gap-x-6 gap-y-4">
      <BigCount n={studentCount} word={studentCount === 1 ? 'delegate' : 'delegates'} />
      {isLeader && <BigCount n={allocatedCount} of={studentCount} word="assigned" />}
      {isLeader && <BigCount n={paidCount} of={society?.spots_purchased ?? 0} word="paid spots" />}
      {!isLeader && advisors.length > 0 && <BigCount n={advisors.length} word={advisors.length === 1 ? 'advisor' : 'advisors'} />}
    </div>
  );

  if (section === 'overview') {
    const summary = (
        <DashCard className="@container">
          <CardHeading label="Your delegation" title={societyName} aside={leaderActions} />
          {counts}
          {isLeader && invitedCount > 0 && (
            <p className="mt-4 inline-flex items-center gap-1.5" style={{ fontFamily: OUTFIT, fontSize: 13, color: '#6B5F52', margin: '16px 0 0 0' }}>
              <Mail size={14} strokeWidth={2.2} aria-hidden />
              {invitedCount} {invitedCount === 1 ? 'member has' : 'members have'} not claimed their invite yet
            </p>
          )}
          {onOpenMembers && (
            <div className="mt-5">
              <button
                type="button"
                onClick={onOpenMembers}
                className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gv-accent)] rounded"
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: OUTFIT, fontSize: 14, fontWeight: 800, color: 'var(--gv-main)', textDecoration: 'underline', textUnderlineOffset: 3 }}
              >
                See every member
              </button>
            </div>
          )}
        </DashCard>
    );
    if (stacked) {
      return (
        <>
          <div className="hidden xl:block">{summary}</div>
          <div className="xl:hidden">{renderFull(false)}</div>
          {overlays}
        </>
      );
    }
    return <>{summary}{overlays}</>;
  }

  if (section !== 'delegation') return phoneOnly(renderFull(false));
  return renderFull(true);

  // The full card, drawn once per render. A leader gets the roster card
  // (delegation/LeaderCard.tsx, taste board 1A) with the swap tools under its
  // table; every other member gets the 5B card (delegation/member). Overlays ride
  // inside it only when it is the panel's whole output.
  function renderFull(withOverlays: boolean) {
  if (isLeader && roster) {
    const swapOn = allocationSwapMode !== 'off';
    const swapTools = (pendingSwapRequest || recentSwapNotice || swapOn) ? (
      <div className="flex flex-col gap-3" style={{ ...cardStyle, padding: '18px 24px' }}>
        {pendingSwapRequest && (
          <div className="flex items-start gap-2.5">
            <ArrowLeftRight size={16} strokeWidth={STROKE} style={{ color: 'color-mix(in srgb, var(--gv-accent) 72%, #1C1410)', flexShrink: 0, marginTop: 2 }} aria-hidden />
            <div>
              {/* Deliberately NOT CV-linked: the two names come from the
                  request's metadata as bare strings with no user id. */}
              <p className="text-[14px]" style={{ color: '#1C1410', fontFamily: OUTFIT, margin: 0 }}>
                A swap of {pendingSwapRequest.metadata.member_a ?? 'a delegate'} and {pendingSwapRequest.metadata.member_b ?? 'a delegate'} is awaiting the organizing team.
              </p>
              <p className="text-[13px]" style={{ color: '#6B5F52', fontFamily: OUTFIT, margin: '2px 0 0 0' }}>
                Requested by {pendingRequesterName} on {formatReleaseDate(new Date(pendingSwapRequest.created_at).getTime())}.
              </p>
            </div>
          </div>
        )}
        {recentSwapNotice && (
          <p className="text-[14px]" style={{ color: '#6B5F52', fontFamily: OUTFIT, margin: 0 }}>
            {recentSwapNotice.metadata.member_a ?? 'A delegate'} and {recentSwapNotice.metadata.member_b ?? 'a delegate'} swapped allocations on {formatReleaseDate(new Date(recentSwapNotice.created_at).getTime())}.
          </p>
        )}
        {swapOn && (!swapMode ? (
          <div>
            <button
              type="button"
              onClick={() => { setSwapMode(true); setSwapSelection([]); setSwapError(''); }}
              className={BTN_CLASS}
              style={secondaryBtn}
            >
              <ArrowLeftRight size={17} strokeWidth={STROKE} aria-hidden /> Swap allocations
            </button>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-[14px]" style={{ color: '#6B5F52', fontFamily: OUTFIT, margin: 0 }}>
                Pick two seated people in the table to swap.
              </p>
              <button
                type="button"
                onClick={() => { setSwapMode(false); setSwapSelection([]); setSwapError(''); }}
                aria-label="Stop swapping"
                className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gv-accent)] flex-shrink-0 inline-flex items-center justify-center rounded-full"
                style={{ color: '#6B5F52', width: 44, height: 44, margin: -6, background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <X size={18} strokeWidth={STROKE} aria-hidden />
              </button>
            </div>
            {swapA && swapB && (
              <div className="rounded-xl px-3.5 py-3 mt-3" style={{ backgroundColor: 'color-mix(in srgb, var(--gv-main) 5%, transparent)' }}>
                {/* Deliberately NOT CV-linked: swapSelection is local state, so
                    navigating away to a CV discards it. */}
                <p className="text-[14px] mb-2.5 [overflow-wrap:anywhere]" style={{ color: '#1C1410', fontFamily: OUTFIT, fontWeight: 500 }}>
                  {swapA.profiles?.display_name}: {allocationLabel(swapA)} and {swapB.profiles?.display_name}: {allocationLabel(swapB)}
                </p>
                <button
                  type="button"
                  onClick={handleConfirmSwap}
                  disabled={swapping}
                  className={BTN_CLASS}
                  style={{ ...primaryBtn, opacity: swapping ? 0.6 : 1, cursor: swapping ? 'default' : 'pointer' }}
                >
                  {swapping ? 'Processing…' : allocationSwapMode === 'self_serve' ? 'Confirm swap' : 'Confirm request'}
                </button>
              </div>
            )}
            {swapError && <p className="text-[13px] mt-2" role="alert" style={{ color: '#8B2020', fontFamily: OUTFIT, margin: '8px 0 0 0' }}>{swapError}</p>}
          </div>
        ))}
      </div>
    ) : null;
    return (
      <LeaderCard
        conferenceId={conferenceId}
        conferenceSlug={conferenceSlug}
        societyId={societyId}
        societyName={societyName}
        members={rosterMembers}
        pool={members}
        paidCount={paidCount}
        seatLogoFor={seatLogoFor}
        importAvailable={importAvailable}
        onImport={() => setImportOpen(true)}
        onChanged={async () => { await Promise.all([loadRoster(), load(), loadSwapActivity()]); }}
        swap={{ on: swapMode, selected: swapSelection, toggle: toggleSwapSelect }}
        swapTools={swapTools}
        overlays={withOverlays ? overlays : null}
      />
    );
  }
  // A member who does not lead: the 5B card (delegation/member), the page's
  // next step above it.
  return (
    <>
      {lead}
      <MemberDelegationCard
        conferenceId={conferenceId}
        conferenceSlug={conferenceSlug}
        societyId={societyId}
        societyName={societyName}
        members={rosterMembers}
        committees={member?.committees}
        myAllocation={member?.myAllocation ?? null}
        selfPaid={member?.selfPaid ?? false}
      />
      {withOverlays && overlays}
    </>
  );
  }
}
