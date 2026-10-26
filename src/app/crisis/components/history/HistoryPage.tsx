'use client';
// Gavelling Crisis: the History page. Every change on the map, newest first, grouped by day: troop moves and
// strength, borders (countries changing hands) and drawn areas. Staff see all of it and who did it; everyone
// else sees what changed for their own cabinet, never who (the database decides which rows come back).
// A row opens the same still-map pop-up as a notification. It re-reads whenever the map changes.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { History as HistoryIcon } from 'lucide-react';
import GSelect from '@/components/GSelect';
import { crisisError } from '@/lib/crisis/api';
import { crisisHistory, parseChange, type ChangeFilter, type HistoryChange } from '@/lib/crisis/history';
import { useCrisisLive } from '@/lib/crisis/live';
import { Btn, Card, CK, Segmented, Skeleton } from '../../crisisKit';
import { useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import ChangeDialog from './ChangeDialog';
import { ChangeDisc, PieceLine, describe, useChangeCtx, type ChangeCtx } from './changeKit';

const PAGE = 200;
type Filter = 'all' | ChangeFilter;

function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date(); yest.setDate(today.getDate() - 1);
  if (dayKey(iso) === dayKey(today.toISOString())) return 'Today';
  if (dayKey(iso) === dayKey(yest.toISOString())) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });
}
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

function Row({ c, ctx, staff, onOpen }: { c: HistoryChange; ctx: ChangeCtx; staff: boolean; onOpen: () => void }) {
  const d = describe(c, ctx);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8E2424] hover:bg-[rgba(142,36,36,0.04)]"
      style={{ gap: 12, padding: '11px 6px', border: 0, borderTop: `1px solid ${CK.hair}`, background: 'transparent', cursor: 'pointer', font: 'inherit', borderRadius: 10 }}
    >
      <ChangeDisc d={d} />
      <span className="min-w-0 flex-1">
        <b style={{ display: 'block', fontSize: 14.5, fontWeight: 800, color: CK.ink, overflowWrap: 'anywhere' }}>{d.title}</b>
        {d.lines.map((l, i) => <span key={i} style={{ display: 'block', marginTop: 3 }}><PieceLine pieces={l} ctx={ctx} /></span>)}
        <span style={{ display: 'block', marginTop: 3, fontSize: 12.5, fontWeight: 600, color: CK.muted }} title={new Date(c.at).toLocaleString()}>
          {timeOf(c.at)}{staff && c.by ? <> · by <b style={{ color: CK.inkSoft }}>{c.by}</b></> : null}
        </span>
      </span>
    </button>
  );
}

/** `embedded`: shown as the History tab of the Map page, which carries the page title. */
export default function HistoryPage({ embedded = false }: { embedded?: boolean } = {}) {
  const { ref, staff } = useCrisis();
  const ctx = useChangeCtx();
  const [limit, setLimit] = useState(PAGE);
  const [rows, setRows] = useState<Awaited<ReturnType<typeof crisisHistory>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [who, setWho] = useState('all');
  const [open, setOpen] = useState<HistoryChange | null>(null);

  const load = useCallback(async () => {
    try { setRows(await crisisHistory(ref, { limit })); setError(null); } catch (e) { setError(crisisError(e, 'Could not load the history.')); }
  }, [ref, limit]);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);
  useCrisisLive(ref.id, ['crisis_units', 'crisis_map_regions', 'crisis_shapes'], () => { void load(); });

  const changes = useMemo(() => (rows ?? []).map(parseChange).filter((c): c is HistoryChange => !!c), [rows]);
  const people = useMemo(() => [...new Set(changes.map((c) => c.by).filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b)), [changes]);
  const shown = useMemo(() => changes.filter((c) => (filter === 'all' || c.filter === filter) && (who === 'all' || c.by === who)), [changes, filter, who]);
  const days = useMemo(() => {
    const out: Array<{ key: string; label: string; items: HistoryChange[] }> = [];
    for (const c of shown) {
      const k = dayKey(c.at);
      const last = out[out.length - 1];
      if (last && last.key === k) last.items.push(c);
      else out.push({ key: k, label: dayLabel(c.at), items: [c] });
    }
    return out;
  }, [shown]);

  const whoOptions = useMemo(() => [{ value: 'all', label: 'Everyone' }, ...people.map((p) => ({ value: p, label: p }))], [people]);

  return (
    <div style={{ paddingBottom: 40, width: '100%', minWidth: 0 }}>
      <div className="flex items-end justify-between flex-wrap" style={{ margin: '8px 0 14px', gap: '10px 16px' }}>
        <div style={embedded ? { display: 'none' } : undefined}>
          <h1 className="flex items-center" style={{ margin: 0, gap: 10, fontSize: 26, fontWeight: 800, color: CK.ink }}>
            <HistoryIcon size={24} strokeWidth={1.5} aria-hidden style={{ color: CK.red }} />History
          </h1>
          <p style={{ margin: '3px 0 0', fontSize: 13.5, color: CK.inkSoft }}>
            {staff ? 'Every move, border and area on the map, and who made it.' : 'What changed on the map for your cabinet.'}
          </p>
        </div>
        <div className="flex items-center flex-wrap" style={{ gap: 10 }}>
          <Segmented<Filter> ariaLabel="Show" value={filter} onChange={setFilter} options={[
            { value: 'all', label: 'All' }, { value: 'troops', label: 'Troops' }, { value: 'borders', label: 'Borders' }, { value: 'areas', label: 'Areas' },
          ]} />
          {staff && people.length > 0 && (
            <div style={{ width: 200 }}>
              <GSelect value={who} onChange={setWho} options={whoOptions} aria-label="Who made the change" size="sm" />
            </div>
          )}
        </div>
      </div>

      {error && !rows ? (
        <Card><div role="alert" className="flex items-center flex-wrap" style={{ gap: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: CK.red }}>{error}</span>
          <Btn size="sm" tone="ghost" onClick={() => { void load(); }}>Try again</Btn>
        </div></Card>
      ) : rows === null ? (
        <div className="flex flex-col" style={{ gap: 12 }}><Skeleton h={28} w={160} /><Skeleton h={220} r={22} /></div>
      ) : days.length === 0 ? (
        <Card>
          <p style={{ margin: 0, fontSize: 14.5, color: CK.inkSoft }}>
            {changes.length === 0 ? 'Nothing has changed on the map yet. Moves, borders and areas will appear here.' : 'Nothing matches that filter.'}
          </p>
        </Card>
      ) : (
        <>
          <div className="grid items-start" style={{ gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 440px), 1fr))' }}>
            {days.map((day) => (
              <Card key={day.key} style={{ padding: '14px 12px 8px' }}>
                <h2 style={{ margin: '0 6px 6px', fontSize: 15, fontWeight: 800, color: CK.ink }}>{day.label}</h2>
                {day.items.map((c) => <Row key={c.rowId} c={c} ctx={ctx} staff={staff} onOpen={() => setOpen(c)} />)}
              </Card>
            ))}
          </div>
          {(rows?.length ?? 0) >= limit && (
            <div style={{ marginTop: 16 }}><Btn tone="ghost" onClick={() => setLimit((l) => l + PAGE)}>Show earlier changes</Btn></div>
          )}
        </>
      )}
      {open && <ChangeDialog change={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
