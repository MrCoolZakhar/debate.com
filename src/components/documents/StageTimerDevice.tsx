'use client';

/**
 * StageTimerDevice: the introduction's stage clock as a physical timer (17 Sep 2026).
 *
 * A forest bezel with a recessed LCD window and gold seven-segment digits (the unlit segments
 * stay faintly visible, like a real display), a status LED, three stage lamps, and small raised
 * keys: previous stage, reset, start / pause, next stage. Floating over the paper.
 *
 * - Resizable on BOTH axes from all four edges and corners; minimum 176 x 64, so it can be a
 *   slim strip. Below about 150 px high and wide enough it lays out in one row (display | keys);
 *   taller it stacks. Everything scales with the box, and when the row is too short for every
 *   key the least used ones (previous stage, then reset) fold away first.
 * - Moved by dragging the bezel anywhere that is not a key; keyboard: Arrow keys on the focused
 *   label strip move it, on the focused corner grip resize it (Shift = 64 px).
 * - The box is remembered per device in `localStorage gavelling-intro-timer-device`.
 * - Anchor-based (V-5, RULE 6b): the clock is {base, startedAt} on the database clock and the
 *   remaining time is DERIVED. The 500 ms interval only refreshes `now` inside this component;
 *   it never writes anything, and moving or resizing writes nothing but localStorage.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronsRight, Minimize2, Pause, Play, RotateCcw } from 'lucide-react';
import { useT } from '@/contexts/LanguageContext';
import { serverNow, serverNowIso } from '@/lib/serverClock';
import { introRemainingNow } from '@/lib/documentFlow';

type Box = { x: number; y: number; w: number; h: number };
type Edge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

const MARGIN = 12;
export const DEVICE_MIN_W = 176;
export const DEVICE_MIN_H = 64;
const DEF_W = 300;
const DEF_H = 176;
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

// ── Seven-segment display ─────────────────────────────────────────────────────
const DIGIT_SEGMENTS: Record<string, string> = {
  '0': 'abcdef', '1': 'bc', '2': 'abged', '3': 'abgcd', '4': 'fgbc',
  '5': 'afgcd', '6': 'afgedc', '7': 'abc', '8': 'abcdefg', '9': 'abcdfg',
};
const SEG_W = 10; const SEG_H = 18; const SEG_T = 2.1; const SEG_GAP = 0.35;

function hSeg(cx: number, cy: number, len: number) {
  const t = SEG_T / 2;
  return `${cx - len / 2},${cy} ${cx - len / 2 + t},${cy - t} ${cx + len / 2 - t},${cy - t} ${cx + len / 2},${cy} ${cx + len / 2 - t},${cy + t} ${cx - len / 2 + t},${cy + t}`;
}
function vSeg(cx: number, cy: number, len: number) {
  const t = SEG_T / 2;
  return `${cx},${cy - len / 2} ${cx + t},${cy - len / 2 + t} ${cx + t},${cy + len / 2 - t} ${cx},${cy + len / 2} ${cx - t},${cy + len / 2 - t} ${cx - t},${cy - len / 2 + t}`;
}
const t2 = SEG_T / 2;
const hLen = SEG_W - SEG_T - 2 * SEG_GAP;
const vLen = SEG_H / 2 - t2 - 2 * SEG_GAP;
const SEGMENTS: Record<string, string> = {
  a: hSeg(SEG_W / 2, t2, hLen),
  g: hSeg(SEG_W / 2, SEG_H / 2, hLen),
  d: hSeg(SEG_W / 2, SEG_H - t2, hLen),
  f: vSeg(t2, SEG_H / 4 + t2 / 2, vLen),
  b: vSeg(SEG_W - t2, SEG_H / 4 + t2 / 2, vLen),
  e: vSeg(t2, (3 * SEG_H) / 4 - t2 / 2, vLen),
  c: vSeg(SEG_W - t2, (3 * SEG_H) / 4 - t2 / 2, vLen),
};

function SegmentDigits({ text, lit, glow }: { text: string; lit: string; glow: boolean }) {
  // "MM:SS": digits at 0, 13, 33, 46; colon centred at 28.
  const xs = [0, 13, 33, 46];
  const digits = text.replace(':', '').split('');
  return (
    <svg viewBox="-2.5 -1 61 20" preserveAspectRatio="xMidYMid meet" className="w-full h-full block" aria-hidden
      style={{ overflow: 'visible', filter: glow ? `drop-shadow(0 0 0.35px ${lit}) drop-shadow(0 0 3px ${lit}55)` : undefined }}>
      <g transform="skewX(-6) translate(1.2 0)">
        {xs.map((x, i) => (
          <g key={i} transform={`translate(${x} 0)`}>
            {Object.entries(SEGMENTS).map(([k, pts]) => (
              <polygon key={k} points={pts}
                fill={DIGIT_SEGMENTS[digits[i]]?.includes(k) ? lit : 'rgba(238,217,138,0.075)'} />
            ))}
          </g>
        ))}
        <circle cx={28} cy={SEG_H * 0.32} r={1.25} fill={lit} />
        <circle cx={28} cy={SEG_H * 0.68} r={1.25} fill={lit} />
      </g>
    </svg>
  );
}

const two = (n: number) => String(n).padStart(2, '0');
const lcdText = (s: number) => `${two(Math.min(99, Math.floor(s / 60)))}:${two(s % 60)}`;
const spoken = (s: number) => `${Math.floor(s / 60)}:${two(s % 60)}`;

// ── Keys ─────────────────────────────────────────────────────────────────────
function Key({ size, wide = 1, gold = false, label, onClick, children, showLabel }: {
  size: number; wide?: number; gold?: boolean; label: string; onClick: () => void;
  children: React.ReactNode; showLabel?: string;
}) {
  const depth = Math.max(1.5, Math.round(size * 0.06));
  return (
    <button
      type="button"
      data-device-key
      onClick={onClick}
      aria-label={label}
      title={label}
      className="group relative shrink-0 flex items-center justify-center gap-1.5 font-bold select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EED98A] focus-visible:ring-offset-1 focus-visible:ring-offset-[#1B3828] transition-[transform,box-shadow] duration-100 ease-out active:scale-[0.96] active:translate-y-[1px]"
      style={{
        width: size * wide, height: size,
        borderRadius: Math.max(6, size * 0.26),
        color: gold ? '#1B3828' : '#EDE3C8',
        background: gold
          ? 'linear-gradient(180deg,#F5E7AC 0%,#E9D17A 55%,#DDBF5C 100%)'
          : 'linear-gradient(180deg,#34644A 0%,#264D38 55%,#20432F 100%)',
        boxShadow: gold
          ? `inset 0 1px 0 rgba(255,255,255,0.55), 0 ${depth}px 0 #9C7F28, 0 ${depth + 2}px 6px rgba(0,0,0,0.28)`
          : `inset 0 1px 0 rgba(255,255,255,0.13), 0 ${depth}px 0 #0D2016, 0 ${depth + 2}px 6px rgba(0,0,0,0.30)`,
        fontFamily: "'Outfit', sans-serif",
        fontSize: clampN(size * 0.3, 10, 14),
        letterSpacing: '0.06em',
      }}
    >
      {children}
      {showLabel && <span className="truncate uppercase">{showLabel}</span>}
    </button>
  );
}

export type StageLamp = { key: string; label: string; active: boolean; skipped: boolean };

export default function StageTimerDevice({
  label, totalSeconds, docCode, stages, clock, onClockChange, onComplete, onBack, onHide,
}: {
  label: string; totalSeconds: number; docCode: string;
  stages: StageLamp[];
  clock: { base: number; startedAt: string | null };
  onClockChange: (next: { base: number; startedAt: string | null }) => void;
  onComplete: () => void; onBack: () => void; onHide: () => void;
}) {
  const t = useT();
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

  // ── Layout from the box ──
  const w = box?.w ?? DEF_W;
  const h = box?.h ?? DEF_H;
  const slim = h < 150 && w / h >= 1.7;
  const pad = Math.round(clampN(Math.min(w, h) * 0.07, 6, 14));
  const radius = Math.round(clampN(Math.min(w, h) * 0.14, 12, 22));
  const headH = Math.round(slim ? clampN(h * 0.2, 14, 22) : clampN(h * 0.085, 18, 28));
  const gap = Math.round(clampN(pad * 0.75, 5, 10));

  // Keys: in the slim row they are as tall as the row; stacked they get their own row.
  const rowH = h - headH - pad * 2 - (slim ? gap * 0.5 : 0);
  let keySize: number;
  let lcdH: number;
  if (slim) {
    keySize = Math.round(clampN(rowH * 0.45, 22, 44));
    lcdH = rowH;
  } else {
    keySize = Math.round(clampN(Math.min(h * 0.19, (w - 2 * pad) / 5.4), 26, 64));
    lcdH = rowH - keySize - gap - 4;
  }
  const playWide = slim ? 1.35 : 1.8;
  const keyGap = Math.round(clampN(keySize * 0.2, 4, 10));
  // How many keys fit beside (slim) or under (stacked) the display. Priority: play, next, reset, back.
  const availKeysW = slim ? w - 2 * pad - Math.max(lcdH * 1.5, 70) - gap : w - 2 * pad;
  const widthFor = (n: number) => keySize * playWide + (n - 1) * keySize + (n - 1) * keyGap;
  let keyCount = 4;
  while (keyCount > 1 && widthFor(keyCount) > availKeysW) keyCount--;
  const showNext = keyCount >= 2 && !done;
  const showReset = keyCount >= 3;
  const showBack = keyCount >= 4;
  const showPlayLabel = !slim && widthFor(keyCount) + keySize * 1.4 < availKeysW;
  const showLamps = w >= 230;
  const showCode = !slim && w >= 300;

  const lit = done ? '#F2C77A' : warn ? '#F4A259' : '#EED98A';
  const ticks = 24;
  const litTicks = totalSeconds > 0 ? Math.ceil((remaining / totalSeconds) * ticks) : 0;
  const tickH = Math.round(clampN(lcdH * 0.05, 2, 4));
  const showTicks = lcdH >= 34;
  const lcdPadY = Math.round(clampN(lcdH * 0.1, 3, 12));

  const toggle = () => {
    const live = introRemainingNow(clock, serverNow());
    onClockChange(running ? { base: live, startedAt: null } : { base: live, startedAt: serverNowIso() });
  };

  const startLabel = started ? t('documents_resume_btn').replace(/▶\s*/g, '').trim() : t('documents_start_btn').replace(/\s*[→←]\s*/g, ' ').trim();

  const keys = (
    <div className="flex items-center shrink-0" style={{ gap: keyGap, paddingBottom: Math.max(2, Math.round(keySize * 0.06)) }}>
      {showBack && (
        <Key size={keySize} label={t('documents_stage_back_title')} onClick={onBack}>
          <ChevronLeft size={keySize * 0.42} strokeWidth={2.6} aria-hidden className="rtl:rotate-180" />
        </Key>
      )}
      {showReset && (
        <Key size={keySize} label={t('documents_timer_reset_title')} onClick={() => onClockChange({ base: totalSeconds, startedAt: null })}>
          <RotateCcw size={keySize * 0.36} strokeWidth={2.6} aria-hidden />
        </Key>
      )}
      {done ? (
        <Key size={keySize} wide={playWide} gold label={t('documents_continue_btn').replace(/\s*[→←]\s*/g, ' ').trim()} onClick={onComplete}
          showLabel={showPlayLabel ? t('documents_continue_btn').replace(/\s*[→←]\s*/g, ' ').trim() : undefined}>
          <ChevronsRight size={keySize * 0.42} strokeWidth={2.6} aria-hidden className="rtl:rotate-180 shrink-0" />
        </Key>
      ) : (
        <Key size={keySize} wide={playWide} gold label={running ? t('documents_pause_btn') : startLabel} onClick={toggle}
          showLabel={showPlayLabel ? (running ? t('documents_pause_btn') : startLabel) : undefined}>
          {running
            ? <Pause size={keySize * 0.36} strokeWidth={2.6} fill="currentColor" aria-hidden className="shrink-0" />
            : <Play size={keySize * 0.36} strokeWidth={2.6} fill="currentColor" aria-hidden className="rtl:rotate-180 shrink-0" style={{ marginInlineStart: keySize * 0.04 }} />}
        </Key>
      )}
      {showNext && (
        <Key size={keySize} label={t('documents_stage_skip_title')} onClick={onComplete}>
          <ChevronRight size={keySize * 0.42} strokeWidth={2.6} aria-hidden className="rtl:rotate-180" />
        </Key>
      )}
    </div>
  );

  const lcd = (
    <div
      className="relative min-w-0 flex flex-col"
      style={{
        flex: slim ? '1 1 0' : undefined,
        height: Math.max(20, lcdH),
        borderRadius: Math.max(4, radius - pad),
        padding: `${lcdPadY}px ${Math.round(clampN(lcdH * 0.18, 6, 18))}px`,
        background: 'radial-gradient(120% 90% at 30% 0%, #173524 0%, #0C1D14 55%, #08150E 100%)',
        boxShadow: 'inset 0 2px 5px rgba(0,0,0,0.65), inset 0 0 0 1px rgba(0,0,0,0.55), 0 1px 0 rgba(255,255,255,0.07)',
      }}
    >
      <div className={`flex-1 min-h-0 ${done ? 'gv-device-blink' : ''}`}>
        <SegmentDigits text={lcdText(remaining)} lit={lit} glow />
      </div>
      {showTicks && (
        <div className="flex shrink-0" style={{ gap: Math.max(1, tickH * 0.6), marginTop: Math.max(2, tickH) }} aria-hidden>
          {Array.from({ length: ticks }, (_, i) => (
            <span key={i} className="flex-1" style={{ height: tickH, borderRadius: 1, backgroundColor: i < litTicks ? lit : 'rgba(238,217,138,0.09)', opacity: i < litTicks ? 0.85 : 1 }} />
          ))}
        </div>
      )}
      {/* Glass: one soft highlight across the top of the window. */}
      <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0" style={{ height: '45%', borderRadius: 'inherit', background: 'linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0))' }} />
    </div>
  );

  const labelSize = clampN(headH * 0.52, 9, 12.5);
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

  return (
    <div
      role="group"
      aria-label={t('documents_timer_panel')}
      onPointerDown={begin('move')}
      className={`fixed flex flex-col select-none ${busy === 'move' ? 'cursor-grabbing' : 'cursor-grab'}`}
      style={{
        left: box?.x ?? 0, top: box?.y ?? 0, width: w, height: h, zIndex: 20,
        visibility: box ? 'visible' : 'hidden',
        padding: pad, gap: slim ? gap * 0.5 : gap,
        borderRadius: radius,
        background: 'linear-gradient(180deg,#2A5540 0%,#1E3F2D 38%,#183424 100%)',
        boxShadow: busy
          ? '0 0 0 1px rgba(6,16,10,0.7), inset 0 1px 0 rgba(255,255,255,0.14), inset 0 -2px 0 rgba(0,0,0,0.25), 0 8px 16px rgba(27,56,40,0.26), 0 30px 64px rgba(27,56,40,0.40)'
          : '0 0 0 1px rgba(6,16,10,0.6), inset 0 1px 0 rgba(255,255,255,0.12), inset 0 -2px 0 rgba(0,0,0,0.22), 0 3px 8px rgba(27,56,40,0.22), 0 18px 42px rgba(27,56,40,0.34)',
        transition: 'box-shadow 180ms cubic-bezier(0.22,1,0.36,1)',
        touchAction: 'none',
        fontFamily: "'Outfit', sans-serif",
      }}
    >
      <style>{`@keyframes gvDeviceBlink{0%,55%{opacity:1}56%,100%{opacity:.25}}.gv-device-blink{animation:gvDeviceBlink 1.1s steps(1,end) infinite}@media (prefers-reduced-motion: reduce){.gv-device-blink{animation:none}}`}</style>

      {/* Label strip: LED, stage, lamps, hide. Focus it and use the Arrow keys to move the timer. */}
      <div className="flex items-center min-w-0 shrink-0" style={{ height: headH, gap: Math.max(4, headH * 0.3) }}>
        <div
          role="button"
          tabIndex={0}
          aria-label={t('documents_timer_move')}
          title={t('documents_timer_move')}
          onKeyDown={onKey('move')}
          className="flex-1 min-w-0 h-full flex items-center rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EED98A]"
          style={{ gap: Math.max(5, headH * 0.35), paddingInlineStart: Math.max(2, radius * 0.25) }}
        >
          <span aria-hidden className="shrink-0 rounded-full"
            style={{
              width: clampN(headH * 0.32, 5, 8), height: clampN(headH * 0.32, 5, 8),
              backgroundColor: running ? '#8BE39E' : done ? '#F2C77A' : '#35513F',
              boxShadow: running ? '0 0 6px rgba(139,227,158,0.8), inset 0 0 0 1px rgba(0,0,0,0.25)' : 'inset 0 1px 1px rgba(0,0,0,0.45)',
              transition: 'background-color 200ms, box-shadow 200ms',
            }} />
          <span className="min-w-0 truncate uppercase font-bold leading-none" aria-live="polite"
            style={{ fontSize: labelSize, letterSpacing: '0.14em', color: '#E9DDB6' }}>
            {done ? t('documents_stage_complete').replace('{stage}', label) : label}
          </span>
          {showCode && (
            <span className="shrink-0 tabular-nums leading-none" style={{ fontSize: labelSize * 0.92, letterSpacing: '0.08em', color: 'rgba(233,221,182,0.55)' }}>{docCode}</span>
          )}
        </div>
        {showLamps && (
          <div className="flex items-center shrink-0" style={{ gap: Math.max(3, headH * 0.22) }} aria-hidden>
            {stages.map((s) => (
              <span key={s.key} title={s.label} className="rounded-full"
                style={{
                  width: clampN(headH * 0.26, 4, 7), height: clampN(headH * 0.26, 4, 7),
                  backgroundColor: s.active ? '#EED98A' : s.skipped ? 'transparent' : 'rgba(238,217,138,0.22)',
                  boxShadow: s.active ? '0 0 5px rgba(238,217,138,0.7)' : s.skipped ? 'inset 0 0 0 1px rgba(238,217,138,0.25)' : 'none',
                }} />
            ))}
          </div>
        )}
        <button type="button" data-device-key onClick={onHide}
          aria-label={t('documents_timer_hide')} title={t('documents_timer_hide')}
          className="shrink-0 rounded-md flex items-center justify-center text-[#C9BD98] hover:text-[#FFF6DA] hover:bg-white/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EED98A]"
          style={{ width: Math.max(22, headH + 2), height: Math.max(22, headH + 2), marginBlock: -2 }}>
          <Minimize2 size={clampN(headH * 0.55, 11, 15)} strokeWidth={2.4} aria-hidden />
        </button>
      </div>

      <span className="sr-only" role="timer">{spoken(remaining)}</span>

      {slim ? (
        <div className="flex-1 min-h-0 flex items-center" style={{ gap }}>
          {lcd}
          {keys}
        </div>
      ) : (
        <>
          {lcd}
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
        className="absolute bottom-0 right-0 flex items-end justify-end cursor-nwse-resize text-[#C9BD98]/60 hover:text-[#EED98A] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EED98A]"
        style={{ width: Math.max(14, radius), height: Math.max(14, radius), padding: 3, borderBottomRightRadius: radius, zIndex: 3, touchAction: 'none' }}
      >
        <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden fill="none">
          <path d="M7 3v4H3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
}
