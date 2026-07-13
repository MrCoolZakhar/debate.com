'use client';

/**
 * wizard.tsx — shared step-questionnaire kit for onboarding flows
 * (conference creation, auth onboarding). Neumorphism-inspired,
 * forest/ivory, Outfit — built on the NEU tokens from neu.tsx.
 *
 * Exports:
 *   WizardShell  — centered column with progress dots, big title, back arrow
 *   TwoTabPick   — two large side-by-side pick cards (binary choice)
 *   CardSelect   — grid of select cards, every option has an icon/image slot;
 *                  supports multiple + searchable
 */

import { useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, Search } from 'lucide-react';
import { NEU, OUTFIT, EASE } from '@/components/neu';

// ── Shared types ───────────────────────────────────────────────────────────

export interface WizardOption {
  key: string;
  label: string;
  /** Small/large glyph slot — lucide icon, Emoji3D, flag <img>, anything. */
  icon?: React.ReactNode;
  /** Image URL (e.g. /onboarding/hall-01.jpg) — used as a large picture on the card. */
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
  children,
}: {
  /** 1-based current step. */
  step: number;
  total: number;
  title: string;
  sub?: string;
  onBack?: () => void;
  children: React.ReactNode;
}) {
  const [backHover, setBackHover] = useState(false);
  return (
    <div
      className="w-full flex flex-col items-center"
      style={{ maxWidth: 640, margin: '0 auto', padding: '8px 4px 32px' }}
    >
      {/* Progress dots */}
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
                transition: `all 320ms ${EASE}`,
              }}
            />
          );
        })}
      </div>

      {/* Back arrow + title block */}
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
              width: 38,
              height: 38,
              borderRadius: 999,
              border: 'none',
              backgroundColor: NEU.surface,
              color: backHover ? NEU.forest : NEU.muted,
              boxShadow: backHover ? NEU.outSmHover : NEU.outSm,
              transform: backHover ? 'translateY(-1px)' : 'translateY(0)',
              transition: `all 220ms ${EASE}`,
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
              }}
            >
              {sub}
            </p>
          )}
        </div>
      </div>

      <div className="w-full">{children}</div>
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
        transform: visible ? 'scale(1)' : 'scale(0.5)',
        transition: `all 260ms ${EASE}`,
        pointerEvents: 'none',
      }}
    >
      <Check size={14} strokeWidth={3.2} style={{ color: NEU.forest }} />
    </span>
  );
}

// Floating card look: a soft forest-tinted drop shadow lifts every option off
// the ivory page; hover grows the card (~1.04) and deepens the shadow so it
// reads as picked-up. Selected stays clearly distinct (forest border + the
// gold check overlay). Motion rides the house cubic-bezier easing.
const CARD_FLOAT = '-4px -5px 12px rgba(255,255,255,0.6), 6px 10px 24px rgba(27,56,40,0.14)';
const CARD_LIFT = '-5px -6px 16px rgba(255,255,255,0.72), 10px 16px 38px rgba(27,56,40,0.24)';

function cardBaseStyle(selected: boolean, hovered: boolean): React.CSSProperties {
  return {
    position: 'relative',
    border: selected ? `2px solid ${NEU.forest}` : '2px solid rgba(27,56,40,0.10)',
    borderRadius: 22,
    backgroundColor: selected ? NEU.surface : NEU.base,
    boxShadow: hovered ? CARD_LIFT : selected ? NEU.out : CARD_FLOAT,
    transform: hovered
      ? 'translateY(-4px) scale(1.04)'
      : selected
        ? 'translateY(-2px) scale(1.01)'
        : 'translateY(0) scale(1)',
    transition: `transform 320ms ${EASE}, box-shadow 320ms ${EASE}, border-color 320ms ${EASE}`,
    transformOrigin: 'center',
    willChange: 'transform',
    cursor: 'pointer',
    fontFamily: OUTFIT,
    textAlign: 'center',
    outline: 'none',
  };
}

// ── TwoTabPick — two LARGE side-by-side cards ──────────────────────────────

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
            onMouseLeave={() => setHoverKey(null)}
            className="flex flex-col items-center justify-start focus-visible:ring-2"
            style={{
              ...cardBaseStyle(selected, hovered),
              minHeight: 308,
              padding: opt.image ? '0 0 28px' : '42px 22px 34px',
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
                  height: 190,
                  marginBottom: 22,
                  backgroundImage: `url(${opt.image})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  filter: selected ? 'saturate(1.05)' : 'saturate(0.82)',
                  opacity: selected ? 1 : 0.9,
                  transition: `all 300ms ${EASE}`,
                }}
              />
            ) : opt.icon ? (
              <span
                aria-hidden
                className="flex items-center justify-center"
                style={{ fontSize: 84, height: 104, marginBottom: 20 }}
              >
                {opt.icon}
              </span>
            ) : null}

            <span
              style={{
                fontFamily: OUTFIT,
                fontWeight: 800,
                fontSize: 20,
                color: selected ? NEU.forest : NEU.ink,
                padding: '0 12px',
              }}
            >
              {opt.label}
            </span>
            {opt.sub && (
              <span
                style={{
                  fontFamily: OUTFIT,
                  fontSize: 13.5,
                  fontWeight: 500,
                  color: NEU.muted,
                  marginTop: 7,
                  padding: '0 16px',
                  lineHeight: 1.45,
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

// ── CardSelect — grid of select cards ──────────────────────────────────────

export function CardSelect({
  options,
  value,
  onChange,
  multiple = false,
  searchable = false,
  columns = 3,
}: {
  /** Every option must carry an icon or image — never text-only. */
  options: WizardOption[];
  /** Single mode: selected key (or null). Multiple mode: array of selected keys. */
  value: string | string[] | null;
  /** Fires with the clicked key; in multiple mode the caller toggles membership. */
  onChange: (key: string) => void;
  multiple?: boolean;
  searchable?: boolean;
  columns?: number;
}) {
  const [query, setQuery] = useState('');
  const [hoverKey, setHoverKey] = useState<string | null>(null);
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
        className="grid gap-4"
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
          return (
            <button
              key={opt.key}
              type="button"
              role={multiple ? 'checkbox' : 'radio'}
              aria-checked={selected}
              onClick={() => onChange(opt.key)}
              onMouseEnter={() => setHoverKey(opt.key)}
              onMouseLeave={() => setHoverKey(null)}
              className="flex flex-col items-center justify-center"
              style={{
                ...cardBaseStyle(selected, hovered),
                minHeight: 156,
                padding: opt.image ? '0 0 18px' : '28px 14px 22px',
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
                    height: 110,
                    marginBottom: 15,
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
                  style={{ fontSize: 46, height: 58, marginBottom: 13 }}
                >
                  {opt.icon}
                </span>
              )}
              <span
                className="truncate w-full"
                style={{
                  fontFamily: OUTFIT,
                  fontWeight: 700,
                  fontSize: 14.5,
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
                    fontSize: 12,
                    fontWeight: 500,
                    color: NEU.muted,
                    marginTop: 4,
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
