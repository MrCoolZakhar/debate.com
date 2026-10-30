'use client';
// Gavelling Crisis: the Performance tab of the character pop-up.
//
// Two headline numbers (owner, 30 Oct 2026), each with a hover breakdown:
//   SPEAKING TIME     from the character's seat in the front-room session, summed exactly as a regular session
//                     sums it (the session scoreboard row: GSL and caucus speeches, one ledger).
//   DIRECTIVES SENT   every directive the character took part in, written or co-signed, with how each was answered.
// Below them the SAME stats a chair or organiser sees for a delegation in a regular session: the session
// scoreboard's DelegateProfile (points by source, ratings, the timeline of speeches and events), built by the
// same functions from the character's seat. Chair notes and ratings are private to staff and chairs; everyone
// else sees the numbers only. Then the crisis points and meetings.
//
// The seat is the committee-room seat NAMED like the character, looked for in the character's cabinet room first
// and then in the crisis's other rooms (a character can sit in another cabinet's room). Read only; the room is
// re-read every 30 seconds while the tab is visible. Nothing here writes.

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Presentation, ScrollText } from 'lucide-react';
import Portal from '@/components/Portal';
import { SeatArtProvider } from '@/components/SeatFlag';
import DelegateProfile from '@/components/scoreboard/DelegateProfile';
import { getCommitteeByCode, getFeedbackForCommittee, type FeedbackEntry } from '@/lib/committeeService';
import { buildSessionScoreboardRows, sessionPointSlices } from '@/lib/sessionScoreboard';
import { formatSpeakingTime } from '@/lib/conferenceScoreboard';
import { motionNames } from '@/lib/committeeFlags';
import { readStatusHistory, rosterStatusSig, useEverPresent } from '@/lib/attendanceHistory';
import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { rankByHeadline, speechesByCountryOf } from '@/app/manage/[slug]/live/SessionBoard';
import type { CrisisRef } from '@/lib/crisis/api';
import { getCrisisClient } from '@/lib/crisis/client';
import type { characterPoints } from '@/lib/crisis/points';
import type { Cabinet, Character, Directive, Meeting } from '@/lib/crisis/types';
import type { Committee } from '@/lib/types';
import { BigCount, CK, Skeleton } from '../../crisisKit';

type Room =
  | { kind: 'loading' }
  | { kind: 'none' }
  | { kind: 'failed' }
  | { kind: 'nobody'; code: string }
  | { kind: 'ok'; committee: Committee; feedback: FeedbackEntry[]; seat: string };

const REFRESH_MS = 30_000;

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().toLowerCase();

/** The seat named like the character: an exact match first, then one name inside the other when only one seat fits. */
function findSeat(committee: Committee, name: string): string | null {
  const me = norm(name);
  if (!me) return null;
  const seats = committee.delegates.map((d) => d.country);
  const exact = seats.find((s) => norm(s) === me);
  if (exact) return exact;
  const loose = seats.filter((s) => { const n = norm(s); return n.length >= 4 && (n.includes(me) || me.includes(n)); });
  return loose.length === 1 ? loose[0] : null;
}

/** Finds the character's seat and reads its room. A failed re-read keeps what is on screen. */
function useCharacterRoom(ref: CrisisRef, char: Character, cabinets: Cabinet[]): Room {
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
          const feedback = await getFeedbackForCommittee(committee.id, { code: committee.code, chairSuffix: committee.dbChairJoinSuffix ?? undefined }).catch(() => []);
          if (alive) setState({ kind: 'ok', committee, feedback, seat });
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
  }, [ref, orderKey, name]);

  return state;
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

function Headline({ n, word, note }: { n: ReactNode; word: string; note?: string }) {
  return (
    <div style={{ background: CK.card, borderRadius: 20, boxShadow: CK.shadowSm, padding: '16px 18px', height: '100%', boxSizing: 'border-box' }}>
      <p className="flex items-baseline flex-wrap" style={{ margin: 0, gap: '2px 10px' }}>
        <b style={{ fontSize: 44, fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums', color: CK.red }}>{n}</b>
        <span style={{ fontSize: 15, fontWeight: 700, color: CK.ink }}>{word}</span>
      </p>
      {note && <p style={{ margin: '8px 0 0', fontSize: 12.5, color: CK.inkSoft }}>{note}</p>}
    </div>
  );
}

// ─────────── The committee-room stats, the same as a regular session ───────────

function RoomStats({ committee, feedback, seat, showPrivate }: { committee: Committee; feedback: FeedbackEntry[]; seat: string; showPrivate: boolean }) {
  // Chair notes and ratings are private to staff and chairs (CLAUDE.md): everyone else gets none of them.
  const fb = useMemo(() => (showPrivate ? feedback : []), [feedback, showPrivate]);
  const everPresent = useEverPresent(
    committee.id,
    async () => readStatusHistory(await getFreshAuthedClient(), committee.id),
    rosterStatusSig(committee.delegates),
  );
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
          slices={sessionPointSlices(committee, row.ledger, 'en', 'Manual points')}
          speeches={speeches}
          consultationName={motionNames(committee, 'en').consultation}
        />
      </div>
    </SeatArtProvider>
  );
}

// ─────────── The tab ───────────

export default function CharacterPerformance({ crisisRef, char, cabinet, cabinets, points, directives, meetings, loading, staff, canSeeNotes }: {
  crisisRef: CrisisRef;
  char: Character;
  cabinet: Cabinet | null;
  /** Every cabinet of the crisis, to look for the seat in the other rooms too. */
  cabinets?: Cabinet[];
  points: ReturnType<typeof characterPoints>;
  /** What this character wrote or co-wrote. */
  directives: Directive[] | null;
  meetings: Meeting[];
  loading: boolean;
  /** Reply times are staff business. */
  staff: boolean;
  /** Staff and chairs also see the chair notes and ratings in the room stats. */
  canSeeNotes?: boolean;
}) {
  const room = useCharacterRoom(crisisRef, char, cabinets ?? (cabinet ? [cabinet] : []));

  const back = useMemo(() => {
    const all = directives ?? [];
    const split = (list: Directive[]) => ({
      approved: list.filter((d) => d.outcome === 'approved').length,
      partial: list.filter((d) => d.outcome === 'partial').length,
      denied: list.filter((d) => d.outcome === 'denied').length,
      waiting: list.filter((d) => d.outcome !== 'approved' && d.outcome !== 'partial' && d.outcome !== 'denied').length,
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
  }, [directives, char.id]);

  const held = meetings.filter((m) => m.status === 'held' && m.character_ids.includes(char.id)).length;
  const live = useMemo(
    () => (room.kind === 'ok' ? buildSessionScoreboardRows(room.committee, [], 'en').find((r) => r.country === room.seat) ?? null : null),
    [room],
  );

  if (loading) return <div className="flex flex-col" style={{ gap: 8 }}><Skeleton h={90} /><Skeleton h={30} /><Skeleton h={30} /></div>;

  const speakingNote = room.kind === 'loading' ? 'Reading the committee room'
    : room.kind === 'ok' ? `${live ? live.gslSpeeches + live.caucusSpeeches : 0} ${live && live.gslSpeeches + live.caucusSpeeches === 1 ? 'speech' : 'speeches'} in the committee room`
    : room.kind === 'nobody' ? `No seat named ${char.name} in the committee room yet`
    : room.kind === 'failed' ? 'Could not read the committee room. Trying again'
    : 'This cabinet has no committee room yet';

  return (
    <div className="flex flex-col" style={{ gap: 16 }}>
      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
        <Hover
          label="Speaking time"
          rows={[
            { label: 'Speakers list speeches', value: live?.gslSpeeches ?? 0 },
            { label: 'Caucus speeches', value: live?.caucusSpeeches ?? 0 },
            { label: 'Speaking time', value: formatSpeakingTime(live?.speakingSeconds ?? 0) },
          ]}
        >
          <Headline n={room.kind === 'loading' ? '...' : formatSpeakingTime(live?.speakingSeconds ?? 0)} word="speaking time" note={speakingNote} />
        </Hover>
        <Hover
          label="Directives sent"
          rows={[
            { label: 'Written by them', value: back.wrote },
            { label: 'Co-written', value: back.co },
            { label: 'Approved', value: back.approved, color: '#9ED3B0' },
            { label: 'Partly worked', value: back.partial, color: CK.gold },
            { label: 'Denied', value: back.denied, color: '#F0A596' },
            { label: 'Waiting', value: back.waiting },
          ]}
        >
          <Headline
            n={back.total}
            word={back.total === 1 ? 'directive sent' : 'directives sent'}
            note={back.total === 0 ? 'Nothing sent yet' : `${back.wrote} written, ${back.co} co-written`}
          />
        </Hover>
      </div>

      <div className="flex items-end flex-wrap" style={{ gap: '10px 28px' }}>
        <BigCount n={points.total} word={points.total === 1 ? 'crisis point' : 'crisis points'} color={CK.red} />
        <BigCount n={held} word={held === 1 ? 'meeting held' : 'meetings held'} />
        <BigCount n={back.approved} word="approved" color={CK.ok} />
        <BigCount n={back.partial} word="partly worked" color={CK.goldDeep} />
        <BigCount n={back.denied} word="denied" color={CK.danger} />
        {back.wrote > 0 && <BigCount n={back.words} word="words on average" />}
        {staff && back.replyMs !== null && <BigCount n={span(back.replyMs)} word="average reply time" />}
      </div>

      <section>
        <h3 className="flex items-center" style={{ margin: '0 0 8px', gap: 7, fontSize: 13, fontWeight: 800, color: CK.red }}>
          <Presentation size={16} strokeWidth={1.5} aria-hidden />In the committee room
        </h3>
        {room.kind === 'loading' && <div className="flex flex-col" style={{ gap: 8 }}><Skeleton h={30} /><Skeleton h={30} w="70%" /></div>}
        {room.kind === 'ok' && <RoomStats committee={room.committee} feedback={room.feedback} seat={room.seat} showPrivate={!!canSeeNotes} />}
        {room.kind !== 'loading' && room.kind !== 'ok' && (
          <p style={{ margin: 0, fontSize: 13.5, color: CK.inkSoft }}>{speakingNote}.</p>
        )}
      </section>

      <section>
        <h3 className="flex items-center" style={{ margin: '0 0 8px', gap: 7, fontSize: 13, fontWeight: 800, color: CK.red }}>
          <ScrollText size={16} strokeWidth={1.5} aria-hidden />Crisis points
        </h3>
        <div style={{ background: CK.card, borderRadius: 18, boxShadow: CK.shadowSm, padding: '6px 16px' }}>
          {points.lines.map((l, i) => (
            <div key={l.label} className="flex items-center justify-between gap-3" style={{ padding: '10px 0', borderTop: i === 0 ? 0 : `1px solid ${CK.hair}` }}>
              <span style={{ fontSize: 14, fontWeight: 600, overflowWrap: 'anywhere', minWidth: 0 }}>{l.label}</span>
              <span style={{ fontSize: 13, color: CK.inkSoft, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                {l.count} × {l.each} = <b style={{ fontSize: 15, color: l.total < 0 ? CK.danger : CK.ink }}>{l.total}</b>
              </span>
            </div>
          ))}
        </div>
        <p style={{ margin: '8px 0 0', fontSize: 12.5, color: CK.inkSoft }}>The Crisis Director sets what each action is worth in Settings. Points help judge awards; they are not a score.</p>
      </section>
    </div>
  );
}
