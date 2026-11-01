'use client';
// Gavelling Crisis: the Map page, with two tabs for everybody: the Map itself and its History (every move,
// border and territory change). The tab is in the address (?tab=history) so an old /history link can land
// here. On a wide screen the map fills the window under the top bar; on a phone it takes a tall block and
// the page scrolls to the legend and the panels underneath.
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useState } from 'react';
import { CK, Segmented } from '../../crisisKit';
import HistoryPage from '../history/HistoryPage';
import MapChangesDialog, { readChangesStamp } from './MapChangesDialog';
import type { FocusRequest } from './mapFocusFly';
import WarMap from './WarMap';

type Tab = 'map' | 'history';

export default function MapPage() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tab: Tab = params?.get('tab') === 'history' ? 'history' : 'map';

  // "N changes to the map" (a notification's link carries the time of the send): a pop-up with the replay and the breakdown.
  // `?since=` is the one growing notice (every change since that moment); `?changes=` is a single send.
  const sinceStamp = tab === 'map' ? readChangesStamp(params?.get('since')) : null;
  const changesStamp = tab === 'map' ? sinceStamp ?? readChangesStamp(params?.get('changes')) : null;
  const [focusReq, setFocusReq] = useState<FocusRequest | null>(null);
  const closeChanges = useCallback(() => {
    const q = new URLSearchParams(params?.toString() ?? '');
    q.delete('changes'); q.delete('since');
    const s = q.toString();
    router.replace(`${pathname}${s ? `?${s}` : ''}`, { scroll: false });
  }, [params, router, pathname]);
  const pickChange = useCallback((req: Omit<FocusRequest, 'n'>) => {
    setFocusReq((cur) => ({ ...req, n: (cur?.n ?? 0) + 1 }));
    closeChanges();
  }, [closeChanges]);

  const setTab = useCallback((t: Tab) => {
    const q = new URLSearchParams(params?.toString() ?? '');
    // A place to zoom to belongs to one visit of the map, not to switching tabs.
    for (const k of ['unit', 'region', 'bbox', 'changes', 'since']) q.delete(k);
    if (t === 'history') q.set('tab', 'history'); else q.delete('tab');
    const s = q.toString();
    router.replace(`${pathname}${s ? `?${s}` : ''}`, { scroll: false });
  }, [params, router, pathname]);

  const header = (
    <div className="flex items-center flex-wrap" style={{ gap: '8px 16px' }}>
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: CK.ink }}>Map</h1>
      <Segmented<Tab> ariaLabel="Map or history" value={tab} onChange={setTab} options={[{ value: 'map', label: 'Map' }, { value: 'history', label: 'History' }]} />
    </div>
  );

  if (tab === 'history') {
    return (
      <div style={{ marginTop: 4 }}>
        <div style={{ marginBottom: 6 }}>{header}</div>
        <HistoryPage embedded />
      </div>
    );
  }

  return (
    <div className="crisis-map-page" style={{ marginTop: 4 }}>
      <style>{'@media (min-width: 768px) { .crisis-map-page { height: calc(100dvh - 82px); min-height: 520px; } }'}</style>
      <WarMap title={header} focusReq={focusReq} />
      {changesStamp !== null && <MapChangesDialog stamp={changesStamp} since={sinceStamp !== null} onClose={closeChanges} onPick={pickChange} />}
    </div>
  );
}
