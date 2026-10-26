'use client';
// Gavelling Crisis: the cards of "What happens when you send". Each card holds the controls of ONE
// thing the reply will do (a cabinet's resources, one unit move, one border, one character, a
// newsflash) and has its own remove X. A card only remembers what it is about (EffectCard in the
// draft); what it changes is staged in the draft's maps, and nothing is written until Send reply.

import { useMemo, useState, type ReactNode } from 'react';
import { CircleHelp, Coins, Lock, Map as MapIcon, Minus, Newspaper, Plus, Skull, Undo2, UserCheck, UsersRound, X, type LucideIcon } from 'lucide-react';
import GSelect from '@/components/GSelect';
import { amount as fmtAmount } from '@/lib/crisis/format';
import type { Cabinet, Character, CharacterStatus, MapRegion, MapUnit, Resource, ResourceType } from '@/lib/crisis/types';
import { Avatar, CK, FieldLabel, Skeleton, cabinetTint, fieldStyle, resourceIcon } from '../../crisisKit';
import { KIND_META } from '../map/mapData';
import type { CountryOption } from './countryPick';
import { CabinetLogo } from './directiveParts';
import type { ReplyPowers } from './ReplyActions';
import { STAGEABLE_STATUSES, type EffectCard, type EffectsDraft, type UnitStage } from './replyDraft';
import StageMap from './StageMap';

export interface StageData { types: ResourceType[]; resources: Resource[]; units: MapUnit[]; regions: MapRegion[]; countries: CountryOption[] }

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
}

export const round2 = (n: number) => Math.round(n * 100) / 100;
export const place = (lng: number, lat: number) => `${lat.toFixed(1)}, ${lng.toFixed(1)}`;

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
    case 'border': { const regions = { ...e.regions }; delete regions[card.target]; return { ...e, regions }; }
    case 'character': { const characters = { ...e.characters }; delete characters[card.target]; return { ...e, characters }; }
    case 'news': return { ...e, news: null };
  }
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
                      {' '}<b style={{ color: CK.red }}>Goes to {place(movedTo.lng as number, movedTo.lat as number)}</b>{' '}
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
            <Muted>{unit ? 'Click the map or drag the unit to where it goes.' : 'Pick a unit, or click one on the map.'}</Muted>
            <StageMap
              units={data.units} regions={data.regions} cabinets={env.cabinetColors}
              stagedUnits={effects.units} stagedRegions={effects.regions}
              mode="unit" selectedUnitId={card.target} selectedCountry=""
              canUnits={env.powers.units} canMap={false}
              onSelectUnit={(id) => { if (!taken.has(id) && id !== card.target) onTarget(id); }}
              onPlaceUnit={(lng, lat) => { if (unit) updateUnit(unit, (s) => ({ ...s, lng, lat })); }}
              onPickCountry={() => undefined}
              height={230}
            />
          </>
        )}
    </CardShell>
  );
}

// ── Change a border ──
export function BorderCard({ card, env, onTarget, onRemove }: CardProps) {
  const { data, effects, setEffects, cabById, baseHolder } = env;
  const taken = usedBy(env, 'border', card.id);
  const countryOptions = useMemo(() => (data?.countries ?? []).map((c) => {
    const h = baseHolder.get(c.key);
    return { value: c.key, label: c.name, disabled: taken.has(c.key), hint: taken.has(c.key) ? 'Already in another card' : h ? `Held by ${cabById.get(h)?.name ?? 'a cabinet'}` : undefined };
  }), [data, baseHolder, cabById, taken]);
  const holderOptions = useMemo(() => [{ value: '', label: 'Nobody' }, ...env.cabinets.map((c) => ({ value: c.id, label: c.name }))], [env.cabinets]);
  const key = card.target;
  const holderNow = key ? (key in effects.regions ? effects.regions[key] : (baseHolder.get(key) ?? null)) : null;
  const setHolder = (owner: string | null) => setEffects((e) => {
    const regions = { ...e.regions };
    if (owner === (baseHolder.get(key) ?? null)) delete regions[key]; else regions[key] = owner;
    return { ...e, regions };
  });

  return (
    <CardShell kind="border" onRemove={onRemove}>
      {!env.powers.map ? <Muted>You cannot change the map. The Crisis Director can allow it in Settings.</Muted>
        : !data ? <Skeleton h={220} r={12} />
        : (
          <>
            <div><FieldLabel>Country</FieldLabel>
              <GSelect value={key} options={countryOptions} onChange={onTarget} placeholder="Pick a country, or click it on the map" aria-label="Country" searchable />
            </div>
            {key && (
              <div><FieldLabel>Held by</FieldLabel>
                <GSelect value={holderNow ?? ''} options={holderOptions} onChange={(v) => setHolder(v || null)} aria-label="Held by" />
              </div>
            )}
            <StageMap
              units={data.units} regions={data.regions} cabinets={env.cabinetColors}
              stagedUnits={effects.units} stagedRegions={effects.regions}
              mode="border" selectedUnitId="" selectedCountry={key}
              canUnits={false} canMap={env.powers.map}
              onSelectUnit={() => undefined} onPlaceUnit={() => undefined}
              onPickCountry={(k) => { if (!taken.has(k) && k !== key) onTarget(k); }}
              height={230}
            />
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
      <Muted>A newsflash from this directive, saved as a draft on the News page.</Muted>
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
    </CardShell>
  );
}
