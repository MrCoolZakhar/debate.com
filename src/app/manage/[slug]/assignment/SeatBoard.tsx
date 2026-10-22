'use client';

// ── The seat board (owner, 21 Oct 2026) ──────────────────────────────────────
// The Assignment page's main view for delegates, in three columns:
//   LEFT    the people still waiting (oldest accepted first) and the
//           delegations, each column scrolling inside itself;
//   MIDDLE  the only part that scrolls with content: "Smart Allocations"
//           (centred, with the general "How smart allocations are scored"
//           hint), white cards with a gold edge (the person: avatar with the
//           nationality flag on its border, "Name, 17", the delegation
//           beneath; the gold score disc, "How this scores" on hover; the
//           seat on an ivory well with a soft Assign; one row of reason
//           badges), or one person opened in place with their level, where
//           they are from and their best three seats;
//   RIGHT   the committees as fill rings; a click (or a person dropped on one)
//           opens that committee's pop-up: the classic board's own pop-up
//           (CommitteeDetailModal.tsx, owned by the page; owner, 22 Oct
//           2026), whose open seats read "Seat <First name>" while a person
//           is open here or was dropped on the ring.
// Every Assign goes through the page's own assign path (`onAssign` is
// requestQuickAssign), so the writes, the optimistic board, the first-assign
// pop-up and the allocation email rules are exactly the classic board's.
// Scores come from src/lib/assignmentFit.ts. Nothing here reads or writes the
// database; the Delegations tab is SeatBoardDelegations.tsx, which gives and
// takes back delegation allocations itself and asks the page to re-read.
// ?person=<application id> (the Applications pop-up's link) opens that person
// on the first load when they are waiting, then leaves the URL.

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowUpDown, ChevronDown, Hand, Info, MapPin, Search, X, Award } from 'lucide-react';
import { seatFitFontPx } from '@/lib/seatName';
import GSelect, { type GSelectOption } from '@/components/GSelect';
import { NEU } from '@/components/neu';
import { buildSuggestions, rankSeatsForPerson, type SeatedIdentities } from '@/lib/assignmentFit';
import { useBoardDrag, dropAttr } from '@/app/manage/[slug]/assignment/boardDrag';
import { CountryName, committeeShortName } from '@/app/manage/[slug]/assignment/displayNames';
import { NotRegisteredChip } from '@/app/manage/[slug]/assignment/delegationShared';
import DelegationPopupLink from '@/app/manage/[slug]/DelegationPopupLink';
import SeatBoardDelegations from '@/app/manage/[slug]/assignment/SeatBoardDelegations';
import { replaceUrlInPlace } from '@/lib/replaceUrlInPlace';
import {
  type AcceptedApp, type CommitteeData, type Suggestion, type UserHistory,
  CountryFlag, CommitteeLogo, committeeLabels, committeeSeatLogo, effectiveLevel,
  LevelBadge, LevelDisc, LevelHero, slotLogoUrl, OUTFIT,
} from '@/app/manage/[slug]/assignment/assignmentKit';
import {
  AvatarWithFlag, BigCount, CARD_SHADOW, CommitteeRing, FitPills, NameAge, PersonIdentity, RankNumber, RingTally, ScoreHover, ScoringHint,
  SoftButton, WELL, acceptedAt, choicesPhrase, delegationOf, firstName, fmtDay, nationalityOf, personName,
  prefOrdersByCommittee, schoolName, seatCounts,
} from '@/app/manage/[slug]/assignment/seatBoardShared';

// The smart allocations are the board's main event and must POP (owner, 21
// Oct 2026: "they used to pop more"): white cards with a gold top edge, a thin
// gold ring and a deeper forest-tinted lift; the gold score disc, the round
// flags and the type carry the weight, never a tinted fill (the gold surface
// was rejected).
const SMART_CARD_SHADOW = 'inset 0 3px 0 #E2C66B, inset 0 0 0 1px rgba(182,135,31,0.20), 0 1px 2px rgba(27,56,40,0.08), 0 12px 28px -10px rgba(27,56,40,0.26)';

type SortKey = 'accepted' | 'name';
type SchoolFilter = 'all' | 'independent' | `s:${string}`;
type LevelFilter = 'all' | 'beginner' | 'intermediate' | 'advanced' | 'expert';

export interface SeatBoardSociety { id: string; name: string; memberCount: number }

function byName(a: string, b: string) {
  return a.localeCompare(b, undefined, { sensitivity: 'base' });
}

export default function SeatBoard({
  accepted, committees, societies, history, seated, spread, needy,
  busyKey, locked, onAssign, onOpenCommittee, onRefresh, onOpenDelegationsView,
}: {
  /** The waiting pool (accepted delegates without a seat). */
  accepted: AcceptedApp[];
  /** In the board's display order. */
  committees: CommitteeData[];
  societies: SeatBoardSociety[];
  history: Record<string, UserHistory>;
  seated: SeatedIdentities;
  spread: ReadonlySet<string>;
  needy: ReadonlySet<string>;
  /** `${appId}-${slotId}` of the assignment saving now. */
  busyKey: string | null;
  /** The first-assign pop-up is waiting on an answer. */
  locked: boolean;
  onAssign: (sug: Suggestion) => void;
  /** Opens the classic committee pop-up (the page renders it). With `seat`,
   *  its open seats seat that person through `seat.onSeat`. */
  onOpenCommittee: (committeeId: string, seat: { personId: string; onSeat: (sug: Suggestion) => void } | null) => void;
  /** Re-reads the board quietly (after a delegation allocation is given or taken back). */
  onRefresh: () => Promise<void> | void;
  onOpenDelegationsView: () => void;
}) {
  const [tab, setTab] = useState<'people' | 'delegations'>('people');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('accepted');
  const [fSchool, setFSchool] = useState<SchoolFilter>('all');
  const [fLevel, setFLevel] = useState<LevelFilter>('all');
  // The Applications pop-up links here with ?person=<application id>: that
  // person opens in the middle on the first load when they are waiting. The
  // board mounts only after the page has loaded, on the client.
  const [openPersonId, setOpenPersonId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const id = new URLSearchParams(window.location.search).get('person');
    if (!id) return null;
    const app = accepted.find(a => a.id === id);
    if (!app || seated.appIds.has(app.id) || (app.profiles?.id ? seated.userIds.has(app.profiles.id) : false)) return null;
    return id;
  });
  const [pulse, setPulse] = useState(false);
  const middleRef = useRef<HTMLElement | null>(null);
  const ringsRef = useRef<HTMLElement | null>(null);

  // Everyone waiting, temp rows included (a seat taken a moment ago drops its
  // holder at once, like the classic rail's pool).
  const waiting = useMemo(
    () => accepted.filter(a => !seated.appIds.has(a.id) && !(a.profiles?.id ? seated.userIds.has(a.profiles.id) : false)),
    [accepted, seated],
  );

  // Every suggestion the engine can give, not just the classic strip's six.
  const feed = useMemo(
    () => buildSuggestions(waiting, committees, { seated, spread, needy, limit: Infinity }),
    [waiting, committees, seated, spread, needy],
  );

  // ?person=<application id> was read into openPersonId's first value; the
  // param then leaves the URL so a refresh does not reopen it.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has('person')) return;
    url.searchParams.delete('person');
    replaceUrlInPlace(url.pathname + url.search + url.hash);
  }, []);

  const openPerson = openPersonId ? waiting.find(a => a.id === openPersonId) ?? null : null;

  // The middle starts at the top whenever what it shows changes.
  useEffect(() => { middleRef.current?.scrollTo({ top: 0 }); }, [openPersonId]);

  useEffect(() => {
    if (!openPersonId) return;
    // Escape closes the committee pop-up first when one is open (the page's).
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || document.querySelector('[aria-modal="true"]')) return;
      setOpenPersonId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openPersonId]);

  useEffect(() => {
    if (!pulse) return;
    const t = setTimeout(() => setPulse(false), 1400);
    return () => clearTimeout(t);
  }, [pulse]);

  // Pointer drag (boardDrag.tsx): a person or a delegation onto a ring.
  const { drag, sourceProps, ghost } = useBoardDrag({
    canDrop: (payload, target) => target.kind === 'committee' && payload.kind === 'app',
    onDrop: (payload, target) => {
      if (target.kind === 'committee' && payload.kind === 'app') onOpenCommittee(target.committeeId, { personId: payload.id, onSeat: assign });
    },
  });
  const draggedApp = drag?.payload.kind === 'app' ? waiting.find(a => a.id === drag.payload.id) ?? null : null;
  const overCommitteeId = drag?.over?.startsWith('committee:') ? drag.over.slice('committee:'.length) : null;
  const overCommittee = overCommitteeId ? committees.find(c => c.id === overCommitteeId) ?? null : null;

  const focus = draggedApp ?? openPerson;
  const markers = useMemo(() => prefOrdersByCommittee(focus), [focus]);

  /** Every assignment: close what is open, back to the suggestions, then the
   *  page's own path (which may show its first-assign pop-up, alone). */
  function assign(sug: Suggestion) {
    setOpenPersonId(null);
    onAssign(sug);
  }

  function clickCommittee(c: CommitteeData) {
    onOpenCommittee(c.id, openPerson ? { personId: openPerson.id, onSeat: assign } : null);
  }

  // ── Left list ──────────────────────────────────────────────────────────────
  const schoolOptions = useMemo(() => {
    const seen = new Map<string, string>();
    let independents = false;
    for (const a of waiting) {
      if (a.society_id == null) independents = true;
      else if (!seen.has(a.society_id)) seen.set(a.society_id, schoolName(a));
    }
    const opts: GSelectOption<SchoolFilter>[] = [{ value: 'all', label: 'Delegation' }];
    if (independents) opts.push({ value: 'independent', label: 'Independent' });
    for (const [id, name] of [...seen.entries()].sort((x, y) => byName(x[1], y[1]))) opts.push({ value: `s:${id}`, label: name });
    return opts;
  }, [waiting]);
  const sortOptions: GSelectOption<SortKey>[] = [
    { value: 'accepted', label: 'Accepted', hint: 'Oldest first' },
    { value: 'name', label: 'Name', hint: 'A to Z' },
  ];
  const sortLabel = sortOptions.find(o => o.value === sort)?.label ?? 'Accepted';
  const schoolLabel = schoolOptions.find(o => o.value === fSchool)?.label ?? 'Delegation';
  const levelOptions: GSelectOption<LevelFilter>[] = [
    { value: 'all', label: 'Level' },
    { value: 'beginner', label: 'Beginner' },
    { value: 'intermediate', label: 'Intermediate' },
    { value: 'advanced', label: 'Advanced' },
    { value: 'expert', label: 'Expert' },
  ];

  const people = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = waiting.filter(a => {
      if (q && !personName(a).toLowerCase().includes(q) && !schoolName(a).toLowerCase().includes(q)) return false;
      if (fSchool === 'independent' && a.society_id != null) return false;
      if (fSchool.startsWith('s:') && a.society_id !== fSchool.slice(2)) return false;
      if (fLevel !== 'all' && effectiveLevel(a).toLowerCase() !== fLevel) return false;
      return true;
    });
    return list.sort((a, b) => {
      if (sort === 'name') return byName(personName(a), personName(b));
      // Oldest accepted first; undated last.
      const ta = acceptedAt(a) ?? '';
      const tb = acceptedAt(b) ?? '';
      if (ta !== tb) return !ta ? 1 : !tb ? -1 : ta.localeCompare(tb);
      return byName(personName(a), personName(b));
    });
  }, [waiting, search, fSchool, fLevel, sort]);

  // ── The opened person's best three seats (best seat in each committee) ──────
  const bestThree = useMemo(() => {
    if (!openPerson) return [];
    const best: Suggestion[] = [];
    for (const c of committees) {
      const top = rankSeatsForPerson(openPerson, c, spread, needy)[0];
      if (top) best.push(top);
    }
    return best.sort((a, b) => b.score - a.score).slice(0, 3);
  }, [openPerson, committees, spread, needy]);

  const totalOpen = committees.reduce((n, c) => n + seatCounts(c).open, 0);

  // ── Pieces ─────────────────────────────────────────────────────────────────
  const ringGrid = (inPanel: boolean) => (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${inPanel ? 72 : 70}px, 1fr))` }}>
      {committees.map(c => {
        const lit = overCommitteeId === c.id;
        const { open } = seatCounts(c);
        const big = committeeLabels(c).big;
        return (
          <button
            key={c.id}
            type="button"
            data-drop={inPanel ? undefined : dropAttr({ kind: 'committee', committeeId: c.id })}
            onClick={() => clickCommittee(c)}
            aria-label={`Open ${big}, ${open} open`}
            title={c.name}
            className="focus:outline-none flex flex-col items-center"
            style={{
              gap: 3, padding: '6px 2px 10px', borderRadius: 14, border: 'none', cursor: 'pointer',
              background: lit ? '#FFFFFF' : '#FAF8F3',
              boxShadow: lit ? `0 0 0 2px #1B3828, 0 8px 20px rgba(27,56,40,0.18)` : '0 0 0 1px rgba(27,56,40,0.06)',
              transform: lit ? 'scale(1.04)' : 'none',
              transition: 'box-shadow 160ms cubic-bezier(0.22,1,0.36,1), transform 160ms cubic-bezier(0.22,1,0.36,1)',
              fontFamily: OUTFIT, color: NEU.ink,
            }}
          >
            <CommitteeRing committee={c} markers={markers.get(c.id)} lit={lit} halo />
            <span className="[overflow-wrap:anywhere] text-center" style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.15, padding: '0 2px' }}>{big}</span>
            <RingTally committee={c} />
          </button>
        );
      })}
    </div>
  );

  const middle = openPerson ? (
    <PersonPanel
      person={openPerson}
      history={openPerson.profiles ? history[openPerson.profiles.id] : undefined}
      committees={committees}
      bestThree={bestThree}
      busyKey={busyKey}
      locked={locked}
      onAssign={assign}
      onBack={() => setOpenPersonId(null)}
      onChooseAnother={() => {
        setPulse(true);
        ringsRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }}
      phoneRings={ringGrid(true)}
    />
  ) : (
    <>
      {/* Bigger and at the very top of the column (owner, 22 Oct 2026): the
          header's seated / waiting / open counts are gone, so this leads. */}
      <div className="flex items-center justify-center gap-2.5 flex-none" style={{ paddingBottom: 2 }}>
        <h2 style={{ margin: 0, fontSize: 32, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.05, fontFamily: OUTFIT, color: NEU.ink }}>Smart Allocations</h2>
        <span style={{ fontSize: 19, fontWeight: 600, color: NEU.inkSoft, fontVariantNumeric: 'tabular-nums', fontFamily: OUTFIT }}>{feed.length}</span>
        <ScoringHint />
      </div>
      {feed.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center gap-2 py-16 px-6" style={{ background: '#FFFFFF', borderRadius: 18, boxShadow: CARD_SHADOW, fontFamily: OUTFIT }}>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: NEU.ink }}>
            {waiting.length === 0 ? 'Everyone accepted has a seat' : 'No open seat fits anyone waiting'}
          </p>
          <p style={{ margin: 0, fontSize: 13.5, color: NEU.inkSoft }}>
            {waiting.length === 0 ? 'New people appear here once you accept them' : 'Open a committee on the right to seat someone by hand'}
          </p>
        </div>
      ) : (
        <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 400px), 1fr))', alignItems: 'start' }}>
          {feed.map(sug => {
            const key = `${sug.app.id}-${sug.slot.id}`;
            return (
              <SmartAllocationCard
                key={key}
                sug={sug}
                busy={busyKey === key}
                locked={locked}
                onOpenPerson={() => setOpenPersonId(sug.app.id)}
                onAssign={() => assign(sug)}
              />
            );
          })}
        </div>
      )}
    </>
  );

  const leftHeader = (
    <div className="flex flex-col gap-2.5 flex-none" style={{ padding: '16px 16px 10px' }}>
      <div role="tablist" aria-label="Who to seat" className="flex" style={{ gap: 2, padding: 3, borderRadius: 12, background: '#F1ECE1' }}>
        {(['people', 'delegations'] as const).map(k => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            onClick={() => { setTab(k); setOpenPersonId(null); }}
            className="focus:outline-none flex-1"
            style={{
              height: 34, borderRadius: 9, border: 'none', cursor: 'pointer',
              background: tab === k ? '#FFFFFF' : 'transparent',
              boxShadow: tab === k ? '0 1px 3px rgba(27,56,40,0.12)' : 'none',
              fontFamily: OUTFIT, fontSize: 13.5, fontWeight: tab === k ? 600 : 500, color: tab === k ? NEU.ink : NEU.inkSoft,
            }}
          >
            {k === 'people' ? 'People' : 'Delegations'}{' '}
            <span style={{ color: NEU.inkSoft, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{k === 'people' ? waiting.length : societies.length}</span>
          </button>
        ))}
      </div>
      <label className="flex items-center gap-2 px-3" style={{ height: 36, borderRadius: 10, background: '#FAF8F3', boxShadow: '0 0 0 1px rgba(27,56,40,0.10)' }}>
        <Search size={15} strokeWidth={1.5} style={{ color: NEU.inkSoft, flexShrink: 0 }} />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={tab === 'people' ? 'Search a name or delegation' : 'Search a delegation'}
          aria-label={tab === 'people' ? 'Search people' : 'Search delegations'}
          className="flex-1 min-w-0 focus:outline-none"
          style={{ border: 'none', background: 'transparent', fontFamily: OUTFIT, fontSize: 13.5, color: NEU.ink }}
        />
        {search && (
          <button type="button" onClick={() => setSearch('')} aria-label="Clear search" className="focus:outline-none" style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: NEU.inkSoft, lineHeight: 0 }}>
            <X size={14} strokeWidth={1.5} />
          </button>
        )}
      </label>
      {tab === 'people' && (
        // One row: the two filters share the width, the sort is an icon control
        // (owner, 21 Oct 2026: the Delegation filter split into two rows).
        <div className="flex items-center gap-1.5">
          <GSelect<SchoolFilter>
            value={fSchool}
            onChange={setFSchool}
            options={schoolOptions}
            size="sm"
            aria-label={fSchool === 'all' ? 'Filter by delegation' : `Delegation: ${schoolLabel}`}
            title={fSchool === 'all' ? undefined : schoolLabel}
            panelMinWidth={240}
            searchPlaceholder="Find a delegation"
            className="flex-1 min-w-0"
            triggerContent={(
              <span className="flex items-center gap-1.5 w-full min-w-0">
                <span
                  className="flex-1 min-w-0 text-left [overflow-wrap:anywhere]"
                  style={{
                    whiteSpace: fSchool === 'all' ? 'nowrap' : 'normal',
                    fontWeight: fSchool === 'all' ? 500 : 600,
                    color: fSchool === 'all' ? NEU.inkSoft : NEU.ink,
                    fontSize: fSchool === 'all' ? undefined : seatFitFontPx(schoolLabel, 92, 12.5, { lines: 1, minPx: 10 }),
                    lineHeight: 1.15,
                  }}
                >
                  {schoolLabel}
                </span>
                <ChevronDown size={13} strokeWidth={2.4} className="gv-gsel-chev" aria-hidden />
              </span>
            )}
          />
          <GSelect<LevelFilter>
            value={fLevel}
            onChange={setFLevel}
            options={levelOptions}
            size="sm"
            aria-label="Filter by level"
            panelMinWidth={180}
            className="flex-1 min-w-0"
            triggerContent={(
              <span className="flex items-center gap-1.5 w-full min-w-0">
                <span className="flex-1 min-w-0 text-left" style={{ whiteSpace: 'nowrap', fontWeight: fLevel === 'all' ? 500 : 600, color: fLevel === 'all' ? NEU.inkSoft : NEU.ink }}>
                  {levelOptions.find(o => o.value === fLevel)?.label ?? 'Level'}
                </span>
                <ChevronDown size={13} strokeWidth={2.4} className="gv-gsel-chev" aria-hidden />
              </span>
            )}
          />
          {/* Sorting is its own control, set apart from the two filters. */}
          <GSelect<SortKey>
            value={sort}
            onChange={setSort}
            options={sortOptions}
            size="sm"
            aria-label={`Sort by ${sortLabel}`}
            title={`Sorted by ${sortLabel}`}
            panelMinWidth={210}
            align="end"
            style={{ background: WELL, width: 'auto', flexShrink: 0 }}
            triggerContent={(
              <span className="flex items-center gap-1">
                <ArrowUpDown size={14} strokeWidth={1.75} style={{ color: NEU.ink, flexShrink: 0 }} aria-hidden />
                <ChevronDown size={13} strokeWidth={2.4} className="gv-gsel-chev" aria-hidden />
              </span>
            )}
          />
        </div>
      )}
    </div>
  );

  if (tab === 'delegations') {
    return (
      <SeatBoardDelegations
        leftHeader={leftHeader}
        committees={committees}
        waiting={waiting}
        search={search}
        spread={spread}
        needy={needy}
        onRefresh={onRefresh}
        onOpenDelegationsView={onOpenDelegationsView}
        onOpenCommittee={id => onOpenCommittee(id, null)}
      />
    );
  }

  return (
    <div
      className="flex flex-col gap-4 lg:grid lg:flex-1 lg:min-h-0 lg:grid-cols-[316px_minmax(0,1fr)_316px] 2xl:grid-cols-[380px_minmax(0,1fr)_396px]"
      style={{ fontFamily: OUTFIT, color: NEU.ink }}
    >
      {/* ── LEFT: who is waiting ─────────────────────────────────────────── */}
      <section
        className="order-1 flex flex-col overflow-hidden max-lg:max-h-[70dvh] lg:min-h-0"
        style={{ background: '#FFFFFF', borderRadius: 20, boxShadow: CARD_SHADOW }}
      >
        {leftHeader}

        <div className="flex-1 min-h-0 overflow-y-auto" style={{ padding: '6px 8px 8px', borderTop: '1px solid #EFEAE0', overscrollBehavior: 'contain' }}>
          {people.length === 0 && (
            <p className="text-center py-8" style={{ fontSize: 14, color: NEU.inkSoft }}>
              {waiting.length === 0 ? 'Nobody is waiting for a seat' : 'Nobody matches these filters'}
            </p>
          )}
          {people.map(a => {
            const name = personName(a);
            const open = openPersonId === a.id;
            const dragged = drag?.payload.kind === 'app' && drag.payload.id === a.id;
            const toggle = () => setOpenPersonId(prev => (prev === a.id ? null : a.id));
            return (
              <div
                key={a.id}
                {...sourceProps({ kind: 'app', id: a.id }, name)}
                role="button"
                tabIndex={0}
                aria-pressed={open}
                aria-label={`${name}. Open to see their best seats, or drag onto a committee`}
                onClick={toggle}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } }}
                className="flex items-center gap-3 focus:outline-none focus-visible:ring-2"
                style={{
                  padding: '9px 12px 9px 10px', borderRadius: 14, cursor: 'grab',
                  background: open ? WELL : 'transparent',
                  boxShadow: open ? 'inset 0 0 0 1.5px #1B3828' : 'none',
                  opacity: dragged ? 0.45 : 1,
                  transition: 'background-color 140ms cubic-bezier(0.22,1,0.36,1)',
                }}
                onMouseEnter={e => { if (!open) (e.currentTarget as HTMLElement).style.background = '#FAF8F3'; }}
                onMouseLeave={e => { if (!open) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <span className="flex-1 min-w-0">
                  <PersonIdentity app={a} avatar={38} nameSize={15.5} after={!a.profiles ? <NotRegisteredChip /> : undefined} />
                </span>
                <span className="flex flex-col items-end flex-shrink-0" style={{ gap: 3 }}>
                  <LevelDisc level={effectiveLevel(a)} size={22} />
                  {acceptedAt(a) && (
                    <span title={`Accepted ${fmtDay(acceptedAt(a))}`} style={{ fontSize: 11, color: NEU.inkSoft, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                      {fmtDay(acceptedAt(a))}
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── MIDDLE: the suggestions, or one person ───────────────────────── */}
      <section
        ref={middleRef}
        className={`order-3 lg:order-2 flex flex-col gap-2 min-w-0 lg:min-h-0 lg:overflow-y-auto lg:pt-0.5 lg:pr-1.5 lg:pb-3 lg:pl-0.5 ${openPerson ? 'max-lg:fixed max-lg:left-0 max-lg:right-0 md:max-lg:left-[96px] max-lg:bottom-0 max-lg:top-14 max-lg:z-40 max-lg:overflow-y-auto max-lg:p-4' : ''}`}
        style={{ overscrollBehavior: 'contain', ...(openPerson ? { backgroundColor: 'var(--gv-bg, #EDE7D8)' } : null) }}
      >
        {middle}
      </section>

      {/* ── RIGHT: committees ────────────────────────────────────────────── */}
      <section
        ref={ringsRef}
        className="order-2 lg:order-3 flex flex-col lg:min-h-0"
        style={{
          background: '#FFFFFF', borderRadius: 20, padding: '16px 12px 14px', gap: 14,
          boxShadow: pulse ? `0 0 0 2px #B6871F, ${CARD_SHADOW}` : CARD_SHADOW,
          transition: 'box-shadow 240ms cubic-bezier(0.22,1,0.36,1)',
        }}
      >
        <div className="flex items-center justify-between flex-none" style={{ padding: '0 4px' }}>
          <span className="inline-flex items-center gap-2">
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>Committees</h2>
            <span title="The ring shows how full each committee is. Beneath it, seats given of all seats" style={{ display: 'inline-flex', color: NEU.inkSoft }}>
              <Info size={15} strokeWidth={1.5} />
            </span>
          </span>
          <BigCount n={totalOpen} word="open" size={17} />
        </div>

        {(draggedApp || openPerson) && (
          <div className="flex items-center gap-2.5 flex-none" style={{ padding: '10px 12px', borderRadius: 14, background: WELL }}>
            <AvatarWithFlag name={personName((draggedApp ?? openPerson)!)} url={(draggedApp ?? openPerson)!.profiles?.avatar_url ?? null} size={30} nationality={nationalityOf((draggedApp ?? openPerson)!)} />
            <span className="flex flex-col min-w-0" style={{ lineHeight: 1.25 }}>
              <span className="[overflow-wrap:anywhere]" style={{ fontSize: 13, fontWeight: 600 }}>
                {draggedApp ? <>Drop {personName(draggedApp)} on a committee</> : <>Seating {personName(openPerson!)}</>}
              </span>
              <span style={{ fontSize: 12, color: NEU.inkSoft }}>
                {draggedApp ? 'You pick their country next' : 'Click a committee, or drag them onto one'}
              </span>
            </span>
          </div>
        )}

        <div className="lg:flex-1 lg:min-h-0 lg:overflow-y-auto" style={{ padding: 4, margin: -4, overscrollBehavior: 'contain' }}>
          {committees.length === 0
            ? <p className="text-center py-6" style={{ fontSize: 13.5, color: NEU.inkSoft }}>No committees yet</p>
            : ringGrid(false)}
        </div>

        <div className="flex items-center gap-2.5 flex-none" style={{ padding: 12, borderRadius: 14, background: WELL }}>
          <Hand size={18} strokeWidth={1.5} style={{ color: NEU.forest, flexShrink: 0 }} />
          <span style={{ fontSize: 12.5, lineHeight: 1.4 }}>
            {overCommittee ? (
              <>
                Let go to open <strong style={{ fontWeight: 600 }}>{committeeLabels(overCommittee).big}</strong>
                {draggedApp && markers.get(overCommittee.id) ? `. Their ${choicesPhrase(markers.get(overCommittee.id)!)}` : ''}
                {`, ${seatCounts(overCommittee).open} open`}
              </>
            ) : focus && markers.size > 0 ? (
              <>Gold numbers are {firstName(personName(focus))}&apos;s choices, 1 is their first</>
            ) : (
              'Click a committee to see every seat, or drag a person onto one'
            )}
          </span>
        </div>
      </section>

      {ghost}
    </div>
  );
}

// ── One smart allocation (the middle feed) ───────────────────────────────────
// Tight but strong (owner, 21 Oct 2026: "make them POP again, with less empty
// space"): the person (avatar with the nationality flag on its border, "Name,
// 17", the delegation beneath) beside the big gold score disc, whose hover
// card is "How this scores"; the seat on an ivory well (a bigger round flag,
// the country, the committee) with a soft Assign; the reason badges on one
// row. A light lift on hover. The person's experience level (its insignia and
// word) follows the name (owner, 22 Oct 2026).
function SmartAllocationCard({ sug, busy, locked, onOpenPerson, onAssign }: {
  sug: Suggestion;
  /** This card's assignment is saving. */
  busy: boolean;
  /** Another assignment is waiting on the first-assign pop-up. */
  locked: boolean;
  onOpenPerson: () => void;
  onAssign: () => void;
}) {
  const name = personName(sug.app);
  const labels = committeeLabels(sug.committee);
  return (
    <div
      className="flex flex-col transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-px"
      style={{ padding: '11px 11px 10px 12px', gap: 8, borderRadius: 18, background: '#FFFFFF', boxShadow: SMART_CARD_SHADOW }}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenPerson}
          title={`Open ${name}`}
          className="focus:outline-none focus-visible:ring-2 flex-1 min-w-0 text-left"
          style={{ border: 'none', background: 'transparent', padding: 0, borderRadius: 12, cursor: 'pointer', fontFamily: OUTFIT }}
        >
          <PersonIdentity app={sug.app} avatar={42} nameSize={16.5} lineSize={12.5} after={<LevelBadge level={effectiveLevel(sug.app)} />} />
        </button>
        <ScoreHover
          sug={sug}
          size={44}
          title={sug.swap ? `Fit ${sug.score} here; their own best open seat scored ${sug.swap.ownBestScore}. Hover for how it scores` : undefined}
        />
      </div>

      <div className="flex items-center gap-2.5" style={{ padding: '5px 5px 5px 7px', borderRadius: 13, background: WELL }}>
        <CountryFlag code={sug.slot.country_code} w={34} h={34} alt={sug.slot.country_name} logoUrl={slotLogoUrl(sug.committee, sug.slot)} />
        <span className="flex items-center flex-wrap flex-1 min-w-0" style={{ gap: '1px 9px', lineHeight: 1.15 }}>
          <CountryName name={sug.slot.country_name} code={sug.slot.country_code} style={{ fontSize: 16, fontWeight: 700, color: NEU.ink, whiteSpace: 'normal', overflowWrap: 'anywhere' }} />
          <span className="inline-flex items-center gap-1.5" style={{ fontSize: 12.5, color: NEU.inkSoft }} title={sug.committee.name}>
            <CommitteeLogo committee={sug.committee} size={18} alt={labels.big} />
            <span className="[overflow-wrap:anywhere]" style={{ fontWeight: 600, color: NEU.ink }}>{labels.big}</span>
          </span>
        </span>
        <SoftButton onClick={onAssign} disabled={busy || locked}>{busy ? 'Saving' : 'Assign'}</SoftButton>
      </div>

      <FitPills sug={sug} max={4} />
    </div>
  );
}

// ── One person, opened in the middle ─────────────────────────────────────────
// Compact, no dead space (owner, 21 Oct 2026): one card for who they are (the
// back button in its top row, the flag, age, role and school on one line, the
// large level beside), then their preferences and their best three seats,
// side by side when the column is wide and stacked when it is not.
function PersonPanel({
  person, history, committees, bestThree, busyKey, locked, onAssign, onBack, onChooseAnother, phoneRings,
}: {
  person: AcceptedApp;
  history: UserHistory | undefined;
  committees: CommitteeData[];
  bestThree: Suggestion[];
  busyKey: string | null;
  locked: boolean;
  onAssign: (sug: Suggestion) => void;
  onBack: () => void;
  onChooseAnother: () => void;
  /** The committee rings again, drawn inside the panel on phones only. */
  phoneRings: React.ReactNode;
}) {
  const name = personName(person);
  const prefs = [...(person.application_preferences ?? [])].sort((a, b) => a.preference_order - b.preference_order).slice(0, 8);
  const byId = new Map(committees.map(c => [c.id, c]));
  const card: React.CSSProperties = { background: '#FFFFFF', borderRadius: 18, boxShadow: CARD_SHADOW };
  const independent = person.society_id == null;
  const nat = nationalityOf(person);
  const city = person.societies?.city?.trim() || null;
  const role = person.role === 'head-delegate' || person.is_head_delegate ? 'Head Delegate' : 'Delegate';

  return (
    <div className="flex flex-col gap-2">
      {/* Who they are */}
      <div className="flex flex-col" style={{ ...card, padding: '10px 14px 14px', gap: 8 }}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <SoftButton onClick={onBack} size="sm" style={{ marginLeft: -4, paddingLeft: 9 }}>
            <ArrowLeft size={15} strokeWidth={1.5} /> Back to smart allocations
          </SoftButton>
          {acceptedAt(person) && <span style={{ fontSize: 12.5, color: NEU.inkSoft }}>Accepted {fmtDay(acceptedAt(person))}</span>}
        </div>
        <div className="flex items-center gap-3.5">
          <AvatarWithFlag name={name} url={person.profiles?.avatar_url ?? null} size={60} nationality={nat} userId={person.profiles?.id} />
          <div className="flex-1 min-w-0 flex flex-col" style={{ gap: 4 }}>
            <NameAge name={name} app={person} size={23} after={!person.profiles ? <NotRegisteredChip /> : undefined} />
            {(!independent || city) && (
              <div className="flex items-center flex-wrap" style={{ gap: '2px 12px', fontSize: 13.5, lineHeight: 1.25 }}>
                {!independent && (
                  <span className="[overflow-wrap:anywhere]">
                    <DelegationPopupLink societyId={person.society_id} style={{ fontWeight: 700, color: NEU.ink, textDecoration: 'underline' }}>{delegationOf(person)}</DelegationPopupLink>
                  </span>
                )}
                {city && (
                  <span className="inline-flex items-center gap-1" style={{ fontSize: 12.5, color: NEU.inkSoft }} title={`${schoolName(person)} is in ${city}`}>
                    <MapPin size={13} strokeWidth={1.5} style={{ color: NEU.ink }} aria-hidden />
                    {city}
                  </span>
                )}
              </div>
            )}
            <div className="flex items-center flex-wrap" style={{ gap: '2px 12px', fontSize: 13, color: NEU.inkSoft }}>
              <span>{role}</span>
              {person.profiles?.nationality?.trim() && <span className="[overflow-wrap:anywhere]">{person.profiles.nationality.trim()}</span>}
            </div>
          </div>
          <LevelHero level={effectiveLevel(person)} conferences={history ? history.conferences : null} size={52} />
        </div>
        {history && history.awardLabels.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap" style={{ paddingTop: 2 }}>
            <Award size={14} strokeWidth={1.5} style={{ color: NEU.ink, flexShrink: 0 }} aria-label="Awards" />
            {history.awardLabels.map((l, i) => (
              <span key={`${l}-${i}`} style={{ fontSize: 12.5, color: NEU.ink }}>{l}{i < history.awardLabels.length - 1 ? ',' : ''}</span>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', alignItems: 'start' }}>
        {/* Their best three seats */}
        <div className="flex flex-col" style={{ ...card, padding: '10px 12px 12px', gap: 6 }}>
          <div className="flex items-center justify-between gap-3 flex-wrap" style={{ minHeight: 30 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: NEU.ink, paddingLeft: 2 }}>Best Three Seats</h3>
            <span className="max-lg:hidden">
              <SoftButton onClick={onChooseAnother} size="sm" title="For any other seat, click a committee on the right">Choose another seat</SoftButton>
            </span>
          </div>
          {bestThree.length === 0 && <p style={{ margin: 0, fontSize: 13, color: NEU.inkSoft, paddingLeft: 2 }}>No open seat fits {firstName(name)} right now</p>}
          {bestThree.map(sug => {
            const key = `${sug.app.id}-${sug.slot.id}`;
            const labels = committeeLabels(sug.committee);
            return (
              <div key={key} className="flex flex-col" style={{ padding: '6px 6px 6px 8px', borderRadius: 13, background: WELL, gap: 5 }}>
                <div className="flex items-center gap-2">
                  <ScoreHover sug={sug} size={32} />
                  <CountryFlag code={sug.slot.country_code} w={26} h={26} alt={sug.slot.country_name} logoUrl={slotLogoUrl(sug.committee, sug.slot)} />
                  <span className="flex items-center flex-wrap flex-1 min-w-0" style={{ gap: '0 8px', lineHeight: 1.15 }}>
                    <CountryName name={sug.slot.country_name} code={sug.slot.country_code} style={{ fontSize: 14.5, fontWeight: 700, color: NEU.ink, whiteSpace: 'normal', overflowWrap: 'anywhere' }} />
                    <span className="inline-flex items-center gap-1" style={{ fontSize: 12.5, color: NEU.inkSoft }} title={sug.committee.name}>
                      <CommitteeLogo committee={sug.committee} size={16} alt={labels.big} />
                      <span style={{ fontWeight: 600 }}>{labels.big}</span>
                    </span>
                  </span>
                  <SoftButton onClick={() => onAssign(sug)} disabled={busyKey === key || locked} size="sm">
                    {busyKey === key ? 'Saving' : 'Assign'}
                  </SoftButton>
                </div>
                {(sug.reasons.length > 0 || sug.swap) && <span className="flex min-w-0" style={{ paddingLeft: 40 }}><FitPills sug={sug} max={4} size="sm" /></span>}
              </div>
            );
          })}
          <div className="lg:hidden flex flex-col gap-2 pt-1">
            <span style={{ fontSize: 13, fontWeight: 600 }}>Choose another seat</span>
            {phoneRings}
          </div>
        </div>

        {/* What they asked for */}
        <div className="flex flex-col" style={{ ...card, padding: '10px 14px 12px', gap: 4 }}>
          <h3 style={{ margin: '0 0 2px', fontSize: 15, fontWeight: 600, color: NEU.ink, minHeight: 30, display: 'flex', alignItems: 'center' }}>Preferences</h3>
          {prefs.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: NEU.inkSoft }}>No preference given</p>
          ) : prefs.map((p, i) => {
            const c = byId.get(p.conference_committee_id);
            const slot = c?.committee_country_slots.find(s => s.country_code === p.country_code);
            const held = c ? c.conference_allocations.filter(a => a.country_code === p.country_code).length : 0;
            const taken = !!slot && held >= slot.delegation_size;
            const big = c ? committeeLabels(c).big : committeeShortName(p.conference_committees);
            return (
              <div
                key={`${p.preference_order}-${p.conference_committee_id}-${p.country_code}`}
                className="flex items-center gap-2 min-w-0"
                style={{ minHeight: 26, opacity: taken ? 0.6 : 1 }}
                title={`${p.conference_committees?.name ?? c?.name ?? big}, ${p.country_name}${taken ? ', taken' : ''}`}
              >
                <RankNumber order={i + 1} size={20} />
                <span className="inline-flex items-center gap-1.5 flex-shrink-0" style={{ minWidth: 76 }}>
                  {c && <CommitteeLogo committee={c} size={18} alt={big} />}
                  <span style={{ fontSize: 13, fontWeight: 600, color: NEU.ink }}>{big}</span>
                </span>
                <span className="inline-flex items-center gap-1.5 min-w-0 flex-1">
                  <CountryFlag code={p.country_code} w={18} h={18} alt={p.country_name} logoUrl={c ? committeeSeatLogo(c, p.country_code) : null} />
                  <CountryName name={p.country_name} code={p.country_code} style={{ fontSize: 13, color: NEU.ink, whiteSpace: 'normal', overflowWrap: 'anywhere', lineHeight: 1.15 }} />
                </span>
                {taken && <span className="flex-shrink-0" style={{ fontSize: 12, color: NEU.inkSoft }}>taken</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
