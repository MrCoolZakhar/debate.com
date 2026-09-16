'use client';

import React, { useState, useRef, useEffect, useCallback, KeyboardEvent } from 'react';
import Portal from '@/components/Portal';
import GrowDialog from '@/components/GrowDialog';
import { portalFrame } from '@/components/chat/chatTokens';
import { useT, useLanguage } from '@/contexts/LanguageContext';
import { useRouter } from 'next/navigation';
import {
  Ban, BadgeCheck, Check, ChevronLeft, ChevronRight, CircleDot, FileText, GripHorizontal,
  Minimize2, Minus, Pause, Play, Plus, Presentation, RotateCcw, Timer, Vote, X, type LucideIcon,
} from 'lucide-react';
import { Committee, CommitteeDocument, DocIntroState, DocumentType, DocumentStatus } from '@/lib/types';
import { serverNow, serverNowIso } from '@/lib/serverClock';
import { introRemainingNow, requireDocApproval as readRequireDocApproval, updateDocumentFlow, deleteDocumentChecked } from '@/lib/documentFlow';
import { sponsorLabel } from '@/lib/committeeFlags';
import { docName, docCount, docLimit, docLimitReached } from '@/lib/docNames';
import { TranslationKey } from '@/lib/translations';
import { getCountryDisplayName, matchesCountryQuery, startsWithCountryQuery } from '@/lib/countries';
import { SeatFlag } from '@/components/SeatFlag';
import { supabase } from '@/lib/supabase';
import { safeStorageKey } from '@/lib/storageKey';
import { UnknownSeatIcon } from '@/components/UnknownSeatIcon';
import {
  addDocument as addDocumentInDB,
  updateDocumentApproval as updateDocumentApprovalInDB,
} from '@/lib/committeeService';

type DocTab = 'working-paper' | 'draft-resolution';
// Flow stages for the fullscreen presentation experience
type PresentationStage = 'setup' | 'reading' | 'presentation' | 'qa' | null;
type TimedStage = DocIntroState['stage'];
const STAGE_ORDER: TimedStage[] = ['reading', 'presentation', 'qa'];

/** One pill vocabulary for a paper's lifecycle and its approval. Same shape for every state
 *  (icon + label, tinted fill, hairline ring drawn as an inset shadow, never a border); the
 *  colour moves from neutral ink to forest to gold as the paper advances, and only the two
 *  verdicts are strong. Every text colour is AA (>= 4.5:1) on its own fill over the card. */
type PillTone = { bg: string; fg: string; ring: string; Icon: LucideIcon };
const STATUS_PILL: Record<DocumentStatus, PillTone> = {
  submitted:  { bg: 'rgba(28,20,16,0.06)',   fg: '#4A3F35', ring: 'rgba(28,20,16,0.10)',   Icon: FileText },
  'on-floor': { bg: 'rgba(27,56,40,0.08)',   fg: '#1B3828', ring: 'rgba(27,56,40,0.18)',   Icon: CircleDot },
  introduced: { bg: 'rgba(238,217,138,0.60)', fg: '#5C4410', ring: 'rgba(160,120,30,0.30)', Icon: Presentation },
  passed:     { bg: '#1B3828',               fg: '#EED98A', ring: 'rgba(27,56,40,0.00)',   Icon: Check },
  failed:     { bg: 'rgba(139,32,32,0.10)',  fg: '#7A1C1C', ring: 'rgba(139,32,32,0.22)',  Icon: X },
};
const APPROVAL_PILL: Record<'approved' | 'rejected', PillTone> = {
  approved: { bg: 'transparent', fg: '#1B3828', ring: 'rgba(27,56,40,0.30)',  Icon: BadgeCheck },
  rejected: { bg: 'transparent', fg: '#7A1C1C', ring: 'rgba(139,32,32,0.30)', Icon: Ban },
};

function Pill({ tone, label }: { tone: PillTone; label: string }) {
  const { Icon } = tone;
  return (
    <span
      className="inline-flex items-center gap-1 h-[22px] ps-1.5 pe-2 rounded-full text-[11.5px] font-semibold leading-none whitespace-nowrap select-none"
      style={{ backgroundColor: tone.bg, color: tone.fg, boxShadow: `inset 0 0 0 1px ${tone.ring}`, fontFamily: "'Outfit', sans-serif" }}
    >
      <Icon size={12} strokeWidth={2.4} aria-hidden className="shrink-0" />
      {label}
    </span>
  );
}

const STATUS_NEXT: Partial<Record<DocumentStatus, DocumentStatus>> = {
  submitted: 'introduced', 'on-floor': 'introduced',
};

function getStatusLabel(status: DocumentStatus, t: (key: TranslationKey) => string): string {
  const map: Record<DocumentStatus, string> = {
    submitted:   t('documents_status_submitted'),
    'on-floor':  t('documents_status_on_floor'),
    introduced:  t('documents_status_introduced'),
    passed:      t('documents_status_passed'),
    failed:      t('documents_status_failed'),
  };
  return map[status] ?? status;
}

function StatusBadge({ status }: { status: DocumentStatus }) {
  const t = useT();
  return <Pill tone={STATUS_PILL[status] ?? STATUS_PILL.submitted} label={getStatusLabel(status, t)} />;
}

function CountryChip({ country, onRemove }: { country: string; onRemove: () => void }) {
  const { language } = useLanguage();
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#DDD4C0] border border-[#DDD4C0] rounded-full text-xs text-[#1C1410]">
      <SeatFlag country={country} size={16} className="object-contain inline-block me-1" fallback={<UnknownSeatIcon size={16} className="me-1" />} />{getCountryDisplayName(country, language)}
      <button onClick={onRemove} className="text-[#9A8A78] hover:text-red-500 ms-0.5 leading-none">✕</button>
    </span>
  );
}

const SPONSOR_LIST_MAX_H = 144;

function SponsorSelect({ candidates, selected, onChange, committee }: {
  candidates: string[]; selected: string[]; onChange: (v: string[]) => void; committee: Committee;
}) {
  const t = useT();
  const { language } = useLanguage();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number; flipped: boolean } | null>(null);
  const available = !query.trim()
    ? candidates.filter((c) => !selected.includes(c))
    : candidates
        .filter((c) => !selected.includes(c) && startsWithCountryQuery(c, query.trim(), language))
        .concat(candidates.filter((c) => !selected.includes(c) && !startsWithCountryQuery(c, query.trim(), language) && matchesCountryQuery(c, query.trim(), language)));
  const add = (country: string) => { onChange([...selected, country]); setQuery(''); setOpen(false); };
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); if (query.trim() && available.length > 0) add(available[0]); }
    if (e.key === 'Escape') { setOpen(false); }
  };

  // The modal body is `overflow-y-auto` inside a card with `overflow-hidden`, so an in-flow
  // absolute dropdown gets clipped. Render it through a Portal at fixed coordinates measured
  // from the field, repositioned on scroll (capture) + resize, flipped upward and clamped near
  // the edges. Coordinates run through portalFrame() because Portal mounts into the
  // transformed `#fit-root`, whose local units are not viewport pixels.
  const listOpen = open && !!query && available.length > 0;
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
    const flipped = spaceBelow < SPONSOR_LIST_MAX_H + 16 && top0 - f.minY > spaceBelow;
    setPos({ top: flipped ? top0 - 4 : bottom0 + 4, left, width, flipped });
  }, []);

  useEffect(() => {
    if (!listOpen) return;
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
  }, [listOpen, place]);

  return (
    <div>
      <label className="block text-sm font-semibold text-[#6A5A4A] mb-1.5">{sponsorLabel(committee, t('documents_sponsors_label'))}</label>
      <div className="relative" ref={wrapRef}>
        <input type="text" value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={t('documents_sponsor_placeholder')}
          className="w-full bg-[#FAF8F3] border border-[#DDD4C0] rounded-lg px-3 py-2 text-[#1C1410] placeholder-[#9A8A78] text-sm focus:outline-none focus:border-[#1B3828] transition-colors" />
        {listOpen && pos && (
          <Portal>
            <div
              ref={listRef}
              className="fixed bg-[#FAF8F3] border border-[#DDD4C0] rounded-xl overflow-hidden z-[65] overflow-y-auto shadow-lg"
              style={{
                top: pos.top, left: pos.left, width: pos.width, maxHeight: SPONSOR_LIST_MAX_H,
                transform: pos.flipped ? 'translateY(-100%)' : undefined,
                boxShadow: '0 12px 32px rgba(28,20,16,0.22), 0 2px 6px rgba(28,20,16,0.10)',
              }}
            >
              {available.slice(0, 6).map((c, i) => {
                return (
                  <button key={c} onMouseDown={(e) => { e.preventDefault(); add(c); }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-start transition-colors ${i === 0 ? 'bg-[#1B3828]/20 text-[#1C1410]' : 'text-[#1C1410] hover:bg-[#DDD4C0]'}`}>
                    <SeatFlag country={c} size={20} className="object-contain inline-block" fallback={<UnknownSeatIcon size={20} />} />
                    <span className="text-sm">{getCountryDisplayName(c, language)}</span>
                  </button>
                );
              })}
            </div>
          </Portal>
        )}
      </div>
      {/* Selected sponsors, flags only, below input */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {selected.map((c) => {
            return (
              <button key={c} onClick={() => onChange(selected.filter((s) => s !== c))}
                title={`Remove ${c}`}
                className="relative group focus:outline-none">
                <SeatFlag
                  country={c}
                  className="rounded"
                  style={{ width: 40, height: 28, objectFit: 'cover', border: '1.5px solid rgba(28,20,16,0.15)' }}
                  fallback={<UnknownSeatIcon size={28} />}
                />
                <span className="absolute inset-0 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity text-xs font-bold text-white"
                  style={{ backgroundColor: 'rgba(139,32,32,0.7)' }}>✕</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// PREVIEW only. The saved code is assigned by the documents_assign_doc_code trigger under a
// per-committee lock (V-6), so two simultaneous submissions can never share a code.
function autoDocCode(type: DocumentType, existingDocs: CommitteeDocument[]): string {
  const prefix = type === 'working-paper' ? 'WP' : 'DR';
  const sep = type === 'working-paper' ? '.' : '/';
  return `${prefix} 1${sep}${existingDocs.filter((d) => d.type === type).length + 1}`;
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60); const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ── The introduction screen ───────────────────────────────────────────────────
// Document-first (16 Sep 2026). The paper fills the screen and is mounted ONCE for the whole
// introduction; the stage clock and its controls are a floating panel the chair drags and
// resizes over it. Moving between Reading, Presentation and Q&A now only re-labels that panel,
// so the viewer keeps its zoom AND its scroll position: before, the viewer lived inside a
// component keyed on the stage (remount, so a PDF reloaded to page 1) and the split ratio was
// stage-local state that snapped back to 50% on every change.

/** Zoom is the chair's, not the stage's: it lives above the stage and is remembered per device. */
const ZOOM_STEPS = [0.5, 0.67, 0.8, 1, 1.25, 1.5, 2, 2.5, 3] as const;
const ZOOM_KEY = 'gavelling-intro-zoom';
function readZoom(): number {
  try {
    const raw = Number(localStorage.getItem(ZOOM_KEY));
    return ZOOM_STEPS.includes(raw as (typeof ZOOM_STEPS)[number]) ? raw : 1;
  } catch { return 1; }
}
function writeZoom(z: number) {
  try { localStorage.setItem(ZOOM_KEY, String(z)); } catch { /* storage blocked */ }
}
const stepZoom = (z: number, dir: 1 | -1) =>
  ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, Math.max(0, ZOOM_STEPS.indexOf(z as (typeof ZOOM_STEPS)[number]) + dir))] ?? 1;

/** The paper, filling the introduction screen. Mounted once per introduction: nothing here is
 *  keyed on the stage, so a stage change never touches the iframe or the scroll box. The zoom
 *  is a transform, so the frame is never re-created either. */
function IntroDocument({ doc, zoom }: { doc: CommitteeDocument; zoom: number }) {
  const t = useT();
  const size = `${100 / zoom}%`;
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#E4DCCA]">
      {doc.fileUrl ? (
        <iframe
          src={doc.fileUrl}
          title={doc.title}
          style={{ width: size, height: size, border: 0, transform: `scale(${zoom})`, transformOrigin: '0 0', display: 'block' }}
        />
      ) : doc.content ? (
        <div className="absolute inset-0 overflow-auto px-6 py-8">
          <div className="mx-auto bg-[#FAF8F3] rounded-2xl px-8 py-8"
            style={{ maxWidth: 820 * zoom, boxShadow: '0 1px 2px rgba(28,20,16,0.08), 0 10px 30px rgba(27,56,40,0.10)' }}>
            <p className="text-xs font-mono font-bold mb-3" style={{ color: '#1B3828', fontSize: 12 * zoom }}>{doc.docCode}</p>
            <h2 className="font-black mb-5" style={{ color: '#1C1410', fontSize: 20 * zoom, textWrap: 'balance' }}>{doc.title}</h2>
            <pre className="whitespace-pre-wrap font-sans leading-relaxed" style={{ color: '#1C1410', fontSize: 15 * zoom, textWrap: 'pretty' }}>{doc.content}</pre>
          </div>
        </div>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center px-8">
          <p className="max-w-sm text-center text-sm" style={{ color: '#6A5A4A', textWrap: 'pretty' }}>{t('documents_no_content')}</p>
        </div>
      )}
    </div>
  );
}

// ── The floating stage timer ──────────────────────────────────────────────────
// Dragged by its handle, resized from its corner, both with the pointer or the arrow keys, and
// always clamped inside the screen. The box is remembered per device (localStorage, try/catch:
// storage can be blocked and the panel then just opens in its default spot).
// Purely presentational: it never touches committee state (RULES 3 to 5).
type PanelBox = { x: number; y: number; w: number; h: number };
const PANEL_MARGIN = 12;
const PANEL_MIN_W = 248;
const PANEL_MIN_H = 250;
const PANEL_DEF_W = 340;
const PANEL_DEF_H = 330;
const PANEL_KEY = 'gavelling-intro-timer-panel';

/** The local coordinate space a fixed panel lives in, and its scale on screen: Portal mounts
 *  into FitToScreen's `#fit-root`, which is scaled with a CSS transform, so pointer deltas are
 *  divided by the live scale and the bounds are the fit-root's own size. */
function panelSpace() {
  const root = typeof document !== 'undefined' ? document.getElementById('fit-root') : null;
  if (root && root.offsetWidth > 0) {
    const r = root.getBoundingClientRect();
    return { w: root.offsetWidth, h: root.offsetHeight, scale: r.width / root.offsetWidth || 1 };
  }
  return { w: window.innerWidth, h: window.innerHeight, scale: 1 };
}

function clampBox(b: PanelBox): PanelBox {
  const { w: fw, h: fh } = panelSpace();
  const w = Math.min(Math.max(PANEL_MIN_W, b.w), Math.max(PANEL_MIN_W, fw - 2 * PANEL_MARGIN));
  const h = Math.min(Math.max(PANEL_MIN_H, b.h), Math.max(PANEL_MIN_H, fh - 2 * PANEL_MARGIN));
  return {
    w, h,
    x: Math.min(Math.max(PANEL_MARGIN, b.x), Math.max(PANEL_MARGIN, fw - w - PANEL_MARGIN)),
    y: Math.min(Math.max(PANEL_MARGIN, b.y), Math.max(PANEL_MARGIN, fh - h - PANEL_MARGIN)),
  };
}

function readBox(): PanelBox | null {
  try {
    const raw = localStorage.getItem(PANEL_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    return [p?.x, p?.y, p?.w, p?.h].every((n) => Number.isFinite(n)) ? { x: p.x, y: p.y, w: p.w, h: p.h } : null;
  } catch { return null; }
}
function writeBox(b: PanelBox) {
  try {
    localStorage.setItem(PANEL_KEY, JSON.stringify({ x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.w), h: Math.round(b.h) }));
  } catch { /* storage blocked */ }
}

function TimerIconButton({ onClick, label, children }: { onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} title={label} aria-label={label}
      className="w-10 h-10 shrink-0 rounded-xl flex items-center justify-center text-[#6A5A4A] bg-transparent hover:bg-[#1B3828]/[0.07] hover:text-[#1B3828] transition-[background-color,color,transform] duration-150 active:scale-[0.96] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
      style={{ boxShadow: 'inset 0 0 0 1px #DDD4C0' }}>
      {children}
    </button>
  );
}

// Anchor-based (V-5): the clock is {base, startedAt} and the remaining time is DERIVED from it,
// never decremented. The interval only refreshes `now` inside this panel; it never writes.
function IntroTimerPanel({
  label, totalSeconds, doc, committee, clock, onClockChange, onComplete, onBack, onHide,
}: {
  label: string; totalSeconds: number;
  doc: CommitteeDocument; committee: Committee;
  clock: { base: number; startedAt: string | null };
  onClockChange: (next: { base: number; startedAt: string | null }) => void;
  onComplete: () => void; onBack: () => void; onHide: () => void;
}) {
  const t = useT();
  // Database clock (T-1): the stage anchor is stamped and read on every chair device.
  const [now, setNow] = useState(() => serverNow());
  const running = !!clock.startedAt;
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(serverNow()), 500);
    return () => clearInterval(id);
  }, [running, clock.startedAt]);
  const remaining = introRemainingNow(clock, now);
  const started = running || clock.base < totalSeconds;
  const done = remaining === 0;
  const progress = totalSeconds > 0 ? ((totalSeconds - remaining) / totalSeconds) * 100 : 100;

  // First placement: the remembered box, else the lower inline-end corner. Computed once in the
  // initialiser (the panel only ever mounts in the browser, inside the introduction's Portal).
  const [box, setBox] = useState<PanelBox | null>(() => {
    if (typeof window === 'undefined') return null;
    const { w: fw, h: fh } = panelSpace();
    const rtl = document.documentElement.dir === 'rtl';
    return clampBox(readBox() ?? {
      w: PANEL_DEF_W, h: PANEL_DEF_H,
      x: rtl ? 24 : fw - PANEL_DEF_W - 24,
      y: Math.max(PANEL_MARGIN, fh - PANEL_DEF_H - 24),
    });
  });
  const boxRef = useRef<PanelBox | null>(box);
  const drag = useRef<{ pointerId: number; mode: 'move' | 'resize'; sx: number; sy: number; b: PanelBox; scale: number } | null>(null);
  const [busy, setBusy] = useState(false);

  const apply = useCallback((next: PanelBox, persist: boolean) => {
    const c = clampBox(next);
    boxRef.current = c;
    setBox(c);
    if (persist) writeBox(c);
  }, []);

  // Keep it on screen when the window (and so the fit-root) changes size.
  // FitToScreen resizes `#fit-root` through React state AFTER the window's resize event, so a
  // clamp inside that event measured the old size; the fit-root itself is observed too.
  useEffect(() => {
    const onResize = () => { if (boxRef.current) apply(boxRef.current, false); };
    window.addEventListener('resize', onResize);
    const root = document.getElementById('fit-root');
    const ro = root && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(onResize) : null;
    if (root) ro?.observe(root);
    return () => { window.removeEventListener('resize', onResize); ro?.disconnect(); };
  }, [apply]);

  const startDrag = (mode: 'move' | 'resize') => (e: React.PointerEvent<HTMLElement>) => {
    if (e.button !== 0 || !boxRef.current) return;
    if ((e.target as HTMLElement).closest('[data-panel-button]')) return;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* pointer gone */ }
    drag.current = { pointerId: e.pointerId, mode, sx: e.clientX, sy: e.clientY, b: boxRef.current, scale: panelSpace().scale };
    setBusy(true);
    e.preventDefault();
  };
  const onPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const dx = (e.clientX - d.sx) / d.scale;
    const dy = (e.clientY - d.sy) / d.scale;
    apply(d.mode === 'move'
      ? { ...d.b, x: d.b.x + dx, y: d.b.y + dy }
      : { ...d.b, w: d.b.w + dx, h: d.b.h + dy }, false);
  };
  const endDrag = (e: React.PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    try { if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    drag.current = null;
    setBusy(false);
    if (boxRef.current) writeBox(boxRef.current);
  };
  const onKeyDown = (mode: 'move' | 'resize') => (e: React.KeyboardEvent<HTMLElement>) => {
    const b = boxRef.current;
    if (!b) return;
    const step = e.shiftKey ? 64 : 16;
    const delta: Record<string, { x: number; y: number }> = {
      ArrowLeft: { x: -step, y: 0 }, ArrowRight: { x: step, y: 0 }, ArrowUp: { x: 0, y: -step }, ArrowDown: { x: 0, y: step },
    };
    const m = delta[e.key];
    if (!m) return;
    e.preventDefault();
    apply(mode === 'move' ? { ...b, x: b.x + m.x, y: b.y + m.y } : { ...b, w: b.w + m.x, h: b.h + m.y }, true);
  };

  // Everything inside scales with the panel, so a chair who makes it big gets a clock the room
  // can read and one who makes it small still gets a full set of controls.
  const w = box?.w ?? PANEL_DEF_W;
  const h = box?.h ?? PANEL_DEF_H;
  const clockPx = Math.round(Math.max(30, Math.min(w * 0.245, h * 0.30)));
  const typeName = docName(committee, doc.type, 'singular',
    doc.type === 'working-paper' ? t('documents_working_paper_type') : t('documents_draft_resolution_type')).toUpperCase();

  return (
    <div
      role="group"
      aria-label={t('documents_timer_panel')}
      className="fixed rounded-2xl bg-[#F6F1E9] flex flex-col overflow-hidden"
      style={{
        left: box?.x ?? 0, top: box?.y ?? 0, width: w, height: h, zIndex: 20,
        visibility: box ? 'visible' : 'hidden',
        boxShadow: busy
          ? '0 0 0 1px rgba(27,56,40,0.30), 0 6px 14px rgba(27,56,40,0.16), 0 28px 60px rgba(27,56,40,0.34)'
          : '0 0 0 1px rgba(27,56,40,0.22), 0 2px 8px rgba(27,56,40,0.12), 0 18px 40px rgba(27,56,40,0.26)',
        transition: 'box-shadow 180ms cubic-bezier(0.22,1,0.36,1)',
      }}
    >
      {/* Handle */}
      <div className="flex items-center gap-1 ps-1 pe-1.5 pt-1.5 shrink-0">
        <div
          role="button" tabIndex={0}
          aria-label={t('documents_timer_move')} title={t('documents_timer_move')}
          onPointerDown={startDrag('move')} onPointerMove={onPointerMove}
          onPointerUp={endDrag} onPointerCancel={endDrag} onKeyDown={onKeyDown('move')}
          className={`flex-1 min-w-0 flex items-center gap-2 h-9 px-2 rounded-lg select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] hover:bg-[#1B3828]/[0.05] transition-colors ${busy ? 'cursor-grabbing' : 'cursor-grab'}`}
          style={{ touchAction: 'none' }}
        >
          <GripHorizontal size={16} strokeWidth={2.4} aria-hidden className="shrink-0 text-[#6A5A4A]" />
          <span className="min-w-0 truncate text-[11px] font-black tracking-widest uppercase"
            style={{ color: '#1B3828', fontFamily: "'Outfit', sans-serif" }}>{label}</span>
        </div>
        <button type="button" data-panel-button onClick={onHide}
          aria-label={t('documents_timer_hide')} title={t('documents_timer_hide')}
          className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-[#6A5A4A] hover:text-[#1C1410] hover:bg-[#1B3828]/[0.07] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]">
          <Minimize2 size={15} strokeWidth={2.4} aria-hidden />
        </button>
      </div>

      <div className="px-3 pb-1 shrink-0">
        <p className="truncate text-[10.5px] font-mono tracking-widest" style={{ color: '#9A8A78' }}>{typeName} · {doc.docCode}</p>
      </div>

      {done ? (
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-4 px-4 pb-4 text-center">
          <p className="text-sm" style={{ color: '#6A5A4A', textWrap: 'pretty' }}>{t('documents_stage_complete').replace('{stage}', label)}</p>
          <button onClick={onComplete}
            className="px-6 py-3 rounded-xl font-black text-sm bg-[#1B3828] hover:bg-[#2A5A3C] text-white transition-[background-color,transform] duration-150 active:scale-[0.96] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]/40"
            style={{ letterSpacing: '0.05em' }}>
            {t('documents_continue_btn')}
          </button>
        </div>
      ) : (
        <>
          <div className="flex-1 min-h-0 flex items-center justify-center px-3">
            <span className="font-black font-mono tabular-nums leading-none"
              style={{ fontSize: clockPx, color: remaining <= 30 ? '#B8844A' : '#1C1410' }}>
              {formatTime(remaining)}
            </span>
          </div>
          <div className="px-3 pb-2 shrink-0">
            <div className="w-full h-1.5 bg-[#DDD4C0] rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${progress}%`, backgroundColor: '#1B3828', transition: 'width 500ms linear' }} />
            </div>
          </div>
          <div className="flex items-center gap-1.5 px-3 pb-3 shrink-0">
            <TimerIconButton onClick={onBack} label={t('documents_stage_back_title')}>
              <ChevronLeft size={18} strokeWidth={2.4} aria-hidden className="rtl:rotate-180" />
            </TimerIconButton>
            <TimerIconButton onClick={() => onClockChange({ base: totalSeconds, startedAt: null })} label={t('documents_timer_reset_title')}>
              <RotateCcw size={16} strokeWidth={2.4} aria-hidden />
            </TimerIconButton>
            <button
              onClick={() => {
                const live = introRemainingNow(clock, serverNow());
                onClockChange(running ? { base: live, startedAt: null } : { base: live, startedAt: serverNowIso() });
              }}
              className="flex-1 min-w-0 h-10 rounded-xl font-black text-sm text-white flex items-center justify-center gap-1.5 transition-[background-color,transform] duration-150 active:scale-[0.96] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]/40"
              style={{ backgroundColor: running ? '#B8844A' : '#2A5A3C', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.04em' }}>
              {running
                ? <><Pause size={15} strokeWidth={2.6} fill="currentColor" aria-hidden />{t('documents_pause_btn')}</>
                : <><Play size={15} strokeWidth={2.6} fill="currentColor" aria-hidden className="rtl:rotate-180" />
                    <span className="truncate">{started ? t('documents_resume_btn').replace(/▶\s*/g, '').trim() : t('documents_start_btn').replace(/\s*[→←]\s*/g, ' ').trim()}</span></>}
            </button>
            <TimerIconButton onClick={onComplete} label={t('documents_stage_skip_title')}>
              <ChevronRight size={18} strokeWidth={2.4} aria-hidden className="rtl:rotate-180" />
            </TimerIconButton>
          </div>
        </>
      )}

      {/* Resize corner. Pointer or arrow keys; the panel can never be dragged or resized off screen. */}
      <div
        role="button" tabIndex={0}
        aria-label={t('documents_timer_resize')} title={t('documents_timer_resize')}
        onPointerDown={startDrag('resize')} onPointerMove={onPointerMove}
        onPointerUp={endDrag} onPointerCancel={endDrag} onKeyDown={onKeyDown('resize')}
        className="absolute bottom-0 right-0 w-6 h-6 flex items-end justify-end p-1 cursor-nwse-resize text-[#9A8A78] hover:text-[#1B3828] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] rounded-br-2xl"
        style={{ touchAction: 'none' }}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden fill="none">
          <path d="M9 1v8H1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.5" />
          <path d="M9 5v4H5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
}

// ── Submit Form ───────────────────────────────────────────────────────────────
function SubmitForm({ committee, type, onDone, onDocumentAdded }: {
  committee: Committee; type: DocumentType; onDone: () => void;
  onDocumentAdded: (doc: CommitteeDocument) => void;
}) {
  const t = useT();
  // Limits come from the committee row (dbSettings), not the localStorage settings
  // store — see docLimitReached. Same helper backs the delegate submit path, which
  // previously enforced nothing at all.
  const existingCount = docCount(committee, type);
  const limit = docLimit(committee, type);
  const limitReached = docLimitReached(committee, type);

  const presentCountries = committee.delegates.filter((d) => d.status !== 'absent').map((d) => d.country);
  const [title, setTitle] = useState('');
  const [sponsors, setSponsors] = useState<string[]>([]);
  const [content, setContent] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  /* See the delegate page: a failed attachment was console-only and looked
     like nothing had happened at all. */
  const [uploadError, setUploadError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docCode = autoDocCode(type, committee.documents ?? []);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitFailed, setSubmitFailed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const isDuplicate = (committee.documents ?? []).some(
    (d) => d.title.trim().toLowerCase() === title.trim().toLowerCase()
  );

  const canSubmit = !limitReached && !isSubmitting && !isUploading && !isDuplicate && !!title.trim();

  const uploadFile = async (file: File) => {
    setFileName(file.name);
    setIsUploading(true);
    try {
      const path = safeStorageKey(committee.id, String(Date.now()), file.name);
      // NO upsert — see the matching note on the delegate page. The bucket grants
      // anon INSERT but not UPDATE, so `upsert: true` was refused with a 403 that
      // never surfaced. Date.now() in the path makes upsert pointless anyway.
      const { error } = await supabase.storage.from('session-documents').upload(path, file);
      if (error) {
        console.error('Storage upload error:', error);
        setFileName(null);
        setUploadError(true);
        return;
      }
      setUploadError(false);
      const { data } = supabase.storage.from('session-documents').getPublicUrl(path);
      setFileUrl(data.publicUrl);
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    await uploadFile(f);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file || file.type !== 'application/pdf') return;
    await uploadFile(file);
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    try {
      const newDoc: Omit<CommitteeDocument, 'id' | 'submittedAt'> = {
        type, docCode, title: title.trim(), sponsors, content: content.trim(), status: 'submitted',
        ...(fileUrl && fileName ? { fileUrl, fileName } : {}),
      };
      const saved = await addDocumentInDB(committee.id, newDoc, committee.code, committee.dbChairJoinSuffix ?? undefined);
      // V-6: a failed insert used to close the form as if it had worked. Keep what the chair
      // typed and say it was not saved.
      if (!saved) { setSubmitFailed(true); return; }
      setSubmitFailed(false);
      onDocumentAdded(saved);
      onDone();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 px-7 pb-7">
      <div className="flex flex-col items-center gap-1 relative">
        <button onClick={onDone} className="absolute left-0 top-1/2 -translate-y-1/2 text-sm transition-colors focus:outline-none" style={{ color: '#9A8A78' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#1C1410'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#9A8A78'; }}>{t('documents_back')}</button>
        <h2 className="text-xl font-black text-center uppercase tracking-wide" style={{ color: '#1B3828' }}>
          {t('documents_submit_doc_heading', {
            doc: docName(committee, type, 'singular',
              type === 'working-paper' ? t('documents_working_paper_type') : t('documents_draft_resolution_type')).toUpperCase(),
          })}
        </h2>
      </div>
      <div className="bg-[#EDE7D8] border border-[#DDD4C0] rounded-xl px-4 py-2.5">
        <span className="text-xs text-[#9A8A78] font-mono">{t('documents_doc_code_label')}</span>
        <span className="ms-3 text-sm font-bold text-[#1C1410] font-mono">{docCode}</span>
      </div>
      <div>
        <label className="block text-sm font-semibold text-[#6A5A4A] mb-1.5">{t('documents_title_label')} <span className="text-red-500">*</span></label>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
          placeholder={type === 'working-paper' ? t('documents_title_placeholder_wp') : t('documents_title_placeholder_dr')}
          className="w-full bg-[#FAF8F3] border border-[#DDD4C0] rounded-xl px-4 py-3 text-[#1C1410] placeholder-[#9A8A78] focus:outline-none focus:border-[#1B3828] transition-colors" />
      </div>
      <SponsorSelect candidates={presentCountries} selected={sponsors} onChange={setSponsors} committee={committee} />
      <div>
        <label className="block text-sm font-semibold text-[#6A5A4A] mb-1.5">{t('documents_google_docs_label')} <span className="text-[#9A8A78] font-normal">({t('documents_google_docs_optional')})</span></label>
        <input type="text" value={content} onChange={(e) => setContent(e.target.value)}
          placeholder="https://docs.google.com/..."
          className="w-full bg-[#FAF8F3] border border-[#DDD4C0] rounded-xl px-4 py-3 text-[#1C1410] placeholder-[#9A8A78] focus:outline-none focus:border-[#1B3828] transition-colors text-sm" />
      </div>
      <div>
        <label className="block text-sm font-semibold text-[#6A5A4A] mb-1.5">
          {t('documents_attachment_label')} <span className="text-[#9A8A78] font-normal">(optional)</span>
        </label>
        {fileName ? (
          <div className="flex items-center gap-2 bg-[#FAF8F3] border border-[#DDD4C0] rounded-xl px-4 py-3">
            <span className="text-sm text-[#1C1410] flex-1 truncate flex items-center gap-2">
              {isUploading
                ? <><div className="w-3.5 h-3.5 border-2 border-[#1B3828] border-t-transparent rounded-full animate-spin shrink-0" /> Uploading…</>
                : <>📎 {fileName}</>
              }
            </span>
            <button onClick={() => { setFileName(null); setFileUrl(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
              className="text-[#9A8A78] hover:text-red-500 transition-colors text-sm">✕</button>
          </div>
        ) : (
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragEnter={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`w-full border border-dashed rounded-xl px-4 py-5 text-sm transition-colors text-center cursor-pointer select-none ${
              isDragging
                ? 'border-[#1B3828] bg-[#1B3828]/10 text-[#1B3828]'
                : 'bg-[#FAF8F3] border-[#DDD4C0] hover:border-[#1B3828] text-[#9A8A78] hover:text-[#6A5A4A]'
            }`}
          >
            <span className="block text-xl mb-1">📎</span>
            {isDragging ? 'Drop PDF here' : 'Click to upload or drag & drop a PDF'}
          </div>
        )}
        <input ref={fileInputRef} type="file" accept=".pdf" onChange={handleFileChange} style={{ position: 'fixed', top: '-9999px', left: '-9999px', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }} />
        {uploadError && (
          <p className="text-xs mt-1.5" style={{ color: '#8B2020' }}>
            {t('delegate_doc_upload_failed')}
          </p>
        )}
      </div>
      {limitReached && (
        <p className="text-xs text-red-400 text-center">
          {t('documents_limit_exceeded').replace('{current}', String(existingCount)).replace('{limit}', String(limit)).replace('{type}', docName(committee, type, 'plural', type === 'working-paper' ? t('documents_type_wp') : t('documents_type_dr')))}
        </p>
      )}
      {submitFailed && (
        <p role="alert" className="text-xs text-center" style={{ color: '#8B2020' }}>{t('documents_submit_failed')}</p>
      )}
      {isSubmitting ? (
        <button disabled className="w-full bg-[#9A8A78] text-white py-3.5 rounded-xl font-bold cursor-not-allowed gv-lift">
          Uploading…
        </button>
      ) : (
        <button onClick={handleSubmit} disabled={!canSubmit}
          className="w-full bg-[#1B3828] hover:bg-[#2A5A3C] disabled:bg-[#DDD4C0] disabled:text-[#9A8A78] text-white py-3.5 rounded-xl font-bold transition-colors gv-lift">
          {limitReached
            ? t('documents_limit_reached').replace('{current}', String(existingCount)).replace('{limit}', String(limit))
            : isDuplicate
              ? 'A document with this title already exists'
              : t('documents_submit_document')}
        </button>
      )}
    </div>
  );
}

// ── Timing Setup Dialog ───────────────────────────────────────────────────────
function TimingSetup({ doc, committee, onStart, onSkip }: {
  doc: CommitteeDocument;
  committee: Committee;
  onStart: (readingMins: number, presentationMins: number, qaMins: number) => void;
  onSkip: () => void;
}) {
  const t = useT();
  const isWP = doc.type === 'working-paper';
  const typeName = docName(committee, doc.type, 'singular',
    isWP ? t('documents_working_paper') : t('documents_draft_resolution'));
  const typeNamePlural = docName(committee, doc.type, 'plural',
    isWP ? t('documents_working_papers_tab') : t('documents_draft_resolutions_tab'));
  // Prefilled from the row, so Back to setup (or a re-introduction) keeps the chosen times.
  const [readingMins, setReadingMins] = useState(doc.readingMinutes ?? 0);
  const [presentationMins, setPresentationMins] = useState(doc.presentationMinutes ?? 0);
  const [qaMins, setQaMins] = useState(doc.qaMinutes ?? 0);

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 py-12">
      <p className="text-xs font-mono tracking-widest mb-2 text-[#9A8A78]">{doc.docCode} · {t('documents_setup_timers')}</p>
      <h2 className="text-2xl font-black text-[#1C1410] mb-1">{doc.title}</h2>
      <p className="text-sm text-[#6A5A4A] mb-8">
        {isWP ? t('documents_doc_flow_auto', { doc: typeName }) : t('documents_doc_flow_vote', { doc: typeName })}
      </p>

      <div className="w-full max-w-sm space-y-4">
        {[
          { key: 'reading', label: t('documents_stage_reading'), value: readingMins, set: setReadingMins, note: t('documents_stage_note_reading') },
          { key: 'presentation', label: t('documents_stage_presentation'), value: presentationMins, set: setPresentationMins, note: t('documents_stage_note_presentation') },
          { key: 'qa', label: t('documents_stage_qa'), value: qaMins, set: setQaMins, note: isWP ? t('documents_qa_optional_doc', { doc: typeNamePlural }) : t('documents_qa_note') },
        ].map(({ key, label, value, set, note }) => (
          <div key={key} className="bg-[#EDE7D8] border border-[#DDD4C0] rounded-xl p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="font-black text-sm" style={{ color: '#1B3828', fontFamily: "'Outfit', sans-serif" }}>{label}</span>
              <div className="flex items-center gap-2">
                <input type="number" min={0} max={60}
                  value={value === 0 ? '' : value}
                  onChange={(e) => set(e.target.value === '' ? 0 : Math.max(0, parseInt(e.target.value) || 0))}
                  onBlur={(e) => { if (e.target.value === '') set(0); }}
                  className="w-16 bg-[#FAF8F3] border border-[#DDD4C0] rounded-lg px-2 py-1 text-[#1C1410] text-sm text-center focus:outline-none focus:border-[#1B3828]" />
                <span className="text-sm text-[#9A8A78]">min</span>
              </div>
            </div>
            <p className="text-xs text-[#9A8A78]">{note}</p>
          </div>
        ))}

        <div className="flex gap-3 pt-2">
          <button onClick={() => onStart(readingMins, presentationMins, qaMins)}
            className="flex-1 bg-[#1B3828] hover:bg-[#2A5A3C] text-white py-3.5 rounded-2xl font-black transition-colors focus:outline-none gv-lift" style={{ letterSpacing: '0.05em' }}>
            {t('documents_start_btn')}
          </button>
          <button onClick={onSkip}
            className="px-6 py-3.5 rounded-2xl font-bold bg-transparent border border-[#DDD4C0] hover:border-[#1B3828] transition-colors focus:outline-none" style={{ color: '#6A5A4A' }}>
            {t('documents_skip_btn')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Doc Card ──────────────────────────────────────────────────────────────────
function DocCard({ doc, committee, onRemove, onStartPresentation, requireApproval, onApprovalChange, isViewOnly }: {
  doc: CommitteeDocument; committee: Committee;
  onRemove: (docId: string) => void;
  onStartPresentation: (doc: CommitteeDocument) => void;
  requireApproval: boolean;
  onApprovalChange: (docId: string, approval: 'approved' | 'rejected') => void;
  /** D-10: a Commenter sees the card but gets no approve / reject / introduce / delete.
   *  UI gate only (RULE 15), like every other isViewOnly. */
  isViewOnly: boolean;
}) {
  const t = useT();
  const { language } = useLanguage();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showPdf, setShowPdf] = useState(false);
  const nextStatus = STATUS_NEXT[doc.status];
  // Approval gate: while the setting is on and this doc isn't approved yet, offer Approve/Reject
  // (also lets a chair reverse a rejection) and hold back Introduce until approved. Once the doc has
  // been introduced/passed/failed the gate is moot.
  // An introduced working paper can be re-introduced (below), so the gate applies to it too,
  // and Approve/Reject stays offered there: otherwise a paper introduced before the setting was
  // switched on, or rejected from another device, would have no way forward.
  const canDecide = requireApproval && doc.approval !== 'approved'
    && (doc.status === 'submitted' || doc.status === 'on-floor' || (doc.status === 'introduced' && doc.type === 'working-paper'));
  const approvalBlocksIntroduce = requireApproval && doc.approval !== 'approved';

  return (
    <div className="bg-[#EDE7D8] border border-[#DDD4C0] rounded-xl overflow-hidden">
      <div className="flex items-stretch">

        {/* Left strip, doc thumbnail with padding from border */}
        <div className="flex flex-col items-center justify-between shrink-0 p-2"
          style={{ backgroundColor: 'rgba(27,56,40,0.10)', width: '88px' }}>

          {/* Thumbnail, PDF preview or fallback emoji */}
          <div className="w-full rounded-lg overflow-hidden flex-1 flex items-center justify-center"
            style={{ maxHeight: '120px', minHeight: '80px' }}>
            {doc.fileUrl ? (
              <iframe
                src={doc.fileUrl}
                title={doc.docCode}
                className="w-full"
                style={{ height: '120px', pointerEvents: 'none' }}
                scrolling="no"
              />
            ) : (
              <span style={{ fontSize: '5.5rem', lineHeight: 1, userSelect: 'none' }}>📋</span>
            )}
          </div>

          {/* Doc code below the thumbnail */}
          <span className="mt-1.5 text-center font-black"
            style={{ fontSize: '11px', color: '#1B3828', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.03em' }}>
            {doc.docCode}
          </span>
        </div>

        {/* Right content */}
        <div className="flex-1 min-w-0 p-4 space-y-2.5">

          {/* Title row + delete */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-base font-black text-[#1C1410] leading-snug">{doc.title}</p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <StatusBadge status={doc.status} />
                {doc.approval === 'approved' && <Pill tone={APPROVAL_PILL.approved} label={t('documents_status_approved')} />}
                {doc.approval === 'rejected' && <Pill tone={APPROVAL_PILL.rejected} label={t('documents_status_rejected')} />}
              </div>
            </div>
            {!isViewOnly && !confirmDelete && (
              <button onClick={() => setConfirmDelete(true)}
                className="text-[#9A8A78] hover:text-red-500 transition-colors text-sm shrink-0 focus:outline-none mt-0.5"
                title={t('documents_delete_yes')}>✕</button>
            )}
          </div>

          {/* Delete asks first: it was a single click with no way back. */}
          {!isViewOnly && confirmDelete && (
            <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ backgroundColor: 'rgba(139,32,32,0.08)', border: '1px solid rgba(139,32,32,0.3)' }}>
              <span className="text-sm font-semibold flex-1 min-w-0" style={{ color: '#8B2020' }}>{t('documents_delete_confirm')}</span>
              <button onClick={() => { setConfirmDelete(false); onRemove(doc.id); }}
                className="px-3 py-1 rounded-lg text-xs font-bold focus:outline-none" style={{ backgroundColor: '#8B2020', color: '#FAF8F3' }}>
                {t('documents_delete_yes')}
              </button>
              <button onClick={() => setConfirmDelete(false)}
                className="px-3 py-1 rounded-lg text-xs font-bold border focus:outline-none" style={{ borderColor: '#DDD4C0', color: '#6A5A4A' }}>
                {t('documents_delete_no')}
              </button>
            </div>
          )}

          {/* Sponsors with flags */}
          {doc.sponsors.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-semibold text-[#6A5A4A] shrink-0">{sponsorLabel(committee, t('documents_sponsors_label_card'))}:</span>
              {doc.sponsors.map((s) => {
                return (
                  <span key={s} className="inline-flex items-center gap-1">
                    <SeatFlag
                      country={s}
                      className="rounded-sm"
                      style={{ width: 24, height: 16, objectFit: 'cover', border: '1px solid rgba(28,20,16,0.12)' }}
                      fallback={null}
                    />
                    <span className="text-xs text-[#6A5A4A]">{getCountryDisplayName(s, language)}</span>
                  </span>
                );
              })}
            </div>
          )}

          {/* PDF toggle */}
          {doc.fileUrl && doc.fileName && (
            <div className="text-xs space-y-2">
              <button onClick={() => setShowPdf((v) => !v)}
                className="transition-colors focus:outline-none" style={{ color: '#1B3828' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#2A5A3C'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#1B3828'; }}>
                📎 {doc.fileName} {showPdf ? '▲' : '▼'}
              </button>
              {showPdf && (
                <iframe src={doc.fileUrl} title={doc.fileName}
                  className="w-full rounded-lg border border-[#DDD4C0]"
                  style={{ height: '480px' }} />
              )}
            </div>
          )}

          {/* Content toggle */}
          {doc.content && (
            <div>
              <button onClick={() => setExpanded((v) => !v)}
                className="text-xs text-[#1B3828] hover:text-[#6A5A4A] transition-colors">
                {expanded ? '▲ Hide content' : '▼ Show content'}
              </button>
              {expanded && (
                <pre className="mt-2 text-xs text-[#1C1410] bg-[#FAF8F3] border border-[#DDD4C0] rounded-lg px-3 py-2 whitespace-pre-wrap font-sans leading-relaxed max-h-48 overflow-y-auto">
                  {doc.content}
                </pre>
              )}
            </div>
          )}

          {/* Chair approval gate, approve/reject before the doc can be introduced */}
          {canDecide && !isViewOnly && (
            <div className="flex gap-2">
              <button onClick={() => onApprovalChange(doc.id, 'approved')}
                className="flex-1 bg-[#1B3828] hover:bg-[#2A5A3C] text-white py-2 rounded-lg font-bold text-sm transition-colors focus:outline-none gv-lift">
                {t('documents_approve')}
              </button>
              <button onClick={() => onApprovalChange(doc.id, 'rejected')}
                className="flex-1 py-2 rounded-lg font-bold text-sm transition-colors focus:outline-none gv-lift"
                style={{ backgroundColor: '#8B2020', color: '#EDE7D8' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#7A1C1C'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#8B2020'; }}>
                {t('documents_reject')}
              </button>
            </div>
          )}

          {/* Introduce, withheld until approved when approval is required. A working paper
              whose introduction was closed before Q&A finished is still "introduced" and
              offers Introduce again (setup prefilled with its saved times), so it can always
              reach its automatic pass. An introduced draft resolution goes to the voting page. */}
          {!isViewOnly && !approvalBlocksIntroduce && (nextStatus === 'introduced' || (doc.status === 'introduced' && doc.type === 'working-paper')) && (
            <button onClick={() => onStartPresentation(doc)}
              className="w-full bg-[#1B3828] hover:bg-[#2A5A3C] text-white py-2 rounded-lg font-bold text-sm transition-colors focus:outline-none gv-lift">
              {`${t('documents_introduce')} →`}
            </button>
          )}

        </div>
      </div>
    </div>
  );
}

// ── Main Modal ────────────────────────────────────────────────────────────────
export default function DocumentsModal({ committee, onClose, onCommitteeUpdate, isViewOnly = false, chairName = '' }: {
  committee: Committee; onClose: () => void;
  onCommitteeUpdate?: (updater: (c: Committee) => Committee) => void;
  isViewOnly?: boolean;
  // The acting chair's name, so "Go to voting" can hand it on to /voting/[code] and the
  // voting page's "Back to Session" can hand it back. A chair's identity is ONLY the
  // ?chairName= query param, so any navigation that drops it loses the gavel comparison
  // and the chat sender name. Passed already-resolved by the chair page (it falls back to
  // the rejoin blob when the URL is bare), which is the only surface rendering this modal.
  chairName?: string;
}) {
  const t = useT();
  const router = useRouter();
  // D-10: read from the committee row, so another chair's toggle applies on this device.
  const requireDocApproval = readRequireDocApproval(committee);
  const [tab, setTab] = useState<DocTab>('working-paper');
  const [showForm, setShowForm] = useState(false);

  // Fullscreen presentation state. The doc itself is re-read from the committee by id so a
  // realtime refresh (title, sponsors) is reflected; `activeDocSnap` is the fallback.
  const [activeDocSnap, setActiveDocSnap] = useState<CommitteeDocument | null>(null);
  const activeDoc = activeDocSnap
    ? ((committee.documents ?? []).find((d) => d.id === activeDocSnap.id) ?? activeDocSnap)
    : null;
  const [stage, setStage] = useState<PresentationStage>(null);
  const [timings, setTimings] = useState({ reading: 0, presentation: 0, qa: 0 });
  const [clock, setClock] = useState<{ base: number; startedAt: string | null }>({ base: 0, startedAt: null });
  /** Both belong to the introduction, not to a stage, so moving between Reading, Presentation
   *  and Q&A leaves the paper exactly as the chair set it. Zoom is remembered per device. */
  const [zoom, setZoom] = useState(() => (typeof window === 'undefined' ? 1 : readZoom()));
  const [timerOpen, setTimerOpen] = useState(true);
  const [flowError, setFlowError] = useState(false);
  /** Write order for this modal, and the failures still standing (doc id -> seq of the
   *  failed write). A success clears ONLY failures of the same document issued before it:
   *  a later success on another paper (or an older write landing late) used to hide the
   *  banner while the failed change was still unsaved. */
  const flowSeqRef = useRef(0);
  const flowFailuresRef = useRef<Map<string, number>>(new Map());
  const settleFlow = (docId: string, seq: number, ok: boolean) => {
    const failures = flowFailuresRef.current;
    if (ok) {
      const failedAt = failures.get(docId);
      if (failedAt !== undefined && failedAt < seq) failures.delete(docId);
    } else {
      failures.set(docId, Math.max(failures.get(docId) ?? 0, seq));
    }
    setFlowError(failures.size > 0);
  };

  const update = (updater: (c: Committee) => Committee) => onCommitteeUpdate?.(updater);
  const suffix = committee.dbChairJoinSuffix ?? undefined;
  const docs = (committee.documents ?? []).filter((d) => d.type === tab);
  // Chair-renameable labels for the active tab's document type.
  const tabSingularName = docName(committee, tab, 'singular',
    tab === 'working-paper' ? t('documents_working_paper') : t('documents_draft_resolution'));
  const tabPluralName = docName(committee, tab, 'plural',
    tab === 'working-paper' ? t('documents_working_papers_tab') : t('documents_draft_resolutions_tab'));

  const patchDocLocal = (docId: string, patch: Partial<CommitteeDocument>) =>
    update((c) => ({ ...c, documents: (c.documents ?? []).map((d) => d.id === docId ? { ...d, ...patch } : d) }));

  /** Optimistic first, then one checked write (RULE 5). A failure is shown, not swallowed. */
  const writeFlow = (docId: string, patch: Parameters<typeof updateDocumentFlow>[1]) => {
    const local: Partial<CommitteeDocument> = {};
    if (patch.status !== undefined) local.status = patch.status;
    if (patch.introState !== undefined) local.introState = patch.introState;
    if (patch.readingMinutes !== undefined) local.readingMinutes = patch.readingMinutes;
    if (patch.presentationMinutes !== undefined) local.presentationMinutes = patch.presentationMinutes;
    if (patch.qaMinutes !== undefined) local.qaMinutes = patch.qaMinutes;
    patchDocLocal(docId, local);
    const seq = ++flowSeqRef.current;
    void updateDocumentFlow(docId, patch, committee.code, suffix).then((ok) => settleFlow(docId, seq, ok));
  };

  const handleDocumentAdded = (doc: CommitteeDocument) => {
    update((c) => ({ ...c, documents: [...(c.documents ?? []), doc] }));
  };

  const handleApprovalChange = (docId: string, approval: 'approved' | 'rejected') => {
    patchDocLocal(docId, { approval });
    updateDocumentApprovalInDB(docId, approval, committee.code, suffix);
  };

  const handleRemove = (docId: string) => {
    const removed = (committee.documents ?? []).find((d) => d.id === docId);
    update((c) => ({ ...c, documents: (c.documents ?? []).filter((d) => d.id !== docId) }));
    const seq = ++flowSeqRef.current;
    void deleteDocumentChecked(docId, committee.code, suffix).then((ok) => {
      if (ok) { settleFlow(docId, seq, true); return; }
      if (!removed) return;
      // Put it back rather than pretend it is gone.
      update((c) => (c.documents ?? []).some((d) => d.id === docId) ? c : { ...c, documents: [...(c.documents ?? []), removed] });
      settleFlow(docId, seq, false);
    });
  };

  const closeFlow = () => { setStage(null); setActiveDocSnap(null); };

  const goToVoting = () =>
    router.push(`/voting/${committee.code}${chairName ? `?chairName=${encodeURIComponent(chairName)}` : ''}`);

  const handleStartPresentation = (doc: CommitteeDocument) => {
    setActiveDocSnap(doc);
    setStage('setup');
    setTimerOpen(true);
  };

  const stageMinutes = (s: TimedStage, tm = timings) => tm[s];

  /** Enter a timed stage with a fresh, paused clock. The stage lives only on this screen:
   *  there is no Resume from the card any more, so it is not persisted. */
  const enterStage = (s: TimedStage, tm = timings) => {
    setClock({ base: stageMinutes(s, tm) * 60, startedAt: null });
    setStage(s);
  };

  const finishIntroduction = (doc: CommitteeDocument) => {
    // WP auto-passes. A DR stays introduced; the chair takes it to the voting page.
    writeFlow(doc.id, doc.type === 'working-paper' ? { status: 'passed', introState: null } : { introState: null });
    closeFlow();
  };

  const handleTimingConfirmed = (readingMins: number, presentationMins: number, qaMins: number) => {
    if (!activeDoc) return;
    const tm = { reading: readingMins, presentation: presentationMins, qa: qaMins };
    setTimings(tm);
    const first = STAGE_ORDER.find((s) => tm[s] > 0);
    // One write: timings and status together. `introState: null` also clears a stage left by
    // the retired Resume flow, so no row keeps a stale introduction.
    writeFlow(activeDoc.id, {
      readingMinutes: readingMins, presentationMinutes: presentationMins, qaMinutes: qaMins,
      status: first || activeDoc.type !== 'working-paper' ? 'introduced' : 'passed',
      introState: null,
    });
    if (first) { setClock({ base: tm[first] * 60, startedAt: null }); setStage(first); }
    else closeFlow();
  };

  const advanceFromStage = (from: TimedStage) => {
    if (!activeDoc) return;
    const after = STAGE_ORDER.slice(STAGE_ORDER.indexOf(from) + 1).find((s) => timings[s] > 0);
    if (after) enterStage(after);
    else finishIntroduction(activeDoc);
  };

  /** Back skips stages with a 0-minute timer (they used to render a blank screen) and
   *  lands on setup when there is nothing earlier. */
  const backFromStage = (from: TimedStage) => {
    if (!activeDoc) return;
    const before = STAGE_ORDER.slice(0, STAGE_ORDER.indexOf(from)).reverse().find((s) => timings[s] > 0);
    if (before) enterStage(before);
    else setStage('setup');
  };

  const handleClockChange = (next: { base: number; startedAt: string | null }) => {
    if (!activeDoc || !stage || stage === 'setup') return;
    setClock(next);
  };

  const handleSkipToVote = () => {
    if (!activeDoc) return;
    writeFlow(activeDoc.id, activeDoc.type === 'working-paper'
      ? { status: 'passed', introState: null }
      : { status: 'introduced', introState: null });
    closeFlow();
  };

  const flowErrorBanner = flowError ? (
    <p role="alert" className="text-xs text-center px-6 py-2" style={{ color: '#8B2020', backgroundColor: 'rgba(139,32,32,0.08)' }}>
      {t('documents_intro_save_failed')}
    </p>
  ) : null;

  // Fullscreen stages. The paper is the page; the clock floats over it (16 Sep 2026).
  if (activeDoc && stage && stage !== 'setup') {
    const stageLabel = stage === 'reading' ? t('documents_stage_reading') : stage === 'presentation' ? t('documents_stage_presentation') : t('documents_stage_qa');
    return (
      <Portal><div className="fixed inset-0 z-50 bg-[#EDE7D8] flex flex-col">
        <div className="flex items-center gap-3 px-5 py-2.5 shrink-0" style={{ boxShadow: '0 1px 0 rgba(28,20,16,0.10)' }}>
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-sm font-black shrink-0" style={{ color: '#1B3828' }}>{activeDoc.docCode}</span>
            <span className="text-sm font-semibold truncate min-w-0" style={{ color: '#1C1410' }}>{activeDoc.title}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {STAGE_ORDER.map((s) => (
              <span key={s} className="text-[11px] px-2 py-0.5 rounded-full font-bold"
                style={{ backgroundColor: stage === s ? '#1B3828' : 'transparent', color: stage === s ? '#EED98A' : '#9A8A78', boxShadow: stage === s ? 'none' : 'inset 0 0 0 1px #DDD4C0', fontFamily: "'Outfit', sans-serif" }}>
                {s === 'reading' ? t('documents_stage_reading_short') : s === 'presentation' ? t('documents_stage_presentation') : t('documents_stage_qa')}
              </span>
            ))}
          </div>
          {/* Zoom belongs to the chair, not to the stage: it survives every stage change. */}
          <div className="ms-auto flex items-center gap-1 shrink-0">
            <button type="button" onClick={() => setZoom((z) => { const n = stepZoom(z, -1); writeZoom(n); return n; })}
              disabled={zoom === ZOOM_STEPS[0]}
              aria-label={t('documents_zoom_out')} title={t('documents_zoom_out')}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-[#6A5A4A] hover:text-[#1B3828] hover:bg-[#1B3828]/[0.07] disabled:opacity-35 disabled:hover:bg-transparent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]">
              <Minus size={16} strokeWidth={2.6} aria-hidden />
            </button>
            <button type="button" onClick={() => { setZoom(1); writeZoom(1); }}
              aria-label={t('documents_zoom_reset')} title={t('documents_zoom_reset')}
              className="min-w-[52px] h-9 px-2 rounded-lg text-xs font-bold tabular-nums text-[#6A5A4A] hover:text-[#1B3828] hover:bg-[#1B3828]/[0.07] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]">
              {Math.round(zoom * 100)}%
            </button>
            <button type="button" onClick={() => setZoom((z) => { const n = stepZoom(z, 1); writeZoom(n); return n; })}
              disabled={zoom === ZOOM_STEPS[ZOOM_STEPS.length - 1]}
              aria-label={t('documents_zoom_in')} title={t('documents_zoom_in')}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-[#6A5A4A] hover:text-[#1B3828] hover:bg-[#1B3828]/[0.07] disabled:opacity-35 disabled:hover:bg-transparent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]">
              <Plus size={16} strokeWidth={2.6} aria-hidden />
            </button>
            {!timerOpen && (
              <button type="button" onClick={() => setTimerOpen(true)}
                aria-label={t('documents_timer_show')} title={t('documents_timer_show')}
                className="ms-1 h-9 ps-2.5 pe-3 rounded-lg flex items-center gap-1.5 text-xs font-bold bg-[#1B3828] text-[#EED98A] transition-[background-color,transform] duration-150 active:scale-[0.96] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]/40">
                <Timer size={15} strokeWidth={2.4} aria-hidden />
                {t('documents_timer_show')}
              </button>
            )}
            {/* Closing leaves the paper introduced. A working paper's card offers Introduce
                again; a draft resolution goes to the voting page. */}
            <button onClick={() => { closeFlow(); onClose(); }} aria-label={t('sb_close')}
              className="ms-1 w-9 h-9 rounded-lg flex items-center justify-center text-[#9A8A78] hover:text-[#1C1410] hover:bg-[#1B3828]/[0.07] transition-colors text-lg leading-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]">✕</button>
          </div>
        </div>
        {flowErrorBanner}
        <div className="flex-1 min-h-0 relative">
          {/* Mounted once for the whole introduction: a stage change never remounts it, so the
              zoom and the scroll position stay exactly where the chair left them. */}
          <IntroDocument doc={activeDoc} zoom={zoom} />
          {/* A stage with a 0-minute timer renders as already complete (Continue), never blank. */}
          {timerOpen && (
            <IntroTimerPanel label={stageLabel}
              totalSeconds={timings[stage] * 60} doc={activeDoc} committee={committee}
              clock={clock} onClockChange={handleClockChange}
              onComplete={() => advanceFromStage(stage)}
              onBack={() => backFromStage(stage)}
              onHide={() => setTimerOpen(false)} />
          )}
        </div>
      </div></Portal>
    );
  }

  // Timing setup screen
  if (activeDoc && stage === 'setup') {
    return (
      <Portal><div className="fixed inset-0 z-50 bg-[#F6F1E9] flex flex-col">
        <div className="flex items-center justify-between px-6 pt-4 pb-2 border-b border-[#DDD4C0] shrink-0">
          <span className="text-sm font-black tracking-wide" style={{ color: '#1B3828', fontFamily: "'Outfit', sans-serif" }}>{t('documents_introduce_header')}</span>
          <button onClick={closeFlow} className="text-[#9A8A78] hover:text-[#1C1410] transition-colors text-xl">✕</button>
        </div>
        {flowErrorBanner}
        <TimingSetup doc={activeDoc} committee={committee} onStart={handleTimingConfirmed} onSkip={handleSkipToVote} />
      </div></Portal>
    );
  }

  return (
    // Grows out of the Documents tab, rendered from the documents already on the committee:
    // nothing waits on the network, so a slow connection cannot delay the opening.
    <GrowDialog
      originSelector='[data-tutorial="tab-documents"]'
      onClose={onClose}
      ariaLabel={t('documents_title')}
      panelClassName="bg-[#EDE7D8] border border-[#DDD4C0] rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden max-h-[92%] flex flex-col"
    >
      {(requestClose) => (<>
        <div className="flex items-center justify-between px-7 pt-6 pb-4 shrink-0 border-b border-[#DDD4C0]">
          <h2 className="text-2xl font-black text-[#1C1410]">{t('documents_title')}</h2>
          <button onClick={requestClose} aria-label={t('sb_close')} className="text-[#9A8A78] hover:text-[#1C1410] transition-colors text-xl leading-none focus:outline-none">✕</button>
        </div>

        {!showForm && (
          <div className="flex gap-2 px-7 pt-4 shrink-0">
            {(['working-paper', 'draft-resolution'] as const).map((tabItem) => {
              const count = (committee.documents ?? []).filter((d) => d.type === tabItem && (d.status === 'submitted' || d.status === 'on-floor')).length;
              return (
                <button key={tabItem} onClick={() => setTab(tabItem)}
                  className={`gv-lift flex-1 py-2.5 rounded-xl font-bold text-sm transition-colors relative ${tab === tabItem ? 'bg-[#1B3828] text-white' : 'bg-[#EDE7D8] border border-[#DDD4C0] text-[#6A5A4A] hover:border-[#1B3828]'}`}>
                  {docName(committee, tabItem, 'plural', tabItem === 'working-paper' ? t('documents_working_papers_tab') : t('documents_draft_resolutions_tab'))}
                  {count > 0 && (
                    <span className={`ms-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-black ${tab === tabItem ? 'bg-white/30 text-white' : 'bg-[#1B3828] text-white'}`}>{count}</span>
                  )}
                </button>
              );
            })}
            {/* Straight to the voting page, which picks the draft resolution and runs the roll
                call. Carries ?chairName= like Go to voting. Moderator only (UI gate, RULE 15). */}
            {!isViewOnly && (
              <button
                type="button"
                onClick={goToVoting}
                title={t('documents_vote_title')}
                aria-label={t('documents_vote_title')}
                className="shrink-0 inline-flex items-center gap-1.5 px-3 rounded-xl font-bold text-sm bg-[#EED98A] hover:bg-[#E6CD6E] text-[#1B3828] transition-[background-color,transform] duration-150 active:scale-[0.96] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]/40"
                style={{ fontFamily: "'Outfit', sans-serif" }}
              >
                <Vote size={15} strokeWidth={2.2} aria-hidden />
                {t('documents_vote_btn')}
              </button>
            )}
          </div>
        )}

        <div className="overflow-y-auto flex-1 min-h-0 pt-4">
          {showForm ? (
            <SubmitForm committee={committee} type={tab} onDone={() => setShowForm(false)} onDocumentAdded={handleDocumentAdded} />
          ) : (
            <div className="px-7 pb-7 space-y-3">
              {flowErrorBanner}
              {/* The full-width GO TO VOTING banner is gone (16 Sep 2026). The small Vote
                  button beside the tabs is the one way to the voting page from here. */}
              {docs.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-2xl font-black mb-1" style={{ color: '#1B3828' }}>{t('documents_empty_doc', { doc: tabPluralName })}</p>
                  <p className="text-sm mt-1" style={{ color: '#9A8A78' }}>{t('documents_empty_sub')}</p>
                </div>
              ) : (
                docs.map((doc) => (
                  <DocCard key={doc.id} doc={doc} committee={committee}
                    onRemove={handleRemove}
                    onStartPresentation={handleStartPresentation}
                    requireApproval={requireDocApproval} onApprovalChange={handleApprovalChange}
                    isViewOnly={isViewOnly} />
                ))
              )}
              {!isViewOnly && (
                <button onClick={() => setShowForm(true)}
                  className="w-full bg-[#EDE7D8] hover:bg-[#DDD4C0] border border-[#DDD4C0] hover:border-[#1B3828] text-[#1C1410] py-3.5 rounded-2xl font-bold transition-all mt-2 text-center focus:outline-none gv-lift" style={{ fontFamily: "'Outfit', sans-serif" }}>
                  + {t('documents_submit_new_doc', { doc: tabSingularName })}
                </button>
              )}
            </div>
          )}
        </div>
      </>)}
    </GrowDialog>
  );
}