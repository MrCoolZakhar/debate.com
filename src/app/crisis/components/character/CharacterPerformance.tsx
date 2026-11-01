'use client';
// Gavelling Crisis: the Performance tab of the character pop-up.
//
// ONE total (owner, 30 Oct 2026): the points from the committee room (the regular session scoring of the character's seat:
// speeches, speaking time, motions, documents, summed exactly as a session sums them) plus the points from outside the
// room (directives sent and how they were answered, cabinet and joint directives, meetings held; the values are the Crisis
// Director's, in Settings > Points). One big number, one split bar, ONE breakdown that lists both parts, and the sentence
// that says how points are given. The maths is src/lib/crisis/performance.ts; Statistics on Command ranks on the same total.
// Points follow the PERSON (owner, 1 Nov 2026): when a delegate plays this character, the big number is that person's total over
// every character they played (no cap); a line says what this character earned alone. A character nobody plays shows its own points.
// Below it the SAME record a chair or organiser sees for a delegation in a regular session (the session scoreboard's
// DelegateProfile: ratings and the timeline of speeches and events). Chair notes and ratings are private to staff and chairs.
//
// The seat is the committee-room seat NAMED like the character, looked for in the character's cabinet room first
// and then in the crisis's other rooms (a character can sit in another cabinet's room). Read only; the room is
// re-read every 30 seconds while the tab is visible. Nothing here writes.

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ListChecks, Presentation } from 'lucide-react';
import Portal from '@/components/Portal';
import { SeatArtProvider } from '@/components/SeatFlag';
import DelegateProfile from '@/components/scoreboard/DelegateProfile';
import { getCommitteeByCode, getFeedbackForCommittee, type FeedbackEntry } from '@/lib/committeeService';
import { buildSessionScoreboardRows, sessionPointSlices } from '@/lib/sessionScoreboard';
import { formatSpeakingTime } from '@/lib/conferenceScoreboard';
import { motionNames } from '@/lib/committeeFlags';
import { readStatusHistory } from '@/lib/attendanceHistory';
import { everPresentFromHistory } from '@/lib/scoring';
import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { rankByHeadline, speechesByCountryOf } from '@/app/manage/[slug]/live/SessionBoard';
import type { CrisisRef } from '@/lib/crisis/api';
import { isChairSendBack, isRealDenial } from '@/lib/crisis/format';
import { getCrisisClient } from '@/lib/crisis/client';
import { blendPerformance, findSeat, fmtPts, loadRoomBoards, pointsRules, roomSlices, seatOf, type Blend } from '@/lib/crisis/performance';
import { readPoints, type PointsResult, type PointsRow } from '@/lib/crisis/points';
import type { PointSlice } from '@/lib/sessionScoreboard';
import type { Cabinet, Character, Directive, Meeting } from '@/lib/crisis/types';
import type { Committee } from '@/lib/types';
import { BigCount, CK, Skeleton } from '../../crisisKit';
import { useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import { OUT_COLOR, ROOM_COLOR, SplitBar, SplitLegend } from '../command/blendKit';
import { mergeSlices } from '../command/commandBlend';

type Room =
  | { kind: 'loading' }
  | { kind: 'none' }
  | { kind: 'failed' }
  | { kind: 'nobody'; code: string }
  | { kind: 'ok'; committee: Committee; feedback: FeedbackEntry[]; seat: string; everPresent: Set<string> | null };

const REFRESH_MS = 30_000;

/** Finds the character's seat and reads its room. A failed re-read keeps what is on screen. */
function useCharacterRoom(ref: CrisisRef, char: Character, cabinets: Cabinet[], withNotes: boolean): Room {
  const [state, setState] = useState<Room>({ kind: 'loading' });
  // The character's own cabinet first, then the others; a stable key so the effect does not restart on every render.
  const order = useMemo(() => {
    const own = cabinets.filter((c) => c.id === char.cabinet_id);
    const rest = cabinets.filter((c) => c.id !== char.cabinet_id);
    return [...own, ...rest].map((c) => c.conference_committee_id).filter((x): x is string => !!x);
  }, [cabinets, char.cabinet_id]);
  const orderKey = order.join(',');
  const name = char.name;

  useEffect(() => {
    let alive = true;
    let inFlight = false;
    const load = async () => {
      if (inFlight || document.visibilityState !== 'visible') return;
      inFlight = true;
      try {
        if (!order.length) { if (alive) setState({ kind: 'none' }); return; }
        const client = await getCrisisClient(ref.conf, ref.crisis);
        const r = await client.from('conference_committees').select('id, session_code').in('id', order);
        if (r.error) throw new Error('rooms');
        const codeOf = new Map(((r.data ?? []) as Array<{ id: string; session_code: string | null }>).map((x) => [x.id, x.session_code]));
        const codes = order.map((id) => codeOf.get(id)).filter((x): x is string => !!x);
        if (!codes.length) { if (alive) setState({ kind: 'none' }); return; }
        let anyRead = false;
        for (const code of codes) {
          const committee = await getCommitteeByCode(code);
          if (!committee) continue;
          anyRead = true;
          const seat = findSeat(committee, name);
          if (!seat) continue;
          const [feedback, history] = await Promise.all([
            // Chair notes and ratings are read only for staff and chairs; everyone else never even asks for them.
            withNotes ? getFeedbackForCommittee(committee.id, { code: committee.code, chairSuffix: committee.dbChairJoinSuffix ?? undefined }).catch(() => []) : Promise.resolve([] as FeedbackEntry[]),
            getFreshAuthedClient().then((c) => readStatusHistory(c, committee.id)).catch(() => null),
          ]);
          if (alive) setState({ kind: 'ok', committee, feedback, seat, everPresent: everPresentFromHistory(history) });
          return;
        }
        if (!anyRead) throw new Error('read');
        if (alive) setState({ kind: 'nobody', code: codes[0] });
      } catch {
        if (alive) setState((p) => (p.kind === 'ok' ? p : { kind: 'failed' }));
      } finally { inFlight = false; }
    };
    const first = window.setTimeout(() => { void load(); }, 0);
    const poll = window.setInterval(() => { void load(); }, REFRESH_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') void load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { alive = false; window.clearTimeout(first); window.clearInterval(poll); document.removeEventListener('visibilitychange', onVisible); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, orderKey, name, withNotes]);

  return state;
}

/**
 * The committee-room points of the OTHER characters a person played. Reads every cabinet's room only when there is such a
 * character (most people played one), and keeps it fresh like the main room. Each seat once, keyed by room and seat.
 */
function useOtherSeats(ref: CrisisRef, others: Character[], cabinets: Cabinet[]): Array<{ key: string; slices: PointSlice[] }> | null {
  const [state, setState] = useState<Array<{ key: string; slices: PointSlice[] }> | null>(null);
  const othersRef = useRef(others);
  const cabinetsRef = useRef(cabinets);
  useEffect(() => { othersRef.current = others; cabinetsRef.current = cabinets; });
  const key = others.map((c) => `${c.id}:${c.name}:${c.cabinet_id ?? ''}`).join('|');
  useEffect(() => {
    if (!key) return;
    let alive = true;
    let inFlight = false;
    const load = async () => {
      if (inFlight || document.visibilityState !== 'visible') return;
      inFlight = true;
      try {
        const boards = await loadRoomBoards(ref, cabinetsRef.current);
        const out: Array<{ key: string; slices: PointSlice[] }> = [];
        for (const c of othersRef.current) {
          const seat = seatOf(boards, c);
          if (seat) out.push({ key: `${seat.board.committee.id}:${seat.row.country}`, slices: roomSlices(seat.board, seat.row) });
        }
        if (alive) setState(out);
      } catch { /* a failed re-read keeps what is on screen */ }
      finally { inFlight = false; }
    };
    const first = window.setTimeout(() => { void load(); }, 0);
    const poll = window.setInterval(() => { void load(); }, REFRESH_MS);
    return () => { alive = false; window.clearTimeout(first); window.clearInterval(poll); };
  }, [ref, key]);
  return key ? state : null;
}

function span(ms: number): string {
  const mins = Math.round(ms / 60000);
  if (mins < 1) return 'under a minute';
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h} h ${mins % 60} min`;
  const days = Math.floor(h / 24);
  return `${days} ${days === 1 ? 'day' : 'days'} ${h % 24} h`;
}

// ─────────── Hover breakdown ───────────

function Hover({ children, rows, label }: { children: ReactNode; rows: Array<{ label: string; value: string | number; color?: string }>; label: string }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const show = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    const x = Math.min(Math.max(r.left + r.width / 2, 130), window.innerWidth - 130);
    setPos({ x, y: r.bottom + 8 });
  };
  return (
    <>
      <span
        tabIndex={0}
        aria-label={`${label}: ${rows.map((r) => `${r.label} ${r.value}`).join(', ')}`}
        onMouseEnter={(e) => show(e.currentTarget)}
        onMouseLeave={() => setPos(null)}
        onFocus={(e) => show(e.currentTarget)}
        onBlur={() => setPos(null)}
        className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
        style={{ cursor: 'help', borderRadius: 20, display: 'block', height: '100%' }}
      >
        {children}
      </span>
      {pos && (
        <Portal>
          <div
            role="tooltip"
            style={{
              position: 'fixed', left: pos.x, top: pos.y, transform: 'translateX(-50%)', zIndex: 10060, width: 240, maxWidth: 'calc(100vw - 24px)',
              padding: '10px 12px', borderRadius: 14, background: CK.ink, color: '#FFF4E6', fontFamily: CK.font, boxShadow: '0 10px 28px rgba(28,20,16,0.3)', pointerEvents: 'none',
            }}
          >
            <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 800, color: CK.gold }}>{label}</p>
            {rows.map((r) => (
              <p key={r.label} className="flex items-baseline justify-between" style={{ margin: '2px 0', gap: 12, fontSize: 13 }}>
                <span style={{ overflowWrap: 'anywhere' }}>{r.label}</span>
                <b style={{ fontVariantNumeric: 'tabular-nums', color: r.color ?? '#FFF4E6' }}>{r.value}</b>
              </p>
            ))}
          </div>
        </Portal>
      )}
    </>
  );
}

/** The one total: a big number, the split bar and what each part is. */
function TotalCard({ blend, roomKnown, note }: { blend: Blend; roomKnown: boolean; note?: string }) {
  return (
    <div style={{ background: CK.card, borderRadius: 20, boxShadow: CK.shadowSm, padding: '16px 18px', boxSizing: 'border-box' }}>
      <p className="flex items-baseline flex-wrap" style={{ margin: 0, gap: '2px 10px' }}>
        <b style={{ fontSize: 44, fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums', color: CK.red }}>{fmtPts(blend.total)}</b>
        <span style={{ fontSize: 15, fontWeight: 700, color: CK.ink }}>{blend.total === 1 ? 'point in total' : 'points in total'}</span>
      </p>
      <div style={{ margin: '12px 0 10px' }}><SplitBar room={blend.room} out={blend.out} height={12} /></div>
      <SplitLegend room={roomKnown ? blend.room : null} out={blend.out} />
      {note && <p style={{ margin: '8px 0 0', fontSize: 12.5, color: CK.inkSoft }}>{note}</p>}
    </div>
  );
}

function GroupHead({ label, color, pts, first }: { label: string; color: string; pts: number | null; first?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3" style={{ padding: '10px 0 6px', borderTop: first ? 0 : `1px solid ${CK.hair}` }}>
      <span className="inline-flex items-center" style={{ gap: 7, fontSize: 13, fontWeight: 800, color }}>
        <span aria-hidden style={{ width: 9, height: 9, borderRadius: '50%', background: color, flex: 'none' }} />{label}
      </span>
      {pts !== null && <b style={{ fontSize: 15, fontVariantNumeric: 'tabular-nums', color: CK.ink }}>{fmtPts(pts)}</b>}
    </div>
  );
}

/** ONE breakdown of the one total: the room's lines, then the directive and meeting lines, then the total. */
function Breakdown({ blend, roomNote }: { blend: Blend; roomNote: string | null }) {
  const lineStyle = { padding: '7px 0 7px 16px', fontSize: 14 } as const;
  return (
    <div style={{ background: CK.card, borderRadius: 18, boxShadow: CK.shadowSm, padding: '4px 16px 8px' }}>
      <GroupHead first label="In the committee room" color={ROOM_COLOR} pts={roomNote ? null : blend.room} />
      {roomNote ? (
        <p style={{ margin: 0, padding: '0 0 8px 16px', fontSize: 13.5, color: CK.inkSoft }}>{roomNote}</p>
      ) : blend.roomLines.length === 0 ? (
        <p style={{ margin: 0, padding: '0 0 8px 16px', fontSize: 13.5, color: CK.inkSoft }}>No points in the room yet.</p>
      ) : blend.roomLines.map((l) => (
        <div key={l.id} className="flex items-center justify-between gap-3" style={lineStyle}>
          <span style={{ fontWeight: 600, overflowWrap: 'anywhere', minWidth: 0 }}>{l.label}</span>
          <b style={{ fontVariantNumeric: 'tabular-nums', color: l.pts < 0 ? CK.danger : CK.ink }}>{fmtPts(l.pts)}</b>
        </div>
      ))}
      <GroupHead label="Out of the room" color={OUT_COLOR} pts={blend.out} />
      {blend.outLines.length === 0 ? (
        <p style={{ margin: 0, padding: '0 0 8px 16px', fontSize: 13.5, color: CK.inkSoft }}>No directives or meetings yet.</p>
      ) : blend.outLines.map((l) => (
        <div key={l.id} className="flex items-center justify-between gap-3" style={lineStyle}>
          <span style={{ fontWeight: 600, overflowWrap: 'anywhere', minWidth: 0 }}>{l.label}</span>
          <span style={{ fontSize: 13, color: CK.inkSoft, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
            {l.count} × {l.each} = <b style={{ fontSize: 14, color: l.pts < 0 ? CK.danger : CK.ink }}>{fmtPts(l.pts)}</b>
          </span>
        </div>
      ))}
      <div className="flex items-center justify-between gap-3" style={{ padding: '10px 0 4px', borderTop: `1px solid ${CK.hair}` }}>
        <b style={{ fontSize: 14, color: CK.ink }}>Total</b>
        <b style={{ fontSize: 20, fontVariantNumeric: 'tabular-nums', color: CK.red }}>{fmtPts(blend.total)}</b>
      </div>
    </div>
  );
}

// ─────────── The committee-room record, the same as a regular session ───────────

function RoomStats({ committee, feedback, seat, everPresent, showPrivate }: { committee: Committee; feedback: FeedbackEntry[]; seat: string; everPresent: Set<string> | null; showPrivate: boolean }) {
  // Chair notes and ratings are private to staff and chairs (CLAUDE.md): everyone else gets none of them.
  const fb = useMemo(() => (showPrivate ? feedback : []), [feedback, showPrivate]);
  const rows = useMemo(() => buildSessionScoreboardRows(committee, fb, 'en', { everPresent }), [committee, fb, everPresent]);
  const row = rows.find((r) => r.country === seat) ?? null;
  const rank = useMemo(() => (row ? rankByHeadline(rows).get(row.key) ?? 0 : 0), [rows, row]);
  const speeches = useMemo(() => speechesByCountryOf(committee, fb).get(seat) ?? [], [committee, fb, seat]);
  if (!row) return null;
  return (
    <SeatArtProvider delegates={committee.delegates}>
      <div style={{ borderRadius: 18, overflow: 'hidden', background: CK.card, boxShadow: CK.shadowSm }}>
        <DelegateProfile
          row={row}
          rank={rank}
          rankTotal={rows.length}
          hideRank={!showPrivate}
          slices={sessionPointSlices(committee, row.ledger, 'en', 'Manual points')}
          speeches={speeches}
          consultationName={motionNames(committee, 'en').consultation}
        />
      </div>
    </SeatArtProvider>
  );
}

// ─────────── The tab ───────────

/** The delegate who plays this character, with everything they wrote (as any character): their points are the headline. */
export interface PerformancePerson {
  memberId: string;
  name: string;
  /** The other characters this person played (this one is not in the list). */
  others: Character[];
  /** What this character earned on its own, for the one line that says so. */
  ownPoints: number;
  /** Every directive this person wrote, as any character (complete, not capped). */
  rows: PointsRow[];
}

export default function CharacterPerformance({ crisisRef, char, cabinet, cabinets, points, person, directives, meetings, loading, staff, canSeeNotes }: {
  crisisRef: CrisisRef;
  char: Character;
  cabinet: Cabinet | null;
  /** Every cabinet of the crisis, to look for the seat in the other rooms too. */
  cabinets?: Cabinet[];
  /** The headline points: the person's total when somebody plays this character, else this character's own. */
  points: PointsResult;
  /** Set when a delegate plays this character (points then follow them across every character they played). */
  person?: PerformancePerson | null;
  /** What this character wrote or co-wrote. */
  directives: Directive[] | null;
  meetings: Meeting[];
  loading: boolean;
  /** Reply times are staff business. */
  staff: boolean;
  /** Staff and chairs also see the chair notes and ratings in the room stats. */
  canSeeNotes?: boolean;
}) {
  const { core } = useCrisis();
  const room = useCharacterRoom(crisisRef, char, cabinets ?? (cabinet ? [cabinet] : []), !!canSeeNotes);

  const back = useMemo(() => {
    if (person) {
      // The person's own record, complete: every directive they wrote as any character.
      const wrote = person.rows.filter((d) => d.status !== 'withdrawn' && !isChairSendBack(d));
      const answered = wrote.filter((d) => d.answered_at);
      const replyMs = answered.length ? answered.reduce((a, d) => a + (new Date(d.answered_at as string).getTime() - new Date(d.created_at).getTime()), 0) / answered.length : null;
      const own = (directives ?? []).filter((d) => d.author_character_id === char.id && !isChairSendBack(d));
      return {
        total: wrote.length, wrote: own.length, co: 0,
        approved: wrote.filter((d) => d.outcome === 'approved').length,
        partial: wrote.filter((d) => d.outcome === 'partial').length,
        denied: wrote.filter(isRealDenial).length,
        words: own.length ? Math.round(own.reduce((a, d) => a + d.word_count, 0) / own.length) : 0,
        replyMs,
      };
    }
    // A directive the chair sent back is not a verdict and not a sent directive (same rule as the points).
    const all = (directives ?? []).filter((d) => !isChairSendBack(d));
    const split = (list: Directive[]) => ({
      approved: list.filter((d) => d.outcome === 'approved').length,
      partial: list.filter((d) => d.outcome === 'partial').length,
      denied: list.filter(isRealDenial).length,
    });
    const wrote = all.filter((d) => d.author_character_id === char.id);
    const co = all.filter((d) => d.author_character_id !== char.id);
    const answered = wrote.filter((d) => d.answered_at);
    const replyMs = answered.length ? answered.reduce((a, d) => a + (new Date(d.answered_at as string).getTime() - new Date(d.created_at).getTime()), 0) / answered.length : null;
    return {
      total: all.length, wrote: wrote.length, co: co.length, ...split(all),
      words: wrote.length ? Math.round(wrote.reduce((a, d) => a + d.word_count, 0) / wrote.length) : 0,
      replyMs,
    };
  }, [directives, char.id, person]);

  const held = points.lines.find((l) => l.label === 'Meetings held')?.count ?? meetings.filter((m) => m.status === 'held' && m.character_ids.includes(char.id)).length;
  // The seat's row and its point slices, from the same functions a regular session uses (roll-call history included).
  const live = useMemo(() => {
    if (room.kind !== 'ok') return null;
    const row = buildSessionScoreboardRows(room.committee, [], 'en', { everPresent: room.everPresent }).find((r) => r.country === room.seat) ?? null;
    return row ? { row, slices: sessionPointSlices(room.committee, row.ledger, 'en', 'Manual points') } : null;
  }, [room]);
  // The other characters this person played: their seats' room points join this character's.
  const otherSeats = useOtherSeats(crisisRef, person?.others ?? [], cabinets ?? (cabinet ? [cabinet] : []));
  const blend = useMemo(() => {
    const thisKey = room.kind === 'ok' ? `${room.committee.id}:${room.seat}` : null;
    const extra = (otherSeats ?? []).filter((x) => x.key !== thisKey).flatMap((x) => x.slices);
    const slices = live ? (extra.length ? mergeSlices([...live.slices, ...extra]) : live.slices) : (extra.length ? mergeSlices(extra) : null);
    return blendPerformance(slices, points);
  }, [live, points, otherSeats, room]);
  const rules = useMemo(() => pointsRules(readPoints(core.crisis.settings)), [core.crisis.settings]);

  if (loading) return <div className="flex flex-col" style={{ gap: 8 }}><Skeleton h={90} /><Skeleton h={30} /><Skeleton h={30} /></div>;

  const speeches = live ? live.row.gslSpeeches + live.row.caucusSpeeches : 0;
  const speakingSeconds = live?.row.speakingSeconds ?? 0;
  const roomNote = room.kind === 'loading' ? 'Reading the committee room'
    : room.kind === 'nobody' ? `No seat named ${char.name} in the committee room yet`
    : room.kind === 'failed' ? 'Could not read the committee room. Trying again'
    : room.kind === 'none' ? 'This cabinet has no committee room yet'
    : null;

  const spread = !!person && person.others.length > 0;
  // This character may have no seat while another one the person played does: the room lines then still show.
  const roomPartKnown = !roomNote || (spread && blend.roomLines.length > 0);
  return (
    <div className="flex flex-col" style={{ gap: 16 }}>
      <Hover
        label="Points in total"
        rows={[
          { label: 'In the committee room', value: roomPartKnown ? fmtPts(blend.room) : 'None', color: '#9ED3B0' },
          { label: 'Out of the room', value: fmtPts(blend.out), color: '#F0A596' },
          { label: 'Total', value: fmtPts(blend.total), color: CK.gold },
        ]}
      >
        <TotalCard blend={blend} roomKnown={roomPartKnown} note={roomNote ?? `${speeches} ${speeches === 1 ? 'speech' : 'speeches'}, ${formatSpeakingTime(speakingSeconds)} speaking time`} />
      </Hover>
      {person && (
        <p style={{ margin: '-6px 0 0', fontSize: 13.5, lineHeight: 1.5, color: CK.inkSoft, overflowWrap: 'anywhere' }}>
          {spread
            ? <>Points follow <b style={{ color: CK.ink }}>{person.name}</b> across {person.others.length + 1} characters: {char.name}, {person.others.map((o) => o.name).join(', ')}. {char.name} on their own earned {fmtPts(person.ownPoints)} from directives and meetings.</>
            : <>Points follow <b style={{ color: CK.ink }}>{person.name}</b>, whichever character they play. If they play someone else later, these points go with them.</>}
        </p>
      )}

      <section>
        <h3 className="flex items-center" style={{ margin: '0 0 8px', gap: 7, fontSize: 13, fontWeight: 800, color: CK.red }}>
          <ListChecks size={16} strokeWidth={1.5} aria-hidden />Where the Points Come From
        </h3>
        <Breakdown blend={blend} roomNote={roomPartKnown ? null : roomNote} />
        <p style={{ margin: '8px 0 0', fontSize: 12.5, lineHeight: 1.5, color: CK.inkSoft }}>{rules} The Crisis Director sets the out of the room values in Settings. Points help judge awards.</p>
      </section>

      <div className="flex items-end flex-wrap" style={{ gap: '10px 28px' }}>
        <BigCount n={back.total} word={back.total === 1 ? 'directive sent' : 'directives sent'} />
        <BigCount n={held} word={held === 1 ? 'meeting held' : 'meetings held'} />
        <BigCount n={back.approved} word="approved" color={CK.ok} />
        <BigCount n={back.partial} word="partly worked" color={CK.goldDeep} />
        <BigCount n={back.denied} word="denied" color={CK.danger} />
        {back.wrote > 0 && <BigCount n={back.words} word="words on average" />}
        {staff && back.replyMs !== null && <BigCount n={span(back.replyMs)} word="average reply time" />}
      </div>

      {room.kind === 'ok' && (
        <section>
          <h3 className="flex items-center" style={{ margin: '0 0 8px', gap: 7, fontSize: 13, fontWeight: 800, color: CK.red }}>
            <Presentation size={16} strokeWidth={1.5} aria-hidden />Committee Room Record
          </h3>
          <RoomStats committee={room.committee} feedback={room.feedback} seat={room.seat} everPresent={room.everPresent} showPrivate={!!canSeeNotes} />
        </section>
      )}
    </div>
  );
}
