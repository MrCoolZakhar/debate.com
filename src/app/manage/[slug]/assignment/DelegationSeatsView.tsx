'use client';

// "Give seats" (3C, docs/conferences/delegations.md): the organiser gives seats
// to delegations by tapping. Mounted by the assignment page for
// ?mode=delegation-seats[&society=<id>].
//
// Left: the conference's delegations, each with the paid spots still needing a
// seat. Right: the selected delegation's progress and a countries x committees
// grid. A free cell gives the whole slot (both seats of a double) as a block
// seat; tapping the delegation's own EMPTY block seat takes it back; a seat with
// a person on it is never taken back here. Optimistic first, then the write
// (delegationSeatWrites.ts); a refusal puts the cell back and says why.
//
// Reads are keyed on the user id and get their client at call time; a re-read
// never blanks the screen. Section access is the manage layout's gate, as for
// the rest of the assignment page.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { GoldWord } from '@/components/BrandHeading';
import { CircleFlag } from '@/components/CircleFlag';
import { useAuth } from '@/components/AuthProvider';
import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { friendlyError } from '@/lib/friendlyError';
import { notifyErr } from '@/lib/appNotify';
import { replaceUrlInPlace } from '@/lib/replaceUrlInPlace';
import { NEU, OUTFIT } from '@/components/neu';
import type { Conference } from '@/app/manage/[slug]/layout';
import type { FreeSlot } from '@/app/manage/[slug]/applications/delegations/societySeats';
import {
  buildGridRows, committeeEmblemSrc, committeeShort, initialsOf, orderRows, paidSpotsBySociety, rowOrderFor, seatsHeldBy,
  type GridAllocation, type GridCommittee, type GridRow, type GridSociety, type PaidApp, type SeatCell,
} from '@/app/manage/[slug]/assignment/delegationSeatsGrid';
import { giveSeats, takeBackSeats } from '@/app/manage/[slug]/assignment/delegationSeatWrites';

// ── Look ─────────────────────────────────────────────────────────────────────

const FOREST = '#1B3828';
const INK = NEU.ink;
const INK_SOFT = NEU.inkSoft;
const OWE = '#9A4A12';
const OTHER_BG = '#EFEAE0';
const OTHER_INK = '#6B6157';
const FREE_BORDER = '1.5px dashed rgba(27,56,40,0.35)';
const LIFT_SHADOW = '0 1px 2px rgba(27,56,40,0.08), 0 6px 16px rgba(27,56,40,0.08), 0 18px 44px rgba(27,56,40,0.12)';
const CARD: React.CSSProperties = { background: '#FFFFFF', borderRadius: 20, boxShadow: LIFT_SHADOW };
const TINTS = ['#DCE8F0', '#F3E9C9', '#E3EDE6', '#F6E2D8', '#EDE4F3', '#E8E1F0'];
const STROKE = 1.5;
const CELL_H = 44;

function tintFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return TINTS[h % TINTS.length];
}

function SocietyCrest({ society, size, selected }: { society: GridSociety; size: number; selected?: boolean }) {
  const [failed, setFailed] = useState<string | null>(null);
  if (society.logo_url && failed !== society.logo_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={society.logo_url}
        alt=""
        aria-hidden
        onError={() => setFailed(society.logo_url)}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, background: '#FFFFFF', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.08)' }}
      />
    );
  }
  return (
    <span
      aria-hidden
      className="inline-flex items-center justify-center flex-shrink-0 select-none"
      style={{
        width: size, height: size, borderRadius: '50%',
        background: selected ? FOREST : tintFor(society.id), color: selected ? '#FFFFFF' : FOREST,
        fontFamily: OUTFIT, fontWeight: 700, fontSize: Math.round(size * 0.32), lineHeight: 1,
      }}
    >
      {initialsOf(society.name)}
    </span>
  );
}

function CommitteeEmblem({ committee, size = 26 }: { committee: GridCommittee; size?: number }) {
  const primary = committeeEmblemSrc(committee);
  const [src, setSrc] = useState(primary);
  const [seen, setSeen] = useState(primary);
  if (primary !== seen) { setSeen(primary); setSrc(primary); }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      aria-hidden
      onError={() => { if (src !== '/logos/un.svg') setSrc('/logos/un.svg'); }}
      style={{ width: size, height: size, borderRadius: '50%', objectFit: 'contain', flexShrink: 0, background: '#FFFFFF', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.08)' }}
    />
  );
}

// ── Data ─────────────────────────────────────────────────────────────────────

async function pageAll<T>(
  run: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>,
): Promise<{ data: T[]; error: unknown }> {
  const PAGE = 1000;
  const out: T[] = [];
  for (let from = 0; from < 50_000; from += PAGE) {
    const { data, error } = await run(from, from + PAGE - 1);
    if (error) return { data: [], error };
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return { data: out, error: null };
}

const COMMITTEE_SELECT = `
  id, name, abbreviation, logo_url,
  committee_country_slots (id, country_code, country_name, delegation_size, is_observer, logo_url),
  conference_allocations (
    id, country_code, seat, society_id, application_id, user_id,
    profiles (display_name),
    applications:application_id (society_id, invited_name)
  )
`;

function cellKey(committeeId: string, code: string): string {
  return `${committeeId}:${code}`;
}

// ── View ─────────────────────────────────────────────────────────────────────

export default function DelegationSeatsView({ conference, initialSocietyId, onSingleDelegates }: {
  conference: Conference;
  initialSocietyId: string | null;
  onSingleDelegates: () => void;
}) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [societies, setSocieties] = useState<GridSociety[] | null>(null);
  const [committees, setCommittees] = useState<GridCommittee[]>([]);
  const [paid, setPaid] = useState<Map<string, number>>(new Map());
  const [loadFailed, setLoadFailed] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(initialSocietyId);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const busyRef = useRef<Set<string>>(new Set());
  const loadSeq = useRef(0);
  const loadedOnce = useRef(false);

  const load = useCallback(async () => {
    if (!userId) return;
    const seq = ++loadSeq.current;
    const c = await getFreshAuthedClient();
    if (!c || seq !== loadSeq.current) return;
    const [socRes, comRes, appRes, invRes] = await Promise.all([
      c.from('societies').select('id, name, logo_url').eq('conference_id', conference.id).order('name', { ascending: true }),
      c.from('conference_committees').select(COMMITTEE_SELECT).eq('conference_id', conference.id).order('name', { ascending: true }),
      pageAll<PaidApp>((from, to) => c.from('applications')
        .select('id, role, status, payment_status, self_paid, society_id')
        .eq('conference_id', conference.id)
        .not('society_id', 'is', null)
        .order('id', { ascending: true })
        .range(from, to)),
      pageAll<{ application_id: string | null }>((from, to) => c.from('invoices')
        .select('application_id')
        .eq('conference_id', conference.id)
        .eq('kind', 'pledge_spot')
        .eq('status', 'settled')
        .order('id', { ascending: true })
        .range(from, to)),
    ]);
    if (seq !== loadSeq.current) return;
    const err = socRes.error ?? comRes.error ?? appRes.error ?? invRes.error;
    if (err) {
      const msg = friendlyError(err, 'The seats could not be loaded.');
      // A re-read that fails keeps what is on screen; only a first load shows the failure.
      if (loadedOnce.current) notifyErr(msg, 'delegation-seats-load');
      else setLoadFailed(true);
      return;
    }
    loadedOnce.current = true;
    setLoadFailed(false);
    setSocieties((socRes.data ?? []) as GridSociety[]);
    setCommittees((comRes.data ?? []) as unknown as GridCommittee[]);
    setPaid(paidSpotsBySociety(appRes.data, invRes.data.map(r => r.application_id)));
  }, [userId, conference.id]);

  useEffect(() => {
    const t = setTimeout(() => { void load(); }, 0);
    return () => clearTimeout(t);
  }, [load]);

  const societyById = useMemo(() => new Map((societies ?? []).map(s => [s.id, s] as const)), [societies]);

  const summaries = useMemo(() => (societies ?? []).map(s => {
    const given = seatsHeldBy(committees, s.id);
    const paidSpots = paid.get(s.id) ?? 0;
    return { society: s, given, paid: paidSpots, need: Math.max(0, paidSpots - given) };
  }), [societies, committees, paid]);

  // The selection: the one in the URL when it exists, else the first delegation
  // that still needs seats, else the first. Adjusted during render.
  const effectiveId = useMemo(() => {
    if (selectedId && societyById.has(selectedId)) return selectedId;
    return (summaries.find(s => s.need > 0) ?? summaries[0])?.society.id ?? null;
  }, [selectedId, societyById, summaries]);
  const selected = effectiveId ? societyById.get(effectiveId) ?? null : null;
  const selectedSummary = summaries.find(s => s.society.id === effectiveId) ?? null;

  const rawRows = useMemo(() => buildGridRows(committees, effectiveId, societyById), [committees, effectiveId, societyById]);

  // Row order is taken once per selection, so rows never jump while seats are given.
  const [order, setOrder] = useState<{ id: string | null; codes: string[] } | null>(null);
  if (societies !== null && (order === null || order.id !== effectiveId)) {
    setOrder({ id: effectiveId, codes: rowOrderFor(rawRows) });
  }
  const rows = useMemo(() => orderRows(rawRows, order?.codes ?? []), [rawRows, order]);
  const hasDoubles = useMemo(() => committees.some(c => c.committee_country_slots.some(s => !s.is_observer && (s.delegation_size ?? 1) >= 2)), [committees]);

  const pick = useCallback((id: string) => {
    setSelectedId(id);
    const url = new URL(window.location.href);
    url.searchParams.set('mode', 'delegation-seats');
    url.searchParams.set('society', id);
    replaceUrlInPlace(url.pathname + url.search);
  }, []);

  const markBusy = useCallback((keys: string[], on: boolean) => {
    for (const k of keys) { if (on) busyRef.current.add(k); else busyRef.current.delete(k); }
    setBusy(new Set(busyRef.current));
  }, []);

  const give = useCallback(async (slots: FreeSlot[]) => {
    if (!selected) return;
    const keys = slots.map(s => cellKey(s.committeeId, s.countryCode));
    if (keys.length === 0 || keys.some(k => busyRef.current.has(k))) return;
    markBusy(keys, true);
    const societyId = selected.id;
    const temps: { committeeId: string; row: GridAllocation }[] = slots.flatMap(s => Array.from({ length: Math.max(1, s.size) }, (_, i) => ({
      committeeId: s.committeeId,
      row: {
        id: `temp-${crypto.randomUUID()}`, country_code: s.countryCode, seat: i + 1, society_id: societyId,
        application_id: null, user_id: null, profiles: null, applications: null,
      },
    })));
    const tempIds = new Set(temps.map(t => t.row.id));
    setCommittees(prev => prev.map(c => {
      const add = temps.filter(t => t.committeeId === c.id).map(t => t.row);
      return add.length ? { ...c, conference_allocations: [...c.conference_allocations, ...add] } : c;
    }));
    const r = await giveSeats({ conferenceId: conference.id, societyId, slots });
    if (!r.ok) {
      setCommittees(prev => prev.map(c => ({ ...c, conference_allocations: c.conference_allocations.filter(a => !tempIds.has(a.id)) })));
      notifyErr(r.error, 'delegation-seats');
    }
    // The real ids come from the re-read; the cells stay busy until it lands.
    await load();
    markBusy(keys, false);
  }, [selected, conference.id, load, markBusy]);

  const takeBack = useCallback(async (committeeId: string, code: string, allocationIds: string[]) => {
    if (!selected) return;
    const key = cellKey(committeeId, code);
    if (busyRef.current.has(key)) return;
    markBusy([key], true);
    const ids = new Set(allocationIds);
    const back = (committees.find(c => c.id === committeeId)?.conference_allocations ?? []).filter(a => ids.has(a.id));
    setCommittees(prev => prev.map(c => (c.id === committeeId
      ? { ...c, conference_allocations: c.conference_allocations.filter(a => !ids.has(a.id)) }
      : c)));
    const r = await takeBackSeats({ societyId: selected.id, allocationIds });
    if (!r.ok) {
      setCommittees(prev => prev.map(c => (c.id === committeeId
        ? { ...c, conference_allocations: [...c.conference_allocations.filter(a => !ids.has(a.id)), ...back] }
        : c)));
      notifyErr(r.error, 'delegation-seats');
    }
    await load();
    markBusy([key], false);
  }, [selected, committees, load, markBusy]);

  // ── Render ──

  const header = (
    <div className="flex items-end justify-between gap-4 flex-wrap">
      <h1 style={{ margin: 0, color: INK, fontFamily: OUTFIT, fontWeight: 600, fontSize: 'clamp(28px, 2.4vw, 36px)', letterSpacing: '-0.015em', lineHeight: 1.1 }}>
        Give <GoldWord>seats</GoldWord>
      </h1>
      <div role="tablist" aria-label="Who gets seats" className="inline-flex" style={{ gap: 2, padding: 3, borderRadius: 12, background: '#E3DCCB' }}>
        <button
          type="button" role="tab" aria-selected
          className="focus:outline-none"
          style={{ height: 36, padding: '0 14px', borderRadius: 9, border: 0, fontFamily: OUTFIT, fontSize: 14, fontWeight: 500, background: '#FFFFFF', color: INK, boxShadow: '0 1px 3px rgba(27,56,40,0.12)', cursor: 'default' }}
        >
          Delegations
        </button>
        <button
          type="button" role="tab" aria-selected={false}
          onClick={onSingleDelegates}
          className="focus:outline-none"
          style={{ height: 36, padding: '0 14px', borderRadius: 9, border: 0, fontFamily: OUTFIT, fontSize: 14, fontWeight: 500, background: 'transparent', color: INK_SOFT, cursor: 'pointer' }}
        >
          Single delegates
        </button>
      </div>
    </div>
  );

  const shell = (body: React.ReactNode) => (
    <div
      className="flex flex-col lg:h-[calc(100dvh-56px)] lg:min-h-[640px]"
      style={{ padding: 'clamp(20px, 2.4vw, 32px) clamp(16px, 3vw, 48px)', gap: 18, boxSizing: 'border-box' }}
    >
      {header}
      {body}
    </div>
  );

  if (loadFailed) {
    return shell(
      <div style={{ ...CARD, padding: 28 }} className="flex items-center justify-between gap-4 flex-wrap">
        <span style={{ fontFamily: OUTFIT, fontSize: 15, color: INK }}>The seats could not be loaded.</span>
        <button type="button" onClick={() => { void load(); }} className="focus:outline-none" style={primaryBtn}>Try again</button>
      </div>,
    );
  }

  if (societies === null) {
    return shell(
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row" style={{ gap: 22 }} aria-busy>
        <div className="animate-pulse" style={{ ...CARD, width: 300, minHeight: 320 }} />
        <div className="animate-pulse flex-1" style={{ ...CARD, minHeight: 420 }} />
      </div>,
    );
  }

  if (societies.length === 0) {
    return shell(
      <div style={{ ...CARD, padding: 28, fontFamily: OUTFIT, fontSize: 15, color: INK }}>
        No delegations yet. Head delegates and faculty advisors make one when they apply.
      </div>,
    );
  }

  const doneHref = `/manage/${conference.slug}/applications?view=delegations`;
  const progress = selectedSummary && selectedSummary.paid > 0 ? Math.min(1, selectedSummary.given / selectedSummary.paid) : 0;
  const cols = committees.length;
  const gridTemplate = `minmax(190px, 230px) repeat(${Math.max(1, cols)}, minmax(76px, 1fr))`;

  return shell(
    <div className="flex-1 min-h-0 flex flex-col lg:flex-row" style={{ gap: 22 }}>
      {/* Delegations */}
      <div className="flex flex-col lg:w-[300px] flex-none max-h-[320px] lg:max-h-none" style={{ ...CARD, padding: 16, gap: 4, minHeight: 0 }}>
        <span style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 500, color: INK_SOFT, padding: '4px 8px 8px' }}>
          Pick a delegation, then tap seats
        </span>
        <div className="flex flex-col overflow-y-auto" style={{ gap: 4, minHeight: 0 }}>
          {summaries.map(s => {
            const on = s.society.id === effectiveId;
            return (
              <button
                key={s.society.id}
                type="button"
                onClick={() => pick(s.society.id)}
                aria-pressed={on}
                className="focus:outline-none flex items-center text-left"
                style={{
                  gap: 12, padding: '10px 12px', borderRadius: 14, border: 0, cursor: 'pointer', fontFamily: OUTFIT,
                  background: on ? '#F5F8F5' : 'transparent', boxShadow: on ? `inset 0 0 0 1.5px ${FOREST}` : 'none',
                }}
              >
                <SocietyCrest society={s.society} size={40} selected={on} />
                <span className="flex flex-col flex-1 min-w-0" style={{ gap: 2 }}>
                  <span className="[overflow-wrap:anywhere]" style={{ fontSize: 15, fontWeight: 600, color: INK }}>{s.society.name}</span>
                  <span style={{ fontSize: 12, color: s.need > 0 ? OWE : INK_SOFT }}>
                    {s.need > 0
                      ? `${s.need} paid ${s.need === 1 ? 'spot still needs' : 'spots still need'} a seat`
                      : s.paid > 0 ? 'Every paid spot has a seat' : 'No paid spots yet'}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 min-w-0 min-h-0 flex flex-col" style={{ gap: 14 }}>
        {/* The selected delegation */}
        {selected && selectedSummary && (
          <div className="flex items-center flex-wrap" style={{ ...CARD, padding: '16px 20px', gap: 18 }}>
            <SocietyCrest society={selected} size={44} selected />
            <div className="flex flex-col flex-1" style={{ gap: 6, minWidth: 220 }}>
              <span className="[overflow-wrap:anywhere]" style={{ fontFamily: OUTFIT, fontSize: 16, fontWeight: 600, color: INK }}>
                {selected.name}{' '}
                <span style={{ fontWeight: 400, color: INK_SOFT }}>
                  {selectedSummary.paid > 0
                    ? `· ${selectedSummary.given} of ${selectedSummary.paid} paid spots have a seat`
                    : `· ${selectedSummary.given} ${selectedSummary.given === 1 ? 'seat' : 'seats'} given, no paid spots yet`}
                </span>
              </span>
              <div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={selectedSummary.paid}
                aria-valuenow={Math.min(selectedSummary.given, selectedSummary.paid)}
                aria-label="Paid spots with a seat"
                style={{ height: 8, borderRadius: 99, background: '#EAE4D6', overflow: 'hidden' }}
              >
                <div style={{ width: `${Math.round(progress * 100)}%`, height: '100%', background: FOREST, transition: 'width 200ms ease' }} />
              </div>
            </div>
            <span style={{ fontFamily: OUTFIT, fontSize: 14, color: INK_SOFT }}>Tap a free seat to give it, tap again to take it back</span>
            <Link href={doneHref} className="focus:outline-none" style={primaryBtn}>Done</Link>
          </div>
        )}

        {/* The grid */}
        <div className="flex-1 min-h-0 flex flex-col" style={{ ...CARD, padding: '18px 20px', gap: 10 }}>
          {rows.length === 0 || cols === 0 ? (
            <p style={{ margin: 0, fontFamily: OUTFIT, fontSize: 15, color: INK }}>
              No committee has countries yet. Add them on the{' '}
              <Link href={`/manage/${conference.slug}/committees`} className="focus:outline-none" style={{ color: FOREST, fontWeight: 700, textDecoration: 'underline' }}>Committees</Link>{' '}
              page.
            </p>
          ) : (
            <div className="flex-1 min-h-0 overflow-auto max-h-[70vh] lg:max-h-none" style={{ marginInline: -4, paddingInline: 4 }}>
              <div style={{ display: 'grid', gridTemplateColumns: gridTemplate, columnGap: 8, rowGap: 8, minWidth: 'min-content' }}>
                {/* Header row */}
                <div style={{ position: 'sticky', top: 0, left: 0, zIndex: 3, background: '#FFFFFF' }} />
                {committees.map(c => (
                  <div
                    key={c.id}
                    title={c.name}
                    className="flex flex-col items-center text-center"
                    style={{ position: 'sticky', top: 0, zIndex: 2, background: '#FFFFFF', gap: 5, paddingBottom: 8, justifyContent: 'flex-end' }}
                  >
                    <CommitteeEmblem committee={c} />
                    <span className="[overflow-wrap:anywhere]" style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 600, color: INK, lineHeight: 1.2 }}>{committeeShort(c)}</span>
                  </div>
                ))}

                {rows.map(r => (
                  <GridRowView
                    key={r.code}
                    row={r}
                    committees={committees}
                    selected={selected}
                    busy={busy}
                    onGive={give}
                    onTakeBack={takeBack}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Legend */}
          <div className="flex flex-wrap items-center" style={{ gap: '8px 20px', fontFamily: OUTFIT, fontSize: 12, color: INK_SOFT, paddingTop: 6 }}>
            {selected && (
              <span className="flex items-center" style={{ gap: 6 }}>
                <span style={{ width: 14, height: 14, borderRadius: 4, background: FOREST }} />
                <span className="[overflow-wrap:anywhere]">{selected.name}</span>
              </span>
            )}
            <span className="flex items-center" style={{ gap: 6 }}>
              <span style={{ width: 14, height: 14, borderRadius: 4, border: FREE_BORDER, boxSizing: 'border-box' }} />
              Free
            </span>
            <span className="flex items-center" style={{ gap: 6 }}>
              <span style={{ width: 14, height: 14, borderRadius: 4, background: OTHER_BG }} />
              Another delegation or a single delegate
            </span>
            {hasDoubles && <span>A seat marked 2 holds 2 delegates and counts as 2</span>}
          </div>
        </div>
      </div>
    </div>,
  );
}

const primaryBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 42, padding: '0 18px',
  borderRadius: 10, border: 0, color: '#FFFFFF', background: 'linear-gradient(180deg, #26503D, #1B3828)',
  fontFamily: OUTFIT, fontSize: 14, fontWeight: 600, cursor: 'pointer', textDecoration: 'none', whiteSpace: 'nowrap',
};

function GridRowView({ row, committees, selected, busy, onGive, onTakeBack }: {
  row: GridRow;
  committees: GridCommittee[];
  selected: GridSociety | null;
  busy: Set<string>;
  onGive: (slots: FreeSlot[]) => void;
  onTakeBack: (committeeId: string, code: string, allocationIds: string[]) => void;
}) {
  const freeIdle = row.freeSlots.filter(s => !busy.has(cellKey(s.committeeId, s.countryCode)));
  return (
    <>
      <div className="flex items-center" style={{ position: 'sticky', left: 0, zIndex: 1, background: '#FFFFFF', gap: 10, minWidth: 0, minHeight: CELL_H }}>
        <CircleFlag code={row.code} logoUrl={row.logoUrl} label={row.name} size={22} decorative />
        <span className="flex-1 [overflow-wrap:anywhere]" style={{ fontFamily: OUTFIT, fontSize: 14, fontWeight: 600, color: INK, lineHeight: 1.25 }}>{row.name}</span>
        {selected && freeIdle.length > 0 && (
          <button
            type="button"
            onClick={() => onGive(freeIdle)}
            aria-label={`Give every free ${row.name} seat to ${selected.name}`}
            className="focus:outline-none"
            style={{ border: 0, background: 'transparent', padding: '4px 2px', fontFamily: OUTFIT, fontSize: 12, fontWeight: 700, color: FOREST, textDecoration: 'underline', whiteSpace: 'nowrap', cursor: 'pointer' }}
          >
            Give row
          </button>
        )}
      </div>
      {row.cells.map((cell, i) => {
        const c = committees[i];
        return (
          <Cell
            key={c.id}
            cell={cell}
            committee={c}
            countryName={row.name}
            countryCode={row.code}
            selected={selected}
            isBusy={busy.has(cellKey(c.id, row.code))}
            onGive={onGive}
            onTakeBack={onTakeBack}
          />
        );
      })}
    </>
  );
}

function DoubleMark({ size, color }: { size: number; color: string }) {
  if (size < 2) return null;
  return <span aria-hidden style={{ fontSize: 10, fontWeight: 600, color, marginLeft: 4, opacity: 0.85 }}>{size}</span>;
}

function Cell({ cell, committee, countryName, countryCode, selected, isBusy, onGive, onTakeBack }: {
  cell: SeatCell;
  committee: GridCommittee;
  countryName: string;
  countryCode: string;
  selected: GridSociety | null;
  isBusy: boolean;
  onGive: (slots: FreeSlot[]) => void;
  onTakeBack: (committeeId: string, code: string, allocationIds: string[]) => void;
}) {
  const base: React.CSSProperties = {
    height: CELL_H, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: OUTFIT, fontSize: 12, fontWeight: 700, boxSizing: 'border-box', width: '100%',
    opacity: isBusy ? 0.6 : 1, cursor: isBusy ? 'progress' : undefined,
  };
  const where = `${countryName} in ${committeeShort(committee)}`;
  const seats = (n: number) => (n >= 2 ? `, ${n} seats` : '');

  if (cell.kind === 'none') return <div aria-hidden style={{ height: CELL_H }} />;

  if (cell.kind === 'free') {
    if (!selected) return <div title={`${where} is free`} style={{ ...base, border: FREE_BORDER, color: '#8FA597' }}><Plus size={16} strokeWidth={STROKE} aria-hidden /></div>;
    return (
      <button
        type="button"
        disabled={isBusy}
        onClick={() => onGive([cell.slot])}
        aria-label={`Give ${where} to ${selected.name}${seats(cell.size)}`}
        title={`Give ${where} to ${selected.name}`}
        className="focus:outline-none transition-transform active:scale-[0.97]"
        style={{ ...base, background: '#FFFFFF', border: FREE_BORDER, color: '#6F8A79', cursor: isBusy ? 'progress' : 'pointer' }}
      >
        <Plus size={16} strokeWidth={STROKE} aria-hidden />
        <DoubleMark size={cell.size} color="#6F8A79" />
      </button>
    );
  }

  if (cell.kind === 'mine' && selected) {
    const label = initialsOf(selected.name);
    if (cell.canTakeBack) {
      return (
        <button
          type="button"
          disabled={isBusy}
          onClick={() => onTakeBack(committee.id, countryCode, cell.allocationIds)}
          aria-label={`Take back ${where} from ${selected.name}${seats(cell.size)}`}
          title={`${selected.name}. Tap to take it back`}
          className="focus:outline-none transition-transform active:scale-[0.97]"
          style={{ ...base, border: 0, background: FOREST, color: '#FFFFFF', cursor: isBusy ? 'progress' : 'pointer' }}
        >
          {label}
          <DoubleMark size={cell.size} color="#FFFFFF" />
        </button>
      );
    }
    return (
      <div
        title={isBusy ? `${where}: saving` : `${selected.name}. A delegate sits here, so it stays with the delegation`}
        style={{ ...base, background: FOREST, color: '#FFFFFF' }}
      >
        {label}
        <DoubleMark size={cell.size} color="#FFFFFF" />
      </div>
    );
  }

  if (cell.kind === 'other') {
    return (
      <div title={`${where}: ${cell.holder}`} style={{ ...base, background: OTHER_BG, color: OTHER_INK }}>
        {cell.label}
        <DoubleMark size={cell.size} color={OTHER_INK} />
      </div>
    );
  }

  return <div aria-hidden style={{ height: CELL_H }} />;
}
