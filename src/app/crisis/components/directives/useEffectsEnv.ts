'use client';
// Gavelling Crisis: what the cards of "What happens when you send", the recap and the big map all share for ONE
// directive: the resources and the map as they are now (read once), the people, and the staged changes. Built
// once by the pop-up so the directive and the full-size map see the same thing.

import { useEffect, useMemo, useState } from 'react';
import { notifyErr } from '@/lib/appNotify';
import { crisisError, loadMap, loadResources, type CrisisRef } from '@/lib/crisis/api';
import { useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import { loadCountries, type CountryOption } from './countryPick';
import { clearCard, type CardEnv, type MapRequest, type StageData } from './effectCards';
import type { ReplyPowers } from './ReplyActions';
import type { EffectsDraft } from './replyDraft';

export function useEffectsEnv({ crisisRef, powers, effects, setEffects, authorCharacterId, cabinetId, openMap }: {
  crisisRef: CrisisRef;
  powers: ReplyPowers;
  effects: EffectsDraft;
  setEffects: (next: (prev: EffectsDraft) => EffectsDraft) => void;
  authorCharacterId: string | null;
  cabinetId: string | null;
  openMap: (req: MapRequest) => void;
}): CardEnv {
  const { core } = useCrisis();
  const [data, setData] = useState<StageData | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadResources(crisisRef), loadMap(crisisRef), loadCountries().catch(() => [] as CountryOption[])])
      .then(([r, m, countries]) => { if (!cancelled) setData({ types: r.types, resources: r.resources, units: m.units, regions: m.regions, shapes: m.shapes, countries }); })
      .catch((e) => {
        if (cancelled) return;
        setData({ types: [], resources: [], units: [], regions: [], shapes: [], countries: [] });
        notifyErr(crisisError(e, 'Could not load the resources and the map.'), 'crisis-effects');
      });
    return () => { cancelled = true; };
  }, [crisisRef]);

  const cabById = useMemo(() => new Map(core.cabinets.map((c) => [c.id, c])), [core.cabinets]);
  const charById = useMemo(() => new Map(core.characters.map((c) => [c.id, c])), [core.characters]);
  const cabinetColors = useMemo(() => core.cabinets.map((c) => ({ id: c.id, color: c.color })), [core.cabinets]);
  const typeById = useMemo(() => new Map((data?.types ?? []).map((t, i) => [t.id, { t, i }])), [data]);
  const baseHolder = useMemo(() => new Map((data?.regions ?? []).map((r) => [r.region_key, r.owner_cabinet_id])), [data]);

  const env: CardEnv = {
    data, powers, effects, setEffects, authorCharacterId, cabinetId, cabinets: core.cabinets, cabById, charById,
    characters: core.characters, typeById, baseHolder, cabinetColors, openMap,
    retarget: (card, target) => setEffects((e) => ({ ...clearCard(e, card, env), cards: e.cards.map((c) => (c.id === card.id ? { ...c, target } : c)) })),
  };
  return env;
}
