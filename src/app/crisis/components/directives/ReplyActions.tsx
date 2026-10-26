'use client';
// Gavelling Crisis: the "+" on the answer box. One pop-up lists what can be done together with the
// reply: change resources, write news, change a character's status, move a unit or change its
// amount, change a border. A sub-step replaces the pop-up's content (back button), never a second
// pop-up. What is chosen shows as removable chips under the reply and is sent as the effects of
// answerDirective in the same press.

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ChevronRight, Coins, Crosshair, ImagePlus, Landmark, Newspaper, Skull, X, type LucideIcon,
} from 'lucide-react';
import GSelect from '@/components/GSelect';
import { amount as fmtAmount } from '@/lib/crisis/format';
import { notifyErr } from '@/lib/appNotify';
import { crisisError, loadMap, loadResources, uploadCrisisBanner, type AnswerEffects, type CrisisRef } from '@/lib/crisis/api';
import type { CharacterStatus, MapRegion, MapUnit, Resource, ResourceType } from '@/lib/crisis/types';
import { Avatar, Btn, CK, FieldLabel, Segmented, Skeleton, cabinetTint, fieldStyle } from '../../crisisKit';
import { useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import CrisisDialog from '../delegate/CrisisDialog';
import { KIND_META } from '../map/mapData';
import { loadCountries, type CountryOption } from './countryPick';

export type ReplyAction =
  | { id: string; kind: 'resource'; resourceId: string; delta: number; label: string }
  | { id: string; kind: 'news'; title: string; body: string; source: string; audience: string; banner: File | null; label: string }
  | { id: string; kind: 'character'; characterId: string; status: CharacterStatus; note: string; label: string }
  | { id: string; kind: 'unit'; unitId: string; lng?: number; lat?: number; strength?: number; label: string }
  | { id: string; kind: 'region'; key: string; owner: string | null; label: string };

export interface ReplyPowers { resources: boolean; units: boolean; map: boolean }

const ACTION_ICON: Record<ReplyAction['kind'], LucideIcon> = {
  resource: Coins, news: Newspaper, character: Skull, unit: Crosshair, region: Landmark,
};

let seq = 0;
const newId = () => `act-${Date.now()}-${seq++}`;

/** Turns the chosen actions into the effects of one answer. Uploads a news banner first. */
export async function actionsToEffects(ref: CrisisRef, actions: ReplyAction[]): Promise<AnswerEffects> {
  const effects: AnswerEffects = {};
  for (const a of actions) {
    if (a.kind === 'resource') (effects.resources ??= []).push({ id: a.resourceId, delta: a.delta });
    else if (a.kind === 'character') (effects.characters ??= []).push({ id: a.characterId, status: a.status, status_note: a.note || null });
    else if (a.kind === 'unit') (effects.units ??= []).push({ id: a.unitId, lng: a.lng, lat: a.lat, strength: a.strength });
    else if (a.kind === 'region') (effects.regions ??= []).push({ key: a.key, owner_cabinet_id: a.owner });
    else if (a.kind === 'news') {
      const banner_url = a.banner ? await uploadCrisisBanner(ref, a.banner) : null;
      effects.news = { title: a.title, body: a.body || undefined, source_label: a.source || undefined, audience_cabinet_id: a.audience || null, banner_url };
    }
  }
  return effects;
}

/** The chosen actions as removable chips. */
export function ActionChips({ actions, onRemove }: { actions: ReplyAction[]; onRemove: (id: string) => void }) {
  if (!actions.length) return null;
  return (
    <ul className="flex flex-wrap" style={{ listStyle: 'none', margin: 0, padding: 0, gap: 6 }} aria-label="Done together with the reply">
      {actions.map((a) => {
        const I = ACTION_ICON[a.kind];
        return (
          <li key={a.id} className="inline-flex items-center" style={{ gap: 6, maxWidth: '100%', background: cabinetTint(CK.forest, 0.09), color: CK.forest, borderRadius: 10, padding: '4px 4px 4px 9px', fontSize: 12.5, fontWeight: 700, boxShadow: `inset 0 0 0 1px ${cabinetTint(CK.forest, 0.2)}` }}>
            <I size={14} strokeWidth={1.5} aria-hidden style={{ flex: 'none' }} />
            <span style={{ minWidth: 0, overflowWrap: 'break-word' }}>{a.label}</span>
            <button type="button" onClick={() => onRemove(a.id)} aria-label={`Remove: ${a.label}`}
              className="grid place-items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
              style={{ width: 20, height: 20, borderRadius: 7, border: 0, background: 'transparent', color: CK.forest, cursor: 'pointer', flex: 'none' }}>
              <X size={13} strokeWidth={1.8} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

type Step = 'menu' | 'resources' | 'news' | 'status' | 'unit' | 'border';
const STEP_TITLE: Record<Step, string> = {
  menu: 'Do More With This Reply', resources: 'Change Resources', news: 'Write News', status: 'Change a Character', unit: 'Move a Unit', border: 'Change a Border',
};

export default function ReplyActionsDialog({ crisisRef, authorCharacterId, cabinetId, powers, actions, onChange, onClose }: {
  crisisRef: CrisisRef;
  authorCharacterId: string | null;
  cabinetId: string | null;
  powers: ReplyPowers;
  actions: ReplyAction[];
  onChange: (next: ReplyAction[]) => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState<Step>('menu');
  /** Add actions, replacing an earlier one about the same thing, then go back to the list. */
  const add = (more: ReplyAction[], sameThing: (a: ReplyAction, b: ReplyAction) => boolean) => {
    const kept = actions.filter((a) => !more.some((m) => sameThing(a, m)));
    onChange([...kept, ...more]);
    setStep('menu');
  };
  const remove = (id: string) => onChange(actions.filter((a) => a.id !== id));

  return (
    <CrisisDialog title={STEP_TITLE[step]} onClose={onClose} onBack={step === 'menu' ? undefined : () => setStep('menu')} step={step} width={600}>
      {step === 'menu' && (
        <div className="flex flex-col" style={{ gap: 10 }}>
          <p style={{ margin: 0, fontSize: 13.5, color: CK.inkSoft }}>These happen in the same moment as your reply.</p>
          <div className="flex flex-col" style={{ gap: 6 }}>
            {powers.resources && <MenuRow icon={Coins} title="Change resources" hint="Add or take away what this character or cabinet holds" onClick={() => setStep('resources')} />}
            <MenuRow icon={Newspaper} title="Write news" hint="A story for one cabinet or every room" onClick={() => setStep('news')} />
            <MenuRow icon={Skull} title="Change a character" hint="Kill, arrest or remove someone, or bring them back" onClick={() => setStep('status')} />
            {powers.units && <MenuRow icon={Crosshair} title="Move a unit" hint="Send it somewhere or change its amount" onClick={() => setStep('unit')} />}
            {powers.map && <MenuRow icon={Landmark} title="Change a border" hint="Hand a country to a cabinet or to nobody" onClick={() => setStep('border')} />}
          </div>
          {actions.length > 0 && (
            <div className="flex flex-col" style={{ gap: 6, marginTop: 4 }}>
              <p style={{ margin: 0, fontSize: 12.5, fontWeight: 800, color: CK.inkSoft }}>Chosen for this reply</p>
              <ActionChips actions={actions} onRemove={remove} />
            </div>
          )}
          <div className="flex justify-end" style={{ marginTop: 6 }}><Btn tone="green" onClick={onClose}>Done</Btn></div>
        </div>
      )}
      {step === 'resources' && <ResourcesStep crisisRef={crisisRef} authorCharacterId={authorCharacterId} cabinetId={cabinetId} onAdd={(m) => add(m, (a, b) => a.kind === 'resource' && b.kind === 'resource' && a.resourceId === b.resourceId)} />}
      {step === 'news' && <NewsStep onAdd={(m) => add([m], (a) => a.kind === 'news')} />}
      {step === 'status' && <StatusStep authorCharacterId={authorCharacterId} onAdd={(m) => add([m], (a, b) => a.kind === 'character' && b.kind === 'character' && a.characterId === b.characterId)} />}
      {step === 'unit' && <UnitStep crisisRef={crisisRef} onAdd={(m) => add([m], (a, b) => a.kind === 'unit' && b.kind === 'unit' && a.unitId === b.unitId)} />}
      {step === 'border' && <BorderStep crisisRef={crisisRef} onAdd={(m) => add([m], (a, b) => a.kind === 'region' && b.kind === 'region' && a.key === b.key)} />}
    </CrisisDialog>
  );
}

function MenuRow({ icon, title, hint, onClick }: { icon: LucideIcon; title: string; hint: string; onClick: () => void }) {
  const I = icon;
  return (
    <button type="button" onClick={onClick}
      className="flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] active:scale-[0.99] transition-transform"
      style={{ gap: 12, width: '100%', textAlign: 'left', border: 0, borderRadius: 14, padding: '11px 13px', background: CK.card, boxShadow: CK.shadowSm, cursor: 'pointer', fontFamily: CK.font, color: CK.ink }}>
      <span aria-hidden style={{ color: CK.red, lineHeight: 0, flex: 'none' }}><I size={22} strokeWidth={1.5} /></span>
      <span style={{ flex: '1 1 160px', minWidth: 0 }}>
        <b style={{ display: 'block', fontSize: 14.5 }}>{title}</b>
        <span style={{ display: 'block', fontSize: 12.5, color: CK.inkSoft, marginTop: 1 }}>{hint}</span>
      </span>
      <ChevronRight size={18} strokeWidth={1.5} aria-hidden style={{ color: CK.muted, flex: 'none' }} />
    </button>
  );
}

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return <div><FieldLabel hint={hint}>{label}</FieldLabel>{children}</div>;
}

function StepFooter({ onAdd, disabled, label = 'Add to reply' }: { onAdd: () => void; disabled?: boolean; label?: string }) {
  return <div className="flex justify-end" style={{ marginTop: 4 }}><Btn tone="green" onClick={onAdd} disabled={disabled}>{label}</Btn></div>;
}

// ─────────── Resources ───────────

function ResourcesStep({ crisisRef, authorCharacterId, cabinetId, onAdd }: {
  crisisRef: CrisisRef; authorCharacterId: string | null; cabinetId: string | null; onAdd: (m: ReplyAction[]) => void;
}) {
  const { core } = useCrisis();
  const [data, setData] = useState<{ types: ResourceType[]; resources: Resource[] } | null>(null);
  const [rows, setRows] = useState<Array<{ id: string; delta: string }>>([{ id: '', delta: '' }]);

  useEffect(() => {
    let cancelled = false;
    loadResources(crisisRef).then((r) => { if (!cancelled) setData(r); }).catch((e) => { if (!cancelled) { setData({ types: [], resources: [] }); notifyErr(crisisError(e, 'Could not load the resources.'), 'crisis-resources'); } });
    return () => { cancelled = true; };
  }, [crisisRef]);

  const options = useMemo(() => {
    if (!data) return [];
    const typeById = new Map(data.types.map((t) => [t.id, t]));
    const chars = new Map(core.characters.map((c) => [c.id, c.name]));
    const cabs = new Map(core.cabinets.map((c) => [c.id, c.name]));
    return data.resources
      .filter((r) => (r.character_id && r.character_id === authorCharacterId) || (r.cabinet_id && r.cabinet_id === cabinetId))
      .map((r) => {
        const t = typeById.get(r.type_id);
        const owner = r.character_id ? (chars.get(r.character_id) ?? 'Character') : (cabs.get(r.cabinet_id ?? '') ?? 'Cabinet');
        return { value: r.id, label: `${t?.name ?? 'Resource'}, ${owner}: ${fmtAmount(r.amount)}${t?.unit ? ` ${t.unit}` : ''}`, short: `${t?.name ?? 'Resource'}, ${owner}` };
      });
  }, [data, core, authorCharacterId, cabinetId]);

  const valid = rows.map((r) => ({ id: r.id, delta: Number(r.delta) })).filter((r) => r.id && Number.isFinite(r.delta) && r.delta !== 0);
  const submit = () => {
    const byId = new Map(options.map((o) => [o.value, o.short]));
    onAdd(valid.map((r) => ({ id: newId(), kind: 'resource' as const, resourceId: r.id, delta: r.delta, label: `${byId.get(r.id) ?? 'Resource'} ${r.delta > 0 ? '+' : r.delta < 0 ? '-' : ''}${fmtAmount(Math.abs(r.delta))}` })));
  };

  return (
    <div className="flex flex-col" style={{ gap: 10 }}>
      {!data && <Skeleton h={36} />}
      {data && options.length === 0 && <p style={{ margin: 0, fontSize: 13.5, color: CK.muted }}>This character and cabinet have no resources yet</p>}
      {data && options.length > 0 && rows.map((row, i) => (
        <div key={i} className="flex items-center flex-wrap" style={{ gap: 8 }}>
          <div style={{ flex: '1 1 260px', minWidth: 0 }}>
            <GSelect size="sm" value={row.id} placeholder="Pick a resource" aria-label="Resource" options={options}
              onChange={(v) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, id: v } : r)))} />
          </div>
          <input type="number" inputMode="decimal" value={row.delta} aria-label="Change by"
            onChange={(e) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, delta: e.target.value } : r)))}
            placeholder="+5 or -5" style={{ ...fieldStyle, width: 120, padding: '6px 10px' }} />
        </div>
      ))}
      {data && options.length > 0 && <div><Btn tone="ghost" size="sm" onClick={() => setRows((rs) => [...rs, { id: '', delta: '' }])}>Add another</Btn></div>}
      <StepFooter onAdd={submit} disabled={!valid.length} />
    </div>
  );
}

// ─────────── News ───────────

const BANNER_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

function NewsStep({ onAdd }: { onAdd: (m: ReplyAction) => void }) {
  const { core } = useCrisis();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [source, setSource] = useState('');
  const [audience, setAudience] = useState('');
  const [banner, setBanner] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const audienceOptions = useMemo(() => [{ value: '', label: 'Every room' }, ...core.cabinets.map((c) => ({ value: c.id, label: c.name }))], [core.cabinets]);

  const pick = (f: File | undefined) => {
    if (!f) return;
    if (!BANNER_TYPES.includes(f.type)) { notifyErr('Use a JPG, PNG, WebP or GIF image.', 'crisis-banner'); return; }
    if (f.size > 20 * 1024 * 1024) { notifyErr('The image is over 20 MB.', 'crisis-banner'); return; }
    setBanner(f);
  };

  return (
    <div className="flex flex-col" style={{ gap: 10 }}>
      <Field label="Title"><input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} aria-label="News title" placeholder="What happened" style={fieldStyle} /></Field>
      <Field label="Story"><textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} aria-label="News text" placeholder="The story" style={{ ...fieldStyle, resize: 'vertical' }} /></Field>
      <Field label="Source" hint="optional"><input value={source} onChange={(e) => setSource(e.target.value)} maxLength={80} aria-label="News source" placeholder="For example Radio Moscow" style={fieldStyle} /></Field>
      <Field label="Who reads it"><GSelect size="sm" value={audience} options={audienceOptions} onChange={setAudience} aria-label="News audience" /></Field>
      <Field label="Banner" hint="optional">
        <div className="flex items-center flex-wrap" style={{ gap: 8 }}>
          <input ref={fileRef} type="file" accept={BANNER_TYPES.join(',')} hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
          <Btn tone="ghost" size="sm" icon={<ImagePlus size={15} strokeWidth={1.5} />} onClick={() => fileRef.current?.click()}>{banner ? 'Change the banner' : 'Add a banner'}</Btn>
          {banner && (
            <span className="inline-flex items-center" style={{ gap: 6, fontSize: 12.5, fontWeight: 600, color: CK.inkSoft, overflowWrap: 'break-word', minWidth: 0 }}>
              {banner.name}
              <button type="button" onClick={() => setBanner(null)} aria-label="Remove the banner" className="grid place-items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
                style={{ width: 22, height: 22, border: 0, borderRadius: 7, background: CK.well, color: CK.ink, cursor: 'pointer' }}><X size={13} strokeWidth={1.8} /></button>
            </span>
          )}
        </div>
      </Field>
      <p style={{ margin: 0, fontSize: 12, color: CK.muted }}>It is saved as a draft on the News page.</p>
      <StepFooter disabled={!title.trim()} onAdd={() => onAdd({ id: newId(), kind: 'news', title: title.trim(), body: body.trim(), source: source.trim(), audience, banner, label: `News: ${title.trim()}` })} />
    </div>
  );
}

// ─────────── A character's status ───────────

const STATUS_CHOICES: Array<{ value: CharacterStatus; label: string }> = [
  { value: 'dead', label: 'Dead' }, { value: 'arrested', label: 'Arrested' }, { value: 'missing', label: 'Missing' }, { value: 'active', label: 'Active' },
];

function StatusStep({ authorCharacterId, onAdd }: { authorCharacterId: string | null; onAdd: (m: ReplyAction) => void }) {
  const { core } = useCrisis();
  const [characterId, setCharacterId] = useState('');
  const [status, setStatus] = useState<CharacterStatus>('dead');
  const [note, setNote] = useState('');
  const cabById = useMemo(() => new Map(core.cabinets.map((c) => [c.id, c])), [core.cabinets]);
  const options = useMemo(() => {
    const sorted = [...core.characters].sort((a, b) => (a.id === authorCharacterId ? -1 : b.id === authorCharacterId ? 1 : 0));
    return sorted.map((c) => ({
      value: c.id, label: c.name,
      hint: [c.id === authorCharacterId ? 'Author of this directive' : null, cabById.get(c.cabinet_id ?? '')?.name, c.status !== 'active' ? c.status : null].filter(Boolean).join(', ') || undefined,
      icon: <Avatar name={c.name} src={c.picture_url} size={24} color={cabById.get(c.cabinet_id ?? '')?.color ?? CK.red} />,
    }));
  }, [core.characters, authorCharacterId, cabById]);
  const chosen = core.characters.find((c) => c.id === characterId);

  return (
    <div className="flex flex-col" style={{ gap: 10 }}>
      <Field label="Character"><GSelect value={characterId} options={options} onChange={setCharacterId} placeholder="Pick a character" aria-label="Character" searchable /></Field>
      <Field label="New status"><Segmented ariaLabel="New status" value={status} onChange={setStatus} options={STATUS_CHOICES} /></Field>
      <Field label="Short note" hint="optional"><input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} aria-label="Status note" placeholder="For example: killed in the raid" style={fieldStyle} /></Field>
      <StepFooter disabled={!chosen} onAdd={() => chosen && onAdd({ id: newId(), kind: 'character', characterId: chosen.id, status, note: note.trim(), label: `${chosen.name}: ${status}` })} />
    </div>
  );
}

// ─────────── A unit ───────────

type Where = 'country' | 'unit' | 'coords';
const WHERE_CHOICES: Array<{ value: Where; label: string }> = [
  { value: 'country', label: 'A country' }, { value: 'unit', label: 'Another unit' }, { value: 'coords', label: 'Coordinates' },
];

function UnitStep({ crisisRef, onAdd }: { crisisRef: CrisisRef; onAdd: (m: ReplyAction) => void }) {
  const { core } = useCrisis();
  const [units, setUnits] = useState<MapUnit[] | null>(null);
  const [countries, setCountries] = useState<CountryOption[] | null>(null);
  const [unitId, setUnitId] = useState('');
  const [where, setWhere] = useState<Where>('country');
  const [countryKey, setCountryKey] = useState('');
  const [otherId, setOtherId] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [amount, setAmount] = useState('');
  const cabById = useMemo(() => new Map(core.cabinets.map((c) => [c.id, c])), [core.cabinets]);

  useEffect(() => {
    let cancelled = false;
    loadMap(crisisRef).then((m) => { if (!cancelled) setUnits(m.units); }).catch((e) => { if (!cancelled) { setUnits([]); notifyErr(crisisError(e, 'Could not load the map.'), 'crisis-map'); } });
    return () => { cancelled = true; };
  }, [crisisRef]);
  useEffect(() => {
    if (where !== 'country' || countries) return;
    let cancelled = false;
    loadCountries().then((c) => { if (!cancelled) setCountries(c); }).catch(() => { if (!cancelled) { setCountries([]); notifyErr('The country list did not load. Try again.', 'crisis-map'); } });
    return () => { cancelled = true; };
  }, [where, countries]);

  const unit = units?.find((u) => u.id === unitId);
  const unitOptions = useMemo(() => (units ?? []).map((u) => ({
    value: u.id, label: u.name, hint: [KIND_META[u.kind]?.label, cabById.get(u.owner_cabinet_id ?? '')?.name, `amount ${fmtAmount(u.strength)}`].filter(Boolean).join(', '),
  })), [units, cabById]);
  const otherOptions = useMemo(() => (units ?? []).filter((u) => u.id !== unitId).map((u) => ({
    value: u.id, label: u.name, hint: [KIND_META[u.kind]?.label, cabById.get(u.owner_cabinet_id ?? '')?.name].filter(Boolean).join(', '),
  })), [units, unitId, cabById]);
  const countryOptions = useMemo(() => (countries ?? []).map((c) => ({ value: c.key, label: c.name })), [countries]);

  // The destination, when one is chosen.
  let dest: { lng: number; lat: number; name: string } | null = null;
  if (where === 'country') {
    const c = countries?.find((x) => x.key === countryKey);
    if (c) dest = { lng: c.center[0], lat: c.center[1], name: c.name };
  } else if (where === 'unit') {
    const o = units?.find((x) => x.id === otherId);
    if (o) dest = { lng: o.lng, lat: o.lat, name: `where ${o.name} is` };
  } else {
    const la = Number(lat); const lo = Number(lng);
    if (lat.trim() && lng.trim() && Number.isFinite(la) && Number.isFinite(lo) && Math.abs(la) <= 90 && Math.abs(lo) <= 180) {
      dest = { lng: lo, lat: la, name: `${la}, ${lo}` };
    }
  }
  const amountNum = amount.trim() === '' ? undefined : Math.round(Number(amount));
  const amountOk = amountNum === undefined || (Number.isFinite(amountNum) && amountNum >= 0);
  const amountChanged = amountNum !== undefined && amountOk && unit !== undefined && amountNum !== unit.strength;
  const canAdd = !!unit && amountOk && (!!dest || amountChanged);

  const submit = () => {
    if (!unit) return;
    const parts: string[] = [];
    if (dest) parts.push(`Moves ${unit.name} to ${dest.name}`);
    if (amountChanged) parts.push(dest ? `amount ${fmtAmount(amountNum)}` : `${unit.name}: amount ${fmtAmount(amountNum)}`);
    onAdd({
      id: newId(), kind: 'unit', unitId: unit.id,
      lng: dest ? dest.lng : undefined, lat: dest ? dest.lat : undefined, strength: amountChanged ? amountNum : undefined,
      label: parts.join(', '),
    });
  };

  return (
    <div className="flex flex-col" style={{ gap: 10 }}>
      {!units && <Skeleton h={36} />}
      {units && units.length === 0 && <p style={{ margin: 0, fontSize: 13.5, color: CK.muted }}>There are no units on the map yet</p>}
      {units && units.length > 0 && (
        <>
          <Field label="Unit"><GSelect value={unitId} options={unitOptions} onChange={(v) => { setUnitId(v); setAmount(''); }} placeholder="Pick a unit" aria-label="Unit" searchable /></Field>
          <Field label="Send it to" hint="leave empty to only change the amount">
            <div className="flex flex-col" style={{ gap: 8 }}>
              <div style={{ overflowX: 'auto' }}><Segmented ariaLabel="Where to" value={where} onChange={setWhere} options={WHERE_CHOICES} /></div>
              {where === 'country' && (!countries ? <Skeleton h={34} /> : <GSelect value={countryKey} options={countryOptions} onChange={setCountryKey} placeholder="Pick a country" aria-label="Country" searchable />)}
              {where === 'unit' && <GSelect value={otherId} options={otherOptions} onChange={setOtherId} placeholder="Pick a unit to go to" aria-label="Another unit" searchable />}
              {where === 'coords' && (
                <div className="flex flex-wrap" style={{ gap: 8 }}>
                  <label style={{ flex: '1 1 140px' }}><FieldLabel>Latitude</FieldLabel>
                    <input type="number" inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} min={-90} max={90} step="any" placeholder="-90 to 90" aria-label="Latitude" style={fieldStyle} />
                  </label>
                  <label style={{ flex: '1 1 140px' }}><FieldLabel>Longitude</FieldLabel>
                    <input type="number" inputMode="decimal" value={lng} onChange={(e) => setLng(e.target.value)} min={-180} max={180} step="any" placeholder="-180 to 180" aria-label="Longitude" style={fieldStyle} />
                  </label>
                </div>
              )}
            </div>
          </Field>
          <Field label="Amount" hint={unit ? `now ${unit.strength}` : undefined}>
            <input type="number" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} min={0} step={1} aria-label="New amount" placeholder="Leave empty to keep it" style={{ ...fieldStyle, maxWidth: 200 }} />
          </Field>
          <StepFooter disabled={!canAdd} onAdd={submit} />
        </>
      )}
    </div>
  );
}

// ─────────── A border ───────────

function BorderStep({ crisisRef, onAdd }: { crisisRef: CrisisRef; onAdd: (m: ReplyAction) => void }) {
  const { core } = useCrisis();
  const [countries, setCountries] = useState<CountryOption[] | null>(null);
  const [regions, setRegions] = useState<MapRegion[] | null>(null);
  const [key, setKey] = useState('');
  const [owner, setOwner] = useState('');
  const cabById = useMemo(() => new Map(core.cabinets.map((c) => [c.id, c])), [core.cabinets]);

  useEffect(() => {
    let cancelled = false;
    loadCountries().then((c) => { if (!cancelled) setCountries(c); }).catch(() => { if (!cancelled) { setCountries([]); notifyErr('The country list did not load. Try again.', 'crisis-map'); } });
    loadMap(crisisRef).then((m) => { if (!cancelled) setRegions(m.regions); }).catch(() => { if (!cancelled) setRegions([]); });
    return () => { cancelled = true; };
  }, [crisisRef]);

  const holder = useMemo(() => new Map((regions ?? []).map((r) => [r.region_key, r.owner_cabinet_id])), [regions]);
  const options = useMemo(() => (countries ?? []).map((c) => {
    const h = holder.get(c.key);
    return { value: c.key, label: c.name, hint: h ? `Held by ${cabById.get(h)?.name ?? 'a cabinet'}` : undefined };
  }), [countries, holder, cabById]);
  const ownerOptions = useMemo(() => [{ value: '', label: 'Nobody' }, ...core.cabinets.map((c) => ({ value: c.id, label: c.name }))], [core.cabinets]);
  const country = countries?.find((c) => c.key === key);

  return (
    <div className="flex flex-col" style={{ gap: 10 }}>
      {!countries ? <Skeleton h={36} /> : (
        <>
          <Field label="Country"><GSelect value={key} options={options} onChange={setKey} placeholder="Pick a country" aria-label="Country" searchable /></Field>
          <Field label="Held by"><GSelect value={owner} options={ownerOptions} onChange={setOwner} aria-label="Held by" /></Field>
          <StepFooter disabled={!country} onAdd={() => country && onAdd({ id: newId(), kind: 'region', key: country.key, owner: owner || null, label: `${country.name}: held by ${owner ? (cabById.get(owner)?.name ?? 'a cabinet') : 'nobody'}` })} />
        </>
      )}
    </div>
  );
}
