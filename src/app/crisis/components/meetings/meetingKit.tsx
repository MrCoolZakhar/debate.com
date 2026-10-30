'use client';
// Gavelling Crisis: shared pieces of the Meetings page (status look, people lookup, avatar stack).

import { useMemo, type ReactNode } from 'react';
import { Ban, CalendarCheck, CircleCheck, Hourglass, XCircle, type LucideIcon } from 'lucide-react';
import type { Cabinet, Character, Meeting, MeetingStatus, Member } from '@/lib/crisis/types';
import { Avatar, CK } from '../../crisisKit';
import { CharacterName } from '../character/CharacterProfileHost';

export interface Person { id: string; name: string; picture_url: string | null; cabinet_id: string | null; status?: string }

export const STATUS_LOOK: Record<MeetingStatus, { Icon: LucideIcon; color: string }> = {
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
  const label = { pending: 'Waiting for approval', approved: 'Approved', held: 'Held', declined: 'Declined', cancelled: 'Cancelled' }[status];
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
