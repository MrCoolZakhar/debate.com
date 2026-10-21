'use client';

// ── The seat board (owner, 21 Oct 2026) ──────────────────────────────────────
// The Assignment page's main view for delegates, in three columns:
//   LEFT    the people still waiting (oldest accepted first) and the
//           delegations, each column scrolling inside itself;
//   MIDDLE  the only part that scrolls with content: every suggested seat
//           (the existing suggestion cards), or one person opened in place
//           with their best three seats;
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
import { ArrowLeft, Hand, Info, Search, X, Award } from 'lucide-react';
import GSelect, { type GSelectOption } from '@/components/GSelect';
import { NEU, NeuButton } from '@/components/neu';
import { getCountryByName } from '@/lib/countries';
import { buildSuggestions, rankSeatsForPerson, type SeatedIdentities } from '@/lib/assignmentFit';
import { useBoardDrag, dropAttr } from '@/app/manage/[slug]/assignment/boardDrag';
import { CountryName, committeeShortName } from '@/app/manage/[slug]/assignment/displayNames';
import { NotRegisteredChip } from '@/app/manage/[slug]/assignment/delegationShared';
import SeatBoardDelegations from '@/app/manage/[slug]/assignment/SeatBoardDelegations';
import { replaceUrlInPlace } from '@/lib/replaceUrlInPlace';
import {
  type AcceptedApp, type CommitteeData, type Suggestion, type UserHistory,
  CountryFlag, PersonAvatar, CommitteeLogo, committeeLabels, committeeSeatLogo, effectiveLevel, ageOf,
  LevelTag, DelegationChip, SuggestionCard, SuggestionReasons, fitColor, slotLogoUrl, OUTFIT,
} from '@/app/manage/[slug]/assignment/assignmentKit';
import { SeatBoardPopup } from '@/app/manage/[slug]/assignment/SeatBoardPopup';
import {
  BigCount, CARD_SHADOW, CommitteeRing, GoldMarker, HAIRLINE, WELL,
  acceptedAt, firstName, fmtDay, ordinal, personName, prefOrderByCommittee, schoolName, seatCounts,
} from '@/app/manage/[slug]/assignment/seatBoardShared';

type SortKey = 'accepted' | 'name' | 'first';
type CommitteeFilter = 'all' | 'none' | `c:${string}`;
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
  const [fCommittee, setFCommittee] = useState<CommitteeFilter>('all');
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
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
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
  const markers = useMemo(() => prefOrderByCommittee(focus), [focus]);

  /** Every assignment: close what is open, back to the suggestions, then the
   *  page's own path (which may show its first-assign pop-up, alone). */
  function assign(sug: Suggestion) {
    setPopup(null);
    setOpenPersonId(null);
    setExpandedKey(null);
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
    const opts: GSelectOption<SchoolFilter>[] = [{ value: 'all', label: 'School' }];
    if (independents) opts.push({ value: 'independent', label: 'Independent' });
    for (const [id, name] of [...seen.entries()].sort((x, y) => byName(x[1], y[1]))) opts.push({ value: `s:${id}`, label: name });
    return opts;
  }, [waiting]);
  const committeeOptions: GSelectOption<CommitteeFilter>[] = useMemo(() => [
    { value: 'all', label: '1st choice' },
    ...committees.map(c => {
      const l = committeeLabels(c);
      return { value: `c:${c.id}` as CommitteeFilter, label: l.big, hint: l.full ?? undefined, icon: <CommitteeLogo committee={c} size={18} /> };
    }),
    { value: 'none', label: 'No preference given' },
  ], [committees]);
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
      const fp = firstPref(a);
      if (fCommittee === 'none' && fp) return false;
      if (fCommittee.startsWith('c:') && fp?.conference_committee_id !== fCommittee.slice(2)) return false;
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
  }, [waiting, search, fCommittee, fSchool, fLevel, sort, committeeById]);

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
  const sortHead = (key: SortKey, label: string, style: React.CSSProperties) => (
    <button
      type="button"
      onClick={() => setSort(key)}
      aria-pressed={sort === key}
      className="focus:outline-none"
      style={{
        border: 'none', background: 'transparent', padding: 0, height: 26, cursor: 'pointer',
        fontFamily: OUTFIT, fontSize: 12, fontWeight: sort === key ? 700 : 500,
        color: sort === key ? NEU.forest : NEU.inkSoft, ...style,
      }}
    >
      {label}
    </button>
  );

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
              gap: 5, padding: '12px 2px 10px', borderRadius: 14, border: 'none', cursor: 'pointer',
              background: lit ? '#FFFFFF' : '#FAF8F3',
              boxShadow: lit ? `0 0 0 2px #1B3828, 0 8px 20px rgba(27,56,40,0.18)` : '0 0 0 1px rgba(27,56,40,0.06)',
              transform: lit ? 'scale(1.04)' : 'none',
              transition: 'box-shadow 160ms cubic-bezier(0.22,1,0.36,1), transform 160ms cubic-bezier(0.22,1,0.36,1)',
              fontFamily: OUTFIT, color: NEU.ink,
            }}
          >
            <CommitteeRing committee={c} marker={markers.get(c.id)} lit={lit} />
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
      <div className="flex items-center justify-between gap-3 flex-none" style={{ minHeight: 40 }}>
        <span className="inline-flex items-center gap-2">
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, fontFamily: OUTFIT, color: NEU.ink }}>Suggested Seats</h2>
          <span style={{ fontSize: 15, fontWeight: 600, color: NEU.inkSoft, fontVariantNumeric: 'tabular-nums', fontFamily: OUTFIT }}>{feed.length}</span>
          <span title="Ranked by preferences, experience fit and how full each committee is" style={{ display: 'inline-flex', color: NEU.inkSoft }}>
            <Info size={16} strokeWidth={1.5} />
          </span>
        </span>
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
        <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 430px), 1fr))', alignItems: 'start' }}>
          {feed.map(sug => {
            const key = `${sug.app.id}-${sug.slot.id}`;
            return (
              <SuggestionCard
                key={key}
                sug={sug}
                busy={busyKey === key}
                locked={locked}
                expanded={expandedKey === key}
                onToggle={() => setExpandedKey(prev => (prev === key ? null : key))}
                history={sug.app.profiles ? history[sug.app.profiles.id] : undefined}
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
          placeholder={tab === 'people' ? 'Search a name or school' : 'Search a delegation'}
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
        <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
          <GSelect<CommitteeFilter> value={fCommittee} onChange={setFCommittee} options={committeeOptions} size="sm" aria-label="Filter by 1st choice committee" panelMinWidth={240} searchable={committees.length > 8} searchPlaceholder="Find a committee" />
          <GSelect<SchoolFilter> value={fSchool} onChange={setFSchool} options={schoolOptions} size="sm" aria-label="Filter by school or delegation" panelMinWidth={240} searchPlaceholder="Find a school" />
          <GSelect<LevelFilter> value={fLevel} onChange={setFLevel} options={levelOptions} size="sm" aria-label="Filter by level" panelMinWidth={180} align="end" />
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
      className="flex flex-col gap-4 lg:grid lg:flex-1 lg:min-h-0 lg:grid-cols-[296px_minmax(0,1fr)_312px] 2xl:grid-cols-[340px_minmax(0,1fr)_380px]"
      style={{ fontFamily: OUTFIT, color: NEU.ink }}
    >
      {/* ── LEFT: who is waiting ─────────────────────────────────────────── */}
      <section
        className="order-1 flex flex-col overflow-hidden max-lg:max-h-[70dvh] lg:min-h-0"
        style={{ background: '#FFFFFF', borderRadius: 20, boxShadow: CARD_SHADOW }}
      >
        {leftHeader}

          <>
            <div className="flex items-center gap-1.5 flex-none" style={{ margin: '0 8px', padding: '0 8px', height: 30, borderTop: `1px solid ${HAIRLINE}`, borderBottom: `1px solid ${HAIRLINE}` }}>
              {sortHead('name', 'Name', { flex: 1, textAlign: 'left' })}
              {sortHead('first', '1st choice', { width: 64, textAlign: 'left' })}
              {sortHead('accepted', 'Accepted', { width: 56, textAlign: 'right' })}
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto" style={{ padding: '4px 8px 8px', overscrollBehavior: 'contain' }}>
              {people.length === 0 && (
                <p className="text-center py-8" style={{ fontSize: 13.5, color: NEU.inkSoft }}>
                  {waiting.length === 0 ? 'Nobody is waiting for a seat' : 'Nobody matches these filters'}
                </p>
              )}
              {people.map(a => {
                const name = personName(a);
                const fp = firstPref(a);
                const fpCommittee = fp ? committeeById.get(fp.conference_committee_id) : undefined;
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
                    className="flex items-center gap-1.5 focus:outline-none focus-visible:ring-2"
                    style={{
                      padding: '7px 8px', borderRadius: 11, cursor: 'grab',
                      background: open ? WELL : 'transparent',
                      boxShadow: open ? 'inset 0 0 0 1.5px #1B3828' : 'none',
                      opacity: dragged ? 0.45 : 1,
                    }}
                    onMouseEnter={e => { if (!open) (e.currentTarget as HTMLElement).style.background = '#FAF8F3'; }}
                    onMouseLeave={e => { if (!open) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    <PersonAvatar name={name} url={a.profiles?.avatar_url ?? null} size={28} />
                    <span className="flex flex-col flex-1 min-w-0" style={{ paddingLeft: 4, lineHeight: 1.2 }}>
                      <span className="[overflow-wrap:anywhere] inline-flex items-center gap-1.5 flex-wrap" style={{ fontSize: 13, fontWeight: 600 }}>
                        {name}{!a.profiles && <NotRegisteredChip />}
                      </span>
                      <span className="[overflow-wrap:anywhere]" style={{ fontSize: 11.5, color: NEU.inkSoft }}>{schoolName(a)}</span>
                    </span>
                    <span
                      className="inline-flex items-center gap-1 flex-shrink-0"
                      style={{ width: 64 }}
                      title={fp ? `${fp.conference_committees?.name ?? (fpCommittee?.name ?? 'Committee')} · ${fp.country_name}` : 'No preference given'}
                    >
                      {fp ? (
                        <>
                          {fpCommittee
                            ? <CommitteeLogo committee={fpCommittee} size={20} alt={committeeLabels(fpCommittee).big} />
                            : <span style={{ fontSize: 11, fontWeight: 700 }}>{committeeShortName(fp.conference_committees)}</span>}
                          <CountryFlag code={fp.country_code} w={18} h={18} alt={fp.country_name} logoUrl={fpCommittee ? committeeSeatLogo(fpCommittee, fp.country_code) : null} />
                        </>
                      ) : (
                        <span style={{ fontSize: 11.5, color: NEU.inkSoft }}>None</span>
                      )}
                    </span>
                    <span className="flex-shrink-0 text-right" style={{ width: 56, fontSize: 12, color: NEU.inkSoft, fontVariantNumeric: 'tabular-nums' }}>
                      {fmtDay(acceptedAt(a))}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
      </section>

      {/* ── MIDDLE: the suggestions, or one person ───────────────────────── */}
      <section
        ref={middleRef}
        className={`order-3 lg:order-2 flex flex-col gap-3 min-w-0 lg:min-h-0 lg:overflow-y-auto lg:pt-0.5 lg:pr-1.5 lg:pb-3 lg:pl-0.5 ${openPerson ? 'max-lg:fixed max-lg:left-0 max-lg:right-0 md:max-lg:left-[96px] max-lg:bottom-0 max-lg:top-14 max-lg:z-40 max-lg:overflow-y-auto max-lg:p-4' : ''}`}
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
                {draggedApp && markers.get(overCommittee.id) ? `. Their ${ordinal(markers.get(overCommittee.id)!)} choice` : ''}
                {`, ${seatCounts(overCommittee).open} open`}
              </>
            ) : focus && markers.size > 0 ? (
              <>Gold numbers are {firstName(personName(focus))}&apos;s 1st, 2nd and 3rd choices</>
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

// ── One person, opened in the middle ─────────────────────────────────────────
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
  const age = ageOf(person);
  const nationality = person.profiles?.nationality ?? null;
  const natCountry = nationality ? getCountryByName(nationality) : undefined;
  const prefs = [...(person.application_preferences ?? [])].sort((a, b) => a.preference_order - b.preference_order).slice(0, 3);
  const byId = new Map(committees.map(c => [c.id, c]));
  const card: React.CSSProperties = { background: '#FFFFFF', borderRadius: 20, boxShadow: CARD_SHADOW };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3 flex-wrap" style={{ minHeight: 40 }}>
        <button
          type="button"
          onClick={onBack}
          className="focus:outline-none inline-flex items-center gap-2"
          style={{ height: 38, padding: '0 14px 0 10px', borderRadius: 12, border: '1px solid rgba(27,56,40,0.16)', background: '#FFFFFF', cursor: 'pointer', fontFamily: OUTFIT, fontSize: 13.5, fontWeight: 600, color: NEU.ink }}
        >
          <ArrowLeft size={16} strokeWidth={1.5} /> Back to suggestions
        </button>
        {acceptedAt(person) && <span style={{ fontSize: 13, color: NEU.inkSoft }}>Accepted {fmtDay(acceptedAt(person))}</span>}
      </div>

      {/* Who they are */}
      <div className="flex flex-col gap-4" style={{ ...card, padding: 20 }}>
        <div className="flex items-start gap-4">
          <PersonAvatar name={name} url={person.profiles?.avatar_url ?? null} size={64} userId={person.profiles?.id} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="[overflow-wrap:anywhere]" style={{ fontSize: 22, fontWeight: 600, lineHeight: 1.15 }}>{name}</span>
              {!person.profiles && <NotRegisteredChip />}
            </div>
            <div className="flex items-center gap-x-3 gap-y-1.5 flex-wrap mt-2" style={{ fontSize: 13, color: NEU.inkSoft }}>
              {age != null && <span>{age} years old</span>}
              {nationality && (
                <span className="inline-flex items-center gap-1.5">
                  {natCountry && <CountryFlag code={natCountry.code} w={16} h={16} alt={nationality} />}
                  {nationality}
                </span>
              )}
              <LevelTag level={effectiveLevel(person)} />
              <span>{person.role === 'head-delegate' || person.is_head_delegate ? 'Head Delegate' : 'Delegate'}</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap mt-2.5">
              <DelegationChip app={person} openable />
            </div>
          </div>
        </div>

        <div>
          <h3 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 600 }}>Preferences</h3>
          {prefs.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: NEU.inkSoft }}>No preference given</p>
          ) : (
            <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 200px), 1fr))' }}>
              {prefs.map((p, i) => {
                const c = byId.get(p.conference_committee_id);
                const slot = c?.committee_country_slots.find(s => s.country_code === p.country_code);
                const held = c ? c.conference_allocations.filter(a => a.country_code === p.country_code).length : 0;
                const taken = !!slot && held >= slot.delegation_size;
                return (
                  <div key={`${p.preference_order}-${p.conference_committee_id}`} className="flex items-center gap-2.5" style={{ padding: '10px 12px', borderRadius: 14, background: WELL }}>
                    <GoldMarker order={i + 1} size={20} />
                    {c ? <CommitteeLogo committee={c} size={26} alt={committeeLabels(c).big} /> : null}
                    <span className="flex flex-col min-w-0" style={{ lineHeight: 1.2 }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }} title={p.conference_committees?.name ?? c?.name}>
                        {c ? committeeLabels(c).big : committeeShortName(p.conference_committees)}
                      </span>
                      <span className="inline-flex items-center gap-1.5 flex-wrap" style={{ fontSize: 12.5 }}>
                        <CountryFlag code={p.country_code} w={15} h={15} alt={p.country_name} logoUrl={c ? committeeSeatLogo(c, p.country_code) : null} />
                        <CountryName name={p.country_name} code={p.country_code} style={{ whiteSpace: 'normal', overflowWrap: 'anywhere' }} />
                        {taken && <span style={{ color: NEU.inkSoft }}>is taken</span>}
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Their best three seats */}
      <div className="flex flex-col gap-2.5" style={{ ...card, padding: 20 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Best Three Seats</h3>
        {bestThree.length === 0 && <p style={{ margin: 0, fontSize: 13, color: NEU.inkSoft }}>No open seat fits {firstName(name)} right now</p>}
        {bestThree.map(sug => {
          const key = `${sug.app.id}-${sug.slot.id}`;
          return (
            <div key={key} className="flex items-center gap-4 flex-wrap" style={{ padding: '12px 14px', borderRadius: 16, background: '#FAF8F3', boxShadow: '0 0 0 1px rgba(27,56,40,0.06)' }}>
              <span style={{ fontSize: 30, fontWeight: 700, color: fitColor(sug.score), fontVariantNumeric: 'tabular-nums', lineHeight: 1, minWidth: 44 }}>{sug.score}</span>
              <div className="flex-1 min-w-0" style={{ minWidth: 180 }}>
                <div className="flex items-center gap-2 flex-wrap">
                  <CommitteeLogo committee={sug.committee} size={24} alt={committeeLabels(sug.committee).big} />
                  <span style={{ fontSize: 14, fontWeight: 600 }} title={sug.committee.name}>{committeeLabels(sug.committee).big}</span>
                  <CountryFlag code={sug.slot.country_code} w={18} h={18} alt={sug.slot.country_name} logoUrl={slotLogoUrl(sug.committee, sug.slot)} />
                  <CountryName name={sug.slot.country_name} code={sug.slot.country_code} style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'normal', overflowWrap: 'anywhere' }} />
                </div>
                <div className="flex items-center gap-1.5 flex-wrap mt-2">
                  <SuggestionReasons sug={sug} max={4} />
                </div>
              </div>
              <NeuButton onClick={() => onAssign(sug)} disabled={busyKey === key || locked} style={{ padding: '9px 18px', fontSize: 13, letterSpacing: 0 }}>
                {busyKey === key ? '…' : 'Assign'}
              </NeuButton>
            </div>
          );
        })}
        <div className="flex items-center gap-3 flex-wrap pt-1">
          <button
            type="button"
            onClick={onChooseAnother}
            className="focus:outline-none max-lg:hidden"
            style={{ height: 36, padding: '0 14px', borderRadius: 10, border: '1px solid rgba(27,56,40,0.16)', background: '#FFFFFF', cursor: 'pointer', fontFamily: OUTFIT, fontSize: 13, fontWeight: 600, color: NEU.ink }}
          >
            Choose another seat
          </button>
          <span className="max-lg:hidden" style={{ fontSize: 12.5, color: NEU.inkSoft }}>For any other seat, click a committee on the right</span>
        </div>
        <div className="lg:hidden flex flex-col gap-2 pt-1">
          <span style={{ fontSize: 13, fontWeight: 600 }}>Choose another seat</span>
          {phoneRings}
        </div>
      </div>

      {/* What they have done before */}
      {history && (history.conferences > 0 || history.awardLabels.length > 0) && (
        <div className="flex flex-col gap-2" style={{ ...card, padding: 20 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Experience</h3>
          <span style={{ fontSize: 13, color: NEU.inkSoft }}>
            <strong style={{ color: NEU.ink, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{history.conferences}</strong> {history.conferences === 1 ? 'conference' : 'conferences'} on their MUN CV
          </span>
          {history.awardLabels.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <Award size={14} strokeWidth={1.5} style={{ color: NEU.ink, flexShrink: 0 }} />
              {history.awardLabels.map((l, i) => (
                <span key={`${l}-${i}`} style={{ fontSize: 12.5, color: NEU.ink }}>{l}{i < history.awardLabels.length - 1 ? ',' : ''}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

