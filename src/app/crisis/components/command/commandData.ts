// Gavelling Crisis: Crisis Command data helpers. Pure functions plus the two reads this page
// adds locally (the front rooms' live state and the resource log); everything else comes from api.ts.

import { getCrisisClient } from '@/lib/crisis/client';
import { amount, isChairSendBack } from '@/lib/crisis/format';
import { isCrisisTeamName } from '@/lib/crisis/staffChatName';
import type { Cabinet, Character, Directive, Member, Resource } from '@/lib/crisis/types';
import type { CrisisRef } from '@/lib/crisis/api';
import type { CaucusJson, LiveCommittee } from '@/app/manage/[slug]/live/LiveModals';
import { isBeingWritten, isOpenStatus } from '../directives/directiveKit';

// ─────────── Front rooms ───────────

export interface RoomState {
  cabinetId: string;
  /** The live session's id (committees.id): the full organiser Live Status model loads the room from it. */
  sessionId: string | null;
  /** null = no conference committee, or its room was never started. Used only by the room pop-up's join links. */
  code: string | null;
  /** The room's chair password (committees.settings.chairJoinSuffix; anon-readable, shown to directors to join as chair). Pop-up only. */
  chairPassword: string | null;
  /** The room in the organiser Live Status shape, light version (no ledger, no feedback), enough for nowPlaying / presence. */
  live: LiveCommittee | null;
}

interface CommitteeRow {
  id: string; code: string; name: string | null; phase: string; caucus: CaucusJson | null; chair_names: string[] | null;
  suspended_at: string | null; ended_at: string | null; updated_at: string | null; resuming_chair: string | null;
  settings: { headChair?: unknown; chairJoinSuffix?: unknown; quorumThreshold?: string } | null;
}
type Row = Record<string, unknown>;

/** Reads each cabinet's live room in four batched reads (all rooms at once): conference_committees -> committees,
 *  current_speaker, delegates, speakers_list, and builds the organiser's LiveCommittee for each. */
export async function loadRoomStates(ref: CrisisRef, cabinets: Cabinet[]): Promise<RoomState[]> {
  const client = await getCrisisClient(ref.conf, ref.crisis);
  const ccIds = cabinets.map((c) => c.conference_committee_id).filter((x): x is string => !!x);
  const links = new Map<string, { session_id: string | null; session_code: string | null }>();
  if (ccIds.length) {
    const r = await client.from('conference_committees').select('id, session_id, session_code').in('id', ccIds);
    if (r.error) throw r.error;
    for (const row of (r.data ?? []) as Array<{ id: string; session_id: string | null; session_code: string | null }>) links.set(row.id, row);
  }
  const sessionIds = [...links.values()].map((l) => l.session_id).filter((x): x is string => !!x);
  const rooms = new Map<string, CommitteeRow>();
  const speakers = new Map<string, Row>();
  const delegates = new Map<string, Row[]>();
  const lists = new Map<string, Row[]>();
  const docs = new Map<string, Row[]>();
  const push = (m: Map<string, Row[]>, id: string, row: Row) => { const l = m.get(id); if (l) l.push(row); else m.set(id, [row]); };
  if (sessionIds.length) {
    const [cm, sp, dl, ql, dc] = await Promise.all([
      client.from('committees').select('id, code, name, phase, caucus, chair_names, suspended_at, ended_at, updated_at, resuming_chair, settings').in('id', sessionIds),
      client.from('current_speaker').select('committee_id, country, time_remaining, started_at').in('committee_id', sessionIds),
      client.from('delegates').select('committee_id, country, status, is_observer, logo_url, group_color, group_short').in('committee_id', sessionIds),
      client.from('speakers_list').select('committee_id, country, position, list_type').in('committee_id', sessionIds).order('position', { ascending: true }),
      client.from('documents').select('committee_id, type, status').in('committee_id', sessionIds),
    ]);
    if (cm.error) throw cm.error;
    for (const row of (cm.data ?? []) as unknown as CommitteeRow[]) rooms.set(row.id, row);
    for (const row of (sp.data ?? []) as Row[]) speakers.set(row.committee_id as string, row);
    for (const row of (dl.data ?? []) as Row[]) push(delegates, row.committee_id as string, row);
    for (const row of (ql.data ?? []) as Row[]) push(lists, row.committee_id as string, row);
    for (const row of (dc.data ?? []) as Row[]) push(docs, row.committee_id as string, row);
  }
  return cabinets.map((c) => {
    const link = c.conference_committee_id ? links.get(c.conference_committee_id) : undefined;
    const room = link?.session_id ? rooms.get(link.session_id) : undefined;
    if (!room) return { cabinetId: c.id, sessionId: null, code: null, chairPassword: null, live: null };
    const sp = speakers.get(room.id) ?? null;
    const dl = delegates.get(room.id) ?? [];
    const ql = lists.get(room.id) ?? [];
    const dc = docs.get(room.id) ?? [];
    // The crisis staff's chat name is not a presiding chair.
    const chairNames = (room.chair_names ?? []).filter((n) => !isCrisisTeamName(n));
    const pw = room.settings?.chairJoinSuffix;
    const live: LiveCommittee = {
      conf: {
        id: c.conference_committee_id ?? room.id, name: c.name, abbreviation: c.short_name, logoUrl: c.logo_url, topics: null, totalSlots: dl.length,
        sessionId: room.id, sessionCode: room.code ?? link?.session_code ?? null, delegationSize: 1, chairUserIds: [], chairs: [], pendingChairs: [],
      },
      session: {
        id: room.id, code: room.code, name: room.name ?? c.name, phase: room.phase, caucus: room.caucus, chairNames,
        headChair: (typeof room.settings?.headChair === 'string' && room.settings.headChair) || chairNames[0] || null,
        suspendedAt: room.suspended_at, endedAt: room.ended_at, updatedAt: room.updated_at, resumingChair: room.resuming_chair,
        quorumThreshold: room.settings?.quorumThreshold ?? 'none', scoringFactors: [], factorScaleMax: 10,
      },
      currentSpeaker: sp ? { country: (sp.country as string | null) ?? null, timeRemaining: Number(sp.time_remaining ?? 0), startedAt: (sp.started_at as string | null) ?? null } : null,
      delegates: dl.map((d) => ({
        country: d.country as string, status: d.status as string, isObserver: !!d.is_observer, logoUrl: (d.logo_url as string | null) ?? null,
        groupColor: (d.group_color as string | null) ?? null, groupShort: (d.group_short as string | null) ?? null,
      })),
      gslQueue: ql.filter((q) => q.list_type === 'gsl').map((q) => q.country as string),
      caucusQueue: ql.filter((q) => q.list_type === 'caucus').map((q) => q.country as string),
      documents: dc.map((d) => ({ type: d.type as string, status: d.status as string, docCode: '', title: '', sponsors: [], fileUrl: null, fileName: null, content: null, createdAt: null })),
      speechLogs: [], eventLogs: [], scores: [],
      lastActivityAt: (sp?.started_at as string | null) ?? null,
      lastMessageAt: null,
      hasHistory: ql.length > 0 || !!sp?.country || !!room.suspended_at || dc.length > 0,
      feedback: [],
    };
    return { cabinetId: c.id, sessionId: room.id, code: room.code ?? link?.session_code ?? null, chairPassword: typeof pw === 'string' && pw ? pw : null, live };
  });
}

// ─────────── Resource log ───────────

/** The newest change per resource: { resource_id -> delta }. */
export async function loadLastChanges(ref: CrisisRef): Promise<Map<string, number>> {
  const client = await getCrisisClient(ref.conf, ref.crisis);
  const res = await client.from('crisis_resource_log').select('resource_id, delta, created_at')
    .eq('crisis_id', ref.id).order('created_at', { ascending: false }).limit(200);
  const out = new Map<string, number>();
  if (res.error) return out;
  for (const row of (res.data ?? []) as Array<{ resource_id: string; delta: number }>) {
    if (!out.has(row.resource_id)) out.set(row.resource_id, Number(row.delta));
  }
  return out;
}

export function formatAmount(n: number): string {
  return amount(n);
}

// ─────────── Backroom load ───────────

export interface StaffLoad {
  member: Member;
  open: Directive[];
  /** Average minutes from created to answered, over what this person answered today. null = none yet. */
  avgReplyMin: number | null;
}

export const isStaffRow = (m: Member) => m.role === 'backroomer' || m.role === 'director' || m.role === 'assistant_director';

/** ONE definition of backroom load (owner rule): a directive is load while it waits on the backroom, i.e. queued or claimed
 *  (isOpenStatus, directives/directiveKit.ts). "More detail needed" waits for the delegate and is NOT backroom load. */
export const isLoadStatus = isOpenStatus;

/** A reply is being typed (isBeingWritten, directives/directiveKit.ts: drafting_at within 5 minutes) on a still-open directive.
 *  Such a directive is being dealt with, so it is not waiting and not load. */
export const beingWritten = (d: Directive, nowMs: number): boolean => isOpenStatus(d) && isBeingWritten(d, nowMs);

export function staffLoads(members: Member[], directives: Directive[], nowMs: number): StaffLoad[] {
  const startOfDay = new Date(nowMs); startOfDay.setHours(0, 0, 0, 0);
  const since = startOfDay.getTime();
  return members.filter(isStaffRow).map((member) => {
    // A directive being written is being dealt with: it is not open load.
    const open = directives.filter((d) => d.assigned_member_id === member.id && isLoadStatus(d) && !beingWritten(d, nowMs));
    const done = directives.filter((d) => d.answered_by === member.id && d.answered_at && new Date(d.answered_at).getTime() >= since);
    const avg = done.length
      ? done.reduce((s, d) => s + (new Date(d.answered_at as string).getTime() - new Date(d.created_at).getTime()), 0) / done.length / 60000
      : null;
    return { member, open, avgReplyMin: avg };
  }).sort((a, b) => b.open.length - a.open.length || a.member.display_name.localeCompare(b.member.display_name));
}

/** A rebalance suggestion: the busiest person gives enough of their oldest open directives to even the two out
 *  (half the gap, rounded down). null when the load is balanced (a gap under 3). */
export function suggestRebalance(loads: StaffLoad[]): { from: StaffLoad; to: StaffLoad; move: Directive[] } | null {
  if (loads.length < 2) return null;
  const sorted = [...loads].sort((a, b) => b.open.length - a.open.length);
  const from = sorted[0];
  const to = sorted[sorted.length - 1];
  const gap = from.open.length - to.open.length;
  if (from.member.id === to.member.id || gap < 3) return null;
  const move = [...from.open]
    .sort((a, b) => new Date(a.waiting_since).getTime() - new Date(b.waiting_since).getTime())
    .slice(0, Math.floor(gap / 2));
  return move.length > 0 ? { from, to, move } : null;
}

// ─────────── Statistics ───────────

export interface BackroomStat {
  member: Member;
  open: number;
  answered: number;
  /** Average minutes from created to answered, over everything this person answered. null = none yet. */
  avgReplyMin: number | null;
  /** Directives this person is writing a reply to right now (counted apart from open). */
  writing: number;
  /** waiting_since of the oldest open directive, null when nothing waits. */
  oldestWaiting: string | null;
}

export function backroomStats(members: Member[], directives: Directive[], nowMs: number): BackroomStat[] {
  return members.filter(isStaffRow).map((member) => {
    const mine = directives.filter((d) => d.assigned_member_id === member.id && isLoadStatus(d));
    const writing = mine.filter((d) => beingWritten(d, nowMs)).length;
    const open = mine.filter((d) => !beingWritten(d, nowMs));
    const done = directives.filter((d) => d.answered_by === member.id && d.answered_at);
    const avg = done.length
      ? done.reduce((s, d) => s + (new Date(d.answered_at as string).getTime() - new Date(d.created_at).getTime()), 0) / done.length / 60000
      : null;
    const oldest = open.reduce<string | null>((o, d) => (o === null || new Date(d.waiting_since) < new Date(o) ? d.waiting_since : o), null);
    return { member, open: open.length, answered: done.length, avgReplyMin: avg, writing, oldestWaiting: oldest };
  }).sort((a, b) => b.open - a.open || b.answered - a.answered || a.member.display_name.localeCompare(b.member.display_name));
}

export interface DelegateStat {
  character: Character;
  sent: number;
  approved: number;
  partial: number;
  denied: number;
  waiting: number;
}

/** The Delegates ranking: only characters somebody plays (a delegate member holds them), never a spare or an empty seat. */
export function delegateStats(characters: Character[], directives: Directive[], members: Member[]): DelegateStat[] {
  const played = new Set(members.filter((m) => m.role === 'delegate' && m.character_id).map((m) => m.character_id as string));
  return characters.filter((c) => c.status !== 'spare' && played.has(c.id)).map((character) => {
    // A directive the chair sent back never reached the backroom: it is not sent, not denied and not waiting (same as the points).
    const mine = directives.filter((d) => d.author_character_id === character.id && d.status !== 'withdrawn' && !isChairSendBack(d));
    return {
      character,
      sent: mine.length,
      approved: mine.filter((d) => d.status === 'answered' && d.outcome === 'approved').length,
      partial: mine.filter((d) => d.status === 'answered' && d.outcome === 'partial').length,
      denied: mine.filter((d) => d.status === 'answered' && d.outcome === 'denied').length,
      waiting: mine.filter((d) => d.status !== 'answered').length,
    };
  }).sort((a, b) => b.sent - a.sent || a.character.name.localeCompare(b.character.name));
}

export function minutesLabel(min: number | null): string {
  if (min === null) return 'No replies yet';
  if (min < 1) return 'under 1 min';
  if (min < 60) return `${Math.round(min)} min`;
  return `${Math.floor(min / 60)} h ${Math.round(min % 60)} min`;
}

export function groupResourcesByCabinet(resources: Resource[]): Map<string, Resource[]> {
  const out = new Map<string, Resource[]>();
  for (const r of resources) {
    if (!r.cabinet_id) continue;
    const list = out.get(r.cabinet_id) ?? [];
    list.push(r);
    out.set(r.cabinet_id, list);
  }
  return out;
}
