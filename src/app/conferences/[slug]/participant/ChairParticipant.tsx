'use client';

// Chair participant view. A chair may hold the dais on more than one
// committee, so this fetches every conference_committees row where
// chair_user_ids contains them (safe under "Associated users read their
// committee" RLS, row-level, so session_code etc. only comes back for
// committees they actually chair) and stacks a full block per committee.

import { useState, useEffect, useCallback } from 'react';
import { Copy, Check, FileText, Gavel, Landmark, Radio, Signal, Trophy, Users } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { MonogramMedallion } from '@/components/CommitteeEditorModal';
import { getSiteUrl } from '@/lib/emailBlocks';
import PositionPaperRoster, { type RosterAllocation, type RosterPaper } from '@/components/PositionPaperRoster';
import { fetchMessageStubsForPapers, type PaperMessageStub } from '@/lib/positionPapers';
import StudyGuideCard from './StudyGuideCard';
import AwardsCard, { type AwardsCardConference } from './AwardsCard';
import { awardsOfferedFor, getAwardsConfig } from '@/lib/awards';
import { dayInZone } from '@/lib/applicationWindow';
import Loader from '@/components/Loader';
import { SectionCard, OUTFIT, capitalize, chairRoomOpensAt } from './shared';
import { REOPEN_WINDOW_HOURS } from '@/lib/roomRetention';
import { conferenceLastDayEndsAtMs } from '@/lib/conferenceRoomWindow';
import { serverNow } from '@/lib/serverClock';
import { DashCard, CardHeading, ForestLink, Pane, committeeShort, useDashStacked, useReportNextStep, type NextStep, FOREST, FOREST_GRADIENT, INK, INK_SOFT } from './dashboardKit';
import ChairOverview, { type ChairRosterSummary } from './chair/ChairOverview';
import { useStartChairRoom, type ChairRoomStart } from './chair/useStartChairRoom';

const DIFFICULTY_STYLES: Record<string, { color: string }> = {
  beginner: { color: 'var(--gv-main-mid)' },
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
  position_paper_deadline: string | null;
  /** Papers closed: no due date and no "Late" (prompt 141). */
  pp_submissions_enabled?: boolean | null;
  session_id: string | null;
  awards_submitted_at: string | null;
  awards_approved_at: string | null;
  awards_return_note: string | null;
  chair_user_ids: string[] | null;
  /** The linked room ended and can no longer be restarted (its conference's last day is
   *  over, src/lib/roomRetention.ts). Read here, never stored: the cards then offer
   *  "Start your committee room", and `start_my_chair_session` mints a fresh room
   *  (scratch-conference-rooms.sql, section C1). */
  room_retired?: boolean;
}

/** The conference fields the chair's blocks need beyond the id: the session
 *  release fallback (start_date) and the awards lifecycle (end_date is the
 *  default chair deadline, awards_config the categories and quotas,
 *  awards_published_at the ceremony moment). */
interface ChairConference extends AwardsCardConference {
  start_date: string | null;
  timezone: string | null;
}

/** Today in the conference's timezone (else UTC), as YYYY-MM-DD. */
function conferenceToday(timeZone: string | null): string {
  return dayInZone(new Date().toISOString(), timeZone);
}

/** YYYY-MM-DD moved by n days (date-only arithmetic, no timezone). */
function shiftDay(day: string, n: number): string {
  const [y, m, d] = day.slice(0, 10).split('-').map(Number);
  const t = new Date(Date.UTC(y, (m || 1) - 1, d || 1) + n * 86400000);
  return t.toISOString().slice(0, 10);
}

/** The chair's Awards tab (prompt 134): from 7 days before the conference's
 *  start date (its timezone), and only where the card would show today (awards
 *  set up and offered for one of these committees, or already published). */
function awardsTabState(conference: ChairConference, committees: { id: string }[]): { open: boolean; started: boolean } {
  const start = conference.start_date?.slice(0, 10) ?? null;
  if (!start) return { open: false, started: false };
  const today = conferenceToday(conference.timezone);
  const cfg = getAwardsConfig(conference.awards_config);
  const offered = !!conference.awards_published_at || committees.some(c => awardsOfferedFor(cfg, c.id));
  return { open: offered && today >= shiftDay(start, -7), started: today >= start };
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

function CommitteeHeaderCard({ committee }: { committee: ChairCommittee }) {
  const diff = committee.difficulty?.toLowerCase() ?? '';
  const diffStyle = DIFFICULTY_STYLES[diff] ?? DIFFICULTY_STYLES.intermediate;
  const isCrisis = committee.committee_type === 'crisis';
  const topics = committee.topics ?? [];

  return (
    <SectionCard>
      <div className="flex flex-col items-center text-center">
        <div className="flex flex-col items-center">
        {committee.logo_url ? (
          <img
            src={committee.logo_url}
            alt={committee.abbreviation ?? committee.name}
            style={{ width: '96px', height: '96px', objectFit: 'contain', flexShrink: 0, filter: 'drop-shadow(0 10px 18px color-mix(in srgb, var(--gv-main) 28%, transparent))' }}
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
              <span aria-hidden style={{ color: 'color-mix(in srgb, var(--gv-accent) 55%, transparent)', fontSize: '7px' }}>◆</span>
              <span className="text-[10px] font-bold" style={{ color: '#8B2020', fontFamily: OUTFIT, letterSpacing: '0.12em' }}>CRISIS</span>
            </>
          )}
        </div>
        {topics.length > 0 && (
          <div className="w-full mt-5 pt-4 text-left" style={{ borderTop: '1px solid rgba(221,212,192,0.55)' }}>
            {topics.map((topic, ti) => (
              <div key={topic} className="flex items-start gap-2.5 py-1">
                <span className="flex-shrink-0 text-right" style={{ fontFamily: OUTFIT, fontWeight: 600, fontVariantNumeric: 'tabular-nums', fontSize: '11px', color: 'var(--gv-accent)', width: '18px', lineHeight: '19px' }}>
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

function sessionReleased(_committee: ChairCommittee, conferenceStartDate: string | null): boolean {
  // No organiser release date any more (owner, 23 Oct 2026): a chair sees the room code
  // from a week before the conference starts, the day the first chair email goes out
  // (`chairRoomOpensAt`). `released_to_chairs_at` is no longer read. No dates yet: shown.
  const opensMs = chairRoomOpensAt(conferenceStartDate);
  return opensMs === null || opensMs <= Date.now();
}

/** Ended for good: past its reopen window (a conference room: the end of the conference's
 *  last day, and never less than 24 hours after the end). Same rule as the chair page. */
function roomRetired(endedAt: string | null | undefined, conf: { start_date: string | null; end_date: string | null; timezone?: string | null }): boolean {
  if (!endedAt) return false;
  const ended = Date.parse(endedAt);
  if (!Number.isFinite(ended)) return false;
  const until = Math.max(ended + REOPEN_WINDOW_HOURS * 3_600_000, conferenceLastDayEndsAtMs(conf) ?? 0);
  return serverNow() >= until;
}

/** `room_retired` for each committee, from one read of its rooms' `ended_at`. A failed read keeps every room as it is. */
async function withRetiredRooms(
  supabase: ReturnType<typeof getAuthedClient>,
  rows: ChairCommittee[],
  conf: { start_date: string | null; end_date: string | null; timezone?: string | null },
): Promise<ChairCommittee[]> {
  const ids = rows.map((c) => c.session_id).filter((id): id is string => !!id);
  if (ids.length === 0) return rows;
  const { data, error } = await supabase.from('committees').select('id, ended_at').in('id', ids);
  if (error) return rows;
  const ended = new Map(((data ?? []) as { id: string; ended_at: string | null }[]).map((r) => [r.id, r.ended_at]));
  return rows.map((c) => ({ ...c, room_retired: !!c.session_id && roomRetired(ended.get(c.session_id), conf) }));
}

function chairHref(committee: ChairCommittee, chairDisplayName: string): string {
  return `${getSiteUrl()}/chair/${committee.session_code}?chairName=${encodeURIComponent(chairDisplayName)}`;
}

function SessionCard({ committee, chairDisplayName, conferenceStartDate, showCommittee, room }: {
  committee: ChairCommittee;
  chairDisplayName: string;
  conferenceStartDate: string | null;
  showCommittee: boolean;
  /** The Start press (useStartChairRoom), shared with the Overview's card:
   *  start_my_chair_session, one press one room, then a re-read of the row. */
  room: ChairRoomStart;
}) {
  const [copied, setCopied] = useState(false);
  const creating = room.creating;
  const createError = room.error;
  const handleCreateSession = room.start;

  function handleCopy() {
    if (!committee.session_code) return;
    navigator.clipboard.writeText(committee.session_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const released = sessionReleased(committee, conferenceStartDate);

  return (
    <DashCard>
      <CardHeading label={showCommittee ? committeeShort(committee.name, committee.abbreviation) : undefined} title="Your session" stackedHide />
      {!released ? (
        <p className="text-sm" style={{ color: INK_SOFT, fontFamily: OUTFIT, margin: 0 }}>
          Your room code shows here a week before the conference starts.
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
            className="focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--gv-accent)]"
            style={{
              minHeight: 44, padding: '0 18px', borderRadius: 10, fontFamily: OUTFIT,
              fontSize: 14, fontWeight: 700, border: 'none',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              background: FOREST_GRADIENT, color: '#FFFFFF',
              boxShadow: '0 6px 16px -8px color-mix(in srgb, var(--gv-main) 55%, transparent)',
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
                className="inline-flex items-center gap-1.5 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gv-accent)]"
                style={{ minHeight: 36, padding: '0 12px', border: 'none', background: copied ? 'color-mix(in srgb, var(--gv-main-light) 12%, transparent)' : 'color-mix(in srgb, var(--gv-main) 6%, transparent)', color: copied ? 'var(--gv-main-mid)' : FOREST, fontFamily: OUTFIT, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >
                {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
          <span className="inline-flex">
            <ForestLink href={chairHref(committee, chairDisplayName)} external>
              <Radio size={16} aria-hidden /> Join as chair
            </ForestLink>
          </span>
        </div>
      )}
    </DashCard>
  );
}

// ── One committee's full block ──────────────────────────────────────────────

function ChairCommitteeBlock({ conferenceId, conferenceSlug, committee, chairDisplayName, conference, section, showCommittee, onSessionCreated, joinInNextStep, awardsTab, onSelectSection }: {
  conferenceId: string;
  /** Opens a dashboard section (the Overview cards' Review, Nominate, See delegates). */
  onSelectSection?: (key: string) => void;
  /** The Awards tab is open (7 days before the start, awards set up) and whether the conference has started. */
  awardsTab: { open: boolean; started: boolean };
  /** This room's "Join as chair" is the phone page's next step. */
  joinInNextStep: boolean;
  conferenceSlug: string;
  committee: ChairCommittee;
  chairDisplayName: string;
  conference: ChairConference;
  section: string;
  /** Re-reads this committee after the chair starts its room. */
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
        .select('id, country_code, status, submitted_at, reviewer_seen_at, file_url, file_name')
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

  // The Start press, ONE per committee block, shared by the Overview card and
  // the Session section (one in-flight guard for both buttons). A retired room
  // (ended, past its reopen window) shows as no room, so both cards offer Start.
  const room = useStartChairRoom(committee.id, !!committee.session_code && !committee.room_retired, onSessionCreated, !!committee.room_retired);
  const shownCommittee = committee.room_retired ? { ...committee, session_code: null } : committee;

  // The roster numbers the Overview shows, from the reads above: one
  // delegation per country, seated when a person holds an allocation of it.
  const countries = new Set(allocations.map(a => a.country_code));
  const seatedCountries = new Set(allocations.filter(a => a.user_id || a.applications).map(a => a.country_code));
  const roster: ChairRosterSummary = {
    loading,
    delegations: countries.size,
    seated: seatedCountries.size,
    papersIn: new Set(papers.map(p => p.country_code)).size,
    toReview: papers.filter(p => (p.status ?? '').toLowerCase() === 'submitted').length,
  };

  // The Overview cards' buttons: from lg the dashboard shows one section at a
  // time, so they open it; on the one-page phone dashboard every section is
  // already on the page, so they scroll to its pane.
  const go = (key: string, anchor: string) => {
    const wide = typeof window !== 'undefined' && window.matchMedia?.('(min-width: 1024px)').matches;
    if (wide && onSelectSection) { onSelectSection(key); return; }
    const el = document.getElementById(anchor);
    if (!el) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  };

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
      {/* Overview (owner, 22 Oct 2026): Your Committee and Up Next, on the
          head delegate's Overview system. Its room block carries the
          `you-session-<id>` anchor the phone page's next step scrolls to. */}
      <Pane show={section === 'overview'} title={showCommittee ? heading('Overview') : undefined} icon={Landmark}>
        <ChairOverview
          committee={shownCommittee}
          conference={conference}
          roster={roster}
          room={room}
          released={sessionReleased(committee, conferenceStartDate)}
          chairHref={shownCommittee.session_code ? chairHref(shownCommittee, chairDisplayName) : ''}
          joinInNextStep={joinInNextStep}
          stacked={stacked}
          awardsTabOpen={awardsTab.open}
          go={go}
        />
      </Pane>

      {/* From lg only: on the phone page Your Committee above already shows
          the emblem, the name, the topics and the room. */}
      <Pane show={section === 'committee'} phone={false}>
        <CommitteeHeaderCard committee={committee} />
      </Pane>

      <Pane show={section === 'session'} phone={false}>
        <SessionCard committee={shownCommittee} chairDisplayName={chairDisplayName} conferenceStartDate={conferenceStartDate} showCommittee={showCommittee} room={room} />
      </Pane>

      <Pane show={section === 'committee'} title={heading('Delegates and Papers')} icon={Users} anchor={`you-papers-${committee.id}`}>
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
              deadline={committee.pp_submissions_enabled === false ? null : committee.position_paper_deadline}
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

      </Pane>

      {awardsTab.open && (
        <Pane show={section === 'awards'} title={heading('Awards')} icon={Trophy} anchor={`you-awards-${committee.id}`}>
        {/* Awards (prompt 134: a tab of its own, from 7 days before the start).
            The card renders nothing while awards are off for the conference.
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
            conferenceStarted={awardsTab.started}
          />
        )}
        </Pane>
      )}

      <Pane show={section === 'documents'} title={heading('Documents')} icon={FileText}>
        <StudyGuideCard committeeId={committee.id} />
      </Pane>
    </>
  );
}

// ── ChairParticipant ─────────────────────────────────────────────────────────

export default function ChairParticipant({ conferenceId, conferenceSlug, section, onAwardsTab, onSelectSection }: {
  conferenceId: string; conferenceSlug: string; section: string;
  /** Opens a dashboard section from the Overview cards (ParticipantView's selectSection). */
  onSelectSection?: (key: string) => void;
  /** Tells the dashboard whether to show the Awards tab (prompt 134). */
  onAwardsTab?: (open: boolean) => void;
}) {
  const { user, session, profile } = useAuth();
  const [committees, setCommittees] = useState<ChairCommittee[]>([]);
  const [conference, setConference] = useState<ChairConference>({ start_date: null, end_date: null, awards_config: null, awards_published_at: null, timezone: null });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user || !session) return;
    setLoading(true);
    const supabase = getAuthedClient(session.access_token);
    const [{ data }, { data: confData }] = await Promise.all([
      supabase
        .from('conference_committees')
        .select('id, name, abbreviation, topics, difficulty, committee_type, logo_url, session_code, position_paper_deadline, pp_submissions_enabled, session_id, awards_submitted_at, awards_approved_at, awards_return_note, chair_user_ids')
        .eq('conference_id', conferenceId)
        .contains('chair_user_ids', [user.id])
        .order('name', { ascending: true }),
      supabase
        .from('conferences')
        .select('start_date, end_date, awards_config, awards_published_at, timezone')
        .eq('id', conferenceId)
        .maybeSingle(),
    ]);
    const conf = (confData ?? null) as Partial<ChairConference> | null;
    setCommittees(await withRetiredRooms(supabase, (data ?? []) as ChairCommittee[], {
      start_date: conf?.start_date ?? null, end_date: conf?.end_date ?? null, timezone: conf?.timezone ?? null,
    }));
    setConference({
      start_date: conf?.start_date ?? null,
      end_date: conf?.end_date ?? null,
      awards_config: conf?.awards_config ?? null,
      awards_published_at: conf?.awards_published_at ?? null,
      timezone: conf?.timezone ?? null,
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
    // The room handed back may still be the retired one (before section C1 of
    // scratch-conference-rooms.sql is applied): re-read whether it is.
    const [fresh] = await withRetiredRooms(supabase, [{ session_id: row.session_id } as ChairCommittee], conference);
    setCommittees(prev => prev.map(c => (
      c.id === committeeId ? { ...c, session_id: row.session_id, session_code: row.session_code, room_retired: !!fresh?.room_retired } : c
    )));
  }, [session, conference]);

  // The phone page's next step: the first room that can be joined, else the
  // first that can be started, else what happens next.
  const stacked = useDashStacked();
  const chairName = profile?.display_name ?? 'Chair';
  const multi = committees.length > 1;
  const joinable = committees.find(c => sessionReleased(c, conference.start_date) && !!c.session_code && !c.room_retired) ?? null;
  const startable = joinable ? null : committees.find(c => sessionReleased(c, conference.start_date) && (!c.session_code || !!c.room_retired)) ?? null;
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
      step = { kind: 'done', line: 'Read your delegates’ position papers before the conference. Your room code shows here a week before it starts.' };
    }
  }
  useReportNextStep(stacked ? step : null);

  // The Awards tab (prompt 134): reported to the dashboard's rail.
  const awardsTab = awardsTabState(conference, committees);
  useEffect(() => { onAwardsTab?.(!loading && awardsTab.open); }, [onAwardsTab, loading, awardsTab.open]);

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
      <DashCard className={stacked ? 'hidden lg:block' : ''}>
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
          awardsTab={awardsTab}
          onSelectSection={onSelectSection}
          onSessionCreated={() => { void refreshCommittee(c.id); }}
        />
      ))}
    </div>
  );
}
