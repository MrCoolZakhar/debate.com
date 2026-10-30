'use client';
// Gavelling Crisis: the History page. Every change on the map, newest first, grouped by day: troop moves and
// strength, borders (countries changing hands) and drawn areas. Staff see all of it and who did it; everyone
// else sees what changed for their own cabinet, never who (the database decides which rows come back).
// Everything sent together is one entry that opens to list its changes; a change opens the same still-map pop-up as a
// notification, and staff with map and unit power can bring the map back to the point after an entry.
// It re-reads whenever the map changes.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { History as HistoryIcon } from 'lucide-react';
import GSelect from '@/components/GSelect';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { UserFacingError } from '@/lib/friendlyError';
import { crisisError, loadMap, saveMapDraft } from '@/lib/crisis/api';
import { crisisHistory, groupBatches, parseChange, type ChangeFilter, type HistoryBatch, type HistoryChange } from '@/lib/crisis/history';
import { useCrisisLive } from '@/lib/crisis/live';
import { Btn, Card, CK, Segmented, Skeleton } from '../../crisisKit';
import { useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import { isEmptySet, sendSet } from '../map/mapEdits';
import { buildRestoreSet } from '../map/mapRestore';
import BatchEntry from './BatchEntry';
import ChangeDialog from './ChangeDialog';
import { useChangeCtx } from './changeKit';

const PAGE = 200;
/** How far back a restore reads the history. */
const RESTORE_ROWS = 3000;
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

interface Entry { batch: HistoryBatch; changes: HistoryChange[] }

/** `embedded`: shown as the History tab of the Map page, which carries the page title. */
export default function HistoryPage({ embedded = false }: { embedded?: boolean } = {}) {
  const { ref, staff, director, settings } = useCrisis();
  const ctx = useChangeCtx();
  const router = useRouter();
  const pathname = usePathname();
  // Going back touches units, territories and shapes, so it needs power over both.
  const canRestore = staff && (director || (settings.backroomPowers.map && settings.backroomPowers.units));
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

  // Everything sent together is one entry; the filters then keep the changes that match.
  const entries = useMemo<Entry[]>(
    () => groupBatches(rows ?? []).map((batch) => ({ batch, changes: batch.rows.map(parseChange).filter((c): c is HistoryChange => !!c) })).filter((e) => e.changes.length > 0),
    [rows],
  );
  const people = useMemo(() => [...new Set(entries.flatMap((e) => e.changes.map((c) => c.by)).filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b)), [entries]);
  const shown = useMemo(
    () => entries
      .map((e) => ({ ...e, changes: e.changes.filter((c) => (filter === 'all' || c.filter === filter) && (who === 'all' || c.by === who)) }))
      .filter((e) => e.changes.length > 0),
    [entries, filter, who],
  );
  const days = useMemo(() => {
    const out: Array<{ key: string; label: string; items: Entry[] }> = [];
    for (const e of shown) {
      const k = dayKey(e.batch.at);
      const last = out[out.length - 1];
      if (last && last.key === k) last.items.push(e);
      else out.push({ key: k, label: dayLabel(e.batch.at), items: [e] });
    }
    return out;
  }, [shown]);

  /** Brings the map back to the point right after a batch: as unsent changes when those wait, else at once. */
  const restore = useCallback(async (b: HistoryBatch) => {
    try {
      const [current, full] = await Promise.all([loadMap(ref), crisisHistory(ref, { limit: RESTORE_ROWS })]);
      const plan = buildRestoreSet(current, full, b.id, ref.id);
      if (!plan) throw new UserFacingError('That point is too far back to bring the map back to.');
      if (isEmptySet(plan.set)) { notifyOk('The map already looks like it did then', 'crisis-map'); return; }
      const skipped = plan.skipped ? ` ${plan.skipped} older ${plan.skipped === 1 ? 'change' : 'changes'} had no earlier state and stay as they are.` : '';
      if (settings.mapChangesWait) {
        await saveMapDraft(ref, plan.set as unknown as Record<string, unknown>);
        notifyOk(`Brought back as unsent changes. Look at the map, then send them.${skipped}`, 'crisis-map');
        const q = new URLSearchParams(window.location.search);
        q.delete('tab');
        const qs = q.toString();
        router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false });
        return;
      }
      const r = await sendSet(ref, plan.set);
      if (r.error) throw r.error;
      notifyOk(`The map is back to that point.${skipped}`, 'crisis-map');
      void load();
    } catch (e) {
      notifyErr(crisisError(e, 'Could not bring the map back.'), 'crisis-map');
      throw e;
    }
  }, [ref, settings.mapChangesWait, router, pathname, load]);

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
            {entries.length === 0 ? 'Nothing has changed on the map yet. Moves, borders and areas will appear here.' : 'Nothing matches that filter.'}
          </p>
        </Card>
      ) : (
        <>
          <div className="grid items-start" style={{ gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 440px), 1fr))' }}>
            {days.map((day) => (
              <Card key={day.key} style={{ padding: '14px 12px 8px' }}>
                <h2 style={{ margin: '0 6px 6px', fontSize: 15, fontWeight: 800, color: CK.ink }}>{day.label}</h2>
                {day.items.map((e) => (
                  <BatchEntry
                    key={e.batch.id} changes={e.changes} at={e.batch.at} by={e.batch.by} ctx={ctx} staff={staff} canRestore={canRestore}
                    whenLabel={`${dayLabel(e.batch.at).toLowerCase()} at ${timeOf(e.batch.at)}`}
                    onOpen={setOpen} onRestore={() => restore(e.batch)}
                  />
                ))}
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
