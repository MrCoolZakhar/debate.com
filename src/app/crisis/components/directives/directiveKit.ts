// Gavelling Crisis: the backroom inbox rules in one place (lanes, filters, queue order, names).
import { CircleCheck, CircleDashed, CircleHelp, CircleX, Clock, Landmark, Lock, Megaphone, Newspaper, Undo2, Users, type LucideIcon } from 'lucide-react';
import { getCrisisClient } from '@/lib/crisis/client';
import { CHAIR_SEND_BACK_WORD, dirNumber, isChairSendBack } from '@/lib/crisis/format';
import type { CrisisRef } from '@/lib/crisis/api';
import { OUTCOME_LABEL, type Cabinet, type Character, type Directive, type DirectiveKind, type DirectiveOutcome, type Member } from '@/lib/crisis/types';

/** A kind with its icon: THE one map (owner, 25 Oct 2026: personal Lock, joint Users, cabinet Landmark). press_release and communique can
 *  no longer be created by anyone; they stay here only so old rows still draw. */
export const KIND_ICON: Record<DirectiveKind, LucideIcon> = {
  personal: Lock,
  joint: Users,
  committee: Landmark,
  press_release: Newspaper,
  communique: Megaphone,
};

/** An outcome with its icon and colour: approved green, partly gold, denied red, more detail blue, later grey. */
export const OUTCOME_STYLE: Record<DirectiveOutcome, { Icon: LucideIcon; color: string }> = {
  approved: { Icon: CircleCheck, color: '#3D7A52' },
  partial: { Icon: CircleDashed, color: '#9A6E14' },
  denied: { Icon: CircleX, color: '#A3412F' },
  clarify: { Icon: CircleHelp, color: '#3E6A9A' },
  later: { Icon: Clock, color: '#7A6E5E' },
};

/** The chair turned a cabinet directive back: its own colour (plum, as "With your chair"), never the denied red. */
const SEND_BACK_STYLE = { Icon: Undo2, color: '#7B3F61' };

/** What to say and draw for a directive's outcome: the real outcome, or "Sent back by your chair" (never "Denied") for a send-back. */
export function outcomeView(d: Pick<Directive, 'status' | 'reply' | 'outcome'>): { Icon: LucideIcon; color: string; word: string } | null {
  if (isChairSendBack(d)) return { ...SEND_BACK_STYLE, word: CHAIR_SEND_BACK_WORD };
  if (!d.outcome) return null;
  return { ...OUTCOME_STYLE[d.outcome], word: OUTCOME_LABEL[d.outcome] };
}

/** The character ids that co-signed a joint directive (staff read every row). */
export async function listDirectiveCoauthors(ref: CrisisRef, directiveId: string): Promise<string[]> {
  const client = await getCrisisClient(ref.conf, ref.crisis);
  const res = await client.from('crisis_directive_coauthors').select('character_id').eq('directive_id', directiveId);
  if (res.error) throw res.error;
  return ((res.data ?? []) as Array<{ character_id: string }>).map((r) => r.character_id);
}

export type Lane = 'mine' | 'unclaimed' | 'open' | 'waiting' | 'answered';
export type QueueOrder = 'fair' | 'oldest' | 'newest';

/** The kinds anyone can still create (the others only exist on old rows): the pickers and filters list these. */
export const CREATABLE_KINDS: DirectiveKind[] = ['personal', 'joint', 'committee'];

export const isOpenStatus = (d: Directive) => d.status === 'queued' || d.status === 'claimed';

export function inLane(d: Directive, lane: Lane, memberId: string | null): boolean {
  switch (lane) {
    case 'mine': return !!memberId && d.assigned_member_id === memberId && isOpenStatus(d);
    case 'unclaimed': return d.assigned_member_id === null && isOpenStatus(d);
    case 'open': return isOpenStatus(d);
    case 'waiting': return d.status === 'clarify';
    case 'answered': return d.status === 'answered';
  }
}

export interface Filters { cabinet: string; backroomer: string; theme: string; kind: string; search: string }
export const NO_FILTERS: Filters = { cabinet: '', backroomer: '', theme: '', kind: '', search: '' };

export interface Names {
  cabinets: Map<string, Cabinet>;
  characters: Map<string, Character>;
  members: Map<string, Member>;
}

export function buildNames(cabinets: Cabinet[], characters: Character[], members: Member[]): Names {
  return {
    cabinets: new Map(cabinets.map((c) => [c.id, c])),
    characters: new Map(characters.map((c) => [c.id, c])),
    members: new Map(members.map((m) => [m.id, m])),
  };
}

/** The name a delegate writes under: their character, else their own name. */
export function authorName(d: Directive, n: Names): string {
  const ch = d.author_character_id ? n.characters.get(d.author_character_id) : null;
  if (ch) return ch.name;
  const m = d.author_member_id ? n.members.get(d.author_member_id) : null;
  return m?.display_name ?? 'Unknown author';
}

export function memberName(id: string | null | undefined, n: Names, fallback = 'Nobody'): string {
  if (!id) return fallback;
  return n.members.get(id)?.display_name ?? fallback;
}

export function matchesFilters(d: Directive, f: Filters, n: Names): boolean {
  if (f.cabinet && d.cabinet_id !== f.cabinet) return false;
  if (f.backroomer === 'none' ? d.assigned_member_id !== null : f.backroomer && d.assigned_member_id !== f.backroomer) return false;
  if (f.theme && !d.themes.includes(f.theme)) return false;
  if (f.kind && d.kind !== (f.kind as DirectiveKind)) return false;
  const q = f.search.trim().toLowerCase();
  if (q) {
    const hay = `${dirNumber(d)} no ${dirNumber(d)} ${d.title} ${authorName(d, n)} ${d.body}`.toLowerCase();
    if (!hay.includes(q.replace(/^#/, ''))) return false;
  }
  return true;
}

/** Latest answered time per author, used to break ties in the fair order. */
export function lastAnsweredByAuthor(all: Directive[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const d of all) {
    if (!d.author_member_id || !d.answered_at) continue;
    const t = new Date(d.answered_at).getTime();
    if (t > (out.get(d.author_member_id) ?? -Infinity)) out.set(d.author_member_id, t);
  }
  return out;
}

const minute = (iso: string) => Math.floor(new Date(iso).getTime() / 60000);

/**
 * Queue order. Fair: longest wait first (to the minute); when two wait the same, the author who
 * heard back least recently goes first. Oldest / newest follow the day it was sent.
 * Answered and waiting lanes show the latest first.
 */
export function sortDirectives(list: Directive[], order: QueueOrder, lane: Lane, lastAnswered: Map<string, number>): Directive[] {
  const out = [...list];
  if (lane === 'answered' || lane === 'waiting') {
    // These lanes follow the day of the last answer: Fair and Newest show the latest first, Oldest the earliest.
    const at = (d: Directive) => new Date(d.answered_at ?? d.updated_at).getTime();
    return out.sort((a, b) => (order === 'oldest' ? at(a) - at(b) : at(b) - at(a)));
  }
  if (order === 'oldest') return out.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  if (order === 'newest') return out.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return out.sort((a, b) => {
    const w = minute(a.waiting_since) - minute(b.waiting_since);
    if (w !== 0) return w;
    const la = a.author_member_id ? lastAnswered.get(a.author_member_id) ?? -Infinity : -Infinity;
    const lb = b.author_member_id ? lastAnswered.get(b.author_member_id) ?? -Infinity : -Infinity;
    if (la !== lb) return la < lb ? -1 : 1;
    return a.no - b.no;
  });
}

/** A reply typed in the last 5 minutes means someone is on it (crisis_mark_drafting, docs/crisis/sql/020). */
export const WRITING_WINDOW_MS = 5 * 60 * 1000;

/** True when a staff member has said, within the last 5 minutes, that they are writing the reply to this directive. */
export function isBeingWritten(d: Pick<Directive, 'drafting_member' | 'drafting_at'>, nowMs: number): boolean {
  if (!d.drafting_member || !d.drafting_at) return false;
  const t = new Date(d.drafting_at).getTime();
  return Number.isFinite(t) && nowMs - t < WRITING_WINDOW_MS;
}

/** The staff member who is writing this directive's reply right now, or null. */
export function writerOf(d: Directive, n: Names, nowMs: number): Member | null {
  if (!isBeingWritten(d, nowMs) || !d.drafting_member) return null;
  return n.members.get(d.drafting_member) ?? null;
}
