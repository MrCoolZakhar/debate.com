'use client';
// Gavelling Crisis: Statistics, a pop-up opened from the Command header. Two views in the one pop-up: how the backroom is doing
// (per backroomer: open, answered, average reply time, oldest waiting) and how the delegates compare. Delegates are RANKED on one
// blended total (owner, 30 Oct 2026): the points from the committee room (speeches, speaking time, motions, documents) plus the
// points from directives and meetings, the same total the character's Performance tab shows (src/lib/crisis/performance.ts).
// Points follow the PERSON (owner, 1 Nov 2026): a row is a delegate, and their total adds up every character they played.
// Each delegate has a split bar: green is the room, red is directives and meetings; bars share one scale so they compare at a
// glance. Counts are a big number with the word beside it, never pills.

import { CharacterName } from '../character/CharacterProfileHost';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChartNoAxesColumn } from 'lucide-react';
import { primeCrisisZone } from '@/lib/crisis/conferenceZone';
import { crisisError, type CrisisRef } from '@/lib/crisis/api';
import { useCrisisLive, useSingleFlight } from '@/lib/crisis/live';
import { isChairSendBack } from '@/lib/crisis/format';
import { fmtPts } from '@/lib/crisis/performance';
import { loadDirectiveStatRowsWithAuthors, type PointsRow } from '@/lib/crisis/points';
import type { Cabinet, Character, Directive, Member } from '@/lib/crisis/types';
import { ROLE_LABEL } from '@/lib/crisis/types';
import { Avatar, Btn, CK, Segmented, Skeleton, waitLabel } from '../../crisisKit';
import { useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import CrisisDialog from '../delegate/CrisisDialog';
import { OUT_COLOR, ROOM_COLOR, SplitBar, SplitLegend } from './blendKit';
import { useDelegateBlends, type DelegateBlend } from './commandBlend';
import { backroomStats, minutesLabel } from './commandData';

type View = 'backroom' | 'delegates';

/** A big number with the word beside it. */
function Stat({ n, word, color, width = 104 }: { n: number | string; word: string; color?: string; width?: number }) {
  return (
    <span className="inline-flex items-baseline" style={{ gap: 5, minWidth: width, whiteSpace: 'nowrap' }}>
      <b style={{ fontSize: 22, fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums', color: color ?? CK.ink }}>{n}</b>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: CK.inkSoft }}>{word}</span>
    </span>
  );
}

function Row({ name, charId, sub, src, color, children }: { name: string; charId?: string; sub?: string; src: string | null; color: string; children: React.ReactNode }) {
  return (
    <li className="flex items-center flex-wrap" style={{ gap: '8px 14px', padding: '10px 0', borderTop: `1px solid ${CK.hair}` }}>
      <span className="flex items-center" style={{ gap: 10, flex: '1 1 190px', minWidth: 0 }}>
        <Avatar name={name} src={src} size={38} color={color} />
        <span style={{ minWidth: 0 }}>
          <b style={{ display: 'block', fontSize: 14, color: CK.ink, overflowWrap: 'anywhere' }}>{charId ? <CharacterName id={charId} name={name} /> : name}</b>
          {sub && <span style={{ display: 'block', fontSize: 12, color: CK.inkSoft, overflowWrap: 'anywhere' }}>{sub}</span>}
        </span>
      </span>
      <span className="flex flex-wrap items-baseline" style={{ gap: '6px 14px', flex: '2 1 380px' }}>{children}</span>
    </li>
  );
}

function Key() {
  const dot = (c: string) => <span aria-hidden style={{ width: 9, height: 9, borderRadius: '50%', background: c, alignSelf: 'center', flex: 'none' }} />;
  return (
    <p className="flex flex-wrap items-baseline" style={{ margin: '10px 0 4px', gap: '4px 16px', fontSize: 12.5, fontWeight: 600, color: CK.inkSoft }}>
      <span className="inline-flex items-baseline" style={{ gap: 5 }}>{dot(ROOM_COLOR)}In the committee room: speeches, speaking time, motions, documents</span>
      <span className="inline-flex items-baseline" style={{ gap: 5 }}>{dot(OUT_COLOR)}Out of the room: directives and meetings</span>
    </p>
  );
}

/** One delegate (a person, whatever characters they played) with the directive counts behind their points. */
interface PersonStat {
  member: Member;
  /** The character they play now (null while they have none). */
  character: Character | null;
  /** Characters they played before and wrote directives as. */
  earlier: Character[];
  sent: number; approved: number; partial: number; denied: number; waiting: number;
}

/** The Delegates ranking: every delegate who plays someone or has sent a directive, counted by the PERSON who wrote them. */
function personStats(members: Member[], characters: Character[], rows: PointsRow[]): PersonStat[] {
  const byId = new Map(characters.map((c) => [c.id, c]));
  const out: PersonStat[] = [];
  for (const m of members) {
    if (m.role !== 'delegate') continue;
    // A directive the chair sent back never reached the backroom: it is not sent, not denied and not waiting (same as the points).
    const mine = rows.filter((d) => d.author_member_id === m.id && d.status !== 'withdrawn' && !isChairSendBack(d));
    const character = m.character_id ? byId.get(m.character_id) ?? null : null;
    if (!character && mine.length === 0) continue;
    const earlierIds = new Set(mine.map((d) => d.author_character_id).filter((x): x is string => !!x && x !== m.character_id));
    out.push({
      member: m, character,
      earlier: [...earlierIds].map((id) => byId.get(id)).filter((c): c is Character => !!c),
      sent: mine.length,
      approved: mine.filter((d) => d.status === 'answered' && d.outcome === 'approved').length,
      partial: mine.filter((d) => d.status === 'answered' && d.outcome === 'partial').length,
      denied: mine.filter((d) => d.status === 'answered' && d.outcome === 'denied').length,
      waiting: mine.filter((d) => d.status !== 'answered').length,
    });
  }
  return out;
}

/** One delegate in the ranking: rank, who, the total, the split bar (shared scale) and the numbers behind it. */
function RankRow({ rank, s, b, max, sub, color }: { rank: number; s: PersonStat; b: DelegateBlend; max: number; sub?: string; color: string }) {
  const c = s.character;
  return (
    <li style={{ padding: '12px 0', borderTop: `1px solid ${CK.hair}` }}>
      <div className="flex items-center" style={{ gap: 12 }}>
        <b aria-label={`Rank ${rank}`} style={{ width: 26, flex: 'none', textAlign: 'center', fontSize: 20, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: rank === 1 ? CK.red : CK.muted }}>{rank}</b>
        <Avatar name={s.member.display_name} src={c?.picture_url ?? s.member.picture_url} size={38} color={color} />
        <span style={{ minWidth: 0, flex: 1 }}>
          <b style={{ display: 'block', fontSize: 14, color: CK.ink, overflowWrap: 'anywhere' }}>{s.member.display_name}</b>
          <span style={{ display: 'block', fontSize: 12, color: CK.inkSoft, overflowWrap: 'anywhere' }}>
            {c ? <>Plays <CharacterName id={c.id} name={c.name} />{sub ? `, ${sub}` : ''}</> : 'No character right now'}
          </span>
          {s.earlier.length > 0 && (
            <span style={{ display: 'block', fontSize: 12, color: CK.muted, overflowWrap: 'anywhere' }}>
              Also played {s.earlier.map((e, i) => <span key={e.id}>{i > 0 ? ', ' : ''}<CharacterName id={e.id} name={e.name} /></span>)}
            </span>
          )}
        </span>
        <span className="inline-flex items-baseline" style={{ gap: 5, flex: 'none', whiteSpace: 'nowrap' }}>
          <b style={{ fontSize: 26, fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums', color: CK.red }}>{fmtPts(b.total)}</b>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: CK.inkSoft }}>{b.total === 1 ? 'point' : 'points'}</span>
        </span>
      </div>
      <div style={{ margin: '9px 0 8px 38px' }}><SplitBar room={b.room} out={b.out} scale={max > 0 ? b.total / max : 0} /></div>
      <div className="flex flex-wrap items-baseline" style={{ gap: '4px 18px', marginLeft: 38 }}>
        <SplitLegend room={b.hasSeat ? b.room : null} out={b.out} roomWord={b.hasSeat ? 'in the room' : 'no seat in the room'} outWord="from directives and meetings" size={16} />
        <Stat n={s.sent} word="sent" width={0} />
        <Stat n={s.approved} word="approved" color={s.approved ? CK.ok : undefined} width={0} />
        <Stat n={s.partial} word="partly works" width={0} />
        <Stat n={s.denied} word="denied" color={s.denied ? CK.danger : undefined} width={0} />
        <Stat n={s.waiting} word="waiting" color={s.waiting ? CK.warn : undefined} width={0} />
      </div>
    </li>
  );
}

export function StatsButton({ onClick }: { onClick: () => void }) {
  return <Btn tone="ghost" size="sm" icon={<ChartNoAxesColumn size={14} strokeWidth={1.5} aria-hidden />} onClick={onClick}>Statistics</Btn>;
}

/** Every directive of the crisis in light columns, read in the database (never a capped list), kept live. null until first read. */
function useStatRows(ref: CrisisRef): { rows: PointsRow[] | null; error: string | null } {
  const [rows, setRows] = useState<PointsRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const readRows = useCallback(async () => {
    try { await primeCrisisZone(ref); setRows(await loadDirectiveStatRowsWithAuthors(ref)); setError(null); }
    catch (e) { setError(crisisError(e, 'Could not load the statistics.')); }
  }, [ref]);
  const read = useSingleFlight(readRows);
  useEffect(() => {
    const t = window.setTimeout(() => { void read(); }, 0);
    return () => window.clearTimeout(t);
  }, [read]);
  useCrisisLive(ref.id, ['crisis_directives'], useCallback(() => { void read(); }, [read]));
  return { rows, error };
}

export default function StatsDialog({ directives, members, characters, cabinets, now, onClose }: {
  directives: Directive[] | null; members: Member[]; characters: Character[]; cabinets: Cabinet[]; now: number; onClose: () => void;
}) {
  const [view, setView] = useState<View>('backroom');
  const { ref, core } = useCrisis();
  // Open directives come from the page's list (it always holds every open one); the counts come from the database.
  const { rows, error: rowsError } = useStatRows(ref);
  const back = useMemo(() => (directives && rows ? backroomStats(members, directives, rows, now) : null), [members, directives, rows, now]);
  const del = useMemo(() => (rows ? personStats(members, characters, rows) : null), [characters, rows, members]);
  const cabById = useMemo(() => new Map(cabinets.map((c) => [c.id, c])), [cabinets]);
  const blends = useDelegateBlends(ref, cabinets, characters, members, rows, core.crisis.settings, view === 'delegates');
  // Ranked on the blended total; equal totals share a rank.
  const ranked = useMemo(() => {
    if (!del || blends.status !== 'ready') return null;
    const rows = del
      .map((s) => ({ s, b: blends.byMember.get(s.member.id) }))
      .filter((r): r is { s: PersonStat; b: DelegateBlend } => !!r.b)
      .sort((x, y) => y.b.total - x.b.total || y.s.sent - x.s.sent || x.s.member.display_name.localeCompare(y.s.member.display_name));
    let last = Number.NaN; let rank = 0;
    return rows.map((r, i) => { if (r.b.total !== last) { rank = i + 1; last = r.b.total; } return { ...r, rank }; });
  }, [del, blends]);
  const max = ranked?.reduce((m, r) => Math.max(m, r.b.total), 0) ?? 0;

  return (
    <CrisisDialog title="Statistics" eyebrow="How everyone is doing" onClose={onClose} width={860} step={view}>
      <div style={{ marginBottom: 6 }}>
        <Segmented<View> ariaLabel="Statistics view" value={view} onChange={setView} options={[{ value: 'backroom', label: 'Backroom' }, { value: 'delegates', label: 'Delegates' }]} />
      </div>
      {rowsError && <p role="status" style={{ margin: '8px 0 0', fontSize: 13, color: CK.danger }}>{rowsError}</p>}
      {view === 'backroom' ? (
        back === null ? <div className="flex flex-col" style={{ gap: 8 }}><Skeleton h={52} /><Skeleton h={52} /></div>
        : back.length === 0 ? <p style={{ margin: '12px 0 0', fontSize: 14, color: CK.inkSoft }}>No backroomers yet.</p>
        : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {back.map((s) => (
              <Row key={s.member.id} name={s.member.display_name} sub={ROLE_LABEL[s.member.role]} src={s.member.picture_url} color={CK.forest2}>
                <Stat n={s.open} word="open" color={s.open >= 4 ? CK.red : CK.ink} />
                <Stat n={s.writing} word="being written" color={s.writing ? CK.forest2 : undefined} width={134} />
                <Stat n={s.answeredToday} word="answered today" width={150} />
                <Stat n={s.answered} word="answered" />
                <span className="inline-flex items-baseline" style={{ gap: 5, minWidth: 150 }}>
                  <b style={{ fontSize: 22, fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums', color: CK.ink, whiteSpace: 'nowrap' }}>
                    {s.avgReplyMin === null ? 'None' : minutesLabel(s.avgReplyMin)}
                  </b>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: CK.inkSoft }}>average reply</span>
                </span>
                <span className="inline-flex items-baseline" style={{ gap: 5, minWidth: 130 }}>
                  <b style={{ fontSize: 22, fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums', color: CK.ink, whiteSpace: 'nowrap' }}>
                    {s.oldestWaiting ? waitLabel(s.oldestWaiting, now) : 'None'}
                  </b>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: CK.inkSoft }}>oldest waiting</span>
                </span>
              </Row>
            ))}
          </ul>
        )
      ) : (
        del === null || ranked === null ? <div className="flex flex-col" style={{ gap: 8 }}><Skeleton h={52} /><Skeleton h={52} /></div>
        : del.length === 0 ? <p style={{ margin: '12px 0 0', fontSize: 14, color: CK.inkSoft }}>No delegates in play yet.</p>
        : (
          <>
            <Key />
            {blends.status === 'ready' && !blends.roomsRead && (
              <p role="status" style={{ margin: '2px 0 4px', fontSize: 12.5, color: CK.danger }}>Could not read the committee rooms, so only directive and meeting points count for now.</p>
            )}
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {ranked.map((r) => {
                const cab = r.s.character?.cabinet_id ? cabById.get(r.s.character.cabinet_id) : undefined;
                return <RankRow key={r.s.member.id} rank={r.rank} s={r.s} b={r.b} max={max} sub={cab?.name} color={cab?.color ?? CK.red} />;
              })}
            </ul>
          </>
        )
      )}
    </CrisisDialog>
  );
}
