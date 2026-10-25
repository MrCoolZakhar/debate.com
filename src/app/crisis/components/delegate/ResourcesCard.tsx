'use client';
// Gavelling Crisis: the delegate's resources. Each one is an icon tile in a soft tint of the cabinet
// colour, the amount big, the name small beside it. Compact, in a grid that fills the width.

import type { Resource, ResourceType } from '@/lib/crisis/types';
import { cabinetTint, CK, resourceIcon, Skeleton } from '../../crisisKit';

export default function ResourcesCard({ types, resources, characterId, color }: {
  types: ResourceType[] | null; resources: Resource[]; characterId: string | null; color: string;
}) {
  const typeById = new Map((types ?? []).map((t) => [t.id, t]));
  return (
    <section aria-labelledby="my-resources-title">
      <h2 id="my-resources-title" style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 800, color: CK.ink }}>Resources</h2>
      {types === null ? (
        <div className="grid gap-2 sm:grid-cols-2"><Skeleton h={48} r={14} /><Skeleton h={48} r={14} /></div>
      ) : resources.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13.5, color: CK.inkSoft }}>No resources yet.</p>
      ) : (
        <ul className="grid gap-2" style={{ margin: 0, padding: 0, listStyle: 'none', gridTemplateColumns: 'repeat(auto-fill, minmax(168px, 1fr))' }}>
          {resources.map((r) => {
            const t = typeById.get(r.type_id);
            const own = !!characterId && r.character_id === characterId;
            return (
              <li key={r.id} className="flex items-center" style={{ gap: 10, background: cabinetTint(color, 0.07), borderRadius: 14, padding: '7px 10px 7px 7px' }}>
                <span aria-hidden className="grid place-items-center" style={{ width: 38, height: 38, borderRadius: 11, flexShrink: 0, background: cabinetTint(color, 0.22), color: CK.redDeep }}>
                  {resourceIcon(t?.name ?? '', 20)}
                </span>
                <span className="min-w-0">
                  <b style={{ display: 'block', fontSize: 19, lineHeight: 1.1, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: CK.ink }}>{Number(r.amount).toLocaleString()}</b>
                  <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: CK.inkSoft, overflowWrap: 'anywhere' }}>
                    {t?.name ?? 'Resource'}{t?.unit ? ` (${t.unit})` : ''}{own ? ', just for you' : ''}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
