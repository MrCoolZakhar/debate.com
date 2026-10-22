'use client';

// The chair's Overview (owner, 22 Oct 2026: "The chair dashboard ... should
// look similar to the head delegate's"), on the delegation Overview's system
// (delegation/overview/*): two white lifted cards EXACTLY the same size side by
// side from 760px of content width, both inside one screen at 1280x800,
// stacked and tighter on a phone.
//   left   "Your Committee" (as Your Seat): the committee's logo big and
//          centred, the acronym big with the full name beneath, the topics
//          numbered, the chairs with their photos (each opening the person's
//          public MUN CV), the live room (Start your committee room through
//          useStartChairRoom, or the code and Enter room), then two tiles side
//          by side: the study guide (Open) and the position papers to review
//          (N of M submitted, Review opens the list).
//   right  "Up Next": awards (ONLY through awardsOfferedFor, CLAUDE.md §4:
//          the slate's state and Nominate / View awards while the Awards tab
//          is open), the roster (delegations seated), and Coming up (the
//          conference dates, the paper deadline, the study guide release, the
//          room release, the awards deadline), one line each.
// Nothing here writes except the Start press. Names wrap, never cut; the
// conference's own colours (var(--gv-main)).

import { useEffect, useState } from 'react';
import { BookOpen, CalendarDays, Check, Copy, DoorOpen, FileText, Radio, Trophy, Users } from 'lucide-react';
import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { useNow } from '@/lib/useNow';
import { SkeletonBlock } from '@/components/Skeleton';
import { MonogramMedallion } from '@/components/CommitteeEditorModal';
import { committeeDisplayName } from '@/lib/presetNames';
import {
  awardsOfferedFor, chairDeadline, getAwardsConfig, slateState, SLATE_STATE_LABEL, type SlateState,
} from '@/lib/awards';
import { BTN_CLASS, cardStyle, CvAvatar, FONT, INK, INK_SOFT, LINE, OK_GREEN, OWE, STROKE } from '../delegation/leaderKit';
import { CardTitle, mainBtn, OVERVIEW_CARD, TopicsList } from '../delegation/overview/SeatCard';
import DocTile, { TileAction } from '../delegation/overview/DocTile';
import { DAY, MONTHS, dayOf, dayWords, rangeWords, relativeWords, todayStart } from '../delegation/overview/overviewDates';
import { guideState, useCommitteeGuides, useOpenStudyGuide, type CommitteeGuides } from '../delegation/committee/useCommitteeGuides';
import type { ChairRoomStart } from './useStartChairRoom';

export interface ChairOverviewCommittee {
  id: string;
  name: string;
  abbreviation: string | null;
  topics: string[] | null;
  committee_type: string;
  logo_url: string | null;
  session_code: string | null;
  released_to_chairs_at: string | null;
  position_paper_deadline: string | null;
  pp_submissions_enabled?: boolean | null;
  awards_submitted_at: string | null;
  awards_approved_at: string | null;
  awards_return_note: string | null;
  chair_user_ids: string[] | null;
}

export interface ChairOverviewConference {
  start_date: string | null;
  end_date: string | null;
  awards_config: unknown;
  awards_published_at: string | null;
}

/** The roster numbers the committee block already read (allocations, papers). */
export interface ChairRosterSummary {
  loading: boolean;
  /** Countries with an allocation in this committee. */
  delegations: number;
  /** Of those, the ones with a person in the seat. */
  seated: number;
  /** Position papers in (one per country). */
  papersIn: number;
  /** Papers still waiting for a decision. */
  toReview: number;
}

/** Where a card's button takes the chair: a dashboard section, with the
 *  pane's anchor for the one-page phone dashboard. */
export type ChairGo = (section: string, anchor: string) => void;

export default function ChairOverview({
  committee, conference, roster, room, released, chairHref, joinInNextStep, stacked, awardsTabOpen, go,
}: {
  committee: ChairOverviewCommittee;
  conference: ChairOverviewConference;
  roster: ChairRosterSummary;
  room: ChairRoomStart;
  /** The room is released to the chairs (sessionReleased). */
  released: boolean;
  /** The chair's link into the live room (only used with a code). */
  chairHref: string;
  /** On the phone page this room's Join is the next step above: no second button there. */
  joinInNextStep: boolean;
  stacked: boolean;
  /** The Awards section exists (from 7 days before the start). */
  awardsTabOpen: boolean;
  go: ChairGo;
}) {
  const guides = useCommitteeGuides([committee.id]);
  const guideEntry = guides?.get(committee.id);
  return (
    <div className="@container min-w-0">
      {/* Your Committee and Up Next side by side, EXACTLY the same size: the
          grid stretches the row and each card fills its cell. Stacked on a phone. */}
      <div className="grid gap-4 sm:gap-6 @[760px]:grid-cols-2 items-stretch">
        <div className="flex flex-col min-w-0">
          <CommitteeCard
            committee={committee}
            roster={roster}
            room={room}
            released={released}
            chairHref={chairHref}
            hideEnter={stacked && joinInNextStep}
            guidesLoading={guides === null}
            guideEntry={guideEntry}
            go={go}
          />
        </div>
        <div className="flex flex-col min-w-0">
          <UpNextCard
            committee={committee}
            conference={conference}
            roster={roster}
            guideReleaseAt={guideEntry?.releaseAt ?? null}
            awardsTabOpen={awardsTabOpen}
            go={go}
          />
        </div>
      </div>
    </div>
  );
}

// ── Left: Your Committee ─────────────────────────────────────────────────────

function CommitteeCard({ committee, roster, room, released, chairHref, hideEnter, guidesLoading, guideEntry, go }: {
  committee: ChairOverviewCommittee;
  roster: ChairRosterSummary;
  room: ChairRoomStart;
  released: boolean;
  chairHref: string;
  hideEnter: boolean;
  guidesLoading: boolean;
  guideEntry: CommitteeGuides | undefined;
  go: ChairGo;
}) {
  const short = (committee.abbreviation ?? '').trim() || committeeDisplayName(committee.name, committee.abbreviation);
  const showFull = committee.name.trim() !== short.trim();
  const isCrisis = committee.committee_type === 'crisis';
  return (
    <section aria-label="Your committee" className={OVERVIEW_CARD} style={cardStyle}>
      <CardTitle>Your Committee</CardTitle>

      {/* The committee: its logo big and centred, the acronym, the full name beneath. */}
      <div className="flex flex-col items-center text-center gap-2 min-w-0">
        {committee.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={committee.logo_url}
            alt=""
            aria-hidden
            style={{ width: 96, height: 96, objectFit: 'contain', flexShrink: 0, filter: 'drop-shadow(0 10px 18px color-mix(in srgb, var(--gv-main) 22%, transparent))' }}
          />
        ) : (
          <MonogramMedallion text={committee.abbreviation || committee.name} isCrisis={isCrisis} size={88} />
        )}
        <p className="[overflow-wrap:anywhere] max-w-full" style={{ fontFamily: FONT, fontSize: 26, fontWeight: 700, color: INK, margin: '4px 0 0 0', lineHeight: 1.15, letterSpacing: '-0.01em' }}>
          {short}
        </p>
        {showFull && (
          <p className="[overflow-wrap:anywhere] max-w-full" style={{ fontFamily: FONT, fontSize: 14, color: INK_SOFT, margin: 0, lineHeight: 1.35 }}>
            {committee.name}
          </p>
        )}
        <ChairsLine ids={committee.chair_user_ids ?? []} />
      </div>

      <TopicsList topics={committee.topics} />

      <RoomBlock committee={committee} room={room} released={released} chairHref={chairHref} hideEnter={hideEnter} />

      {/* The two tiles side by side; stacked on a narrow card. */}
      <div className="@container min-w-0 mt-auto">
        <div className="grid gap-2.5 grid-cols-1 @[380px]:grid-cols-2">
          <ChairGuideTile loading={guidesLoading} entry={guideEntry} />
          <DocTile
            Icon={FileText}
            title="Position papers"
            line={roster.loading
              ? <SkeletonBlock width="60%" height={12} />
              : roster.delegations === 0
                ? 'No delegations yet'
                : `${roster.papersIn} of ${roster.delegations} submitted${roster.toReview > 0 ? `, ${roster.toReview} to review` : ''}`}
            lineColor={!roster.loading && roster.toReview > 0 ? OWE : undefined}
            action={<TileAction Icon={Users} label="Review" onClick={() => go('committee', `you-papers-${committee.id}`)} />}
          />
        </div>
      </div>
    </section>
  );
}

/** The chairs of the committee: small photos and names, each opening the
 *  person's public MUN CV. Accounts the viewer cannot read count as "more". */
function ChairsLine({ ids }: { ids: string[] }) {
  const people = useChairProfiles(ids);
  if (ids.length === 0) return null;
  if (people === null) {
    return <div className="flex justify-center" aria-hidden><SkeletonBlock width={160} height={24} radius={12} /></div>;
  }
  const hidden = Math.max(0, ids.length - people.length);
  return (
    <div className="flex flex-col items-center gap-1.5 min-w-0 max-w-full" style={{ marginTop: 4 }}>
      <span style={{ fontFamily: FONT, fontSize: 13, fontWeight: 600, color: INK_SOFT }}>{ids.length === 1 ? 'Chair' : 'Chairs'}</span>
      <ul className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 min-w-0" style={{ listStyle: 'none', margin: 0, padding: 0 }} aria-label="Chairs">
        {people.map(p => (
          <li key={p.id} className="inline-flex items-center gap-1.5 min-w-0">
            <CvAvatar userId={p.id} name={p.name} url={p.avatar_url} size={26} seed={p.id} />
            <span className="[overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 13.5, fontWeight: 600, color: INK, lineHeight: 1.25 }}>{p.name}</span>
          </li>
        ))}
        {hidden > 0 && (
          <li style={{ fontFamily: FONT, fontSize: 13.5, color: INK_SOFT }}>
            {people.length === 0 ? `${hidden} ${hidden === 1 ? 'chair' : 'chairs'}` : `and ${hidden} more`}
          </li>
        )}
      </ul>
    </div>
  );
}

interface ChairProfile { id: string; name: string; avatar_url: string | null }

/** The dais's names and photos (profile_cards: RLS shows what the viewer may
 *  see), in the order the organisers set the chairs. */
function useChairProfiles(ids: string[]): ChairProfile[] | null {
  const key = [...new Set(ids.filter(Boolean))].sort().join(',');
  const [loaded, setLoaded] = useState<{ key: string; rows: ChairProfile[] } | null>(null);
  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    (async () => {
      const client = await getFreshAuthedClient();
      if (!client || cancelled) return;
      const { data, error } = await client.from('profile_cards').select('id, display_name, avatar_url').in('id', key.split(','));
      if (cancelled) return;
      const rows = error ? [] : ((data ?? []) as { id: string; display_name: string | null; avatar_url: string | null }[])
        .filter(r => (r.display_name ?? '').trim())
        .map(r => ({ id: r.id, name: (r.display_name ?? '').trim(), avatar_url: r.avatar_url }));
      setLoaded({ key, rows });
    })().catch(() => { if (!cancelled) setLoaded({ key, rows: [] }); });
    return () => { cancelled = true; };
  }, [key]);
  if (!key) return [];
  if (loaded?.key !== key) return null;
  const byId = new Map(loaded.rows.map(r => [r.id, r]));
  return [...new Set(ids)].map(id => byId.get(id)).filter((r): r is ChairProfile => !!r);
}

/** The live room: not released yet, Start your committee room, or the code and Enter room. */
function RoomBlock({ committee, room, released, chairHref, hideEnter }: {
  committee: ChairOverviewCommittee;
  room: ChairRoomStart;
  released: boolean;
  chairHref: string;
  hideEnter: boolean;
}) {
  const [copied, setCopied] = useState(false);
  function copy() {
    if (!committee.session_code) return;
    void navigator.clipboard.writeText(committee.session_code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }
  const frame: React.CSSProperties = { borderTop: `1px solid ${LINE}`, paddingTop: 14, scrollMarginTop: 96 };
  const icon = <Radio size={22} strokeWidth={STROKE} aria-hidden style={{ color: INK, flexShrink: 0, marginTop: 1 }} />;

  if (!released) {
    return (
      <div id={`you-session-${committee.id}`} className="flex items-start gap-3" style={frame}>
        {icon}
        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          <span style={{ fontFamily: FONT, fontSize: 15, fontWeight: 600, color: INK }}>Your room</span>
          <span style={{ fontFamily: FONT, fontSize: 13.5, color: INK_SOFT, lineHeight: 1.45 }}>
            Your committee&apos;s session will be shared by the organizing team.
          </span>
        </div>
      </div>
    );
  }

  if (!committee.session_code) {
    return (
      <div id={`you-session-${committee.id}`} className="flex flex-col gap-2" style={frame}>
        <div className="flex items-center gap-3 flex-wrap">
          {icon}
          <span className="flex-1 min-w-0" style={{ fontFamily: FONT, fontSize: 13.5, color: INK_SOFT, lineHeight: 1.45, minWidth: 160 }}>
            Start your room when you are ready to chair. You get the code your delegates join with.
          </span>
          <button
            type="button"
            onClick={room.start}
            disabled={room.creating}
            aria-busy={room.creating || undefined}
            className={BTN_CLASS}
            style={{ ...mainBtn, cursor: room.creating ? 'default' : 'pointer', opacity: room.creating ? 0.7 : 1 }}
          >
            <Radio size={16} strokeWidth={STROKE} aria-hidden />
            {room.creating ? 'Starting your room…' : 'Start your committee room'}
          </button>
        </div>
        {room.error && (
          <p role="alert" style={{ fontFamily: FONT, fontSize: 13, color: '#8B2020', margin: 0 }}>{room.error}</p>
        )}
      </div>
    );
  }

  return (
    <div id={`you-session-${committee.id}`} className="flex items-center gap-3 flex-wrap" style={frame}>
      {icon}
      <div className="flex-1 min-w-0 flex flex-col">
        <span style={{ fontFamily: FONT, fontSize: 13, fontWeight: 600, color: INK_SOFT }}>Session code</span>
        <span className="inline-flex items-center gap-1.5">
          <span style={{ fontFamily: FONT, fontSize: 22, fontWeight: 700, letterSpacing: '0.08em', color: INK, fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>
            {committee.session_code}
          </span>
          <button
            type="button"
            onClick={copy}
            aria-label={copied ? 'Copied' : 'Copy session code'}
            title={copied ? 'Copied' : 'Copy'}
            className={`${BTN_CLASS} inline-flex items-center justify-center rounded-full`}
            style={{ width: 36, height: 36, border: 'none', background: 'transparent', cursor: 'pointer', color: copied ? OK_GREEN : 'var(--gv-main)' }}
          >
            {copied ? <Check size={17} strokeWidth={STROKE} aria-hidden /> : <Copy size={17} strokeWidth={STROKE} aria-hidden />}
          </button>
        </span>
      </div>
      {!hideEnter && (
        <a href={chairHref} className={BTN_CLASS} style={mainBtn}>
          <DoorOpen size={17} strokeWidth={STROKE} aria-hidden />
          Enter room
        </a>
      )}
    </div>
  );
}

/** The committee's study guide: released (Open), out on a date, or not out yet. */
function ChairGuideTile({ loading, entry }: { loading: boolean; entry: CommitteeGuides | undefined }) {
  const now = useNow();
  const openGuide = useOpenStudyGuide();
  const g = guideState(entry, now);
  const files = entry?.guides ?? [];
  return (
    <DocTile
      Icon={BookOpen}
      title="Study guide"
      line={loading ? <SkeletonBlock width="60%" height={12} /> : g.line}
      action={g.kind === 'open' && files.length > 0
        ? files.map(f => (
          <TileAction key={f.id} Icon={BookOpen} label={files.length === 1 ? 'Open' : f.title} onClick={() => openGuide(f.file_url)} />
        ))
        : undefined}
    />
  );
}

// ── Right: Up Next ───────────────────────────────────────────────────────────

const blockStyle: React.CSSProperties = { borderTop: `1px solid ${LINE}`, paddingTop: 12 };
const blockLabel: React.CSSProperties = { fontFamily: FONT, fontSize: 13, fontWeight: 600, color: INK_SOFT };
const quietBtn: React.CSSProperties = {
  minHeight: 36, padding: '0 8px', border: 'none', background: 'transparent', cursor: 'pointer',
  fontFamily: FONT, fontSize: 13.5, fontWeight: 600, color: 'var(--gv-main)',
};

const SLATE_LINE: Record<SlateState, string> = {
  off: '',
  open: 'Choose your committee’s awards and send them to the secretariat.',
  returned: 'The secretariat sent your awards back. Edit them and send again.',
  submitted: 'Sent. The secretariat reviews them next.',
  approved: 'Approved by the secretariat.',
  published: 'Announced to delegates.',
};

function UpNextCard({ committee, conference, roster, guideReleaseAt, awardsTabOpen, go }: {
  committee: ChairOverviewCommittee;
  conference: ChairOverviewConference;
  roster: ChairRosterSummary;
  guideReleaseAt: string | null;
  awardsTabOpen: boolean;
  go: ChairGo;
}) {
  const today = todayStart();
  const cfg = getAwardsConfig(conference.awards_config);
  // CLAUDE.md §4: a chair is offered awards ONLY through awardsOfferedFor;
  // a published ceremony stays visible.
  const offered = awardsOfferedFor(cfg, committee.id);
  const state = slateState(committee, conference.awards_published_at, cfg);
  const showAwards = offered || state === 'published';
  const deadline = offered ? chairDeadline(cfg, conference.end_date) : null;
  const editable = state === 'open' || state === 'returned';

  // Coming up: every date ahead, in order, one line each.
  const rows: { key: string; day: number; what: string; end?: number | null }[] = [];
  const start = dayOf(conference.start_date);
  const end = dayOf(conference.end_date);
  if (start !== null && (end ?? start) >= today) rows.push({ key: 'conf', day: start, what: 'Conference', end });
  const ppDue = committee.pp_submissions_enabled === false ? null : dayOf(committee.position_paper_deadline);
  if (ppDue !== null && ppDue >= today) rows.push({ key: 'pp', day: ppDue, what: 'Position papers due' });
  const guideOut = dayOf(guideReleaseAt);
  if (guideOut !== null && guideOut >= today) rows.push({ key: 'sg', day: guideOut, what: 'Study guide out' });
  const roomOut = dayOf(committee.released_to_chairs_at);
  if (roomOut !== null && roomOut > today) rows.push({ key: 'room', day: roomOut, what: 'Your room opens' });
  const awardsDue = deadline && editable ? dayOf(deadline.toISOString()) : null;
  if (awardsDue !== null && awardsDue >= today) rows.push({ key: 'aw', day: awardsDue, what: 'Awards due' });
  rows.sort((a, b) => a.day - b.day);
  const shown = rows.slice(0, 4);

  return (
    <section aria-label="Up next" className={OVERVIEW_CARD} style={cardStyle}>
      <CardTitle>Up Next</CardTitle>

      {showAwards && (
        <div className="flex items-start gap-3 flex-wrap min-w-0">
          <Trophy size={22} strokeWidth={STROKE} aria-hidden style={{ color: INK, flexShrink: 0, marginTop: 1 }} />
          <div className="flex-1 min-w-0 flex flex-col gap-0.5" style={{ minWidth: 160 }}>
            <span className="inline-flex items-baseline gap-2 flex-wrap" style={{ fontFamily: FONT }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: INK }}>Awards</span>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: state === 'returned' ? OWE : state === 'open' ? INK_SOFT : OK_GREEN }}>
                {SLATE_STATE_LABEL[state]}
              </span>
            </span>
            <span style={{ fontFamily: FONT, fontSize: 13.5, color: INK_SOFT, lineHeight: 1.45 }}>
              {awardsTabOpen || !editable ? SLATE_LINE[state] : 'Nominations open 7 days before the conference.'}
              {editable && deadline && ` Due ${dayWords(dayOf(deadline.toISOString()) ?? today)}.`}
            </span>
          </div>
          {awardsTabOpen && (
            <button type="button" onClick={() => go('awards', `you-awards-${committee.id}`)} className={BTN_CLASS} style={editable ? mainBtn : { ...quietBtn, minHeight: 44 }}>
              {editable ? 'Nominate' : 'View awards'}
            </button>
          )}
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap min-w-0" style={showAwards ? blockStyle : undefined}>
        <Users size={22} strokeWidth={STROKE} aria-hidden style={{ color: INK, flexShrink: 0 }} />
        {roster.loading ? (
          <SkeletonBlock width="45%" height={20} />
        ) : (
          <span className="flex-1 min-w-0 inline-flex items-baseline gap-1.5 flex-wrap" style={{ fontFamily: FONT }}>
            <span style={{ fontSize: 22, fontWeight: 600, color: INK, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>{roster.seated}</span>
            {roster.delegations !== roster.seated && (
              <span style={{ fontSize: 15, fontWeight: 500, color: INK_SOFT, fontVariantNumeric: 'tabular-nums' }}>of {roster.delegations}</span>
            )}
            <span style={{ fontSize: 14, color: INK_SOFT }}>{roster.delegations === 1 ? 'delegation seated' : 'delegations seated'}</span>
          </span>
        )}
        <button type="button" onClick={() => go('committee', `you-papers-${committee.id}`)} className={BTN_CLASS} style={quietBtn}>
          See delegates
        </button>
      </div>

      <div className="flex flex-col gap-1.5" style={blockStyle}>
        <span className="inline-flex items-center gap-2" style={blockLabel}>
          <CalendarDays size={16} strokeWidth={STROKE} aria-hidden style={{ color: INK }} />
          Coming up
        </span>
        {shown.length === 0 ? (
          <p style={{ fontFamily: FONT, fontSize: 13.5, color: INK_SOFT, margin: 0, lineHeight: 1.45 }}>
            {start === null ? 'The conference dates are to be decided.' : 'Nothing due right now.'}
          </p>
        ) : (
          <ol className="flex flex-col gap-1" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {shown.map(r => {
              const d = new Date(r.day);
              return (
                <li key={r.key} className="flex items-baseline gap-3 min-w-0" style={{ fontFamily: FONT, fontSize: 14, lineHeight: 1.35 }}>
                  <span className="flex-none" style={{ width: 52, fontWeight: 600, color: INK, fontVariantNumeric: 'tabular-nums' }}>
                    {d.getDate()} {MONTHS[d.getMonth()]}
                  </span>
                  <span className="flex-1 min-w-0 [overflow-wrap:anywhere]" style={{ color: INK }}>
                    {r.what}
                    {r.key === 'conf' && <span style={{ color: INK_SOFT }}>{` · ${rangeWords(r.day, r.end ?? null)}`}</span>}
                  </span>
                  <span className="flex-none text-right" style={{ fontSize: 13, fontWeight: 600, color: r.day - today <= 7 * DAY ? OWE : INK_SOFT }}>
                    {r.key === 'conf' && r.day <= today ? 'now' : relativeWords(r.day, today)}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}
