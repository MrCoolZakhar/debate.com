'use client';

// Shared pieces for the Manage Account pages (/account/manage/*): the page
// head (Title Case, the last word in gold), the "i" tooltip beside a title,
// the "Need a hand?" line, the button skins and two card grounds. Everything
// reads the /account type scale from accountUi so the three pages and the rest
// of the account area move together.
//
// House rules these pieces carry: every button label uppercase, every inline
// link bold and underlined, no full stop on a title, a button or a one-line
// caption, palette forest / gold / cream / ivory / white / ink only.

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { Info } from 'lucide-react';
import Portal from '@/components/Portal';
import { OUTFIT, T, W } from '../accountUi';

export const FOCUS = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] focus-visible:ring-offset-2';

export const FOREST = '#1B3828';
export const FOREST_MID = '#2A5A3C';
export const FOREST_LIGHT = '#3D7A52';
export const GOLD = '#EED98A';
export const DEEP_GOLD = '#B6871F';
export const CREAM = '#EDE7D8';
export const IVORY = '#FAF8F3';
export const WHITE = '#FFFFFF';
export const INK = '#1C1410';
export const INK_SOFT = '#5A5046';
export const RULE = '#DDD4C0';

export function PageHead({ title, line, info, aside }: {
  /** The h1, already marked up (`Credits and <GoldWord>Usage</GoldWord>`). */
  title: React.ReactNode;
  /** At most one short plain line under the title, no full stop. */
  line?: string;
  /** An "i" tooltip drawn right after the title. */
  info?: string;
  aside?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
      <div className="min-w-0" style={{ maxWidth: '70ch' }}>
        <div className="flex items-center gap-3">
          <h1
            style={{
              margin: 0,
              fontFamily: OUTFIT,
              fontWeight: W.title,
              fontSize: `clamp(30px, 8vw, ${T.title + 3}px)`,
              lineHeight: 1.1,
              letterSpacing: '-0.01em',
              color: INK,
            }}
          >
            {title}
          </h1>
          {info && <InfoTip text={info} />}
        </div>
        {line && (
          <p style={{ margin: '8px 0 0', fontFamily: OUTFIT, fontSize: T.body, lineHeight: 1.5, color: INK_SOFT }}>
            {line}
          </p>
        )}
      </div>
      {aside && <div className="flex-shrink-0">{aside}</div>}
    </div>
  );
}

// ── InfoTip ──────────────────────────────────────────────────────────────────
// A 24px round "i" button. Opens on hover AND focus, closes on Escape, blur or
// the pointer leaving (with a short grace so it can travel into the panel).
// Rendered through Portal at fixed viewport coordinates and flipped near the
// edges, so no card or scroller can clip it.

const TIP_W = 300;
const TIP_H_GUESS = 96;

export function InfoTip({ text, label = 'More about this' }: { text: string; label?: string }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const place = useCallback(() => {
    const b = btnRef.current;
    if (!b) return;
    const r = b.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = r.left + r.width / 2 - TIP_W / 2;
    if (left + TIP_W > vw - 10) left = vw - 10 - TIP_W;
    if (left < 10) left = 10;
    const below = r.bottom + 8;
    const flipUp = below + TIP_H_GUESS > vh - 10 && r.top - TIP_H_GUESS - 8 > 10;
    setPos({ top: flipUp ? r.top - TIP_H_GUESS - 8 : below, left });
  }, []);

  const cancelClose = useCallback(() => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
  }, []);
  const scheduleClose = useCallback(() => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), 140);
  }, [cancelClose]);
  const show = useCallback(() => { cancelClose(); place(); setOpen(true); }, [cancelClose, place]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const onReflow = () => place();
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onReflow);
    window.addEventListener('scroll', onReflow, true);
    return () => {
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onReflow);
      window.removeEventListener('scroll', onReflow, true);
    };
  }, [open, place]);

  useEffect(() => () => cancelClose(), [cancelClose]);

  return (
    <span className="inline-flex" onMouseEnter={show} onMouseLeave={scheduleClose}>
      <button
        ref={btnRef}
        type="button"
        onFocus={show}
        onBlur={scheduleClose}
        onClick={() => (open ? setOpen(false) : show())}
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        className={`inline-flex items-center justify-center flex-shrink-0 rounded-full ${FOCUS}`}
        style={{
          width: 24, height: 24,
          border: `1px solid rgba(182,135,31,0.5)`,
          backgroundColor: 'rgba(238,217,138,0.28)',
          color: DEEP_GOLD,
          cursor: 'help',
          padding: 0,
        }}
      >
        <Info size={14} strokeWidth={2.4} aria-hidden />
      </button>
      {open && pos && (
        <Portal>
          <div
            id={id}
            role="tooltip"
            onMouseEnter={cancelClose}
            onMouseLeave={scheduleClose}
            className="rounded-xl px-4 py-3"
            style={{
              position: 'fixed',
              top: pos.top,
              left: pos.left,
              width: TIP_W,
              zIndex: 9999,
              backgroundColor: FOREST,
              color: IVORY,
              fontFamily: OUTFIT,
              fontSize: T.body,
              lineHeight: 1.5,
              boxShadow: '0 18px 46px rgba(27,56,40,0.25)',
            }}
          >
            {text}
          </div>
        </Portal>
      )}
    </span>
  );
}

// ── Help line ────────────────────────────────────────────────────────────────

export function HelpLine() {
  return (
    <p style={{ margin: '40px 0 0', fontFamily: OUTFIT, fontSize: T.body, color: INK_SOFT }}>
      Need a hand?{' '}
      <TextLink href="/help">We are here to help</TextLink>
    </p>
  );
}

/** An inline link: bold, underlined, forest (or gold on a forest ground). */
export function TextLink({ href, children, onDark = false, className = '' }: {
  href: string;
  children: React.ReactNode;
  onDark?: boolean;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`rounded ${FOCUS} ${className}`}
      style={{
        color: onDark ? GOLD : FOREST,
        fontWeight: W.section,
        textDecoration: 'underline',
        textUnderlineOffset: 3,
        textDecorationThickness: 2,
      }}
    >
      {children}
    </Link>
  );
}

// ── Buttons ──────────────────────────────────────────────────────────────────

type ButtonProps = {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
  style?: React.CSSProperties;
  className?: string;
  /** 48 by default; the promo CLAIM is 52. */
  height?: number;
};

const BUTTON_TYPE: React.CSSProperties = {
  fontFamily: OUTFIT,
  fontSize: T.body,
  fontWeight: W.title,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
};

/** Forest fill, gold text. The green button. */
export function PrimaryButton({ children, onClick, disabled, type = 'button', style, className = '', height = 48 }: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`gv-btn-primary inline-flex items-center justify-center gap-2 rounded-xl px-6 ${FOCUS} ${className}`}
      style={{
        minHeight: height,
        minWidth: 44,
        backgroundColor: disabled ? 'rgba(27,56,40,0.45)' : FOREST,
        color: GOLD,
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background-color 150ms ease-out',
        ...BUTTON_TYPE,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

/** Outlined on white, for a second action beside the green one. */
export function SecondaryButton({ children, onClick, disabled, type = 'button', style, className = '', height = 48 }: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`gv-btn-secondary inline-flex items-center justify-center gap-2 rounded-xl px-6 ${FOCUS} ${className}`}
      style={{
        minHeight: height,
        minWidth: 44,
        backgroundColor: WHITE,
        color: disabled ? INK_SOFT : FOREST,
        border: `1.5px solid ${disabled ? RULE : FOREST}`,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background-color 150ms ease-out',
        ...BUTTON_TYPE,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

/** Hover states for the two buttons; mount once per page. */
export function ButtonStyles() {
  return (
    <style>{`
      .gv-btn-primary:not(:disabled):hover{background-color:${FOREST_MID} !important}
      .gv-btn-secondary:not(:disabled):hover{background-color:${IVORY} !important}
    `}</style>
  );
}

// ── Cards ────────────────────────────────────────────────────────────────────

type CardProps = { children: React.ReactNode; className?: string; style?: React.CSSProperties } & React.HTMLAttributes<HTMLElement>;

/** A white block with a parchment rule. */
export function WhiteCard({ children, className = '', style, ...rest }: CardProps) {
  return (
    <section
      className={`rounded-[20px] p-6 md:p-8 ${className}`}
      style={{ backgroundColor: WHITE, border: `1px solid ${RULE}`, boxShadow: '0 1px 3px rgba(27,56,40,0.06), 0 10px 28px rgba(27,56,40,0.07)', ...style }}
      {...rest}
    >
      {children}
    </section>
  );
}

/** A forest block: gold figures and ivory text sit on it. */
export function ForestCard({ children, className = '', style, ...rest }: CardProps) {
  return (
    <section
      className={`rounded-[20px] p-6 md:p-8 ${className}`}
      style={{ backgroundColor: FOREST, color: IVORY, boxShadow: '0 14px 34px rgba(27,56,40,0.22)', ...style }}
      {...rest}
    >
      {children}
    </section>
  );
}

/** The small gold eyebrow above a figure or a card title. */
export function Eyebrow({ children, onDark = false }: { children: React.ReactNode; onDark?: boolean }) {
  return (
    <p style={{ margin: 0, fontFamily: OUTFIT, fontSize: T.caption, fontWeight: W.section, letterSpacing: '0.12em', textTransform: 'uppercase', color: onDark ? GOLD : DEEP_GOLD }}>
      {children}
    </p>
  );
}

/** "3 Nov 2026", en-GB day month year. */
export function formatDay(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
}
