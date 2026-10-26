'use client';
// Gavelling Crisis: the delegate's resources, two per row. Each one is a small tile in a soft tint of the
// cabinet colour: the icon and the amount big on one line, the name small beneath.

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
        <div className="grid grid-cols-2 gap-2"><Skeleton h={52} r={12} /><Skeleton h={52} r={12} /></div>
      ) : resources.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13.5, color: CK.inkSoft }}>No resources yet.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-2" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
          {resources.map((r) => {
            const t = typeById.get(r.type_id);
            const own = !!characterId && r.character_id === characterId;
            return (
              <li key={r.id} title={own ? 'Just for you' : undefined} style={{ background: cabinetTint(color, 0.08), borderRadius: 12, padding: '7px 9px', minWidth: 0 }}>
                <span className="flex items-center" style={{ gap: 6, color: CK.redDeep }}>
                  <span style={{ lineHeight: 0, flexShrink: 0 }}>{resourceIcon(t?.name ?? '', 18)}</span>
                  <b style={{ fontSize: 18, lineHeight: 1.1, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: CK.ink, overflowWrap: 'anywhere' }}>{Number(r.amount).toLocaleString()}</b>
                </span>
                <span style={{ display: 'block', marginTop: 2, fontSize: 11.5, lineHeight: 1.25, fontWeight: 600, color: CK.inkSoft, overflowWrap: 'anywhere' }}>
                  {t?.name ?? 'Resource'}{t?.unit ? ` (${t.unit})` : ''}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
