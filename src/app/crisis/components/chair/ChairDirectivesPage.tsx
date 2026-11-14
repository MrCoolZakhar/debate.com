'use client';
// Gavelling Crisis: the chair's "Directives" tab, the same one-by-one reader as the backroom (DirectiveReader) but READ ONLY. Every
// directive the chair may read: their cabinet's cabinet directives and, when the Crisis Director allows it (settings.chairReadsPersonal),
// the personal and joint ones of their cabinet's characters. Filter by state, newest first. Pressing the front directive opens the
// same pop-up the Front Room uses (ChairDirectivePrompt.tsx): a waiting one shows Approve, Request changes and Reject, any other
// opens read only. The page itself never decides anything and has no reply box.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollText } from 'lucide-react';
import { crisisError, DIRECTIVE_PAGE, listClosedDirectivesPage, listDirectives } from '@/lib/crisis/api';
import { useCrisisLive } from '@/lib/crisis/live';
import type { Directive } from '@/lib/crisis/types';
import { useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import { Btn, Card, CK, agoLabel, Skeleton, Tick } from '../../crisisKit';
import DirectiveDeepLink from '../notifications/DirectiveDeepLink';
import DirectiveReader, { type ReaderReadOnly } from '../directives/DirectiveReader';
import { buildNames } from '../directives/directiveKit';
import { useNow } from '../directives/useNow';
import { chairGroup, chairVerdict, GROUP_WORDS, openChairDirective, useRequestedChairDirective, type ChairGroup } from './chairDirectiveKit';

type Filter = 'waiting' | 'changes' | 'backroom' | 'answered' | 'rejected' | 'all';
const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: 'waiting', label: GROUP_WORDS.waiting },
  { id: 'changes', label: GROUP_WORDS.changes },
  { id: 'backroom', label: GROUP_WORDS.backroom },
  { id: 'answered', label: GROUP_WORDS.answered },
  { id: 'rejected', label: GROUP_WORDS.rejected },
  { id: 'all', label: 'All' },
];

const isClosed = (d: Directive): boolean => d.status === 'answered' || d.status === 'rejected' || d.status === 'withdrawn';

/** How the reader says a directive's state to a chair, and what its button says. Another cabinet's directive is only ever opened, never decided. */
const readOnlyFor = (cabinetId: string | null): ReaderReadOnly => ({
  stateOf: (d) => chairVerdict(d, 16),
  actionLabel: (d) => (d.status === 'awaiting_chair' && (!cabinetId || d.cabinet_id === cabinetId) ? 'Decide' : 'Open'),
  when: (d, now) => (d.answered_at && (d.status === 'answered' || d.status === 'rejected') ? `Answered ${agoLabel(d.answered_at, now)}` : `Sent ${agoLabel(d.created_at, now)}`),
});

function newestFirst(a: Directive, b: Directive): number {
  return b.created_at.localeCompare(a.created_at) || b.no - a.no;
}

export default function ChairDirectivesPage() {
  const { ref, cabinetId, settings, core } = useCrisis();
  const names = useMemo(() => buildNames(core.cabinets, core.characters, core.members), [core]);
  const now = useNow();
  const requested = useRequestedChairDirective();
  const [focusId, setFocusId] = useState<string | null>(null);
  const [rows, setRows] = useState<Directive[] | null>(null);
  const [more, setMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('waiting');
  const [pickedFilter, setPickedFilter] = useState(false);
  const [deepTick, setDeepTick] = useState(0);
  const seq = useRef(0);
  const deepId = useRef<string | null>(null);

  const read = useCallback(async () => {
    const mine = ++seq.current;
    try {
      const d = await listDirectives(ref);
      if (mine !== seq.current) return;
      // Older pages already fetched stay; the fresh read replaces what it covers.
      setRows((old) => {
        if (!old) return d;
        const fresh = new Set(d.map((x) => x.id));
        const lowestClosed = d.filter(isClosed).reduce((m, x) => Math.min(m, x.no), Infinity);
        return [...d, ...old.filter((x) => !fresh.has(x.id) && isClosed(x) && x.no < lowestClosed)];
      });
      setMore((m) => m || d.filter(isClosed).length >= DIRECTIVE_PAGE);
      setError(null);
    } catch (e) {
      if (mine === seq.current) setError(crisisError(e, 'Could not refresh this page.'));
    }
  }, [ref]);

  useEffect(() => {
    const t = window.setTimeout(() => { void read(); }, 0);
    return () => window.clearTimeout(t);
  }, [read]);
  useCrisisLive(ref.id, ['crisis_directives'], () => { void read(); });

  const readOnly = useMemo(() => readOnlyFor(cabinetId), [cabinetId]);
  // A chair reads only their own cabinet's directives, never another cabinet's: the screen may be projected (docs/crisis/sql/039).
  // Personal and joint ones only when the crisis allows it.
  const readable = useMemo(() => (rows ?? []).filter((d) => {
    if (!!cabinetId && d.cabinet_id !== cabinetId) return false;
    if (d.kind === 'committee') return true;
    return settings.chairReadsPersonal && (d.kind === 'personal' || d.kind === 'joint');
  }).sort(newestFirst), [rows, cabinetId, settings.chairReadsPersonal]);

  // What is waiting for THIS chair's own decision: only their own cabinet's cabinet directives.
  const counts = useMemo(() => {
    const c: Record<ChairGroup, number> = { waiting: 0, changes: 0, backroom: 0, answered: 0, rejected: 0, withdrawn: 0 };
    for (const d of readable) {
      // The other cabinet's directive waiting for ITS chair is not waiting for you: it shows under All only.
      if (chairGroup(d) === 'waiting' && cabinetId && d.cabinet_id !== cabinetId) continue;
      c[chairGroup(d)] += 1;
    }
    return c;
  }, [readable, cabinetId]);
  const waitingMine = counts.waiting;

  // With nothing waiting, open on All instead of an empty list (until the chair picks a filter themselves).
  const active: Filter = !pickedFilter && rows !== null && counts.waiting === 0 ? 'all' : filter;
  const shown = useMemo(() => (active === 'all' ? readable : readable.filter((d) => chairGroup(d) === active && !(active === 'waiting' && cabinetId && d.cabinet_id !== cabinetId))), [readable, active, cabinetId]);

  const loadMore = async () => {
    if (loadingMore || !rows) return;
    const closed = rows.filter(isClosed);
    const before = closed.reduce((m, d) => Math.min(m, d.no), Infinity);
    if (!Number.isFinite(before)) return;
    setLoadingMore(true);
    try {
      const page = await listClosedDirectivesPage(ref, before);
      setRows((old) => {
        const have = new Set((old ?? []).map((x) => x.id));
        return [...(old ?? []), ...page.filter((x) => !have.has(x.id))];
      });
      setMore(page.length >= DIRECTIVE_PAGE);
    } catch (e) {
      setError(crisisError(e, 'Could not load older directives.'));
    } finally {
      setLoadingMore(false);
    }
  };

  // A notification link (?d=<directive id>) opens that directive in the pop-up.
  const onDeepId = useCallback((id: string) => { deepId.current = id; setDeepTick((x) => x + 1); }, []);
  useEffect(() => {
    void deepTick;
    const id = deepId.current;
    if (!id || !rows) return;
    deepId.current = null;
    const hit = rows.find((d) => d.id === id);
    if (hit) openChairDirective(hit);
  }, [deepTick, rows]);

  // The directive in front: the one picked, else the first of the filter.
  const front = useMemo(() => shown.find((d) => d.id === focusId) ?? shown[0] ?? null, [shown, focusId]);
  const urgent = waitingMine > 0;

  return (
    <div style={{ paddingTop: 8 }}>
      <DirectiveDeepLink onId={onDeepId} />
      <header className="flex items-center justify-between flex-wrap" style={{ gap: '6px 16px', marginBottom: 12 }}>
        <h1 className="flex items-center gap-2" style={{ margin: 0, fontSize: 24, fontWeight: 800, color: CK.ink }}>
          <span style={{ color: CK.red, lineHeight: 0 }}><ScrollText size={22} strokeWidth={1.5} aria-hidden /></span>
          Directives
        </h1>
        {rows !== null && (
          <span className="inline-flex items-baseline" style={{ gap: 6 }}>
            <b style={{ fontSize: 28, fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums', color: urgent ? CK.red : CK.muted }}><Tick value={waitingMine} /></b>
            <span style={{ fontSize: 13, fontWeight: 700, color: urgent ? CK.red : CK.inkSoft }}>waiting for you</span>
          </span>
        )}
      </header>
      {error && <p role="status" style={{ margin: '0 0 8px', fontSize: 13, color: CK.danger }}>{error}</p>}

      <div role="tablist" aria-label="Filter directives" className="flex flex-wrap" style={{ gap: 8, marginBottom: 14 }}>
        {FILTERS.map((f) => {
          const on = f.id === active;
          const n = f.id === 'all' ? readable.length : counts[f.id];
          return (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => { setPickedFilter(true); setFilter(f.id); }}
              className="inline-flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
              style={{
                gap: 7, border: 0, cursor: 'pointer', fontFamily: CK.font, fontSize: 13, fontWeight: 700, borderRadius: 11, padding: '7px 12px',
                background: on ? CK.card : 'transparent', color: on ? CK.forest : CK.inkSoft,
                boxShadow: on ? CK.shadowSm : `inset 0 0 0 1px ${CK.hair}`,
                transition: 'background-color 160ms ease, color 160ms ease, box-shadow 160ms ease',
              }}
            >
              {f.label}
              <b style={{ fontVariantNumeric: 'tabular-nums', color: on ? (f.id === 'waiting' && n > 0 ? CK.red : CK.ink) : CK.muted }}>{n}</b>
            </button>
          );
        })}
      </div>

      {rows !== null && !settings.chairReadsPersonal && (
        <p style={{ margin: '0 0 12px', fontSize: 14, color: CK.inkSoft }}>You see the cabinet directives of your cabinet. The Crisis Director can let chairs see every directive of their cabinet.</p>
      )}

      {rows === null ? (
        <div aria-busy="true"><Skeleton h={520} r={24} /></div>
      ) : shown.length === 0 ? (
        <Card style={{ height: 'clamp(300px, calc(100dvh - 300px), 600px)', display: 'grid', placeItems: 'center', textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: CK.ink }}>{active === 'all' ? 'No directives yet' : active === 'waiting' ? 'Nothing is waiting for you' : 'No directive is in this state'}</p>
        </Card>
      ) : (
        <DirectiveReader
          queue={shown}
          focusId={front?.id ?? null}
          onFocus={setFocusId}
          onOpen={openChairDirective}
          onTakeOver={openChairDirective}
          active={!requested}
          names={names}
          lane={active === 'answered' ? 'answered' : 'open'}
          now={now}
          onChanged={() => { void read(); }}
          readOnly={readOnly}
        />
      )}

      {more && (active === 'all' || active === 'answered' || active === 'rejected') && (
        <div style={{ marginTop: 14 }}>
          <Btn tone="ghost" disabled={loadingMore} onClick={() => { void loadMore(); }}>{loadingMore ? 'Loading' : 'Show older'}</Btn>
        </div>
      )}
    </div>
  );
}
