'use client';
// Gavelling Crisis: the side panel of a directive, "What happens when you send". It starts EMPTY:
// "Nothing changes yet" and a plus. The plus opens a small menu right inside the panel (Resources,
// Move a unit, Change a border, A character, Newsflash); each choice adds a CARD that holds that one
// action's controls and has its own remove X. The plus stays at the bottom, so several characters, unit
// moves or borders can be added. Every change is STAGED in the reply's draft and summed at the top;
// nothing is written until Send reply, which applies them all in one call (answerDirective).

import { useEffect, useMemo, useRef, useState } from 'react';
import { Coins, Map as MapIcon, Newspaper, Plus, X, Zap, type LucideIcon } from 'lucide-react';
import { notifyErr } from '@/lib/appNotify';
import { crisisError, loadMap, loadResources, type CrisisRef } from '@/lib/crisis/api';
import { amount as fmtAmount } from '@/lib/crisis/format';
import { CK, cabinetTint } from '../../crisisKit';
import { useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import { loadCountries, type CountryOption } from './countryPick';
import {
  BorderCard, CARD_META, CharacterCard, NewsCard, ResourcesCard, STATUS_META, UnitCard, clearCard, place, round2,
  type CardEnv, type StageData,
} from './effectCards';
import type { ReplyPowers } from './ReplyActions';
import { countChanges, newCardId, type EffectCard, type EffectCardKind, type EffectsDraft } from './replyDraft';

interface MenuItem { kind: EffectCardKind; label: string; Icon: LucideIcon; blocked: string | null }

export default function EffectsPanel({ crisisRef, authorCharacterId, cabinetId, powers, effects, setEffects }: {
  crisisRef: CrisisRef;
  authorCharacterId: string | null;
  cabinetId: string | null;
  powers: ReplyPowers;
  effects: EffectsDraft;
  setEffects: (next: (prev: EffectsDraft) => EffectsDraft) => void;
}) {
  const { core } = useCrisis();
  const [data, setData] = useState<StageData | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const justAdded = useRef<string | null>(null);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadResources(crisisRef), loadMap(crisisRef), loadCountries().catch(() => [] as CountryOption[])])
      .then(([r, m, countries]) => { if (!cancelled) setData({ types: r.types, resources: r.resources, units: m.units, regions: m.regions, countries }); })
      .catch((e) => {
        if (cancelled) return;
        setData({ types: [], resources: [], units: [], regions: [], countries: [] });
        notifyErr(crisisError(e, 'Could not load the resources and the map.'), 'crisis-effects');
      });
    return () => { cancelled = true; };
  }, [crisisRef]);

  const cabById = useMemo(() => new Map(core.cabinets.map((c) => [c.id, c])), [core.cabinets]);
  const charById = useMemo(() => new Map(core.characters.map((c) => [c.id, c])), [core.characters]);
  const cabinetColors = useMemo(() => core.cabinets.map((c) => ({ id: c.id, color: c.color })), [core.cabinets]);
  const typeById = useMemo(() => new Map((data?.types ?? []).map((t, i) => [t.id, { t, i }])), [data]);
  const countryName = useMemo(() => new Map((data?.countries ?? []).map((c) => [c.key, c.name])), [data]);
  const baseHolder = useMemo(() => new Map((data?.regions ?? []).map((r) => [r.region_key, r.owner_cabinet_id])), [data]);

  const env: CardEnv = {
    data, powers, effects, setEffects, authorCharacterId, cabinetId, cabinets: core.cabinets, cabById, charById,
    characters: core.characters, typeById, baseHolder, cabinetColors,
  };

  // A card that was just added scrolls into view.
  const cardCount = effects.cards.length;
  useEffect(() => {
    const id = justAdded.current;
    if (!id) return;
    justAdded.current = null;
    root.current?.querySelector<HTMLElement>(`[data-card="${id}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [cardCount]);

  const addCard = (kind: EffectCardKind) => {
    const id = newCardId();
    let target = '';
    if (kind === 'character' && authorCharacterId && !effects.cards.some((c) => c.kind === 'character' && c.target === authorCharacterId)) target = authorCharacterId;
    setEffects((e) => ({ ...e, cards: [...e.cards, { id, kind, target }] }));
    setMenuOpen(false);
    justAdded.current = id;
  };
  const removeCard = (card: EffectCard) => setEffects((e) => ({ ...clearCard(e, card, env), cards: e.cards.filter((c) => c.id !== card.id) }));
  const retarget = (card: EffectCard, target: string) => setEffects((e) => ({ ...clearCard(e, card, env), cards: e.cards.map((c) => (c.id === card.id ? { ...c, target } : c)) }));

  const hasNews = effects.cards.some((c) => c.kind === 'news');
  const menu: MenuItem[] = [
    { kind: 'resources', label: 'Resources', Icon: CARD_META.resources.Icon, blocked: powers.resources ? null : 'Not allowed' },
    { kind: 'unit', label: 'Move a unit', Icon: CARD_META.unit.Icon, blocked: powers.units ? null : 'Not allowed' },
    { kind: 'border', label: 'Change a border', Icon: CARD_META.border.Icon, blocked: powers.map ? null : 'Not allowed' },
    { kind: 'character', label: 'A character', Icon: CARD_META.character.Icon, blocked: null },
    { kind: 'news', label: 'Newsflash', Icon: CARD_META.news.Icon, blocked: hasNews ? 'One per reply' : null },
  ];

  // ── the summary ──
  interface Change { id: string; icon: LucideIcon; text: string; remove: () => void }
  const changes: Change[] = [];
  if (data) {
    for (const [id, delta] of Object.entries(effects.resources)) {
      const r = data.resources.find((x) => x.id === id);
      if (!r) continue;
      const t = typeById.get(r.type_id)?.t;
      const owner = r.character_id ? charById.get(r.character_id)?.name : cabById.get(r.cabinet_id ?? '')?.name;
      changes.push({
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
      changes.push({
        id: `u-${id}`, icon: MapIcon, text: `${u.name}: ${parts.join(', ')}`,
        remove: () => setEffects((e) => { const units = { ...e.units }; delete units[id]; return { ...e, units }; }),
      });
    }
    for (const [key, owner] of Object.entries(effects.regions)) {
      changes.push({
        id: `b-${key}`, icon: MapIcon, text: `${countryName.get(key) ?? 'A country'}: held by ${owner ? (cabById.get(owner)?.name ?? 'a cabinet') : 'nobody'}`,
        remove: () => setEffects((e) => { const regions = { ...e.regions }; delete regions[key]; return { ...e, regions }; }),
      });
    }
  }
  for (const [id, c] of Object.entries(effects.characters)) {
    changes.push({
      id: `c-${id}`, icon: STATUS_META[c.status].Icon, text: `${charById.get(id)?.name ?? 'A character'}: ${STATUS_META[c.status].label.toLowerCase()}`,
      remove: () => setEffects((e) => { const characters = { ...e.characters }; delete characters[id]; return { ...e, characters }; }),
    });
  }
  if (effects.news && effects.news.title.trim()) {
    changes.push({ id: 'news', icon: Newspaper, text: `News: ${effects.news.title.trim()}`, remove: () => setEffects((e) => ({ ...e, news: null })) });
  }
  const total = countChanges(effects);
  const empty = effects.cards.length === 0;

  const addMenu = (
    <div className="flex flex-col" style={{ gap: 8 }}>
      <button type="button" onClick={() => setMenuOpen((v) => !v)} aria-expanded={menuOpen} aria-haspopup="true"
        className="inline-flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] active:scale-[0.98] transition-transform"
        style={{ alignSelf: 'flex-start', gap: 8, border: 0, cursor: 'pointer', fontFamily: CK.font, fontSize: 13.5, fontWeight: 800, color: CK.forest, background: CK.card, borderRadius: 12, padding: '7px 14px 7px 8px', boxShadow: `inset 0 0 0 1px ${CK.hair}, ${CK.shadowSm}` }}>
        <span aria-hidden style={{ width: 26, height: 26, borderRadius: '50%', display: 'grid', placeItems: 'center', background: CK.greenBtn, color: '#fff' }}>
          <Plus size={16} strokeWidth={2} style={{ transform: menuOpen ? 'rotate(45deg)' : 'none', transition: 'transform 160ms' }} />
        </span>
        Add what happens
      </button>
      {menuOpen && (
        <div role="menu" aria-label="What should happen" style={{ display: 'grid', gap: 6, gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
          {menu.map((m) => (
            <button key={m.kind} type="button" role="menuitem" disabled={!!m.blocked} onClick={() => addCard(m.kind)}
              className="flex items-center text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] active:scale-[0.98] transition-transform disabled:cursor-not-allowed"
              style={{ gap: 9, border: 0, borderRadius: 13, padding: '9px 11px', fontFamily: CK.font, cursor: 'pointer', background: CK.card, boxShadow: `inset 0 0 0 1px ${CK.hair}`, opacity: m.blocked ? 0.55 : 1 }}>
              <m.Icon size={19} strokeWidth={1.5} aria-hidden style={{ color: CK.red, flex: 'none' }} />
              <span style={{ minWidth: 0 }}>
                <b style={{ display: 'block', fontSize: 13.5, color: CK.ink, overflowWrap: 'anywhere' }}>{m.label}</b>
                {m.blocked && <span style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: CK.muted }}>{m.blocked}</span>}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div ref={root} className="flex flex-col" style={{ gap: 12, fontFamily: CK.font }}>
      {/* What will apply */}
      <section aria-live="polite" className="flex flex-col" style={{ gap: 10, background: total ? cabinetTint(CK.red, 0.06) : CK.card, borderRadius: 18, padding: '12px 13px', boxShadow: total ? `inset 0 0 0 1px ${cabinetTint(CK.red, 0.22)}` : CK.shadowSm }}>
        <p className="flex items-center" style={{ margin: 0, gap: 8 }}>
          <Zap size={18} strokeWidth={1.5} aria-hidden style={{ color: CK.red }} />
          <b style={{ fontSize: 15, color: CK.ink }}>
            {empty ? 'Nothing changes yet' : total === 0 ? 'No changes yet' : total === 1 ? '1 change will apply' : `${total} changes will apply`}
          </b>
        </p>
        {changes.length > 0 && (
          <ul className="flex flex-col" style={{ listStyle: 'none', margin: 0, padding: 0, gap: 5 }}>
            {changes.map((c) => {
              const I = c.icon;
              return (
                <li key={c.id} className="flex items-center" style={{ gap: 8, background: CK.card, borderRadius: 11, padding: '5px 5px 5px 10px', boxShadow: `inset 0 0 0 1px ${CK.hair}` }}>
                  <I size={15} strokeWidth={1.5} aria-hidden style={{ color: CK.red, flex: 'none' }} />
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: CK.ink, overflowWrap: 'anywhere' }}>{c.text}</span>
                  <button type="button" onClick={c.remove} aria-label={`Remove: ${c.text}`} title="Remove this change"
                    className="grid place-items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
                    style={{ width: 24, height: 24, borderRadius: 8, border: 0, background: CK.well, color: CK.ink, cursor: 'pointer', flex: 'none' }}>
                    <X size={13} strokeWidth={1.8} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {empty && addMenu}
      </section>

      {/* The cards */}
      {effects.cards.map((card) => {
        const common = { card, env, onTarget: (t: string) => retarget(card, t), onRemove: () => removeCard(card) };
        return (
          <div key={card.id} data-card={card.id}>
            {card.kind === 'resources' && <ResourcesCard {...common} />}
            {card.kind === 'unit' && <UnitCard {...common} />}
            {card.kind === 'border' && <BorderCard {...common} />}
            {card.kind === 'character' && <CharacterCard {...common} />}
            {card.kind === 'news' && <NewsCard env={env} onRemove={common.onRemove} />}
          </div>
        );
      })}

      {!empty && addMenu}
    </div>
  );
}
