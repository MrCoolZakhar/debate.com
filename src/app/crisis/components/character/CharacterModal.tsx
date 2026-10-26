'use client';
// Gavelling Crisis: the character pop-up. Opened from the Characters page, the backroom and Command.
// A large centred pop-up about one character: the portrait overlapping the top edge (click it to change
// it when you may edit), name and title, location, cabinet logo and name, status. Tabs: Profile (edit
// when allowed, the character guide, secret goals for staff), Directives (everything they wrote, newest
// first) and Performance (crisis points with the breakdown). A second step (the guide, the map, one
// directive) replaces the content with a back button; a pop-up never opens another on top of itself.

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ArrowLeft, BookOpen, Camera, ChevronRight, FileText, FileDown, MapPin, Trash2, Upload, X, UserRoundPlus,
} from 'lucide-react';
import GSelect, { type GSelectOption } from '@/components/GSelect';
import Portal from '@/components/Portal';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import {
  crisisError, deleteCharacter, listDirectives, listMeetings, saveCharacter, saveMember, saveSecret, uploadCrisisFile,
} from '@/lib/crisis/api';
import { getCrisisClient } from '@/lib/crisis/client';
import { useCrisisLive } from '@/lib/crisis/live';
import { characterPoints, readPoints } from '@/lib/crisis/points';
import {
  KIND_LABEL, OUTCOME_LABEL, ROLE_LABEL, type Character, type CharacterSecret, type CharacterStatus, type Directive, type Meeting,
} from '@/lib/crisis/types';
import { Avatar, BigCount, Btn, CK, FieldLabel, Skeleton, ThemeTag, cabinetTint, fieldStyle } from '../../crisisKit';
import { useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import { ConfirmInline, responsibleMembers } from '../command/setupKit';
import { KIND_ICON, OUTCOME_STYLE } from '../directives/directiveKit';
import CharacterMapPicker from './CharacterMapPicker';
import { STATUS_ORDER, STATUS_WORD, StatusIcon, mayEditCharacters, statusColor } from './characterStatus';

export interface CharacterModalProps { characterId: string; onClose: () => void; initialTab?: 'profile' | 'directives' | 'performance' }

type Tab = 'profile' | 'directives' | 'performance';
type Step = { kind: 'main' } | { kind: 'guide' } | { kind: 'map' } | { kind: 'directive'; id: string };

const KEY = 'crisis-character';
const AVATAR = 72;
const OVERHANG = AVATAR / 3;
const nul = (s: string): string | null => (s.trim() ? s.trim() : null);

const isImage = (url: string) => /\.(png|jpe?g|webp|gif)(\?|$)/i.test(url);
const isPdf = (url: string, name: string | null) => /\.pdf(\?|$)/i.test(url) || /\.pdf$/i.test(name ?? '');
const dateLabel = (iso: string) => new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export default function CharacterModal({ characterId, onClose, initialTab }: CharacterModalProps) {
  const v = useCrisis();
  const char = v.core.characters.find((c) => c.id === characterId) ?? null;
  if (!char) return null;
  return <ModalBody char={char} onClose={onClose} initialTab={initialTab} />;
}

function ModalBody({ char, onClose, initialTab }: { char: Character; onClose: () => void; initialTab?: Tab }) {
  const v = useCrisis();
  const { ref, core, settings, reloadCore } = v;
  const canEdit = mayEditCharacters(v.role, settings);
  const cab = core.cabinets.find((c) => c.id === char.cabinet_id) ?? null;
  const color = cab?.color ?? CK.muted;
  const gone = char.status === 'dead' || char.status === 'arrested';

  const [tab, setTab] = useState<Tab>(initialTab ?? 'profile');
  const [step, setStep] = useState<Step>({ kind: 'main' });
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<'picture' | 'guide' | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const picInput = useRef<HTMLInputElement>(null);
  const guideInput = useRef<HTMLInputElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  // The form. Saved with the Save button; the picture, guide, status and map pick save at once.
  const [d, setD] = useState({
    name: char.name, title: char.title ?? '', bio: char.bio ?? '', powers: char.powers ?? '', location: char.location ?? '',
    status_note: char.status_note ?? '', cabinet: char.cabinet_id ?? '', owner: char.owner_member_id ?? '',
  });
  const set = <K extends keyof typeof d>(k: K, val: (typeof d)[K]) => setD((p) => ({ ...p, [k]: val }));

  // Secret goals and staff notes (staff only).
  const [secret, setSecret] = useState<CharacterSecret | null | undefined>(v.staff ? undefined : null);
  const [goals, setGoals] = useState<string | null>(null);
  const [notes, setNotes] = useState<string | null>(null);

  // Directives and meetings, for the Directives and Performance tabs.
  const [dirs, setDirs] = useState<Directive[] | null>(null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [co, setCo] = useState<Set<string>>(new Set());
  const seq = useRef(0);

  const readAll = useCallback(async () => {
    const mine = ++seq.current;
    let client;
    try { client = await getCrisisClient(ref.conf, ref.crisis); } catch (e) { notifyErr(crisisError(e, 'Could not load the directives.'), `${KEY}-dirs`); return; }
    const [dr, mr, cr, sr] = await Promise.allSettled([
      listDirectives(ref),
      listMeetings(ref),
      client.from('crisis_directive_coauthors').select('directive_id').eq('character_id', char.id),
      v.staff ? client.from('crisis_character_secrets').select('*').eq('character_id', char.id).maybeSingle() : Promise.resolve(null),
    ]);
    if (mine !== seq.current) return;
    if (dr.status === 'fulfilled') setDirs(dr.value);
    else { setDirs((p) => p ?? []); notifyErr(crisisError(dr.reason, 'Could not load the directives.'), `${KEY}-dirs`); }
    if (mr.status === 'fulfilled') setMeetings(mr.value);
    if (cr.status === 'fulfilled' && cr.value && !cr.value.error) setCo(new Set(((cr.value.data ?? []) as Array<{ directive_id: string }>).map((r) => r.directive_id)));
    if (sr.status === 'fulfilled' && sr.value && !sr.value.error) setSecret((sr.value.data as CharacterSecret | null) ?? null);
    else if (v.staff) setSecret((p) => (p === undefined ? null : p));
  }, [ref, char.id, v.staff]);

  useEffect(() => {
    const t = window.setTimeout(() => { void readAll(); }, 0);
    return () => window.clearTimeout(t);
  }, [readAll]);
  useCrisisLive(ref.id, ['crisis_directives', 'crisis_meetings', 'crisis_character_secrets'], () => { void readAll(); });

  // Escape goes back a step, then closes. A dropdown inside closes first.
  const stepRef = useRef(step);
  const closeRef = useRef(onClose);
  useEffect(() => { stepRef.current = step; closeRef.current = onClose; });
  useEffect(() => {
    const el = panel.current;
    const before = document.activeElement as HTMLElement | null;
    el?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (document.querySelector('[data-gsel-popover]') || e.defaultPrevented) return;
      if (stepRef.current.kind !== 'main') setStep({ kind: 'main' });
      else closeRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; before?.focus?.(); };
  }, []);

  const mine = useMemo(() => {
    if (!dirs) return null;
    return dirs
      .filter((x) => x.status !== 'withdrawn' && (x.author_character_id === char.id || co.has(x.id)))
      .sort((a, b) => b.no - a.no);
  }, [dirs, char.id, co]);

  const points = useMemo(
    () => characterPoints(char.id, dirs ?? [], meetings, readPoints(core.crisis.settings), co),
    [char.id, dirs, meetings, core.crisis.settings, co],
  );

  // ───────── Saves ─────────

  const patch = async (row: Partial<Character>, ok: string) => {
    try {
      await saveCharacter(ref, { ...row, id: char.id });
      notifyOk(ok, KEY);
      await reloadCore();
      return true;
    } catch (e) { notifyErr(crisisError(e, 'Could not save the character.'), KEY); return false; }
  };

  const changePicture = async (file: File | undefined) => {
    if (!file || uploading) return;
    if (!file.type.startsWith('image/')) { notifyErr('Use a JPG, PNG, WebP or GIF image.', KEY); return; }
    setUploading('picture');
    try {
      const r = await uploadCrisisFile(ref, file);
      await patch({ picture_url: r.url }, 'Picture changed');
    } catch (e) { notifyErr(crisisError(e, 'Could not upload the picture. Try again.'), KEY); }
    finally { setUploading(null); }
  };

  const changeGuide = async (file: File | undefined) => {
    if (!file || uploading) return;
    setUploading('guide');
    try {
      const r = await uploadCrisisFile(ref, file);
      await patch({ guide_url: r.url, guide_name: r.name }, 'Guide saved');
    } catch (e) { notifyErr(crisisError(e, 'Could not upload the guide. Try again.'), KEY); }
    finally { setUploading(null); }
  };

  const pickPlace = async (place: string) => {
    set('location', place);
    setStep({ kind: 'main' });
    await patch({ location: place }, 'Location saved');
  };

  const dirty =
    d.name.trim() !== char.name || d.title.trim() !== (char.title ?? '') || d.bio.trim() !== (char.bio ?? '').trim()
    || d.powers.trim() !== (char.powers ?? '').trim() || d.location.trim() !== (char.location ?? '')
    || d.status_note.trim() !== (char.status_note ?? '') || (v.director && (d.cabinet !== (char.cabinet_id ?? '') || d.owner !== (char.owner_member_id ?? '')))
    || (goals !== null && goals.trim() !== (secret?.goals ?? '').trim()) || (notes !== null && notes.trim() !== (secret?.staff_notes ?? '').trim());

  const save = async () => {
    if (busy || !dirty) return;
    const name = d.name.trim();
    if (!name) { notifyErr('Give the character a name.', KEY); return; }
    setBusy(true);
    try {
      const row: Partial<Character> = {
        name, title: nul(d.title), bio: nul(d.bio), powers: nul(d.powers), location: nul(d.location), status_note: nul(d.status_note),
      };
      if (v.director) { row.cabinet_id = d.cabinet || null; row.owner_member_id = d.owner || null; }
      await saveCharacter(ref, { ...row, id: char.id });
      const sp: Partial<Pick<CharacterSecret, 'goals' | 'staff_notes'>> = {};
      if (goals !== null && goals.trim() !== (secret?.goals ?? '').trim()) sp.goals = nul(goals);
      if (notes !== null && notes.trim() !== (secret?.staff_notes ?? '').trim()) sp.staff_notes = nul(notes);
      if (Object.keys(sp).length) await saveSecret(ref, char.id, sp);
      setGoals(null); setNotes(null);
      notifyOk('Saved', KEY);
      await reloadCore();
      await readAll();
    } catch (e) { notifyErr(crisisError(e, 'Could not save the character.'), KEY); }
    finally { setBusy(false); }
  };

  const remove = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await deleteCharacter(ref, char.id);
      notifyOk('Character deleted', KEY);
      await reloadCore();
      onClose();
    } catch (e) { notifyErr(crisisError(e, 'Could not delete the character.'), KEY); setBusy(false); }
  };

  // ───────── Pieces ─────────

  const iconBtn = {
    border: 0, background: CK.card, borderRadius: 10, width: 36, height: 36, cursor: 'pointer', color: CK.forest, boxShadow: CK.shadowSm,
    display: 'grid', placeItems: 'center', flexShrink: 0,
  } as const;

  const statusOptions: GSelectOption[] = STATUS_ORDER.map((s) => ({ value: s, label: STATUS_WORD[s], icon: <StatusIcon status={s} /> }));
  const cabinetOptions: GSelectOption[] = [{ value: '', label: 'No cabinet' }, ...core.cabinets.map((c) => ({ value: c.id, label: c.name }))];
  const ownerOptions: GSelectOption[] = [
    { value: '', label: 'Not set' },
    ...responsibleMembers(core.members).map((m) => ({ value: m.id, label: m.display_name, hint: ROLE_LABEL[m.role] })),
  ];

  const openStep = step.kind === 'directive' ? mine?.find((x) => x.id === step.id) ?? null : null;
  const stepTitle = step.kind === 'guide' ? 'Character Guide' : step.kind === 'map' ? 'Pick a Location' : step.kind === 'directive' ? `Directive ${openStep?.no ?? ''}` : '';

  const tabs: Array<{ value: Tab; label: string }> = [
    { value: 'profile', label: 'Profile' }, { value: 'directives', label: 'Directives' }, { value: 'performance', label: 'Performance' },
  ];

  const avatar = (
    <Avatar name={char.name} src={char.picture_url} size={AVATAR} color={color} style={{ filter: gone ? 'grayscale(1)' : undefined }} />
  );

  return (
    <Portal>
      <div className="crisis-char-wrap" style={{ position: 'fixed', inset: 0, zIndex: 200, fontFamily: CK.font, display: 'grid', placeItems: 'center' }}>
        <style>{`
          .crisis-char-panel { width: min(900px, calc(100vw - 24px)); height: min(820px, calc(100dvh - 96px)); }
          @keyframes crisis-char-in { from { opacity: 0; transform: translateY(12px) scale(0.985); } to { opacity: 1; transform: none; } }
          .crisis-char-panel { animation: crisis-char-in 200ms cubic-bezier(0.22,1,0.36,1); }
          @media (prefers-reduced-motion: reduce) { .crisis-char-panel { animation: none; } }
          .crisis-char-head { padding-left: ${AVATAR + 40}px; }
          @media (max-width: 520px) { .crisis-char-head { padding-left: 16px; padding-top: ${OVERHANG + AVATAR / 2}px; } }
        `}</style>
        <div aria-hidden onMouseDown={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(58,14,15,0.42)' }} />
        <div
          ref={panel}
          role="dialog"
          aria-modal="true"
          aria-label={char.name}
          tabIndex={-1}
          className="crisis-char-panel focus:outline-none"
          style={{ position: 'relative', marginTop: OVERHANG, color: CK.ink }}
        >
          {/* The portrait: one third outside the top edge, like the Live Status committee card. Click to change it. */}
          {canEdit && (
            <input ref={guideInput} type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="hidden" aria-label="Upload the character guide"
              onChange={(e) => { void changeGuide(e.target.files?.[0]); e.target.value = ''; }} />
          )}
          <div style={{ position: 'absolute', zIndex: 3, top: -OVERHANG, left: 24 }}>
            {canEdit ? (
              <>
                <input ref={picInput} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" aria-label="Choose a new picture"
                  onChange={(e) => { void changePicture(e.target.files?.[0]); e.target.value = ''; }} />
                <button
                  type="button"
                  onClick={() => picInput.current?.click()}
                  disabled={uploading !== null}
                  aria-label="Change the picture"
                  title="Change the picture"
                  className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] block"
                  style={{ border: 0, padding: 0, background: 'transparent', cursor: 'pointer', borderRadius: '50%', opacity: uploading === 'picture' ? 0.6 : 1 }}
                >
                  {avatar}
                  <span aria-hidden style={{ position: 'absolute', right: -2, bottom: -2, width: 28, height: 28, borderRadius: '50%', display: 'grid', placeItems: 'center', background: CK.card, color: CK.red, boxShadow: CK.shadowSm }}>
                    <Camera size={15} strokeWidth={1.5} />
                  </span>
                </button>
              </>
            ) : avatar}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', borderRadius: 26, background: CK.surface, boxShadow: '0 24px 60px rgba(58,14,15,0.35)' }}>
            {/* Header */}
            <div className="crisis-char-head flex items-start gap-3" style={{ padding: '14px 14px 12px 0', background: CK.card, borderBottom: `1px solid ${CK.hair}` }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="flex items-baseline flex-wrap" style={{ gap: '2px 10px' }}>
                  <h2 style={{ margin: 0, fontSize: 20, lineHeight: 1.2, fontWeight: 800, color: CK.ink, overflowWrap: 'anywhere' }}>{char.name}</h2>
                  {char.title && <span style={{ fontSize: 14, fontWeight: 600, color: CK.inkSoft, overflowWrap: 'anywhere' }}>{char.title}</span>}
                  {char.location && (
                    <span className="inline-flex items-center" style={{ gap: 4, fontSize: 13, color: CK.inkSoft, overflowWrap: 'anywhere' }}>
                      <MapPin size={14} strokeWidth={1.5} aria-hidden style={{ color: CK.red, flex: 'none' }} />{char.location}
                    </span>
                  )}
                </div>
                <div className="flex items-center flex-wrap" style={{ gap: '6px 16px', marginTop: 6 }}>
                  <span className="inline-flex items-center" style={{ gap: 7, minWidth: 0 }}>
                    {cab?.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={cab.logo_url} alt="" width={24} height={24} style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover', flex: 'none', border: '0.5px solid rgba(221,212,192,0.6)', background: '#FDFCF9' }} />
                    ) : (
                      <i aria-hidden style={{ width: 12, height: 12, borderRadius: 4, background: color, display: 'inline-block', flex: 'none' }} />
                    )}
                    <b style={{ fontSize: 13.5, color: cab ? cab.color : CK.muted, overflowWrap: 'anywhere' }}>{cab?.name ?? 'No cabinet'}</b>
                  </span>
                  {canEdit ? (
                    <span style={{ minWidth: 150 }}>
                      <GSelect size="sm" value={char.status} onChange={(s) => { void patch({ status: s as CharacterStatus }, 'Status changed'); }} options={statusOptions} aria-label="Status" />
                    </span>
                  ) : (
                    <span className="inline-flex items-center" style={{ gap: 5, fontSize: 13, fontWeight: 700, color: statusColor(char.status) }}>
                      <StatusIcon status={char.status} size={15} />{STATUS_WORD[char.status]}
                      {char.status_note && <span style={{ fontWeight: 500, color: CK.inkSoft, overflowWrap: 'anywhere' }}>{`· ${char.status_note}`}</span>}
                    </span>
                  )}
                </div>
              </div>
              <button type="button" onClick={onClose} aria-label="Close" className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]" style={iconBtn}>
                <X size={18} strokeWidth={1.6} />
              </button>
            </div>

            {/* Tabs, or the step bar with its back button */}
            {step.kind === 'main' ? (
              <div role="tablist" aria-label="Character" className="flex" style={{ gap: 4, padding: '8px 16px 0', background: CK.card, borderBottom: `1px solid ${CK.hair}` }}>
                {tabs.map((t) => {
                  const on = t.value === tab;
                  return (
                    <button
                      key={t.value}
                      role="tab"
                      aria-selected={on}
                      onClick={() => setTab(t.value)}
                      className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
                      style={{
                        border: 0, background: 'transparent', cursor: 'pointer', padding: '8px 14px', fontSize: 14, fontWeight: 700, fontFamily: CK.font,
                        color: on ? CK.red : CK.inkSoft, boxShadow: on ? `inset 0 -3px 0 ${CK.red}` : 'none',
                      }}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center gap-3" style={{ padding: '8px 16px', background: CK.card, borderBottom: `1px solid ${CK.hair}` }}>
                <button type="button" onClick={() => setStep({ kind: 'main' })} aria-label="Back" className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]" style={iconBtn}>
                  <ArrowLeft size={18} strokeWidth={1.6} />
                </button>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: CK.ink, overflowWrap: 'anywhere' }}>{stepTitle}</h3>
              </div>
            )}

            {/* Body */}
            <div key={step.kind === 'main' ? tab : `${step.kind}`} style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 20px 22px' }}>
              {step.kind === 'guide' && <GuideStep char={char} canEdit={canEdit} uploading={uploading === 'guide'} onReplace={() => guideInput.current?.click()} />}
              {step.kind === 'map' && <CharacterMapPicker current={d.location} onPick={(p) => { void pickPlace(p); }} />}
              {step.kind === 'directive' && (openStep ? <DirectiveView d={openStep} /> : <p style={{ margin: 0, fontSize: 14, color: CK.inkSoft }}>That directive is no longer here.</p>)}

              {step.kind === 'main' && tab === 'profile' && (
                <div className="flex flex-col" style={{ gap: 14 }}>
                  {canEdit ? (
                    <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                      <div>
                        <FieldLabel htmlFor="cm-name">Name</FieldLabel>
                        <input id="cm-name" value={d.name} onChange={(e) => set('name', e.target.value)} style={fieldStyle} maxLength={120} />
                      </div>
                      <div>
                        <FieldLabel htmlFor="cm-title">Title</FieldLabel>
                        <input id="cm-title" value={d.title} onChange={(e) => set('title', e.target.value)} style={fieldStyle} maxLength={160} />
                      </div>
                    </div>
                  ) : null}

                  <TextBlock label="Bio" editable={canEdit} value={d.bio} onChange={(x) => set('bio', x)} rows={5} empty="No bio yet." />
                  <TextBlock label="Powers" editable={canEdit} value={d.powers} onChange={(x) => set('powers', x)} rows={3} empty="No special powers." />

                  <div>
                    <FieldLabel htmlFor="cm-location">Location</FieldLabel>
                    {canEdit ? (
                      <div className="flex items-center gap-2 flex-wrap">
                        <input id="cm-location" value={d.location} onChange={(e) => set('location', e.target.value)} style={{ ...fieldStyle, flex: '1 1 220px', width: 'auto' }} maxLength={160} />
                        <Btn tone="ghost" icon={<MapPin size={15} strokeWidth={1.5} />} onClick={() => setStep({ kind: 'map' })}>Pick on the map</Btn>
                      </div>
                    ) : (
                      <p style={{ margin: 0, fontSize: 14.5, color: char.location ? CK.ink : CK.muted, overflowWrap: 'anywhere' }}>{char.location || 'Not set.'}</p>
                    )}
                  </div>

                  {/* The character guide: one clickable tile. */}
                  {char.guide_url ? (
                    <div>
                      <button
                        type="button"
                        onClick={() => setStep({ kind: 'guide' })}
                        className="flex items-center gap-3 w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] active:scale-[0.99] transition-transform"
                        style={{ border: 0, cursor: 'pointer', padding: '12px 14px', borderRadius: 16, background: cabinetTint(CK.gold, 0.28), boxShadow: CK.shadowSm, fontFamily: CK.font, color: CK.ink }}
                      >
                        <BookOpen size={22} strokeWidth={1.5} aria-hidden style={{ color: CK.goldDeep, flex: 'none' }} />
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <b style={{ display: 'block', fontSize: 14.5 }}>Character Guide</b>
                          <span style={{ display: 'block', fontSize: 12.5, color: CK.inkSoft, overflowWrap: 'anywhere' }}>{char.guide_name || 'Open the guide'}</span>
                        </span>
                        <ChevronRight size={18} strokeWidth={1.5} aria-hidden style={{ color: CK.goldDeep, flex: 'none' }} />
                      </button>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => guideInput.current?.click()}
                          disabled={uploading !== null}
                          className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
                          style={{ border: 0, background: 'transparent', padding: '6px 2px 0', cursor: 'pointer', fontSize: 12.5, fontWeight: 700, color: CK.forest, textDecoration: 'underline', fontFamily: CK.font }}
                        >
                          {uploading === 'guide' ? 'Uploading' : 'Replace'}
                        </button>
                      )}
                    </div>
                  ) : canEdit ? (
                    <button
                      type="button"
                      onClick={() => guideInput.current?.click()}
                      disabled={uploading !== null}
                      className="flex items-center gap-3 w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] active:scale-[0.99] transition-transform"
                      style={{ border: `1.5px dashed ${CK.goldMid}`, cursor: 'pointer', padding: '12px 14px', borderRadius: 16, background: cabinetTint(CK.gold, 0.14), fontFamily: CK.font, color: CK.ink }}
                    >
                      <Upload size={22} strokeWidth={1.5} aria-hidden style={{ color: CK.goldDeep, flex: 'none' }} />
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <b style={{ display: 'block', fontSize: 14.5 }}>{uploading === 'guide' ? 'Uploading' : 'Add the character guide'}</b>
                        <span style={{ display: 'block', fontSize: 12.5, color: CK.inkSoft }}>PDF or Word, up to 20 MB</span>
                      </span>
                    </button>
                  ) : (
                    <p className="flex items-center gap-2" style={{ margin: 0, fontSize: 13.5, color: CK.muted }}>
                      <BookOpen size={16} strokeWidth={1.5} aria-hidden style={{ flex: 'none' }} />No character guide yet.
                    </p>
                  )}

                  {canEdit && (
                    <div>
                      <FieldLabel htmlFor="cm-status-note">Status note</FieldLabel>
                      <input id="cm-status-note" value={d.status_note} onChange={(e) => set('status_note', e.target.value)} style={fieldStyle} maxLength={200} />
                    </div>
                  )}

                  {v.director && (
                    <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                      <div>
                        <FieldLabel>Cabinet</FieldLabel>
                        <GSelect value={d.cabinet} onChange={(c) => set('cabinet', c)} options={cabinetOptions} aria-label="Cabinet" />
                      </div>
                      <div>
                        <FieldLabel hint="Answers this character's directives by default">Responsible backroomer</FieldLabel>
                        <GSelect value={d.owner} onChange={(o) => set('owner', o)} options={ownerOptions} aria-label="Responsible backroomer" />
                      </div>
                    </div>
                  )}

                  {v.staff && (
                    <div style={{ background: CK.well, borderRadius: 16, padding: 14 }} className="flex flex-col gap-3">
                      <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: CK.red }}>Staff only. The delegate never sees these</p>
                      {secret === undefined ? (
                        <><Skeleton h={70} r={12} /><Skeleton h={70} r={12} /></>
                      ) : (
                        <>
                          <TextBlock label="Secret goals" editable={canEdit} value={goals ?? secret?.goals ?? ''} onChange={setGoals} rows={3} empty="No secret goals." />
                          <TextBlock label="Staff notes" editable={canEdit} value={notes ?? secret?.staff_notes ?? ''} onChange={setNotes} rows={3} empty="No staff notes." />
                        </>
                      )}
                    </div>
                  )}

                  {v.director && gone && <SpareSwap char={char} onDone={onClose} />}
                </div>
              )}

              {step.kind === 'main' && tab === 'directives' && (
                mine === null ? (
                  <div className="flex flex-col" style={{ gap: 8 }}><Skeleton h={58} /><Skeleton h={58} /><Skeleton h={58} /></div>
                ) : mine.length === 0 ? (
                  <p style={{ margin: 0, fontSize: 14, color: CK.inkSoft }}>{char.name} has not sent a directive yet.</p>
                ) : (
                  <div className="flex flex-col" style={{ gap: 8 }}>
                    {mine.map((x) => <DirectiveRow key={x.id} d={x} wrote={x.author_character_id === char.id} onOpen={() => setStep({ kind: 'directive', id: x.id })} />)}
                  </div>
                )
              )}

              {step.kind === 'main' && tab === 'performance' && (
                <Performance points={points} directives={mine} meetings={meetings} characterId={char.id} loading={dirs === null} />
              )}
            </div>

            {/* Footer: Save and Delete for editors on the Profile tab */}
            {step.kind === 'main' && tab === 'profile' && canEdit && (
              <div className="flex items-center justify-between flex-wrap gap-2" style={{ padding: '12px 20px', borderTop: `1px solid ${CK.hair}`, background: CK.card }}>
                {confirmDelete ? (
                  <ConfirmInline
                    style={{ flex: '1 1 100%' }}
                    text={`Delete ${char.name}? Their goals and resources go with them. Anyone playing this character is left without one. This cannot be undone.`}
                    confirmLabel="Delete character"
                    busy={busy}
                    onConfirm={remove}
                    onCancel={() => setConfirmDelete(false)}
                  />
                ) : (<>
                {v.director ? (
                  <Btn tone="danger" size="sm" icon={<Trash2 size={14} strokeWidth={1.5} />} onClick={() => setConfirmDelete(true)} disabled={busy}>Delete</Btn>
                ) : <span />}
                <div className="flex gap-2">
                  <Btn tone="ghost" onClick={onClose} disabled={busy}>Close</Btn>
                  <Btn onClick={save} disabled={busy || !dirty || !d.name.trim()}>{busy ? 'Saving' : 'Save'}</Btn>
                </div>
                </>)}
              </div>
            )}
          </div>
        </div>
      </div>
    </Portal>
  );
}

// ─────────── Small pieces ───────────

function TextBlock({ label, editable, value, onChange, rows, empty }: {
  label: string; editable: boolean; value: string; onChange: (v: string) => void; rows: number; empty: string;
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      {editable ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows} aria-label={label} style={{ ...fieldStyle, resize: 'vertical' }} />
      ) : (
        <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', color: value.trim() ? CK.ink : CK.muted }}>{value.trim() || empty}</p>
      )}
    </div>
  );
}

function GuideStep({ char, canEdit, uploading, onReplace }: { char: Character; canEdit: boolean; uploading: boolean; onReplace: () => void }) {
  const url = char.guide_url;
  if (!url) return <p style={{ margin: 0, fontSize: 14, color: CK.inkSoft }}>There is no guide yet.</p>;
  const viewable = isPdf(url, char.guide_name) || isImage(url);
  return (
    <div className="flex flex-col" style={{ gap: 10, height: '100%', minHeight: 360 }}>
      <div className="flex items-center gap-2 flex-wrap">
        <FileText size={16} strokeWidth={1.5} aria-hidden style={{ color: CK.goldDeep, flex: 'none' }} />
        <b style={{ fontSize: 14, overflowWrap: 'anywhere' }}>{char.guide_name || 'Character guide'}</b>
        <span className="flex-1" />
        {canEdit && (
          <button type="button" onClick={onReplace} disabled={uploading} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
            style={{ border: 0, background: 'transparent', cursor: 'pointer', fontSize: 12.5, fontWeight: 700, color: CK.forest, textDecoration: 'underline', fontFamily: CK.font }}>
            {uploading ? 'Uploading' : 'Replace'}
          </button>
        )}
      </div>
      {viewable ? (
        isImage(url) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" style={{ display: 'block', maxWidth: '100%', borderRadius: 14, boxShadow: CK.shadowSm }} />
        ) : (
          <iframe src={url} title={char.guide_name || 'Character guide'} style={{ flex: 1, width: '100%', minHeight: 420, border: 0, borderRadius: 14, background: CK.card, boxShadow: CK.shadowSm }} />
        )
      ) : (
        <div style={{ background: CK.card, borderRadius: 16, boxShadow: CK.shadowSm, padding: 18 }}>
          <p style={{ margin: '0 0 12px', fontSize: 14, color: CK.inkSoft }}>This kind of file opens in your own app.</p>
          <a href={url} target="_blank" rel="noopener noreferrer" download={char.guide_name || undefined}
            className="inline-flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
            style={{ padding: '9px 14px', borderRadius: 12, background: CK.card, boxShadow: CK.shadowSm, color: CK.forest, fontSize: 14, fontWeight: 700, textDecoration: 'underline', overflowWrap: 'anywhere' }}>
            <FileDown size={18} strokeWidth={1.5} aria-hidden style={{ flexShrink: 0 }} />Download the guide
          </a>
        </div>
      )}
    </div>
  );
}

function OutcomeMark({ d }: { d: Directive }) {
  const o = d.outcome ? OUTCOME_STYLE[d.outcome] : null;
  if (!o || !d.outcome) return <span style={{ fontSize: 12.5, fontWeight: 700, color: CK.muted }}>{d.status === 'clarify' ? OUTCOME_LABEL.clarify : 'Waiting for a reply'}</span>;
  const I = o.Icon;
  return (
    <span className="inline-flex items-center" style={{ gap: 5, fontSize: 12.5, fontWeight: 800, color: o.color }}>
      <I size={15} strokeWidth={1.5} aria-hidden />{OUTCOME_LABEL[d.outcome]}
    </span>
  );
}

function DirectiveRow({ d, wrote, onOpen }: { d: Directive; wrote: boolean; onOpen: () => void }) {
  const o = d.outcome ? OUTCOME_STYLE[d.outcome] : null;
  const tone = o?.color ?? CK.muted;
  const K = KIND_ICON[d.kind];
  const first = d.body.split('\n').find((l) => l.trim()) ?? '';
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex items-start gap-3 w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] active:scale-[0.995] transition-transform"
      style={{ border: 0, cursor: 'pointer', padding: '10px 14px', borderRadius: 14, background: cabinetTint(tone, 0.08), boxShadow: `inset 4px 0 0 ${tone}`, fontFamily: CK.font, color: CK.ink }}
    >
      <span style={{ flex: 1, minWidth: 0 }}>
        <span className="flex items-center flex-wrap" style={{ gap: '2px 10px' }}>
          <b style={{ fontSize: 14.5, overflowWrap: 'anywhere' }}>{d.title}</b>
          <span className="inline-flex items-center" style={{ gap: 4, fontSize: 12, color: CK.inkSoft }}><K size={13} strokeWidth={1.5} aria-hidden />No. {d.no}{wrote ? '' : ' (co-written)'}</span>
        </span>
        <span title={first} style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', fontSize: 13, color: CK.inkSoft, marginTop: 2, overflowWrap: 'anywhere' }}>{first}</span>
        <span className="flex items-center flex-wrap" style={{ gap: '2px 12px', marginTop: 5 }}>
          <OutcomeMark d={d} />
          <span style={{ fontSize: 12, color: CK.muted }}>{dateLabel(d.created_at)}</span>
        </span>
      </span>
      <ChevronRight size={18} strokeWidth={1.5} aria-hidden style={{ color: CK.muted, flex: 'none', marginTop: 2 }} />
    </button>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ marginTop: 16 }}>
      <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 800, color: CK.inkSoft }}>{title}</p>
      {children}
    </div>
  );
}

function DirectiveView({ d }: { d: Directive }) {
  const K = KIND_ICON[d.kind];
  const o = d.outcome ? OUTCOME_STYLE[d.outcome] : null;
  return (
    <article>
      <div className="flex items-center flex-wrap" style={{ gap: '4px 12px', fontSize: 12.5, color: CK.inkSoft }}>
        <span className="inline-flex items-center" style={{ gap: 5, fontWeight: 700 }}><K size={14} strokeWidth={1.5} aria-hidden />{KIND_LABEL[d.kind]} No. {d.no}</span>
        <span>Sent {dateLabel(d.created_at)}</span>
        {d.covert && <span style={{ fontWeight: 700, color: CK.red }}>Covert</span>}
      </div>
      <h3 style={{ margin: '6px 0 8px', fontSize: 20, lineHeight: 1.25, fontWeight: 800, overflowWrap: 'anywhere' }}>{d.title}</h3>
      {d.themes.length > 0 && <div className="flex flex-wrap" style={{ gap: 6, marginBottom: 10 }}>{d.themes.map((t) => <ThemeTag key={t} theme={t} size="md" />)}</div>}
      {d.receiver && <p style={{ margin: '0 0 10px', fontSize: 13.5, color: CK.inkSoft, overflowWrap: 'anywhere' }}>To: <b style={{ color: CK.ink }}>{d.receiver}</b></p>}
      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.65, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{d.body}</p>
      {d.resources_used && <Section title="Resources used"><p style={{ margin: 0, fontSize: 14, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{d.resources_used}</p></Section>}
      {d.goal && <Section title="Goal"><p style={{ margin: 0, fontSize: 14, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{d.goal}</p></Section>}
      {d.affects && <Section title="Who it affects"><p style={{ margin: 0, fontSize: 14, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{d.affects}</p></Section>}
      <div style={{ marginTop: 18, borderRadius: 16, padding: '12px 14px', background: cabinetTint(o?.color ?? CK.muted, 0.1), boxShadow: `inset 4px 0 0 ${o?.color ?? CK.muted}` }}>
        <OutcomeMark d={d} />
        {d.reply ? (
          <p style={{ margin: '6px 0 0', fontSize: 14.5, lineHeight: 1.6, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{d.reply}</p>
        ) : (
          <p style={{ margin: '6px 0 0', fontSize: 13.5, color: CK.inkSoft }}>No reply yet.</p>
        )}
        {d.answered_at && <p style={{ margin: '6px 0 0', fontSize: 12, color: CK.muted }}>Answered {dateLabel(d.answered_at)}</p>}
      </div>
    </article>
  );
}

function Performance({ points, directives, meetings, characterId, loading }: {
  points: ReturnType<typeof characterPoints>; directives: Directive[] | null; meetings: Meeting[]; characterId: string; loading: boolean;
}) {
  if (loading) return <div className="flex flex-col" style={{ gap: 8 }}><Skeleton h={48} w="40%" /><Skeleton h={30} /><Skeleton h={30} /><Skeleton h={30} /></div>;
  const list = directives ?? [];
  const approved = list.filter((x) => x.outcome === 'approved').length;
  const held = meetings.filter((m) => m.status === 'held' && m.character_ids.includes(characterId)).length;
  return (
    <div className="flex flex-col" style={{ gap: 18 }}>
      <div className="flex items-end flex-wrap" style={{ gap: '10px 28px' }}>
        <BigCount n={points.total} word={points.total === 1 ? 'crisis point' : 'crisis points'} color={CK.red} />
        <BigCount n={list.length} word={list.length === 1 ? 'directive' : 'directives'} />
        <BigCount n={approved} word="approved" color={CK.ok} />
        <BigCount n={held} word={held === 1 ? 'meeting held' : 'meetings held'} />
      </div>
      <div style={{ background: CK.card, borderRadius: 18, boxShadow: CK.shadowSm, padding: '6px 16px' }}>
        {points.lines.map((l, i) => (
          <div key={l.label} className="flex items-center justify-between gap-3" style={{ padding: '10px 0', borderTop: i === 0 ? 0 : `1px solid ${CK.hair}` }}>
            <span style={{ fontSize: 14, fontWeight: 600, overflowWrap: 'anywhere', minWidth: 0 }}>{l.label}</span>
            <span style={{ fontSize: 13, color: CK.inkSoft, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
              {l.count} × {l.each} = <b style={{ fontSize: 15, color: l.total < 0 ? CK.danger : CK.ink }}>{l.total}</b>
            </span>
          </div>
        ))}
      </div>
      <p style={{ margin: 0, fontSize: 12.5, color: CK.inkSoft }}>The Crisis Director sets what each action is worth in Settings. Points help judge awards; they are not a score.</p>
    </div>
  );
}

// ─────────── Give a delegate a spare character ───────────

function SpareSwap({ char, onDone }: { char: Character; onDone: () => void }) {
  const { ref, core, reloadCore } = useCrisis();
  const delegates = core.members.filter((m) => m.character_id === char.id);
  const spares = core.characters.filter((c) => c.status === 'spare' && c.cabinet_id === char.cabinet_id);
  const [pick, setPick] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const give = async (m: (typeof delegates)[number]) => {
    const spare = spares.find((s) => s.id === pick[m.id]);
    if (!spare || busy) return;
    setBusy(m.id);
    try {
      await saveMember(ref, m.id, { character_id: spare.id });
      await saveCharacter(ref, { id: spare.id, status: 'active', owner_member_id: spare.owner_member_id ?? char.owner_member_id });
      notifyOk(`${m.display_name} now plays ${spare.name}`, KEY);
      await reloadCore();
      onDone();
    } catch (e) { notifyErr(crisisError(e, 'Could not give the spare character.'), KEY); }
    finally { setBusy(null); }
  };

  return (
    <div style={{ background: 'rgba(163,65,47,0.07)', borderRadius: 16, padding: 14, boxShadow: 'inset 0 0 0 1px rgba(163,65,47,0.2)' }} className="flex flex-col gap-3">
      <p className="flex items-center gap-2" style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: CK.ink }}>
        <UserRoundPlus size={16} strokeWidth={1.5} aria-hidden style={{ color: CK.red }} />
        Give this delegate a spare character
      </p>
      {delegates.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: CK.inkSoft }}>Nobody plays {char.name} right now.</p>
      ) : spares.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: CK.inkSoft }}>This cabinet has no spare characters. Add one and set its status to Spare.</p>
      ) : (
        delegates.map((m) => (
          <div key={m.id} className="flex items-end flex-wrap gap-2">
            <div style={{ flex: '1 1 200px', minWidth: 0 }}>
              <FieldLabel>{m.display_name}</FieldLabel>
              <GSelect
                value={pick[m.id] ?? ''}
                onChange={(id) => setPick((p) => ({ ...p, [m.id]: id }))}
                options={spares.map((s) => ({ value: s.id, label: s.name, hint: s.title ?? undefined }))}
                placeholder="Pick a spare character"
                aria-label={`Spare character for ${m.display_name}`}
              />
            </div>
            <Btn size="sm" onClick={() => give(m)} disabled={!pick[m.id] || busy !== null}>Give spare character</Btn>
          </div>
        ))
      )}
    </div>
  );
}
