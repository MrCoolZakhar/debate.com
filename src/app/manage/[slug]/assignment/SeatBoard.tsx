'use client';

// ── The seat board (owner, 21 Oct 2026) ──────────────────────────────────────
// The Assignment page's main view for delegates, in three columns:
//   LEFT    the people still waiting (oldest accepted first) and the
//           delegations, each column scrolling inside itself;
//   MIDDLE  the only part that scrolls with content: "Smart Allocations"
//           (centred, with the general "How smart allocations are scored"
//           hint), dense white cards (the person with flag and age on one
//           line, the seat, one row of reason badges, "How this scores" on
//           hover of the score), or one person opened in place with their
//           level, where they are from and their best three seats;
//   RIGHT   the committees as fill rings; a click (or a person dropped on one)
//           opens that committee's pop-up (SeatBoardPopup.tsx).
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
import { NEU, NeuButton } from '@/components/neu';
import { getCountryByName } from '@/lib/countries';
import { buildSuggestions, rankSeatsForPerson, type SeatedIdentities } from '@/lib/assignmentFit';
import { useBoardDrag, dropAttr } from '@/app/manage/[slug]/assignment/boardDrag';
import { CountryName, committeeShortName } from '@/app/manage/[slug]/assignment/displayNames';
import { NotRegisteredChip } from '@/app/manage/[slug]/assignment/delegationShared';
import DelegationPopupLink from '@/app/manage/[slug]/DelegationPopupLink';
import SeatBoardDelegations from '@/app/manage/[slug]/assignment/SeatBoardDelegations';
import { replaceUrlInPlace } from '@/lib/replaceUrlInPlace';
import {
  type AcceptedApp, type CommitteeData, type Suggestion, type UserHistory,
  CountryFlag, PersonAvatar, CommitteeLogo, committeeLabels, committeeSeatLogo, effectiveLevel, ageOf,
  LevelDisc, LevelHero, slotLogoUrl, OUTFIT,
} from '@/app/manage/[slug]/assignment/assignmentKit';
import { SeatBoardPopup } from '@/app/manage/[slug]/assignment/SeatBoardPopup';
import {
  BigCount, CARD_SHADOW, CommitteeRing, FitPills, RankNumber, ScoreHover, ScoringHint, WELL,
  acceptedAt, choicesPhrase, firstName, fmtDay, personName, prefOrdersByCommittee, schoolName, seatCounts,
} from '@/app/manage/[slug]/assignment/seatBoardShared';

// The smart allocations are the board's main event: white cards with the
// standard forest-tinted shadow and a thin gold top edge; the gold score disc,
// the round flag and the type carry the weight, never a tinted fill (owner,
// 21 Oct 2026: the gold surface was rejected).
const SMART_CARD_SHADOW = `inset 0 2.5px 0 #E2C66B, ${CARD_SHADOW}`;

type SortKey = 'accepted' | 'name' | 'first';
type SchoolFilter = 'all' | 'independent' | `s:${string}`;
type LevelFilter = 'all' | 'beginner' | 'intermediate' | 'advanced' | 'expert';

export interface SeatBoardSociety { id: string; name: string; memberCount: number }

function firstPref(app: AcceptedApp) {
  return [...(app.application_preferences ?? [])].sort((a, b) => a.preference_order - b.preference_order)[0] ?? null;
}

function byName(a: string, b: string) {
  return a.localeCompare(b, undefined, { sensitivity: 'base' });
}

// ── Header counts ────────────────────────────────────────────────────────────
export function SeatBoardStats({ committees, waiting }: { committees: CommitteeData[]; waiting: number }) {
  let seated = 0;
  let open = 0;
  for (const c of committees) {
    const n = seatCounts(c);
    seated += n.filled;
    open += n.open;
  }
  return (
    <span className="flex items-center gap-5 flex-wrap">
      <BigCount n={seated} word="seated" />
      <BigCount n={waiting} word="waiting" />
      <BigCount n={open} word={open === 1 ? 'open seat' : 'open seats'} />
    </span>
  );
}

export default function SeatBoard({
  accepted, committees, societies, history, seated, spread, needy,
  busyKey, locked, emailsOnAssign, onAssign, onRefresh, onOpenDelegationsView,
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
  emailsOnAssign: boolean;
  onAssign: (sug: Suggestion) => void;
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
  const [popup, setPopup] = useState<{ committeeId: string; personId: string | null } | null>(null);
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
  const popupCommittee = popup ? committees.find(c => c.id === popup.committeeId) ?? null : null;
  const popupPerson = popup?.personId ? waiting.find(a => a.id === popup.personId) ?? null : null;

  // The middle starts at the top whenever what it shows changes.
  useEffect(() => { middleRef.current?.scrollTo({ top: 0 }); }, [openPersonId]);

  useEffect(() => {
    if (!openPersonId || popup) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenPersonId(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openPersonId, popup]);

  useEffect(() => {
    if (!pulse) return;
    const t = setTimeout(() => setPulse(false), 1400);
    return () => clearTimeout(t);
  }, [pulse]);

  // Pointer drag (boardDrag.tsx): a person or a delegation onto a ring.
  const { drag, sourceProps, ghost } = useBoardDrag({
    canDrop: (payload, target) => target.kind === 'committee' && payload.kind === 'app',
    onDrop: (payload, target) => {
      if (target.kind === 'committee' && payload.kind === 'app') setPopup({ committeeId: target.committeeId, personId: payload.id });
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
    setPopup(null);
    setOpenPersonId(null);
    onAssign(sug);
  }

  function clickCommittee(c: CommitteeData) {
    setPopup({ committeeId: c.id, personId: openPerson?.id ?? null });
  }

  // ── Left list ──────────────────────────────────────────────────────────────
  const committeeById = useMemo(() => new Map(committees.map(c => [c.id, c])), [committees]);
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
    { value: 'first', label: '1st choice', hint: 'By committee and country' },
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
    const firstLabel = (a: AcceptedApp) => {
      const fp = firstPref(a);
      if (!fp) return '￿';
      const c = committeeById.get(fp.conference_committee_id);
      return `${c ? committeeShortName(c) : committeeShortName(fp.conference_committees)} ${fp.country_name}`;
    };
    return list.sort((a, b) => {
      if (sort === 'name') return byName(personName(a), personName(b));
      if (sort === 'first') return byName(firstLabel(a), firstLabel(b)) || byName(personName(a), personName(b));
      // Oldest accepted first; undated last.
      const ta = acceptedAt(a) ?? '';
      const tb = acceptedAt(b) ?? '';
      if (ta !== tb) return !ta ? 1 : !tb ? -1 : ta.localeCompare(tb);
      return byName(personName(a), personName(b));
    });
  }, [waiting, search, fSchool, fLevel, sort, committeeById]);

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
            <span style={{ fontSize: 11.5, color: NEU.inkSoft }}>
              <span style={{ fontWeight: 700, color: NEU.ink, fontVariantNumeric: 'tabular-nums' }}>{open}</span> open
            </span>
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
      <div className="flex items-center justify-center gap-2 flex-none" style={{ minHeight: 36 }}>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: '-0.01em', fontFamily: OUTFIT, color: NEU.ink }}>Smart Allocations</h2>
        <span style={{ fontSize: 16, fontWeight: 600, color: NEU.inkSoft, fontVariantNumeric: 'tabular-nums', fontFamily: OUTFIT }}>{feed.length}</span>
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

  const popupNode = popup && popupCommittee ? (
    <SeatBoardPopup
      committee={popupCommittee}
      person={popupPerson}
      waiting={waiting}
      spread={spread}
      needy={needy}
      emailsOnAssign={emailsOnAssign}
      locked={locked}
      onAssign={assign}
      onClose={() => setPopup(null)}
    />
  ) : null;

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
        onOpenCommittee={id => setPopup({ committeeId: id, personId: null })}
        overlay={popupNode}
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
                  padding: '9px 10px', borderRadius: 14, cursor: 'grab',
                  background: open ? WELL : 'transparent',
                  boxShadow: open ? 'inset 0 0 0 1.5px #1B3828' : 'none',
                  opacity: dragged ? 0.45 : 1,
                  transition: 'background-color 140ms cubic-bezier(0.22,1,0.36,1)',
                }}
                onMouseEnter={e => { if (!open) (e.currentTarget as HTMLElement).style.background = '#FAF8F3'; }}
                onMouseLeave={e => { if (!open) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <PersonAvatar name={name} url={a.profiles?.avatar_url ?? null} size={38} />
                <span className="flex flex-col flex-1 min-w-0" style={{ lineHeight: 1.2 }}>
                  <span className="[overflow-wrap:anywhere] inline-flex items-center gap-1.5 flex-wrap" style={{ fontSize: 16, fontWeight: 700, color: NEU.ink }}>
                    {name}{!a.profiles && <NotRegisteredChip />}
                  </span>
                  <span className="[overflow-wrap:anywhere]" style={{ fontSize: 12.5, color: NEU.inkSoft, marginTop: 1 }}>{schoolName(a)}</span>
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
            <span title="The ring shows how full each committee is. The number is its open seats." style={{ display: 'inline-flex', color: NEU.inkSoft }}>
              <Info size={15} strokeWidth={1.5} />
            </span>
          </span>
          <BigCount n={totalOpen} word="open" size={17} />
        </div>

        {(draggedApp || openPerson) && (
          <div className="flex items-center gap-2.5 flex-none" style={{ padding: '10px 12px', borderRadius: 14, background: WELL }}>
            <PersonAvatar name={personName((draggedApp ?? openPerson)!)} url={(draggedApp ?? openPerson)!.profiles?.avatar_url ?? null} size={30} />
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

      {popupNode}
      {ghost}
    </div>
  );
}

// ── Where a person is from, and how old ──────────────────────────────────────
// The round flag of their nationality and their age, one line (owner, 21 Oct
// 2026: on every smart allocation and on the opened person).
function PersonFacts({ app, size = 'sm' }: { app: AcceptedApp; size?: 'sm' | 'lg' }) {
  const age = ageOf(app);
  const nationality = app.profiles?.nationality?.trim() || null;
  const nat = nationality ? getCountryByName(nationality) : undefined;
  if (!nationality && age == null) return null;
  const lg = size === 'lg';
  return (
    <span className="inline-flex items-center flex-shrink-0" style={{ gap: lg ? 10 : 6, fontSize: lg ? 14 : 12.5, color: NEU.ink, lineHeight: 1.15 }}>
      {nationality && (
        <span className="inline-flex items-center" style={{ gap: lg ? 6 : 4 }} title={nationality}>
          <CountryFlag code={nat?.code ?? null} w={lg ? 20 : 15} h={lg ? 20 : 15} alt={nationality} />
          {lg && <span style={{ fontWeight: 600 }}>{nationality}</span>}
        </span>
      )}
      {age != null && (
        <span style={{ fontWeight: lg ? 500 : 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }} title={`${age} years old`}>
          {lg ? `${age} years old` : `Age ${age}`}
        </span>
      )}
    </span>
  );
}

// ── One smart allocation (the middle feed) ───────────────────────────────────
// Dense, so five or six fit at 1280x800 (owner, 21 Oct 2026): the person on
// one line (avatar, name, flag and age, delegation) with the gold score disc,
// whose hover card is "How this scores"; the seat on an ivory well with a
// compact Assign; the reason badges on one row.
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
      className="flex flex-col"
      style={{ padding: '8px 10px 8px 10px', gap: 5, borderRadius: 18, background: '#FFFFFF', boxShadow: SMART_CARD_SHADOW }}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenPerson}
          title={`Open ${name}`}
          className="focus:outline-none focus-visible:ring-2 flex items-center gap-2 flex-1 min-w-0 text-left"
          style={{ border: 'none', background: 'transparent', padding: '1px 2px', borderRadius: 10, cursor: 'pointer', fontFamily: OUTFIT }}
        >
          <PersonAvatar name={name} url={sug.app.profiles?.avatar_url ?? null} size={28} />
          <span className="flex items-center flex-wrap min-w-0" style={{ gap: '1px 8px', lineHeight: 1.15 }}>
            <span className="[overflow-wrap:anywhere]" style={{ fontSize: 15, fontWeight: 700, color: NEU.ink }}>{name}</span>
            <PersonFacts app={sug.app} />
            <span className="[overflow-wrap:anywhere]" style={{ fontSize: 12.5, color: NEU.inkSoft }}>{schoolName(sug.app)}</span>
          </span>
        </button>
        <ScoreHover
          sug={sug}
          size={32}
          title={sug.swap ? `Fit ${sug.score} here; their own best open seat scored ${sug.swap.ownBestScore}. Hover for how it scores` : undefined}
        />
      </div>

      <div className="flex items-center gap-2" style={{ padding: '3px 3px 3px 7px', borderRadius: 12, background: WELL }}>
        <CountryFlag code={sug.slot.country_code} w={24} h={24} alt={sug.slot.country_name} logoUrl={slotLogoUrl(sug.committee, sug.slot)} />
        <span className="flex items-center flex-wrap flex-1 min-w-0" style={{ gap: '0 8px', lineHeight: 1.15 }}>
          <CountryName name={sug.slot.country_name} code={sug.slot.country_code} style={{ fontSize: 14.5, fontWeight: 700, color: NEU.ink, whiteSpace: 'normal', overflowWrap: 'anywhere' }} />
          <span className="inline-flex items-center gap-1" style={{ fontSize: 12.5, color: NEU.inkSoft }} title={sug.committee.name}>
            <CommitteeLogo committee={sug.committee} size={16} alt={labels.big} />
            <span className="[overflow-wrap:anywhere]" style={{ fontWeight: 600 }}>{labels.big}</span>
          </span>
        </span>
        <NeuButton onClick={onAssign} disabled={busy || locked} style={{ padding: '6px 14px', fontSize: 12.5, letterSpacing: 0, flexShrink: 0 }}>
          {busy ? 'Saving' : 'Assign'}
        </NeuButton>
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
  const city = person.societies?.city?.trim() || null;
  const role = person.role === 'head-delegate' || person.is_head_delegate ? 'Head Delegate' : 'Delegate';

  return (
    <div className="flex flex-col gap-2">
      {/* Who they are */}
      <div className="flex flex-col" style={{ ...card, padding: '10px 14px 14px', gap: 8 }}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <button
            type="button"
            onClick={onBack}
            className="focus:outline-none inline-flex items-center gap-1.5"
            style={{ height: 30, padding: '0 12px 0 8px', marginLeft: -4, borderRadius: 10, border: '1px solid rgba(27,56,40,0.16)', background: '#FFFFFF', cursor: 'pointer', fontFamily: OUTFIT, fontSize: 13, fontWeight: 600, color: NEU.ink }}
          >
            <ArrowLeft size={15} strokeWidth={1.5} /> Back to smart allocations
          </button>
          {acceptedAt(person) && <span style={{ fontSize: 12.5, color: NEU.inkSoft }}>Accepted {fmtDay(acceptedAt(person))}</span>}
        </div>
        <div className="flex items-center gap-3.5">
          <PersonAvatar name={name} url={person.profiles?.avatar_url ?? null} size={60} userId={person.profiles?.id} />
          <div className="flex-1 min-w-0 flex flex-col" style={{ gap: 5 }}>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="[overflow-wrap:anywhere]" style={{ fontSize: 23, fontWeight: 700, lineHeight: 1.1, color: NEU.ink }}>{name}</span>
              {!person.profiles && <NotRegisteredChip />}
            </div>
            <div className="flex items-center flex-wrap" style={{ gap: '4px 12px' }}>
              <PersonFacts app={person} size="lg" />
              <span style={{ fontSize: 13, color: NEU.inkSoft }}>{role}</span>
            </div>
            <div className="flex items-center flex-wrap" style={{ gap: '2px 12px', fontSize: 13.5, lineHeight: 1.25 }}>
              <span className="[overflow-wrap:anywhere]" style={{ color: NEU.inkSoft }}>
                {independent
                  ? 'Independent'
                  : <DelegationPopupLink societyId={person.society_id} style={{ fontWeight: 700, color: NEU.ink, textDecoration: 'underline' }}>{schoolName(person)}</DelegationPopupLink>}
              </span>
              {city && (
                <span className="inline-flex items-center gap-1" style={{ fontSize: 12.5, color: NEU.inkSoft }} title={`${schoolName(person)} is in ${city}`}>
                  <MapPin size={13} strokeWidth={1.5} style={{ color: NEU.ink }} aria-hidden />
                  {city}
                </span>
              )}
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
            <button
              type="button"
              onClick={onChooseAnother}
              title="For any other seat, click a committee on the right"
              className="focus:outline-none max-lg:hidden"
              style={{ height: 30, padding: '0 12px', borderRadius: 10, border: '1px solid rgba(27,56,40,0.16)', background: '#FFFFFF', cursor: 'pointer', fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 600, color: NEU.ink }}
            >
              Choose another seat
            </button>
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
                  <NeuButton onClick={() => onAssign(sug)} disabled={busyKey === key || locked} style={{ padding: '6px 14px', fontSize: 12.5, letterSpacing: 0, flexShrink: 0 }}>
                    {busyKey === key ? 'Saving' : 'Assign'}
                  </NeuButton>
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
