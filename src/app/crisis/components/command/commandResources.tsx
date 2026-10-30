'use client';
// Gavelling Crisis: Cabinet Resources on Crisis Command, as a small overview strip under the map.
// One line per cabinet: its logo and name, then each resource as a small icon disc with the amount and
// how much it last changed (green up, red down), up to 8. A click opens the resource's history graph in
// a pop-up; "See all" opens every resource of every cabinet.

import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Landmark } from 'lucide-react';
import { amount as fmtAmount } from '@/lib/crisis/format';
import type { Cabinet, Resource, ResourceType } from '@/lib/crisis/types';
import { Btn, Card, CardTitle, cabinetTint, CK, resourceIcon, Skeleton } from '../../crisisKit';
import { CabinetLogo } from '../directives/directiveParts';
import ResourceHistoryDialog from '../resources/ResourceHistoryDialog';
import CabinetResourcesDialog from './CabinetResourcesDialog';
import { groupResourcesByCabinet } from './commandData';
import { EmptyLine } from './commandParts';

/** Chips shown per cabinet on Command; "See all" opens everything. */
const PER_CABINET = 8;

function Chip({ name, unit, value, change, color, onOpen }: {
  name: string; unit?: string | null; value: number; change?: number; color: string; onOpen: () => void;
}) {
  const up = (change ?? 0) > 0;
  return (
    <button
      type="button"
      onClick={onOpen}
      title={`${name}${unit ? ` (${unit})` : ''}: see how it changed`}
      aria-label={`${name}, ${fmtAmount(value)}${unit ? ` ${unit}` : ''}${change ? `, last change ${up ? 'up' : 'down'} ${fmtAmount(Math.abs(change))}` : ''}. See how it changed`}
      className="inline-flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] transition-transform hover:-translate-y-px active:scale-[0.97]"
      style={{ border: 0, cursor: 'pointer', background: CK.card, boxShadow: CK.shadowSm, borderRadius: 999, padding: '1px 8px 1px 1px', gap: 5, fontFamily: CK.font, color: CK.ink }}
    >
      <span aria-hidden style={{ width: 26, height: 26, borderRadius: '50%', flex: 'none', display: 'grid', placeItems: 'center', color, background: cabinetTint(color, 0.16) }}>
        {resourceIcon(name, 15)}
      </span>
      <b style={{ fontSize: 14, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{fmtAmount(value)}</b>
      {change ? (
        <span className="inline-flex items-center" style={{ gap: 1, fontSize: 11, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: up ? CK.ok : CK.danger }}>
          {up ? <ArrowUp size={10} strokeWidth={2} aria-hidden /> : <ArrowDown size={10} strokeWidth={2} aria-hidden />}
          {fmtAmount(Math.abs(change))}
        </span>
      ) : null}
    </button>
  );
}

export function ResourcesStrip({ cabinets, types, resources, changes, loaded }: {
  cabinets: Cabinet[]; types: ResourceType[]; resources: Resource[]; changes: Map<string, number>; loaded: boolean;
}) {
  const [view, setView] = useState<{ kind: 'all' } | { kind: 'one'; id: string } | null>(null);
  const typeById = useMemo(() => new Map(types.map((t) => [t.id, t])), [types]);
  const byCab = useMemo(() => groupResourcesByCabinet(resources), [resources]);
  const cabinetRows = (cabId: string) => (byCab.get(cabId) ?? []).filter((r) => typeById.get(r.type_id)?.scope === 'cabinet')
    .sort((a, b) => (typeById.get(a.type_id)?.sort ?? 0) - (typeById.get(b.type_id)?.sort ?? 0));
  const withRes = cabinets.filter((c) => cabinetRows(c.id).length > 0);
  const one = view?.kind === 'one' ? resources.find((r) => r.id === view.id) ?? null : null;
  const oneType = one ? typeById.get(one.type_id) : undefined;
  const oneCab = one ? cabinets.find((c) => c.id === one.cabinet_id) : undefined;

  return (
    <Card className="cmd-card cmd-res" style={{ padding: '10px 12px 10px', display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginBottom: -4 }}>
        <CardTitle
          icon={<Landmark size={16} strokeWidth={1.5} />}
          right={withRes.length > 0 ? <Btn size="sm" tone="ghost" onClick={() => setView({ kind: 'all' })}>See all</Btn> : undefined}
        >
          Cabinet Resources
        </CardTitle>
      </div>
      {!loaded ? <Skeleton h={34} r={12} />
        : withRes.length === 0 ? <EmptyLine>No cabinet resources yet.</EmptyLine>
        : (
          <div className="flex flex-col" style={{ gap: 5, flex: '0 1 auto', minHeight: 0, overflowY: 'auto' }}>
            {withRes.map((cab) => {
              const rows = cabinetRows(cab.id);
              const shown = rows.slice(0, PER_CABINET);
              return (
                // One tinted band per cabinet: the logo and name, then the chips packed close in rows. The card is as tall as its
                // bands, so nothing is left empty.
                <div key={cab.id} className="flex items-center" style={{ gap: 10, minWidth: 0, padding: '5px 8px', borderRadius: 14, background: cabinetTint(cab.color, 0.07) }}>
                  <span className="flex items-center" style={{ gap: 6, flex: 'none', width: 96, minWidth: 0 }}>
                    <CabinetLogo cabinet={cab} size={22} />
                    <b style={{ fontSize: 12.5, color: cab.color, overflowWrap: 'anywhere', lineHeight: 1.2 }}>{cab.short_name || cab.name}</b>
                  </span>
                  <span className="flex flex-wrap items-center" style={{ gap: '4px 5px', flex: 1, minWidth: 0 }}>
                    {shown.map((r) => {
                      const t = typeById.get(r.type_id);
                      return <Chip key={r.id} name={t?.name ?? 'Resource'} unit={t?.unit} value={r.amount} change={changes.get(r.id)} color={cab.color} onOpen={() => setView({ kind: 'one', id: r.id })} />;
                    })}
                    {rows.length > shown.length && (
                      <button type="button" onClick={() => setView({ kind: 'all' })} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]" style={{ border: 0, background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: CK.font, fontSize: 12, fontWeight: 700, color: CK.forest, textDecoration: 'underline', whiteSpace: 'nowrap' }}>
                        +{rows.length - shown.length} more
                      </button>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        )}

      {view?.kind === 'all' && (
        <CabinetResourcesDialog cabinets={cabinets} types={types} resources={resources} changes={changes} onClose={() => setView(null)} />
      )}
      {one && oneType && (
        <ResourceHistoryDialog
          resource={{ id: one.id, amount: one.amount }}
          typeName={oneType.name}
          unit={oneType.unit}
          color={oneCab?.color}
          eyebrow={oneCab?.name}
          onClose={() => setView(null)}
        />
      )}
    </Card>
  );
}
