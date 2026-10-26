// Gavelling Crisis: Crisis Command data helpers. Pure functions plus the two reads this page
// adds locally (the front rooms' live state and the resource log); everything else comes from api.ts.

import { getCrisisClient } from '@/lib/crisis/client';
import { amount } from '@/lib/crisis/format';
import type { Cabinet, Directive, Member, Resource } from '@/lib/crisis/types';
import type { CrisisRef } from '@/lib/crisis/api';
import { isOpenStatus } from '../directives/directiveKit';

// ─────────── Front rooms ───────────

export type RoomTone = 'live' | 'quiet' | 'ended';

export interface RoomState {
  cabinetId: string;
  /** null = no conference committee, or its room was never started. */
  code: string | null;
  phaseLabel: string | null;
  tone: RoomTone;
  speaker: string | null;
  /** The room's chair password (committees.settings.chairJoinSuffix; anon-readable, shown to directors to join as chair). */
  chairPassword: string | null;
}

interface CommitteeRow {
  id: string; code: string; phase: string; caucus: { type?: string; isConsultation?: boolean } | null;
  suspended_at: string | null; ended_at: string | null;
}

export function phaseWords(r: CommitteeRow): { label: string; tone: RoomTone } {
  if (r.ended_at) return { label: 'Ended', tone: 'ended' };
  if (r.suspended_at) return { label: 'Suspended', tone: 'quiet' };
  switch (r.phase) {
    case 'pre-session': case 'roll-call': return { label: 'Roll call', tone: 'quiet' };
    case 'speakers-list': return { label: 'Speakers list', tone: 'live' };
    case 'moderated-caucus': return { label: 'Moderated caucus', tone: 'live' };
    case 'unmoderated-caucus': return { label: r.caucus?.isConsultation ? 'Consultation of the whole' : 'Unmoderated caucus', tone: 'live' };
    case 'voting': return { label: 'Voting', tone: 'live' };
    case 'adjourned': return { label: 'Suspended', tone: 'quiet' };
    default: return { label: 'In session', tone: 'live' };
  }
}

/** Reads each cabinet's live room: conference_committees -> committees -> current_speaker. */
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
  const speakers = new Map<string, string>();
  if (sessionIds.length) {
    const [cm, sp] = await Promise.all([
      client.from('committees').select('id, code, phase, caucus, suspended_at, ended_at, settings').in('id', sessionIds),
      client.from('current_speaker').select('committee_id, country').in('committee_id', sessionIds),
    ]);
    if (cm.error) throw cm.error;
    for (const row of (cm.data ?? []) as CommitteeRow[]) rooms.set(row.id, row);
    for (const row of (sp.data ?? []) as Array<{ committee_id: string; country: string | null }>) if (row.country) speakers.set(row.committee_id, row.country);
  }
  return cabinets.map((c) => {
    const link = c.conference_committee_id ? links.get(c.conference_committee_id) : undefined;
    const room = link?.session_id ? rooms.get(link.session_id) : undefined;
    if (!room) return { cabinetId: c.id, code: null, phaseLabel: null, tone: 'quiet' as RoomTone, speaker: null, chairPassword: null };
    const { label, tone } = phaseWords(room);
    const floor = room.phase === 'speakers-list' || room.phase === 'moderated-caucus';
    const pw = (room as CommitteeRow & { settings?: { chairJoinSuffix?: unknown } }).settings?.chairJoinSuffix;
    return { cabinetId: c.id, code: room.code ?? link?.session_code ?? null, phaseLabel: label, tone, speaker: floor && tone === 'live' ? speakers.get(room.id) ?? null : null, chairPassword: typeof pw === 'string' && pw ? pw : null };
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

const isStaffRow = (m: Member) => m.role === 'backroomer' || m.role === 'director' || m.role === 'assistant_director';
const isLoadStatus = (d: Directive) => isOpenStatus(d) || d.status === 'clarify';

export function staffLoads(members: Member[], directives: Directive[]): StaffLoad[] {
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const since = startOfDay.getTime();
  return members.filter(isStaffRow).map((member) => {
    const open = directives.filter((d) => d.assigned_member_id === member.id && isLoadStatus(d));
    const done = directives.filter((d) => d.answered_by === member.id && d.answered_at && new Date(d.answered_at).getTime() >= since);
    const avg = done.length
      ? done.reduce((s, d) => s + (new Date(d.answered_at as string).getTime() - new Date(d.created_at).getTime()), 0) / done.length / 60000
      : null;
    return { member, open, avgReplyMin: avg };
  }).sort((a, b) => b.open.length - a.open.length || a.member.display_name.localeCompare(b.member.display_name));
}

/** A rebalance suggestion: the busiest person gives their 2 oldest open directives to the least loaded. */
export function suggestRebalance(loads: StaffLoad[]): { from: StaffLoad; to: StaffLoad; move: Directive[] } | null {
  if (loads.length < 2) return null;
  const from = loads[0];
  const to = loads[loads.length - 1];
  if (from.member.id === to.member.id || from.open.length - to.open.length < 2) return null;
  const move = [...from.open]
    .filter((d) => d.status !== 'clarify')
    .sort((a, b) => new Date(a.waiting_since).getTime() - new Date(b.waiting_since).getTime())
    .slice(0, 2);
  return move.length === 2 ? { from, to, move } : null;
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
