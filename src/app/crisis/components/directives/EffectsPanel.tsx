'use client';
// Gavelling Crisis: the side panel of a directive, "What happens when you send". Plain sections that
// are always visible: Resources, Map (a unit's place and amount, a country's holder), Characters and
// News. Every change is STAGED in the reply's draft and listed at the top, each removable. Nothing is
// written until Send reply, which applies them all in the same call (answerDirective).

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  CircleHelp, Coins, Lock, Map as MapIcon, Minus, Newspaper, Plus, Skull, Undo2, UserCheck, UsersRound, X, Zap, type LucideIcon,
} from 'lucide-react';
import GSelect from '@/components/GSelect';
import { notifyErr } from '@/lib/appNotify';
import { crisisError, loadMap, loadResources, type CrisisRef } from '@/lib/crisis/api';
import { amount as fmtAmount } from '@/lib/crisis/format';
import type { CharacterStatus, MapRegion, MapUnit, Resource, ResourceType } from '@/lib/crisis/types';
import { Avatar, CK, FieldLabel, Segmented, Skeleton, cabinetTint, fieldStyle, resourceIcon } from '../../crisisKit';
import { useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import { KIND_META } from '../map/mapData';
import { loadCountries, type CountryOption } from './countryPick';
import { CabinetLogo } from './directiveParts';
import type { ReplyPowers } from './ReplyActions';
import { STAGEABLE_STATUSES, countChanges, type EffectsDraft, type UnitStage } from './replyDraft';
import StageMap, { type StageMode } from './StageMap';

interface StageData { types: ResourceType[]; resources: Resource[]; units: MapUnit[]; regions: MapRegion[]; countries: CountryOption[] }

const round2 = (n: number) => Math.round(n * 100) / 100;
const place = (lng: number, lat: number) => `${lat.toFixed(1)}, ${lng.toFixed(1)}`;
const upColor = CK.ok;
const downColor = CK.danger;

function stepFor(n: number): number {
  const a = Math.abs(n);
  return a >= 10000 ? 1000 : a >= 1000 ? 100 : a >= 100 ? 10 : 1;
}

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

function Section({ icon, title, children }: { icon: LucideIcon; title: string; children: ReactNode }) {
  const I = icon;
  return (
    <section className="flex flex-col" style={{ gap: 10, background: CK.card, borderRadius: 18, padding: '12px 13px', boxShadow: CK.shadowSm }}>
      <h3 className="flex items-center" style={{ margin: 0, gap: 7, fontSize: 15, fontWeight: 800, color: CK.ink }}>
        <I size={18} strokeWidth={1.5} aria-hidden style={{ color: CK.red }} />{title}
      </h3>
      {children}
    </section>
  );
}

const Muted = ({ children }: { children: ReactNode }) => <p style={{ margin: 0, fontSize: 13, color: CK.muted, lineHeight: 1.45 }}>{children}</p>;

const STATUS_META: Record<CharacterStatus, { label: string; Icon: LucideIcon; color: string }> = {
  active: { label: 'Active', Icon: UserCheck, color: CK.ok },
  arrested: { label: 'Arrested', Icon: Lock, color: CK.goldDeep },
  dead: { label: 'Dead', Icon: Skull, color: CK.danger },
  missing: { label: 'Missing', Icon: CircleHelp, color: '#3E6A9A' },
  spare: { label: 'Spare', Icon: UsersRound, color: CK.muted },
};

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
  const [mode, setMode] = useState<StageMode>(powers.units ? 'unit' : 'border');
  const [unitId, setUnitId] = useState('');
  const [country, setCountry] = useState('');
  const [charId, setCharId] = useState(authorCharacterId ?? '');
  const [openOthers, setOpenOthers] = useState<Record<string, boolean>>({});

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
  const unit = data?.units.find((u) => u.id === unitId);

  // ── staging ──
  const setResourceTo = (r: Resource, next: number) => setEffects((e) => {
    const delta = round2(next - r.amount);
    const resources = { ...e.resources };
    if (delta === 0) delete resources[r.id]; else resources[r.id] = delta;
    return { ...e, resources };
  });
  const updateUnit = (u: MapUnit, fn: (s: UnitStage) => UnitStage) => setEffects((e) => {
    const next = fn({ ...(e.units[u.id] ?? {}) });
    const clean: UnitStage = {};
    if (next.lng !== undefined && next.lat !== undefined && (next.lng !== u.lng || next.lat !== u.lat)) { clean.lng = next.lng; clean.lat = next.lat; }
    if (next.strength !== undefined && next.strength !== u.strength) clean.strength = next.strength;
    const units = { ...e.units };
    if (clean.lng === undefined && clean.strength === undefined) delete units[u.id]; else units[u.id] = clean;
    return { ...e, units };
  });
  const setHolder = (key: string, owner: string | null) => setEffects((e) => {
    const regions = { ...e.regions };
    if (owner === (baseHolder.get(key) ?? null)) delete regions[key]; else regions[key] = owner;
    return { ...e, regions };
  });
  const setCharStatus = (id: string, status: CharacterStatus, current: CharacterStatus) => setEffects((e) => {
    const characters = { ...e.characters };
    if (status === current || characters[id]?.status === status) delete characters[id];
    else characters[id] = { status, note: characters[id]?.note ?? '' };
    return { ...e, characters };
  });
  const patchNews = (patch: Partial<NonNullable<EffectsDraft['news']>>) => setEffects((e) => ({
    ...e, news: { title: '', body: '', source: '', audience: '', ...(e.news ?? {}), ...patch },
  }));

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

  // ── Resources ──
  const groups = useMemo(() => {
    if (!data) return [];
    const order = (r: Resource) => typeById.get(r.type_id)?.i ?? 999;
    const out: Array<{ key: string; title: string; cabinet?: (typeof core.cabinets)[number]; items: Resource[]; primary: boolean }> = [];
    if (authorCharacterId) {
      const items = data.resources.filter((r) => r.character_id === authorCharacterId).sort((a, b) => order(a) - order(b));
      if (items.length) out.push({ key: `char-${authorCharacterId}`, title: charById.get(authorCharacterId)?.name ?? 'Character', items, primary: true });
    }
    const cabs = [...core.cabinets].sort((a, b) => (a.id === cabinetId ? -1 : b.id === cabinetId ? 1 : 0));
    for (const c of cabs) {
      const items = data.resources.filter((r) => r.cabinet_id === c.id).sort((a, b) => order(a) - order(b));
      if (items.length) out.push({ key: c.id, title: c.name, cabinet: c, items, primary: c.id === cabinetId });
    }
    return out;
  }, [data, typeById, core, authorCharacterId, cabinetId, charById]);

  const resourceRow = (r: Resource) => {
    const t = typeById.get(r.type_id)?.t;
    const delta = effects.resources[r.id] ?? 0;
    const next = round2(r.amount + delta);
    const tone = delta > 0 ? upColor : delta < 0 ? downColor : CK.ink;
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
  };

  // ── Map ──
  const unitOptions = useMemo(() => (data?.units ?? []).map((u) => ({
    value: u.id, label: u.name,
    hint: [KIND_META[u.kind]?.label, cabById.get(u.owner_cabinet_id ?? '')?.name, `amount ${fmtAmount(u.strength)}`].filter(Boolean).join(', '),
  })), [data, cabById]);
  const countryOptions = useMemo(() => (data?.countries ?? []).map((c) => {
    const h = baseHolder.get(c.key);
    return { value: c.key, label: c.name, hint: h ? `Held by ${cabById.get(h)?.name ?? 'a cabinet'}` : undefined };
  }), [data, baseHolder, cabById]);
  const holderOptions = useMemo(() => [{ value: '', label: 'Nobody' }, ...core.cabinets.map((c) => ({ value: c.id, label: c.name }))], [core.cabinets]);
  const mapModes: Array<{ value: StageMode; label: string }> = [];
  if (powers.units) mapModes.push({ value: 'unit', label: 'Move a unit' });
  if (powers.map) mapModes.push({ value: 'border', label: 'Change a border' });
  const activeMode: StageMode = mapModes.some((m) => m.value === mode) ? mode : (mapModes[0]?.value ?? 'unit');
  const stagedUnit = unit ? effects.units[unit.id] : undefined;
  const movedTo = stagedUnit && stagedUnit.lng !== undefined && stagedUnit.lat !== undefined ? stagedUnit : null;
  const amountNow = unit ? (stagedUnit?.strength ?? unit.strength) : 0;
  const holderNow = country ? (country in effects.regions ? effects.regions[country] : (baseHolder.get(country) ?? null)) : null;

  // ── Characters ──
  const charOptions = useMemo(() => {
    const sorted = [...core.characters].sort((a, b) => (a.id === authorCharacterId ? -1 : b.id === authorCharacterId ? 1 : 0));
    return sorted.map((c) => ({
      value: c.id, label: c.name,
      hint: [c.id === authorCharacterId ? 'Wrote this directive' : null, cabById.get(c.cabinet_id ?? '')?.name].filter(Boolean).join(', ') || undefined,
      icon: <Avatar name={c.name} src={c.picture_url} size={24} color={cabById.get(c.cabinet_id ?? '')?.color ?? CK.red} />,
    }));
  }, [core.characters, authorCharacterId, cabById]);
  const ch = charId ? charById.get(charId) : undefined;
  const staged = ch ? effects.characters[ch.id] : undefined;

  const news = effects.news;
  const audienceOptions = useMemo(() => [{ value: '', label: 'Every room' }, ...core.cabinets.map((c) => ({ value: c.id, label: c.name }))], [core.cabinets]);

  return (
    <div className="flex flex-col" style={{ gap: 12, fontFamily: CK.font }}>
      {/* What will apply */}
      <section aria-live="polite" style={{ background: total ? cabinetTint(CK.red, 0.06) : CK.card, borderRadius: 18, padding: '12px 13px', boxShadow: total ? `inset 0 0 0 1px ${cabinetTint(CK.red, 0.22)}` : CK.shadowSm }}>
        <p className="flex items-center" style={{ margin: 0, gap: 8 }}>
          <Zap size={18} strokeWidth={1.5} aria-hidden style={{ color: CK.red }} />
          <b style={{ fontSize: 15, color: CK.ink }}>{total === 0 ? 'No changes yet' : total === 1 ? '1 change will apply' : `${total} changes will apply`}</b>
        </p>
        <p style={{ margin: '3px 0 0', fontSize: 12.5, color: CK.inkSoft }}>Everything below happens in the moment you send the reply, not before.</p>
        {changes.length > 0 && (
          <ul className="flex flex-col" style={{ listStyle: 'none', margin: '9px 0 0', padding: 0, gap: 5 }}>
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
      </section>

      {/* Resources */}
      <Section icon={Coins} title="Resources">
        {!powers.resources ? <Muted>You cannot change resources. The Crisis Director can allow it in Settings.</Muted>
          : !data ? <Skeleton h={60} r={12} />
          : groups.length === 0 ? <Muted>No resources yet. They are set up on the Resources page.</Muted>
          : (
            <div className="flex flex-col" style={{ gap: 8 }}>
              {groups.map((g) => {
                const hasStaged = g.items.some((r) => effects.resources[r.id] !== undefined);
                const open = g.primary || (openOthers[g.key] ?? hasStaged);
                return (
                  <div key={g.key}>
                    {g.primary ? (
                      <p className="flex items-center" style={{ margin: '0 0 2px', gap: 7, fontSize: 12.5, fontWeight: 800, color: CK.inkSoft }}>
                        {g.cabinet ? <CabinetLogo cabinet={g.cabinet} size={22} /> : null}
                        <span style={{ overflowWrap: 'anywhere' }}>{g.title}</span>
                        <span style={{ fontWeight: 600, color: CK.muted }}>{g.cabinet ? 'the author’s cabinet' : 'the author'}</span>
                      </p>
                    ) : (
                      <button type="button" onClick={() => setOpenOthers((o) => ({ ...o, [g.key]: !open }))} aria-expanded={open}
                        className="flex items-center w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
                        style={{ gap: 7, border: 0, background: 'transparent', padding: '4px 0', cursor: 'pointer', fontFamily: CK.font, fontSize: 12.5, fontWeight: 800, color: CK.inkSoft, textAlign: 'left' }}>
                        {g.cabinet ? <CabinetLogo cabinet={g.cabinet} size={22} /> : null}
                        <span style={{ flex: 1, overflowWrap: 'anywhere' }}>{g.title}</span>
                        <span style={{ fontWeight: 600, color: CK.muted }}>{open ? 'Hide' : `Show ${g.items.length}`}</span>
                      </button>
                    )}
                    {open && <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>{g.items.map(resourceRow)}</ul>}
                  </div>
                );
              })}
            </div>
          )}
      </Section>

      {/* Map */}
      <Section icon={MapIcon} title="Map">
        {mapModes.length === 0 ? <Muted>You cannot change the map. The Crisis Director can allow it in Settings.</Muted>
          : !data ? <Skeleton h={220} r={12} />
          : (
            <div className="flex flex-col" style={{ gap: 10 }}>
              {mapModes.length > 1 && <div style={{ overflowX: 'auto' }}><Segmented ariaLabel="What to change on the map" value={activeMode} onChange={setMode} options={mapModes} /></div>}
              {activeMode === 'unit' ? (
                <>
                  <div><FieldLabel>Unit</FieldLabel>
                    <GSelect value={unitId} options={unitOptions} onChange={setUnitId} placeholder={unitOptions.length ? 'Pick a unit' : 'No units on the map yet'} aria-label="Unit" searchable />
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
                          color={amountNow > unit.strength ? upColor : amountNow < unit.strength ? downColor : undefined}
                          onChange={(n) => updateUnit(unit, (s) => ({ ...s, strength: Math.round(n) }))} />
                        {amountNow !== unit.strength && (
                          <span style={{ fontSize: 12.5, fontWeight: 700, color: amountNow > unit.strength ? upColor : downColor, fontVariantNumeric: 'tabular-nums' }}>
                            {fmtAmount(unit.strength)} to {fmtAmount(amountNow)}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  <Muted>{unit ? 'Click the map or drag the unit to where it goes.' : 'Pick a unit, or click one on the map.'}</Muted>
                </>
              ) : (
                <>
                  <div><FieldLabel>Country</FieldLabel>
                    <GSelect value={country} options={countryOptions} onChange={setCountry} placeholder="Pick a country, or click it on the map" aria-label="Country" searchable />
                  </div>
                  {country && (
                    <div><FieldLabel>Held by</FieldLabel>
                      <GSelect value={holderNow ?? ''} options={holderOptions} onChange={(v) => setHolder(country, v || null)} aria-label="Held by" />
                    </div>
                  )}
                </>
              )}
              <StageMap
                units={data.units} regions={data.regions} cabinets={cabinetColors}
                stagedUnits={effects.units} stagedRegions={effects.regions}
                mode={activeMode} selectedUnitId={unitId} selectedCountry={country}
                canUnits={powers.units} canMap={powers.map}
                onSelectUnit={(id) => { setUnitId(id); if (powers.units) setMode('unit'); }}
                onPlaceUnit={(lng, lat) => { if (unit) updateUnit(unit, (s) => ({ ...s, lng, lat })); }}
                onPickCountry={setCountry}
                height={260}
              />
            </div>
          )}
      </Section>

      {/* Characters */}
      <Section icon={Skull} title="Characters">
        <div><FieldLabel>Character</FieldLabel>
          <GSelect value={charId} options={charOptions} onChange={setCharId} placeholder="Pick a character" aria-label="Character" searchable />
        </div>
        {ch && (
          <>
            <div role="group" aria-label="New status" style={{ display: 'grid', gap: 6, gridTemplateColumns: 'repeat(auto-fit, minmax(92px, 1fr))' }}>
              {STAGEABLE_STATUSES.map((s) => {
                const meta = STATUS_META[s];
                const isNow = ch.status === s;
                const on = staged?.status === s;
                return (
                  <button key={s} type="button" aria-pressed={on} onClick={() => setCharStatus(ch.id, s, ch.status)}
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
      </Section>

      {/* News */}
      <Section icon={Newspaper} title="News">
        <Muted>Optional. A newsflash from this directive, saved as a draft on the News page.</Muted>
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
      </Section>
    </div>
  );
}
