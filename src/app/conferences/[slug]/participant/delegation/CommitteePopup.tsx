'use client';

// "Open this committee" from a member's seat on the leader card: the
// committee's emblem and name, then EVERY possible allocation in it (owner,
// 21 Oct 2026: "the FULL country matrix"), countries A to Z, one row per seat
// (a double delegation's seats as Seat 1 / Seat 2): the round flag and the
// country, then who holds it:
//   * this delegation's people (the card's own rows): photo and name, the row
//     tinted as "Your delegation", the viewer's own seat marked "You";
//   * this delegation's open allocations: "Open allocation of your delegation";
//   * someone else whose allocation is published (my_committee_roster, which
//     sends names and schools but no photos: the avatar is their initials);
//   * someone else whose allocation is not published yet (get_committee_
//     occupancy counts it, nobody may read the name): "Taken";
//   * otherwise "Open".
// The slots come from committee/committeeSlots (committee_country_slots).
// An allocation on a country that is not a slot is listed too. A failed slot
// read falls back to the people known.
// PopupShell is the frame the member pop-up (member/MemberDetailsPopup) uses too.

import { useEffect, useMemo } from 'react';
import { X } from 'lucide-react';
import Portal from '@/components/Portal';
import { CircleFlag } from '@/components/CircleFlag';
import { SkeletonBlock } from '@/components/Skeleton';
import { committeeDisplayName } from '@/lib/presetNames';
import { DELEGATIONS_V2_DB } from './v2';
import { useCommitteeRoster, type CommitteeRosterRow } from './committee/committeeRoster';
import { useCommitteeSlots } from './committee/committeeSlots';
import { CommitteeDisc, FONT, INK, INK_SOFT, LIFT_SHADOW, LINE, RoundAvatar, STROKE } from './leaderKit';

export interface CommitteeSeatPerson {
  application_id: string;
  name: string;
  avatar_url: string | null;
  country_name: string | null;
  country_code: string | null;
  seatLogo: string | null;
  /** The viewer. */
  is_me?: boolean;
}

/** One of this delegation's open allocations in the committee. */
export interface CommitteeOpenSeat {
  country_code: string | null;
  country_name: string;
}

/** The pop-up frame: a dimmed page, a white card, a close button; Escape and an outside press close it. */
export function PopupShell({ label, onClose, width = 460, head, children }: {
  label: string;
  onClose: () => void;
  width?: number;
  /** The top row, beside the close button. */
  head: React.ReactNode;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <Portal>
      <div
        onClick={onClose}
        className="fixed inset-0 flex items-center justify-center"
        style={{ zIndex: 90, background: 'rgba(28,20,16,0.32)', padding: 16 }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label={label}
          onClick={(e) => e.stopPropagation()}
          style={{ width, maxWidth: '100%', maxHeight: 'calc(100vh - 32px)', overflowY: 'auto', background: '#FFFFFF', borderRadius: 20, boxShadow: LIFT_SHADOW, padding: 24 }}
        >
          <div className="flex items-start gap-4">
            <div className="min-w-0 flex-1">{head}</div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="inline-flex items-center justify-center flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gv-main)]"
              style={{ width: 44, height: 44, margin: -8, borderRadius: 10, border: 'none', background: 'transparent', color: INK, cursor: 'pointer' }}
            >
              <X size={20} strokeWidth={STROKE} aria-hidden />
            </button>
          </div>
          {children}
        </div>
      </div>
    </Portal>
  );
}

const sectionTitle: React.CSSProperties = { fontFamily: FONT, fontSize: 13, fontWeight: 500, color: INK_SOFT, margin: '22px 0 8px 0' };

const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });

const keyOf = (code: string | null | undefined, name: string | null | undefined) => {
  const c = (code ?? '').trim().toLowerCase();
  return c ? `c:${c}` : `n:${(name ?? '').trim().toLowerCase()}`;
};

type Holder =
  | { kind: 'own'; person: CommitteeSeatPerson }
  | { kind: 'other'; row: CommitteeRosterRow }
  | { kind: 'own-open' }
  | { kind: 'taken' }
  | { kind: 'open' };

interface Cell {
  key: string;
  country_code: string | null;
  country_name: string;
  logo: string | null;
  seat: number;
  size: number;
  holder: Holder;
}

/** The matrix: every slot's seats, filled with what is known about each. */
function buildCells(
  slots: { country_code: string | null; country_name: string; logo_url: string | null; size: number; taken: number }[],
  people: CommitteeSeatPerson[],
  others: CommitteeRosterRow[],
  openSeats: CommitteeOpenSeat[],
): Cell[] {
  const group = <T,>(xs: T[], k: (x: T) => string[]) => {
    const m = new Map<string, T[]>();
    for (const x of xs) {
      const keys = k(x);
      const hit = keys.find(kk => m.has(kk)) ?? keys[0];
      m.set(hit, [...(m.get(hit) ?? []), x]);
    }
    return m;
  };
  const keysFor = (code: string | null, name: string | null) => {
    const ks = [keyOf(code, name)];
    if ((code ?? '').trim()) ks.push(keyOf(null, name));
    return ks;
  };
  const ownBy = group(people.filter(p => p.country_name), p => keysFor(p.country_code, p.country_name));
  const otherBy = group(others, r => keysFor(r.country_code, r.country_name));
  const openBy = group(openSeats, o => keysFor(o.country_code, o.country_name));
  const take = <T,>(m: Map<string, T[]>, code: string | null, name: string): T[] => {
    const out: T[] = [];
    for (const k of keysFor(code, name)) {
      const xs = m.get(k);
      if (xs) { out.push(...xs); m.delete(k); }
    }
    return out;
  };

  const cells: Cell[] = [];
  const push = (code: string | null, name: string, logo: string | null, size: number, taken: number) => {
    const own = take(ownBy, code, name).sort((a, b) => collator.compare(a.name, b.name));
    const other = take(otherBy, code, name).sort((a, b) => collator.compare(a.seat ?? '1', b.seat ?? '1'));
    const open = take(openBy, code, name);
    const holders: Holder[] = [
      ...own.map(person => ({ kind: 'own', person }) as Holder),
      ...other.map(row => ({ kind: 'other', row }) as Holder),
      ...open.map(() => ({ kind: 'own-open' }) as Holder),
    ];
    const n = Math.max(size, holders.length);
    let hiddenTaken = Math.max(0, taken - holders.length);
    for (let i = 0; i < n; i++) {
      let h = holders[i];
      if (!h) {
        if (hiddenTaken > 0) { h = { kind: 'taken' }; hiddenTaken -= 1; } else h = { kind: 'open' };
      }
      cells.push({ key: `${keyOf(code, name)}-${i}`, country_code: code, country_name: name, logo, seat: i + 1, size: n, holder: h });
    }
  };
  for (const s of slots) push(s.country_code, s.country_name, s.logo_url, s.size, s.taken);
  // Allocations on a country that is not a slot.
  const leftovers = new Map<string, { code: string | null; name: string; logo: string | null }>();
  for (const xs of ownBy.values()) for (const p of xs) leftovers.set(keyOf(p.country_code, p.country_name), { code: p.country_code, name: p.country_name ?? '', logo: p.seatLogo });
  for (const xs of otherBy.values()) for (const r of xs) leftovers.set(keyOf(r.country_code, r.country_name), { code: r.country_code, name: r.country_name, logo: r.country_logo_url });
  for (const xs of openBy.values()) for (const o of xs) leftovers.set(keyOf(o.country_code, o.country_name), { code: o.country_code, name: o.country_name, logo: null });
  for (const l of leftovers.values()) if (l.name) push(l.code, l.name, l.logo, 0, 0);

  return cells.sort((a, b) => collator.compare(a.country_name, b.country_name) || a.seat - b.seat);
}

const YOURS_TINT = 'color-mix(in srgb, var(--gv-accent-light) 22%, transparent)';
const tag: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: 'color-mix(in srgb, var(--gv-accent) 72%, #1C1410)', marginLeft: 6 };

function HolderView({ h }: { h: Holder }) {
  if (h.kind === 'own') {
    const p = h.person;
    return (
      <span className="flex items-center gap-2.5 min-w-0">
        <RoundAvatar name={p.name} url={p.avatar_url} size={32} seed={p.application_id} />
        <span className="[overflow-wrap:anywhere] min-w-0" style={{ fontFamily: FONT, fontSize: 14, fontWeight: 600, color: INK, lineHeight: 1.3 }}>
          {p.name}
          {p.is_me && <span style={tag}>You</span>}
        </span>
      </span>
    );
  }
  if (h.kind === 'other') {
    const r = h.row;
    const name = r.display_name ?? 'Delegate';
    return (
      <span className="flex items-center gap-2.5 min-w-0">
        <RoundAvatar name={name} url={null} size={32} seed={`${r.country_name}-${r.seat ?? ''}-${name}`} />
        <span className="flex flex-col min-w-0" style={{ lineHeight: 1.3 }}>
          <span className="[overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 14, fontWeight: 600, color: INK }}>{name}</span>
          {r.society_name && <span className="[overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 12.5, color: INK_SOFT }}>{r.society_name}</span>}
        </span>
      </span>
    );
  }
  const word = h.kind === 'own-open' ? 'Open allocation of your delegation' : h.kind === 'taken' ? 'Taken' : 'Open';
  return (
    <span style={{ fontFamily: FONT, fontSize: 14, fontWeight: h.kind === 'open' ? 400 : 500, color: h.kind === 'open' ? INK_SOFT : INK, lineHeight: 1.3 }}>
      {word}
    </span>
  );
}

export default function CommitteePopup({ committeeId, name, abbreviation, emblem, people, openSeats = [], onClose }: {
  /** The conference committee; with it the full country matrix is listed. */
  committeeId?: string | null;
  name: string;
  abbreviation: string | null;
  emblem: string;
  /** This delegation's people in the committee. */
  people: CommitteeSeatPerson[];
  /** This delegation's open allocations in the committee. */
  openSeats?: CommitteeOpenSeat[];
  onClose: () => void;
}) {
  const roster = useCommitteeRoster(committeeId ?? null);
  const slots = useCommitteeSlots(committeeId ?? null);
  // A roster read that fails (no allocation of this delegation published here
  // yet) is no reason to hide the matrix: it is drawn without other names.
  const others = useMemo(() => (roster?.kind === 'ok' ? roster.rows.filter(r => !r.is_mine && !!r.display_name) : []), [roster]);
  const rosterSettled = !DELEGATIONS_V2_DB || roster !== null;
  const cells = useMemo(() => {
    if (!slots || !rosterSettled) return null;
    return buildCells(slots.kind === 'ok' ? slots.slots : [], people, others, openSeats);
  }, [slots, rosterSettled, people, others, openSeats]);

  const short = (abbreviation ?? '').trim() || committeeDisplayName(name, abbreviation);
  const showFull = name.trim() !== short.trim();

  let list: React.ReactNode;
  if (!committeeId) {
    list = null;
  } else if (cells === null) {
    list = (
      <div className="flex flex-col gap-2" aria-busy="true">
        {[0, 1, 2, 3, 4].map(i => <SkeletonBlock key={i} height={44} radius={10} />)}
      </div>
    );
  } else if (cells.length === 0) {
    list = <p style={{ fontFamily: FONT, fontSize: 14, color: INK_SOFT, margin: 0 }}>The organisers have not added countries to this committee yet.</p>;
  } else {
    list = (
      <div className="flex flex-col" style={{ gap: 2 }}>
        {cells.map((c, i) => {
          const yours = c.holder.kind === 'own' || c.holder.kind === 'own-open';
          const me = c.holder.kind === 'own' && c.holder.person.is_me === true;
          const firstOfCountry = i === 0 || keyOf(cells[i - 1].country_code, cells[i - 1].country_name) !== keyOf(c.country_code, c.country_name);
          return (
            <div
              key={c.key}
              className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] items-center gap-x-4 gap-y-1.5"
              style={{
                padding: '8px 10px', borderRadius: 10,
                borderTop: !firstOfCountry || i === 0 || yours ? 'none' : `1px solid ${LINE}`,
                background: yours ? YOURS_TINT : 'transparent',
                boxShadow: me ? 'inset 0 0 0 1.5px var(--gv-main)' : 'none',
              }}
            >
              <span className="flex items-center gap-3 min-w-0">
                <CircleFlag code={c.country_code} logoUrl={c.logo} label={c.country_name} size={30} decorative />
                <span className="flex flex-col min-w-0" style={{ lineHeight: 1.3 }}>
                  <span className="[overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 14.5, fontWeight: 600, color: INK }}>
                    {c.country_name}
                  </span>
                  {(c.size > 1 || yours) && (
                    <span className="[overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 12.5, color: INK_SOFT }}>
                      {[c.size > 1 ? `Seat ${c.seat}` : null, yours ? 'Your delegation' : null].filter(Boolean).join(' · ')}
                    </span>
                  )}
                </span>
              </span>
              <span className="min-w-0 pl-[42px] sm:pl-0">
                <HolderView h={c.holder} />
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <PopupShell
      label={name}
      onClose={onClose}
      width={560}
      head={(
        <div className="flex items-start gap-4">
          <CommitteeDisc src={emblem} size={56} />
          <div className="min-w-0 flex-1">
            <h2 className="[overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 22, fontWeight: 600, color: INK, margin: 0, lineHeight: 1.2 }}>{short}</h2>
            {showFull && <p className="[overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 14, color: INK_SOFT, margin: '3px 0 0 0' }}>{name}</p>}
          </div>
        </div>
      )}
    >
      <p style={sectionTitle}>Every Allocation</p>
      {list}
    </PopupShell>
  );
}
