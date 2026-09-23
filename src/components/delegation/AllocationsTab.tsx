'use client';

// Allocations: the block seats the organiser gave this delegation, committee by
// committee, each with its country and who sits in it. Leaders (head delegate or
// faculty advisor) seat and unseat their own delegates through
// `delegation_assign_seat`; they can never create a seat.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Armchair, Check, Search, UserPlus, X, ArrowLeftRight } from 'lucide-react';
import { NEU, OUTFIT } from '@/components/neu';
import Portal from '@/components/Portal';
import { CircleFlag } from '@/components/CircleFlag';
import {
  canHoldSeat, committeeDisplay, isLive, seatsByCommittee,
  type PortalCommittee, type PortalData, type PortalMember, type PortalSeat,
} from './portalModel';
import { CommitteeHeading, Panel, PanelTitle, PersonAvatar, QuietButton, SeatMark } from './portalUi';

export function AllocationsTab({ data, busySeatId, onAssign }: {
  data: PortalData;
  busySeatId: string | null;
  onAssign: (seat: PortalSeat, member: PortalMember | null) => void;
}) {
  const groups = useMemo(() => seatsByCommittee(data), [data]);
  const committees = useMemo(() => new Map(data.committees.map((c) => [c.id, c])), [data.committees]);
  const seatable = data.members.filter(canHoldSeat).sort((a, b) => a.name.localeCompare(b.name));
  const blockAppIds = new Set(data.seats.map((s) => s.application_id).filter(Boolean) as string[]);
  const seatLabel = new Map<string, string>();
  for (const m of data.members) {
    if (m.assigned_country_name) {
      const c = m.assigned_committee_id ? committees.get(m.assigned_committee_id) : null;
      seatLabel.set(m.id, `${m.assigned_country_name}${c ? ` · ${committeeDisplay(c).primary}` : ''}`);
    }
  }
  const unseated = seatable.filter((m) => !m.assigned_country_name);
  const directlySeated = data.members.filter((m) => isLive(m) && m.assigned_country_name && !blockAppIds.has(m.id));
  const filled = data.seats.filter((s) => s.application_id || s.user_id).length;

  return (
    <div className="flex flex-col gap-4">
      <Panel tone="wash" style={{ padding: '14px 16px' }}>
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
          <p style={{ fontFamily: OUTFIT, fontSize: 14, color: NEU.ink }}>
            <span style={{ fontSize: 22, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{filled}</span>
            <span style={{ color: NEU.inkSoft }}> of {data.seats.length} seats filled</span>
          </p>
          <p style={{ fontFamily: OUTFIT, fontSize: 14, color: NEU.ink }}>
            <span style={{ fontSize: 22, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{unseated.length}</span>
            <span style={{ color: NEU.inkSoft }}> {unseated.length === 1 ? 'delegate' : 'delegates'} without a seat</span>
          </p>
        </div>
        {unseated.length > 0 && (
          <div className="flex flex-wrap gap-x-4 gap-y-2 mt-3">
            {unseated.map((m) => (
              <span key={m.id} className="inline-flex items-center gap-2">
                <PersonAvatar name={m.name} url={m.avatar_url} size={24} />
                <span style={{ fontFamily: OUTFIT, fontSize: 13.5, fontWeight: 600, color: NEU.ink }}>{m.name}</span>
              </span>
            ))}
          </div>
        )}
      </Panel>

      {groups.length === 0 ? (
        <Panel>
          <PanelTitle icon={Armchair} title="No seats yet" sub="The organiser has not given your delegation any seats yet. They appear here, committee by committee, once they do." />
        </Panel>
      ) : groups.map(({ committee, seats }) => {
        const full = seats.filter((s) => s.holder).length;
        return (
          <Panel key={committee?.id ?? seats[0].seat.committee_id} style={{ padding: '16px 16px 6px' }}>
            <CommitteeHeading
              committee={committee}
              aside={<span style={{ fontFamily: OUTFIT, fontSize: 13, color: NEU.inkSoft, whiteSpace: 'nowrap' }}><b style={{ color: NEU.ink, fontSize: 15, fontVariantNumeric: 'tabular-nums' }}>{full}</b> of {seats.length}</span>}
            />
            <ul className="mt-3">
              {seats.map(({ seat, holder }) => (
                <li key={seat.id} className="flex flex-wrap items-center gap-x-4 gap-y-2" style={{ padding: '12px 0', borderTop: NEU.hairline, opacity: busySeatId === seat.id ? 0.55 : 1 }}>
                  <div className="flex items-center gap-3 min-w-0" style={{ flex: '1 1 180px' }}>
                    <CircleFlag code={seat.country_code} country={seat.country_name} size={34} decorative />
                    <div className="min-w-0">
                      <p className="truncate" style={{ fontFamily: OUTFIT, fontSize: 15, fontWeight: 700, color: NEU.ink }}>{seat.country_name}</p>
                      {seat.seat && seat.seat > 1 && <p style={{ fontFamily: OUTFIT, fontSize: 12, color: NEU.inkSoft }}>Seat {seat.seat}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 min-w-0" style={{ flex: '1 1 180px' }}>
                    {holder ? (
                      <>
                        <PersonAvatar name={holder.name} url={holder.avatar_url} size={28} />
                        <span className="truncate" style={{ fontFamily: OUTFIT, fontSize: 14, fontWeight: 600, color: NEU.ink }}>{holder.name}</span>
                      </>
                    ) : (
                      <span style={{ fontFamily: OUTFIT, fontSize: 14, color: NEU.inkSoft }}>Empty seat</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <AssignPicker members={seatable} seatLabel={seatLabel} currentId={holder?.id ?? null}
                      busy={busySeatId === seat.id} onPick={(m) => onAssign(seat, m)} />
                    {holder && (
                      <QuietButton icon={X} danger ariaLabel={`Take ${holder.name} out of ${seat.country_name}`} title="Empty this seat"
                        disabled={busySeatId === seat.id} onClick={() => onAssign(seat, null)} />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        );
      })}

      {directlySeated.length > 0 && (
        <Panel style={{ padding: '16px 16px 6px' }}>
          <PanelTitle icon={Armchair} title="Seated by the organiser" sub="These members were given a seat directly. Only the organiser can change it." />
          <ul>
            {directlySeated.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-x-4 gap-y-2" style={{ padding: '12px 0', borderTop: NEU.hairline }}>
                <span className="inline-flex items-center gap-2 min-w-0" style={{ flex: '1 1 180px' }}>
                  <PersonAvatar name={m.name} url={m.avatar_url} size={28} />
                  <span className="truncate" style={{ fontFamily: OUTFIT, fontSize: 14, fontWeight: 600, color: NEU.ink }}>{m.name}</span>
                </span>
                <span className="min-w-0" style={{ flex: '1 1 180px' }}>
                  <SeatMark committee={m.assigned_committee_id ? committees.get(m.assigned_committee_id) as PortalCommittee : null} countryName={m.assigned_country_name} countryCode={m.assigned_country_code} />
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}

// Seat picker, portaled at fixed coordinates and flipped near the edges.
function AssignPicker({ members, seatLabel, currentId, busy, onPick }: {
  members: PortalMember[];
  seatLabel: Map<string, string>;
  currentId: string | null;
  busy: boolean;
  onPick: (m: PortalMember) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const btn = useRef<HTMLButtonElement | null>(null);
  const menu = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const W = 300;
  const H = 360;

  const place = useCallback(() => {
    const b = btn.current;
    if (!b) return;
    const r = b.getBoundingClientRect();
    const below = window.innerHeight - r.bottom;
    const flip = below < H + 16 && r.top > below;
    const left = Math.max(8, Math.min(r.right - W, window.innerWidth - W - 8));
    setPos({ top: flip ? Math.max(8, r.top - H - 6) : r.bottom + 6, left });
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btn.current?.contains(t) || menu.current?.contains(t)) return;
      setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); btn.current?.focus(); } };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onEsc);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, place]);

  const needle = query.trim().toLowerCase();
  const listed = members.filter((m) => !needle || m.name.toLowerCase().includes(needle));

  return (
    <>
      <QuietButton
        icon={currentId ? ArrowLeftRight : UserPlus}
        disabled={busy}
        onClick={() => { if (!open) { setQuery(''); place(); } setOpen((o) => !o); }}
      >
        {currentId ? 'Change' : 'Seat someone'}
      </QuietButton>
      {open && pos && (
        <Portal>
          <div ref={menu} role="dialog" aria-label="Choose a delegate for this seat"
            style={{ position: 'fixed', top: pos.top, left: pos.left, width: W, maxHeight: H, zIndex: 9999, display: 'flex', flexDirection: 'column', backgroundColor: NEU.surface, border: NEU.hairline, borderRadius: 14, padding: 8, boxShadow: '0 12px 28px -12px rgba(27,56,40,0.28)' }}>
            {members.length > 6 && (
              <label className="flex items-center gap-2 mb-2" style={{ padding: '8px 10px', borderRadius: 10, backgroundColor: NEU.base, boxShadow: NEU.inSm }}>
                <Search size={14} strokeWidth={2.3} aria-hidden style={{ color: NEU.inkSoft }} />
                <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search delegates" aria-label="Search delegates"
                  className="flex-1 outline-none bg-transparent" style={{ fontFamily: OUTFIT, fontSize: 16, color: NEU.ink }} />
              </label>
            )}
            <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
              {listed.length === 0 ? (
                <p className="text-center py-5" style={{ fontFamily: OUTFIT, fontSize: 13, color: NEU.inkSoft }}>
                  {members.length === 0 ? 'No accepted delegates yet.' : 'Nobody matches.'}
                </p>
              ) : listed.map((m) => {
                const current = m.id === currentId;
                const elsewhere = !current ? seatLabel.get(m.id) : undefined;
                return (
                  <button key={m.id} type="button" onClick={() => { setOpen(false); if (!current) onPick(m); }}
                    className="w-full text-left flex items-center gap-2.5 focus:outline-none focus-visible:ring-2"
                    style={{ padding: '8px 8px', borderRadius: 10, border: 'none', background: current ? NEU.wash : 'transparent', cursor: 'pointer' }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = NEU.wash; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = current ? NEU.wash : 'transparent'; }}>
                    <PersonAvatar name={m.name} url={m.avatar_url} size={30} />
                    <span className="flex-1 min-w-0">
                      <span className="block truncate" style={{ fontFamily: OUTFIT, fontSize: 14, fontWeight: 700, color: NEU.ink }}>{m.name}</span>
                      <span className="block truncate" style={{ fontFamily: OUTFIT, fontSize: 12, color: elsewhere ? '#8A5A1E' : NEU.inkSoft }}>
                        {elsewhere ? `Already in ${elsewhere}` : 'No seat yet'}
                      </span>
                    </span>
                    {current && <Check size={16} strokeWidth={2.6} aria-hidden style={{ color: NEU.forest }} />}
                  </button>
                );
              })}
            </div>
          </div>
        </Portal>
      )}
    </>
  );
}
