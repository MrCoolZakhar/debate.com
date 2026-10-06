'use client';

// ─────────────────────────────────────────────────────────────────────────────
// YieldPopover: the GSL "Yield" panel (Oct 2026, Asia WorldMUN item 18; MUNCommand has
// one). The speaker holding the GSL floor gives their REMAINING time away, never more:
//
//   Next speaker        → the chair page's `onYieldToNext`: the yielder's speech is logged
//                         with what they spoke, the next GSL delegation is seated with its
//                         own slot PLUS the remaining seconds (time_granted = that, T-3) in
//                         ONE current_speaker write, running on if the clock was running.
//   Another delegation  → the chair page's `onYieldToOther(country)`: the yielder's speech
//                         is logged, the floor is cleared exactly like Finish (the next GSL
//                         delegation goes on deck), and it answers the remaining seconds.
//                         This panel then times the recipient locally, like Right of Reply:
//                         Start / Pause / Done, no extra time, nothing written per second.
//
// Both log ONE `yield` ledger row (floorSpeech.ts `logYield`), which scores nothing and
// reads in History as "France yielded 0:42 to Brazil".
//
// The local countdown is anchored to the device clock (base + start instant), so a throttled
// tab never runs slow, and it lives in this component's state only: no committee state, no
// updateLocal, no localUpdateTime (RULES 3 and 4). The gavel knock watches it like RTR's,
// with its own anchor identity. A movable DraggablePopover (z 40 / 41, below every dialog);
// the page closes it when the motion changes (`floorCloseKey`), which drops the timer.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState, type ReactNode } from 'react';
import { Forward, Pause, Play, Check } from 'lucide-react';
import DraggablePopover from '@/components/DraggablePopover';
import { POPOVER_TONES } from '@/components/SpeakerControls';
import { SeatCircleFlag } from '@/components/CircleFlag';
import { getCountryDisplayName } from '@/lib/countries';
import { useLanguage, useT } from '@/contexts/LanguageContext';
import { useGavelCue, type GavelCue } from '@/lib/useGavelCue';

const TONE = POPOVER_TONES.yield;
const clockText = (secs: number) => `${Math.floor(Math.max(0, secs) / 60)}:${String(Math.max(0, secs) % 60).padStart(2, '0')}`;

type YieldTimer = { country: string; from: string; total: number; base: number; startedAt: number | null };

export default function YieldPopover({
  yielder,
  remaining,
  nextCountry,
  canYield,
  onYieldToNext,
  onYieldToOther,
  renderCountryInput,
  gavelCue,
  onClose,
}: {
  /** The GSL speaker holding the floor, or null (the floor is empty). */
  yielder: string | null;
  /** The yielder's live remaining seconds (the page's speaker clock atom). */
  remaining: number;
  /** The delegation at the head of the GSL, or null. */
  nextCountry: string | null;
  /** The page's guards: Moderator, GSL, not ended / suspended, a speaker with time left. */
  canYield: boolean;
  onYieldToNext: () => void;
  /** Ends the yielder's turn; resolves the seconds to time, or null when it could not. */
  onYieldToOther: (country: string) => number | null;
  /** The country typeahead (the Right of Reply input), the yielder left out. */
  renderCountryInput: (value: string, onChange: (v: string) => void) => ReactNode;
  gavelCue: GavelCue;
  onClose: () => void;
}) {
  const t = useT();
  const { language } = useLanguage();
  const name = (c: string) => getCountryDisplayName(c, language);
  const [target, setTarget] = useState('');
  const [timer, setTimer] = useState<YieldTimer | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const running = !!timer?.startedAt;
  const left = timer
    ? (timer.startedAt ? Math.max(0, Math.ceil(timer.base - (now - timer.startedAt) / 1000)) : timer.base)
    : 0;
  // Ticks only while running; reaching zero stops the clock where it is (base 0).
  const startedAt = timer?.startedAt ?? null;
  const base = timer?.base ?? 0;
  useEffect(() => {
    if (!startedAt) return;
    const id = setInterval(() => {
      const at = Date.now();
      setNow(at);
      if (base - (at - startedAt) / 1000 <= 0) {
        setTimer((tm) => (tm && tm.startedAt === startedAt ? { ...tm, base: 0, startedAt: null } : tm));
      }
    }, 250);
    return () => clearInterval(id);
  }, [startedAt, base]);
  useGavelCue(left, running, gavelCue, timer ? `yield|${timer.country}|${timer.startedAt ?? 'p'}|${timer.base}` : null);

  const toggle = () => {
    if (!timer) return;
    const at = Date.now();
    setNow(at);
    if (timer.startedAt) setTimer({ ...timer, base: left, startedAt: null });
    else if (timer.base > 0) setTimer({ ...timer, startedAt: at });
  };
  const grant = () => {
    if (!target || !canYield) return;
    const from = yielder ?? '';
    const secs = onYieldToOther(target);
    if (secs == null || secs <= 0) return;
    setTimer({ country: target, from, total: secs, base: secs, startedAt: null });
    setTarget('');
  };

  const nextBlocked = !canYield ? t('speaker_ctl_yield_no_time') : !nextCountry ? t('yield_to_next_none') : null;

  return (
    <DraggablePopover
      id="yield"
      slot="upper"
      anchor="yield"
      accent={TONE.accent}
      tone={TONE}
      className="w-72"
      handleLabel={t('popover_drag_handle')}
      closeLabel={t('popover_close')}
      onClose={onClose}
      title={(
        <span className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wide">
          <Forward size={16} strokeWidth={2.6} aria-hidden className="shrink-0 rtl:-scale-x-100" />
          {t('yield_title')}
        </span>
      )}
    >
      {!timer ? (
        <div style={{ color: TONE.ink }}>
          {/* Who yields, and how much */}
          <div className="flex items-center gap-2 mb-3 px-1">
            {yielder && <SeatCircleFlag country={yielder} size={26} />}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold [overflow-wrap:anywhere]">
                {yielder ? t('yield_from', { country: name(yielder) }) : t('speaker_ctl_need_speaker')}
              </div>
              {canYield && (
                <div className="text-xs font-semibold tabular-nums opacity-80">{t('yield_remaining', { time: clockText(remaining) })}</div>
              )}
            </div>
          </div>

          {/* Next speaker */}
          <button
            type="button"
            onClick={() => { if (!nextBlocked) onYieldToNext(); }}
            aria-disabled={!!nextBlocked || undefined}
            title={nextBlocked ?? undefined}
            style={{ backgroundColor: TONE.chip, color: TONE.ink }}
            className={`w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-start mb-3 transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1F5A43] ${
              nextBlocked ? 'opacity-45 cursor-not-allowed' : 'gv-lift hover:brightness-95 active:scale-[0.98]'
            }`}
          >
            {nextCountry ? <SeatCircleFlag country={nextCountry} size={28} /> : <Forward size={20} aria-hidden className="shrink-0 rtl:-scale-x-100" />}
            <span className="flex-1 min-w-0">
              <span className="block text-xs font-black">{t('yield_to_next')}</span>
              <span className="block text-xs font-semibold [overflow-wrap:anywhere] opacity-85">
                {nextCountry
                  ? t('yield_to_next_hint', { country: name(nextCountry), time: clockText(remaining) })
                  : t('yield_to_next_none')}
              </span>
            </span>
          </button>

          {/* Another delegation */}
          <div className="text-xs font-black mb-1.5 px-1">{t('yield_to_other')}</div>
          {renderCountryInput(target, setTarget)}
          <button
            type="button"
            onClick={grant}
            disabled={!target || !canYield}
            style={{ backgroundColor: TONE.btn, color: TONE.btnFg }}
            className="w-full mt-2 inline-flex items-center justify-center gap-2 py-2.5 disabled:opacity-40 disabled:cursor-not-allowed text-xs rounded-lg font-black transition-transform gv-lift hover:brightness-110 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1F5A43] focus-visible:ring-offset-2"
          >
            <Forward size={15} strokeWidth={2.6} aria-hidden className="shrink-0 rtl:-scale-x-100" />
            {t('yield_grant', { time: clockText(canYield ? remaining : 0) })}
          </button>
        </div>
      ) : (
        <div style={{ color: TONE.ink }}>
          <div className="flex items-center gap-2 mb-3 px-1">
            <SeatCircleFlag country={timer.country} size={28} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold [overflow-wrap:anywhere]">{name(timer.country)}</div>
              {timer.from && <div className="text-xs font-semibold opacity-80 [overflow-wrap:anywhere]">{t('yield_to_label', { country: name(timer.from) })}</div>}
            </div>
          </div>
          <div
            className="text-5xl font-black font-mono text-center mb-3 tabular-nums"
            style={{ color: left <= 5 ? '#8B2020' : left <= 10 ? '#7A4A0C' : TONE.ink }}
            aria-live="off"
          >
            {clockText(left)}
          </div>
          <div className="w-full h-1.5 rounded-full overflow-hidden mb-3" style={{ backgroundColor: TONE.chip }}>
            <div className="h-full rounded-full transition-[width] duration-300"
              style={{ width: `${timer.total > 0 ? (left / timer.total) * 100 : 0}%`, backgroundColor: left / Math.max(1, timer.total) > 0.2 ? TONE.btn : '#B84A3A' }} />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={toggle}
              disabled={!running && left <= 0}
              className={`gv-lift flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-lg font-bold text-xs transition-colors disabled:opacity-40 ${
                running ? 'bg-[#F2C230] hover:bg-[#E5B21C] text-[#1C1410]' : 'bg-[#2A5A3C] hover:bg-[#3D7A52] text-white'
              }`}
            >
              {running ? <Pause size={14} strokeWidth={2.6} aria-hidden /> : <Play size={14} strokeWidth={2.6} aria-hidden />}
              {running ? t('yield_pause') : t('yield_start')}
            </button>
            <button
              type="button"
              onClick={() => { setTimer(null); onClose(); }}
              style={{ backgroundColor: TONE.chip, color: TONE.ink }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg font-bold text-xs transition-transform gv-lift hover:brightness-95 active:scale-[0.97]"
            >
              <Check size={14} strokeWidth={2.6} aria-hidden />
              {t('yield_done')}
            </button>
          </div>
        </div>
      )}
    </DraggablePopover>
  );
}
