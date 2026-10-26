'use client';
// Gavelling Crisis: "See all" on Cabinet Resources. Every cabinet's resources in one pop-up. Clicking a resource
// swaps the pop-up's content for its history graph with a back button (a pop-up never opens another on top of itself).

import { useMemo, useState } from 'react';
import { Info } from 'lucide-react';
import type { Cabinet, Resource, ResourceType } from '@/lib/crisis/types';
import { CK } from '../../crisisKit';
import CrisisDialog from '../delegate/CrisisDialog';
import ResourceDisc from '../resources/ResourceDisc';
import { ResourceHistoryBody } from '../resources/ResourceHistoryDialog';
import { groupResourcesByCabinet } from './commandData';

export default function CabinetResourcesDialog({ cabinets, types, resources, changes, onClose }: {
  cabinets: Cabinet[]; types: ResourceType[]; resources: Resource[]; changes: Map<string, number>; onClose: () => void;
}) {
  const [selId, setSelId] = useState<string | null>(null);
  const typeById = useMemo(() => new Map(types.map((t) => [t.id, t])), [types]);
  const byCab = useMemo(() => groupResourcesByCabinet(resources), [resources]);

  // The selection is looked up live so the amount in the graph follows the page.
  const sel = selId ? resources.find((r) => r.id === selId) ?? null : null;
  const selType = sel ? typeById.get(sel.type_id) : undefined;
  const selCab = sel ? cabinets.find((c) => c.id === sel.cabinet_id) : undefined;

  if (sel && selType) {
    return (
      <CrisisDialog title={selType.name} eyebrow={selCab?.name ?? 'Resource history'} onClose={onClose} onBack={() => setSelId(null)} width={680} step={`h:${sel.id}`}>
        <ResourceHistoryBody resource={{ id: sel.id, amount: sel.amount }} typeName={selType.name} unit={selType.unit} color={selCab?.color} />
      </CrisisDialog>
    );
  }

  const groups = cabinets
    .map((cab) => ({
      cab,
      rows: (byCab.get(cab.id) ?? []).filter((r) => typeById.get(r.type_id)?.scope === 'cabinet')
        .sort((a, b) => (typeById.get(a.type_id)?.sort ?? 0) - (typeById.get(b.type_id)?.sort ?? 0)),
    }))
    .filter((g) => g.rows.length > 0);

  return (
    <CrisisDialog title="Cabinet Resources" onClose={onClose} width={820} step="all">
      <div className="flex flex-col" style={{ gap: 18 }}>
        {groups.length === 0 && <p style={{ margin: 0, fontSize: 14, color: CK.inkSoft }}>No cabinet resources yet.</p>}
        {groups.map(({ cab, rows }) => (
          <section key={cab.id} aria-label={cab.name}>
            <h3 className="flex items-center" style={{ margin: '0 0 8px', gap: 8, fontSize: 14, fontWeight: 800, color: cab.color, overflowWrap: 'anywhere' }}>
              <i aria-hidden style={{ width: 11, height: 11, borderRadius: '50%', background: cab.color, display: 'inline-block', flex: 'none' }} />
              {cab.name}
              <span style={{ fontSize: 12, fontWeight: 600, color: CK.inkSoft }}><b style={{ fontVariantNumeric: 'tabular-nums' }}>{rows.length}</b> {rows.length === 1 ? 'resource' : 'resources'}</span>
            </h3>
            <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fill, minmax(112px, 1fr))' }}>
              {rows.map((r) => {
                const t = typeById.get(r.type_id);
                return (
                  <ResourceDisc key={r.id} name={t?.name ?? 'Resource'} unit={t?.unit} value={r.amount} change={changes.get(r.id)} color={cab.color} onOpen={() => setSelId(r.id)} />
                );
              })}
            </div>
          </section>
        ))}
        <p className="flex items-start" style={{ margin: 0, gap: 7, fontSize: 12.5, color: CK.muted }}>
          <Info size={14} strokeWidth={1.5} aria-hidden style={{ flex: 'none', marginTop: 2 }} />
          Resources belong to a cabinet. Resources for single characters are coming later.
        </p>
      </div>
    </CrisisDialog>
  );
}
