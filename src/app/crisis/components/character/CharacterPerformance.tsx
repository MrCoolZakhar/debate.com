'use client';
// Gavelling Crisis: the Performance tab of the character pop-up, ONE combined view. At the top the crisis
// points; then a single card that puts the FRONT ROOM (what the character did in the live committee
// room: speeches, speaking time, motions raised and passed, documents sponsored) next to the BACKROOM
// (directives sent and how they were answered, average length, reply time). Counts are a big number
// with the word beside it. Read only: the room is read through the organiser's Live Status loader
// (loadAdminRoom) and re-read every minute while the tab is visible; nothing here writes.

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Presentation, ScrollText } from 'lucide-react';
import { loadAdminRoom } from '@/app/admin/liveRoomLoader';
import type { LiveCommittee } from '@/app/manage/[slug]/live/LiveModals';
import type { CrisisRef } from '@/lib/crisis/api';
import { getCrisisClient } from '@/lib/crisis/client';
import type { characterPoints } from '@/lib/crisis/points';
import type { Cabinet, Character, Directive, Meeting } from '@/lib/crisis/types';
import { BigCount, CK, Skeleton } from '../../crisisKit';

type Room =
  | { kind: 'loading' }
  | { kind: 'none' }
  | { kind: 'failed' }
  | { kind: 'ok'; room: LiveCommittee };

const REFRESH_MS = 60_000;

/** Finds the cabinet's live room and reads it. A failed re-read keeps what is on screen. */
function useFrontRoom(ref: CrisisRef, cabinet: Cabinet | null): Room {
  const [state, setState] = useState<Room>({ kind: 'loading' });
  const ccId = cabinet?.conference_committee_id ?? null;

  useEffect(() => {
    let alive = true;
    let inFlight = false;
    const load = async () => {
      if (inFlight || document.visibilityState !== 'visible') return;
      inFlight = true;
      try {
        if (!ccId) { if (alive) setState({ kind: 'none' }); return; }
        const client = await getCrisisClient(ref.conf, ref.crisis);
        const r = await client.from('conference_committees').select('session_id').eq('id', ccId).maybeSingle();
        const sid = (r.data as { session_id: string | null } | null)?.session_id ?? null;
        if (!sid) { if (alive) setState({ kind: 'none' }); return; }
        const room = await loadAdminRoom(sid, null);
        if (alive) setState({ kind: 'ok', room: room.data });
      } catch {
        if (alive) setState((p) => (p.kind === 'ok' ? p : { kind: 'failed' }));
      } finally { inFlight = false; }
    };
    const first = window.setTimeout(() => { void load(); }, 0);
    const poll = window.setInterval(() => { void load(); }, REFRESH_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') void load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { alive = false; window.clearTimeout(first); window.clearInterval(poll); document.removeEventListener('visibilitychange', onVisible); };
  }, [ref, ccId]);

  return state;
}

const norm = (s: string) => s.trim().toLowerCase();

function seconds(n: number): string {
  const s = Math.max(0, Math.round(n));
  const m = Math.floor(s / 60);
  if (!m) return `${s}s`;
  return s % 60 ? `${m}m ${s % 60}s` : `${m}m`;
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

function frontRoomStats(room: LiveCommittee, name: string) {
  const me = norm(name);
  const seat = room.delegates.find((d) => norm(d.country) === me) ?? null;
  const speeches = room.speechLogs.filter((s) => norm(s.country) === me);
  const total = speeches.reduce((a, s) => a + s.seconds, 0);
  return {
    seated: !!seat,
    speeches: speeches.length,
    seconds: total,
    average: speeches.length ? total / speeches.length : 0,
    raised: room.eventLogs.filter((e) => e.type === 'motion-raised' && norm(e.country) === me).length,
    passed: room.eventLogs.filter((e) => e.type === 'motion-passed' && norm(e.country) === me).length,
    documents: room.documents.filter((d) => d.sponsors.some((x) => norm(x) === me)).length,
  };
}

function Block({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section style={{ minWidth: 0 }}>
      <h3 className="flex items-center" style={{ margin: '0 0 10px', gap: 7, fontSize: 13, fontWeight: 800, color: CK.red }}>
        <span aria-hidden style={{ lineHeight: 0 }}>{icon}</span>{title}
      </h3>
      <div className="flex flex-col" style={{ gap: 10 }}>{children}</div>
    </section>
  );
}

export default function CharacterPerformance({ crisisRef, char, cabinet, points, directives, meetings, loading, staff }: {
  crisisRef: CrisisRef;
  char: Character;
  cabinet: Cabinet | null;
  points: ReturnType<typeof characterPoints>;
  /** What this character wrote or co-wrote. */
  directives: Directive[] | null;
  meetings: Meeting[];
  loading: boolean;
  /** Reply times are staff business. */
  staff: boolean;
}) {
  const room = useFrontRoom(crisisRef, cabinet);

  const back = useMemo(() => {
    const wrote = (directives ?? []).filter((d) => d.author_character_id === char.id);
    const count = (o: Directive['outcome']) => wrote.filter((d) => d.outcome === o).length;
    const answered = wrote.filter((d) => d.answered_at);
    const replyMs = answered.length ? answered.reduce((a, d) => a + (new Date(d.answered_at as string).getTime() - new Date(d.created_at).getTime()), 0) / answered.length : null;
    return {
      sent: wrote.length, approved: count('approved'), partial: count('partial'), denied: count('denied'),
      words: wrote.length ? Math.round(wrote.reduce((a, d) => a + d.word_count, 0) / wrote.length) : 0,
      replyMs,
    };
  }, [directives, char.id]);

  const front = room.kind === 'ok' ? frontRoomStats(room.room, char.name) : null;
  const held = meetings.filter((m) => m.status === 'held' && m.character_ids.includes(char.id)).length;

  if (loading) return <div className="flex flex-col" style={{ gap: 8 }}><Skeleton h={48} w="40%" /><Skeleton h={30} /><Skeleton h={30} /><Skeleton h={30} /></div>;

  return (
    <div className="flex flex-col" style={{ gap: 18 }}>
      <div className="flex items-end flex-wrap" style={{ gap: '10px 28px' }}>
        <BigCount n={points.total} word={points.total === 1 ? 'crisis point' : 'crisis points'} color={CK.red} />
        <BigCount n={held} word={held === 1 ? 'meeting held' : 'meetings held'} />
      </div>

      <div style={{ background: CK.card, borderRadius: 20, boxShadow: CK.shadowSm, padding: '16px 18px 18px', display: 'grid', gap: '18px 32px', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
        <Block icon={<Presentation size={16} strokeWidth={1.5} />} title="In the front room">
          {room.kind === 'loading' && <><Skeleton h={30} w="60%" /><Skeleton h={30} w="50%" /></>}
          {room.kind === 'none' && <p style={{ margin: 0, fontSize: 13.5, color: CK.inkSoft }}>This cabinet has no live room yet.</p>}
          {room.kind === 'failed' && <p style={{ margin: 0, fontSize: 13.5, color: CK.inkSoft }}>Could not read the live room. Trying again.</p>}
          {front && !front.seated && <p style={{ margin: 0, fontSize: 13.5, color: CK.inkSoft }}>{char.name} has no seat in the room yet.</p>}
          {front && front.seated && (
            <>
              <BigCount n={front.speeches} word={front.speeches === 1 ? 'speech' : 'speeches'} />
              <BigCount n={seconds(front.seconds)} word="speaking time" />
              {front.speeches > 0 && <BigCount n={seconds(front.average)} word="average speech" />}
              <BigCount n={front.raised} word={front.raised === 1 ? 'motion raised' : 'motions raised'} />
              <BigCount n={front.passed} word={front.passed === 1 ? 'motion passed' : 'motions passed'} />
              <BigCount n={front.documents} word={front.documents === 1 ? 'document sponsored' : 'documents sponsored'} />
            </>
          )}
        </Block>

        <Block icon={<ScrollText size={16} strokeWidth={1.5} />} title="In the backroom">
          <BigCount n={back.sent} word={back.sent === 1 ? 'directive sent' : 'directives sent'} />
          <BigCount n={back.approved} word="approved" color={CK.ok} />
          <BigCount n={back.partial} word="partly worked" color={CK.goldDeep} />
          <BigCount n={back.denied} word="denied" color={CK.danger} />
          {back.sent > 0 && <BigCount n={back.words} word="words on average" />}
          {staff && back.replyMs !== null && <BigCount n={span(back.replyMs)} word="average reply time" />}
        </Block>
      </div>

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
      <p style={{ margin: 0, fontSize: 12.5, color: CK.inkSoft }}>The Crisis Director sets what each action is worth in Settings. Points help judge awards; they are not a score.</p>
    </div>
  );
}
