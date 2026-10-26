'use client';
// Gavelling Crisis: the small facts under the buttons: the in-world date and time, whether directives
// are open or paused (with the note), and the delegate's resources, two per row.

import { CalendarClock, PauseCircle, PlayCircle } from 'lucide-react';
import type { Crisis, Resource, ResourceType } from '@/lib/crisis/types';
import { Card, CK, scenarioLabel } from '../../crisisKit';
import ResourcesCard from './ResourcesCard';

export default function FactsCard({ crisis, types, resources, characterId, color }: {
  crisis: Pick<Crisis, 'scenario_at' | 'directives_open' | 'directives_paused_note'>;
  types: ResourceType[] | null; resources: Resource[]; characterId: string | null; color: string;
}) {
  const open = crisis.directives_open;
  return (
    <Card style={{ padding: '12px 14px 14px' }}>
      <div className="grid" style={{ gap: 7 }}>
        <p className="flex items-center" style={{ margin: 0, gap: 8, fontSize: 14, fontWeight: 800, color: CK.ink, fontVariantNumeric: 'tabular-nums' }}>
          <CalendarClock size={17} strokeWidth={1.5} aria-hidden style={{ flexShrink: 0, color: CK.red }} />
          {scenarioLabel(crisis.scenario_at)}
        </p>
        <p className="flex items-center" style={{ margin: 0, gap: 8, fontSize: 13.5, fontWeight: 700, color: open ? CK.ok : CK.goldDeep }}>
          {open
            ? <PlayCircle size={17} strokeWidth={1.5} aria-hidden style={{ flexShrink: 0 }} />
            : <PauseCircle size={17} strokeWidth={1.5} aria-hidden style={{ flexShrink: 0 }} />}
          {open ? 'Directives are open' : 'Directives are paused'}
        </p>
        {!open && crisis.directives_paused_note && (
          <p style={{ margin: '-2px 0 0 25px', fontSize: 13, fontWeight: 600, color: CK.inkSoft, overflowWrap: 'anywhere' }}>{crisis.directives_paused_note}</p>
        )}
      </div>
      <div style={{ marginTop: 12, paddingTop: 12, boxShadow: `inset 0 1px 0 ${CK.hair}` }}>
        <ResourcesCard types={types} resources={resources} characterId={characterId} color={color} />
      </div>
    </Card>
  );
}
