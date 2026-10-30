'use client';
// Gavelling Crisis: the recap at the bottom of "What happens when you send": ONE small line per change the
// reply will make, small enough that about five fit without scrolling (more scroll inside the recap). Each line
// has a tiny X that takes that change back out. Presentation of the staged draft only; writes nothing.

import { Coins, Map as MapIcon, Newspaper, X, Zap, type LucideIcon } from 'lucide-react';
import { amount as fmtAmount } from '@/lib/crisis/format';
import { CK } from '../../crisisKit';
import { STATUS_META, place, round2, type CardEnv } from './effectCards';
import { countChanges } from './replyDraft';
import { setSize } from '../map/mapEdits';

interface Change { id: string; icon: LucideIcon; text: string; remove: () => void }

export function buildChanges(env: CardEnv): Change[] {
  const { data, effects, setEffects, typeById, charById, cabById } = env;
  const out: Change[] = [];
  const countryName = new Map((data?.countries ?? []).map((c) => [c.key, c.name]));
  if (data) {
    for (const [id, delta] of Object.entries(effects.resources)) {
      const r = data.resources.find((x) => x.id === id);
      if (!r) continue;
      const t = typeById.get(r.type_id)?.t;
      const owner = r.character_id ? charById.get(r.character_id)?.name : cabById.get(r.cabinet_id ?? '')?.name;
      out.push({
        id: `r-${id}`, icon: Coins, text: `${t?.name ?? 'Resource'}${owner ? `, ${owner}` : ''}: ${fmtAmount(r.amount)} to ${fmtAmount(round2(r.amount + delta))}`,
        remove: () => setEffects((e) => { const resources = { ...e.resources }; delete resources[id]; return { ...e, resources }; }),
      });
    }
    for (const [id, s] of Object.entries(effects.units)) {
      const u = data.units.find((x) => x.id === id);
      if (!u) continue;
      const parts: string[] = [];
      if (s.lng !== undefined && s.lat !== undefined) parts.push(`moves from ${place(u.lng, u.lat)} to ${place(s.lng, s.lat)}`);
      if (s.strength !== undefined) parts.push(`amount ${fmtAmount(u.strength)} to ${fmtAmount(s.strength)}`);
      out.push({
        id: `u-${id}`, icon: MapIcon, text: `${u.name}: ${parts.join(', ')}`,
        remove: () => setEffects((e) => { const units = { ...e.units }; delete units[id]; return { ...e, units }; }),
      });
    }
    if (setSize(effects.map)) {
      const n = setSize(effects.map);
      out.push({ id: 'map', icon: MapIcon, text: `Map: ${n} ${n === 1 ? 'territory' : 'territories'} changed`, remove: () => setEffects((e) => ({ ...e, map: null })) });
    }
    for (const [key, owner] of Object.entries(effects.regions)) {
      out.push({
        id: `b-${key}`, icon: MapIcon, text: `${countryName.get(key) ?? 'A country'}: held by ${owner ? (cabById.get(owner)?.name ?? 'a cabinet') : 'nobody'}`,
        remove: () => setEffects((e) => { const regions = { ...e.regions }; delete regions[key]; return { ...e, regions }; }),
      });
    }
  }
  for (const [id, c] of Object.entries(effects.characters)) {
    out.push({
      id: `c-${id}`, icon: STATUS_META[c.status].Icon, text: `${charById.get(id)?.name ?? 'A character'}: ${STATUS_META[c.status].label.toLowerCase()}`,
      remove: () => setEffects((e) => { const characters = { ...e.characters }; delete characters[id]; return { ...e, characters }; }),
    });
  }
  if (effects.news && effects.news.title.trim()) {
    out.push({ id: 'news', icon: Newspaper, text: `News: ${effects.news.title.trim()}`, remove: () => setEffects((e) => ({ ...e, news: null })) });
  }
  return out;
}

export default function EffectsRecap({ env }: { env: CardEnv }) {
  const changes = buildChanges(env);
  const total = countChanges(env.effects);
  return (
    <section aria-label="Recap of the changes" aria-live="polite" style={{ flex: 'none', padding: '8px 14px 10px', background: CK.card, boxShadow: `0 -1px 0 ${CK.hair}`, fontFamily: CK.font }}>
      <p className="flex items-center" style={{ margin: 0, gap: 6 }}>
        <Zap size={14} strokeWidth={1.5} aria-hidden style={{ color: CK.red }} />
        <b style={{ fontSize: 12.5, color: CK.ink }}>
          {changes.length === 0 ? 'No changes yet' : total === 1 ? '1 change will apply' : `${total} changes will apply`}
        </b>
      </p>
      {changes.length > 0 && (
        <ul style={{ listStyle: 'none', margin: '5px 0 0', padding: 0, maxHeight: 118, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {changes.map((c) => {
            const I = c.icon;
            return (
              <li key={c.id} className="flex items-start" style={{ gap: 6, padding: '1px 0' }}>
                <I size={12} strokeWidth={1.5} aria-hidden style={{ color: CK.red, flex: 'none', marginTop: 3 }} />
                <span style={{ flex: 1, minWidth: 0, fontSize: 12, lineHeight: 1.3, fontWeight: 600, color: CK.ink, overflowWrap: 'anywhere' }}>{c.text}</span>
                <button type="button" onClick={c.remove} aria-label={`Remove: ${c.text}`} title="Remove this change"
                  className="grid place-items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
                  style={{ width: 18, height: 18, borderRadius: 6, border: 0, background: CK.well, color: CK.ink, cursor: 'pointer', flex: 'none' }}>
                  <X size={11} strokeWidth={1.8} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
