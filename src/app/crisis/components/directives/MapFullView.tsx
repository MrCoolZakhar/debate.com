'use client';
// Gavelling Crisis: the big map of a directive reply. A unit move or a border change opens the map FULL SIZE in
// place of the whole directive pop-up (the pop-up never opens another on top of itself): a Back button returns to
// the directive with the reply, the changes and the cards exactly as they were. It is the same WarMap stage the
// Map page uses; nothing here is written, every change goes back into the reply's draft and goes out with Send reply.

import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Map as MapIcon } from 'lucide-react';
import { Btn, CK } from '../../crisisKit';
import { useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import { applyLocal, diffData, emptySet, setSize, type MapData, type StageOptions } from '../map/mapEdits';
import WarMap from '../map/WarMap';
import { describeUnitMove, stageUnitChange, usedBy, type CardEnv, type MapRequest } from './effectCards';

export default function MapFullView({ env, req, onBack }: { env: CardEnv; req: MapRequest; onBack: () => void }) {
  const { ref } = useCrisis();
  const { data, effects, setEffects, powers } = env;
  const body = useRef<HTMLDivElement>(null);
  const [h, setH] = useState(520);

  // The map is as tall as the room the pop-up gives it (the toolbar above it takes some).
  useLayoutEffect(() => {
    const el = body.current;
    if (!el) return;
    const reserve = req.kind === 'border' ? 96 : 10;
    const measure = () => {
      const next = Math.max(340, Math.floor(el.clientHeight - reserve));
      setH((cur) => (Math.abs(cur - next) >= 4 ? next : cur));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [req.kind]);

  const baseMap = useMemo<MapData | null>(() => (data ? { regions: data.regions, units: data.units, shapes: data.shapes } : null), [data]);
  // The map is read once when it opens: the map as it is, with this reply's earlier border changes laid over it.
  const [startData] = useState<MapData | null>(() => (baseMap ? applyLocal(baseMap, effects.map ?? emptySet(), ref.id) : null));

  const card = req.kind === 'unit' ? effects.cards.find((c) => c.id === req.cardId) : undefined;
  const unitId = card?.target ?? '';
  const unit = data?.units.find((u) => u.id === unitId);
  const moves = useMemo(() => {
    const m: Record<string, { lng: number; lat: number }> = {};
    for (const [id, st] of Object.entries(effects.units)) if (st.lng !== undefined && st.lat !== undefined) m[id] = { lng: st.lng, lat: st.lat };
    return m;
  }, [effects.units]);

  let stage: StageOptions | null = null;
  if (data && baseMap && startData) {
    if (req.kind === 'unit' && card) {
      const taken = usedBy(env, 'unit', card.id);
      stage = {
        kind: 'unit', data: baseMap, canUnits: powers.units, canMap: false, height: h, unitId, moves,
        onSelectUnit: (id) => { if (!taken.has(id) && id !== card.target) env.retarget(card, id); },
        onUnitMove: (id, lng, lat) => {
          // Before a unit is picked any unit can be dragged straight away, like on the real map: the drag picks it.
          if (!card.target) { if (taken.has(id)) return; env.retarget(card, id); }
          const u = data.units.find((x) => x.id === id);
          if (u) stageUnitChange(setEffects, u, (s) => ({ ...s, lng, lat }));
        },
      };
    } else if (req.kind === 'border') {
      stage = {
        kind: 'border', data: startData, canUnits: false, canMap: powers.map, height: h,
        onData: (d) => setEffects((e) => {
          const set = diffData(baseMap, d);
          return { ...e, map: setSize(set) ? set : null };
        }),
      };
    }
  }

  const n = setSize(effects.map);
  const title = req.kind === 'unit' ? 'Move a Unit' : 'Change a Border';
  const sub = req.kind === 'unit'
    ? (unit ? describeUnitMove(unit, effects.units[unit.id]) : 'Pick a unit on the map, then drag it to where it goes. Dashed lines show the moves this reply plans.')
    : (n ? `${n} ${n === 1 ? 'territory' : 'territories'} will change when you send the reply.` : 'Nothing changes yet. The real borders stay visible underneath.');

  return (
    <div className="dp-main dp-mapview" style={{ fontFamily: CK.font }}>
      <div className="flex items-center" style={{ flex: 'none', gap: 12, padding: '12px 18px', background: CK.card, boxShadow: `0 1px 0 ${CK.hair}`, borderRadius: 'var(--dp-r) var(--dp-r) 0 0' }}>
        <Btn tone="ghost" icon={<ArrowLeft size={15} strokeWidth={1.5} />} onClick={onBack}>Back to the directive</Btn>
        <MapIcon size={19} strokeWidth={1.5} aria-hidden style={{ color: CK.red, flex: 'none' }} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: CK.ink, overflowWrap: 'anywhere' }}>{title}</h2>
          <p style={{ margin: '1px 0 0', fontSize: 13, color: CK.inkSoft, lineHeight: 1.35, overflowWrap: 'anywhere' }}>
            {sub} Nothing is applied until you send the reply.
          </p>
        </div>
      </div>
      <div ref={body} style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '10px 14px 14px' }}>
        {stage ? <WarMap stage={stage} /> : (
          <div className="animate-pulse" style={{ height: '100%', minHeight: 300, borderRadius: 16, background: CK.well }} aria-busy="true" />
        )}
      </div>
    </div>
  );
}
