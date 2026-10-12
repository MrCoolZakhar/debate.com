'use client';

// Chair participant view. A chair may hold the dais on more than one
// committee, so this fetches every conference_committees row where
// chair_user_ids contains them (safe under "Associated users read their
// committee" RLS, row-level, so session_code etc. only comes back for
// committees they actually chair) and stacks a full block per committee.

import { useState, useEffect, useCallback, useRef } from 'react';
import { Copy, Check, FileText, Gavel, Landmark, Radio, Signal, Users } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { friendlyError } from '@/lib/friendlyError';
import { MonogramMedallion } from '@/components/CommitteeEditorModal';
import { getSiteUrl } from '@/lib/emailBlocks';
import PositionPaperRoster, { type RosterAllocation, type RosterPaper } from '@/components/PositionPaperRoster';
import { fetchMessageStubsForPapers, type PaperMessageStub } from '@/lib/positionPapers';
import StudyGuideCard from './StudyGuideCard';
import AwardsCard, { type AwardsCardConference } from './AwardsCard';
import Loader from '@/components/Loader';
import { SectionCard, OUTFIT, capitalize, effectiveReleaseTime } from './shared';
import { DashCard, CardHeading, CommitteeEmblem, TwoRowName, ForestLink, IconWord, BigCount, Pane, committeeShort, useDashStacked, useReportNextStep, type NextStep, FOREST, FOREST_GRADIENT, INK, INK_SOFT } from './dashboardKit';

const DIFFICULTY_STYLES: Record<string, { color: string }> = {
  beginner: { color: '#2A5A3C' },
  intermediate: { color: '#8A6614' },
  advanced: { color: '#B8844A' },
  expert: { color: '#8B2020' },
};
const ROMAN = ['I', 'II', 'III'];

interface ChairCommittee {
  id: string;
  name: string;
  abbreviation: string | null;
  topics: string[] | null;
  difficulty: string;
  committee_type: string;
  logo_url: string | null;
  session_code: string | null;
  released_to_chairs_at: string | null;
  position_paper_deadline: string | null;
  session_id: string | null;
  awards_submitted_at: string | null;
  awards_approved_at: string | null;
  awards_return_note: string | null;
  chair_user_ids: string[] | null;
}

/** The conference fields the chair's blocks need beyond the id: the session
 *  release fallback (start_date) and the awards lifecycle (end_date is the
 *  default chair deadline, awards_config the categories and quotas,
 *  awards_published_at the ceremony moment). */
interface ChairConference extends AwardsCardConference {
  start_date: string | null;
}

interface RosterAllocationRow {
  id: string;
  country_code: string;
  country_name: string;
  user_id: string | null;
  profiles: { display_name: string } | null;
  applications: { invited_name: string | null } | null;
}

// ── Committee header card (item 1), mirrors the public committee card ─────

function CommitteeHeaderCard({ committee, headerFromXlOnly = false }: {
  committee: ChairCommittee;
  /** The phone page shows the emblem and name in Your assignment just above,
   *  so below xl this card starts at the difficulty and the topics. */
  headerFromXlOnly?: boolean;
}) {
  const diff = committee.difficulty?.toLowerCase() ?? '';
  const diffStyle = DIFFICULTY_STYLES[diff] ?? DIFFICULTY_STYLES.intermediate;
  const isCrisis = committee.committee_type === 'crisis';
  const topics = committee.topics ?? [];

  return (
    <SectionCard>
      <div className="flex flex-col items-center text-center">
        <div className={headerFromXlOnly ? 'hidden xl:flex flex-col items-center' : 'flex flex-col items-center'}>
        {committee.logo_url ? (
          <img
            src={committee.logo_url}
            alt={committee.abbreviation ?? committee.name}
            style={{ width: '96px', height: '96px', objectFit: 'contain', flexShrink: 0, filter: 'drop-shadow(0 10px 18px rgba(27,56,40,0.28))' }}
          />
        ) : (
          <MonogramMedallion text={committee.abbreviation || committee.name} isCrisis={isCrisis} size={88} />
        )}
        <h3 className="font-bold text-[17px] leading-snug mt-4" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
          {committee.name}
        </h3>
        </div>
        <div className="flex items-center gap-2 mt-1.5">
          {committee.difficulty && (
            <span className="inline-flex items-center gap-1" style={{ color: diffStyle.color, fontSize: '12px', fontFamily: OUTFIT, fontWeight: 700 }}>
              <Signal size={14} strokeWidth={2.2} aria-hidden />
              {capitalize(diff)}
            </span>
          )}
          {isCrisis && (
            <>
              <span aria-hidden style={{ color: 'rgba(182,135,31,0.55)', fontSize: '7px' }}>◆</span>
              <span className="text-[10px] font-bold" style={{ color: '#8B2020', fontFamily: OUTFIT, letterSpacing: '0.12em' }}>CRISIS</span>
            </>
          )}
        </div>
        {topics.length > 0 && (
          <div className="w-full mt-5 pt-4 text-left" style={{ borderTop: '1px solid rgba(221,212,192,0.55)' }}>
            {topics.map((topic, ti) => (
              <div key={topic} className="flex items-start gap-2.5 py-1">
                <span className="flex-shrink-0 text-right" style={{ fontFamily: OUTFIT, fontWeight: 600, fontVariantNumeric: 'tabular-nums', fontSize: '11px', color: '#B6871F', width: '18px', lineHeight: '19px' }}>
                  {ROMAN[ti] ?? String(ti + 1)}.
                </span>
                <span className="text-[12.5px] font-medium" style={{ color: '#2E2820', fontFamily: OUTFIT, lineHeight: 1.55 }}>{topic}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </SectionCard>
  );
}

// ── Session card (item 2) ───────────────────────────────────────────────────

function sessionReleased(committee: ChairCommittee, conferenceStartDate: string | null): boolean {
  // "Released" means the timestamp is non-null and in the past, OR it's null
  // and the conference's start_date has arrived (the default release moment)
  // — not just "a stamp exists at all", since a future stamp is a schedule.
  const releaseMs = effectiveReleaseTime(committee.released_to_chairs_at, conferenceStartDate);
  return releaseMs !== null && releaseMs <= Date.now();
}

function chairHref(committee: ChairCommittee, chairDisplayName: string): string {
  return `${getSiteUrl()}/chair/${committee.session_code}?chairName=${encodeURIComponent(chairDisplayName)}`;
}

function SessionCard({ committee, chairDisplayName, conferenceStartDate, showCommittee, onSessionCreated, joinFromXlOnly = false }: {
  committee: ChairCommittee;
  /** The phone page's next-step card already offers "Join as chair" for this
   *  room, so this button shows from xl only (the code and Copy stay). */
  joinFromXlOnly?: boolean;
  chairDisplayName: string;
  conferenceStartDate: string | null;
  showCommittee: boolean;
  /**
   * Whether THIS viewer may actually create the room. See the comment on
   * `handleCreateSession`: minting ends in an UPDATE of
  /** Re-reads this committee so the new code and session_id land on screen. */
  onSessionCreated: () => void;
}) {
  const { session } = useAuth();
  const [copied, setCopied] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  // ONE PRESS, ONE ROOM. `mintConferenceSession`'s retry handles a code
  // collision between two DIFFERENT mints; it does nothing about two
  // concurrent mints of the SAME committee, which would leave this committee
  // with two live rooms and the link pointing at whichever wrote last. A ref,
  // not the `creating` state, because state is a render behind a fast
  // double-click.
  const mintingRef = useRef(false);

  function handleCopy() {
    if (!committee.session_code) return;
    navigator.clipboard.writeText(committee.session_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // The dais asks for its own room (owner, 7 Oct 2026: "committees should only
  // be started when chairs want it to"). Mints through the shared helper, so
  // this is the same four writes, the same seating from
  // committee_country_slots and the same conference link as the organiser's
  // button; `onSessionCreated` then re-reads the row and the card turns into
  // the ordinary code + "Join as chair" it has always been.
  //
  // ── IT GOES THROUGH AN RPC, NOT FOUR CLIENT WRITES ───────────────────────
  //
  // The last write of a mint is
  // `update conference_committees set session_id, session_code`, and
  // `conference_committees` has exactly ONE non-SELECT policy:
  // `Organizers manage committees USING is_conference_organizer(conference_id)`.
  // A chair sits in `chair_user_ids`, which grants SELECT only, so from the
  // browser that UPDATE matches zero rows for any chair who is not also an
  // organiser — and PostgREST reports a zero-row UPDATE as success, never as an
  // error. The room would be created and seated, the chair handed a working
  // code, and nothing on the conference side would point at it: the live wall,
  // the cross-committee scoreboard and awards all join through
  // `conference_committees.session_id`. An orphan from birth.
  //
  // So the mint happens in ONE transaction server-side:
  // `start_my_chair_session(p_committee)` (SECURITY DEFINER, authenticated
  // only, applied 7 Oct 2026) checks `auth.uid() = any(chair_user_ids)` or the
  // organising team, takes the committee's own advisory lock, and writes the
  // same four things as `mintConferenceSession` — so a room can never exist
  // unlinked and two chairs pressing at the same instant get ONE room. It is
  // idempotent: a second press returns the code that already exists.
  //
  // Every chair of the committee can press it; there is no organiser gate any
  // more. The server decides, and `message` is written for the chair to read.
  function handleCreateSession() {
    if (!session || mintingRef.current || committee.session_code) return;
    mintingRef.current = true;
    setCreating(true);
    setCreateError('');
    (async () => {
      try {
        const { data, error } = await getAuthedClient(session.access_token)
          .rpc('start_my_chair_session', { p_committee: committee.id });
        const answer = (data ?? null) as { ok?: boolean; code?: string; message?: string } | null;
        if (error || !answer?.ok || !answer.code) {
          // The RPC writes a plain sentence for every refusal it knows about;
          // anything else goes through friendlyError (never a raw error).
          setCreateError(
            answer?.message
            ?? (error
              ? `Your session couldn't be started: ${friendlyError(error, 'the request was rejected')}`
              : "Your session couldn't be started. Please try again, or ask the organizing team."),
          );
          return;
        }
        onSessionCreated();
      } catch (e) {
        setCreateError(`Your session couldn't be started: ${friendlyError(e, 'the request was rejected')}`);
      }
    })().finally(() => { mintingRef.current = false; setCreating(false); });
  }

  const released = sessionReleased(committee, conferenceStartDate);

  return (
    <DashCard>
      <CardHeading label={showCommittee ? committeeShort(committee.name, committee.abbreviation) : undefined} title="Your session" stackedHide />
      {!released ? (
        <p className="text-sm" style={{ color: INK_SOFT, fontFamily: OUTFIT, margin: 0 }}>
          Your committee&apos;s session will be shared by the organizing team.
        </p>
      ) : !committee.session_code ? (
        /* This used to dead-end on "Your session hasn't been created yet.
           Check back soon.", because the organiser committees page minted a
           room for every committee the moment it loaded. That is gone (735 of
           those rooms were never used by anyone), so the dais asks for its own
           room here instead. */
        <div>
          <p className="text-sm" style={{ color: INK_SOFT, fontFamily: OUTFIT, margin: '0 0 14px 0' }}>
            Your committee room has not been started yet. Start it when you are ready to chair, and you will get the code your delegates join with.
          </p>
          {(
          <button
            type="button"
            onClick={handleCreateSession}
            disabled={creating}
            aria-busy={creating || undefined}
            className="focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#B6871F]"
            style={{
              minHeight: 44, padding: '0 18px', borderRadius: 10, fontFamily: OUTFIT,
              fontSize: 14, fontWeight: 700, border: 'none',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              background: FOREST_GRADIENT, color: '#FFFFFF',
              boxShadow: '0 6px 16px -8px rgba(27,56,40,0.55)',
              cursor: creating ? 'default' : 'pointer', opacity: creating ? 0.7 : 1,
            }}
          >
            <Radio size={16} aria-hidden /> {creating ? 'Starting your room…' : 'Start your committee room'}
          </button>
          )}
          {createError && (
            <p role="alert" style={{ fontFamily: OUTFIT, fontSize: 13, color: '#8B2020', margin: '12px 0 0 0' }}>{createError}</p>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 700, color: INK_SOFT, margin: '0 0 2px 0' }}>Session code</p>
            <div className="flex items-center gap-2">
              <span style={{ fontFamily: OUTFIT, fontSize: 26, fontWeight: 800, letterSpacing: '0.08em', color: INK, fontVariantNumeric: 'tabular-nums' }}>
                {committee.session_code}
              </span>
              <button
                onClick={handleCopy}
                aria-label={copied ? 'Copied' : 'Copy session code'}
                className="inline-flex items-center gap-1.5 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F]"
                style={{ minHeight: 36, padding: '0 12px', border: 'none', background: copied ? 'rgba(61,122,82,0.12)' : 'rgba(27,56,40,0.06)', color: copied ? '#2A5A3C' : FOREST, fontFamily: OUTFIT, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >
                {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
          <span className={joinFromXlOnly ? 'hidden xl:inline-flex' : 'inline-flex'}>
            <ForestLink href={chairHref(committee, chairDisplayName)} external>
              <Radio size={16} aria-hidden /> Join as chair
            </ForestLink>
          </span>
        </div>
      )}
    </DashCard>
  );
}

// ── Overview tile: the assignment (MyMUN's committee + position) ────────────

function AssignmentTile({ committee, chairDisplayName, conferenceStartDate, delegations, papers, loading }: {
  committee: ChairCommittee;
  chairDisplayName: string;
  conferenceStartDate: string | null;
  delegations: number;
  papers: number;
  loading: boolean;
}) {
  const coChairs = Math.max(0, (committee.chair_user_ids?.length ?? 1) - 1);
  const released = sessionReleased(committee, conferenceStartDate) && !!committee.session_code;
  // On the phone page the room's own card (and the next step) carry "Join as
  // chair", so this one is the desktop Overview's only.
  const stacked = useDashStacked();
  return (
    <DashCard className="@container">
      <CardHeading title="Your assignment" stackedHide />
      <div className="flex items-center gap-4 mb-5">
        <CommitteeEmblem logoUrl={committee.logo_url} name={committee.name} abbreviation={committee.abbreviation} isCrisis={committee.committee_type === 'crisis'} size={64} />
        <TwoRowName short={committeeShort(committee.name, committee.abbreviation)} full={committee.name} size={21} />
      </div>
      <div className="grid grid-cols-2 @[480px]:grid-cols-4 gap-x-5 gap-y-4">
        <div>
          <p style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 700, color: INK_SOFT, margin: '0 0 4px 0' }}>Position</p>
          <IconWord icon={Gavel} word="Chair" color={FOREST} size="lg" />
        </div>
        <div>
          <p style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 700, color: INK_SOFT, margin: '0 0 4px 0' }}>Dais</p>
          <IconWord icon={Users} word={coChairs === 0 ? 'Just you' : `You + ${coChairs}`} color={INK} size="lg" />
        </div>
        {!loading && <BigCount n={delegations} word={delegations === 1 ? 'delegation' : 'delegations'} />}
        {!loading && <BigCount n={papers} word={papers === 1 ? 'paper in' : 'papers in'} />}
      </div>
      {released && (
        <div className={`${stacked ? 'hidden xl:flex' : 'flex'} mt-5 justify-end`}>
          <ForestLink href={chairHref(committee, chairDisplayName)} external>
            <Radio size={16} aria-hidden /> Join as chair
          </ForestLink>
        </div>
      )}
    </DashCard>
  );
}

// ── One committee's full block ──────────────────────────────────────────────

function ChairCommitteeBlock({ conferenceId, conferenceSlug, committee, chairDisplayName, conference, section, showCommittee, onSessionCreated, joinInNextStep }: {
  conferenceId: string;
  /** This room's "Join as chair" is the phone page's next step. */
  joinInNextStep: boolean;
  conferenceSlug: string;
  committee: ChairCommittee;
  chairDisplayName: string;
  conference: ChairConference;
  section: string;
  /** Passed to SessionCard: re-reads this committee after the chair starts it. */
  onSessionCreated: () => void;
  /** More than one committee: name it on the cards that do not already. */
  showCommittee: boolean;
}) {
  const conferenceStartDate = conference.start_date;
  const { user, session } = useAuth();
  const [allocations, setAllocations] = useState<RosterAllocationRow[]>([]);
  const [papers, setPapers] = useState<RosterPaper[]>([]);
  const [messagesByPaper, setMessagesByPaper] = useState<Record<string, PaperMessageStub[]>>({});
  const [loading, setLoading] = useState(true);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [actionError, setActionError] = useState('');

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    const supabase = getAuthedClient(session.access_token);
    const [{ data: allocData }, { data: paperData }] = await Promise.all([
      supabase
        .from('conference_allocations')
        .select('id, country_code, country_name, user_id, profiles:profile_cards (display_name), applications:application_id (invited_name)')
        .eq('conference_committee_id', committee.id),
      supabase
        .from('position_papers')
        .select('id, country_code, status, submitted_at, reviewer_seen_at')
        .eq('conference_committee_id', committee.id),
    ]);
    setAllocations((allocData ?? []) as unknown as RosterAllocationRow[]);
    const paperRows = (paperData ?? []) as RosterPaper[];
    setPapers(paperRows);
    setMessagesByPaper(await fetchMessageStubsForPapers(supabase, paperRows.map(p => p.id)));
    setLoading(false);
  }, [session, committee.id]);

  // Started a microtask later so no state is set synchronously in the effect.
  useEffect(() => { void Promise.resolve().then(() => load()); }, [load]);

  function markBusy(id: string, busy: boolean) {
    setBusyIds(prev => {
      const next = new Set(prev);
      if (busy) next.add(id); else next.delete(id);
      return next;
    });
  }

  function updateStatus(paperId: string, status: string) {
    if (!user || !session || busyIds.has(paperId)) return;
    const previous = papers;
    setPapers(prev => prev.map(p => p.id === paperId ? { ...p, status } : p));
    setActionError('');
    markBusy(paperId, true);
    const supabase = getAuthedClient(session.access_token);
    supabase.from('position_papers').update({
      status, reviewed_by: user.id, reviewed_at: new Date().toISOString(),
    }).eq('id', paperId).then(({ error }) => {
      markBusy(paperId, false);
      if (error) {
        setPapers(previous);
        setActionError("Couldn't update the paper status. The change was reverted.");
      }
    });
  }

  const rosterAllocations: RosterAllocation[] = allocations.map(a => ({
    country_code: a.country_code, user_id: a.user_id,
    display_name: a.profiles?.display_name ?? null,
    invited_name: a.applications?.invited_name ?? null,
  }));

  const submittedPapers = papers.length;

  // Every part stays mounted (Pane), so a half-made awards slate or a paper
  // decision in flight survives switching sections. On the phone page (below
  // xl) they stack in this order, each under its heading: the committee, the
  // room, the delegates and their papers (with awards), the study guide. The
  // Committee section is two panes so the room can sit between its header and
  // its papers; from xl they show together exactly as before.
  const stacked = useDashStacked();
  const short = committeeShort(committee.name, committee.abbreviation);
  const heading = (base: string) => (showCommittee ? `${base}: ${short}` : base);
  return (
    <>
      <Pane show={section === 'overview'} title={heading('Your Committee')} icon={Landmark}>
        <AssignmentTile
          committee={committee}
          chairDisplayName={chairDisplayName}
          conferenceStartDate={conferenceStartDate}
          delegations={allocations.length}
          papers={submittedPapers}
          loading={loading}
        />
      </Pane>

      <Pane show={section === 'committee'}>
        <CommitteeHeaderCard committee={committee} headerFromXlOnly={stacked} />
      </Pane>

      <Pane show={section === 'session'} title={heading('Your Room')} icon={Radio} anchor={`you-session-${committee.id}`}>
        <SessionCard committee={committee} chairDisplayName={chairDisplayName} conferenceStartDate={conferenceStartDate} showCommittee={showCommittee} onSessionCreated={onSessionCreated} joinFromXlOnly={stacked && joinInNextStep} />
      </Pane>

      <Pane show={section === 'committee'} title={heading('Delegates and Papers')} icon={Users}>
        <DashCard className="@container">
          <CardHeading
            label={showCommittee ? committeeShort(committee.name, committee.abbreviation) : undefined}
            title="Delegates and position papers"
            stackedHide
            aside={!loading ? (
              <span style={{ fontFamily: OUTFIT, fontSize: 13, color: INK_SOFT, fontVariantNumeric: 'tabular-nums' }}>
                <b style={{ color: INK, fontSize: 17 }}>{submittedPapers}</b> of {allocations.length} papers in
              </span>
            ) : undefined}
          />
          {loading ? (
            <div className="flex justify-center py-6">
              <Loader size={36} />
            </div>
          ) : (
            <PositionPaperRoster
              conferenceSlug={conferenceSlug}
              conferenceCommitteeId={committee.id}
              currentUserId={user?.id ?? ''}
              deadline={committee.position_paper_deadline}
              allocations={rosterAllocations}
              papers={papers}
              messagesByPaper={messagesByPaper}
              busyIds={busyIds}
              onApprove={id => updateStatus(id, 'approved')}
              onReject={id => updateStatus(id, 'rejected')}
            />
          )}
          {actionError && (
            <p role="alert" style={{ fontFamily: OUTFIT, fontSize: 13, color: '#8B2020', marginTop: 10 }}>{actionError}</p>
          )}
        </DashCard>

        {/* Awards slate: renders nothing while awards are off for the conference.
            Fed the roster and papers this block already loaded, so the card
            never refetches them. Waits for `loading` so the delegation picker
            is never briefly empty. */}
        {!loading && (
          <AwardsCard
            conferenceId={conferenceId}
            conferenceSlug={conferenceSlug}
            committee={committee}
            conference={conference}
            allocations={allocations.map(a => ({
              id: a.id, country_code: a.country_code, country_name: a.country_name, user_id: a.user_id,
              display_name: a.profiles?.display_name ?? null, invited_name: a.applications?.invited_name ?? null,
            }))}
            papers={papers.map(p => ({ country_code: p.country_code, status: p.status }))}
          />
        )}
      </Pane>

      <Pane show={section === 'documents'} title={heading('Documents')} icon={FileText}>
        <StudyGuideCard committeeId={committee.id} />
      </Pane>
    </>
  );
}

// ── ChairParticipant ─────────────────────────────────────────────────────────

export default function ChairParticipant({ conferenceId, conferenceSlug, section }: { conferenceId: string; conferenceSlug: string; section: string }) {
  const { user, session, profile } = useAuth();
  const [committees, setCommittees] = useState<ChairCommittee[]>([]);
  const [conference, setConference] = useState<ChairConference>({ start_date: null, end_date: null, awards_config: null, awards_published_at: null });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user || !session) return;
    setLoading(true);
    const supabase = getAuthedClient(session.access_token);
    const [{ data }, { data: confData }] = await Promise.all([
      supabase
        .from('conference_committees')
        .select('id, name, abbreviation, topics, difficulty, committee_type, logo_url, session_code, released_to_chairs_at, position_paper_deadline, session_id, awards_submitted_at, awards_approved_at, awards_return_note, chair_user_ids')
        .eq('conference_id', conferenceId)
        .contains('chair_user_ids', [user.id])
        .order('name', { ascending: true }),
      supabase
        .from('conferences')
        .select('start_date, end_date, awards_config, awards_published_at')
        .eq('id', conferenceId)
        .maybeSingle(),
    ]);
    setCommittees((data ?? []) as ChairCommittee[]);
    const conf = (confData ?? null) as Partial<ChairConference> | null;
    setConference({
      start_date: conf?.start_date ?? null,
      end_date: conf?.end_date ?? null,
      awards_config: conf?.awards_config ?? null,
      awards_published_at: conf?.awards_published_at ?? null,
    });
    setLoading(false);
  }, [user, session, conferenceId]);

  // Started a microtask later so no state is set synchronously in the effect.
  useEffect(() => { void Promise.resolve().then(() => load()); }, [load]);

  // A chair started their own room (SessionCard). Re-reads JUST that row, so
  // `session_id` lands too (the awards card gates on it) without `load()` and
  // its full-card loading flash. It is only ever called from that press: this
  // component mints nothing on mount, by design (owner, 7 Oct 2026).
  const refreshCommittee = useCallback(async (committeeId: string) => {
    if (!session) return;
    const supabase = getAuthedClient(session.access_token);
    const { data } = await supabase
      .from('conference_committees')
      .select('session_id, session_code')
      .eq('id', committeeId)
      .maybeSingle();
    const row = (data ?? null) as { session_id: string | null; session_code: string | null } | null;
    if (!row) return;
    setCommittees(prev => prev.map(c => (
      c.id === committeeId ? { ...c, session_id: row.session_id, session_code: row.session_code } : c
    )));
  }, [session]);

  // The phone page's next step: the first room that can be joined, else the
  // first that can be started, else what happens next.
  const stacked = useDashStacked();
  const chairName = profile?.display_name ?? 'Chair';
  const multi = committees.length > 1;
  const joinable = committees.find(c => sessionReleased(c, conference.start_date) && !!c.session_code) ?? null;
  const startable = joinable ? null : committees.find(c => sessionReleased(c, conference.start_date) && !c.session_code) ?? null;
  let step: NextStep | null = null;
  if (!loading) {
    if (committees.length === 0) {
      step = { kind: 'done', line: 'The organisers will assign your committee next. You will get an email when they do.' };
    } else if (joinable) {
      step = {
        kind: 'action',
        line: multi ? `Your ${committeeShort(joinable.name, joinable.abbreviation)} room is ready.` : 'Your committee room is ready.',
        action: { label: 'Join as chair', href: chairHref(joinable, chairName), external: true },
      };
    } else if (startable) {
      step = {
        kind: 'action',
        line: multi
          ? `Start your ${committeeShort(startable.name, startable.abbreviation)} room when you are ready to chair.`
          : 'Start your committee room when you are ready to chair.',
        action: { label: 'Go to your room', scrollTo: `you-session-${startable.id}` },
      };
    } else {
      step = { kind: 'done', line: 'Read your delegates’ position papers before the conference. Your room opens on the day.' };
    }
  }
  useReportNextStep(stacked ? step : null);

  if (loading) {
    return (
      <SectionCard>
        <div className="flex justify-center py-6">
          <Loader size={48} />
        </div>
      </SectionCard>
    );
  }

  if (committees.length === 0) {
    // On the phone page the next step already says this.
    return (
      <DashCard className={stacked ? 'hidden xl:block' : ''}>
        <CardHeading title="Your assignment" />
        <p className="inline-flex items-center gap-2" style={{ color: INK_SOFT, fontFamily: OUTFIT, fontSize: 14, margin: 0 }}>
          <Gavel size={16} strokeWidth={2.2} aria-hidden />
          You haven&apos;t been assigned a committee yet.
        </p>
      </DashCard>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {committees.map(c => (
        <ChairCommitteeBlock
          key={c.id}
          conferenceId={conferenceId}
          conferenceSlug={conferenceSlug}
          committee={c}
          chairDisplayName={profile?.display_name ?? 'Chair'}
          conference={conference}
          section={section}
          showCommittee={committees.length > 1}
          joinInNextStep={joinable?.id === c.id}
          onSessionCreated={() => { void refreshCommittee(c.id); }}
        />
      ))}
    </div>
  );
}
