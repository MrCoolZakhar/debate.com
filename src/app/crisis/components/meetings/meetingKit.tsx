'use client';
// Gavelling Crisis: shared pieces of the Meetings page (status look, people lookup, avatar stack).

import { useMemo, useState, type ReactNode } from 'react';
import { Ban, CalendarCheck, Check, CircleCheck, Hourglass, Users, X, XCircle, type LucideIcon } from 'lucide-react';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { crisisError, respondMeeting, type CrisisRef } from '@/lib/crisis/api';
import type { Cabinet, Character, Meeting, MeetingStatus, Member } from '@/lib/crisis/types';
import { Avatar, Btn, CK } from '../../crisisKit';
import { useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import { CharacterName } from '../character/CharacterProfileHost';

/** A meeting row as the database now sends it: while the others are asked first it also carries the time it moves on by itself. */
export type MeetingX = Meeting & { delegates_due_at?: string | null };
/** One invited character's answer. */
export interface MeetingResponse { meeting_id: string; character_id: string; response: 'accepted' | 'declined'; responded_at: string }

/** The character this delegate plays right now. The member row is kept live by the core, so a new character (a spare given by
 *  the crisis team) shows without a reload. */
export function useMyCharacterId(): string | null {
  const { memberId, characterId, core } = useCrisis();
  const member = core.members.find((m) => m.id === memberId);
  return member ? member.character_id : characterId;
}

export interface Person { id: string; name: string; picture_url: string | null; cabinet_id: string | null; status?: string }

export const STATUS_LOOK: Record<MeetingStatus, { Icon: LucideIcon; color: string }> = {
  awaiting_delegates: { Icon: Users, color: CK.warn },
  pending: { Icon: Hourglass, color: CK.warn },
  approved: { Icon: CalendarCheck, color: CK.ok },
  held: { Icon: CircleCheck, color: CK.forest },
  declined: { Icon: XCircle, color: CK.danger },
  cancelled: { Icon: Ban, color: CK.muted },
};

export const DURATIONS = [5, 10, 15, 20, 30] as const;
export const WHEN_NEXT = 'Next unmoderated caucus';
export const WHEN_NOW = 'Now';

export function whenText(m: Meeting): string {
  return m.wanted_time && m.wanted_time.trim() ? m.wanted_time : 'Not said';
}

/** Everyone a meeting page can name: the viewer's characters plus the world list. */
export function usePeople(characters: Character[], world: Person[]): Map<string, Person> {
  return useMemo(() => {
    const map = new Map<string, Person>();
    for (const w of world) map.set(w.id, w);
    for (const c of characters) map.set(c.id, { id: c.id, name: c.name, picture_url: c.picture_url, cabinet_id: c.cabinet_id, status: c.status });
    return map;
  }, [characters, world]);
}

export function requesterName(m: Meeting, people: Map<string, Person>, members: Member[]): string {
  if (m.requested_by_character) {
    const p = people.get(m.requested_by_character);
    if (p) return p.name;
  }
  return members.find((x) => x.id === m.requested_by_member)?.display_name ?? 'Someone';
}

export function cabinetColor(cabinets: Cabinet[], id: string | null): string {
  return cabinets.find((c) => c.id === id)?.color ?? CK.red;
}

/** Overlapping portraits. The disc is never clipped by this row. */
export function AvatarStack({ ids, people, cabinets, size = 46 }: { ids: string[]; people: Map<string, Person>; cabinets: Cabinet[]; size?: number }) {
  return (
    <span className="inline-flex" style={{ paddingLeft: 4 }}>
      {ids.map((id, i) => {
        const p = people.get(id);
        return (
          <span key={id} style={{ marginLeft: i === 0 ? 0 : -Math.round(size * 0.28), position: 'relative', zIndex: ids.length - i, lineHeight: 0 }}>
            <Avatar name={p?.name ?? '?'} src={p?.picture_url} size={size} color={cabinetColor(cabinets, p?.cabinet_id ?? null)} style={{ boxShadow: '0 0 0 2px #fff, 0 4px 12px rgba(27,56,40,0.18)' }} />
          </span>
        );
      })}
    </span>
  );
}

export function StatusLine({ status }: { status: MeetingStatus }) {
  const { Icon, color } = STATUS_LOOK[status];
  const label = { awaiting_delegates: 'Asking the others', pending: 'Waiting for approval', approved: 'Approved', held: 'Held', declined: 'Declined', cancelled: 'Cancelled' }[status];
  return (
    <span className="inline-flex items-center gap-1.5" style={{ color, fontSize: 12.5, fontWeight: 800 }}>
      <Icon size={15} strokeWidth={1.5} aria-hidden />{label}
    </span>
  );
}

export function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ minWidth: 0 }}>
      <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: CK.muted }}>{label}</p>
      <p style={{ margin: '1px 0 0', fontSize: 13.5, fontWeight: 600, color: CK.ink, overflowWrap: 'anywhere' }}>{children}</p>
    </div>
  );
}

export function NameList({ ids, people }: { ids: string[]; people: Map<string, Person> }) {
  return (
    <>
      {ids.map((id, i) => (
        <span key={id}>{i > 0 ? ', ' : ''}<CharacterName id={id} name={people.get(id)?.name ?? 'Unknown'} /></span>
      ))}
    </>
  );
}

/** The time a meeting still asking the others moves on by itself, as a clock time (empty when unknown). */
export function dueClock(m: MeetingX): string {
  if (!m.delegates_due_at) return '';
  const d = new Date(m.delegates_due_at);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

/** Accept and Decline for one invitation. The database refuses an answer to a meeting that was already decided. */
export function InviteButtons({ refx, meetingId, onAnswered, size = 'sm' }: { refx: CrisisRef; meetingId: string; onAnswered: () => void; size?: 'sm' | 'md' }) {
  const [busy, setBusy] = useState<null | 'accept' | 'decline'>(null);
  const answer = async (accept: boolean) => {
    if (busy) return;
    setBusy(accept ? 'accept' : 'decline');
    try {
      const r = await respondMeeting(refx, meetingId, accept);
      if (!r.ok) notifyErr('This meeting was already decided', 'crisis-meeting');
      else notifyOk(accept ? 'You accepted the meeting' : 'You declined the meeting', 'crisis-meeting');
      onAnswered();
    } catch (e) {
      notifyErr(crisisError(e, 'Could not save your answer. Try again.'), 'crisis-meeting');
    } finally { setBusy(null); }
  };
  return (
    <div className="flex flex-wrap" style={{ gap: 8 }}>
      <Btn tone="green" size={size} icon={<Check size={size === 'sm' ? 14 : 16} strokeWidth={1.6} aria-hidden />} disabled={!!busy} onClick={() => answer(true)}>{busy === 'accept' ? 'Accepting' : 'Accept'}</Btn>
      <Btn tone="danger" size={size} icon={<X size={size === 'sm' ? 14 : 16} strokeWidth={1.6} aria-hidden />} disabled={!!busy} onClick={() => answer(false)}>{busy === 'decline' ? 'Declining' : 'Decline'}</Btn>
    </div>
  );
}

/** For a meeting still asking the others: who accepted, who has not answered yet, and when it moves on by itself. */
export function AnswerList({ m, responses, people, cabinets }: { m: MeetingX; responses: MeetingResponse[] | null; people: Map<string, Person>; cabinets: Cabinet[] }) {
  const due = dueClock(m);
  return (
    <div style={{ marginTop: 12, background: CK.well, borderRadius: 14, padding: '10px 12px' }}>
      <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: CK.inkSoft }}>Answers so far</p>
      <ul style={{ margin: '6px 0 0', padding: 0 }}>
        {m.character_ids.map((id) => {
          const r = responses?.find((x) => x.meeting_id === m.id && x.character_id === id)?.response ?? null;
          const look = r === 'accepted' ? { Icon: Check, color: CK.ok, word: 'Accepted' } : r === 'declined' ? { Icon: X, color: CK.danger, word: 'Declined' } : { Icon: Hourglass, color: CK.warn, word: responses === null ? 'Loading' : 'Has not answered yet' };
          return (
            <li key={id} className="flex items-center flex-wrap" style={{ listStyle: 'none', gap: 8, padding: '3px 0' }}>
              <AvatarStack ids={[id]} people={people} cabinets={cabinets} size={26} />
              <span style={{ fontSize: 13, fontWeight: 700, color: CK.ink, overflowWrap: 'anywhere', flex: '1 1 120px', minWidth: 0 }}><CharacterName id={id} name={people.get(id)?.name ?? 'Unknown'} /></span>
              <span className="inline-flex items-center" style={{ gap: 5, fontSize: 12.5, fontWeight: 800, color: look.color }}><look.Icon size={14} strokeWidth={1.6} aria-hidden />{look.word}</span>
            </li>
          );
        })}
      </ul>
      <p style={{ margin: '8px 0 0', fontSize: 12.5, color: CK.inkSoft }}>
        {due ? `It goes to the crisis team on its own at ${due}.` : 'It goes to the crisis team on its own after 5 minutes.'}
      </p>
    </div>
  );
}
