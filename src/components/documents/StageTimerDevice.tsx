'use client';

/**
 * StageTimerDevice: the introduction's stage clock, floating over the paper.
 *
 * 17 Sep 2026, second pass (owner: "too tacky, make it a more neutral colour and visible, make
 * sure Resume is not cut off, add the flags of the sponsors"): a calm warm-white card with a
 * soft forest-tinted shadow, large ink tabular digits, one thin progress bar, a status dot
 * (forest while running), quiet keys and ONE forest primary key (Start / Pause / Resume /
 * Continue). The sponsors sit in the header as overlapping round flags with +N.
 *
 * - Resizable on BOTH axes from all four edges and corners; minimum 176 x 64. A short box lays
 *   out in one row (clock | keys), a taller one stacks. Every text that has to fit is MEASURED
 *   (hidden 100 px rulers), never guessed: the keys fold away in the order previous stage,
 *   reset, next, and only then does the primary key drop its label to its icon. A label is
 *   never clipped. The sponsor flags fold away before the stage label does.
 * - Moved by dragging the card anywhere that is not a key; keyboard: Arrow keys on the focused
 *   header move it, on the focused corner grip resize it (Shift = 64 px).
 * - The box is remembered per device in `localStorage gavelling-intro-timer-device`.
 * - Anchor-based (V-5, RULE 6b): the clock is {base, startedAt} on the database clock and the
 *   remaining time is DERIVED. The 500 ms interval only refreshes `now` inside this component;
 *   it never writes anything, and moving or resizing writes nothing but localStorage.
 */
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronsRight, Minimize2, Pause, Play, RotateCcw } from 'lucide-react';
import { useT, useLanguage } from '@/contexts/LanguageContext';
import { SeatCircleFlag } from '@/components/CircleFlag';
import { getCountryDisplayName } from '@/lib/countries';
import { serverNow, serverNowIso } from '@/lib/serverClock';
import { introRemainingNow } from '@/lib/documentFlow';

type Box = { x: number; y: number; w: number; h: number };
type Edge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

const MARGIN = 12;
export const DEVICE_MIN_W = 176;
export const DEVICE_MIN_H = 64;
const DEF_W = 320;
const DEF_H = 204;
const BOX_KEY = 'gavelling-intro-timer-device';

const clampN = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Portal mounts into FitToScreen's scaled `#fit-root`: bounds are its own size, pointer deltas
 *  are divided by its live scale. */
function space() {
  const root = typeof document !== 'undefined' ? document.getElementById('fit-root') : null;
  if (root && root.offsetWidth > 0) {
    const r = root.getBoundingClientRect();
    return { w: root.offsetWidth, h: root.offsetHeight, scale: r.width / root.offsetWidth || 1 };
  }
  return { w: window.innerWidth, h: window.innerHeight, scale: 1 };
}

function clampBox(b: Box): Box {
  const { w: fw, h: fh } = space();
  const w = clampN(b.w, DEVICE_MIN_W, Math.max(DEVICE_MIN_W, fw - 2 * MARGIN));
  const h = clampN(b.h, DEVICE_MIN_H, Math.max(DEVICE_MIN_H, fh - 2 * MARGIN));
  return {
    w, h,
    x: clampN(b.x, MARGIN, Math.max(MARGIN, fw - w - MARGIN)),
    y: clampN(b.y, MARGIN, Math.max(MARGIN, fh - h - MARGIN)),
  };
}

function readBox(): Box | null {
  try {
    const p = JSON.parse(localStorage.getItem(BOX_KEY) ?? 'null');
    return [p?.x, p?.y, p?.w, p?.h].every((n) => Number.isFinite(n)) ? { x: p.x, y: p.y, w: p.w, h: p.h } : null;
  } catch { return null; }
}
function writeBox(b: Box) {
  try {
    localStorage.setItem(BOX_KEY, JSON.stringify({ x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.w), h: Math.round(b.h) }));
  } catch { /* storage blocked */ }
}

// ── Palette: calm and neutral (17 Sep 2026, owner: "too tacky, a more neutral colour") ──
const BODY = '#FFFDF8';
const INK = '#1C1410';
const INK_SOFT = '#5C4E40';
const FOREST = '#1B3828';
const DONE = '#8B2020';
const OUTFIT = "'Outfit', sans-serif";

const two = (n: number) => String(n).padStart(2, '0');
const clockText = (s: number) => `${two(Math.min(99, Math.floor(s / 60)))}:${two(s % 60)}`;
const spoken = (s: number) => `${Math.floor(s / 60)}:${two(s % 60)}`;

/** Every text the device fits is measured once at 100 px in hidden spans and scaled linearly,
 *  so a label is never cut off: it is shown only when its real width fits, otherwise the key
 *  folds to its icon. Re-measured when the fonts finish loading (a ResizeObserver on the spans). */
const MEASURE_PX = 100;

// ── Keys ─────────────────────────────────────────────────────────────────────
function Key({ size, width, primary = false, label, onClick, children, text, textSize }: {
  size: number; width: number; primary?: boolean; label: string; onClick: () => void;
  children: React.ReactNode; text?: string; textSize: number;
}) {
  return (
    <button
      type="button"
      data-device-key
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`shrink-0 flex items-center justify-center font-semibold whitespace-nowrap select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FFFDF8] transition-[transform,background-color,color] duration-150 ease-out active:scale-[0.96] ${
        primary
          ? 'bg-[#1B3828] hover:bg-[#244A36] text-[#FAF8F3]'
          : 'bg-[rgba(28,20,16,0.05)] hover:bg-[rgba(27,56,40,0.10)] text-[#5C4E40] hover:text-[#1B3828]'
      }`}
      style={{
        width, height: size,
        gap: Math.round(size * 0.18),
        borderRadius: Math.round(size * 0.3),
        fontFamily: OUTFIT,
        fontSize: textSize,
        boxShadow: primary ? '0 1px 2px rgba(27,56,40,0.20), 0 4px 10px rgba(27,56,40,0.14)' : undefined,
      }}
    >
      {children}
      {text && <span>{text}</span>}
    </button>
  );
}

export default function StageTimerDevice({
  label, totalSeconds, sponsors, sponsorsWord, clock, onClockChange, onComplete, onBack, onHide,
}: {
  label: string; totalSeconds: number;
  /** The paper's sponsors (country names), drawn as round flags in the header. */
  sponsors: string[];
  /** The committee's word for sponsors (renameable), for the flags' accessible name. */
  sponsorsWord: string;
  clock: { base: number; startedAt: string | null };
  onClockChange: (next: { base: number; startedAt: string | null }) => void;
  onComplete: () => void; onBack: () => void; onHide: () => void;
}) {
  const t = useT();
  const { language } = useLanguage();
  const [now, setNow] = useState(() => serverNow());
  const running = !!clock.startedAt;
  useEffect(() => {
    // Paused: the remaining time is the base whatever `now` is, so nothing to refresh.
    if (!running) return;
    const id = setInterval(() => setNow(serverNow()), 500);
    return () => clearInterval(id);
  }, [running, clock.startedAt, clock.base]);
  const remaining = introRemainingNow(clock, now);
  const started = running || clock.base < totalSeconds;
  const done = remaining === 0;
  const warn = !done && remaining <= 30 && totalSeconds > 30;

  // ── Box ──
  const [box, setBox] = useState<Box | null>(() => {
    if (typeof window === 'undefined') return null;
    const { w: fw, h: fh } = space();
    const rtl = document.documentElement.dir === 'rtl';
    return clampBox(readBox() ?? { w: DEF_W, h: DEF_H, x: rtl ? 24 : fw - DEF_W - 24, y: Math.max(MARGIN, fh - DEF_H - 24) });
  });
  const boxRef = useRef<Box | null>(box);
  const [busy, setBusy] = useState<'move' | 'resize' | null>(null);

  const apply = useCallback((next: Box, persist: boolean) => {
    const c = clampBox(next);
    boxRef.current = c;
    setBox(c);
    if (persist) writeBox(c);
  }, []);

  useEffect(() => {
    const onResize = () => { if (boxRef.current) apply(boxRef.current, false); };
    window.addEventListener('resize', onResize);
    const root = document.getElementById('fit-root');
    const ro = root && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(onResize) : null;
    if (root) ro?.observe(root);
    return () => { window.removeEventListener('resize', onResize); ro?.disconnect(); };
  }, [apply]);

  const detach = useRef<(() => void) | null>(null);
  useEffect(() => () => detach.current?.(), []);

  const begin = (mode: 'move' | Edge) => (e: React.PointerEvent<HTMLElement>) => {
    if (e.button !== 0 || !boxRef.current) return;
    if (mode === 'move' && (e.target as HTMLElement).closest('[data-device-key],[data-device-edge]')) return;
    e.preventDefault();
    e.stopPropagation();
    const start = { x: e.clientX, y: e.clientY, b: boxRef.current, scale: space().scale, id: e.pointerId };
    setBusy(mode === 'move' ? 'move' : 'resize');
    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== start.id) return;
      const dx = (ev.clientX - start.x) / start.scale;
      const dy = (ev.clientY - start.y) / start.scale;
      const b = start.b;
      if (mode === 'move') { apply({ ...b, x: b.x + dx, y: b.y + dy }, false); return; }
      const { w: fw, h: fh } = space();
      let { x, y, w, h } = b;
      if (mode.includes('e')) w = clampN(b.w + dx, DEVICE_MIN_W, fw - MARGIN - b.x);
      if (mode.includes('s')) h = clampN(b.h + dy, DEVICE_MIN_H, fh - MARGIN - b.y);
      if (mode.includes('w')) { w = clampN(b.w - dx, DEVICE_MIN_W, b.x + b.w - MARGIN); x = b.x + b.w - w; }
      if (mode.includes('n')) { h = clampN(b.h - dy, DEVICE_MIN_H, b.y + b.h - MARGIN); y = b.y + b.h - h; }
      apply({ x, y, w, h }, false);
    };
    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== start.id) return;
      detach.current?.();
      setBusy(null);
      if (boxRef.current) writeBox(boxRef.current);
    };
    window.addEventListener('pointermove', onMove, true);
    window.addEventListener('pointerup', onUp, true);
    window.addEventListener('pointercancel', onUp, true);
    detach.current = () => {
      window.removeEventListener('pointermove', onMove, true);
      window.removeEventListener('pointerup', onUp, true);
      window.removeEventListener('pointercancel', onUp, true);
      detach.current = null;
    };
  };

  const onKey = (mode: 'move' | 'resize') => (e: React.KeyboardEvent<HTMLElement>) => {
    const b = boxRef.current;
    if (!b) return;
    const step = e.shiftKey ? 64 : 16;
    const m = ({ ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] } as Record<string, [number, number]>)[e.key];
    if (!m) return;
    e.preventDefault();
    apply(mode === 'move' ? { ...b, x: b.x + m[0], y: b.y + m[1] } : { ...b, w: b.w + m[0], h: b.h + m[1] }, true);
  };

  // ── Measurement ──
  const labels = {
    start: t('documents_timer_start'), resume: t('documents_timer_resume'),
    pause: t('documents_timer_pause'), cont: t('documents_timer_continue'),
  };
  const digitsRef = useRef<HTMLSpanElement>(null);
  const labelsRef = useRef<HTMLSpanElement>(null);
  const [metrics, setMetrics] = useState<{ digits: number; label: number } | null>(null);
  const labelKey = `${labels.start}|${labels.resume}|${labels.pause}|${labels.cont}`;
  useLayoutEffect(() => {
    const measure = () => {
      const d = digitsRef.current?.getBoundingClientRect().width ?? 0;
      const spans = labelsRef.current ? Array.from(labelsRef.current.children) as HTMLElement[] : [];
      const l = Math.max(0, ...spans.map((el) => el.getBoundingClientRect().width));
      const scale = space().scale || 1;
      if (d > 0) setMetrics((m) => {
        const next = { digits: d / scale, label: l / scale };
        return m && Math.abs(m.digits - next.digits) < 0.5 && Math.abs(m.label - next.label) < 0.5 ? m : next;
      });
    };
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (digitsRef.current) ro?.observe(digitsRef.current);
    labelsRef.current?.childNodes.forEach((n) => ro?.observe(n as Element));
    let alive = true;
    void document.fonts?.ready.then(() => { if (alive) measure(); });
    return () => { alive = false; ro?.disconnect(); };
  }, [labelKey]);
  // Fallbacks until measured: Outfit's tabular "88:88" is about 2.6 em wide.
  const digitsPerPx = (metrics?.digits ?? 262) / MEASURE_PX;
  const labelPerPx = (metrics?.label ?? 330) / MEASURE_PX;

  // ── Layout from the box ──
  const w = box?.w ?? DEF_W;
  const h = box?.h ?? DEF_H;
  /** Short boxes lay out in one row (clock | keys); taller ones stack (clock over keys). */
  const row = h < 124 || (w / h >= 2.8 && h < 170);
  const pad = Math.round(clampN(Math.min(w, h) * 0.075, 7, 16));
  const gap = Math.round(clampN(pad * 0.7, 4, 12));
  const headH = Math.round(row ? clampN(h * 0.2, 14, 24) : clampN(h * 0.13, 22, 32));
  const innerW = w - 2 * pad;
  const barH = row ? 3 : Math.round(clampN(h * 0.02, 3, 6));

  const keySize = Math.round(row
    ? clampN((h - 2 * pad - headH - gap) * 0.8, 22, 44)
    : clampN(Math.min(h * 0.22, innerW / 4.1), 28, 56));
  const keyGap = Math.round(clampN(keySize * 0.18, 4, 10));
  const textSize = Math.round(clampN(keySize * 0.36, 12, 17) * 2) / 2;
  const iconPx = Math.round(keySize * 0.4);
  const primaryIconW = Math.round(keySize * 1.3);
  const primaryLabelW = Math.ceil(2 * keySize * 0.36 + iconPx + keySize * 0.18 + labelPerPx * textSize + 4);

  const primaryText = done ? labels.cont : running ? labels.pause : started ? labels.resume : labels.start;
  // Candidates in order of preference: every key with the label, then the least used keys fold
  // away (previous stage, reset), then next, and only then does the primary lose its label.
  type Keys = { back: boolean; reset: boolean; next: boolean; text: boolean };
  const candidates: Keys[] = [
    { back: true, reset: true, next: true, text: true },
    { back: false, reset: true, next: true, text: true },
    { back: false, reset: false, next: true, text: true },
    { back: false, reset: false, next: false, text: true },
    { back: false, reset: false, next: true, text: false },
    { back: false, reset: false, next: false, text: false },
  ];
  const keysWidth = (k: Keys) => {
    const widths = [k.back ? keySize : 0, k.reset ? keySize : 0, k.text ? primaryLabelW : primaryIconW, k.next && !done ? keySize : 0].filter((x) => x > 0);
    return widths.reduce((a, b) => a + b, 0) + (widths.length - 1) * keyGap;
  };
  // Row: the clock shares the width with the keys and must stay readable.
  const rowH = h - 2 * pad - headH - gap;
  const rowDigitsCap = rowH * 1.05;
  const rowDigitsMin = Math.min(rowDigitsCap, 26);
  let chosen = candidates[candidates.length - 1];
  for (const c of candidates) {
    const avail = row ? innerW - keysWidth(c) - gap : innerW - keysWidth(c);
    if (row ? avail / digitsPerPx >= rowDigitsMin : avail >= 0) { chosen = c; break; }
  }
  const digitsH = row ? rowH : h - 2 * pad - headH - keySize - barH - 3 * gap;
  const digitsFont = Math.max(12, Math.floor(row
    ? Math.min(rowDigitsCap, (innerW - keysWidth(chosen) - gap) / digitsPerPx)
    : Math.min(digitsH * 1.1, (innerW * 0.92) / digitsPerPx, 220)));
  const radius = Math.round(keySize * 0.3 + pad);

  // Sponsors in the header, overlapping, with +N; they fold away before the stage label does.
  const hideW = Math.max(22, headH + 4);
  const flagSize = Math.round(clampN(headH * 0.92, 16, 28));
  const flagStep = Math.round(flagSize * 0.74);
  const flagRoom = innerW - hideW - 96 - 8;
  let flagSlots = headH >= 16 && flagRoom >= flagSize ? Math.floor((flagRoom - flagSize) / flagStep) + 1 : 0;
  flagSlots = Math.min(flagSlots, 5);
  let shownFlags = Math.min(sponsors.length, flagSlots);
  if (shownFlags < sponsors.length && shownFlags > 0) shownFlags = flagSlots - 1;
  const extraFlags = sponsors.length - shownFlags;
  const showFlags = shownFlags > 0;
  const sponsorNames = sponsors.map((s) => getCountryDisplayName(s, language)).join(language === 'ar' ? '، ' : ', ');

  const toggle = () => {
    const live = introRemainingNow(clock, serverNow());
    onClockChange(running ? { base: live, startedAt: null } : { base: live, startedAt: serverNowIso() });
  };

  const digitColor = done ? DONE : running || !started ? INK : INK_SOFT;
  const fraction = totalSeconds > 0 ? remaining / totalSeconds : 0;

  const keys = (
    <div className="flex items-center shrink-0" style={{ gap: keyGap }}>
      {chosen.back && (
        <Key size={keySize} width={keySize} textSize={textSize} label={t('documents_stage_back_title')} onClick={onBack}>
          <ChevronLeft size={iconPx + 2} strokeWidth={2.2} aria-hidden className="rtl:rotate-180" />
        </Key>
      )}
      {chosen.reset && (
        <Key size={keySize} width={keySize} textSize={textSize} label={t('documents_timer_reset_title')} onClick={() => onClockChange({ base: totalSeconds, startedAt: null })}>
          <RotateCcw size={iconPx - 2} strokeWidth={2.2} aria-hidden />
        </Key>
      )}
      <Key size={keySize} width={chosen.text ? primaryLabelW : primaryIconW} primary textSize={textSize}
        label={primaryText} onClick={done ? onComplete : toggle} text={chosen.text ? primaryText : undefined}>
        {done
          ? <ChevronsRight size={iconPx} strokeWidth={2.4} aria-hidden className="rtl:rotate-180 shrink-0" />
          : running
            ? <Pause size={iconPx - 2} strokeWidth={2.4} fill="currentColor" aria-hidden className="shrink-0" />
            : <Play size={iconPx - 2} strokeWidth={2.4} fill="currentColor" aria-hidden className="rtl:rotate-180 shrink-0" style={{ marginInlineStart: 1 }} />}
      </Key>
      {chosen.next && !done && (
        <Key size={keySize} width={keySize} textSize={textSize} label={t('documents_stage_skip_title')} onClick={onComplete}>
          <ChevronRight size={iconPx + 2} strokeWidth={2.2} aria-hidden className="rtl:rotate-180" />
        </Key>
      )}
    </div>
  );

  const digits = (
    <div className="min-w-0 flex items-center" style={{ justifyContent: row ? 'flex-start' : 'center', height: row ? rowH : Math.max(16, digitsH), flex: row ? '1 1 0' : undefined }}>
      <span className="tabular-nums whitespace-nowrap" aria-hidden
        style={{ fontSize: digitsFont, lineHeight: 1, fontWeight: 600, letterSpacing: '-0.02em', color: digitColor, transition: 'color 200ms ease-out', fontFamily: OUTFIT }}>
        {clockText(remaining)}
      </span>
    </div>
  );

  const bar = (
    <div aria-hidden className="relative overflow-hidden rounded-full shrink-0" style={{ height: barH, backgroundColor: 'rgba(28,20,16,0.08)' }}>
      <div className="absolute inset-0 rounded-full origin-left rtl:origin-right"
        style={{
          transform: `scaleX(${fraction})`,
          backgroundColor: done ? DONE : warn ? '#9A4A2A' : running ? FOREST : 'rgba(27,56,40,0.45)',
          transition: running ? 'transform 500ms linear, background-color 200ms' : 'background-color 200ms',
        }} />
    </div>
  );

  const edge = 7;
  const edges: { e: Edge; style: React.CSSProperties; cursor: string }[] = [
    { e: 'n', style: { top: -edge / 2, left: radius, right: radius, height: edge }, cursor: 'ns-resize' },
    { e: 's', style: { bottom: -edge / 2, left: radius, right: radius, height: edge }, cursor: 'ns-resize' },
    { e: 'w', style: { left: -edge / 2, top: radius, bottom: radius, width: edge }, cursor: 'ew-resize' },
    { e: 'e', style: { right: -edge / 2, top: radius, bottom: radius, width: edge }, cursor: 'ew-resize' },
    { e: 'nw', style: { top: -edge / 2, left: -edge / 2, width: radius + edge / 2, height: radius + edge / 2 }, cursor: 'nwse-resize' },
    { e: 'se', style: { bottom: -edge / 2, right: -edge / 2, width: radius + edge / 2, height: radius + edge / 2 }, cursor: 'nwse-resize' },
    { e: 'ne', style: { top: -edge / 2, right: -edge / 2, width: radius + edge / 2, height: radius + edge / 2 }, cursor: 'nesw-resize' },
    { e: 'sw', style: { bottom: -edge / 2, left: -edge / 2, width: radius + edge / 2, height: radius + edge / 2 }, cursor: 'nesw-resize' },
  ];
  const labelSize = clampN(headH * 0.5, 10, 13);

  return (
    <div
      role="group"
      aria-label={t('documents_timer_panel')}
      data-stage-timer
      onPointerDown={begin('move')}
      className={`fixed flex flex-col select-none ${busy === 'move' ? 'cursor-grabbing' : 'cursor-grab'}`}
      style={{
        left: box?.x ?? 0, top: box?.y ?? 0, width: w, height: h, zIndex: 20,
        visibility: box ? 'visible' : 'hidden',
        padding: pad, gap,
        borderRadius: radius,
        backgroundColor: BODY,
        boxShadow: busy
          ? '0 0 0 1px rgba(28,20,16,0.10), 0 2px 6px rgba(27,56,40,0.10), 0 24px 56px rgba(27,56,40,0.26)'
          : '0 0 0 1px rgba(28,20,16,0.08), 0 1px 3px rgba(27,56,40,0.08), 0 14px 36px rgba(27,56,40,0.20)',
        transition: 'box-shadow 180ms cubic-bezier(0.22,1,0.36,1)',
        touchAction: 'none',
        fontFamily: OUTFIT,
      }}
    >
      {/* Hidden rulers at 100 px: the clock digits and the longest primary label. */}
      <span aria-hidden className="absolute invisible pointer-events-none whitespace-nowrap" style={{ left: 0, top: 0 }}>
        <span ref={digitsRef} className="tabular-nums inline-block" style={{ fontSize: MEASURE_PX, lineHeight: 1, fontWeight: 600, letterSpacing: '-0.02em', fontFamily: OUTFIT }}>88:88</span>
        <span ref={labelsRef}>
          {[labels.start, labels.resume, labels.pause, labels.cont].map((l, i) => (
            <span key={i} className="inline-block font-semibold" style={{ fontSize: MEASURE_PX, fontFamily: OUTFIT }}>{l}</span>
          ))}
        </span>
      </span>

      {/* Header: status dot, stage, sponsors, hide. Focus the label and use the Arrow keys to move the timer. */}
      <div className="flex items-center min-w-0 shrink-0" style={{ height: headH, gap: 8 }}>
        <div
          role="button"
          tabIndex={0}
          aria-label={t('documents_timer_move')}
          title={t('documents_timer_move')}
          onKeyDown={onKey('move')}
          className="flex-1 min-w-0 h-full flex items-center rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
          style={{ gap: Math.max(6, headH * 0.35), paddingInlineStart: 2 }}
        >
          <span aria-hidden className="shrink-0 rounded-full"
            style={{
              width: clampN(headH * 0.34, 6, 8), height: clampN(headH * 0.34, 6, 8),
              backgroundColor: running ? '#2F7A4F' : done ? DONE : 'rgba(28,20,16,0.22)',
              boxShadow: running ? '0 0 0 3px rgba(47,122,79,0.16)' : 'none',
              transition: 'background-color 200ms, box-shadow 200ms',
            }} />
          <span className="min-w-0 truncate uppercase font-semibold leading-none" aria-live="polite"
            style={{ fontSize: labelSize, letterSpacing: '0.1em', color: done ? DONE : INK_SOFT }}>
            {done ? t('documents_stage_complete').replace('{stage}', label) : label}
          </span>
        </div>
        {showFlags && (
          <span role="img" aria-label={t('documents_timer_sponsors', { label: sponsorsWord, names: sponsorNames })} title={`${sponsorsWord}: ${sponsorNames}`}
            className="shrink-0 flex items-center" style={{ paddingInlineStart: Math.round(flagSize * 0.26) }}>
            {sponsors.slice(0, shownFlags).map((s, i) => (
              <span key={`${s}-${i}`} className="rounded-full flex" style={{ marginInlineStart: -Math.round(flagSize * 0.26), zIndex: shownFlags - i, boxShadow: `0 0 0 2px ${BODY}` }}>
                <SeatCircleFlag country={s} size={flagSize} decorative />
              </span>
            ))}
            {extraFlags > 0 && (
              <span className="rounded-full flex items-center justify-center tabular-nums font-semibold"
                style={{ marginInlineStart: -Math.round(flagSize * 0.26), height: flagSize, minWidth: flagSize, paddingInline: 4, fontSize: clampN(flagSize * 0.45, 9, 11), color: INK_SOFT, backgroundColor: '#EDE7D8', boxShadow: `0 0 0 2px ${BODY}` }}>
                +{extraFlags}
              </span>
            )}
          </span>
        )}
        <button type="button" data-device-key onClick={onHide}
          aria-label={t('documents_timer_hide')} title={t('documents_timer_hide')}
          className="shrink-0 rounded-md flex items-center justify-center text-[#8A7B6A] hover:text-[#1C1410] hover:bg-[rgba(28,20,16,0.06)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
          style={{ width: hideW, height: hideW, marginBlock: -4 }}>
          <Minimize2 size={clampN(headH * 0.6, 12, 16)} strokeWidth={2.2} aria-hidden />
        </button>
      </div>

      <span className="sr-only" role="timer">{spoken(remaining)}</span>

      {row ? (
        <>
          <div className="flex-1 min-h-0 flex items-center" style={{ gap }}>
            {digits}
            {keys}
          </div>
          <div className="absolute" style={{ left: radius, right: radius, bottom: Math.max(2, Math.round(pad * 0.35)) }}>{bar}</div>
        </>
      ) : (
        <>
          {digits}
          {bar}
          <div className="flex justify-center shrink-0">{keys}</div>
        </>
      )}

      {/* Edges and corners resize. The lower inline-end corner also takes the Arrow keys. */}
      {edges.map(({ e, style, cursor }) => (
        <div key={e} data-device-edge aria-hidden onPointerDown={begin(e)} className="absolute" style={{ ...style, cursor, touchAction: 'none', zIndex: 2 }} />
      ))}
      <div
        role="button"
        tabIndex={0}
        data-device-edge
        aria-label={t('documents_timer_resize')}
        title={t('documents_timer_resize')}
        onPointerDown={begin('se')}
        onKeyDown={onKey('resize')}
        className="absolute bottom-0 right-0 flex items-end justify-end cursor-nwse-resize text-[rgba(28,20,16,0.28)] hover:text-[#1B3828] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
        style={{ width: Math.max(14, radius * 0.8), height: Math.max(14, radius * 0.8), padding: 4, borderBottomRightRadius: radius, zIndex: 3, touchAction: 'none' }}
      >
        <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden fill="none">
          <path d="M7 3v4H3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
}
