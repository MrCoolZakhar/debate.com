// Gavelling Crisis map: the arrow that follows a dragged character, the same arrow a dragged unit gets. The arrow
// (WarMap showMove) is drawn from a unit, so a character is handed to it as a stand-in with its own colour and wording.

import type { Character, MapUnit } from '@/lib/crisis/types';
import { NOBODY } from './mapStyle';
import { safeColor } from './tokens';

export interface MoveLook { color: string; what: string }

/** A character as the move arrow wants it: standing where it is saved, in its cabinet's colour. */
/** Any cabinet shape the map has at hand (the full Cabinet or the panels' short form). */
type CabLike = { name: string; color: string; short_name?: string | null; short?: string };

export function charAsMover(c: Character, at: [number, number], cabinet: CabLike | undefined): { unit: MapUnit; look: MoveLook } {
  const color = safeColor(cabinet?.color ?? NOBODY);
  const unit: MapUnit = {
    id: c.id, crisis_id: c.crisis_id, owner_cabinet_id: c.cabinet_id, kind: 'custom', name: c.name, strength: 0,
    lng: at[0], lat: at[1], note: null, revealed_to: [], suspected_by: [],
  };
  const who = cabinet ? (cabinet.short_name || cabinet.short || cabinet.name) : 'Nobody';
  return { unit, look: { color, what: [c.title, who].filter(Boolean).join(' · ') || 'Character' } };
}
