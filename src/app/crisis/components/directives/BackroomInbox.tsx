'use client';
// Gavelling Crisis: the backroom inbox. A queue on the left, the open directive on the right
// (one pane with a back button on phones). Used at /directives and as the backroomer's home.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CircleCheck, Hourglass, Inbox, Landmark, ListChecks, Palette, Search, Tag, UserRound, UsersRound, type LucideIcon } from 'lucide-react';
import GSelect from '@/components/GSelect';
import { notifyErr } from '@/lib/appNotify';
import { crisisError, listDirectives } from '@/lib/crisis/api';
import { useCrisisLive } from '@/lib/crisis/live';
import { KIND_LABEL, THEMES, type Directive, type DirectiveKind } from '@/lib/crisis/types';
import { Btn, Card, CK, Segmented, Skeleton, fieldStyle, waitLabel, waitSeverity } from '../../crisisKit';
import QueueRow from './QueueRow';
import { useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import DirectiveDetail from './DirectiveDetail';
import DirectiveDeepLink from '../notifications/DirectiveDeepLink';
import {
  NO_FILTERS, buildNames, inLane, lastAnsweredByAuthor, matchesFilters, sortDirectives,
  type Filters, type Lane, type QueueOrder,
} from './directiveKit';

const LANE_ICON: Record<Lane, LucideIcon> = { mine: UserRound, unclaimed: Inbox, open: ListChecks, waiting: Hourglass, answered: CircleCheck };

/** The lanes as icon tabs: the word, then its count as a bold number. */
function LaneTabs({ value, options, onChange }: { value: Lane; options: Array<{ value: Lane; label: string; count: number }>; onChange: (l: Lane) => void }) {
  return (
    <div role="tablist" aria-label="Directive lanes" className="inline-flex" style={{ background: CK.well, borderRadius: 13, padding: 3, gap: 2 }}>
      {options.map((o) => {
        const on = o.value === value;
        const I = LANE_ICON[o.value];
        return (
          <button key={o.value} role="tab" aria-selected={on} onClick={() => onChange(o.value)}
            className="inline-flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
            style={{ border: 0, gap: 6, padding: '6px 11px', borderRadius: 10, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: CK.font,
              background: on ? CK.card : 'transparent', color: on ? CK.forest : CK.inkSoft, boxShadow: on ? CK.shadowSm : 'none' }}>
            <I size={15} strokeWidth={1.5} aria-hidden style={{ color: on ? CK.red : CK.muted }} />
            {o.label}
            <b style={{ fontVariantNumeric: 'tabular-nums', fontSize: 13.5, color: on ? CK.red : CK.ink }}>{o.count}</b>
          </button>
        );
      })}
    </div>
  );
}

/** A filter dropdown with its icon in front. */
function FilterBox({ icon, width, children }: { icon: LucideIcon; width: number; children: React.ReactNode }) {
  const I = icon;
  return (
    <div className="flex items-center" style={{ width, gap: 6 }}>
      <I size={16} strokeWidth={1.5} aria-hidden style={{ color: CK.red, flex: 'none' }} />
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  );
}

export default function BackroomInbox() {
  const { ref, staff, director, memberId, core, settings } = useCrisis();
  const names = useMemo(() => buildNames(core.cabinets, core.characters, core.members), [core]);

  const [directives, setDirectives] = useState<Directive[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lane, setLane] = useState<Lane>(director ? 'open' : 'mine');
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [order, setOrder] = useState<QueueOrder>(settings.queueOrder);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [notesVersion, setNotesVersion] = useState(0);
  const loadedOnce = useRef(false);

  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 30_000); return () => window.clearInterval(t); }, []);

  const load = useCallback(async () => {
    try {
      const rows = await listDirectives(ref);
      loadedOnce.current = true;
      setDirectives(rows);
      setLoadError(null);
    } catch (e) {
      // A failed re-read keeps what is on screen; only the first load shows the problem.
      if (!loadedOnce.current) setLoadError(crisisError(e, 'Could not load the directives.'));
      else notifyErr(crisisError(e, 'Could not refresh the directives.'), 'crisis-directives-refresh');
    }
  }, [ref]);

  useEffect(() => {
    if (!staff) return;
    let cancelled = false;
    listDirectives(ref).then((rows) => {
      if (cancelled) return;
      loadedOnce.current = true;
      setDirectives(rows);
    }).catch((e) => { if (!cancelled) setLoadError(crisisError(e, 'Could not load the directives.')); });
    return () => { cancelled = true; };
  }, [staff, ref]);
  useCrisisLive(staff ? ref.id : null, ['crisis_directives', 'crisis_directive_notes'], (changed) => {
    void load();
    if (!changed || changed.has('crisis_directive_notes')) setNotesVersion((v) => v + 1);
  });

  const all = useMemo(() => (directives ?? []).filter((d) => d.status !== 'withdrawn'), [directives]);
  const lastAnswered = useMemo(() => lastAnsweredByAuthor(all), [all]);

  const counts = useMemo(() => {
    const c: Record<Lane, number> = { mine: 0, unclaimed: 0, open: 0, waiting: 0, answered: 0 };
    for (const d of all) for (const l of Object.keys(c) as Lane[]) if (inLane(d, l, memberId)) c[l] += 1;
    return c;
  }, [all, memberId]);

  const queue = useMemo(
    () => sortDirectives(all.filter((d) => inLane(d, lane, memberId) && matchesFilters(d, filters, names)), order, lane, lastAnswered),
    [all, lane, memberId, filters, names, order, lastAnswered],
  );

  // Open the first directive on a wide screen so the right pane is never empty.
  if (!selectedId && queue.length && typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches) {
    setSelectedId(queue[0].id);
  }

  const selected = useMemo(() => all.find((d) => d.id === selectedId) ?? null, [all, selectedId]);

  // A notification link (?d=<id>): select that directive and switch to a lane that holds it.
  const [linkedId, setLinkedId] = useState<string | null>(null);
  useEffect(() => {
    if (!linkedId) return;
    const d = all.find((x) => x.id === linkedId);
    if (!d) return;
    const lanes: Lane[] = ['mine', 'unclaimed', 'open', 'waiting', 'answered'];
    const target = inLane(d, lane, memberId) ? lane : lanes.find((l) => inLane(d, l, memberId));
    /* eslint-disable react-hooks/set-state-in-effect */
    if (target && target !== lane) setLane(target);
    setFilters(NO_FILTERS);
    setSelectedId(d.id);
    setMobileOpen(true);
    setLinkedId(null);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [linkedId, all, lane, memberId]);

  const pick = (id: string) => { setSelectedId(id); setMobileOpen(true); };

  const afterChange = (what: 'claimed' | 'assigned' | 'answered') => {
    if (what === 'answered' && selected) {
      const i = queue.findIndex((d) => d.id === selected.id);
      const next = queue[i + 1] ?? queue[i - 1];
      if (next && (lane === 'mine' || lane === 'unclaimed' || lane === 'open')) setSelectedId(next.id);
      setMobileOpen(false);
    }
    void load();
  };

  const staffMembers = core.members.filter((m) => m.role === 'director' || m.role === 'assistant_director' || m.role === 'backroomer');
  const cabinetOptions = [{ value: '', label: 'All cabinets' }, ...core.cabinets.map((c) => ({ value: c.id, label: c.name }))];
  const backroomerOptions = [
    { value: '', label: 'All backroomers' }, { value: 'none', label: 'Unclaimed' },
    ...staffMembers.map((m) => ({ value: m.id, label: m.display_name })),
  ];
  const themeOptions = [{ value: '', label: 'All themes' }, ...THEMES.map((t) => ({ value: t, label: t }))];
  const kindOptions = [{ value: '', label: 'All kinds' }, ...(Object.keys(KIND_LABEL) as DirectiveKind[]).map((k) => ({ value: k, label: KIND_LABEL[k] }))];
  const setF = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }));

  if (!staff) {
    return <Card style={{ marginTop: 8 }}><h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Only crisis staff can see the backroom</h2></Card>;
  }

  const laneOptions: Array<{ value: Lane; label: string; count: number }> = [
    { value: 'mine', label: 'Mine', count: counts.mine },
    { value: 'unclaimed', label: 'Unclaimed', count: counts.unclaimed },
    { value: 'open', label: 'All open', count: counts.open },
    { value: 'waiting', label: 'Waiting for delegate', count: counts.waiting },
    { value: 'answered', label: 'Answered', count: counts.answered },
  ];

  const emptyText: Record<Lane, string> = {
    mine: 'Nothing waiting for you', unclaimed: 'Every directive has someone on it', open: 'No open directives',
    waiting: 'Nobody is waiting on a delegate', answered: 'Nothing answered yet',
  };

  const paneH = 'lg:h-[calc(100dvh-210px)] lg:min-h-[420px]';

  return (
    <div className="flex flex-col" style={{ gap: 10, marginTop: 6, width: '100%' }}>
      <DirectiveDeepLink onId={setLinkedId} />
      <div className="flex items-center justify-between flex-wrap" style={{ gap: 10 }}>
        <h1 className="flex items-center" style={{ margin: 0, gap: 8, fontSize: 22, fontWeight: 800, color: CK.ink }}><ListChecks size={22} strokeWidth={1.5} aria-hidden style={{ color: CK.red }} />Directives</h1>
        <div style={{ maxWidth: '100%', overflowX: 'auto' }}>
          <LaneTabs value={lane} options={laneOptions} onChange={setLane} />
        </div>
      </div>

      <div className="flex items-center flex-wrap" style={{ gap: 8 }}>
        <FilterBox icon={Landmark} width={185}><GSelect size="sm" aria-label="Cabinet" value={filters.cabinet} options={cabinetOptions} onChange={(v) => setF({ cabinet: v })} /></FilterBox>
        <FilterBox icon={UsersRound} width={195}><GSelect size="sm" aria-label="Backroomer" value={filters.backroomer} options={backroomerOptions} onChange={(v) => setF({ backroomer: v })} /></FilterBox>
        <FilterBox icon={Palette} width={175}><GSelect size="sm" aria-label="Theme" value={filters.theme} options={themeOptions} onChange={(v) => setF({ theme: v })} /></FilterBox>
        <FilterBox icon={Tag} width={195}><GSelect size="sm" aria-label="Kind" value={filters.kind} options={kindOptions} onChange={(v) => setF({ kind: v })} /></FilterBox>
        <label className="relative" style={{ flex: '1 1 200px', maxWidth: 360 }}>
          <Search size={15} strokeWidth={1.5} aria-hidden style={{ position: 'absolute', left: 10, top: 9, color: CK.muted }} />
          <input value={filters.search} onChange={(e) => setF({ search: e.target.value })} aria-label="Search directives"
            placeholder="Search number, title, author, text" style={{ ...fieldStyle, padding: '6px 10px 6px 31px', fontSize: 13, minHeight: 30 }} />
        </label>
        <span className="flex-1" />
        <Segmented ariaLabel="Queue order" value={order} onChange={setOrder}
          options={[{ value: 'fair', label: 'Fair' }, { value: 'oldest', label: 'Oldest' }, { value: 'newest', label: 'Newest' }]} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[430px_minmax(0,1fr)]" style={{ gap: 12, alignItems: 'start' }}>
        <Card className={`${mobileOpen ? 'hidden lg:block' : 'block'} ${paneH} lg:overflow-y-auto`} style={{ padding: 8 }}>
          {directives === null && !loadError && (
            <div className="flex flex-col" style={{ gap: 8, padding: 4 }} aria-busy="true">
              {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} h={120} r={16} />)}
            </div>
          )}
          {loadError && (
            <div style={{ padding: 12 }}>
              <p style={{ margin: '0 0 8px', fontSize: 14, color: CK.inkSoft }}>{loadError}</p>
              <Btn onClick={() => { setLoadError(null); void load(); }}>Try again</Btn>
            </div>
          )}
          {directives !== null && queue.length === 0 && (
            <p style={{ margin: 0, padding: 16, fontSize: 14, color: CK.muted }}>{emptyText[lane]}</p>
          )}
          <ul style={{ listStyle: 'none', margin: 0, padding: '0 0 6px' }} className="flex flex-col">
            {queue.map((d) => {
              const waiting = lane !== 'answered' && lane !== 'waiting';
              const sev = waiting ? waitSeverity(d.waiting_since, now) : null;
              const when = lane === 'answered' ? `Answered ${waitLabel(d.answered_at, now)} ago`
                : lane === 'waiting' ? `Asked ${waitLabel(d.answered_at, now)} ago` : waitLabel(d.waiting_since, now);
              return (
                <li key={d.id} style={{ margin: '0 4px', minWidth: 0 }}>
                  <QueueRow d={d} names={names} whenLabel={when} sev={sev} selected={d.id === selectedId}
                    delegateNote={d.status === 'queued' && d.outcome === 'clarify'} onOpen={() => pick(d.id)} />
                </li>
              );
            })}
          </ul>
        </Card>

        <Card warm className={`${mobileOpen ? 'block' : 'hidden lg:block'} ${paneH} lg:overflow-y-auto`} style={{ padding: '16px 18px' }}>
          {selected ? (
            <DirectiveDetail key={selected.id} directive={selected} notesVersion={notesVersion} onChanged={afterChange} onClose={() => setMobileOpen(false)} />
          ) : (
            <p style={{ margin: 0, fontSize: 14, color: CK.muted }}>{directives === null ? 'Loading' : 'Pick a directive from the queue'}</p>
          )}
        </Card>
      </div>
    </div>
  );
}
