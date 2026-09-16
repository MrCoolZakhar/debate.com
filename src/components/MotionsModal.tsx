'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Portal from '@/components/Portal';
import GrowDialog from '@/components/GrowDialog';
import { portalFrame } from '@/components/chat/chatTokens';
import { useT, useLanguage } from '@/contexts/LanguageContext';
import { Committee, PendingMotion, PendingMotionType } from '@/lib/types';
import { getCountryByName, getCountryDisplayName, compareCountryNames, matchesCountryQuery, startsWithCountryQuery } from '@/lib/countries';
import { SeatFlag } from '@/components/SeatFlag';

const SQUARE_FLAGS = new Set(['CH', 'NP']);
import { Emoji } from '@/components/Emoji';
import { useSettingsStore, DEFAULT_MOTION_NAMES, MotionNames } from '@/lib/settingsStore';
import { logFloorSpeech, creditRoomOrderTour, type FloorClock } from '@/lib/floorSpeech';
import {
  useTempMotionIds, isTempMotionId, raiseMotionOptimistic, removeMotionEverywhere,
  fellOtherFloorMotions, showMotionNotice,
} from '@/lib/motionFlight';
import {
  removePendingMotion as removePendingMotionInDB,
  setPhaseAndCaucus as setPhaseAndCaucusInDB,
  addToCaucusList as addToCaucusListInDB,
  batchAddToCaucusList as batchAddToCaucusListInDB,
  clearCaucusList as clearCaucusListInDB,
  suspendDebate as suspendDebateInDB,
  endDebate as endDebateInDB,
  clearCurrentSpeakerIfUnchanged,
  logEvent,
  caucusQueueCapacity,
} from '@/lib/committeeService';
import { serverNow, serverNowIso } from '@/lib/serverClock';
import { UnknownSeatIcon } from '@/components/UnknownSeatIcon';

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

/** Every motion the chair votes on (floor motions AND Custom), never join / GSL requests. */
const isVotableMotion = (m: PendingMotion) =>
  (m.type as string) !== 'join-request' && (m.type as string) !== 'gsl-request';

/** The most motions that may wait on the floor at once. Enforced when raising (client only:
 *  there is no database limit). Editing a motion already on the floor is always allowed. */
export const MAX_FLOOR_MOTIONS = 15;
/** Motions shown as normal ranked cards in the voting view: the one being voted on plus the
 *  queue column beside it. With more than this, the queue column scrolls in place (the modal
 *  keeps its size). Five fits a 1280x800 laptop without scrolling. */
const RANKED_VISIBLE = 5;


function requiredVotes(type: PendingMotionType, present: number): { needed: number; fraction: string } {
  if (type === 'consultation' || type === 'tour') return { needed: Math.ceil((present * 2) / 3), fraction: '2/3 majority' };
  return { needed: Math.floor(present / 2) + 1, fraction: 'Simple majority' };
}

function DisruptivenessBadge({ type }: { type: PendingMotionType }) {
  const t = useT();
  const labels: Record<PendingMotionType, string> = {
    'end-debate': t('motions_badge_ends'), 'suspend-debate': t('motions_badge_suspends'),
    consultation: t('motions_badge_most'), tour: t('motions_badge_very'),
    unmoderated: t('motions_badge_disruptive'), moderated: t('motions_badge_least'),
    custom: '',
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
  // A Custom motion carries no badge: it has no place in the disruptiveness ranking.
  if (!labels[type]) return null;
  return <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${colors[type]}`}>{labels[type]}</span>;
}

/** Informational "i" affordance. Opens on HOVER and on FOCUS (never on click),
 *  per the house UI rules, and is portaled at fixed viewport coordinates with
 *  edge flipping so a scrollable modal body can never clip it. */
function InfoHint({ label, text }: { label: string; text: string }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number; flipped: boolean } | null>(null);
  const tipId = React.useId();

  const WIDTH = 288;
  // Portal mounts into the transformed `#fit-root`, so the fixed layer is positioned in that
  // element's local units — raw viewport pixels would land off-anchor and flip against the
  // wrong edges. portalFrame() converts the trigger box AND the usable bounds into that space.
  const place = useCallback(() => {
    const b = btnRef.current;
    if (!b) return;
    const r = b.getBoundingClientRect();
    const f = portalFrame();
    const M = 8;
    const top0 = f.toLocalY(r.top);
    const bottom0 = f.toLocalY(r.bottom);
    const maxLeft = Math.max(f.minX + M, f.maxX - WIDTH - M);
    const left = Math.min(Math.max(f.minX + M, f.toLocalX(r.left)), maxLeft);
    const spaceBelow = f.maxY - bottom0;
    const spaceAbove = top0 - f.minY;
    const flipped = spaceBelow < 150 && spaceAbove > spaceBelow;
    setPos({ top: flipped ? top0 - 8 : bottom0 + 8, left, flipped });
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
        ref={btnRef} type="button" tabIndex={0} aria-label={label} aria-describedby={open ? tipId : undefined}
        onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}
        onClick={(e) => e.preventDefault()}
        className="shrink-0 w-[18px] h-[18px] rounded-full inline-flex items-center justify-center text-[11px] font-black leading-none transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EED98A] gv-lift"
        style={{ border: '1px solid #C5B9A8', color: '#6A5A4A', backgroundColor: '#FAF8F3', fontFamily: 'Georgia, serif' }}
      >
        i
      </button>
      {open && pos && (
        <Portal>
          <div
            id={tipId} role="tooltip"
            onMouseEnter={show} onMouseLeave={hide}
            className="fixed z-[70] rounded-2xl px-4 py-3"
            style={{
              top: pos.top, left: pos.left, width: WIDTH,
              transform: pos.flipped ? 'translateY(-100%)' : undefined,
              backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0',
              boxShadow: '0 10px 30px rgba(28,20,16,0.18), 0 2px 6px rgba(28,20,16,0.08)',
            }}
          >
            <p className="text-xs leading-relaxed font-semibold" style={{ color: '#1B3828' }}>{text}</p>
          </div>
        </Portal>
      )}
    </>
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
  // Prefix hits first, then substring hits — via the shared country helpers, so
  // the match folds diacritics ("Turkiye" finds "Türkiye") and honours the
  // translated name in every locale. Never re-hand-roll this on `dName`.
  const delegateMatches = q
    ? candidates.filter((c) => c !== CHAIR_KEY && startsWithCountryQuery(c, q, language))
        .concat(candidates.filter((c) => c !== CHAIR_KEY && !startsWithCountryQuery(c, q, language) && matchesCountryQuery(c, q, language)))
    : [];
  const matches = showChair ? [CHAIR_KEY, ...delegateMatches] : delegateMatches;
  const top = matches[0] ?? null;
  const commit = (country: string) => {
    if (blockedCountries?.has(country)) return;
    onChange(country); setQuery(dName(country)); setOpen(false);
  };

  // The modal body is `overflow-y-auto`, so an in-flow absolute dropdown gets
  // clipped. Render it through a Portal at fixed coordinates measured from the
  // field, repositioned on scroll (capture) + resize, flipping upward and
  // clamping horizontally near the edges. Coordinates go through portalFrame()
  // because Portal mounts into the transformed `#fit-root`, whose local units
  // are not viewport pixels.
  const LIST_MAX_H = 192;
  const place = useCallback(() => {
    const w = wrapRef.current;
    if (!w) return;
    const r = w.getBoundingClientRect();
    const f = portalFrame();
    const M = 8;
    const left0 = f.toLocalX(r.left);
    const top0 = f.toLocalY(r.top);
    const bottom0 = f.toLocalY(r.bottom);
    const width = Math.min(f.toLocalX(r.right) - left0, Math.max(0, f.maxX - f.minX - 2 * M));
    const maxLeft = Math.max(f.minX + M, f.maxX - width - M);
    const left = Math.min(Math.max(f.minX + M, left0), maxLeft);
    const spaceBelow = f.maxY - bottom0;
    const flipped = spaceBelow < LIST_MAX_H + 16 && top0 - f.minY > spaceBelow;
    setPos({ top: flipped ? top0 - 4 : bottom0 + 4, left, width, flipped });
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
            : <SeatFlag country={value} style={{ width: 28, height: 20, borderRadius: '6px', border: '1.5px solid rgba(28,20,16,0.10)', objectFit: 'cover' }} className="inline-block" fallback={null} />}
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
                    : <SeatFlag country={country} size={20} className="object-contain inline-block" fallback={<UnknownSeatIcon size={20} />} />}
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
function RaiseMotionForm({ committee, typeMeta, onBack, onRaised, editingMotion, belowQuorum = false, isViewOnly = false, floorFull = false }: {
  committee: Committee;
  typeMeta: TypeMeta;
  onBack: () => void;
  onRaised: (motion: Omit<PendingMotion, 'id' | 'disruptiveness'>) => void;
  editingMotion?: PendingMotion | null;
  belowQuorum?: boolean;
  isViewOnly?: boolean;
  /** MAX_FLOOR_MOTIONS are already waiting. Raising is refused; editing one is not. */
  floorFull?: boolean;
}) {
  const t = useT();
  const { language } = useLanguage();
  const { getSettings } = useSettingsStore();
  const s = getSettings(committee.code);
  const raiseBlocked = floorFull && !editingMotion;
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

  // Any time left over is one more (shorter) speaker, not unused time: the chair can queue a
  // delegate whenever committed time is below the remaining total, and that last speaker's
  // clock is capped to what is left. Same rule as caucusQueueCapacity on the chair page.
  const speakerCount = (totalTime > 0 && speakingTime > 0) ? caucusQueueCapacity(totalTime, speakingTime, 0, 0) : null;
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
                className={`gv-lift px-3 py-2 rounded-xl border font-bold text-base transition-all flex-1 min-w-[120px] ${
                  type === motionType ? 'bg-[#1B3828] border-[#2A5A3C] text-white' : 'bg-transparent border-[#DDD4C0] text-[#6A5A4A] hover:border-[#1B3828]'
                }`}>
                {typeMeta[motionType].label}
              </button>
            ))}
          </div>
          {/* Special debate control buttons, half size, red, stacked */}
          <div className="flex flex-col gap-1 self-stretch">
            <button type="button" onClick={() => setType('suspend-debate')}
              className={`gv-lift px-2 flex-1 rounded-lg border text-xs font-bold transition-colors ${type === 'suspend-debate' ? 'bg-[#8B2020] border-red-700 text-white' : 'border-[#8B2020]/40 bg-[#8B2020]/20 text-[#8B2020] hover:bg-[#8B2020]/20'}`}>
              {t('motions_suspend')}
            </button>
            <button type="button" onClick={() => setType('end-debate')}
              className={`gv-lift px-2 flex-1 rounded-lg border text-xs font-bold transition-colors ${type === 'end-debate' ? 'bg-[#8B2020] border-red-700 text-white' : 'border-[#8B2020]/40 bg-[#8B2020]/20 text-[#8B2020] hover:bg-[#8B2020]/20'}`}>
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
                          className={`gv-lift text-xs px-2.5 py-1 rounded-lg transition-colors focus:outline-none ${speakingTime === t ? 'bg-[#1B3828] text-white font-bold' : 'bg-transparent border border-[#DDD4C0] text-[#6A5A4A] hover:text-[#1B3828]'}`}>
                          {t}s
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-[#6A5A4A] mb-1">{t('motions_speaking_order')}</label>
                    <div className="flex gap-3">
                      <button onClick={() => setTourOrder('asc')}
                        className={`gv-lift flex-1 py-2 rounded-xl font-bold text-sm transition-colors focus:outline-none ${tourOrder === 'asc' ? 'bg-[#1B3828] text-white' : 'bg-transparent border border-[#DDD4C0] text-[#6A5A4A] hover:text-[#1B3828]'}`}>
                        {t('motions_az')}
                      </button>
                      <button onClick={() => setTourOrder('desc')}
                        className={`gv-lift flex-1 py-2 rounded-xl font-bold text-sm transition-colors focus:outline-none ${tourOrder === 'desc' ? 'bg-[#1B3828] text-white' : 'bg-transparent border border-[#DDD4C0] text-[#6A5A4A] hover:text-[#1B3828]'}`}>
                        {t('motions_za')}
                      </button>
                      <button onClick={() => setTourOrder('custom')}
                        className={`gv-lift flex-1 py-2 rounded-xl font-bold text-sm transition-colors focus:outline-none ${tourOrder === 'custom' ? 'bg-[#1B3828] text-white' : 'bg-transparent border border-[#DDD4C0] text-[#6A5A4A] hover:text-[#1B3828]'}`}>
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
                      className={`gv-lift text-xs px-2.5 py-1.5 rounded-lg transition-colors ${totalMins === m && totalSecs === 0 ? 'bg-[#1B3828] text-white font-bold' : 'bg-[#EDE7D8] border border-[#DDD4C0] text-[#6A5A4A] hover:text-[#1B3828]'}`}>
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
                          className={`gv-lift text-xs px-2 py-1 rounded-lg transition-colors ${totalMins === m && totalSecs === 0 ? 'bg-[#1B3828] text-white font-bold' : 'bg-[#EDE7D8] border border-[#DDD4C0] text-[#6A5A4A] hover:text-[#1B3828]'}`}>
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
                          className={`gv-lift text-xs px-2 py-1 rounded-lg transition-colors ${speakingTime === t ? 'bg-[#1B3828] text-white font-bold' : 'bg-[#EDE7D8] border border-[#DDD4C0] text-[#6A5A4A] hover:text-[#1B3828]'}`}>
                          {t}s
                        </button>
                      ))}
                    </div>
                    {speakerCount !== null && (
                      <div className="mt-3 rounded-lg bg-white border border-[#DDD4C0] px-3 py-2 inline-flex items-baseline gap-1.5">
                        <span className="font-black text-xl leading-tight" style={{ color: '#1B3828' }}>{speakerCount}</span>
                        <span className="text-sm font-semibold" style={{ color: '#6A5A4A' }}>{speakerCount === 1 ? t('motions_delegate_speak').replace('{s}', t('motions_delegate_singular')) : t('motions_delegate_speak').replace('{s}', t('motions_delegate_plural'))}</span>
                        {unusedSecs > 0 && (
                          <span className="text-xs font-semibold ms-1" style={{ color: '#B8844A' }}>{t('motions_last_speaker_secs').replace('{n}', String(unusedSecs))}</span>
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
        // The form scrolls behind this footer, so the footer needs its own ground and a visible
        // hairline: `border-white/10` on ivory drew nothing, and the fields ran into the button.
        <div className="px-7 pb-7 pt-3 shrink-0 bg-[#FAF8F3]" style={{ boxShadow: '0 -1px 0 #DDD4C0, 0 -10px 16px -12px rgba(27,56,40,0.30)' }}>
          {belowQuorum && (
            <div className="mb-4 p-3 bg-[#8B2020]/20 border border-[#8B2020]/40 rounded-xl text-xs text-[#8B2020]">
              ⚠️ {t('motions_quorum_warning')}
            </div>
          )}
          {raiseBlocked && (
            <p role="status" className="mb-3 p-3 rounded-xl text-sm font-semibold" style={{ color: '#8B2020', backgroundColor: 'rgba(139,32,32,0.08)', border: '1px solid rgba(139,32,32,0.25)' }}>
              {t('motions_floor_full', { n: MAX_FLOOR_MOTIONS })}
            </p>
          )}
          {error && <p className="text-[#8B2020] text-sm font-medium mb-3">{error}</p>}
          {!isViewOnly && (
            <button onClick={submit} disabled={!canSubmit() || belowQuorum || raiseBlocked}
              className="w-full bg-[#1B3828] hover:bg-[#2A5A3C] disabled:bg-[#DDD4C0] disabled:text-[#9A8A78] text-white py-5 rounded-2xl text-base font-black transition-colors focus:outline-none gv-lift" style={{ letterSpacing: '0.05em' }}>
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
  pendingIds: ReadonlySet<string>;
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
  // Fades on the overflow column say "there is more" without a visible scrollbar. Updated
  // only when a value actually flips, so scrolling does not re-render the modal per frame.
  const overflowRef = useRef<HTMLDivElement | null>(null);
  const [overflowFade, setOverflowFade] = useState<{ top: boolean; bottom: boolean }>({ top: false, bottom: false });
  const extrasCount = Math.max(0, order.length - RANKED_VISIBLE);
  /** MEASURED, never counted (16 Sep 2026). This used to be `extrasCount > 0`, so with five or
   *  fewer motions the queue column got no `overflow-y-auto` at all: on a short window, or with
   *  tall cards (a long Custom name, a topic, a Tour de Table's two badges), the cards ran past
   *  the column and over the Raise a Motion button below it. The button is outside the scroller,
   *  so nothing can overlap it now, whatever the motion count. */
  const [scrolls, setScrolls] = useState(false);
  const measureOverflow = useCallback(() => {
    const el = overflowRef.current;
    if (!el) return;
    const over = el.scrollHeight > el.clientHeight + 2;
    setScrolls((prev) => (prev === over ? prev : over));
    const top = over && el.scrollTop > 2;
    const bottom = over && el.scrollTop + el.clientHeight < el.scrollHeight - 2;
    setOverflowFade((prev) => (prev.top === top && prev.bottom === bottom ? prev : { top, bottom }));
  }, []);
  useEffect(() => { measureOverflow(); }, [extrasCount, measureOverflow]);
  // The column's height moves with the window, and a card's height with its own content, so the
  // fades and the scroll affordance are re-measured for both.
  useEffect(() => {
    const el = overflowRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => measureOverflow());
    ro.observe(el);
    for (const child of Array.from(el.children)) ro.observe(child);
    return () => ro.disconnect();
  }, [measureOverflow, extrasCount]);

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

  // OBSERVERS COUNT ON A MOTION (16 Sep 2026). A motion is procedure, not the final
  // substantive vote: an observer sitting in the room is part of the body deciding how the
  // room runs, so the threshold is measured against everyone present. Only the ballot on
  // /voting/[code] excludes them. The chair page's quorum rings and `belowQuorum` count the
  // same way.
  const present = committee.delegates.filter((d) => d.status !== 'absent').length;

  if (order.length === 0) {
    return (
      <div className="px-7 pb-7 text-center py-8">
        <p className="text-[#6A5A4A]">{t('motions_no_vote')}</p>
        <button onClick={onAllDone} className="mt-4 text-sm text-[#B6871F] hover:text-[#EED98A]">{t('motions_back')}</button>
      </div>
    );
  }

  const primary = order[0];
  // Every motion below the primary lives in the right column. Nothing is ever hidden: past
  // RANKED_VISIBLE the column scrolls in place instead of opening a side column.
  const rest = order.slice(1);
  const floorFull = order.length >= MAX_FLOOR_MOTIONS;

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
    // M-2: while the INSERT is still in flight the id is `temp-...`. EVERY action is held
    // back until the real UUID lands: a delete issued with a temp id deletes nothing, so an
    // accept, reject, edit or suspend "No" in that window left the real row to come back.
    const acceptBlocked = pendingIds.has(m.id) || isTempMotionId(m.id);

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
                onClick={(e) => { e.stopPropagation(); if (!acceptBlocked) onEdit(m.id); }}
                disabled={acceptBlocked}
                title={acceptBlocked ? t('motions_saving') : 'Edit motion'}
                className={`opacity-40 hover:opacity-80 transition-opacity focus:outline-none shrink-0 ${acceptBlocked ? 'cursor-not-allowed' : ''}`}
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
            : <SeatFlag country={m.proposedBy} style={{ width: large ? 56 : 32, height: large ? 40 : 24, borderRadius: '8px', border: f && SQUARE_FLAGS.has(f.code) ? 'none' : '1.5px solid rgba(28,20,16,0.10)', objectFit: 'cover' }} className="inline-block" fallback={null} />}
        </div>

        {/* Custom motion with no proposer: say so, since there is no flag */}
        {isCustom && !m.proposedBy && (
          <span className={`${large ? 'text-sm' : 'text-xs'} font-semibold`} style={{ color: '#9A8A78' }}>{noProposerLabel(language)}</span>
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
                    <span className="font-black">{caucusQueueCapacity(m.totalTime, m.speakingTime, 0, 0)} {caucusQueueCapacity(m.totalTime, m.speakingTime, 0, 0) === 1 ? t('motions_speaker_singular') : t('motions_speaker_plural')}{m.totalTime % m.speakingTime !== 0 ? ' ⚠' : ''}</span>
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
                    <span className="font-black">{caucusQueueCapacity(m.totalTime, m.speakingTime, 0, 0)} {caucusQueueCapacity(m.totalTime, m.speakingTime, 0, 0) === 1 ? t('motions_speaker_singular') : t('motions_speaker_plural')}{m.totalTime % m.speakingTime !== 0 ? ' ⚠' : ''}</span>
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
              title={acceptBlocked ? t('motions_saving') : undefined}
              className={`gv-lift flex-1 bg-[#2A5A3C] hover:bg-[#3D7A52] text-white py-2.5 rounded-xl font-bold text-sm transition-colors focus:outline-none ${acceptBlocked ? 'opacity-40 cursor-not-allowed' : ''}`} style={{ fontFamily: "'Outfit', sans-serif", letterSpacing: '0.05em' }}>
              {isCustom ? clearFromFloorLabel(language) : t('motions_accept_btn')}
            </button>
            <button onClick={() => { if (!acceptBlocked) onRemove(m.id); }}
              disabled={acceptBlocked}
              className={`gv-lift flex-1 bg-[#DDD4C0] hover:bg-red-950/40 hover:text-[#8B2020] text-[#6A5A4A] border border-[#DDD4C0] hover:border-[#8B2020]/40 py-2.5 rounded-xl font-bold text-sm transition-colors focus:outline-none ${acceptBlocked ? 'opacity-40 cursor-not-allowed' : ''}`} style={{ fontFamily: "'Outfit', sans-serif", letterSpacing: '0.05em' }}>
              {t('motions_reject_btn')}
            </button>
            <button onClick={(e) => { e.stopPropagation(); if (!acceptBlocked) onEdit(m.id); }}
              disabled={acceptBlocked}
              title={acceptBlocked ? t('motions_saving') : 'Edit motion'}
              className="disabled:opacity-40 disabled:cursor-not-allowed bg-[#B6871F]/20 hover:bg-[#B6871F]/40 border border-[#B6871F]/50 hover:border-[#B6871F] text-[#B6871F] py-2.5 px-4 rounded-xl font-bold text-sm transition-colors shrink-0 focus:outline-none gv-lift" style={{ fontFamily: "'DM Mono', monospace" }}>
              {t('motions_edit_label')}
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="px-7 pb-7 space-y-3 flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-2.5 shrink-0">
        <h2 className="text-3xl font-black" style={{ color: '#1B3828' }}>{t('motions_vote_heading')}</h2>
        <InfoHint label={t('motions_drag_hint_label')} text={t('motions_drag_hint')} />
        <span className="ms-auto text-xs font-bold tabular-nums" style={{ color: floorFull ? '#8B2020' : '#9A8A78' }}>
          {order.length}/{MAX_FLOOR_MOTIONS}
        </span>
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
        {/* Right column, queued motions + Raise a Motion button. Past RANKED_VISIBLE motions
            the queued cards scroll inside this same column (hidden scrollbar, edge fades), so
            the modal never grows a side column or widens. Order, ranks and actions unchanged. */}
        <div className="w-72 shrink-0 flex flex-col min-h-0">
          <div className="relative flex-1 min-h-0 flex flex-col">
            <div
              ref={overflowRef}
              onScroll={measureOverflow}
              tabIndex={scrolls ? 0 : undefined}
              aria-label={scrolls ? (extrasCount > 0 ? t('motions_more_on_floor', { count: extrasCount }) : t('motions_vote_heading')) : undefined}
              className="flex-1 min-h-0 pt-3 pe-4 overflow-y-auto overscroll-contain pb-2 focus:outline-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
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
                </React.Fragment>
              ))}
            </div>
            {scrolls && (
              <>
                <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-6 transition-opacity duration-150"
                  style={{ opacity: overflowFade.top ? 1 : 0, background: 'linear-gradient(#FAF8F3, rgba(250,248,243,0))' }} />
                <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-10 flex items-end justify-center pb-1 transition-opacity duration-150"
                  style={{ opacity: overflowFade.bottom ? 1 : 0, background: 'linear-gradient(rgba(250,248,243,0), #FAF8F3 70%)' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="#6A5A4A" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
              </>
            )}
          </div>
          {rest.length > 0 && <div className="shrink-0" style={{ height: '6px' }} />}
          {!isViewOnly && (
            <div className="shrink-0 pe-4">
              <button
                onClick={onBack}
                disabled={floorFull}
                className="w-full bg-[#2A5A3C] hover:bg-[#3D7A52] disabled:bg-[#DDD4C0] disabled:text-[#9A8A78] disabled:cursor-not-allowed text-white py-3 rounded-2xl font-black text-sm transition-colors shrink-0 focus:outline-none gv-lift"
                style={{ letterSpacing: '0.05em' }}
              >
                {t('motions_raise_motion_btn')}
              </button>
              {floorFull && (
                <p role="status" className="mt-2 text-xs font-semibold text-center" style={{ color: '#8B2020' }}>
                  {t('motions_floor_full', { n: MAX_FLOOR_MOTIONS })}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Modal ────────────────────────────────────────────────────────────────
export default function MotionsModal({ committee, onClose, onCommitteeUpdate, belowQuorum = false, isViewOnly = false, floorClock }: {
  committee: Committee;
  onClose: () => void;
  onCommitteeUpdate?: (updater: (c: Committee) => Committee) => void;
  belowQuorum?: boolean;
  isViewOnly?: boolean;
  /** The chair page's live speaker clock (anchor + extra time), so a speech interrupted by
   *  a caucus, Suspend or End is logged from the real anchor (G-1). Without it the helper
   *  falls back to the committee row's own anchor and no extra time. */
  floorClock?: () => FloorClock;
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
  const floorFull = pending.length >= MAX_FLOOR_MOTIONS;
  const [view, setView] = useState<ModalView>(pending.length === 0 && !isViewOnly ? 'raise' : 'vote');
  const [specialVoteMotion, setSpecialVoteMotion] = useState<PendingMotion | null>(null);
  // M-2: temp ids live in a module-level store keyed by committee, not modal state, so
  // closing the modal mid-insert no longer forgets which motions are still saving.
  const pendingIds = useTempMotionIds(committee.id);
  const [editingMotionId, setEditingMotionId] = useState<string | null>(null);
  const update = (updater: (c: Committee) => Committee) => onCommitteeUpdate?.(updater);
  // The dialog's animated close while it is mounted; the fullscreen Suspend / End screen
  // replaces the dialog, so there it falls back to closing at once.
  const animatedCloseRef = useRef<(() => void) | null>(null);
  const close = () => (animatedCloseRef.current ?? onClose)();

  const handleRaised = (motion: Omit<PendingMotion, 'id' | 'disruptiveness'>) => {
    const existing = committee.pendingMotions ?? [];
    // Backstop for the disabled Raise button: the floor holds MAX_FLOOR_MOTIONS at most.
    if (existing.filter(isVotableMotion).length >= MAX_FLOOR_MOTIONS) return;
    if (motion.type === 'custom') {
      // Custom motions don't take a delegation's floor slot, so several may be
      // queued at once. Only a byte-identical one (same proposer AND same name)
      // is rejected — that also keeps every queued Custom motion distinguishable.
      if (existing.some((m) => m.type === 'custom' && m.proposedBy === motion.proposedBy && (m.topic ?? '') === motion.topic)) return;
    } else if (existing.some((m) => isFloorMotion(m) && m.proposedBy === motion.proposedBy)) {
      // One floor motion per delegation. This used to return silently, so the chair's
      // click simply did nothing. Say why.
      showMotionNotice(committee.id, { kind: 'blocked', country: motion.proposedBy === CHAIR_KEY ? chairDisplayName(language) : motion.proposedBy });
      return;
    }

    raiseMotionOptimistic({
      committee, motion, update, motionOrder,
      disruptiveness: localCalcDisruptiveness(motion.type, motion.totalTime),
    });

    setView('vote');
  };

  const handleRemove = (motionId: string) => {
    // Every remove affordance is disabled while the id is temporary (M-2); if one still
    // slips through, the store deletes the real row as soon as the insert returns.
    removeMotionEverywhere(committee, motionId, update);
  };

  const handleEdited = (motion: Omit<PendingMotion, 'id' | 'disruptiveness'>) => {
    if (!editingMotionId) return;
    const oldId = editingMotionId;

    // Remove old motion from local state immediately (same as handleRemove but inline
    // so committee.pendingMotions is clean before the re-add, avoiding the duplicate check)
    removeMotionEverywhere(committee, oldId, update);

    // Add replacement, same logic as handleRaised but NO duplicate check
    raiseMotionOptimistic({
      committee, motion, update, motionOrder,
      disruptiveness: localCalcDisruptiveness(motion.type, motion.totalTime),
    });

    setEditingMotionId(null);
    setView('vote');
  };

  const handleMotionAccepted = async (motion: PendingMotion) => {
    // When a caucus, Suspend or End passes, every OTHER pending floor motion FALLS: it is
    // deleted and a one-line notice offers Undo for ~8 s (fellOtherFloorMotions, M-1).
    // Custom motions never make anything fall. GSL (speakersList) is NEVER modified here.
    // Never act on a temp id (M-2): the buttons are disabled, this is the backstop.
    if (isTempMotionId(motion.id)) return;

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
      removePendingMotionInDB(motion.id, committee.code, committee.dbChairJoinSuffix ?? undefined);
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
    // G-1: the interrupted speaker's speech is logged BEFORE the floor is cleared, from the
    // anchor (idempotent per turn, Room Order placeholders skipped). The other floor motions
    // fall at the same moment.
    const clearFloorForCaucus = () => {
      fellOtherFloorMotions({ committee, passedId: motion.id, update, motionOrder, rank: rankMotion });
      // A Room Order Tour de Table this caucus replaces has ended: one speech per delegation
      // on its roster snapshot (idempotent per tour + country; no-op for any other caucus).
      void creditRoomOrderTour(committee);
      if (!floorSpeaker) return;
      void logFloorSpeech(committee, floorClock?.());
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
      setPhaseAndCaucusInDB(committee.id, 'unmoderated-caucus', caucus, committee.code, committee.dbChairJoinSuffix ?? undefined);   // one update (R-7)
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
      setPhaseAndCaucusInDB(committee.id, 'unmoderated-caucus', caucus, committee.code, committee.dbChairJoinSuffix ?? undefined);   // one update (R-7)
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
      setPhaseAndCaucusInDB(committee.id, 'moderated-caucus', caucus, committee.code, committee.dbChairJoinSuffix ?? undefined);   // one update (R-7)
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
          // Placeholders credit nobody per turn, so the room is snapshotted here and every
          // delegation on it gets ONE speech when the tour ends (creditRoomOrderTour).
          roomOrderCountries: alphabetical.map((d) => d.country),
          tourStartedAt: serverNowIso(),
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
        setPhaseAndCaucusInDB(committee.id, 'moderated-caucus', caucus, committee.code, committee.dbChairJoinSuffix ?? undefined);   // one update (R-7)
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
      setPhaseAndCaucusInDB(committee.id, 'moderated-caucus', caucus, committee.code, committee.dbChairJoinSuffix ?? undefined);   // one update (R-7)
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
    const specialBlocked = isTempMotionId(specialVoteMotion.id) || pendingIds.has(specialVoteMotion.id);
    return (
      <Portal><div className="fixed inset-0 z-[60] bg-[#F6F1E9] flex flex-col items-center justify-center text-center px-8">
        <p className="text-xs font-mono tracking-widest text-[#9A8A78] mb-6">
          {(typeMeta[specialVoteMotion.type]?.label ?? specialVoteMotion.type).toUpperCase()} · {specialVoteMotion.proposedBy === CHAIR_KEY ? chairDisplayName(language) : getCountryDisplayName(specialVoteMotion.proposedBy, language)}
        </p>
        <h1 className="text-4xl font-black mb-14 tracking-wide" style={{ color: '#1B3828', fontFamily: "'Outfit', sans-serif" }}>{t('motions_does_pass')}</h1>
        <div className="flex gap-8">
          <button
            disabled={specialBlocked}
            onClick={async () => {
              const motionId = specialVoteMotion!.id;
              if (isTempMotionId(motionId)) return;
              await removePendingMotionInDB(motionId, committee.code, committee.dbChairJoinSuffix ?? undefined);
              update((c) => ({ ...c, pendingMotions: (c.pendingMotions ?? []).filter((m) => m.id !== motionId) }));
              // M-1: the other floor motions fall. G-1: whoever held the floor has their speech
              // logged, then leaves it, so a resumed session cannot log the same turn again.
              fellOtherFloorMotions({ committee, passedId: motionId, passedType: specialVoteMotion!.type, update, motionOrder, rank: rankMotion });
              // End Debate ends a Room Order Tour de Table for good (Suspend only pauses it).
              if (!isSuspend) void creditRoomOrderTour(committee);
              const floor = committee.currentSpeaker;
              if (floor) {
                void logFloorSpeech(committee, floorClock?.());
                update((c) => ({ ...c, currentSpeaker: null }));
                clearCurrentSpeakerIfUnchanged(committee.id, floor.delegateId, floor.country, committee.code, committee.dbChairJoinSuffix ?? undefined);
              }
              // R-5: optimistic first (RULE 5), but remembered. Both writes are retried inside
              // runWrite and a real failure raises the chair page's "Not saved" toast; when they
              // resolve false the lifecycle fields are put back, so this laptop does not sit on
              // a suspended / ended screen while the room carries on. The chair page drops its
              // overlay when suspendedAt / endedAt return to null. Timestamps are on the
              // database clock (T-1).
              const before = {
                phase: committee.phase, suspendedAt: committee.suspendedAt ?? null,
                endedAt: committee.endedAt ?? null, expiresAt: committee.expiresAt ?? null,
              };
              const rollback = (ok: boolean) => { if (!ok) onCommitteeUpdate?.((c) => ({ ...c, ...before })); };
              if (isSuspend) {
                // S4: a caucus kept through the break keeps its queue, never its floor holder.
                onCommitteeUpdate?.((c) => ({
                  ...c, suspendedAt: serverNowIso(), phase: 'adjourned' as const,
                  caucus: c.caucus?.currentSpeaker ? { ...c.caucus, currentSpeaker: null } : c.caucus,
                }));
                void suspendDebateInDB(committee.id, committee.code, committee.dbChairJoinSuffix ?? undefined).then(rollback);
              } else {
                const nowMs = serverNow();
                // Mirrors endDebate()'s own +1h. If one is ever changed, change all three.
                const expires = new Date(nowMs + 1 * 60 * 60 * 1000);
                onCommitteeUpdate?.((c) => ({ ...c, endedAt: new Date(nowMs).toISOString(), expiresAt: expires.toISOString(), phase: 'adjourned' as const }));
                void endDebateInDB(committee.id, committee.code, committee.dbChairJoinSuffix ?? undefined).then(rollback);
              }
              setSpecialVoteMotion(null);
              onClose();
            }}
            className="px-16 py-8 rounded-3xl text-white text-2xl font-black transition-colors focus:outline-none gv-lift disabled:opacity-40 disabled:cursor-not-allowed" style={{ backgroundColor: '#1B3828', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.05em' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}>
            {t('motions_yes')}
          </button>
          <button
            disabled={specialBlocked}
            onClick={() => {
              const motionId = specialVoteMotion.id;
              if (isTempMotionId(motionId)) return;
              removeMotionEverywhere(committee, motionId, update);
              setSpecialVoteMotion(null);
              onClose();
            }}
            className="px-16 py-8 rounded-3xl text-white text-2xl font-black transition-colors focus:outline-none gv-lift disabled:opacity-40 disabled:cursor-not-allowed" style={{ backgroundColor: '#8B2020', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.05em' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#7A1C1C'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#8B2020'; }}>
            {t('motions_no')}
          </button>
        </div>
      </div></Portal>
    );
  }

  return (
    // Grows out of the Motions tab. Rendered from the committee already in memory: nothing
    // here waits on the network, so a slow connection cannot delay or stutter the opening.
    <GrowDialog
      originSelector='[data-tutorial="tab-motions"]'
      onClose={onClose}
      closeRef={animatedCloseRef}
      ariaLabel={t('tab_motions')}
      panelClassName={`bg-[#FAF8F3] border border-[#DDD4C0] rounded-3xl w-full shadow-2xl overflow-hidden flex flex-col max-w-5xl`}
      panelStyle={{ height: '88%' }}
    >
      {(requestClose) => (<>
        <div className="flex items-center justify-end px-7 pt-6 pb-0 shrink-0">
          <button onClick={requestClose} aria-label={t('sb_close')} className="text-[#9A8A78] hover:text-[#1C1410] transition-colors text-xl leading-none focus:outline-none">✕</button>
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
              floorFull={floorFull}
            />
          )}
          {view === 'vote' && (
            <VotingView
              committee={committee}
              typeMeta={typeMeta}
              onAccepted={handleMotionAccepted}
              onAllDone={close}
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
                                  : <SeatFlag country={m.proposedBy} size={20} className="object-contain inline-block" fallback={<UnknownSeatIcon size={20} />} />}
                                <span className="text-sm font-semibold text-[#1C1410]">{m.proposedBy === CHAIR_KEY ? chairDisplayName(language) : getCountryDisplayName(m.proposedBy, language)}</span>
                              </div>
                            )}
                            {rowIsCustom && !m.proposedBy && (
                              <p className="text-sm font-semibold mt-1" style={{ color: '#9A8A78' }}>{noProposerLabel(language)}</p>
                            )}
                            {m.topic && !rowIsCustom && <p className="text-sm text-[#6A5A4A] mt-1 font-medium">&ldquo;{m.topic}&rdquo;</p>}
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
                          <button onClick={() => { if (!isTempMotionId(m.id)) handleRemove(m.id); }}
                            disabled={isTempMotionId(m.id)}
                            title={isTempMotionId(m.id) ? t('motions_saving') : undefined}
                            className="text-[#9A8A78] hover:text-[#8B2020] disabled:opacity-40 disabled:cursor-not-allowed text-sm transition-colors mt-0.5">✕</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setView('raise')} disabled={floorFull}
                  className="disabled:opacity-50 disabled:cursor-not-allowed flex-1 bg-[#EDE7D8] hover:bg-[#DDD4C0] border border-[#DDD4C0] hover:border-[#1B3828] text-[#1C1410] py-3.5 rounded-2xl font-bold transition-all gv-lift">
                  {t('motions_raise_list_btn')}
                </button>
                {pending.length > 0 && (
                  <button onClick={() => setView('vote')}
                    className="flex-1 bg-[#1B3828] hover:bg-[#2A5A3C] text-white py-3.5 rounded-2xl font-black transition-colors gv-lift">
                    {t('motions_vote_list_btn')}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </>)}
    </GrowDialog>
  );
}