'use client';
// Gavelling Crisis: the backroom's "to reply" lanes hold more than directives (owner, 1 Nov 2026). Beside the directives, in the same
// lanes and the same order, they hold
//   - meeting requests waiting for a staff yes or no ('pending'), and the ones still asking the others ('awaiting_delegates', greyed),
//   - a delegate whose character died, was arrested or went missing and who needs a new one (at the very TOP, it blocks the delegate).
// This file is the data side: the item types, which lane an item belongs to, the filters, the merge into one ordered queue and the
// live read of the meetings. The cards are in InboxExtraCards.tsx. Nothing here writes.

import { useCallback, useEffect, useState } from 'react';
import { listMeetings, type CrisisRef } from '@/lib/crisis/api';
import { useCrisisLive } from '@/lib/crisis/live';
import type { Character, Directive, Meeting, Member } from '@/lib/crisis/types';
import { isGoneStatus } from '../character/SpareOffer';
import { isCabinetDirective } from './cabinetStamp';
import type { Filters, Lane, Names, QueueOrder } from './directiveKit';

/** A meeting request in the lanes. `owners` are the backroomers who look after any character in it. */
export interface MeetingItem { extra: 'meeting'; id: string; m: Meeting; owners: string[]; cabinetIds: string[] }
/** A delegate who needs a new character; `char` is the one they play now (gone). */
export interface SpareItem { extra: 'spare'; id: string; member: Member; char: Character; owners: string[]; cabinetIds: string[] }
export type InboxExtra = MeetingItem | SpareItem;
/** What the reader shows: a directive or one of the extras. */
export type ReaderItem = Directive | InboxExtra;

export const isExtra = (x: ReaderItem): x is InboxExtra => 'extra' in x;
export const isDirectiveItem = (x: ReaderItem): x is Directive => !('extra' in x);

/** The meetings the lanes list: waiting for approval, and still asking the others. Live. null while the first read runs. */
export function useInboxMeetings(ref: CrisisRef, enabled: boolean): { meetings: Meeting[] | null; reload: () => Promise<void> } {
  const [meetings, setMeetings] = useState<Meeting[] | null>(null);
  const reload = useCallback(async () => {
    if (!enabled) return;
    try {
      const all = await listMeetings(ref);
      setMeetings(all.filter((m) => m.status === 'pending' || m.status === 'awaiting_delegates'));
    } catch {
      // A failed re-read keeps what is on screen; the next ping tries again.
    }
  }, [ref, enabled]);
  useEffect(() => {
    const t = window.setTimeout(() => { void reload(); }, 0);
    return () => window.clearTimeout(t);
  }, [reload]);
  useCrisisLive(enabled ? ref.id : null, ['crisis_meetings'], () => { void reload(); });
  return { meetings, reload };
}

const uniq = <T,>(xs: Array<T | null | undefined>): T[] => [...new Set(xs.filter((x): x is T => x !== null && x !== undefined))];

/** Every extra the lanes show right now. */
export function buildExtras(meetings: Meeting[] | null, characters: Character[], members: Member[]): InboxExtra[] {
  const byId = new Map(characters.map((c) => [c.id, c]));
  const out: InboxExtra[] = [];
  for (const m of meetings ?? []) {
    const chars = uniq([m.requested_by_character, ...m.character_ids]).map((id) => byId.get(id)).filter((c): c is Character => !!c);
    out.push({ extra: 'meeting', id: m.id, m, owners: uniq(chars.map((c) => c.owner_member_id)), cabinetIds: uniq(chars.map((c) => c.cabinet_id)) });
  }
  for (const member of members) {
    if (member.role !== 'delegate' || !member.character_id) continue;
    const char = byId.get(member.character_id);
    if (!char || !isGoneStatus(char.status)) continue;
    out.push({ extra: 'spare', id: `spare:${member.id}`, member, char, owners: uniq([char.owner_member_id]), cabinetIds: uniq([char.cabinet_id]) });
  }
  return out;
}

/**
 * Which lane an extra belongs to: Mine when one of its characters is looked after by you, Unassigned when nobody looks after any of
 * them, All open always. Never in Waiting for delegate or Answered.
 */
export function extraInLane(x: InboxExtra, lane: Lane, memberId: string | null): boolean {
  switch (lane) {
    case 'mine': return !!memberId && x.owners.includes(memberId);
    case 'unclaimed': return x.owners.length === 0;
    case 'open': return true;
    default: return false;
  }
}

/** The filters on the page, applied to an extra. A theme or a kind filter hides them (they have neither). */
export function extraMatchesFilters(x: InboxExtra, f: Filters, n: Names): boolean {
  if (f.theme || f.kind) return false;
  if (f.cabinet && !x.cabinetIds.includes(f.cabinet)) return false;
  if (f.backroomer === 'none' ? x.owners.length > 0 : f.backroomer && !x.owners.includes(f.backroomer)) return false;
  const q = f.search.trim().toLowerCase();
  if (q) {
    const name = (id: string | null | undefined) => (id ? n.characters.get(id)?.name ?? '' : '');
    const hay = x.extra === 'meeting'
      ? `meeting request ${x.m.intention} ${name(x.m.requested_by_character)} ${x.m.character_ids.map(name).join(' ')}`
      : `new character ${x.member.display_name} ${x.char.name}`;
    if (!hay.toLowerCase().includes(q.replace(/^#/, ''))) return false;
  }
  return true;
}

/**
 * One queue: characters that need replacing first, then the cabinet directives (they lead every lane, newest first), then the rest of
 * the directives and the meeting requests together by how long they have waited (Fair, Oldest) or newest first (Newest).
 */
export function mergeInbox(directives: Directive[], extras: InboxExtra[], order: QueueOrder): ReaderItem[] {
  if (extras.length === 0) return directives;
  const spares = extras.filter((x): x is SpareItem => x.extra === 'spare').sort((a, b) => a.member.display_name.localeCompare(b.member.display_name));
  const meetings = extras.filter((x): x is MeetingItem => x.extra === 'meeting');
  let split = 0;
  while (split < directives.length && isCabinetDirective(directives[split])) split += 1;
  const head = directives.slice(0, split);
  const rest = directives.slice(split);

  const time = (iso: string) => new Date(iso).getTime();
  const newestFirst = order === 'newest';
  const dKey = (d: Directive) => time(order === 'fair' ? d.waiting_since : d.created_at);
  const ms = [...meetings].sort((a, b) => (newestFirst ? time(b.m.created_at) - time(a.m.created_at) : time(a.m.created_at) - time(b.m.created_at)));
  const merged: ReaderItem[] = [];
  let i = 0; let j = 0;
  while (i < rest.length || j < ms.length) {
    if (j >= ms.length) { merged.push(rest[i++]); continue; }
    if (i >= rest.length) { merged.push(ms[j++]); continue; }
    const dt = dKey(rest[i]); const mt = time(ms[j].m.created_at);
    const takeMeeting = newestFirst ? mt > dt : mt < dt;
    merged.push(takeMeeting ? ms[j++] : rest[i++]);
  }
  return [...spares, ...head, ...merged];
}
