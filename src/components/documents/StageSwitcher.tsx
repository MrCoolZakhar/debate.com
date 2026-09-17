'use client';

/**
 * StageSwitcher: Reading, Presentation and Q&A as one segmented control in the introduction's
 * bar (17 Sep 2026, owner: "make it easier and nicer to switch between Reading, Presentation
 * and Q&A").
 *
 * - The current stage is a forest segment (a thumb that slides between segments; no motion
 *   under prefers-reduced-motion). Each segment shows its number (a check once the stage was
 *   completed), its name and its minutes.
 * - A stage with a 0-minute timer is dimmed and not selectable ("Skipped").
 * - Click, or Enter / Space, jumps to a stage. Arrow keys move between segments (mirrored in
 *   RTL), Home / End go to the first / last.
 * - "Timings" before the track goes back to the order of proceedings.
 *
 * Presentational: it calls `onSelect` / `onTimings` and nothing else. The modal's handlers
 * start the chosen stage with a fresh paused clock, exactly like Next and Back (RULE 6b holds:
 * nothing is written).
 */
import React, { useLayoutEffect, useRef, useState } from 'react';
import { Check, SlidersHorizontal } from 'lucide-react';
import { useT } from '@/contexts/LanguageContext';

export type SwitcherStage = { key: string; label: string; minutes: number; done: boolean };

const OUTFIT = "'Outfit', sans-serif";

export default function StageSwitcher({ stages, current, onSelect, onTimings, compact = false }: {
  stages: SwitcherStage[];
  current: string;
  onSelect: (key: string) => void;
  onTimings: () => void;
  /** Narrow bars: the minutes captions and the Timings word are dropped. */
  compact?: boolean;
}) {
  const t = useT();
  const btnRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [thumb, setThumb] = useState<{ x: number; w: number; animate: boolean } | null>(null);
  /** Set after the first placement: that one never animates, every later stage change does. */
  const placed = useRef(false);
  const stagesKey = stages.map((s) => `${s.key}:${s.minutes}:${s.label}`).join('|');

  useLayoutEffect(() => {
    const place = () => {
      const b = btnRefs.current[current];
      if (!b) { setThumb(null); return; }
      const animate = placed.current;
      setThumb((prev) => (prev && prev.x === b.offsetLeft && prev.w === b.offsetWidth ? prev : { x: b.offsetLeft, w: b.offsetWidth, animate }));
    };
    place();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(place) : null;
    Object.values(btnRefs.current).forEach((b) => { if (b) ro?.observe(b); });
    void document.fonts?.ready.then(place);
    const id = requestAnimationFrame(() => { placed.current = true; });
    return () => { ro?.disconnect(); cancelAnimationFrame(id); };
  }, [current, compact, stagesKey]);

  const enabled = stages.filter((s) => s.minutes > 0);
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const rtl = getComputedStyle(e.currentTarget).direction === 'rtl';
    const idx = enabled.findIndex((s) => btnRefs.current[s.key] === document.activeElement);
    if (idx < 0) return;
    let next = -1;
    if (e.key === 'ArrowRight') next = idx + (rtl ? -1 : 1);
    else if (e.key === 'ArrowLeft') next = idx + (rtl ? 1 : -1);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = enabled.length - 1;
    else return;
    e.preventDefault();
    const target = enabled[Math.max(0, Math.min(enabled.length - 1, next))];
    btnRefs.current[target.key]?.focus();
  };

  return (
    <nav aria-label={t('documents_switch_label')} className="flex items-center gap-2 min-w-0" style={{ fontFamily: OUTFIT }}>
      <button type="button" onClick={onTimings} title={t('documents_switch_timings_title')} aria-label={t('documents_switch_timings_title')}
        className="shrink-0 h-9 px-2.5 rounded-[10px] flex items-center gap-1.5 text-[13px] font-medium text-[#5C4E40] hover:text-[#1B3828] hover:bg-[rgba(27,56,40,0.07)] transition-[background-color,color,transform] duration-150 active:scale-[0.96] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]">
        <SlidersHorizontal size={15} strokeWidth={2.2} aria-hidden />
        {!compact && <span>{t('documents_switch_timings')}</span>}
      </button>
      <div onKeyDown={onKeyDown} className="relative flex items-center rounded-[12px] p-[3px] min-w-0"
        style={{ backgroundColor: 'rgba(28,20,16,0.055)', boxShadow: 'inset 0 1px 2px rgba(28,20,16,0.06)' }}>
        {thumb && (
          <span aria-hidden className="absolute top-[3px] bottom-[3px] left-0 rounded-[9px] motion-reduce:transition-none"
            style={{
              width: thumb.w, transform: `translateX(${thumb.x}px)`,
              backgroundColor: '#1B3828',
              boxShadow: '0 1px 2px rgba(27,56,40,0.25), 0 3px 8px rgba(27,56,40,0.18)',
              transition: thumb.animate ? 'transform 240ms cubic-bezier(0.2,0,0,1), width 240ms cubic-bezier(0.2,0,0,1)' : 'none',
            }} />
        )}
        {stages.map((s, i) => {
          const active = s.key === current;
          const skipped = s.minutes <= 0;
          const title = skipped
            ? `${s.label}: ${t('documents_setup_skipped')}`
            : active ? s.label : t('documents_switch_go', { stage: s.label });
          return (
            <button
              key={s.key}
              ref={(el) => { btnRefs.current[s.key] = el; }}
              type="button"
              onClick={() => { if (!skipped && !active) onSelect(s.key); }}
              aria-current={active ? 'step' : undefined}
              aria-disabled={skipped || undefined}
              title={title}
              className={`relative z-[1] h-9 rounded-[9px] flex items-center gap-2 whitespace-nowrap select-none transition-[color,background-color,transform] duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] focus-visible:ring-offset-1 ${
                compact ? 'px-2.5' : 'ps-2 pe-3'
              } ${skipped ? 'cursor-not-allowed opacity-45' : active ? 'cursor-default' : 'hover:bg-[rgba(27,56,40,0.07)] active:scale-[0.96]'}`}
              style={{ color: active ? '#FAF8F3' : s.done ? '#1B3828' : '#5C4E40' }}
            >
              <span aria-hidden className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-semibold tabular-nums"
                style={{
                  backgroundColor: active ? 'rgba(250,248,243,0.16)' : s.done ? 'rgba(27,56,40,0.12)' : 'transparent',
                  boxShadow: active || s.done ? 'none' : 'inset 0 0 0 1.25px rgba(92,78,64,0.45)',
                }}>
                {s.done && !active ? <Check size={12} strokeWidth={3} /> : i + 1}
              </span>
              <span className={`text-[13.5px] font-semibold leading-none ${skipped ? 'line-through decoration-1' : ''}`}>{s.label}</span>
              {!compact && (
                <span className="text-[12px] font-medium leading-none tabular-nums"
                  style={{ color: active ? 'rgba(250,248,243,0.72)' : 'rgba(92,78,64,0.8)' }}>
                  {skipped ? t('documents_setup_skipped') : `${s.minutes} ${t('documents_setup_minutes_short')}`}
                </span>
              )}
              {s.done && !active && <span className="sr-only">{t('documents_switch_done')}</span>}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
