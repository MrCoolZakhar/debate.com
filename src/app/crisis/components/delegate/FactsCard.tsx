'use client';
// Gavelling Crisis: the delegate's resources card, two per row. (The in-world date, whether directives are open and the cooldown
// moved to the glance card beside the speakers list: GlanceCard.tsx.)

import type { Resource, ResourceType } from '@/lib/crisis/types';
import { Card } from '../../crisisKit';
import ResourcesCard from './ResourcesCard';

export default function FactsCard({ types, resources, characterId, color }: {
  types: ResourceType[] | null; resources: Resource[]; characterId: string | null; color: string;
}) {
  return (
    <Card style={{ padding: '12px 14px 14px' }}>
      <ResourcesCard types={types} resources={resources} characterId={characterId} color={color} />
    </Card>
  );
}
