'use client';

// ─────────────────────────────────────────────────────────────────────────────
// createUi — the visual kit for the /create build screen, and nothing else.
//
// THE SCREEN (17 Sep 2026, owner: "It needs to be easy, in one page"). One
// screen, no page scroll from lg up (1280x800 and larger), two panels:
//
//   1. Committee    a forest masthead with a LIVE preview of the committee as the
//                   chair will see it (the emblem big, the acronym with the full
//                   name beneath, the topic, the chairs), then the name, topic and
//                   chairs fields. A quiet "part of a conference? Log in" link.
//   2. Delegations  the add field and quick bundles, then ONE column of countries
//                   that scrolls inside its panel, and the primary button pinned
//                   at the foot.
//
// Below lg the panels stack and the page scrolls normally (phones).
// Borrows `joinUi` directly so /join and /create stay one family.
// Presentational only: no data, no routing, no state beyond a failed-image set.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Plus, X } from 'lucide-react';
import { DEFAULT_EMBLEM, emblemMonogram } from '@/components/CommitteeIdentityBadge';
import { C, OUTFIT, SHADOW } from '../join/joinUi';

export { C, OUTFIT, SHADOW };

/** One input look for every field on the page. 16px on phones so iOS never zooms. */
export const INPUT_CLS =
  'w-full h-[48px] lg:h-[46px] rounded-[14px] bg-white/80 px-4 text-base sm:text-[15px] text-[#1C1410] placeholder-[#8A7C6B] ' +
  'shadow-[inset_0_0_0_1px_rgba(27,56,40,0.16)] focus:outline-none ' +
  'focus:shadow-[inset_0_0_0_2px_#1B3828,0_0_0_4px_rgba(27,56,40,0.08)] transition-[box-shadow] duration-150';

const GRAIN =
  `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23grain)' opacity='1'/%3E%3C/svg%3E")`;

/** Keyframes for the live preview. Off under reduced motion. */
export function CreateStyles() {
  return (
    <style>{`
      @keyframes create-emblem-in { from { opacity: 0; transform: scale(0.94); filter: blur(4px); } to { opacity: 1; transform: scale(1); filter: blur(0); } }
      .create-emblem-in { animation: create-emblem-in 260ms cubic-bezier(0.2,0,0,1) both; }
      @media (prefers-reduced-motion: reduce) { .create-emblem-in { animation: none; } }
    `}</style>
  );
}

/** A panel: the surface card that holds one step. Never clips, so typeaheads can hang out. */
export function Panel({ step, title, labelledBy, aside, children, className = '' }: {
  step: number;
  title: string;
  labelledBy: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-labelledby={labelledBy}
      className={`relative flex flex-col p-4 sm:p-5 ${className}`}
      style={{ borderRadius: 26, backgroundColor: C.surface, boxShadow: `${SHADOW.card}, inset 0 0 0 1px rgba(27,56,40,0.07)` }}
    >
      <header className="mb-3.5 flex min-h-[32px] flex-shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5">
        <span
          aria-hidden
          className="flex flex-shrink-0 items-center justify-center tabular-nums"
          style={{
            width: 28, height: 28, borderRadius: 999, backgroundColor: C.forest, color: C.gold,
            fontFamily: OUTFIT, fontSize: 13, fontWeight: 800, boxShadow: '0 2px 6px rgba(27,56,40,0.18)',
          }}
        >
          {step}
        </span>
        <h2
          id={labelledBy}
          className="me-auto"
          style={{ fontFamily: OUTFIT, fontSize: 19, fontWeight: 800, letterSpacing: '-0.01em', color: C.forest, lineHeight: 1.2, margin: 0 }}
        >
          {title}
        </h2>
        {aside && <div className="flex flex-wrap items-center gap-2">{aside}</div>}
      </header>
      {children}
    </section>
  );
}

/** Small uppercase label above a field. Compact, so three fields fit under the preview. */
export function SmallLabel({ children, htmlFor, id }: { children: ReactNode; htmlFor?: string; id?: string }) {
  const style = { fontFamily: OUTFIT, fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', color: C.inkSoft, marginBottom: 6 } as const;
  return htmlFor
    ? <label id={id} htmlFor={htmlFor} className="block uppercase" style={style}>{children}</label>
    : <p id={id} className="uppercase" style={style}>{children}</p>;
}

// ── The live committee preview ───────────────────────────────────────────────
// Mirrors the chair masthead (CommitteeIdentityBadge): the emblem resolved by
// the caller (matchPresetEmblem), then the UN emblem, then gold initials, never a
// broken image. The emblem's size follows the window height so the whole screen
// fits at 1280x800 and still reads as the hero at 1920x1080.
export function LiveCommitteePreview({ src, primary, secondary, placeholder, topic, topicLabel, topicEmpty, chairsLine }: {
  src: string | null;
  primary: string;
  secondary: string | null;
  /** Shown instead of `primary` while no name is typed. */
  placeholder: string;
  topic: string;
  topicLabel: string;
  topicEmpty: string;
  chairsLine: string | null;
}) {
  const [failed, setFailed] = useState<ReadonlySet<string>>(() => new Set());
  const shown = [src, DEFAULT_EMBLEM].find((s): s is string => !!s && !failed.has(s)) ?? null;
  const hasName = !!primary;
  const monogram = emblemMonogram(primary || placeholder);

  return (
    <div
      aria-hidden
      className="relative flex min-h-[300px] flex-col items-center justify-center overflow-hidden px-5 py-5 text-center lg:min-h-0 lg:flex-1"
      style={{ borderRadius: 20, backgroundColor: C.forest, boxShadow: 'inset 0 0 0 1px rgba(238,217,138,0.10), 0 10px 26px rgba(27,56,40,0.20)' }}
    >
      <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: GRAIN, backgroundSize: '300px 300px', mixBlendMode: 'overlay', opacity: 0.08 }} />
      <div
        className="pointer-events-none absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ width: 'min(90%, 420px)', aspectRatio: '1', background: 'radial-gradient(circle, rgba(237,231,216,0.15) 0%, rgba(237,231,216,0.05) 42%, rgba(237,231,216,0) 70%)' }}
      />

      {/* The emblem: re-keyed on the image, so a new match fades in instead of snapping. */}
      <span
        key={shown ?? `mono:${monogram}`}
        className="create-emblem-in relative flex flex-shrink-0 items-center justify-center"
        style={{ width: 'clamp(104px, 23vh, 232px)', aspectRatio: '1', containerType: 'size' }}
      >
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={shown}
            alt=""
            draggable={false}
            decoding="async"
            onError={() => setFailed((prev) => { const n = new Set(prev); n.add(shown); return n; })}
            className="block h-full w-full object-contain"
            style={{ filter: 'drop-shadow(0 0 1px rgba(255,255,255,0.55)) drop-shadow(0 6px 14px rgba(0,0,0,0.34))' }}
          />
        ) : (
          <span style={{ fontFamily: OUTFIT, fontWeight: 900, fontSize: '31cqw', letterSpacing: '0.02em', color: C.gold }}>{monogram}</span>
        )}
      </span>

      <div className="relative mt-3 w-full max-w-[520px] min-w-0">
        {/* A long custom name wraps to two lines at a smaller size instead of losing its end. */}
        <p
          className="line-clamp-2"
          title={primary || placeholder}
          style={{
            fontFamily: OUTFIT, fontWeight: 800, letterSpacing: '-0.015em', lineHeight: 1.12, textWrap: 'balance', overflowWrap: 'anywhere',
            fontSize: (primary || placeholder).length > 22 ? 'clamp(20px, 3vh, 30px)' : 'clamp(24px, 3.9vh, 40px)',
            color: hasName ? C.page : 'rgba(237,231,216,0.62)',
          }}
        >
          {primary || placeholder}
        </p>
        {secondary && (
          <p className="mt-0.5 truncate" style={{ fontFamily: OUTFIT, fontSize: 14, fontWeight: 500, lineHeight: 1.35, color: 'rgba(237,231,216,0.80)' }}>
            {secondary}
          </p>
        )}
        <p
          className="mt-2.5 line-clamp-2"
          style={{ fontFamily: OUTFIT, fontSize: 14, lineHeight: 1.4, color: topic ? 'rgba(237,231,216,0.90)' : 'rgba(237,231,216,0.62)', textWrap: 'balance' }}
        >
          <span style={{ fontWeight: 800, color: C.gold }}>{topicLabel}</span>{' '}
          <span style={{ fontWeight: 500 }}>{topic || topicEmpty}</span>
        </p>
        {chairsLine && (
          <p className="mt-1.5 truncate" style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 600, letterSpacing: '0.01em', color: 'rgba(237,231,216,0.72)' }}>
            {chairsLine}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Chairs: a token field ────────────────────────────────────────────────────
// Committed names are chips, the draft is the text after them. The creator is the
// first name. The draft counts even if it was never turned into a chip, so typing
// one name and pressing Start behaves exactly as the old single field did.
export function ChairTokenField({ id, chairs, draft, onDraft, onCommit, onRemove, onPopLast, max, placeholder, morePlaceholder, addLabel, removeLabel }: {
  id: string;
  chairs: string[];
  draft: string;
  onDraft: (v: string) => void;
  onCommit: () => void;
  onRemove: (index: number) => void;
  onPopLast: () => void;
  max: number;
  placeholder: string;
  morePlaceholder: string;
  addLabel: string;
  removeLabel: (name: string) => string;
}) {
  const full = chairs.length >= max;
  // Chips scroll sideways inside the field; keep the text caret in view after each add.
  const inputRef = useRef<HTMLInputElement>(null);
  const seenCount = useRef(chairs.length);
  useEffect(() => {
    if (chairs.length > seenCount.current) inputRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    seenCount.current = chairs.length;
  }, [chairs.length]);
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'Enter' || e.key === ',') && draft.trim()) { e.preventDefault(); onCommit(); }
    else if (e.key === 'Enter') e.preventDefault();
    else if (e.key === 'Backspace' && !draft && chairs.length > 0) { e.preventDefault(); onPopLast(); }
  };
  return (
    <div
      className="flex h-[48px] items-center gap-1.5 rounded-[14px] bg-white/80 ps-1.5 pe-1.5 shadow-[inset_0_0_0_1px_rgba(27,56,40,0.16)] transition-[box-shadow] duration-150 focus-within:shadow-[inset_0_0_0_2px_#1B3828,0_0_0_4px_rgba(27,56,40,0.08)] lg:h-[46px]"
    >
      <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {chairs.map((name, i) => (
          <span
            key={`${name}-${i}`}
            className="flex h-[32px] flex-shrink-0 items-center gap-1 rounded-full ps-3 pe-1"
            style={{ backgroundColor: 'rgba(27,56,40,0.08)', boxShadow: 'inset 0 0 0 1px rgba(27,56,40,0.10)', fontFamily: OUTFIT, fontSize: 13.5, fontWeight: 700, color: C.forest }}
          >
            <span className="max-w-[160px] truncate">{name}</span>
            <button
              type="button"
              onClick={() => onRemove(i)}
              aria-label={removeLabel(name)}
              title={removeLabel(name)}
              className="flex h-6 w-6 items-center justify-center rounded-full transition-[background-color,color,transform] duration-150 hover:bg-[#8B2020]/[0.10] hover:text-[#8B2020] active:scale-[0.96] focus:outline-none focus-visible:shadow-[0_0_0_2px_#1B3828]"
              style={{ color: C.inkSoft }}
            >
              <X size={13} strokeWidth={2.4} />
            </button>
          </span>
        ))}
        {!full && (
          <input
            ref={inputRef}
            id={id}
            type="text"
            autoComplete="off"
            value={draft}
            onChange={(e) => onDraft(e.target.value.replace(/,/g, ''))}
            onKeyDown={onKeyDown}
            placeholder={chairs.length === 0 ? placeholder : morePlaceholder}
            className="h-full min-w-[120px] flex-1 bg-transparent px-2 text-base text-[#1C1410] placeholder-[#8A7C6B] focus:outline-none sm:text-[15px]"
          />
        )}
      </div>
      {!full && (
        <button
          type="button"
          onClick={onCommit}
          disabled={!draft.trim()}
          aria-label={addLabel}
          title={addLabel}
          className="flex h-[34px] flex-shrink-0 items-center gap-1 rounded-[10px] px-2.5 text-[12.5px] font-extrabold transition-[background-color,color,transform,opacity] duration-150 enabled:hover:bg-[#1B3828] enabled:hover:text-[#EED98A] enabled:active:scale-[0.96] disabled:opacity-40 focus:outline-none focus-visible:shadow-[0_0_0_2px_#1B3828]"
          style={{ backgroundColor: 'rgba(27,56,40,0.07)', color: C.forest }}
        >
          <Plus size={14} strokeWidth={2.8} />
          <span className="hidden sm:inline">{addLabel}</span>
        </button>
      )}
    </div>
  );
}

/** Square icon button used on roster rows: 36px, tinted on hover, scale on press. */
export function RowIconButton({ onClick, label, pressed, tone = 'neutral', children }: {
  onClick: () => void;
  label: string;
  pressed?: boolean;
  tone?: 'neutral' | 'danger' | 'gold';
  children: ReactNode;
}) {
  const hover =
    tone === 'danger'
      ? 'hover:text-[#8B2020] hover:bg-[#8B2020]/[0.08]'
      : 'hover:text-[#1B3828] hover:bg-[#1B3828]/[0.07]';
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={pressed}
      className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] focus:outline-none focus-visible:shadow-[0_0_0_2px_#1B3828] active:scale-[0.96] transition-[color,background-color,transform] duration-150 ${hover}`}
      style={{ color: tone === 'gold' ? '#8A6414' : C.inkSoft }}
    >
      {children}
    </button>
  );
}
