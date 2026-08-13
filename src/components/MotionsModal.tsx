'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Portal from '@/components/Portal';
import { useT, useLanguage } from '@/contexts/LanguageContext';
import { Committee, PendingMotion, PendingMotionType } from '@/lib/types';
import { getCountryByName, getFlagUrl, getCountryDisplayName, compareCountryNames } from '@/lib/countries';

const SQUARE_FLAGS = new Set(['CH', 'NP']);
import { Emoji } from '@/components/Emoji';
import { useSettingsStore, DEFAULT_MOTION_NAMES, MotionNames } from '@/lib/settingsStore';
import {
  addPendingMotion as addPendingMotionInDB,
  removePendingMotion as removePendingMotionInDB,
  setPhase as setPhaseInDB,
  updateCaucus as updateCaucusInDB,
  addToCaucusList as addToCaucusListInDB,
  batchAddToCaucusList as batchAddToCaucusListInDB,
  clearCaucusList as clearCaucusListInDB,
  suspendDebate as suspendDebateInDB,
  endDebate as endDebateInDB,
  clearCurrentSpeakerIfUnchanged,
  logEvent,
} from '@/lib/committeeService';

type ModalView = 'list' | 'raise' | 'vote';
type TypeMeta = Record<PendingMotionType, { icon: string; label: string; sub: string }>;

const TYPE_STATIC: Record<PendingMotionType, { icon: string; sub: string }> = {
  'end-debate':     { icon: '🏁', sub: 'Formally close the session' },
  'suspend-debate': { icon: '⏸️', sub: 'Suspend the session temporarily' },
  consultation:     { icon: '🤝', sub: 'Informal session, all together' },
  tour:             { icon: '🔄', sub: 'Everyone speaks once, alphabetical order' },
  unmoderated:      { icon: '💬', sub: 'Free time for delegates to talk' },
  moderated:        { icon: '🎙️', sub: 'Structured speeches, blank slate to fill' },
  custom:           { icon: '📝', sub: 'Handled in the room, the session carries on unchanged' },
};

function buildTypeMeta(motionNames: MotionNames): TypeMeta {
  return {
    'end-debate':     { ...TYPE_STATIC['end-debate'],     label: motionNames.endDebate },
    'suspend-debate': { ...TYPE_STATIC['suspend-debate'], label: motionNames.suspendDebate },
    consultation:     { ...TYPE_STATIC.consultation,      label: motionNames.consultation },
    tour:             { ...TYPE_STATIC.tour,              label: motionNames.tour },
    unmoderated:      { ...TYPE_STATIC.unmoderated,       label: motionNames.unmoderated },
    moderated:        { ...TYPE_STATIC.moderated,         label: motionNames.moderated },
    custom:           { ...TYPE_STATIC.custom,            label: motionNames.custom },
  };
}

// ── Custom motion helpers ─────────────────────────────────────────────────────
// A Custom motion is a free-text placeholder for procedural business that is
// settled verbally in the room. Its optional name is stored in the existing
// `topic` column (no schema change), its proposer may be blank, and ACCEPTING
// ONE IS A DELIBERATE NO-OP — see handleMotionAccepted.
const CUSTOM_NAME_MAX = 80;

/** Collapse whitespace and hard-cap the length so a pasted essay cannot break the layout. */
function sanitiseCustomName(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, CUSTOM_NAME_MAX);
}

const customFallbackLabel = (language: string) =>
  language === 'ar' ? 'اقتراح مخصص' : language === 'fr' ? 'Motion personnalisée' : language === 'es' ? 'Moción personalizada' : 'Custom motion';

const customNameLabel = (language: string) =>
  language === 'ar' ? 'اسم الاقتراح' : language === 'fr' ? 'Nom de la motion' : language === 'es' ? 'Nombre de la moción' : 'Motion name';

const customNamePlaceholder = (language: string) =>
  language === 'ar' ? 'مثال: نقطة نظام بشأن ترتيب التصويت'
  : language === 'fr' ? "ex. Point d'ordre sur l'ordre du vote"
  : language === 'es' ? 'ej. Cuestión de orden sobre el orden de votación'
  : 'e.g. Point of order on the voting order';

const noProposerLabel = (language: string) =>
  language === 'ar' ? 'بدون مقدِّم' : language === 'fr' ? 'Sans proposant' : language === 'es' ? 'Sin proponente' : 'No proposer';

/** Accepting a Custom motion only takes it off the floor, so the button says so. */
const clearFromFloorLabel = (language: string) =>
  language === 'ar' ? 'قبول وإزالة' : language === 'fr' ? 'Accepter et retirer' : language === 'es' ? 'Aceptar y retirar' : 'Accept & clear';

const blankNameHint = (language: string, fallback: string) =>
  language === 'ar' ? `إذا تُرك فارغًا سيظهر باسم "${fallback}".`
  : language === 'fr' ? `Laissé vide, il s'affichera comme « ${fallback} ».`
  : language === 'es' ? `Si se deja en blanco, se mostrará como "${fallback}".`
  : `Left blank, it shows as "${fallback}".`;

/** Title to render for a motion card: a Custom motion shows its own name. */
const motionDisplayLabel = (m: PendingMotion, typeMeta: TypeMeta, language: string) =>
  m.type === 'custom' ? (m.topic?.trim() || customFallbackLabel(language)) : typeMeta[m.type].label;

/** Identity used to re-match a motion across a temp-ID → real-UUID swap. Custom
 *  motions add their name so two of them never collapse onto one another. */
const motionIdentity = (m: PendingMotion) =>
  m.type === 'custom' ? `custom|${m.proposedBy}|${m.topic ?? ''}` : `${m.proposedBy}|${m.type}`;

/** Custom motions never occupy a delegation's "one motion on the floor" slot,
 *  and never block another motion, because they change nothing. */
const isFloorMotion = (m: PendingMotion) =>
  (m.type as string) !== 'join-request' && (m.type as string) !== 'gsl-request' && m.type !== 'custom';


function requiredVotes(type: PendingMotionType, present: number): { needed: number; fraction: string } {
  if (type === 'consultation' || type === 'tour') return { needed: Math.ceil((present * 2) / 3), fraction: '2/3 majority' };
  return { needed: Math.floor(present / 2) + 1, fraction: 'Simple majority' };
}

function DisruptivenessBadge({ type }: { type: PendingMotionType }) {
  const t = useT();
  const { language } = useLanguage();
  const labels: Record<PendingMotionType, string> = {
    'end-debate': t('motions_badge_ends'), 'suspend-debate': t('motions_badge_suspends'),
    consultation: t('motions_badge_most'), tour: t('motions_badge_very'),
    unmoderated: t('motions_badge_disruptive'), moderated: t('motions_badge_least'),
    custom: informationalLabel(language),
  };
  const colors: Record<PendingMotionType, string> = {
    'end-debate': 'bg-[#8B2020]/20 text-[#8B2020] border-[#8B2020]/40',
    'suspend-debate': 'bg-[#B8844A]/15 text-[#B8844A] border-orange-800/40',
    consultation: 'bg-[#8B2020]/20 text-[#8B2020] border-[#8B2020]/40',
    tour: 'bg-[#B8844A]/15 text-[#B8844A] border-orange-800/40',
    unmoderated: 'bg-[#B6871F]/10 text-[#B6871F] border-[#B6871F]/30',
    moderated: 'bg-[#1B3828]/30 text-[#EED98A] border-[#1B3828]/40',
    custom: 'bg-[#9A8A78]/12 text-[#6A5A4A] border-[#C5B9A8]',
  };
  return <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${colors[type]}`}>{labels[type]}</span>;
}

const informationalLabel = (language: string) =>
  language === 'ar' ? 'للعلم فقط' : language === 'fr' ? 'Informatif' : language === 'es' ? 'Informativo' : 'Informational';

const noOpCopy = (language: string) => language === 'ar'
  ? { head: 'قبول هذا الاقتراح لا يغير الجلسة', body: 'الاقتراح المخصص هو سجل فقط. عند قبوله يختفي من قائمة الاقتراحات ولا يتغير شيء آخر: تبقى المرحلة وقائمة المتحدثين والمتحدث الحالي كما هي، ويستمر النقاش من حيث توقف.' }
  : language === 'fr' ? { head: "Accepter ne change rien à la séance", body: "Une motion personnalisée n'est qu'une trace écrite. À l'acceptation elle quitte le plancher et rien d'autre ne bouge : la phase, la liste des orateurs et l'orateur en cours restent identiques, le débat reprend exactement où il en était." }
  : language === 'es' ? { head: 'Aceptarla no cambia la sesión', body: 'Una moción personalizada es solo un registro. Al aceptarla desaparece del pleno y nada más cambia: la fase, la lista de oradores y el orador actual siguen igual, y el debate continúa donde estaba.' }
  : { head: 'Accepting this will not change the session', body: 'A Custom motion is a record only. Accepting it clears it from the floor and nothing else moves: the phase, the speakers list, the caucus queue and the current speaker all stay exactly as they are, and debate carries on where it left off.' };

/** Informational "i" affordance. Opens on HOVER and on FOCUS (never on click),
 *  per the house UI rules, and is portaled at fixed viewport coordinates with
 *  edge flipping so a scrollable modal body can never clip it. */
function InfoHint({ head, body }: { head: string; body: string }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number; flipped: boolean } | null>(null);

  const WIDTH = 288;
  const place = useCallback(() => {
    const b = btnRef.current;
    if (!b) return;
    const r = b.getBoundingClientRect();
    const left = Math.max(8, Math.min(r.left, window.innerWidth - WIDTH - 8));
    const spaceBelow = window.innerHeight - r.bottom;
    const flipped = spaceBelow < 150 && r.top > spaceBelow;
    setPos({ top: flipped ? r.top - 8 : r.bottom + 8, left, flipped });
  }, []);

  useEffect(() => {
    if (!open) return;
    place();
    const onScroll = () => place();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => { window.removeEventListener('scroll', onScroll, true); window.removeEventListener('resize', onScroll); };
  }, [open, place]);

  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);

  const show = () => { if (closeTimer.current) clearTimeout(closeTimer.current); place(); setOpen(true); };
  // Small delay so the pointer can travel from the badge into the panel.
  const hide = () => { if (closeTimer.current) clearTimeout(closeTimer.current); closeTimer.current = setTimeout(() => setOpen(false), 160); };

  return (
    <>
      <button
        ref={btnRef} type="button" tabIndex={0} aria-label={head}
        onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}
        onClick={(e) => e.preventDefault()}
        className="shrink-0 w-[15px] h-[15px] rounded-full inline-flex items-center justify-center text-[10px] font-black leading-none transition-colors focus:outline-none"
        style={{ border: '1px solid #C5B9A8', color: '#6A5A4A', backgroundColor: '#FAF8F3' }}
      >
        i
      </button>
      {open && pos && (
        <Portal>
          <div
            onMouseEnter={show} onMouseLeave={hide}
            className="fixed z-[70] rounded-2xl px-4 py-3"
            style={{
              top: pos.top, left: pos.left, width: WIDTH,
              transform: pos.flipped ? 'translateY(-100%)' : undefined,
              backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0',
              boxShadow: '0 10px 30px rgba(28,20,16,0.18), 0 2px 6px rgba(28,20,16,0.08)',
            }}
          >
            <p className="text-xs font-black mb-1" style={{ color: '#1B3828' }}>{head}</p>
            <p className="text-xs leading-relaxed" style={{ color: '#6A5A4A' }}>{body}</p>
          </div>
        </Portal>
      )}
    </>
  );
}

/** The strip that makes it unmistakable a Custom motion is informational. */
function CustomNoOpNotice({ compact = false }: { compact?: boolean }) {
  const { language } = useLanguage();
  const copy = noOpCopy(language);
  return (
    <div
      className={`flex items-center gap-2 rounded-xl ${compact ? 'px-2.5 py-1' : 'px-3 py-1.5'}`}
      style={{ backgroundColor: '#EDE7D8', border: '1px dashed #C5B9A8' }}
    >
      <span className={compact ? 'text-[10px]' : 'text-xs'} style={{ color: '#6A5A4A', fontWeight: 600 }}>{copy.head}</span>
      <span className="ms-auto flex items-center"><InfoHint head={copy.head} body={copy.body} /></span>
    </div>
  );
}

const CHAIR_KEY = '__chair__';
const chairDisplayName = (language: string) => language === 'ar' ? 'الرئيس' : language === 'fr' ? 'Président' : language === 'es' ? 'Presidente' : 'Chair';

function ProposerInput({ candidates, value, onChange, blockedCountries, optional = false }: {
  candidates: string[]; value: string; onChange: (v: string) => void; blockedCountries?: Set<string>;
  /** Custom motions allow a blank proposer — shows a "leave blank" affordance. */
  optional?: boolean;
}) {
  const t = useT();
  const { language } = useLanguage();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number; flipped: boolean } | null>(null);
  const q = query.trim().toLowerCase();
  const dName = (c: string) => c === CHAIR_KEY ? chairDisplayName(language) : getCountryDisplayName(c, language);
  // Chair entry: always show at top when query is empty or matches "chair"
  const chairBlocked = blockedCountries?.has(CHAIR_KEY) ?? false;
  const showChair = !q || chairDisplayName(language).toLowerCase().includes(q);
  const delegateMatches = q
    ? candidates.filter((c) => c !== CHAIR_KEY && dName(c).toLowerCase().startsWith(q))
        .concat(candidates.filter((c) => c !== CHAIR_KEY && !dName(c).toLowerCase().startsWith(q) && dName(c).toLowerCase().includes(q)))
    : [];
  const matches = showChair ? [CHAIR_KEY, ...delegateMatches] : delegateMatches;
  const top = matches[0] ?? null;
  const commit = (country: string) => {
    if (blockedCountries?.has(country)) return;
    onChange(country); setQuery(dName(country)); setOpen(false);
  };

  // The modal body is `overflow-y-auto`, so an in-flow absolute dropdown gets
  // clipped. Render it through a Portal at fixed viewport coordinates measured
  // from the field, repositioned on scroll (capture) + resize, flipping upward
  // and clamping horizontally near the viewport edges.
  const LIST_MAX_H = 192;
  const place = useCallback(() => {
    const w = wrapRef.current;
    if (!w) return;
    const r = w.getBoundingClientRect();
    const width = Math.min(r.width, window.innerWidth - 16);
    const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
    const spaceBelow = window.innerHeight - r.bottom;
    const flipped = spaceBelow < LIST_MAX_H + 16 && r.top > spaceBelow;
    setPos({ top: flipped ? r.top - 4 : r.bottom + 4, left, width, flipped });
  }, []);

  useEffect(() => {
    if (!open) return;
    place();
    const onMove = () => place();
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    // Outside click closes, but clicks inside the portaled list must not count.
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (wrapRef.current?.contains(target) || listRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => {
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open, place]);

  return (
    <div className="relative" ref={wrapRef}>
      {value && !open ? (
        <div className="flex items-center gap-3 bg-[#1B3828]/10 border-2 border-[#3D7A52]/40 rounded-xl px-4 py-3">
          {value === CHAIR_KEY
            ? <span className="text-lg leading-none">🪑</span>
            : (() => { const f = getCountryByName(value); return f ? <img src={getFlagUrl(f.code)} alt={f.code} style={{ borderRadius: '6px', border: '1.5px solid rgba(28,20,16,0.10)', objectFit: 'cover' }} className="w-7 h-5 inline-block" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} /> : null; })()}
          <span className="text-sm text-[#1C1410] flex-1 font-semibold">{dName(value)}</span>
          <button onClick={() => { setOpen(true); setQuery(''); onChange(''); inputRef.current?.focus(); }} className="text-xs font-bold transition-colors focus:outline-none" style={{ color: '#2A5A3C' }}>{t('motions_change')}</button>
        </div>
      ) : (
        <div className="flex items-center bg-[#FAF8F3] border border-[#DDD4C0] focus-within:border-[#1B3828] rounded-xl overflow-hidden transition-colors">
          <input ref={inputRef} autoFocus={open} type="text" value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); onChange(''); }}
            onKeyDown={(e) => { if (e.key === 'Enter' && top) { e.preventDefault(); commit(top); } if (e.key === 'Escape') { setQuery(''); setOpen(false); } }}
            placeholder={optional ? optionalProposerPlaceholder(language) : t('motions_proposer_placeholder')}
            className="flex-1 bg-transparent px-4 py-3 text-[#1C1410] placeholder-[#9A8A78] focus:outline-none text-sm" />
          {top && query && <span className="text-xs text-[#9A8A78] px-3 truncate max-w-[120px]">↵ {dName(top)}</span>}
        </div>
      )}
      {open && (query || showChair) && matches.length > 0 && pos && (
        <Portal>
          <div
            ref={listRef}
            className="fixed bg-[#FAF8F3] border border-[#DDD4C0] rounded-xl overflow-hidden z-[65] overflow-y-auto"
            style={{
              top: pos.top, left: pos.left, width: pos.width, maxHeight: LIST_MAX_H,
              transform: pos.flipped ? 'translateY(-100%)' : undefined,
              boxShadow: '0 12px 32px rgba(28,20,16,0.22), 0 2px 6px rgba(28,20,16,0.10)',
            }}
          >
            {matches.slice(0, 7).map((country, i) => {
              const isChair = country === CHAIR_KEY;
              const found = isChair ? null : getCountryByName(country);
              const isBlocked = blockedCountries?.has(country) ?? false;
              return (
                <button key={country}
                  onMouseDown={(e) => { e.preventDefault(); if (!isBlocked) commit(country); }}
                  disabled={isBlocked}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-start transition-colors ${
                    isBlocked ? 'opacity-50 cursor-not-allowed bg-[#FAF8F3]' :
                    i === 0 ? 'bg-[#1B3828]/20 text-[#1C1410]' : 'text-[#1C1410] hover:bg-[#DDD4C0]'
                  }`}>
                  {isChair
                    ? <span className="text-base leading-none">🪑</span>
                    : found ? <img src={getFlagUrl(found.code)} alt={found.code} className="w-5 h-5 object-contain inline-block" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} /> : <Emoji size="1.125rem">🌐</Emoji>}
                  <span className="text-sm flex-1">{dName(country)}</span>
                  {isBlocked
                    ? <span className="text-xs text-[#B8844A] shrink-0 font-semibold">{t('motions_motion_on_floor')}</span>
                    : i === 0 && <span className="ms-auto text-xs text-[#9A8A78]">Enter ↵</span>}
                </button>
              );
            })}
          </div>
        </Portal>
      )}
    </div>
  );
}

const optionalProposerPlaceholder = (language: string) =>
  language === 'ar' ? 'اختياري — اتركه فارغًا' : language === 'fr' ? 'Facultatif — laisser vide' : language === 'es' ? 'Opcional — dejar en blanco' : 'Optional — leave blank';

// ── Raise Motion Form ─────────────────────────────────────────────────────────
function RaiseMotionForm({ committee, typeMeta, onBack, onRaised, editingMotion, belowQuorum = false, isViewOnly = false }: {
  committee: Committee;
  typeMeta: TypeMeta;
  onBack: () => void;
  onRaised: (motion: Omit<PendingMotion, 'id' | 'disruptiveness'>) => void;
  editingMotion?: PendingMotion | null;
  belowQuorum?: boolean;
  isViewOnly?: boolean;
}) {
  const t = useT();
  const { language } = useLanguage();
  const { getSettings } = useSettingsStore();
  const s = getSettings(committee.code);
  // Custom always sits last: it is the least disruptive motion there is.
  const DEFAULT_ORDER: PendingMotionType[] = ['moderated', 'unmoderated', 'tour', 'consultation', 'custom'];
  const enabledTypes = DEFAULT_ORDER.filter((motionType) => {
    if (motionType === 'moderated')    return s.motionModeratedCaucus !== false;
    if (motionType === 'unmoderated')  return s.motionUnmoderatedCaucus !== false;
    if (motionType === 'consultation') return s.motionCoW !== false;
    if (motionType === 'tour')         return s.motionTourDeTable !== false;
    if (motionType === 'custom')       return s.motionCustom !== false;
    return true;
  });
  const [type, setType] = useState<PendingMotionType | null>(editingMotion?.type ?? enabledTypes[0] ?? null);
  const [proposer, setProposer] = useState(editingMotion?.proposedBy ?? '');
  const [totalMinsStr, setTotalMinsStr] = useState(editingMotion ? String(Math.floor(editingMotion.totalTime / 60)) : '10');
  const [totalSecsStr, setTotalSecsStr] = useState(editingMotion ? String(editingMotion.totalTime % 60) : '0');
  const [speakingTimeStr, setSpeakingTimeStr] = useState(editingMotion ? String(editingMotion.speakingTime) : '60');
  const [topic, setTopic] = useState(editingMotion && editingMotion.type !== 'custom' ? editingMotion.topic : '');
  // A Custom motion's optional free-text name. Stored in the `topic` column on save.
  const [customName, setCustomName] = useState(editingMotion?.type === 'custom' ? (editingMotion.topic ?? '') : '');
  const [tourOrder, setTourOrder] = useState<'asc' | 'desc' | 'custom'>(editingMotion?.tourOrder ?? 'asc');
  const [error, setError] = useState('');

  const presentCountries = committee.delegates.filter((d) => d.status !== 'absent').map((d) => d.country);
  // Custom motions never consume a delegation's "one motion on the floor" slot.
  const countriesWithMotions = new Set(
    (committee.pendingMotions ?? []).filter(isFloorMotion).map((m) => m.proposedBy)
  );

  const totalMins = parseInt(totalMinsStr, 10) || 0;
  const totalSecs = Math.min(59, parseInt(totalSecsStr, 10) || 0);
  const speakingTime = parseInt(speakingTimeStr, 10) || 0;
  const totalTime = totalMins * 60 + totalSecs;

  const speakerCount = (totalTime > 0 && speakingTime > 0) ? Math.floor(totalTime / speakingTime) : null;
  const unusedSecs = (totalTime > 0 && speakingTime > 0) ? totalTime % speakingTime : 0;

  const numClass = 'bg-transparent text-[#1C1410] text-xl font-bold text-center focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';
  const numClassSm = 'bg-transparent text-[#1C1410] text-lg font-bold text-center focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';

  const canSubmit = () => {
    if (!type) return false;
    // Custom: name AND proposer are both optional, so a blank form is valid.
    if (type === 'custom') return true;
    if (!proposer) return false;
    if (type === 'moderated' && !topic.trim()) return false;
    return true;
  };

  const submit = () => {
    if (!type || !canSubmit()) return;
    setError('');

    // Custom motion: no timings, sanitised optional name, optional proposer.
    if (type === 'custom') {
      onRaised({
        type, proposedBy: proposer, totalTime: 0, speakingTime: 0,
        topic: sanitiseCustomName(customName), speakerList: [], proposerPosition: null,
      });
      return;
    }

    const isSuspendOrEnd = type === 'suspend-debate' || type === 'end-debate';
    if (!isSuspendOrEnd) {
      if ((type === 'moderated' || type === 'unmoderated') && totalTime === 0) {
        setError('Total caucus time cannot be zero.');
        return;
      }
      if (type === 'moderated' && speakingTime === 0) {
        setError('Speaking time per delegate cannot be zero.');
        return;
      }
    }
    const motion: Omit<PendingMotion, 'id' | 'disruptiveness'> = {
      type,
      proposedBy: proposer,
      totalTime: isSuspendOrEnd ? 0 : (type === 'tour' ? presentCountries.length * speakingTime : totalTime),
      speakingTime: isSuspendOrEnd ? 0 : speakingTime,
      topic: topic.trim(),
      speakerList: [],
      proposerPosition: null,
      ...(type === 'tour' ? { tourOrder } : {}),
    };
    onRaised(motion);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 px-7 pt-0 pb-4 space-y-4 overflow-y-auto">
        <h2 className="text-3xl font-black tracking-wide" style={{ color: '#1B3828' }}>{editingMotion ? t('motions_edit_heading') : t('motions_raise_heading')}</h2>

        {/* Type tabs, always shown */}
        <div className="flex gap-1.5 flex-wrap items-stretch">
          <div className="flex gap-1.5 flex-1 flex-wrap">
            {enabledTypes.map((motionType) => (
              <button key={motionType} type="button" onClick={() => setType(motionType)}
                className={`px-3 py-2 rounded-xl border font-bold text-base transition-all flex-1 min-w-[120px] ${
                  type === motionType ? 'bg-[#1B3828] border-[#2A5A3C] text-white' : 'bg-transparent border-[#DDD4C0] text-[#6A5A4A] hover:border-[#1B3828]'
                }`}>
                {typeMeta[motionType].label}
              </button>
            ))}
          </div>
          {/* Special debate control buttons, half size, red, stacked */}
          <div className="flex flex-col gap-1 self-stretch">
            <button type="button" onClick={() => setType('suspend-debate')}
              className={`px-2 flex-1 rounded-lg border text-xs font-bold transition-colors ${type === 'suspend-debate' ? 'bg-[#8B2020] border-red-700 text-white' : 'border-[#8B2020]/40 bg-[#8B2020]/20 text-[#8B2020] hover:bg-[#8B2020]/20'}`}>
              {t('motions_suspend')}
            </button>
            <button type="button" onClick={() => setType('end-debate')}
              className={`px-2 flex-1 rounded-lg border text-xs font-bold transition-colors ${type === 'end-debate' ? 'bg-[#8B2020] border-red-700 text-white' : 'border-[#8B2020]/40 bg-[#8B2020]/20 text-[#8B2020] hover:bg-[#8B2020]/20'}`}>
              {t('motions_end_debate')}
            </button>
          </div>
        </div>

        {type && (
          <>
            {/* Tour de Table & Consultation, optional topic at the very top */}
            {(type === 'tour' || type === 'consultation') && (
              <div>
                <label className="block text-lg font-semibold text-[#6A5A4A] mb-2">
                  {t('motions_topic_label')} <span className="text-[#9A8A78] text-sm font-normal">({t('motions_optional')})</span>
                </label>
                <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder={t('motions_topic_optional_ph')}
                  className="w-full bg-[#FAF8F3] border border-[#DDD4C0] rounded-xl px-4 py-2.5 text-[#1C1410] placeholder-[#9A8A78] focus:outline-none focus:border-[#1B3828] transition-colors" />
              </div>
            )}

            {/* Custom motion: optional free-text name, then optional proposer. */}
            {type === 'custom' && (
              <>
                <CustomNoOpNotice />
                <div>
                  <label className="block text-lg font-semibold text-[#6A5A4A] mb-2">
                    {customNameLabel(language)} <span className="text-[#9A8A78] text-sm font-normal">({t('motions_optional')})</span>
                  </label>
                  <input
                    type="text" value={customName} maxLength={CUSTOM_NAME_MAX}
                    onChange={(e) => setCustomName(e.target.value.slice(0, CUSTOM_NAME_MAX))}
                    placeholder={customNamePlaceholder(language)}
                    className="w-full bg-[#FAF8F3] border border-[#DDD4C0] rounded-xl px-4 py-3 text-[#1C1410] placeholder-[#9A8A78] focus:outline-none focus:border-[#1B3828] transition-colors" />
                  <div className="flex items-center gap-2 mt-1.5">
                    <p className="text-xs" style={{ color: '#9A8A78' }}>
                      {blankNameHint(language, customFallbackLabel(language))}
                    </p>
                    <span className="ms-auto text-xs font-mono tabular-nums shrink-0" style={{ color: customName.length >= CUSTOM_NAME_MAX ? '#B8844A' : '#C5B9A8' }}>
                      {customName.length}/{CUSTOM_NAME_MAX}
                    </span>
                  </div>
                </div>
              </>
            )}

            {/* For moderated caucus: Topic first, then Proposed By */}
            {type !== 'moderated' && (
              <div>
                <label className="block text-lg font-semibold mb-2" style={{ color: '#3D7A52' }}>
                  {t('motions_proposed_by')}
                  {type === 'custom' && <span className="text-[#9A8A78] text-sm font-normal ms-1.5">({t('motions_optional')})</span>}
                </label>
                <ProposerInput candidates={presentCountries} value={proposer} onChange={setProposer} blockedCountries={type === 'custom' ? undefined : countriesWithMotions} optional={type === 'custom'} />
              </div>
            )}

            {/* Tour de Table, speaking time per delegate + order */}
            {type === 'tour' && (
              <>
                <div className="bg-transparent border border-[#DDD4C0] rounded-2xl p-2.5 space-y-1.5">
                  <p className="text-[#1C1410] font-semibold text-xs">
                    {t('motions_all_speak', { n: presentCountries.length })}
                  </p>
                  <div>
                    <label className="block text-sm font-semibold text-[#6A5A4A] mb-1">{t('motions_speaking_time_label')}</label>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 bg-[#FAF8F3] border border-[#DDD4C0] rounded-xl px-3 py-1.5">
                        <input type="number" min={10} value={speakingTimeStr}
                          onChange={(e) => setSpeakingTimeStr(e.target.value)}
                          className={`w-14 ${numClass}`} />
                        <span className="text-[#6A5A4A] text-sm">{t('motions_sec')}</span>
                      </div>
                      <span className="text-xs text-[#9A8A78]">
                        {t('motions_total_approx', { n: speakingTime > 0 ? Math.ceil((presentCountries.length * speakingTime) / 60) : 0 })}
                      </span>
                    </div>
                    <div className="flex gap-2 mt-1.5">
                      {[30, 45, 60, 90, 120].map((t) => (
                        <button key={t} onClick={() => setSpeakingTimeStr(String(t))}
                          className={`text-xs px-2.5 py-1 rounded-lg transition-colors focus:outline-none ${speakingTime === t ? 'bg-[#1B3828] text-white font-bold' : 'bg-transparent border border-[#DDD4C0] text-[#6A5A4A] hover:text-[#1B3828]'}`}>
                          {t}s
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-[#6A5A4A] mb-1">{t('motions_speaking_order')}</label>
                    <div className="flex gap-3">
                      <button onClick={() => setTourOrder('asc')}
                        className={`flex-1 py-2 rounded-xl font-bold text-sm transition-colors focus:outline-none ${tourOrder === 'asc' ? 'bg-[#1B3828] text-white' : 'bg-transparent border border-[#DDD4C0] text-[#6A5A4A] hover:text-[#1B3828]'}`}>
                        {t('motions_az')}
                      </button>
                      <button onClick={() => setTourOrder('desc')}
                        className={`flex-1 py-2 rounded-xl font-bold text-sm transition-colors focus:outline-none ${tourOrder === 'desc' ? 'bg-[#1B3828] text-white' : 'bg-transparent border border-[#DDD4C0] text-[#6A5A4A] hover:text-[#1B3828]'}`}>
                        {t('motions_za')}
                      </button>
                      <button onClick={() => setTourOrder('custom')}
                        className={`flex-1 py-2 rounded-xl font-bold text-sm transition-colors focus:outline-none ${tourOrder === 'custom' ? 'bg-[#1B3828] text-white' : 'bg-transparent border border-[#DDD4C0] text-[#6A5A4A] hover:text-[#1B3828]'}`}>
                        {t('motions_room_order')}
                      </button>
                    </div>
                    <div style={{ height: '24px', display: 'flex', alignItems: 'center' }}>
                      {tourOrder === 'custom' && (
                        <p className="text-xs text-[#9A8A78] leading-relaxed">{t('motions_room_order_hint')}</p>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Unmoderated / Consultation, total time */}
            {(type === 'unmoderated' || type === 'consultation') && (
              <div>
                <label className="block text-lg font-semibold text-[#6A5A4A] mb-2">{t('motions_total_time_label')}</label>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 bg-[#FAF8F3] border border-[#DDD4C0] rounded-xl px-3 py-2.5">
                    <input type="number" min={0} value={totalMinsStr}
                      onChange={(e) => setTotalMinsStr(e.target.value)}
                      className={`w-12 ${numClass}`} />
                    <span className="text-[#6A5A4A] text-sm">{t('motions_min')}</span>
                  </div>
                  <div className="flex items-center gap-2 bg-[#FAF8F3] border border-[#DDD4C0] rounded-xl px-3 py-2.5">
                    <input type="number" min={0} max={59} value={totalSecsStr}
                      onChange={(e) => setTotalSecsStr(e.target.value)}
                      className={`w-12 ${numClass}`} />
                    <span className="text-[#6A5A4A] text-sm">{t('motions_sec')}</span>
                  </div>
                </div>
                <div className="flex gap-2 mt-2">
                  {[2, 5, 10, 15, 20].map((m) => (
                    <button key={m} onClick={() => { setTotalMinsStr(String(m)); setTotalSecsStr('0'); }}
                      className={`text-xs px-2.5 py-1.5 rounded-lg transition-colors ${totalMins === m && totalSecs === 0 ? 'bg-[#1B3828] text-white font-bold' : 'bg-[#EDE7D8] border border-[#DDD4C0] text-[#6A5A4A] hover:text-[#1B3828]'}`}>
                      {m}m
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Moderated caucus, Topic first, then Proposed By */}
            {type === 'moderated' && (
              <>
                <div>
                  <label className="block text-lg font-semibold text-[#6A5A4A] mb-2">{t('motions_topic_label')} <span className="text-[#8B2020]">*</span></label>
                  <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)}
                    placeholder={language === 'ar' ? 'مثال: الاستجابة الإنسانية في مناطق النزاع' : language === 'fr' ? 'ex. Réponse humanitaire dans les zones de conflit' : language === 'es' ? 'ej. Respuesta humanitaria en zonas de conflicto' : 'e.g. Humanitarian response in conflict zones'}
                    className="w-full bg-[#FAF8F3] border-2 border-[#DDD4C0] rounded-xl px-4 py-4 text-[#1C1410] placeholder-[#9A8A78] focus:outline-none focus:border-[#1B3828] transition-colors" />
                </div>
                <div>
                  <label className="block text-lg font-semibold mb-2" style={{ color: '#3D7A52' }}>{t('motions_proposed_by')}</label>
                  <ProposerInput candidates={presentCountries} value={proposer} onChange={setProposer} blockedCountries={countriesWithMotions} />
                </div>
                {/* Total time + speaking time, side by side to avoid scroll */}
                <div className="flex gap-4 items-start">
                  <div className="flex-1">
                    <label className="block text-sm font-semibold text-[#6A5A4A] mb-2">{t('motions_total_time_label')}</label>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 bg-[#FAF8F3] border border-[#DDD4C0] rounded-xl px-3 py-2">
                        <input type="number" min={0} value={totalMinsStr}
                          onChange={(e) => setTotalMinsStr(e.target.value)}
                          className={`w-10 ${numClassSm}`} />
                        <span className="text-[#6A5A4A] text-xs">{t('motions_min')}</span>
                      </div>
                      <div className="flex items-center gap-1.5 bg-[#FAF8F3] border border-[#DDD4C0] rounded-xl px-3 py-2">
                        <input type="number" min={0} max={59} value={totalSecsStr}
                          onChange={(e) => setTotalSecsStr(e.target.value)}
                          className={`w-10 ${numClassSm}`} />
                        <span className="text-[#6A5A4A] text-xs">{t('motions_sec')}</span>
                      </div>
                    </div>
                    <div className="flex gap-1.5 mt-2 flex-wrap">
                      {[2, 5, 10, 15, 20].map((m) => (
                        <button key={m} onClick={() => { setTotalMinsStr(String(m)); setTotalSecsStr('0'); }}
                          className={`text-xs px-2 py-1 rounded-lg transition-colors ${totalMins === m && totalSecs === 0 ? 'bg-[#1B3828] text-white font-bold' : 'bg-[#EDE7D8] border border-[#DDD4C0] text-[#6A5A4A] hover:text-[#1B3828]'}`}>
                          {m}m
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-semibold text-[#6A5A4A] mb-2">{t('motions_per_delegate')}</label>
                    <div className="flex items-center gap-1.5 bg-[#FAF8F3] border border-[#DDD4C0] rounded-xl px-3 py-2 w-fit">
                      <input type="number" min={0} value={speakingTimeStr}
                        onChange={(e) => setSpeakingTimeStr(e.target.value)}
                        className={`w-12 ${numClassSm}`} />
                      <span className="text-[#6A5A4A] text-xs">{t('motions_sec')}</span>
                    </div>
                    <div className="flex gap-1.5 mt-2 flex-wrap">
                      {[30, 45, 60, 90, 120].map((t) => (
                        <button key={t} onClick={() => setSpeakingTimeStr(String(t))}
                          className={`text-xs px-2 py-1 rounded-lg transition-colors ${speakingTime === t ? 'bg-[#1B3828] text-white font-bold' : 'bg-[#EDE7D8] border border-[#DDD4C0] text-[#6A5A4A] hover:text-[#1B3828]'}`}>
                          {t}s
                        </button>
                      ))}
                    </div>
                    {speakerCount !== null && (
                      <div className="mt-3 rounded-lg bg-white border border-[#DDD4C0] px-3 py-2 inline-flex items-baseline gap-1.5">
                        <span className="font-black text-xl leading-tight" style={{ color: '#1B3828' }}>{speakerCount}</span>
                        <span className="text-sm font-semibold" style={{ color: '#6A5A4A' }}>{speakerCount === 1 ? t('motions_delegate_speak').replace('{s}', t('motions_delegate_singular')) : t('motions_delegate_speak').replace('{s}', t('motions_delegate_plural'))}</span>
                        {unusedSecs > 0 && (
                          <span className="text-xs font-semibold ms-1" style={{ color: '#B8844A' }}>{t('motions_unused_secs').replace('{n}', String(unusedSecs))}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {type && (
        <div className="px-7 pb-7 pt-3 border-t border-white/10 shrink-0">
          {belowQuorum && (
            <div className="mb-4 p-3 bg-[#8B2020]/20 border border-[#8B2020]/40 rounded-xl text-xs text-[#8B2020]">
              ⚠️ {t('motions_quorum_warning')}
            </div>
          )}
          {error && <p className="text-[#8B2020] text-sm font-medium mb-3">{error}</p>}
          {!isViewOnly && (
            <button onClick={submit} disabled={!canSubmit() || belowQuorum}
              className="w-full bg-[#1B3828] hover:bg-[#2A5A3C] disabled:bg-[#DDD4C0] disabled:text-[#9A8A78] text-white py-5 rounded-2xl text-base font-black transition-colors focus:outline-none" style={{ letterSpacing: '0.05em' }}>
              {editingMotion ? t('motions_edit_btn') : t('motions_raise_btn')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Voting View ───────────────────────────────────────────────────────────────
function VotingView({ committee, typeMeta, onAccepted, onAllDone, onRemove, onBack, onEdit, pendingIds, isViewOnly = false, rank }: {
  committee: Committee;
  typeMeta: TypeMeta;
  onAccepted: (motion: PendingMotion) => void;
  onAllDone: () => void;
  onRemove: (motionId: string) => void;
  onBack: () => void;
  onEdit: (motionId: string) => void;
  pendingIds: Set<string>;
  isViewOnly?: boolean;
  /** B7 — recompute disruptiveness from the CURRENT motionOrder instead of trusting the
   *  value baked into the row at insert time. See rankMotion in MotionsModal. */
  rank: (m: PendingMotion) => number;
}) {
  const t = useT();
  const { language } = useLanguage();
  const { getSettings } = useSettingsStore();
  // Filter out join-request pseudo-motions, those are handled in the chair banner, not here
  const initialSorted = [...(committee.pendingMotions ?? [])]
    .filter((m) => m.type !== ('join-request' as string) && (m.type as string) !== 'gsl-request')
    .sort((a, b) => {
      if (rank(b) !== rank(a)) return rank(b) - rank(a);
      const aIdx = (committee.pendingMotions ?? []).findIndex((m) => m.id === a.id);
      const bIdx = (committee.pendingMotions ?? []).findIndex((m) => m.id === b.id);
      return aIdx - bIdx;
    });

  const [order, setOrder] = useState<PendingMotion[]>(initialSorted);
  const dragIndexRef = useRef<number | null>(null);

  // Keep order in sync when motions are removed externally
  const motionIdKey = (committee.pendingMotions ?? []).map((m) => m.id).join(',');
  useEffect(() => {
    const current = (committee.pendingMotions ?? []).filter((m) => m.type !== ('join-request' as string) && (m.type as string) !== 'gsl-request');
    setOrder((prev) => {
      // Match by proposer+type (plus name, for Custom) so temp ID → real UUID
      // swaps don't create duplicates
      const currentMap = new Map(current.map((m) => [motionIdentity(m), m]));
      const merged = prev
        .map((p) => currentMap.get(motionIdentity(p)) ?? null)
        .filter((m): m is PendingMotion => m !== null);
      const mergedKeys = new Set(merged.map(motionIdentity));
      const newOnes = current
        .filter((m) => !mergedKeys.has(motionIdentity(m)))
        .sort((a, b) => rank(b) - rank(a));
      return [...merged, ...newOnes].sort((a, b) => rank(b) - rank(a));
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [motionIdKey]);

  const present = committee.delegates.filter((d) => d.status !== 'absent' && !d.isObserver).length;

  if (order.length === 0) {
    return (
      <div className="px-7 pb-7 text-center py-8">
        <p className="text-[#6A5A4A]">{t('motions_no_vote')}</p>
        <button onClick={onAllDone} className="mt-4 text-sm text-[#B6871F] hover:text-[#EED98A]">{t('motions_back')}</button>
      </div>
    );
  }

  const primary = order[0];
  const rest = order.slice(1, 5);

  const renderCard = (m: PendingMotion, large: boolean, idx: number) => {
    const meta = typeMeta[m.type];
    if (!meta) {
      console.warn('Unknown motion type, skipping render:', m.type, m.id);
      return null;
    }
    const { needed, fraction } = requiredVotes(m.type, present);
    const totalMins = Math.floor(m.totalTime / 60);
    const totalSecs = m.totalTime % 60;
    const speakMins = Math.floor(m.speakingTime / 60);
    const speakSecs = m.speakingTime % 60;
    const fmtTime = (mins: number, secs: number) =>
      mins > 0 ? (secs > 0 ? `${mins}m ${secs}s` : `${mins}m`) : `${secs}s`;
    const isPrimary = idx === 0;
    const f = m.proposedBy ? getCountryByName(m.proposedBy) : null;
    const isCustom = m.type === 'custom';
    // A Custom motion titles itself with its own free-text name.
    const cardLabel = motionDisplayLabel(m, typeMeta, language);
    // Its ID must be real before Accept can delete the row (never call the DB
    // with a temp ID — the row would survive and realtime would resurrect it).
    const acceptBlocked = isCustom && pendingIds.has(m.id);

    return (
      <div
        key={m.id}
        draggable
        onDragStart={() => { dragIndexRef.current = idx; }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={() => {
          const from = dragIndexRef.current;
          if (from === null || from === idx) return;
          const newOrder = [...order];
          const [moved] = newOrder.splice(from, 1);
          newOrder.splice(idx, 0, moved);
          setOrder(newOrder);
          dragIndexRef.current = null;
        }}
        onDragEnd={() => { dragIndexRef.current = null; }}
        className={`relative bg-transparent rounded-2xl flex flex-col cursor-grab ${
          large
            ? `p-6 space-y-3 flex-1 min-w-0 border-2 ${isPrimary ? 'border-[#1B3828]' : 'border-[#DDD4C0]'}`
            : 'p-3 space-y-1 border border-[#DDD4C0]'
        }`}
      >
        {/* Position badge, straddles the top-right border corner */}
        <div
          className="absolute top-0 right-0 translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-black z-10 pointer-events-none select-none"
          style={{ backgroundColor: '#1B3828', color: '#EED98A' }}
        >
          {idx + 1}
        </div>
        {/* Header: icon + type label + flag in top-right */}
        <div className="flex items-center gap-2">
          <span className={`font-black text-[#1C1410] flex-1 min-w-0 ${large ? 'text-3xl' : 'text-lg'} flex items-center gap-1.5`}>
            <span className="min-w-0 break-words">{cardLabel}</span>
            {!isPrimary && !isViewOnly && (
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(m.id); }}
                title="Edit motion"
                className="opacity-40 hover:opacity-80 transition-opacity focus:outline-none shrink-0"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" stroke="#4A4A4A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M19.5 7.125L16.5 4.125" stroke="#4A4A4A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            )}
          </span>
          {m.proposedBy === CHAIR_KEY
            ? <span className={`shrink-0 ${large ? 'text-3xl' : 'text-xl'}`}>🪑</span>
            : f ? <img src={getFlagUrl(f.code)} alt={f.code} style={{ borderRadius: '8px', border: SQUARE_FLAGS.has(f.code) ? 'none' : '1.5px solid rgba(28,20,16,0.10)', objectFit: 'cover' }} className={large ? 'w-14 h-10 inline-block' : 'w-8 h-6 inline-block'} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} /> : null}
        </div>

        {/* Custom motions: badge line + the informational no-op strip */}
        {isCustom && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <DisruptivenessBadge type="custom" />
              {!m.proposedBy && (
                <span className={`${large ? 'text-sm' : 'text-xs'} font-semibold`} style={{ color: '#9A8A78' }}>{noProposerLabel(language)}</span>
              )}
            </div>
            <CustomNoOpNotice compact={!large} />
          </div>
        )}

        {/* Topic inline — a Custom motion's `topic` IS its title, already rendered above */}
        {m.topic && !isCustom && (
          <p className={`${large ? 'text-2xl' : 'text-base'} font-semibold`} style={{ color: '#1C1410' }}>
            <span className="font-bold" style={{ color: '#1B3828' }}>{t('motions_topic_inline')} </span>{m.topic}
          </p>
        )}

        {/* Timings, emphasised */}
        {m.type !== 'tour' && m.totalTime > 0 && (
          <div className="flex flex-col gap-0.5">
            {large ? (
              <>
                <p className="text-sm" style={{ color: '#1C1410' }}>
                  <span className="font-semibold" style={{ color: '#1B3828' }}>{t('motions_total_time_display')} </span>
                  <span className="font-black">{fmtTime(totalMins, totalSecs)}</span>
                </p>
                {m.type === 'moderated' && m.speakingTime > 0 && (
                  <p className="text-sm" style={{ color: '#1C1410' }}>
                    <span className="font-semibold" style={{ color: '#1B3828' }}>{t('motions_speaker_time_display')} </span>
                    <span className="font-black">{fmtTime(speakMins, speakSecs)}</span>
                  </p>
                )}
                {m.type === 'moderated' && m.speakingTime > 0 && m.totalTime > 0 && (
                  <p className="text-sm" style={{ color: '#1C1410' }}>
                    <span className="font-semibold" style={{ color: '#1B3828' }}>{t('motions_total_speakers_display')} </span>
                    <span className="font-black">{Math.floor(m.totalTime / m.speakingTime)} {Math.floor(m.totalTime / m.speakingTime) === 1 ? t('motions_speaker_singular') : t('motions_speaker_plural')}{m.totalTime % m.speakingTime !== 0 ? ' ⚠' : ''}</span>
                  </p>
                )}
              </>
            ) : (
              <>
                {/* Small cards: merge total + speaker time onto one line */}
                <p className="text-xs" style={{ color: '#1C1410' }}>
                  <span className="font-semibold" style={{ color: '#1B3828' }}>{t('motions_total_time_display')} </span>
                  <span className="font-black">{fmtTime(totalMins, totalSecs)}</span>
                  {m.type === 'moderated' && m.speakingTime > 0 && (
                    <>
                      <span className="mx-1 opacity-40">·</span>
                      <span className="font-semibold" style={{ color: '#1B3828' }}>{t('motions_speaker_time_display')} </span>
                      <span className="font-black">{fmtTime(speakMins, speakSecs)}</span>
                    </>
                  )}
                </p>
                {m.type === 'moderated' && m.speakingTime > 0 && m.totalTime > 0 && (
                  <p className="text-xs" style={{ color: '#1C1410' }}>
                    <span className="font-semibold" style={{ color: '#1B3828' }}>{t('motions_total_speakers_display')} </span>
                    <span className="font-black">{Math.floor(m.totalTime / m.speakingTime)} {Math.floor(m.totalTime / m.speakingTime) === 1 ? t('motions_speaker_singular') : t('motions_speaker_plural')}{m.totalTime % m.speakingTime !== 0 ? ' ⚠' : ''}</span>
                  </p>
                )}
              </>
            )}
          </div>
        )}
        {m.type === 'tour' && (
          <div className="flex items-center gap-2">
            <span className={`font-black ${large ? 'text-base text-[#1C1410]' : 'text-xs text-[#6A5A4A]'}`}>
              {fmtTime(0, m.speakingTime)} {t('motions_per_delegate')}
            </span>
            <span className={`${large ? 'text-sm' : 'text-xs'} text-[#9A8A78]`}>
              {m.tourOrder === 'desc' ? 'Z→A' : m.tourOrder === 'custom' ? 'Custom' : 'A→Z'}
            </span>
          </div>
        )}

        {/* Required votes, primary card only */}
        {isPrimary && (
          <div className="flex items-center gap-2 bg-[#FAF8F3] border border-[#DDD4C0] rounded-xl px-3 py-1.5">
            <span className="text-xs font-semibold" style={{ color: '#1B3828' }}>{fraction === 'Simple majority' ? t('motions_simple_majority') : t('motions_supermajority')}</span>
            <span className="text-xs font-bold ms-auto" style={{ color: '#1C1410' }}>{t('motions_needs_votes', { needed, present })}</span>
          </div>
        )}

        {/* Accept/Reject/Edit, primary card only; non-primary has inline pencil */}
        {isPrimary && !isViewOnly && (
          <div className="flex gap-2 mt-auto">
            <button onClick={() => { if (!acceptBlocked) onAccepted(m); }}
              disabled={acceptBlocked}
              title={acceptBlocked ? 'Saving…' : undefined}
              className={`flex-1 bg-[#2A5A3C] hover:bg-[#3D7A52] text-white py-2.5 rounded-xl font-bold text-sm transition-colors focus:outline-none ${acceptBlocked ? 'opacity-40 cursor-not-allowed' : ''}`} style={{ fontFamily: "'Outfit', sans-serif", letterSpacing: '0.05em' }}>
              {isCustom ? clearFromFloorLabel(language) : t('motions_accept_btn')}
            </button>
            <button onClick={() => onRemove(m.id)}
              disabled={pendingIds.has(m.id)}
              className={`flex-1 bg-[#DDD4C0] hover:bg-red-950/40 hover:text-[#8B2020] text-[#6A5A4A] border border-[#DDD4C0] hover:border-[#8B2020]/40 py-2.5 rounded-xl font-bold text-sm transition-colors focus:outline-none ${pendingIds.has(m.id) ? 'opacity-40 cursor-not-allowed' : ''}`} style={{ fontFamily: "'Outfit', sans-serif", letterSpacing: '0.05em' }}>
              {t('motions_reject_btn')}
            </button>
            <button onClick={(e) => { e.stopPropagation(); onEdit(m.id); }}
              title="Edit motion"
              className="bg-[#B6871F]/20 hover:bg-[#B6871F]/40 border border-[#B6871F]/50 hover:border-[#B6871F] text-[#B6871F] py-2.5 px-4 rounded-xl font-bold text-sm transition-colors shrink-0 focus:outline-none" style={{ fontFamily: "'DM Mono', monospace" }}>
              {t('motions_edit_label')}
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="px-7 pb-7 space-y-3 flex flex-col h-full overflow-hidden">
      <div className="flex items-center shrink-0">
        <h2 className="text-3xl font-black" style={{ color: '#1B3828' }}>{t('motions_vote_heading')}</h2>
      </div>
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs shrink-0 font-semibold" style={{ backgroundColor: '#1B3828', color: '#EED98A' }}>
        <span>{t('motions_drag_hint')}</span>
      </div>
      <div className="flex flex-1 min-h-0">
        {/* Left column, primary motion being voted on */}
        {/* pt-3 pe-4: give room for the badge that translates outside the card's top-right corner */}
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto pt-3 pe-4">
          {renderCard(primary, true, 0)}
        </div>
        {/* Vertical divider between column 1 and column 2 */}
        <div className="flex flex-col items-center gap-2 py-4 pointer-events-none select-none" style={{ opacity: 0.35, width: '20px' }}>
          <div className="flex-1 w-px" style={{ backgroundColor: '#C8BAA8' }} />
          <svg width="10" height="16" viewBox="0 0 10 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="2" cy="2"  r="1.5" fill="#1C1410"/>
            <circle cx="8" cy="2"  r="1.5" fill="#1C1410"/>
            <circle cx="2" cy="8"  r="1.5" fill="#1C1410"/>
            <circle cx="8" cy="8"  r="1.5" fill="#1C1410"/>
            <circle cx="2" cy="14" r="1.5" fill="#1C1410"/>
            <circle cx="8" cy="14" r="1.5" fill="#1C1410"/>
          </svg>
          <div className="flex-1 w-px" style={{ backgroundColor: '#C8BAA8' }} />
        </div>
        {/* Right column, queued motions + Raise a Motion button */}
        {/* pt-3 pe-4: give room for the badge that translates outside each card's top-right corner */}
        <div className="w-72 flex flex-col pt-3 pe-4">
          {rest.map((m, i) => (
            <React.Fragment key={m.id}>
              {renderCard(m, false, i + 1)}
              {i < rest.length - 1 && (
                <div className="flex items-center gap-2 px-2 pointer-events-none select-none" style={{ opacity: 0.35, height: '14px' }}>
                  <div className="flex-1 h-px" style={{ backgroundColor: '#C8BAA8' }} />
                  <svg width="16" height="10" viewBox="0 0 16 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="2"  cy="2" r="1.5" fill="#1C1410"/>
                    <circle cx="8"  cy="2" r="1.5" fill="#1C1410"/>
                    <circle cx="14" cy="2" r="1.5" fill="#1C1410"/>
                    <circle cx="2"  cy="8" r="1.5" fill="#1C1410"/>
                    <circle cx="8"  cy="8" r="1.5" fill="#1C1410"/>
                    <circle cx="14" cy="8" r="1.5" fill="#1C1410"/>
                  </svg>
                  <div className="flex-1 h-px" style={{ backgroundColor: '#C8BAA8' }} />
                </div>
              )}
              {i === rest.length - 1 && <div style={{ height: '6px' }} />}
            </React.Fragment>
          ))}
          {!isViewOnly && (
            <button
              onClick={onBack}
              className="w-full bg-[#2A5A3C] hover:bg-[#3D7A52] text-white py-3 rounded-2xl font-black text-sm transition-colors shrink-0 focus:outline-none"
              style={{ letterSpacing: '0.05em' }}
            >
              {t('motions_raise_motion_btn')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Modal ────────────────────────────────────────────────────────────────
export default function MotionsModal({ committee, onClose, onCommitteeUpdate, belowQuorum = false, isViewOnly = false }: {
  committee: Committee;
  onClose: () => void;
  onCommitteeUpdate?: (updater: (c: Committee) => Committee) => void;
  belowQuorum?: boolean;
  isViewOnly?: boolean;
}) {
  const t = useT();
  const { language } = useLanguage();
  const { getSettings } = useSettingsStore();
  const DEFAULT_MOTION_NAMES_LOCALIZED = language === 'ar' ? {
    moderated: 'حوار منهجي',
    unmoderated: 'حوار حر',
    consultation: 'مشاورات الهيئة',
    tour: 'جولة المتحدثين',
    custom: 'مخصص',
    suspendDebate: 'تعليق النقاش',
    endDebate: 'إنهاء النقاش',
  } : language === 'fr' ? {
    moderated: 'Caucus modéré',
    unmoderated: 'Caucus non modéré',
    consultation: "Consultation de l'assemblée",
    tour: 'Tour de table',
    custom: 'Personnalisée',
    suspendDebate: 'Suspension du débat',
    endDebate: 'Clôture du débat',
  } : language === 'es' ? {
    moderated: 'Cáucus Moderado',
    unmoderated: 'Cáucus No Moderado',
    consultation: 'Consulta de Gabinete',
    tour: 'Round Robin',
    custom: 'Personalizada',
    suspendDebate: 'Suspender Debate',
    endDebate: 'Cerrar Debate',
  } : DEFAULT_MOTION_NAMES;
  const committeeSettings = getSettings(committee.code);
  const storedNames = committeeSettings.motionNames;
  const motionOrder: string[] = committeeSettings.motionOrder ?? ['consultation', 'tour', 'unmoderated', 'moderated'];

  const motionNames = {
    moderated:     storedNames.moderated     !== DEFAULT_MOTION_NAMES.moderated     ? storedNames.moderated     : DEFAULT_MOTION_NAMES_LOCALIZED.moderated,
    unmoderated:   storedNames.unmoderated   !== DEFAULT_MOTION_NAMES.unmoderated   ? storedNames.unmoderated   : DEFAULT_MOTION_NAMES_LOCALIZED.unmoderated,
    consultation:  storedNames.consultation  !== DEFAULT_MOTION_NAMES.consultation  ? storedNames.consultation  : DEFAULT_MOTION_NAMES_LOCALIZED.consultation,
    tour:          storedNames.tour          !== DEFAULT_MOTION_NAMES.tour          ? storedNames.tour          : DEFAULT_MOTION_NAMES_LOCALIZED.tour,
    // `custom` post-dates existing persisted settings blobs, so fall back explicitly.
    custom:        (storedNames.custom && storedNames.custom !== DEFAULT_MOTION_NAMES.custom) ? storedNames.custom : DEFAULT_MOTION_NAMES_LOCALIZED.custom,
    suspendDebate: storedNames.suspendDebate !== DEFAULT_MOTION_NAMES.suspendDebate ? storedNames.suspendDebate : DEFAULT_MOTION_NAMES_LOCALIZED.suspendDebate,
    endDebate:     storedNames.endDebate     !== DEFAULT_MOTION_NAMES.endDebate     ? storedNames.endDebate     : DEFAULT_MOTION_NAMES_LOCALIZED.endDebate,
  };
  // B7 — `disruptiveness` is baked into the motions row at INSERT time, so a motion that
  // was queued BEFORE the chair reordered Settings → Motions still carries the old
  // ranking, and the list sorts inconsistently against motions raised after the reorder.
  // Rank at SORT time from the CURRENT motionOrder instead: no DB cost, no bulk row
  // update, and the stored column stays untouched (it is still the server-side ordering
  // fallback). Custom stays pinned lowest — localCalcDisruptiveness gives it base 0. The
  // join-request / gsl-request pseudo-motions carry hand-set 99M/98M scores but are
  // filtered out of every list below, so they are never re-ranked.
  // Single ranking source for this component, mirroring calcDisruptiveness() in
  // committeeService so an optimistic row and the DB row rank identically. Built as a plain
  // lookup table (a for loop, not a callback) because it is consumed during render.
  // Procedural motions keep fixed high scores; Custom is base 0, always last.
  const motionRankBase: Record<string, number> = { 'end-debate': 6_000_000, 'suspend-debate': 5_000_000, custom: 0 };
  for (let i = 0; i < motionOrder.length; i++) motionRankBase[motionOrder[i]] = (4 - i) * 1_000_000;
  const rankMotion = (m: PendingMotion) => (m.type === 'custom' ? 0 : (motionRankBase[m.type] ?? 1_000_000) + m.totalTime);
  const localCalcDisruptiveness = (type: string, totalTime: number) =>
    (type === 'custom' ? 0 : (motionRankBase[type] ?? 1_000_000) + totalTime);
  const typeMeta = buildTypeMeta(motionNames);
  const pending = [...(committee.pendingMotions ?? [])].filter((m) => m.type !== ('join-request' as string) && (m.type as string) !== 'gsl-request').sort((a, b) => rankMotion(b) - rankMotion(a));
  const [view, setView] = useState<ModalView>(pending.length === 0 && !isViewOnly ? 'raise' : 'vote');
  const [specialVoteMotion, setSpecialVoteMotion] = useState<PendingMotion | null>(null);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [editingMotionId, setEditingMotionId] = useState<string | null>(null);
  const update = (updater: (c: Committee) => Committee) => onCommitteeUpdate?.(updater);

  const handleRaised = (motion: Omit<PendingMotion, 'id' | 'disruptiveness'>) => {
    const existing = committee.pendingMotions ?? [];
    if (motion.type === 'custom') {
      // Custom motions don't take a delegation's floor slot, so several may be
      // queued at once. Only a byte-identical one (same proposer AND same name)
      // is rejected — that also keeps every queued Custom motion distinguishable.
      if (existing.some((m) => m.type === 'custom' && m.proposedBy === motion.proposedBy && (m.topic ?? '') === motion.topic)) return;
    } else if (existing.some((m) => isFloorMotion(m) && m.proposedBy === motion.proposedBy)) {
      return;
    }

    const tempId = `temp-${Date.now()}`;
    const disruptiveness = localCalcDisruptiveness(motion.type, motion.totalTime);

    setPendingIds((prev) => new Set([...prev, tempId]));
    update((c) => ({ ...c, pendingMotions: [...(c.pendingMotions ?? []), { ...motion, id: tempId, disruptiveness }] }));

    addPendingMotionInDB(committee.id, motion, committee.code, committee.dbChairJoinSuffix ?? undefined, motionOrder).then((realId) => {
      if (!realId) return;
      update((c) => ({
        ...c,
        pendingMotions: (c.pendingMotions ?? []).map((m) =>
          m.id === tempId ? { ...m, id: realId } : m
        ),
      }));
      setPendingIds((prev) => { const next = new Set(prev); next.delete(tempId); return next; });
    });

    setView('vote');
  };

  const handleRemove = (motionId: string) => {
    update((c) => ({ ...c, pendingMotions: (c.pendingMotions ?? []).filter((m) => m.id !== motionId) }));
    // Only call DB if this is a real UUID (not a temp optimistic ID)
    if (!motionId.startsWith('temp-')) {
      removePendingMotionInDB(motionId, committee.code, committee.dbChairJoinSuffix ?? undefined);
    }
  };

  const handleEdited = (motion: Omit<PendingMotion, 'id' | 'disruptiveness'>) => {
    if (!editingMotionId) return;
    const oldId = editingMotionId;

    // Remove old motion from local state immediately (same as handleRemove but inline
    // so committee.pendingMotions is clean before the re-add, avoiding the duplicate check)
    update((c) => ({ ...c, pendingMotions: (c.pendingMotions ?? []).filter((m) => m.id !== oldId) }));
    if (!oldId.startsWith('temp-')) removePendingMotionInDB(oldId, committee.code, committee.dbChairJoinSuffix ?? undefined);

    // Add replacement, same logic as handleRaised but NO duplicate check
    const tempId = `temp-${Date.now()}`;
    const disruptiveness = localCalcDisruptiveness(motion.type, motion.totalTime);

    setPendingIds((prev) => new Set([...prev, tempId]));
    update((c) => ({ ...c, pendingMotions: [...(c.pendingMotions ?? []), { ...motion, id: tempId, disruptiveness }] }));

    addPendingMotionInDB(committee.id, motion, committee.code, committee.dbChairJoinSuffix ?? undefined, motionOrder).then((realId) => {
      if (!realId) return;
      update((c) => ({
        ...c,
        pendingMotions: (c.pendingMotions ?? []).map((m) => m.id === tempId ? { ...m, id: realId } : m),
      }));
      setPendingIds((prev) => { const next = new Set(prev); next.delete(tempId); return next; });
    });

    setEditingMotionId(null);
    setView('vote');
  };

  const handleMotionAccepted = async (motion: PendingMotion) => {
    // Clear ALL other pending motions, only the accepted one proceeds
    // GSL (speakersList) is NEVER modified here

    // ── CUSTOM MOTION: DELIBERATE NO-OP ───────────────────────────────────────
    // This branch is FIRST and returns unconditionally so a Custom motion can
    // never reach any of the caucus/suspend/end branches below. Accepting one
    // does exactly two things: drop it from the local pending list, and delete
    // its row. It must NOT touch phase, caucus, caucusQueue, speakersList or
    // currentSpeaker, must not log a score event, and must not trigger the
    // caucus loading screen — the committee carries on exactly where it was.
    // Do not add anything else to this branch.
    if (motion.type === 'custom') {
      update((c) => ({ ...c, pendingMotions: (c.pendingMotions ?? []).filter((m) => m.id !== motion.id) }));
      // Never call the DB with a temp ID (the Accept button is disabled until
      // the real UUID lands, this is the belt-and-braces guard).
      if (!motion.id.startsWith('temp-')) {
        removePendingMotionInDB(motion.id, committee.code, committee.dbChairJoinSuffix ?? undefined);
      }
      // Close only when the floor is now empty; otherwise stay so the chair can
      // work through the remaining motions.
      const othersLeft = (committee.pendingMotions ?? []).some((m) => m.id !== motion.id && isFloorMotion(m));
      const customsLeft = (committee.pendingMotions ?? []).some((m) => m.id !== motion.id && m.type === 'custom');
      if (!othersLeft && !customsLeft) onClose();
      return;
    }

    if (motion.type === 'suspend-debate' || motion.type === 'end-debate') {
      setSpecialVoteMotion(motion);
      return;
    }

    // ── H3: the GSL speaker must LEAVE THE FLOOR when a caucus starts ──────────
    // Every caucus branch below sets `currentSpeaker: null`, but that was LOCAL ONLY: the
    // current_speaker DB row kept the previous delegate with started_at still set, so
    // delegates and advisors went on seeing them "speaking" for the whole caucus, and the
    // still-running timer drained the caucus clock during the loading screen.
    //
    // This clears the row for real. It is NOT the blind clearCurrentSpeaker() that MUST
    // NEVER HAPPEN #5 forbids: clearCurrentSpeakerIfUnchanged only matches the exact
    // speaker we saw (so a late clear is a no-op) AND nextSpeaker() drains it before
    // seating anyone (so it cannot be late relative to a later seat). It also nulls
    // started_at, so no separate stopSpeakerTimer write is needed — one conditional write,
    // nothing to race with. See the docstring in committeeService.ts.
    const floorSpeaker = committee.currentSpeaker;
    const clearFloorForCaucus = () => {
      if (!floorSpeaker) return;
      clearCurrentSpeakerIfUnchanged(
        committee.id, floorSpeaker.delegateId, floorSpeaker.country,
        committee.code, committee.dbChairJoinSuffix ?? undefined,
      );
    };

    // The proposer earns a point for getting a motion approved onto the floor.
    if (motion.proposedBy) {
      logEvent(committee.id, { country: motion.proposedBy, type: 'motion-raised', sourceId: 'motionRaised' }, committee.code, committee.dbChairJoinSuffix ?? undefined);
    }

    if (motion.type === 'unmoderated') {
      const caucus = {
        active: true, type: 'unmoderated' as const, motionLabel: typeMeta['unmoderated'].label,
        purpose: motion.topic || '', proposedBy: motion.proposedBy,
        totalTime: motion.totalTime, remainingTime: motion.totalTime,
        speakingTime: 0, speakerTimeRemaining: 0, currentSpeaker: null,
        proposerPosition: null, spokenCountries: [],
        // Total clock starts PAUSED — the chair presses play. remainingTime is the truth
        // until then, so every device reads the full time and nothing drains early.
        totalStartedAt: null,
      };
      update((c) => ({ ...c, phase: 'unmoderated-caucus', caucus, pendingMotions: (c.pendingMotions ?? []).filter((m) => m.id !== motion.id), caucusQueue: [], currentSpeaker: null }));
      onClose();
      clearFloorForCaucus();
      removePendingMotionInDB(motion.id, committee.code, committee.dbChairJoinSuffix ?? undefined);
      clearCaucusListInDB(committee.id, committee.code, committee.dbChairJoinSuffix ?? undefined);
      updateCaucusInDB(committee.id, caucus, committee.code, committee.dbChairJoinSuffix ?? undefined);
      setPhaseInDB(committee.id, 'unmoderated-caucus', committee.code, committee.dbChairJoinSuffix ?? undefined);
      return;
    }
    if (motion.type === 'consultation') {
      const caucus = {
        active: true, type: 'unmoderated' as const, motionLabel: typeMeta['consultation'].label,
        purpose: motion.topic || '', proposedBy: motion.proposedBy,
        totalTime: motion.totalTime, remainingTime: motion.totalTime,
        speakingTime: 0, speakerTimeRemaining: 0, currentSpeaker: null,
        proposerPosition: null, spokenCountries: [], isConsultation: true,
        totalStartedAt: null,   // paused until the chair presses play
      };
      // GSL preserved, caucusQueue cleared, phase → unmoderated-caucus
      update((c) => ({ ...c, phase: 'unmoderated-caucus', caucus, pendingMotions: (c.pendingMotions ?? []).filter((m) => m.id !== motion.id), caucusQueue: [], currentSpeaker: null }));
      onClose();
      clearFloorForCaucus();
      removePendingMotionInDB(motion.id, committee.code, committee.dbChairJoinSuffix ?? undefined);
      clearCaucusListInDB(committee.id, committee.code, committee.dbChairJoinSuffix ?? undefined);
      updateCaucusInDB(committee.id, caucus, committee.code, committee.dbChairJoinSuffix ?? undefined);
      setPhaseInDB(committee.id, 'unmoderated-caucus', committee.code, committee.dbChairJoinSuffix ?? undefined);
      return;

    } else if (motion.type === 'moderated') {
      const caucus = {
        active: true, type: 'moderated' as const, motionLabel: typeMeta['moderated'].label,
        purpose: motion.topic || '', proposedBy: motion.proposedBy,
        totalTime: motion.totalTime, remainingTime: motion.totalTime,
        speakingTime: motion.speakingTime, speakerTimeRemaining: motion.speakingTime,
        currentSpeaker: null, proposerPosition: null, spokenCountries: [],
        totalStartedAt: null,   // paused until the chair starts the first speaker
      };
      update((c) => ({ ...c, phase: 'moderated-caucus', caucus, pendingMotions: (c.pendingMotions ?? []).filter((m) => m.id !== motion.id), caucusQueue: [], currentSpeaker: null }));
      onClose();
      clearFloorForCaucus();
      removePendingMotionInDB(motion.id, committee.code, committee.dbChairJoinSuffix ?? undefined);
      clearCaucusListInDB(committee.id, committee.code, committee.dbChairJoinSuffix ?? undefined);
      updateCaucusInDB(committee.id, caucus, committee.code, committee.dbChairJoinSuffix ?? undefined);
      setPhaseInDB(committee.id, 'moderated-caucus', committee.code, committee.dbChairJoinSuffix ?? undefined);
      return;

    } else if (motion.type === 'tour') {
      // Tour de Table, all present delegates ordered by tourOrder
      // GSL is NEVER touched, tour uses caucusQueue exclusively
      const tourOrder = motion.tourOrder ?? 'asc';   // explicit default, never silently desc
      const alphabetical = committee.delegates
        .filter((d) => d.status !== 'absent')
        .sort((a, b) => compareCountryNames(a.country, b.country, language));

      if (tourOrder === 'custom') {
        // Room Order, empty queue, chair calls speakers manually
        const n = alphabetical.length;
        const totalTourTime = n * motion.speakingTime;
        const caucus = {
          active: true, type: 'moderated' as const, motionLabel: typeMeta['tour'].label,
          purpose: 'Tour de Table (Room Order)',
          proposedBy: motion.proposedBy, totalTime: totalTourTime, remainingTime: totalTourTime,
          speakingTime: motion.speakingTime, speakerTimeRemaining: motion.speakingTime,
          currentSpeaker: null, proposerPosition: null, spokenCountries: [],
          totalStartedAt: null,   // paused until the chair starts the first speaker
        };
        // Numbered placeholder queue, "Speaker 1", "Speaker 2", etc.
        const caucusQueue = alphabetical.map((_, i) => ({
          delegateId: `room-order-${i + 1}`,
          country: `Speaker ${i + 1}`,
        }));
        update((c) => ({ ...c, phase: 'moderated-caucus', caucus, pendingMotions: (c.pendingMotions ?? []).filter((m) => m.id !== motion.id), caucusQueue, currentSpeaker: null }));
        onClose();
        clearFloorForCaucus();
        removePendingMotionInDB(motion.id, committee.code, committee.dbChairJoinSuffix ?? undefined);
        updateCaucusInDB(committee.id, caucus, committee.code, committee.dbChairJoinSuffix ?? undefined);
        setPhaseInDB(committee.id, 'moderated-caucus', committee.code, committee.dbChairJoinSuffix ?? undefined);
        clearCaucusListInDB(committee.id, committee.code, committee.dbChairJoinSuffix ?? undefined).then(() =>
          batchAddToCaucusListInDB(committee.id, caucusQueue, committee.code, committee.dbChairJoinSuffix ?? undefined)
        );
        return;
      }

      const sorted = committee.delegates
        .filter((d) => d.status !== 'absent')
        .sort((a, b) => tourOrder === 'asc'
          ? compareCountryNames(a.country, b.country, language)
          : compareCountryNames(b.country, a.country, language));
      const proposerIdx = sorted.findIndex((d) => d.country === motion.proposedBy);
      const presentDelegates = proposerIdx >= 0
        ? [...sorted.slice(proposerIdx), ...sorted.slice(0, proposerIdx)]
        : sorted;

      const totalTourTime = presentDelegates.length * motion.speakingTime;
      const caucus = {
        active: true, type: 'moderated' as const, motionLabel: typeMeta['tour'].label,
        purpose: `Tour de Table (${tourOrder === 'desc' ? 'Z→A' : 'A→Z'})`,
        proposedBy: motion.proposedBy, totalTime: totalTourTime, remainingTime: totalTourTime,
        speakingTime: motion.speakingTime, speakerTimeRemaining: motion.speakingTime,
        currentSpeaker: null, proposerPosition: null, spokenCountries: [],
        totalStartedAt: null,   // paused until the chair starts the first speaker
      };
      const caucusQueue = presentDelegates.map((d) => ({ delegateId: d.id, country: d.country }));

      // GSL preserved, caucusQueue filled with ordered delegates
      update((c) => ({ ...c, phase: 'moderated-caucus', caucus, pendingMotions: (c.pendingMotions ?? []).filter((m) => m.id !== motion.id), caucusQueue, currentSpeaker: null }));
      onClose();
      clearFloorForCaucus();
      removePendingMotionInDB(motion.id, committee.code, committee.dbChairJoinSuffix ?? undefined);
      updateCaucusInDB(committee.id, caucus, committee.code, committee.dbChairJoinSuffix ?? undefined);
      setPhaseInDB(committee.id, 'moderated-caucus', committee.code, committee.dbChairJoinSuffix ?? undefined);
      // Await clear before insert to prevent race condition (DELETE winning after INSERT)
      clearCaucusListInDB(committee.id, committee.code, committee.dbChairJoinSuffix ?? undefined).then(() =>
        batchAddToCaucusListInDB(
          committee.id,
          presentDelegates.map((d) => ({ delegateId: d.id, country: d.country })),
          committee.code,
          committee.dbChairJoinSuffix ?? undefined,
        )
      );
      return;
    }
  };

  // ── Special vote: "Does this motion pass?" ──────────────────────────────────
  if (specialVoteMotion) {
    const isSuspend = specialVoteMotion.type === 'suspend-debate';
    return (
      <Portal><div className="fixed inset-0 z-[60] bg-[#F6F1E9] flex flex-col items-center justify-center text-center px-8">
        <p className="text-xs font-mono tracking-widest text-[#9A8A78] mb-6">
          {(typeMeta[specialVoteMotion.type]?.label ?? specialVoteMotion.type).toUpperCase()} · {specialVoteMotion.proposedBy === CHAIR_KEY ? chairDisplayName(language) : getCountryDisplayName(specialVoteMotion.proposedBy, language)}
        </p>
        <h1 className="text-4xl font-black mb-14 tracking-wide" style={{ color: '#1B3828', fontFamily: "'Outfit', sans-serif" }}>{t('motions_does_pass')}</h1>
        <div className="flex gap-8">
          <button
            onClick={async () => {
              const motionId = specialVoteMotion!.id;
              if (!motionId.startsWith('temp-')) {
                await removePendingMotionInDB(motionId, committee.code, committee.dbChairJoinSuffix ?? undefined);
              }
              update((c) => ({ ...c, pendingMotions: (c.pendingMotions ?? []).filter((m) => m.id !== motionId) }));
              if (isSuspend) {
                onCommitteeUpdate?.((c) => ({ ...c, suspendedAt: new Date().toISOString(), phase: 'adjourned' as const }));
                suspendDebateInDB(committee.id, committee.code, committee.dbChairJoinSuffix ?? undefined);
              } else {
                const now = new Date();
                const expires = new Date(now.getTime() + 1 * 60 * 60 * 1000);
                onCommitteeUpdate?.((c) => ({ ...c, endedAt: now.toISOString(), expiresAt: expires.toISOString(), phase: 'adjourned' as const }));
                endDebateInDB(committee.id, committee.code, committee.dbChairJoinSuffix ?? undefined);
              }
              setSpecialVoteMotion(null);
              onClose();
            }}
            className="px-16 py-8 rounded-3xl text-white text-2xl font-black transition-colors focus:outline-none" style={{ backgroundColor: '#1B3828', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.05em' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}>
            {t('motions_yes')}
          </button>
          <button
            onClick={() => {
              const motionId = specialVoteMotion.id;
              removePendingMotionInDB(motionId, committee.code, committee.dbChairJoinSuffix ?? undefined);
              update((c) => ({ ...c, pendingMotions: (c.pendingMotions ?? []).filter((m) => m.id !== motionId) }));
              setSpecialVoteMotion(null);
              onClose();
            }}
            className="px-16 py-8 rounded-3xl text-white text-2xl font-black transition-colors focus:outline-none" style={{ backgroundColor: '#8B2020', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.05em' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#7A1C1C'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#8B2020'; }}>
            {t('motions_no')}
          </button>
        </div>
      </div></Portal>
    );
  }

  return (
    <Portal><div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(5, 8, 20, 0.88)', backdropFilter: 'blur(4px)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[#FAF8F3] border border-[#DDD4C0] rounded-3xl w-full shadow-2xl overflow-hidden flex flex-col max-w-5xl" style={{ height: '88%' }}>
        <div className="flex items-center justify-end px-7 pt-6 pb-0 shrink-0">
          <button onClick={onClose} className="text-[#9A8A78] hover:text-[#1C1410] transition-colors text-xl leading-none">✕</button>
        </div>
        <div className="flex-1 min-h-0 pt-2 flex flex-col">
          {view === 'raise' && (
            <RaiseMotionForm
              committee={committee}
              typeMeta={typeMeta}
              onBack={() => { setEditingMotionId(null); setView(pending.length > 0 ? 'vote' : 'list'); }}
              onRaised={editingMotionId ? handleEdited : handleRaised}
              editingMotion={editingMotionId ? ((committee.pendingMotions ?? []).find((m) => m.id === editingMotionId) ?? null) : null}
              belowQuorum={belowQuorum}
              isViewOnly={isViewOnly}
            />
          )}
          {view === 'vote' && (
            <VotingView
              committee={committee}
              typeMeta={typeMeta}
              onAccepted={handleMotionAccepted}
              onAllDone={() => { setView('list'); onClose(); }}
              onRemove={handleRemove}
              onBack={() => setView('raise')}
              onEdit={(motionId) => { setEditingMotionId(motionId); setView('raise'); }}
              pendingIds={pendingIds}
              isViewOnly={isViewOnly}
              rank={rankMotion}
            />
          )}
          {view === 'list' && (
            <div className="px-7 pb-7 space-y-4">
              <h2 className="text-3xl font-black text-[#1C1410]">{t('motions_title')}</h2>
              {pending.length === 0 ? (
                <div className="text-center py-8">
                  <div className="mb-3"><Emoji size="2.5rem">📋</Emoji></div>
                  <p className="text-[#6A5A4A]">{t('motions_no_raised')}</p>
                  <p className="text-sm text-[#9A8A78] mt-1">{t('motions_floor_open')}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-[#9A8A78] font-mono">{t('motions_ranked')}</p>
                  {pending.map((m, i) => {
                    const meta = typeMeta[m.type];
                    if (!meta) return null;
                    const mins = Math.floor(m.totalTime / 60);
                    const secs = m.totalTime % 60;
                    const proposerFlag = m.proposedBy ? getCountryByName(m.proposedBy) : null;
                    const rowIsCustom = m.type === 'custom';
                    return (
                      <div key={m.id} className="rounded-xl px-4 py-4" style={rowIsCustom
                        ? { backgroundColor: '#F3EFE4', border: '1px dashed #C5B9A8' }
                        : { backgroundColor: '#EDE7D8', border: '1px solid #DDD4C0' }}>
                        <div className="flex items-start gap-3">
                          <span className="text-xs text-[#9A8A78] font-mono w-4 mt-1">{i + 1}</span>
                          <Emoji size="1.5rem">{meta.icon}</Emoji>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-base font-black text-[#1C1410] break-words min-w-0">{motionDisplayLabel(m, typeMeta, language)}</span>
                              <DisruptivenessBadge type={m.type} />
                            </div>
                            {(m.proposedBy || !rowIsCustom) && (
                              <div className="flex items-center gap-1.5 mt-1">
                                {m.proposedBy === CHAIR_KEY
                                  ? <span className="text-base leading-none">🪑</span>
                                  : proposerFlag ? <img src={getFlagUrl(proposerFlag.code)} alt={proposerFlag.code} className="w-5 h-5 object-contain inline-block" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} /> : <Emoji size="1rem">🌐</Emoji>}
                                <span className="text-sm font-semibold text-[#1C1410]">{m.proposedBy === CHAIR_KEY ? chairDisplayName(language) : getCountryDisplayName(m.proposedBy, language)}</span>
                              </div>
                            )}
                            {rowIsCustom && !m.proposedBy && (
                              <p className="text-sm font-semibold mt-1" style={{ color: '#9A8A78' }}>{noProposerLabel(language)}</p>
                            )}
                            {rowIsCustom && <div className="mt-2"><CustomNoOpNotice compact /></div>}
                            {m.topic && !rowIsCustom && <p className="text-sm text-[#6A5A4A] mt-1 font-medium">"{m.topic}"</p>}
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                              {m.type !== 'tour' && m.totalTime > 0 && (
                                <span className="text-xs font-bold text-[#1B3828] bg-[#FAF8F3] border border-[#DDD4C0] px-2 py-0.5 rounded-md">
                                  {mins > 0 ? `${mins}m` : ''}{secs > 0 ? ` ${secs}s` : ''} {t('motions_total_label')}
                                </span>
                              )}
                              {m.type === 'moderated' && m.speakingTime > 0 && (
                                <span className="text-xs font-bold text-[#2A5A3C] bg-[#FAF8F3] border border-[#DDD4C0] px-2 py-0.5 rounded-md">
                                  {m.speakingTime}{t('motions_s_per_speaker')}
                                </span>
                              )}
                              {m.type === 'tour' && (
                                <>
                                  <span className="text-xs font-bold text-[#1B3828] bg-[#FAF8F3] border border-[#DDD4C0] px-2 py-0.5 rounded-md">
                                    {m.speakingTime}{t('motions_s_per_delegate')}
                                  </span>
                                  <span className="text-xs font-bold text-[#6A5A4A] bg-[#FAF8F3] border border-[#DDD4C0] px-2 py-0.5 rounded-md">
                                    {m.tourOrder === 'desc' ? 'Z→A' : 'A→Z'}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                          <button onClick={() => handleRemove(m.id)} className="text-[#9A8A78] hover:text-[#8B2020] text-sm transition-colors mt-0.5">✕</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setView('raise')}
                  className="flex-1 bg-[#EDE7D8] hover:bg-[#DDD4C0] border border-[#DDD4C0] hover:border-[#1B3828] text-[#1C1410] py-3.5 rounded-2xl font-bold transition-all">
                  {t('motions_raise_list_btn')}
                </button>
                {pending.length > 0 && (
                  <button onClick={() => setView('vote')}
                    className="flex-1 bg-[#1B3828] hover:bg-[#2A5A3C] text-white py-3.5 rounded-2xl font-black transition-colors">
                    {t('motions_vote_list_btn')}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div></Portal>
  );
}