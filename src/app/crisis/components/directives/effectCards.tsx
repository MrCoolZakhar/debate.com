'use client';
// Gavelling Crisis: the cards of "What happens when you send". Each card holds the controls of ONE
// thing the reply will do (a cabinet's resources, one unit move, one border, one character, a
// newsflash) and has its own remove X. A card only remembers what it is about (EffectCard in the
// draft); what it changes is staged in the draft's maps, and nothing is written until Send reply.

import { loadCities, type City } from '../map/cities';
import { useMemo, useState, type ReactNode } from 'react';
import { CircleHelp, Coins, Lock, Map as MapIcon, Minus, Newspaper, Plus, Skull, Undo2, UserCheck, UsersRound, X, type LucideIcon } from 'lucide-react';
import GSelect from '@/components/GSelect';
import { amount as fmtAmount } from '@/lib/crisis/format';
import { kmBetween } from '@/lib/crisis/geo';
import type { Cabinet, Character, CharacterStatus, MapRegion, MapShape, MapUnit, Resource, ResourceType } from '@/lib/crisis/types';
import { Avatar, Btn, CK, FieldLabel, Skeleton, cabinetTint, fieldStyle, resourceIcon } from '../../crisisKit';
import { KIND_META } from '../map/mapData';
import { setSize, type EditSet, type StageOptions } from '../map/mapEdits';
import WarMap from '../map/WarMap';
import type { CountryOption } from './countryPick';
import { CabinetLogo } from './directiveParts';
import NewsMediaPicker from './NewsMediaPicker';
import type { ReplyPowers } from './ReplyActions';
import { STAGEABLE_STATUSES, type EffectCard, type EffectsDraft, type UnitStage } from './replyDraft';

export interface StageData { types: ResourceType[]; resources: Resource[]; units: MapUnit[]; regions: MapRegion[]; shapes: MapShape[]; countries: CountryOption[] }

/** Everything a card needs, built once by the panel. */
export interface CardEnv {
  data: StageData | null;
  powers: ReplyPowers;
  effects: EffectsDraft;
  setEffects: (next: (prev: EffectsDraft) => EffectsDraft) => void;
  authorCharacterId: string | null;
  cabinetId: string | null;
  cabinets: Cabinet[];
  cabById: Map<string, Cabinet>;
  charById: Map<string, Character>;
  characters: Character[];
  typeById: Map<string, { t: ResourceType; i: number }>;
  baseHolder: Map<string, string | null>;
  cabinetColors: Array<{ id: string; color: string }>;
  /** Opens the map editor (inside the side panel) for the reply's border changes. */
  openMap: () => void;
}

export const round2 = (n: number) => Math.round(n * 100) / 100;
// Places are named after the nearest city (the map's city list, loaded once); far from any city, the coordinates.
let cityList: City[] | null = null;
if (typeof window !== 'undefined') loadCities().then((c) => { cityList = c; }).catch(() => {});
export const place = (lng: number, lat: number) => {
  let best: City | null = null; let bestKm = Infinity;
  for (const c of cityList ?? []) {
    const k = crisisKm(lng, lat, c.lng, c.lat);
    if (k < bestKm) { bestKm = k; best = c; }
  }
  if (best && bestKm <= 25) return best.name;
  if (best && bestKm <= 400) {
    const y = lat - best.lat; const x = (lng - best.lng) * Math.cos((best.lat * Math.PI) / 180);
    const dir = ['E', 'NE', 'N', 'NW', 'W', 'SW', 'S', 'SE'][((Math.round(Math.atan2(y, x) / (Math.PI / 4)) % 8) + 8) % 8];
    return `${Math.max(10, Math.round(bestKm / 10) * 10)} km ${dir} of ${best.name}`;
  }
  return `${lat.toFixed(1)}, ${lng.toFixed(1)}`;
};
function crisisKm(lng1: number, lat1: number, lng2: number, lat2: number): number {
  const r = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * r) / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lng2 - lng1) * r) / 2) ** 2;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(a)));
}

export const STATUS_META: Record<CharacterStatus, { label: string; Icon: LucideIcon; color: string }> = {
  active: { label: 'Active', Icon: UserCheck, color: CK.ok },
  arrested: { label: 'Arrested', Icon: Lock, color: CK.goldDeep },
  dead: { label: 'Dead', Icon: Skull, color: CK.danger },
  missing: { label: 'Missing', Icon: CircleHelp, color: '#3E6A9A' },
  spare: { label: 'Spare', Icon: UsersRound, color: CK.muted },
};

export const CARD_META: Record<EffectCard['kind'], { title: string; Icon: LucideIcon }> = {
  resources: { title: 'Resources', Icon: Coins },
  unit: { title: 'Move a Unit', Icon: MapIcon },
  border: { title: 'Change a Border', Icon: MapIcon },
  character: { title: 'A Character', Icon: Skull },
  news: { title: 'Newsflash', Icon: Newspaper },
};

function stepFor(n: number): number {
  const a = Math.abs(n);
  return a >= 10000 ? 1000 : a >= 1000 ? 100 : a >= 100 ? 10 : 1;
}

// ── owners of resources ──
const ownerOf = (r: Resource) => (r.character_id ? `char:${r.character_id}` : `cab:${r.cabinet_id ?? ''}`);

/** The owner a resources card shows when it has not been told: the author's cabinet, then the author, then the first. */
function defaultOwner(env: CardEnv): string {
  const rs = env.data?.resources ?? [];
  if (env.cabinetId && rs.some((r) => ownerOf(r) === `cab:${env.cabinetId}`)) return `cab:${env.cabinetId}`;
  if (env.authorCharacterId && rs.some((r) => ownerOf(r) === `char:${env.authorCharacterId}`)) return `char:${env.authorCharacterId}`;
  return rs[0] ? ownerOf(rs[0]) : '';
}
const effectiveOwner = (card: EffectCard, env: CardEnv) => card.target || defaultOwner(env);

/** The draft with everything this card staged taken out (the card itself stays). */
export function clearCard(e: EffectsDraft, card: EffectCard, env: CardEnv): EffectsDraft {
  switch (card.kind) {
    case 'resources': {
      const owner = effectiveOwner(card, env);
      const resources = { ...e.resources };
      for (const r of env.data?.resources ?? []) if (ownerOf(r) === owner) delete resources[r.id];
      return { ...e, resources };
    }
    case 'unit': { const units = { ...e.units }; delete units[card.target]; return { ...e, units }; }
    case 'border': { const regions = { ...e.regions }; if (card.target) delete regions[card.target]; return { ...e, regions, map: null }; }
    case 'character': { const characters = { ...e.characters }; delete characters[card.target]; return { ...e, characters }; }
    case 'news': return { ...e, news: null };
  }
}

const sameJson = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** One plain line per territory a set of map changes touches. */
export function describeMapEdits(set: EditSet | null, env: Pick<CardEnv, 'data' | 'cabById'>): string[] {
  if (!set || !setSize(set)) return [];
  const names = new Map((env.data?.countries ?? []).map((c) => [c.key, c.name]));
  const who = (id: string | null) => (id ? env.cabById.get(id)?.name ?? 'a cabinet' : 'nobody');
  const baseRegion = new Map((env.data?.regions ?? []).map((r) => [r.region_key, r]));
  const baseShape = new Map((env.data?.shapes ?? []).map((x) => [x.id, x]));
  const out: string[] = [];
  for (const r of set.regions) {
    const was = baseRegion.get(r.key);
    const parts: string[] = [];
    if ((was?.owner_cabinet_id ?? null) !== r.owner_cabinet_id) parts.push(`held by ${who(r.owner_cabinet_id)}`);
    if (!sameJson(was?.geometry, r.geometry)) parts.push(r.geometry ? 'border changed' : 'real border put back');
    out.push(`${names.get(r.key) ?? 'A country'}: ${parts.join(', ') || 'changed'}`);
  }
  for (const a of set.addShapes) out.push(`${a.label || 'New territory'}: new, held by ${who(a.owner_cabinet_id)}`);
  for (const x of set.shapes) out.push(`${baseShape.get(x.id)?.label || 'A drawn territory'}: border changed`);
  for (const x of set.owners) out.push(`${baseShape.get(x.id)?.label || 'A drawn territory'}: held by ${who(x.owner_cabinet_id)}`);
  for (const id of set.removeShapes) out.push(`${baseShape.get(id)?.label || 'A drawn territory'}: removed`);
  return out;
}

// ── small controls ──

/** A number with minus and plus buttons around a typed field. */
function StepNumber({ value, onChange, step, min, label, color }: {
  value: number; onChange: (n: number) => void; step: number; min?: number; label: string; color?: string;
}) {
  const [text, setText] = useState<string | null>(null);
  const clamp = (n: number) => (min !== undefined ? Math.max(min, n) : n);
  const btn = {
    width: 30, height: 32, border: 0, borderRadius: 9, background: CK.well, color: CK.forest, cursor: 'pointer', display: 'grid', placeItems: 'center', flex: 'none',
  } as const;
  return (
    <span className="inline-flex items-center" style={{ gap: 4 }}>
      <button type="button" aria-label={`${label}: take away ${fmtAmount(step)}`} title={`Take away ${fmtAmount(step)}`} onClick={() => onChange(round2(clamp(value - step)))}
        className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] active:scale-[0.94] transition-transform" style={btn}><Minus size={15} strokeWidth={1.8} /></button>
      <input
        type="text" inputMode="decimal" aria-label={label} value={text ?? fmtAmount(value)}
        onFocus={() => setText(String(value))} onBlur={() => setText(null)}
        onChange={(e) => {
          setText(e.target.value);
          const n = Number(e.target.value.replace(/,/g, ''));
          if (e.target.value.trim() !== '' && Number.isFinite(n)) onChange(round2(clamp(n)));
        }}
        style={{ ...fieldStyle, width: 88, padding: '6px 8px', textAlign: 'center', fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: color ?? CK.ink }}
      />
      <button type="button" aria-label={`${label}: add ${fmtAmount(step)}`} title={`Add ${fmtAmount(step)}`} onClick={() => onChange(round2(value + step))}
        className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] active:scale-[0.94] transition-transform" style={btn}><Plus size={15} strokeWidth={1.8} /></button>
    </span>
  );
}

const Muted = ({ children }: { children: ReactNode }) => <p style={{ margin: 0, fontSize: 13, color: CK.muted, lineHeight: 1.45 }}>{children}</p>;

function CardShell({ kind, onRemove, children }: { kind: EffectCard['kind']; onRemove: () => void; children: ReactNode }) {
  const { title, Icon } = CARD_META[kind];
  return (
    <section className="flex flex-col" style={{ gap: 10, background: CK.card, borderRadius: 18, padding: '12px 13px', boxShadow: CK.shadowSm }}>
      <div className="flex items-center" style={{ gap: 7 }}>
        <Icon size={18} strokeWidth={1.5} aria-hidden style={{ color: CK.red, flex: 'none' }} />
        <h3 style={{ margin: 0, flex: 1, fontSize: 15, fontWeight: 800, color: CK.ink, overflowWrap: 'anywhere' }}>{title}</h3>
        <button type="button" onClick={onRemove} aria-label={`Remove: ${title}`} title="Remove this card"
          className="grid place-items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
          style={{ width: 28, height: 28, borderRadius: 9, border: 0, background: CK.well, color: CK.ink, cursor: 'pointer', flex: 'none' }}>
          <X size={15} strokeWidth={1.8} />
        </button>
      </div>
      {children}
    </section>
  );
}

interface CardProps { card: EffectCard; env: CardEnv; onTarget: (target: string) => void; onRemove: () => void }

/** What other cards of the same kind already hold, so two cards never fight over one thing. */
const usedBy = (env: CardEnv, kind: EffectCard['kind'], except: string) => new Set(env.effects.cards.filter((c) => c.kind === kind && c.id !== except && c.target).map((c) => c.target));

// ── Resources ──
export function ResourcesCard({ card, env, onTarget, onRemove }: CardProps) {
  const { data, effects, setEffects, typeById, cabById, charById } = env;
  const owner = effectiveOwner(card, env);
  const taken = useMemo(() => new Set(effects.cards.filter((c) => c.kind === 'resources' && c.id !== card.id).map((c) => effectiveOwner(c, env))), [effects.cards, card.id, env]);

  const owners = useMemo(() => {
    const seen = new Map<string, { value: string; label: string; hint?: string; icon: ReactNode; disabled: boolean }>();
    for (const r of data?.resources ?? []) {
      const key = ownerOf(r);
      if (seen.has(key)) continue;
      if (r.character_id) {
        const ch = charById.get(r.character_id);
        seen.set(key, {
          value: key, label: ch?.name ?? 'Character', hint: r.character_id === env.authorCharacterId ? 'The author' : 'A character',
          icon: <Avatar name={ch?.name ?? '?'} src={ch?.picture_url} size={22} color={cabById.get(ch?.cabinet_id ?? '')?.color ?? CK.red} />, disabled: taken.has(key),
        });
      } else {
        const cab = r.cabinet_id ? cabById.get(r.cabinet_id) : undefined;
        seen.set(key, {
          value: key, label: cab?.name ?? 'Cabinet', hint: r.cabinet_id === env.cabinetId ? 'The author’s cabinet' : undefined,
          icon: <CabinetLogo cabinet={cab} size={22} />, disabled: taken.has(key),
        });
      }
    }
    return [...seen.values()].map((o) => (o.disabled ? { ...o, hint: 'Already in another card' } : o));
  }, [data, charById, cabById, env.authorCharacterId, env.cabinetId, taken]);

  const items = useMemo(() => (data?.resources ?? []).filter((r) => ownerOf(r) === owner).sort((a, b) => (typeById.get(a.type_id)?.i ?? 999) - (typeById.get(b.type_id)?.i ?? 999)), [data, owner, typeById]);

  const setResourceTo = (r: Resource, next: number) => setEffects((e) => {
    const delta = round2(next - r.amount);
    const resources = { ...e.resources };
    if (delta === 0) delete resources[r.id]; else resources[r.id] = delta;
    return { ...e, resources };
  });

  return (
    <CardShell kind="resources" onRemove={onRemove}>
      {!env.powers.resources ? <Muted>You cannot change resources. The Crisis Director can allow it in Settings.</Muted>
        : !data ? <Skeleton h={60} r={12} />
        : owners.length === 0 ? <Muted>No resources yet. They are set up on the Resources page.</Muted>
        : (
          <>
            <div><FieldLabel>Whose resources</FieldLabel>
              <GSelect value={owner} options={owners} onChange={(v) => onTarget(v)} aria-label="Whose resources" />
            </div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {items.map((r) => {
                const t = typeById.get(r.type_id)?.t;
                const delta = effects.resources[r.id] ?? 0;
                const next = round2(r.amount + delta);
                const tone = delta > 0 ? CK.ok : delta < 0 ? CK.danger : CK.ink;
                return (
                  <li key={r.id} className="flex items-center flex-wrap" style={{ gap: '6px 10px', padding: '6px 0' }}>
                    <span aria-hidden style={{ width: 34, height: 34, borderRadius: '50%', display: 'grid', placeItems: 'center', flex: 'none', background: CK.well, color: CK.red }}>{resourceIcon(t?.name ?? '', 18)}</span>
                    <span style={{ flex: '1 1 110px', minWidth: 0 }}>
                      <b style={{ display: 'block', fontSize: 13.5, color: CK.ink, overflowWrap: 'anywhere' }}>{t?.name ?? 'Resource'}</b>
                      <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: CK.muted, fontVariantNumeric: 'tabular-nums' }}>
                        {fmtAmount(r.amount)}{t?.unit ? ` ${t.unit}` : ''}
                        {delta !== 0 && <b style={{ color: tone }}>{` to ${fmtAmount(next)} (${delta > 0 ? '+' : '-'}${fmtAmount(Math.abs(delta))})`}</b>}
                      </span>
                    </span>
                    <StepNumber value={next} step={stepFor(r.amount)} label={`${t?.name ?? 'Resource'} new amount`} color={delta !== 0 ? tone : undefined} onChange={(n) => setResourceTo(r, n)} />
                  </li>
                );
              })}
            </ul>
          </>
        )}
    </CardShell>
  );
}

// ── Move a unit ──
// The same map as the Map page: pick the unit, then drag it to its new place. A dashed trajectory stays on the
// map for every move this reply plans; nothing is written until Send reply.
export function UnitCard({ card, env, onTarget, onRemove }: CardProps) {
  const { data, effects, setEffects, cabById } = env;
  const unit = data?.units.find((u) => u.id === card.target);
  const taken = usedBy(env, 'unit', card.id);
  const options = useMemo(() => (data?.units ?? []).map((u) => ({
    value: u.id, label: u.name, disabled: taken.has(u.id),
    hint: taken.has(u.id) ? 'Already in another card' : [KIND_META[u.kind]?.label, cabById.get(u.owner_cabinet_id ?? '')?.name, `amount ${fmtAmount(u.strength)}`].filter(Boolean).join(', '),
  })), [data, cabById, taken]);

  const updateUnit = (u: MapUnit, fn: (s: UnitStage) => UnitStage) => setEffects((e) => {
    const next = fn({ ...(e.units[u.id] ?? {}) });
    const clean: UnitStage = {};
    if (next.lng !== undefined && next.lat !== undefined && (next.lng !== u.lng || next.lat !== u.lat)) { clean.lng = next.lng; clean.lat = next.lat; }
    if (next.strength !== undefined && next.strength !== u.strength) clean.strength = next.strength;
    const units = { ...e.units };
    if (clean.lng === undefined && clean.strength === undefined) delete units[u.id]; else units[u.id] = clean;
    return { ...e, units };
  });

  const staged = unit ? effects.units[unit.id] : undefined;
  const movedTo = staged && staged.lng !== undefined && staged.lat !== undefined ? staged : null;
  const amountNow = unit ? (staged?.strength ?? unit.strength) : 0;

  // Every move this reply plans, for the trajectories.
  const moves = useMemo(() => {
    const m: Record<string, { lng: number; lat: number }> = {};
    for (const [id, st] of Object.entries(effects.units)) if (st.lng !== undefined && st.lat !== undefined) m[id] = { lng: st.lng, lat: st.lat };
    return m;
  }, [effects.units]);
  const unitsRef = data?.units;
  const stage = useMemo<StageOptions | null>(() => (data ? {
    kind: 'unit', data: { regions: data.regions, units: data.units, shapes: data.shapes }, canUnits: env.powers.units, canMap: false,
    height: 300, unitId: card.target, moves,
    onSelectUnit: (id) => { if (!taken.has(id) && id !== card.target) onTarget(id); },
    onUnitMove: (id, lng, lat) => {
      // Before a unit is picked any unit can be dragged straight away, like on the real map: the drag picks it.
      if (!card.target) { if (taken.has(id)) return; onTarget(id); }
      const u = unitsRef?.find((x) => x.id === id);
      if (u) updateUnit(u, (s) => ({ ...s, lng, lat }));
    },
  } : null),
  // The map reads its data once; only what changes how it behaves is a dependency.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [data, env.powers.units, card.target, moves, taken]);

  return (
    <CardShell kind="unit" onRemove={onRemove}>
      {!env.powers.units ? <Muted>You cannot move units. The Crisis Director can allow it in Settings.</Muted>
        : !data ? <Skeleton h={220} r={12} />
        : (
          <>
            <div><FieldLabel>Unit</FieldLabel>
              <GSelect value={card.target} options={options} onChange={onTarget} placeholder={options.length ? 'Pick a unit, or click one on the map' : 'No units on the map yet'} aria-label="Unit" searchable />
            </div>
            {unit && (
              <div className="flex flex-col" style={{ gap: 6 }}>
                <p style={{ margin: 0, fontSize: 13, color: CK.inkSoft }}>
                  <b style={{ color: CK.ink }}>Now at</b> {place(unit.lng, unit.lat)}
                  {movedTo && (
                    <>
                      {' '}<b style={{ color: CK.red }}>
                        Goes to {place(movedTo.lng as number, movedTo.lat as number)}, {Math.round(kmBetween([unit.lng, unit.lat], [movedTo.lng as number, movedTo.lat as number])).toLocaleString('en-US')} km
                      </b>{' '}
                      <button type="button" onClick={() => updateUnit(unit, (s) => ({ ...s, lng: undefined, lat: undefined }))}
                        className="inline-flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
                        style={{ gap: 4, border: 0, background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: CK.font, fontSize: 12.5, fontWeight: 700, color: CK.forest, textDecoration: 'underline' }}>
                        <Undo2 size={12} strokeWidth={1.8} aria-hidden />Keep it where it is
                      </button>
                    </>
                  )}
                </p>
                <div className="flex items-center flex-wrap" style={{ gap: 8 }}>
                  <b style={{ fontSize: 13, color: CK.ink }}>Amount</b>
                  <StepNumber value={amountNow} min={0} step={stepFor(unit.strength)} label={`${unit.name} amount`}
                    color={amountNow > unit.strength ? CK.ok : amountNow < unit.strength ? CK.danger : undefined}
                    onChange={(n) => updateUnit(unit, (s) => ({ ...s, strength: Math.round(n) }))} />
                  {amountNow !== unit.strength && (
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: amountNow > unit.strength ? CK.ok : CK.danger, fontVariantNumeric: 'tabular-nums' }}>
                      {fmtAmount(unit.strength)} to {fmtAmount(amountNow)}
                    </span>
                  )}
                </div>
              </div>
            )}
            <Muted>{unit ? 'Drag the unit to where it goes, then press Move. Dashed lines show the moves this reply plans.' : 'Drag a unit on the map to where it goes, or pick one above.'}</Muted>
            {stage && <WarMap stage={stage} />}
          </>
        )}
    </CardShell>
  );
}

// ── Change a border ──
// The map editor opens in the side panel itself (EffectsPanel swaps its content, with a back button). The card
// only says what the reply will change on the map and opens the editor.
export function BorderCard({ env, onRemove }: Pick<CardProps, 'env' | 'onRemove'>) {
  const { data, effects, setEffects } = env;
  const lines = describeMapEdits(effects.map, env);
  return (
    <CardShell kind="border" onRemove={onRemove}>
      {!env.powers.map ? <Muted>You cannot change the map. The Crisis Director can allow it in Settings.</Muted>
        : !data ? <Skeleton h={80} r={12} />
        : (
          <>
            <Muted>Pick a country to change who holds it, drag a border, or draw new territory. The real countries stay visible underneath.</Muted>
            {lines.length > 0 && (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {lines.map((t, i) => (
                  <li key={i} className="flex items-center" style={{ gap: 7, fontSize: 13, fontWeight: 600, color: CK.ink, overflowWrap: 'anywhere' }}>
                    <MapIcon size={14} strokeWidth={1.5} aria-hidden style={{ color: CK.red, flex: 'none' }} />{t}
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap" style={{ gap: 8 }}>
              <Btn tone="green" size="sm" icon={<MapIcon size={14} strokeWidth={1.5} />} onClick={env.openMap}>{lines.length ? 'Open the map again' : 'Open the map'}</Btn>
              {lines.length > 0 && <Btn tone="ghost" size="sm" onClick={() => setEffects((e) => ({ ...e, map: null }))}>Clear these changes</Btn>}
            </div>
          </>
        )}
    </CardShell>
  );
}

// ── A character ──
export function CharacterCard({ card, env, onTarget, onRemove }: CardProps) {
  const { effects, setEffects, cabById, charById } = env;
  const taken = usedBy(env, 'character', card.id);
  const options = useMemo(() => {
    const sorted = [...env.characters].sort((a, b) => (a.id === env.authorCharacterId ? -1 : b.id === env.authorCharacterId ? 1 : 0));
    return sorted.map((c) => ({
      value: c.id, label: c.name, disabled: taken.has(c.id),
      hint: taken.has(c.id) ? 'Already in another card' : [c.id === env.authorCharacterId ? 'Wrote this directive' : null, cabById.get(c.cabinet_id ?? '')?.name].filter(Boolean).join(', ') || undefined,
      icon: <Avatar name={c.name} src={c.picture_url} size={24} color={cabById.get(c.cabinet_id ?? '')?.color ?? CK.red} />,
    }));
  }, [env.characters, env.authorCharacterId, cabById, taken]);
  const ch = card.target ? charById.get(card.target) : undefined;
  const staged = ch ? effects.characters[ch.id] : undefined;
  const setStatus = (status: CharacterStatus) => {
    if (!ch) return;
    setEffects((e) => {
      const characters = { ...e.characters };
      if (status === ch.status || characters[ch.id]?.status === status) delete characters[ch.id];
      else characters[ch.id] = { status, note: characters[ch.id]?.note ?? '' };
      return { ...e, characters };
    });
  };

  return (
    <CardShell kind="character" onRemove={onRemove}>
      <div><FieldLabel>Character</FieldLabel>
        <GSelect value={card.target} options={options} onChange={onTarget} placeholder="Pick a character" aria-label="Character" searchable />
      </div>
      {ch && (
        <>
          <div role="group" aria-label="New status" style={{ display: 'grid', gap: 6, gridTemplateColumns: 'repeat(auto-fit, minmax(92px, 1fr))' }}>
            {STAGEABLE_STATUSES.map((s) => {
              const meta = STATUS_META[s];
              const isNow = ch.status === s;
              const on = staged?.status === s;
              return (
                <button key={s} type="button" aria-pressed={on} onClick={() => setStatus(s)}
                  className="flex flex-col items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] active:scale-[0.97] transition-transform"
                  style={{ border: 0, borderRadius: 13, padding: '8px 4px', gap: 3, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: CK.font,
                    background: on ? meta.color : cabinetTint(meta.color, isNow ? 0.16 : 0.06), color: on ? '#fff' : meta.color,
                    boxShadow: on ? CK.shadowSm : `inset 0 0 0 1px ${cabinetTint(meta.color, isNow ? 0.5 : 0.2)}` }}>
                  <meta.Icon size={20} strokeWidth={1.5} aria-hidden />
                  <span>{meta.label}</span>
                  {isNow && <span style={{ fontSize: 10.5, fontWeight: 600, opacity: 0.85 }}>now</span>}
                </button>
              );
            })}
          </div>
          {staged && (
            <input value={staged.note} maxLength={200} aria-label="Status note" placeholder="Short note, for example: killed in the raid" style={fieldStyle}
              onChange={(e) => setEffects((e0) => ({ ...e0, characters: { ...e0.characters, [ch.id]: { ...staged, note: e.target.value } } }))} />
          )}
        </>
      )}
    </CardShell>
  );
}

// ── Newsflash ──
export function NewsCard({ env, onRemove }: Pick<CardProps, 'env' | 'onRemove'>) {
  const { effects, setEffects } = env;
  const news = effects.news;
  const audienceOptions = useMemo(() => [{ value: '', label: 'Every room' }, ...env.cabinets.map((c) => ({ value: c.id, label: c.name }))], [env.cabinets]);
  const patchNews = (patch: Partial<NonNullable<EffectsDraft['news']>>) => setEffects((e) => ({
    ...e, news: { title: '', body: '', source: '', audience: '', ...(e.news ?? {}), ...patch },
  }));
  return (
    <CardShell kind="news" onRemove={onRemove}>
      <Muted>A newsflash from this directive. It goes out with the reply, with its picture and file.</Muted>
      <div><FieldLabel>Title</FieldLabel>
        <input value={news?.title ?? ''} onChange={(e) => patchNews({ title: e.target.value })} maxLength={160} aria-label="News title" placeholder="What happened" style={fieldStyle} />
      </div>
      <div><FieldLabel>Story</FieldLabel>
        <textarea value={news?.body ?? ''} onChange={(e) => patchNews({ body: e.target.value })} rows={3} aria-label="News text" placeholder="The story" style={{ ...fieldStyle, resize: 'vertical' }} />
      </div>
      <div className="flex flex-wrap" style={{ gap: 8 }}>
        <div style={{ flex: '1 1 150px', minWidth: 0 }}><FieldLabel hint="optional">Source</FieldLabel>
          <input value={news?.source ?? ''} onChange={(e) => patchNews({ source: e.target.value })} maxLength={80} aria-label="News source" placeholder="For example Radio Moscow" style={fieldStyle} />
        </div>
        <div style={{ flex: '1 1 150px', minWidth: 0 }}><FieldLabel>Who reads it</FieldLabel>
          <GSelect size="sm" value={news?.audience ?? ''} options={audienceOptions} onChange={(v) => patchNews({ audience: v })} aria-label="News audience" />
        </div>
      </div>
      <NewsMediaPicker
        media={{ bannerUrl: news?.bannerUrl ?? null, fileUrl: news?.fileUrl ?? null, fileName: news?.fileName ?? null }}
        onChange={(p) => patchNews(p)}
      />
    </CardShell>
  );
}
