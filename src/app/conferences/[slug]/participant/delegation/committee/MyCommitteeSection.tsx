'use client';

// The delegate's Committee section on the You page (taste board 5A, 19 Oct
// 2026). Mobile first: one column of white lifted cards on a phone; from a
// wide content column the committee card sits beside the two document cards
// and the committee list runs the full width in two columns.
//
//   1. The committee: its round logo, acronym over the full name, "You
//      represent" with the round flag (or the seat's crest), the topics, the
//      double-delegation partner (my_co_delegates, CoDelegateCard's read) and
//      the live room's code once it opens. The chairs' names are left out:
//      a delegate has no read of them (profiles RLS), a new read is owed.
//   2. Study guide (the study_guides read) and Position paper (the state the
//      Documents section's PositionPaperCard already reported); both buttons
//      lead to the Documents section, where the full cards stay.
//   3. The committee list (my_committee_roster), only while DELEGATIONS_V2_DB.

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { BookOpen, Copy, FileText, Landmark, Radio, Search } from 'lucide-react';
import { CircleFlag } from '@/components/CircleFlag';
import ProfileLink from '@/components/ProfileLink';
import { SkeletonBlock } from '@/components/Skeleton';
import { committeeDisplayName } from '@/lib/presetNames';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { useNow } from '@/lib/useNow';
import { useSeatCrest } from '../../AllocationCard';
import { useCoDelegate } from '../../CoDelegateCard';
import { effectiveReleaseTime, formatReleaseDate } from '../../shared';
import type { ParticipantAllocation, ParticipantCommittee } from '../../types';
import {
  BTN_CLASS, CommitteeDisc, FONT, FOREST, INK, INK_SOFT, OK_GREEN, OWE, RoundAvatar, STROKE, StatNumber,
  cardStyle, committeeEmblemSrc, linkStyle, primaryBtn,
} from '../leaderKit';
import { DELEGATIONS_V2_DB } from '../v2';
import { useCommitteeRoster } from './committeeRoster';
import { guideState, shortDay, useCommitteeGuides, useOpenStudyGuide } from './useCommitteeGuides';
import { CardTitle, MINE_TINT, ROW_LINE, SOFT_PANEL, SmallLabel } from './youKit';

export interface PaperSummary {
  enabled: boolean;
  submitted: boolean;
}

async function copyText(text: string, done: string) {
  try {
    await navigator.clipboard.writeText(text);
    notifyOk(done);
  } catch {
    notifyErr('Could not copy. Select the text and copy it instead.');
  }
}

export default function MyCommitteeSection({ conferenceId, conferenceStartDate, committee, myAllocation, paper, onOpenDocuments, joinFromXlOnly }: {
  conferenceId: string;
  conferenceStartDate: string | null;
  committee: ParticipantCommittee | null;
  myAllocation: ParticipantAllocation | null;
  /** PositionPaperCard's own report (null while it reads). */
  paper: PaperSummary | null;
  /** Shows the Documents section, where the full paper and guide cards are. */
  onOpenDocuments: () => void;
  /** The phone page offers Join session in Your Assignment already. */
  joinFromXlOnly: boolean;
}) {
  const now = useNow();
  const ccId = myAllocation?.conference_committee_id ?? null;
  const seatCrest = useSeatCrest(myAllocation);
  const { row: partner } = useCoDelegate(conferenceId, myAllocation);
  const guides = useCommitteeGuides(ccId ? [ccId] : []);
  const openGuide = useOpenStudyGuide();
  const roster = useCommitteeRoster(ccId);

  if (!committee || !myAllocation) {
    return (
      <div style={{ ...cardStyle, padding: 24 }} className="flex items-center gap-3">
        <Landmark size={22} strokeWidth={STROKE} style={{ color: INK, flexShrink: 0 }} aria-hidden />
        <p style={{ fontFamily: FONT, fontSize: 15, color: INK_SOFT, margin: 0 }}>
          Your committee and country appear here once the organisers assign them.
        </p>
      </div>
    );
  }

  const short = (committee.abbreviation ?? '').trim() || committeeDisplayName(committee.name, committee.abbreviation);
  const showFull = committee.name.trim() !== short.trim();
  const topics = (committee.topics ?? []).filter(t => t && t.trim());
  const sessionCode = myAllocation.conference_committees?.session_code ?? null;
  const releaseMs = effectiveReleaseTime(myAllocation.conference_committees?.released_to_delegates_at ?? null, conferenceStartDate);
  const roomOpen = releaseMs !== null && releaseMs <= now;
  const deadline = myAllocation.conference_committees?.position_paper_deadline ?? null;

  const guideEntry = guides?.get(myAllocation.conference_committee_id);
  const guide = guideState(guideEntry, now);

  // ── The position paper, in one line ──
  let paperLine: { text: string; color: string } | null = null;
  let paperAction = 'Open';
  if (paper) {
    if (paper.submitted) { paperLine = { text: 'Submitted', color: OK_GREEN }; paperAction = 'View'; }
    else if (!paper.enabled) paperLine = { text: deadline ? `Opens later, due ${shortDay(deadline)}` : 'Not open yet', color: INK_SOFT };
    else if (deadline) {
      const late = new Date(deadline).getTime() < now;
      paperLine = { text: late ? `Was due ${shortDay(deadline)}` : `Due ${shortDay(deadline)}`, color: OWE };
      paperAction = 'Upload';
    } else { paperLine = { text: 'Not submitted yet', color: OWE }; paperAction = 'Upload'; }
  }

  const committeeCard = (
    <div style={cardStyle} className="flex flex-col gap-4 p-5 @[640px]:p-6">
      <div className="flex items-center gap-3.5">
        <CommitteeDisc src={committeeEmblemSrc(committee.logo_url, committee.name, committee.abbreviation)} size={60} />
        <div className="min-w-0 flex flex-col gap-0.5">
          <span className="[overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 24, fontWeight: 600, color: INK, lineHeight: 1.15 }}>{short}</span>
          {showFull && (
            <span className="[overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 13, color: INK_SOFT, lineHeight: 1.35 }}>{committee.name}</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3" style={{ padding: '12px 14px', borderRadius: 14, background: SOFT_PANEL }}>
        <CircleFlag code={myAllocation.country_code} country={myAllocation.country_name} logoUrl={seatCrest} size={40} decorative />
        <div className="min-w-0 flex flex-col gap-px">
          <SmallLabel>You represent</SmallLabel>
          <span className="[overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 17, fontWeight: 600, color: INK, lineHeight: 1.25 }}>
            {myAllocation.country_name}
          </span>
        </div>
      </div>

      {topics.length > 0 && (
        <div className="flex flex-col gap-2">
          <SmallLabel>{topics.length === 1 ? 'Topic' : 'Topics'}</SmallLabel>
          {topics.map((t, i) => (
            <div key={`${i}-${t}`} className="flex gap-2.5" style={{ fontFamily: FONT, fontSize: 14, lineHeight: 1.45, color: INK }}>
              <span style={{ fontWeight: 700, color: FOREST, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{i + 1}</span>
              <span className="min-w-0 [overflow-wrap:anywhere]">{t}</span>
            </div>
          ))}
        </div>
      )}

      {/* Double delegations only: the partner and what the two share. */}
      {partner && (
        <div className="flex flex-col gap-2.5 pt-4" style={{ borderTop: ROW_LINE }}>
          <SmallLabel>Your co-delegate</SmallLabel>
          {partner.partner_name || partner.partner_email ? (
            <div className="flex items-center gap-3">
              <RoundAvatar name={partner.partner_name ?? partner.partner_email ?? '?'} url={partner.partner_avatar_url} size={44} />
              <div className="min-w-0 flex-1 flex flex-col gap-0.5">
                <span className="[overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 15, fontWeight: 600, color: INK }}>
                  {partner.partner_name
                    ? <ProfileLink userId={partner.partner_user_id} name={partner.partner_name}>{partner.partner_name}</ProfileLink>
                    : partner.partner_email}
                </span>
                {partner.partner_email && (
                  <span className="flex items-center gap-1.5 min-w-0">
                    <span className="min-w-0 [overflow-wrap:anywhere] select-all" style={{ fontFamily: FONT, fontSize: 13, color: INK_SOFT }}>{partner.partner_email}</span>
                    <button
                      type="button"
                      onClick={() => void copyText(partner.partner_email ?? '', 'Email copied')}
                      aria-label="Copy email address"
                      title="Copy email address"
                      className={`${BTN_CLASS} inline-flex items-center justify-center flex-shrink-0 rounded-full`}
                      style={{ width: 32, height: 32, border: 'none', background: 'none', cursor: 'pointer', color: INK }}
                    >
                      <Copy size={15} strokeWidth={STROKE} aria-hidden />
                    </button>
                  </span>
                )}
              </div>
            </div>
          ) : (
            <p style={{ fontFamily: FONT, fontSize: 14, color: INK_SOFT, margin: 0 }}>Not assigned yet. We will email you when they are.</p>
          )}
          <p style={{ fontFamily: FONT, fontSize: 13, color: INK_SOFT, margin: 0, lineHeight: 1.45 }}>
            You share one seat, one position paper and one placard in the live session.
          </p>
        </div>
      )}

      {/* The live room, once the organisers made one. */}
      {sessionCode && releaseMs !== null && (
        <div className="flex flex-col gap-3 pt-4" style={{ borderTop: ROW_LINE }}>
          <div className="flex items-center gap-2.5 flex-wrap">
            <Radio size={18} strokeWidth={STROKE} style={{ color: INK, flexShrink: 0 }} aria-hidden />
            {roomOpen ? (
              <>
                <span style={{ fontFamily: FONT, fontSize: 14, color: INK }}>Room code</span>
                <button
                  type="button"
                  onClick={() => void copyText(sessionCode, 'Room code copied')}
                  className={`${BTN_CLASS} inline-flex items-center gap-1.5 rounded-lg`}
                  style={{ border: 'none', background: SOFT_PANEL, padding: '6px 10px', cursor: 'pointer', fontFamily: FONT, fontSize: 14, fontWeight: 700, letterSpacing: '0.08em', color: INK }}
                  aria-label={`Copy room code ${sessionCode}`}
                >
                  {sessionCode}
                  <Copy size={14} strokeWidth={STROKE} aria-hidden />
                </button>
              </>
            ) : (
              <span style={{ fontFamily: FONT, fontSize: 14, color: INK_SOFT }}>Your committee room opens {formatReleaseDate(releaseMs)}</span>
            )}
          </div>
          {roomOpen && (
            <Link href={`/join?code=${sessionCode}`} className={`${BTN_CLASS} ${joinFromXlOnly ? 'hidden lg:inline-flex' : 'inline-flex'}`} style={{ ...primaryBtn, alignSelf: 'flex-start' }}>
              Join session
            </Link>
          )}
        </div>
      )}
    </div>
  );

  const docCard = (icon: React.ReactNode, title: string, line: React.ReactNode, action: React.ReactNode) => (
    <div style={{ ...cardStyle, padding: 16 }} className="flex flex-col gap-2.5 min-w-0">
      {icon}
      <span style={{ fontFamily: FONT, fontSize: 15, fontWeight: 600, color: INK }}>{title}</span>
      <span style={{ fontFamily: FONT, fontSize: 12.5, minHeight: 18 }}>{line}</span>
      <div className="mt-auto">{action}</div>
    </div>
  );

  const guideFiles = guideEntry?.guides ?? [];
  const studyGuideCard = docCard(
    <BookOpen size={24} strokeWidth={STROKE} style={{ color: INK }} aria-hidden />,
    'Study Guide',
    guides === null ? <SkeletonBlock width="70%" height={12} /> : <span style={{ color: INK_SOFT }}>{guide.line}</span>,
    guide.kind === 'open' ? (
      <div className="flex flex-col gap-1.5">
        {guideFiles.map(g => (
          <button key={g.id} type="button" onClick={() => openGuide(g.file_url)} className={`${BTN_CLASS} [overflow-wrap:anywhere]`} style={linkStyle}>
            {guideFiles.length === 1 ? 'Open' : g.title}
          </button>
        ))}
      </div>
    ) : null,
  );
  const paperCard = docCard(
    <FileText size={24} strokeWidth={STROKE} style={{ color: INK }} aria-hidden />,
    'Position Paper',
    paper === null ? <SkeletonBlock width="60%" height={12} /> : paperLine ? <span style={{ color: paperLine.color }}>{paperLine.text}</span> : null,
    <button type="button" onClick={onOpenDocuments} className={BTN_CLASS} style={linkStyle}>{paperAction}</button>,
  );

  return (
    <div className="@container flex flex-col gap-4 @[640px]:gap-6">
      <div className="grid gap-4 @[640px]:gap-6 @[900px]:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] items-start">
        {committeeCard}
        <div className="grid grid-cols-2 gap-3 @[640px]:gap-6 @[900px]:grid-cols-1">
          {studyGuideCard}
          {paperCard}
        </div>
      </div>
      {DELEGATIONS_V2_DB && <CommitteeListCard state={roster} />}
    </div>
  );
}

// ── The committee list (my_committee_roster, DELEGATIONS_V2_DB only) ───────

function CommitteeListCard({ state }: { state: ReturnType<typeof useCommitteeRoster> }) {
  const [query, setQuery] = useState('');
  const rows = useMemo(() => {
    if (!state || state.kind !== 'ok') return [];
    return [...state.rows].sort((a, b) => a.country_name.localeCompare(b.country_name) || (a.seat ?? '').localeCompare(b.seat ?? ''));
  }, [state]);
  const delegations = useMemo(() => new Set(rows.map(r => r.country_code || r.country_name)).size, [rows]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r => [r.country_name, r.display_name, r.society_name].some(v => (v ?? '').toLowerCase().includes(q)));
  }, [rows, query]);

  return (
    <div style={{ ...cardStyle, padding: '18px 0 8px' }}>
      <div className="flex items-center justify-between gap-3 flex-wrap" style={{ padding: '0 18px 12px' }}>
        {state?.kind === 'ok' ? <StatNumber n={delegations} word={delegations === 1 ? 'delegation' : 'delegations'} /> : <CardTitle>Your Committee</CardTitle>}
        <label className="flex items-center gap-2 rounded-xl" style={{ height: 40, padding: '0 12px', background: SOFT_PANEL, minWidth: 0, flex: '0 1 260px' }}>
          <Search size={16} strokeWidth={STROKE} style={{ color: INK_SOFT, flexShrink: 0 }} aria-hidden />
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search"
            aria-label="Search the committee"
            className="focus:outline-none min-w-0 w-full"
            style={{ border: 'none', background: 'transparent', fontFamily: FONT, fontSize: 14, color: INK }}
          />
        </label>
      </div>

      {state === null ? (
        <div className="flex flex-col gap-3" style={{ padding: '6px 18px 14px' }}>
          {[0, 1, 2, 3].map(i => <SkeletonBlock key={i} height={36} radius={10} />)}
        </div>
      ) : state.kind === 'error' ? (
        <p role="alert" style={{ fontFamily: FONT, fontSize: 14, color: INK_SOFT, margin: 0, padding: '6px 18px 14px' }}>
          The committee list could not be read. Refresh the page to try again.
        </p>
      ) : shown.length === 0 ? (
        <p style={{ fontFamily: FONT, fontSize: 14, color: INK_SOFT, margin: 0, padding: '6px 18px 14px' }}>
          {rows.length === 0 ? 'No delegations in this committee yet.' : 'No delegation matches that search.'}
        </p>
      ) : (
        <div className="@container">
          <div className="grid @[760px]:grid-cols-2">
            {shown.map((r, i) => (
              <div
                key={`${r.country_code ?? r.country_name}-${r.seat ?? ''}-${i}`}
                className="flex items-center gap-3"
                style={{ padding: '10px 18px', borderTop: ROW_LINE, background: r.is_mine ? MINE_TINT : 'transparent' }}
              >
                <CircleFlag code={r.country_code} country={r.country_name} size={28} decorative />
                <div className="flex-1 min-w-0 flex flex-col gap-px">
                  <span className="[overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 15, fontWeight: 600, color: INK }}>{r.country_name}</span>
                  <span className="[overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 13, color: r.display_name ? '#3E352E' : INK_SOFT }}>
                    {r.display_name ?? 'Not filled yet'}
                  </span>
                </div>
                {r.society_name && (
                  <span className="text-right [overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 12, color: INK_SOFT, maxWidth: '40%' }}>{r.society_name}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
