'use client';

/**
 * wizard.tsx, shared step-questionnaire kit for onboarding flows
 * (conference creation, auth onboarding). Neumorphism-inspired,
 * forest/ivory, Outfit, built on the NEU tokens from neu.tsx.
 *
 * Exports:
 *   WizardShell , centered column with progress dots, big title, back arrow
 *   TwoTabPick  , two large side-by-side pick cards (binary choice)
 *   CardSelect  , grid of select cards, every option has an icon/image slot;
 *                  supports multiple + searchable
 */

import { useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, Search } from 'lucide-react';
import { NEU, OUTFIT, EASE } from '@/components/neu';

// ── Shared types ───────────────────────────────────────────────────────────

export interface WizardOption {
  key: string;
  label: string;
  /** Small/large glyph slot, lucide icon, Emoji3D, flag <img>, anything. */
  icon?: React.ReactNode;
  /** Image URL (e.g. /onboarding/hall-01.jpg), used as a large picture on the card. */
  image?: string;
  /** Muted secondary line under the label. */
  sub?: string;
}

// ── WizardShell ────────────────────────────────────────────────────────────

export function WizardShell({
  step,
  total,
  title,
  sub,
  onBack,
  labels,
  subStep,
  minBodyHeight,
  children,
}: {
  /** 1-based current step. */
  step: number;
  total: number;
  title: string;
  sub?: string;
  onBack?: () => void;
  /**
   * OPT-IN. Floor (in px) for the title block + body TOGETHER, turning them
   * into one flex column of at least that height.
   *
   * WHY: every step's content is a different height, so the primary action at
   * the bottom of the column landed somewhere different on each one and moved
   * out from under the pointer between steps. With this set, a caller whose
   * footer carries `margin-top: auto` gets that footer parked at the BOTTOM of
   * a fixed-height column instead — same y on every step short enough to fit.
   *
   * The title block is inside the measured column on purpose: a one-line vs
   * two-line H1 would otherwise shift everything below it by a line.
   *
   * Capped at the viewport (`min(Npx, calc(100dvh - 200px))`) so a short
   * phone screen never gains a scrollbar it did not have before.
   *
   * Omit it (the default, and what every pre-existing caller does) and the
   * markup is byte-for-byte what it was: title block and body as plain
   * siblings, no wrapper, no flex, no min-height.
   */
  minBodyHeight?: number;
  /**
   * OPT-IN. Names for each step, same length and order as `total`. Supplying
   * them swaps the anonymous dots for the named segmented rail. Omit (the
   * default, and what every pre-existing caller does) and the dots render
   * exactly as before — no existing flow changes.
   */
  labels?: string[];
  /**
   * OPT-IN, only meaningful alongside `labels`. Sub-divides the CURRENT
   * segment into `total` ticks, for a step that is itself paginated (the
   * apply flow's Questions step splits on the organiser's section blocks).
   * Without this the rail is frozen while the applicant moves between pages.
   */
  subStep?: { index: number; total: number };
  children: React.ReactNode;
}) {
  const [backHover, setBackHover] = useState(false);
  const pinned = typeof minBodyHeight === 'number';
  return (
    <div
      className="w-full flex flex-col items-center"
      style={{ maxWidth: 720, margin: '0 auto', padding: '8px 4px 32px' }}
    >
      {labels && labels.length === total ? (
        <StepRail step={step} total={total} labels={labels} subStep={subStep} />
      ) : (
      /* Progress dots */
      <div className="flex items-center gap-2" style={{ marginBottom: 28 }} aria-label={`Step ${step} of ${total}`}>
        {Array.from({ length: total }, (_, i) => {
          const n = i + 1;
          const active = n === step;
          const done = n < step;
          return (
            <span
              key={n}
              aria-hidden
              style={{
                width: active ? 26 : 8,
                height: 8,
                borderRadius: 999,
                background: active
                  ? `linear-gradient(135deg, ${NEU.gold}, ${NEU.deepGold})`
                  : done
                    ? NEU.forest
                    : 'rgba(27,56,40,0.16)',
                boxShadow: active ? `0 2px 6px ${NEU.deepGold}55` : undefined,
                transition: `width 320ms ${EASE}, background 320ms ${EASE}, box-shadow 320ms ${EASE}`,
              }}
            />
          );
        })}
      </div>
      )}

      {/* Back arrow + title block. When `minBodyHeight` is set this and the
          body share one min-height flex column, so a caller footer with
          `margin-top: auto` lands at the same y on every step. */}
      <PinWrap pinned={pinned} minHeight={minBodyHeight}>
      <div className="w-full relative" style={{ marginBottom: 26 }}>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Go back"
            onMouseEnter={() => setBackHover(true)}
            onMouseLeave={() => setBackHover(false)}
            className="absolute flex items-center justify-center focus:outline-none"
            style={{
              left: 0,
              top: 2,
              width: 40,
              height: 40,
              borderRadius: 999,
              border: 'none',
              backgroundColor: NEU.surface,
              color: backHover ? NEU.forest : NEU.muted,
              boxShadow: backHover ? NEU.outSmHover : NEU.outSm,
              transform: backHover ? 'translateY(-1px)' : 'translateY(0)',
              transition: `background-color 220ms ${EASE}, color 220ms ${EASE}, box-shadow 220ms ${EASE}, transform 220ms ${EASE}`,
              cursor: 'pointer',
            }}
          >
            <ArrowLeft size={17} strokeWidth={2.4} />
          </button>
        )}
        <div style={{ padding: onBack ? '0 48px' : 0, textAlign: 'center' }}>
          <h1
            style={{
              fontFamily: OUTFIT,
              fontWeight: 900,
              fontSize: 'clamp(24px, 4.5vw, 34px)',
              lineHeight: 1.12,
              color: NEU.ink,
              letterSpacing: '-0.01em',
            }}
          >
            {title}
          </h1>
          {sub && (
            <p
              style={{
                fontFamily: OUTFIT,
                fontSize: 14,
                fontWeight: 500,
                color: NEU.muted,
                marginTop: 8,
                lineHeight: 1.55,
                whiteSpace: 'pre-wrap',
              }}
            >
              {sub}
            </p>
          )}
        </div>
      </div>

      <div className={pinned ? 'w-full flex flex-col flex-1' : 'w-full'}>{children}</div>
      </PinWrap>
    </div>
  );
}

/**
 * Wraps the title block + body in one min-height flex column when
 * `minBodyHeight` was supplied, and renders them as bare siblings (a fragment,
 * so ZERO extra DOM) when it was not. Existing callers therefore keep exactly
 * the markup they had.
 */
function PinWrap({
  pinned, minHeight, children,
}: {
  pinned: boolean;
  minHeight?: number;
  children: React.ReactNode;
}) {
  if (!pinned) return <>{children}</>;
  return (
    <div
      className="w-full flex flex-col"
      // Capped at the viewport so a short screen never gains a scrollbar that
      // the natural content did not already need.
      style={{ minHeight: `min(${minHeight}px, calc(100dvh - 200px))` }}
    >
      {children}
    </div>
  );
}

// ── StepRail, the NAMED segmented progress rail ────────────────────────────
// Opt-in via WizardShell's `labels` prop. Anonymous dots tell an applicant
// nothing: they cannot see which stage they are in, what is left, or that a
// stage is itself paginated. The rail names the current stage, ticks off the
// finished ones, and sub-divides the active segment when the caller passes
// `subStep`.
function StepRail({
  step, total, labels, subStep,
}: {
  step: number;
  total: number;
  labels: string[];
  subStep?: { index: number; total: number };
}) {
  const current = labels[step - 1] ?? '';
  return (
    <div
      className="w-full"
      style={{ marginBottom: 26 }}
      role="group"
      aria-label={`Step ${step} of ${total}: ${current}${subStep ? `, part ${subStep.index + 1} of ${subStep.total}` : ''}`}
    >
      <div className="flex items-center gap-1.5" aria-hidden>
        {labels.map((label, i) => {
          const n = i + 1;
          const done = n < step;
          const active = n === step;
          const ticks = active && subStep && subStep.total > 1 ? subStep.total : 1;
          return (
            <div
              key={label + i}
              className="flex items-center gap-[3px]"
              style={{ flex: active ? 1.6 : 1, minWidth: 0 }}
            >
              {Array.from({ length: ticks }, (_, t) => {
                const tickDone = done || (active && subStep ? t < subStep.index : false);
                const tickActive = active && (subStep ? t === subStep.index : true);
                return (
                  <span
                    key={t}
                    style={{
                      flex: 1,
                      height: 6,
                      borderRadius: 999,
                      background: tickActive
                        ? `linear-gradient(90deg, ${NEU.gold}, ${NEU.deepGold})`
                        : tickDone
                          ? NEU.forest
                          : 'rgba(27,56,40,0.14)',
                      boxShadow: tickActive ? `0 2px 6px ${NEU.deepGold}55` : NEU.inSm,
                      transition: `background 320ms ${EASE}, box-shadow 320ms ${EASE}`,
                    }}
                  />
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Desktop: every stage name, the current one lit. Narrow: just the
          current stage plus its position, because six labels do not fit in
          319px and a truncated rail is worse than a clear sentence. */}
      <div className="hidden sm:flex items-center gap-1.5" style={{ marginTop: 8 }} aria-hidden>
        {labels.map((label, i) => {
          const n = i + 1;
          const active = n === step;
          const done = n < step;
          return (
            <span
              key={label + i}
              className="truncate"
              style={{
                flex: active ? 1.6 : 1,
                minWidth: 0,
                fontFamily: OUTFIT,
                fontWeight: 800,
                fontSize: 10.5,
                letterSpacing: '0.13em',
                textTransform: 'uppercase',
                // NEU.muted is a 2.71:1 wash — future steps are decorative
                // here, but anything the applicant must READ uses inkSoft.
                color: active ? NEU.forest : done ? NEU.inkSoft : 'rgba(27,56,40,0.34)',
                transition: `color 320ms ${EASE}`,
              }}
            >
              {label}
            </span>
          );
        })}
      </div>
      <p
        className="sm:hidden"
        style={{
          marginTop: 8, fontFamily: OUTFIT, fontWeight: 800, fontSize: 11,
          letterSpacing: '0.12em', textTransform: 'uppercase', color: NEU.forest,
          textAlign: 'center', fontVariantNumeric: 'tabular-nums',
        }}
      >
        {current} · {step} of {total}
        {subStep && subStep.total > 1 ? ` · part ${subStep.index + 1}/${subStep.total}` : ''}
      </p>
    </div>
  );
}

// ── Selection card internals (shared by TwoTabPick + CardSelect) ───────────

function GoldCheck({ visible }: { visible: boolean }) {
  return (
    <span
      aria-hidden
      className="absolute flex items-center justify-center"
      style={{
        top: 10,
        right: 10,
        width: 24,
        height: 24,
        borderRadius: 999,
        background: `linear-gradient(135deg, ${NEU.gold}, ${NEU.deepGold})`,
        boxShadow: `0 2px 7px ${NEU.deepGold}66`,
        opacity: visible ? 1 : 0,
        transform: visible ? 'scale(1)' : 'scale(0.25)',
        filter: visible ? 'blur(0px)' : 'blur(4px)',
        transition: `opacity 260ms ${EASE}, transform 260ms ${EASE}, filter 260ms ${EASE}`,
        pointerEvents: 'none',
      }}
    >
      <Check size={14} strokeWidth={3.2} style={{ color: NEU.forest }} />
    </span>
  );
}

// Floating card look: a soft forest-tinted drop shadow lifts every option off
// the ivory page; hover grows the card and deepens the shadow so it reads as
// picked-up. Selected stays clearly distinct (forest border + gold check
// overlay). Motion rides the house cubic-bezier easing.
const CARD_FLOAT = '-4px -5px 12px rgba(255,255,255,0.6), 6px 10px 24px rgba(27,56,40,0.14)';
// Hovered: a larger, softer drop shadow that also blooms a gold-tinted glow, so
// the lifted card glints warm against the ivory page.
const CARD_LIFT_GLASS =
  '-6px -7px 20px rgba(255,255,255,0.9), 12px 20px 46px rgba(27,56,40,0.22), 0 12px 44px rgba(182,135,31,0.24)';

function cardBaseStyle(selected: boolean, hovered: boolean, pressed = false): React.CSSProperties {
  return {
    position: 'relative',
    // On hover the card turns glassy — a soft light border reads as a frosted
    // rim; selected keeps its forest border for a legible active state.
    border: hovered
      ? '2px solid rgba(255,255,255,0.8)'
      : selected
        ? `2px solid ${NEU.forest}`
        : '2px solid rgba(27,56,40,0.10)',
    borderRadius: 22,
    // Glassmorphism on hover: a whitish semi-transparent fill + backdrop blur,
    // so the card frosts over the ivory ground. Selected (unhovered) keeps the
    // solid surface; the default rests on the base tone.
    backgroundColor: hovered
      ? 'rgba(255,255,255,0.6)'
      : selected
        ? NEU.surface
        : NEU.base,
    backdropFilter: hovered ? 'blur(16px) saturate(1.2)' : undefined,
    WebkitBackdropFilter: hovered ? 'blur(16px) saturate(1.2)' : undefined,
    boxShadow: hovered ? CARD_LIFT_GLASS : selected ? NEU.out : CARD_FLOAT,
    // Scale-on-press: a pressed card depresses (from its lifted hover state, or
    // to 0.97 at rest) for tactile feedback — never below 0.95.
    transform: pressed
      ? hovered
        ? 'translateY(-6px) scale(1.0)'
        : selected
          ? 'translateY(-2px) scale(0.99)'
          : 'scale(0.97)'
      : hovered
        ? 'translateY(-6px) scale(1.05)'
        : selected
          ? 'translateY(-2px) scale(1.01)'
          : 'translateY(0) scale(1)',
    transition: `transform 200ms ${EASE}, box-shadow 320ms ${EASE}, border-color 320ms ${EASE}, background-color 320ms ${EASE}`,
    transformOrigin: 'center',
    // will-change only while actually animating, not permanently on every card.
    willChange: hovered || pressed ? 'transform' : 'auto',
    cursor: 'pointer',
    fontFamily: OUTFIT,
    textAlign: 'center',
    outline: 'none',
  };
}

// ── TwoTabPick, two LARGE side-by-side cards ──────────────────────────────

export function TwoTabPick({
  options,
  value,
  onChange,
}: {
  /** Expect exactly 2 options. */
  options: WizardOption[];
  value: string | null;
  onChange: (key: string) => void;
}) {
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const [pressKey, setPressKey] = useState<string | null>(null);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(e: React.KeyboardEvent, idx: number) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      refs.current[(idx + 1) % options.length]?.focus();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      refs.current[(idx - 1 + options.length) % options.length]?.focus();
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onChange(options[idx].key);
    }
  }

  return (
    <div
      role="radiogroup"
      className="grid gap-6"
      style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', padding: '4px' }}
    >
      {options.map((opt, idx) => {
        const selected = value === opt.key;
        const hovered = hoverKey === opt.key;
        const pressed = pressKey === opt.key;
        return (
          <button
            key={opt.key}
            ref={(el) => { refs.current[idx] = el; }}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt.key)}
            onKeyDown={(e) => onKeyDown(e, idx)}
            onMouseEnter={() => setHoverKey(opt.key)}
            onMouseLeave={() => { setHoverKey(null); setPressKey(null); }}
            onPointerDown={() => setPressKey(opt.key)}
            onPointerUp={() => setPressKey(null)}
            className="flex flex-col items-center justify-start focus-visible:ring-2"
            style={{
              ...cardBaseStyle(selected, hovered, pressed),
              minHeight: 400,
              padding: opt.image ? '0 0 34px' : '56px 26px 44px',
              overflow: 'hidden',
            }}
          >
            <GoldCheck visible={selected} />

            {opt.image ? (
              <span
                aria-hidden
                style={{
                  display: 'block',
                  width: '100%',
                  height: 248,
                  marginBottom: 26,
                  backgroundImage: `url(${opt.image})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  filter: selected ? 'saturate(1.05)' : 'saturate(0.82)',
                  opacity: selected ? 1 : 0.9,
                  transition: `filter 300ms ${EASE}, opacity 300ms ${EASE}`,
                }}
              />
            ) : opt.icon ? (
              <span
                aria-hidden
                className="flex items-center justify-center"
                style={{ fontSize: 100, height: 124, marginBottom: 24 }}
              >
                {opt.icon}
              </span>
            ) : null}

            <span
              style={{
                fontFamily: OUTFIT,
                fontWeight: 800,
                fontSize: 25,
                color: selected ? NEU.forest : NEU.ink,
                padding: '0 14px',
              }}
            >
              {opt.label}
            </span>
            {opt.sub && (
              <span
                style={{
                  fontFamily: OUTFIT,
                  fontSize: 15,
                  fontWeight: 500,
                  color: NEU.muted,
                  marginTop: 9,
                  padding: '0 20px',
                  lineHeight: 1.5,
                }}
              >
                {opt.sub}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── CardSelect, grid of select cards ──────────────────────────────────────

export function CardSelect({
  options,
  value,
  onChange,
  multiple = false,
  searchable = false,
  columns = 3,
  size = 'default',
}: {
  /** Every option must carry an icon or image, never text-only. */
  options: WizardOption[];
  /** Single mode: selected key (or null). Multiple mode: array of selected keys. */
  value: string | string[] | null;
  /** Fires with the clicked key; in multiple mode the caller toggles membership. */
  onChange: (key: string) => void;
  multiple?: boolean;
  searchable?: boolean;
  columns?: number;
  /**
   * Card scale. `'default'` is the compact list tile (countries, venues).
   * `'lg'` renders big, generous cards with an oversized icon/image — for
   * short pick-one/pick-few choices that should feel as bold as step 1's
   * TwoTabPick (e.g. the experience-level question).
   */
  size?: 'default' | 'lg';
}) {
  const big = size === 'lg';
  const [query, setQuery] = useState('');
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const [pressKey, setPressKey] = useState<string | null>(null);
  const [searchFocus, setSearchFocus] = useState(false);

  const selectedKeys = useMemo(
    () => new Set(Array.isArray(value) ? value : value ? [value] : []),
    [value],
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!searchable || !q) return options;
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || (o.sub ?? '').toLowerCase().includes(q),
    );
  }, [options, query, searchable]);

  return (
    <div>
      {searchable && (
        <div className="relative" style={{ marginBottom: 14 }}>
          <span
            className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: NEU.muted }}
          >
            <Search size={16} strokeWidth={2.4} />
          </span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setSearchFocus(true)}
            onBlur={() => setSearchFocus(false)}
            placeholder="Search…"
            style={{
              width: '100%',
              padding: '12px 16px 12px 42px',
              borderRadius: 14,
              border: searchFocus ? `1.5px solid ${NEU.forest}` : '1.5px solid transparent',
              backgroundColor: NEU.base,
              boxShadow: NEU.inSm,
              fontFamily: OUTFIT,
              fontSize: 14,
              color: NEU.ink,
              outline: 'none',
              transition: `border-color 180ms ${EASE}`,
            }}
          />
        </div>
      )}

      {multiple && selectedKeys.size > 0 && (
        <p
          style={{
            fontFamily: OUTFIT,
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: '0.1em',
            color: NEU.deepGold,
            marginBottom: 10,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {selectedKeys.size} SELECTED
        </p>
      )}

      <div
        role={multiple ? 'group' : 'radiogroup'}
        className={big ? 'grid gap-5' : 'grid gap-4'}
        style={{
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          maxHeight: searchable ? 360 : undefined,
          overflowY: searchable ? 'auto' : undefined,
          padding: '6px',
        }}
      >
        {shown.map((opt) => {
          const selected = selectedKeys.has(opt.key);
          const hovered = hoverKey === opt.key;
          const pressed = pressKey === opt.key;
          return (
            <button
              key={opt.key}
              type="button"
              role={multiple ? 'checkbox' : 'radio'}
              aria-checked={selected}
              onClick={() => onChange(opt.key)}
              onMouseEnter={() => setHoverKey(opt.key)}
              onMouseLeave={() => { setHoverKey(null); setPressKey(null); }}
              onPointerDown={() => setPressKey(opt.key)}
              onPointerUp={() => setPressKey(null)}
              className="flex flex-col items-center justify-center"
              style={{
                ...cardBaseStyle(selected, hovered, pressed),
                minHeight: big ? 218 : 156,
                padding: opt.image
                  ? big ? '0 0 26px' : '0 0 18px'
                  : big ? '44px 20px 34px' : '28px 14px 22px',
                overflow: 'hidden',
              }}
            >
              <GoldCheck visible={selected} />
              {opt.image ? (
                <span
                  aria-hidden
                  style={{
                    display: 'block',
                    width: '100%',
                    height: big ? 150 : 110,
                    marginBottom: big ? 22 : 15,
                    backgroundImage: `url(${opt.image})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    filter: selected ? 'saturate(1.05)' : 'saturate(0.82)',
                    transition: `filter 300ms ${EASE}`,
                  }}
                />
              ) : (
                <span
                  aria-hidden
                  className="flex items-center justify-center"
                  style={{
                    fontSize: big ? 76 : 46,
                    height: big ? 96 : 58,
                    marginBottom: big ? 20 : 13,
                  }}
                >
                  {opt.icon}
                </span>
              )}
              <span
                className="truncate w-full"
                style={{
                  fontFamily: OUTFIT,
                  fontWeight: big ? 800 : 700,
                  fontSize: big ? 20 : 14.5,
                  color: selected ? NEU.forest : NEU.ink,
                  padding: '0 10px',
                }}
              >
                {opt.label}
              </span>
              {opt.sub && (
                <span
                  className="truncate w-full"
                  style={{
                    fontFamily: OUTFIT,
                    fontSize: big ? 14.5 : 12,
                    fontWeight: 500,
                    color: NEU.muted,
                    marginTop: big ? 7 : 4,
                    padding: '0 10px',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {opt.sub}
                </span>
              )}
            </button>
          );
        })}
        {shown.length === 0 && (
          <p
            style={{
              gridColumn: '1 / -1',
              fontFamily: OUTFIT,
              fontSize: 13,
              color: NEU.muted,
              textAlign: 'center',
              padding: '22px 0',
            }}
          >
            No matches.
          </p>
        )}
      </div>
    </div>
  );
}
