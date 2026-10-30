'use client';
// Gavelling Crisis: "Add a character". One pop-up, one obvious next step (owner, 30 Oct 2026: "make it come alive").
//
// Left: a big round picture drop zone in the cabinet's colour, the name, a title (with tap-to-fill suggestions),
// the cabinet, the powers (suggestions append), and the place (suggestions from the crisis's own characters, or
// the exact spot on the map as a second step with a Back button: a pop-up never opens another on top of itself).
// Right: a live card of the character exactly as delegates will see it on the Cabinet page, with the cabinet's
// crest and colour. "Add character" saves everything in one go and closes.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, ImagePlus, MapPin, Sparkles, UserRoundPlus } from 'lucide-react';
import GSelect, { type GSelectOption } from '@/components/GSelect';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { crisisError, saveCharacter, uploadCrisisFile } from '@/lib/crisis/api';
import type { Character, CharacterStatus } from '@/lib/crisis/types';
import { Btn, CK, FieldLabel, OverhangCard, Segmented, cabinetTint, fieldStyle } from '../../crisisKit';
import { useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import CrisisDialog from '../delegate/CrisisDialog';
import CharacterMapPicker, { type PickedSpot } from './CharacterMapPicker';

const KEY = 'crisis-character-new';
const nul = (s: string): string | null => (s.trim() ? s.trim() : null);

const TITLE_IDEAS = ['Minister', 'General', 'Ambassador', 'Adviser', 'Director of Intelligence', 'Press Secretary'];
const POWER_IDEAS = ['Commands the army', 'Controls the budget', 'Runs the secret service', 'Speaks for the government', 'Can sign treaties'];

function Chips({ items, onPick }: { items: string[]; onPick: (s: string) => void }) {
  if (!items.length) return null;
  return (
    <div className="flex flex-wrap" style={{ gap: 6, marginTop: 6 }}>
      {items.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onPick(s)}
          className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] active:scale-[0.97] transition-transform"
          style={{ border: 0, cursor: 'pointer', borderRadius: 99, padding: '4px 10px', fontSize: 12, fontWeight: 600, fontFamily: CK.font, background: CK.well, color: CK.inkSoft, boxShadow: `inset 0 0 0 1px ${CK.hair}` }}
        >
          {s}
        </button>
      ))}
    </div>
  );
}

export default function NewCharacterDialog({ cabinetId, onClose, onCreated }: {
  cabinetId: string | null;
  onClose: () => void;
  onCreated?: (id: string) => void;
}) {
  const { ref, core, reloadCore } = useCrisis();
  const [d, setD] = useState({ name: '', title: '', powers: '', location: '', cabinet: cabinetId ?? '' });
  const [status, setStatus] = useState<CharacterStatus>('active');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [spot, setSpot] = useState<PickedSpot | null>(null);
  const [step, setStep] = useState<'main' | 'map'>('main');
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const set = <K extends keyof typeof d>(k: K, val: (typeof d)[K]) => setD((p) => ({ ...p, [k]: val }));

  const cab = core.cabinets.find((c) => c.id === d.cabinet) ?? null;
  const color = cab?.color ?? CK.red;

  // The picture's preview is a local object URL, released when it changes or the pop-up closes.
  useEffect(() => {
    if (!file) return undefined;
    const url = URL.createObjectURL(file);
    const t = window.setTimeout(() => setPreview(url), 0);
    return () => { window.clearTimeout(t); URL.revokeObjectURL(url); };
  }, [file]);

  const pick = (f: File | undefined | null) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) { notifyErr('Use a JPG, PNG, WebP or GIF image.', KEY); return; }
    setFile(f);
  };

  // Places other characters already use, so a new one can join them with a tap.
  const placeIdeas = useMemo(() => {
    const count = new Map<string, number>();
    for (const c of core.characters) { const p = c.location?.trim(); if (p) count.set(p, (count.get(p) ?? 0) + 1); }
    return [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([p]) => p);
  }, [core.characters]);

  const cabinetOptions: GSelectOption[] = [{ value: '', label: 'No cabinet' }, ...core.cabinets.map((c) => ({ value: c.id, label: c.name }))];

  const create = async () => {
    if (busy) return;
    const name = d.name.trim();
    if (!name) { notifyErr('Give the character a name.', KEY); return; }
    setBusy(true);
    try {
      let picture_url: string | null = null;
      if (file) picture_url = (await uploadCrisisFile(ref, file)).url;
      const siblings = core.characters.filter((c) => c.cabinet_id === (d.cabinet || null));
      const row: Partial<Character> = {
        name, title: nul(d.title), powers: nul(d.powers), cabinet_id: d.cabinet || null, status, picture_url,
        location: nul(d.location) ?? spot?.country ?? null, sort: siblings.reduce((m, c) => Math.max(m, c.sort), 0) + 1,
      };
      if (spot) { row.location_lng = spot.lng; row.location_lat = spot.lat; }
      const id = await saveCharacter(ref, row);
      notifyOk(`${name} added`, KEY);
      await reloadCore();
      onCreated?.(id);
      onClose();
    } catch (e) { notifyErr(crisisError(e, 'Could not add the character.'), KEY); setBusy(false); }
  };

  if (step === 'map') {
    return (
      <CrisisDialog title="Pick the Exact Spot" eyebrow="New character" onClose={onClose} onBack={() => setStep('main')} width={760} step="map">
        <CharacterMapPicker
          name={d.name.trim() || 'New character'}
          picture={preview}
          color={color}
          lng={spot?.lng}
          lat={spot?.lat}
          label={d.location}
          onSave={(s) => { setSpot(s); if (!d.location.trim() && s.country) set('location', s.country); setStep('main'); }}
          onClear={() => { setSpot(null); setStep('main'); }}
        />
      </CrisisDialog>
    );
  }

  const shownName = d.name.trim() || 'New character';
  return (
    <CrisisDialog title="Add a Character" eyebrow={cab ? cab.name : 'Characters'} onClose={onClose} width={900} step="main">
      <div style={{ display: 'grid', gap: '20px 28px', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', alignItems: 'start' }}>
        {/* The form */}
        <div className="flex flex-col" style={{ gap: 14, minWidth: 0 }}>
          <div className="flex items-center" style={{ gap: 16 }}>
            <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" aria-label="Choose a picture" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
            <button
              type="button"
              onClick={() => input.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setOver(true); }}
              onDragLeave={() => setOver(false)}
              onDrop={(e) => { e.preventDefault(); setOver(false); pick(e.dataTransfer.files?.[0]); }}
              aria-label={preview ? 'Change the picture' : 'Add a picture'}
              className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] transition-transform active:scale-[0.98]"
              style={{
                position: 'relative', flex: 'none', width: 132, height: 132, borderRadius: '50%', cursor: 'pointer', padding: 0, overflow: 'hidden',
                border: `3px dashed ${color}`, background: over ? cabinetTint(color, 0.28) : cabinetTint(color, 0.1), color,
                display: 'grid', placeItems: 'center', fontFamily: CK.font,
              }}
            >
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              ) : (
                <span className="flex flex-col items-center" style={{ gap: 4, padding: 10, textAlign: 'center' }}>
                  <ImagePlus size={30} strokeWidth={1.5} aria-hidden />
                  <b style={{ fontSize: 12.5, lineHeight: 1.2 }}>Drop a picture or click</b>
                </span>
              )}
              {preview && (
                <span aria-hidden style={{ position: 'absolute', right: 8, bottom: 8, width: 30, height: 30, borderRadius: '50%', display: 'grid', placeItems: 'center', background: CK.card, color: CK.red, boxShadow: CK.shadowSm }}>
                  <Camera size={15} strokeWidth={1.5} />
                </span>
              )}
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <FieldLabel htmlFor="nc-name">Name</FieldLabel>
              <input id="nc-name" autoFocus value={d.name} onChange={(e) => set('name', e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void create(); }} style={fieldStyle} maxLength={120} placeholder="For example, Nikita Khrushchev" />
            </div>
          </div>

          <div>
            <FieldLabel htmlFor="nc-title">Title</FieldLabel>
            <input id="nc-title" value={d.title} onChange={(e) => set('title', e.target.value)} style={fieldStyle} maxLength={160} placeholder="What they are called in the room" />
            <Chips items={TITLE_IDEAS.filter((t) => t !== d.title)} onPick={(t) => set('title', t)} />
          </div>

          {core.cabinets.length > 1 && (
            <div>
              <FieldLabel>Cabinet</FieldLabel>
              <GSelect value={d.cabinet} onChange={(c) => set('cabinet', c)} options={cabinetOptions} aria-label="Cabinet" />
            </div>
          )}

          <div>
            <FieldLabel htmlFor="nc-powers" hint="What only they can do">Powers</FieldLabel>
            <textarea id="nc-powers" value={d.powers} onChange={(e) => set('powers', e.target.value)} rows={2} style={{ ...fieldStyle, resize: 'vertical' }} />
            <Chips items={POWER_IDEAS} onPick={(p) => set('powers', d.powers.trim() ? `${d.powers.trim()}\n${p}` : p)} />
          </div>

          <div>
            <FieldLabel htmlFor="nc-location">Where they are</FieldLabel>
            <div className="flex items-center flex-wrap" style={{ gap: 8 }}>
              <input id="nc-location" value={d.location} onChange={(e) => set('location', e.target.value)} style={{ ...fieldStyle, flex: '1 1 200px', width: 'auto' }} maxLength={160} placeholder="A city or a country" />
              <Btn tone="ghost" icon={<MapPin size={15} strokeWidth={1.5} />} onClick={() => setStep('map')}>{spot ? 'Move the spot' : 'Pick on the map'}</Btn>
            </div>
            <Chips items={placeIdeas.filter((p) => p !== d.location)} onPick={(p) => set('location', p)} />
            {spot && <p className="flex items-center" style={{ margin: '6px 0 0', gap: 6, fontSize: 12.5, color: CK.ok, fontWeight: 700 }}><MapPin size={14} strokeWidth={1.5} aria-hidden />Spot set on the map</p>}
          </div>

          <div>
            <FieldLabel hint="A spare is hidden from delegates until you need it">Status</FieldLabel>
            <Segmented<CharacterStatus> ariaLabel="Status" value={status} onChange={setStatus} options={[{ value: 'active', label: 'Active' }, { value: 'spare', label: 'Spare' }]} />
          </div>
        </div>

        {/* The live preview */}
        <div style={{ minWidth: 0, position: 'sticky', top: 0 }}>
          <p className="flex items-center" style={{ margin: '0 0 6px', gap: 6, fontSize: 12.5, fontWeight: 800, color: CK.red }}>
            <Sparkles size={14} strokeWidth={1.5} aria-hidden />How delegates will see it
          </p>
          <div style={{ background: CK.card, borderRadius: 22, boxShadow: CK.shadow, overflow: 'visible' }}>
            <div className="flex items-center" style={{ gap: 10, padding: '10px 14px', background: cabinetTint(color, 0.14), borderBottom: `3px solid ${color}`, borderRadius: '22px 22px 0 0' }}>
              {cab?.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={cab.logo_url} alt="" width={30} height={30} style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', background: '#FDFCF9' }} />
              ) : (
                <i aria-hidden style={{ width: 16, height: 16, borderRadius: 5, background: color, display: 'inline-block', flex: 'none' }} />
              )}
              <b style={{ fontSize: 14.5, color: CK.ink, overflowWrap: 'anywhere' }}>{cab?.name ?? 'No cabinet'}</b>
            </div>
            <div style={{ padding: '22px 16px 16px' }}>
              <OverhangCard
                name={shownName}
                src={preview}
                color={color}
                size={72}
                place="top"
                style={{ textAlign: 'center', boxShadow: `${CK.shadowSm}, inset 0 3px 0 ${color}`, opacity: status === 'spare' ? 0.7 : 1 }}
              >
                <b style={{ display: 'block', fontSize: 17, fontWeight: 800, color: d.name.trim() ? CK.ink : CK.muted, overflowWrap: 'anywhere' }}>{shownName}</b>
                <span style={{ display: 'block', fontSize: 13, color: d.title.trim() ? CK.inkSoft : CK.muted, overflowWrap: 'anywhere' }}>{d.title.trim() || 'Their title'}</span>
                <span className="inline-flex items-center" style={{ gap: 5, marginTop: 8, fontSize: 12.5, fontWeight: 700, color: status === 'spare' ? CK.inkSoft : CK.ok }}>
                  <UserRoundPlus size={14} strokeWidth={1.5} aria-hidden />{status === 'spare' ? 'Spare' : 'Active'}
                </span>
                {(d.location.trim() || d.powers.trim()) && (
                  <span className="flex flex-col" style={{ marginTop: 8, gap: 3, fontSize: 12.5, color: CK.inkSoft, lineHeight: 1.45, textAlign: 'left' }}>
                    {d.location.trim() && <span className="flex items-start gap-1.5" style={{ overflowWrap: 'anywhere' }}><MapPin size={14} strokeWidth={1.5} aria-hidden style={{ flex: 'none', marginTop: 2, color: CK.red }} />{d.location.trim()}</span>}
                    {d.powers.trim() && <span style={{ overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>{d.powers.trim()}</span>}
                  </span>
                )}
              </OverhangCard>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end flex-wrap" style={{ gap: 8, marginTop: 18, paddingTop: 14, borderTop: `1px solid ${CK.hair}` }}>
        <Btn tone="ghost" onClick={onClose} disabled={busy}>Cancel</Btn>
        <Btn onClick={() => { void create(); }} disabled={busy || !d.name.trim()} icon={<UserRoundPlus size={15} strokeWidth={1.5} />}>{busy ? 'Adding' : 'Add character'}</Btn>
      </div>
    </CrisisDialog>
  );
}
