'use client';
// Gavelling Crisis: "Needs Attention" on Crisis Command, a bento card under Front Rooms. It collects what the Crisis
// Director can act on right now: meeting requests waiting for a yes or no, the backroom rebalance suggestion, the oldest
// directive that has waited too long, cabinet directives still with their chair, and a room with no chair in it. When nothing needs attention it says so in one plain
// line. Every item is derived from what Command already reads (nothing extra is loaded except the pending meetings).

import { useMemo, useState } from 'react';
import { BellRing, CircleCheck, Clock, DoorOpen, Gavel } from 'lucide-react';
import { dirNumber } from '@/lib/crisis/format';
import type { CrisisRef } from '@/lib/crisis/api';
import type { Cabinet, Directive, Member } from '@/lib/crisis/types';
import { Btn, Card, CardTitle, CK, waitLabel } from '../../crisisKit';
import { isOpenStatus } from '../directives/directiveKit';
import { MeetingRequestRows, usePendingMeetings } from '../meetings/MeetingRequestsStrip';
import { beingWritten, type RoomState } from './commandData';
import { RebalanceRow, useRebalanceTip } from './commandRebalance';

/** A directive that has waited this long with nobody writing to it is worth a look. */
const LATE_MINUTES = 15;

function ItemRow({ icon, color, children, action }: { icon: React.ReactNode; color: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center" style={{ gap: 10, padding: '8px 0' }}>
      <span aria-hidden style={{ width: 30, height: 30, flex: 'none', display: 'grid', placeItems: 'center', color, background: `color-mix(in srgb, ${color} 13%, transparent)`, borderRadius: 10 }}>{icon}</span>
      <p style={{ margin: 0, flex: 1, minWidth: 0, fontSize: 13, color: CK.ink, lineHeight: 1.35, overflowWrap: 'anywhere' }}>{children}</p>
      {action}
    </div>
  );
}

export function NeedsAttentionCard({ cref, cabinets, members, directives, rooms, now, onOpenDirective, onChanged }: {
  cref: CrisisRef; cabinets: Cabinet[]; members: Member[]; directives: Directive[] | null; rooms: RoomState[] | null; now: number;
  onOpenDirective: (d: Directive) => void; onChanged: () => void;
}) {
  const { pending, reload } = usePendingMeetings(cref, true);
  const tip = useRebalanceTip(members, directives, now);

  const oldest = useMemo(() => {
    const waiting = (directives ?? []).filter((d) => isOpenStatus(d) && !beingWritten(d, now));
    const o = waiting.reduce<Directive | null>((a, d) => (a === null || new Date(d.waiting_since) < new Date(a.waiting_since) ? d : a), null);
    return o && (now - new Date(o.waiting_since).getTime()) / 60000 >= LATE_MINUTES ? o : null;
  }, [directives, now]);

  const noChair = useMemo(() => {
    const byCab = new Map((rooms ?? []).map((r) => [r.cabinetId, r]));
    return cabinets.filter((c) => {
      const live = byCab.get(c.id)?.live;
      return !!live?.session && live.session.chairNames.length === 0;
    });
  }, [rooms, cabinets]);

  // Cabinet directives the chair has not sent on yet. The backroom cannot see them, so this is the only place they show up.
  const [showChair, setShowChair] = useState(false);
  const withChair = useMemo(
    () => (directives ?? []).filter((d) => d.status === 'awaiting_chair').sort((a, b) => a.created_at.localeCompare(b.created_at)),
    [directives],
  );

  const meetings = pending ?? [];
  const count = meetings.length + (tip ? 1 : 0) + (oldest ? 1 : 0) + (withChair.length > 0 ? 1 : 0) + noChair.length;
  const loading = pending === null || directives === null;

  return (
    <Card className="cmd-card cmd-attn" style={{ display: 'flex', flexDirection: 'column' }}>
      <CardTitle
        icon={<BellRing size={17} strokeWidth={1.5} />}
        right={!loading && count > 0 ? (
          <span className="inline-flex items-baseline" style={{ gap: 5 }}>
            <b style={{ fontSize: 22, fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums', color: CK.ink }}>{count}</b>
            <span style={{ fontSize: 12, fontWeight: 600, color: CK.inkSoft }}>{count === 1 ? 'thing' : 'things'}</span>
          </span>
        ) : undefined}
      >
        Needs Attention
      </CardTitle>
      {loading ? null : count === 0 ? (
        <p className="flex items-center" style={{ gap: 8, margin: '2px 0 0', fontSize: 13.5, color: CK.inkSoft }}>
          <CircleCheck size={16} strokeWidth={1.5} aria-hidden style={{ color: CK.ok, flex: 'none' }} />
          Nothing needs your attention right now.
        </p>
      ) : (
        <div style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto' }}>
          {meetings.length > 0 && <MeetingRequestRows pending={meetings} compact now={now} onDecided={() => { void reload(); }} />}
          {tip && <div style={{ borderTop: meetings.length ? `1px solid ${CK.hair}` : 0 }}><RebalanceRow cref={cref} tip={tip} onChanged={onChanged} /></div>}
          {oldest && (
            <div style={{ borderTop: meetings.length || tip ? `1px solid ${CK.hair}` : 0 }}>
              <ItemRow
                icon={<Clock size={17} strokeWidth={1.5} />}
                color={CK.danger}
                action={<Btn size="sm" tone="ghost" onClick={() => onOpenDirective(oldest)}>Open</Btn>}
              >
                <b>No. {dirNumber(oldest)}</b> has waited {waitLabel(oldest.waiting_since, now)} for a reply
              </ItemRow>
            </div>
          )}
          {withChair.length > 0 && (
            <div style={{ borderTop: meetings.length || tip || oldest ? `1px solid ${CK.hair}` : 0 }}>
              <ItemRow
                icon={<Gavel size={17} strokeWidth={1.5} />}
                color="#7B3F61"
                action={<Btn size="sm" tone="ghost" onClick={() => setShowChair((o) => !o)}>{showChair ? 'Hide' : 'Show'}</Btn>}
              >
                <b>{withChair.length}</b> cabinet {withChair.length === 1 ? 'directive is' : 'directives are'} with the chair
              </ItemRow>
              {showChair && (
                <ul style={{ listStyle: 'none', margin: '0 0 6px', padding: '0 0 0 40px' }}>
                  {withChair.map((d) => {
                    const cab = cabinets.find((c) => c.id === d.cabinet_id);
                    return (
                      <li key={d.id}>
                        <button
                          type="button"
                          onClick={() => onOpenDirective(d)}
                          className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
                          style={{ border: 0, background: 'transparent', padding: '3px 0', cursor: 'pointer', textAlign: 'left', fontFamily: CK.font, fontSize: 12.5, fontWeight: 700, color: CK.forest, textDecoration: 'underline', overflowWrap: 'anywhere' }}
                        >
                          No. {dirNumber(d)}: {d.title}{cab ? `, ${cab.short_name || cab.name}` : ''}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
          {noChair.map((c, i) => (
            <div key={c.id} style={{ borderTop: meetings.length || tip || oldest || withChair.length > 0 || i > 0 ? `1px solid ${CK.hair}` : 0 }}>
              <ItemRow icon={<DoorOpen size={17} strokeWidth={1.5} />} color={CK.goldDeep}>
                <b>{c.short_name || c.name}</b> has no chair in its committee room
              </ItemRow>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
