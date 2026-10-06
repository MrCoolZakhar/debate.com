'use client';

/**
 * Adding time to an introduction stage (Oct 2026, Asia WorldMUN: "add a button to add time in
 * presentation and Q&A"). Two pieces, both drawn by StageTimerDevice:
 *
 * - `AddTimeChips`: +30 s, +1 min and Custom as three quiet keys in their own row, used when the
 *   card is tall and wide enough (measured there; the clock never shrinks below its floor).
 * - `AddTimeKey`: one pale sky-blue ClockPlus key in the card's header (the same colour and icon
 *   as Add time on the floor), used whenever the chips do not fit. It opens `AddTimePopover`.
 *
 * `AddTimePopover` is portaled at fixed coordinates in #fit-root space (anchorBox / place), so it
 * is never clipped by the card; z 48 sits over the introduction (45) and the chair's top bar (46)
 * and under every dialog (50+). Escape is taken in the capture phase so it never reaches the
 * Documents modal. Every add only calls `onAdd(seconds)`; the clock maths lives in the modal.
 */
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ClockPlus } from 'lucide-react';
import Portal from '@/components/Portal';
import { useT } from '@/contexts/LanguageContext';
import { anchorBox, place } from '@/components/voting/anchorPosition';

export const ADD_TIME_MAX_SECONDS = 99 * 60;
const FONT = "var(--font-brand), sans-serif";
export const SKY = '#D4EAFB';
export const SKY_INK = '#0E3A57';

/** "1:30" → 90, "90" → 90, "2:" → 120. Null when it is not a positive amount. */
export function parseAddAmount(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  const m = /^(\d{1,2})\s*:\s*(\d{0,2})$/.exec(s);
  let n: number;
  if (m) {
    const sec = m[2] ? Number(m[2]) : 0;
    if (sec >= 60) return null;
    n = Number(m[1]) * 60 + sec;
  } else if (/^\d{1,4}$/.test(s)) {
    n = Number(s);
  } else {
    return null;
  }
  return n > 0 ? Math.min(n, ADD_TIME_MAX_SECONDS) : null;
}

export function AddTimeKey({ size, iconPx, onAdd, open, onOpenChange }: {
  size: number; iconPx: number; onAdd: (seconds: number) => void;
  open: boolean; onOpenChange: (open: boolean) => void;
}) {
  const t = useT();
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={ref} type="button" data-device-key onClick={() => onOpenChange(!open)}
        aria-label={t('dtime_add_title')} title={t('dtime_add_title')} aria-haspopup="dialog" aria-expanded={open}
        className="shrink-0 rounded-md flex items-center justify-center transition-[background-color,transform] duration-150 active:scale-[0.96] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0E3A57]"
        style={{ width: size, height: size, marginBlock: -4, backgroundColor: SKY, color: SKY_INK }}>
        <ClockPlus size={iconPx} strokeWidth={2.2} aria-hidden />
      </button>
      {open && <AddTimePopover anchor={ref} onAdd={onAdd} onClose={() => onOpenChange(false)} />}
    </>
  );
}

export function AddTimeChips({ height, textSize, gap, onAdd, popoverOpen, onPopoverChange }: {
  height: number; textSize: number; gap: number; onAdd: (seconds: number) => void;
  popoverOpen: boolean; onPopoverChange: (open: boolean) => void;
}) {
  const t = useT();
  const customRef = useRef<HTMLButtonElement>(null);
  const chip = (label: string, title: string, onClick: () => void, ref?: React.Ref<HTMLButtonElement>, extra?: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button ref={ref} type="button" data-device-key onClick={onClick} aria-label={title} title={title} {...extra}
      className="shrink-0 flex items-center justify-center whitespace-nowrap font-semibold select-none transition-[background-color,transform] duration-150 active:scale-[0.96] hover:brightness-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0E3A57]"
      style={{ height, paddingInline: Math.round(height * 0.45), borderRadius: Math.round(height * 0.3), fontSize: textSize, fontFamily: FONT, backgroundColor: SKY, color: SKY_INK }}>
      {label}
    </button>
  );
  return (
    <div className="flex items-center justify-center shrink-0" style={{ gap }}>
      <ClockPlus size={Math.round(height * 0.55)} strokeWidth={2.2} aria-hidden style={{ color: SKY_INK, opacity: 0.8 }} />
      {chip(t('dtime_30'), t('dtime_30_title'), () => onAdd(30))}
      {chip(t('dtime_60'), t('dtime_60_title'), () => onAdd(60))}
      {chip(t('dtime_custom'), t('dtime_custom_label'), () => onPopoverChange(!popoverOpen), customRef, { 'aria-haspopup': 'dialog', 'aria-expanded': popoverOpen })}
      {popoverOpen && <AddTimePopover anchor={customRef} onAdd={onAdd} onClose={() => onPopoverChange(false)} customOnly />}
    </div>
  );
}

const POP_W = 260;
const POP_H_FULL = 168;
const POP_H_CUSTOM = 112;

function AddTimePopover({ anchor, onAdd, onClose, customOnly = false }: {
  anchor: React.RefObject<HTMLButtonElement | null>; onAdd: (seconds: number) => void; onClose: () => void; customOnly?: boolean;
}) {
  const t = useT();
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [value, setValue] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const amount = parseAddAmount(value);
  const h = customOnly ? POP_H_CUSTOM : POP_H_FULL;

  useLayoutEffect(() => {
    const placeIt = () => {
      const el = anchor.current;
      if (!el) return;
      const next = place(anchorBox(el), POP_W, h, 'end');
      setPos((p) => (p && Math.abs(p.left - next.left) < 0.5 && Math.abs(p.top - next.top) < 0.5 ? p : next));
    };
    placeIt();
    window.addEventListener('resize', placeIt);
    window.addEventListener('scroll', placeIt, true);
    // The timer card can be dragged while this is open: follow it, cheaply (state only on change).
    const id = setInterval(placeIt, 250);
    return () => { window.removeEventListener('resize', placeIt); window.removeEventListener('scroll', placeIt, true); clearInterval(id); };
  }, [anchor, h]);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const tgt = e.target as Node;
      if (panelRef.current?.contains(tgt) || anchor.current?.contains(tgt)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault(); e.stopPropagation();
      onClose();
      anchor.current?.focus();
    };
    document.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey, true);
    return () => { document.removeEventListener('pointerdown', onDown, true); window.removeEventListener('keydown', onKey, true); };
  }, [anchor, onClose]);

  // Portal mounts a render later: focus the field once it exists.
  useEffect(() => { if (pos) inputRef.current?.focus(); }, [pos]);

  const addCustom = () => {
    if (amount == null) return;
    onAdd(amount);
    setValue('');
    onClose();
  };

  const quick = (label: string, title: string, sec: number) => (
    <button type="button" onClick={() => { onAdd(sec); onClose(); }} aria-label={title} title={title}
      className="flex-1 h-10 rounded-xl text-[14px] font-semibold transition-[background-color,transform] duration-150 active:scale-[0.96] hover:brightness-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0E3A57]"
      style={{ backgroundColor: SKY, color: SKY_INK }}>
      {label}
    </button>
  );

  return (
    <Portal>
      {/* React events bubble through portals: without this a press in the panel would reach the
          timer card's drag handler (and preventDefault would keep the field from focusing). */}
      <div ref={panelRef} role="dialog" aria-label={t('dtime_add_title')}
        onPointerDown={(e) => e.stopPropagation()}
        className="fixed z-[48] rounded-2xl p-3 bg-[#FFFDF8] flex flex-col gap-2.5"
        style={{
          left: pos?.left ?? 0, top: pos?.top ?? 0, width: POP_W, minHeight: h, visibility: pos ? 'visible' : 'hidden', fontFamily: FONT,
          boxShadow: '0 0 0 1px rgba(28,20,16,0.08), 0 2px 6px rgba(27,56,40,0.08), 0 16px 40px rgba(27,56,40,0.20)',
        }}>
        {!customOnly && (
          <div className="flex gap-2">
            {quick(t('dtime_30'), t('dtime_30_title'), 30)}
            {quick(t('dtime_60'), t('dtime_60_title'), 60)}
          </div>
        )}
        <label className="flex flex-col gap-1">
          <span className="text-[12px] font-semibold" style={{ color: '#5C4E40' }}>{t('dtime_custom_label')}</span>
          <div className="flex gap-2">
            <input ref={inputRef} type="text" inputMode="numeric" value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }}
              placeholder="1:30"
              aria-describedby="dtime-custom-hint"
              className="flex-1 min-w-0 h-10 rounded-xl px-3 text-[15px] tabular-nums bg-white text-[#1C1410] placeholder-[#9A8A78] focus:outline-none focus:ring-2 focus:ring-[#0E3A57]/40"
              style={{ boxShadow: 'inset 0 0 0 1px rgba(28,20,16,0.12)', fontFamily: FONT }} />
            <button type="button" onClick={addCustom} disabled={amount == null}
              className="shrink-0 h-10 px-4 rounded-xl text-[14px] font-semibold bg-[#1B3828] hover:bg-[#244A36] text-[#FAF8F3] disabled:opacity-40 disabled:hover:bg-[#1B3828] transition-[background-color,transform] duration-150 active:scale-[0.96] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#1B3828]">
              {t('dtime_custom_add')}
            </button>
          </div>
          <span id="dtime-custom-hint" className="text-[11.5px]" style={{ color: '#8A7B6A' }}>{t('dtime_custom_hint')}</span>
        </label>
      </div>
    </Portal>
  );
}
