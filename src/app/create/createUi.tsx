'use client';

// ─────────────────────────────────────────────────────────────────────────────
// createUi — the visual kit for the /create build screen, and nothing else.
//
// THE SCREEN (17 Sep 2026, owner: "It needs to be easy, in one page"; reworked the
// same day: "I don't like the massive green block"). One screen, no page scroll
// from lg up (1280x800 and larger), two columns:
//
//   Left   1. Committee: the emblem in a WHITE DISC with the live acronym / name,
//          topic and chairs beside it (LiveCommitteeIdentity), then the name,
//          topic and chairs fields. 2. Delegations: the add bar, the quick
//          bundles and Paste a list.
//   Right  the delegations only: a large count (DelegationCount, plain type, no
//          pill), ONE column of countries that scrolls inside, and Start session
//          (StartSessionButton) pinned at the foot.
//
// Design rule (CLAUDE.md §8): no count or status pills. Counts are typography,
// observer status is the megaphone icon.
// Below lg the panels stack and the page scrolls normally (phones).
// Borrows `joinUi` directly so /join and /create stay one family.
// Presentational only: no data, no routing, no state beyond a failed-image set.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Gavel, Loader2, Lock, Megaphone, Plus, X } from 'lucide-react';
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
      @keyframes create-count-in { from { opacity: 0; transform: translateY(6px); filter: blur(3px); } to { opacity: 1; transform: none; filter: blur(0); } }
      .create-count-in { animation: create-count-in 220ms cubic-bezier(0.2,0,0,1) both; }
      .create-start { transition-property: transform, box-shadow, background-color; transition-duration: 180ms; transition-timing-function: cubic-bezier(0.2,0,0,1); }
      .create-start-disc { transition-property: transform; transition-duration: 220ms; transition-timing-function: cubic-bezier(0.2,0,0,1); }
      @media (hover: hover) {
        .create-start.is-ready:hover { transform: translateY(-1px); box-shadow: inset 0 1px 0 rgba(238,217,138,0.28), inset 0 0 0 1px rgba(238,217,138,0.22), 0 4px 8px rgba(27,56,40,0.18), 0 18px 36px rgba(27,56,40,0.30) !important; }
        .create-start.is-ready:hover .create-start-disc { transform: rotate(-12deg); }
      }
      .create-start.is-ready:active { transform: scale(0.96); }
      @media (prefers-reduced-motion: reduce) { .create-emblem-in, .create-count-in { animation: none; } .create-start, .create-start-disc { transition: none; } .create-start.is-ready:hover .create-start-disc { transform: none; } }
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
      <StepHeading step={step} title={title} labelledBy={labelledBy} aside={aside} />
      {children}
    </section>
  );
}

/** The numbered step heading: a forest disc with the gold numeral, then the title. */
export function StepHeading({ step, title, labelledBy, aside }: {
  step: number;
  title: string;
  labelledBy: string;
  aside?: ReactNode;
}) {
  return (
    <header className="mb-3 flex min-h-[32px] flex-shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5">
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
  );
}

/** Small uppercase label above a field. Compact, so three fields fit under the preview. */
export function SmallLabel({ children, htmlFor, id }: { children: ReactNode; htmlFor?: string; id?: string }) {
  const style = { fontFamily: OUTFIT, fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', color: C.inkSoft, marginBottom: 6 } as const;
  return htmlFor
    ? <label id={id} htmlFor={htmlFor} className="block uppercase" style={style}>{children}</label>
    : <p id={id} className="uppercase" style={style}>{children}</p>;
}

// ── The live committee identity ─────────────────────────────────────────────
// (17 Sep 2026, owner: "I don't like the massive green block. Rather have the
// committee logo in a white circle".) A compact row: the emblem in a white disc,
// resolved by the caller (matchPresetEmblem), then the UN emblem, then forest
// initials, never a broken image; beside it the acronym with the full name
// beneath, the topic and the chairs, exactly as the chair masthead will state them.
export function LiveCommitteeIdentity({ src, primary, secondary, placeholder, topic, topicLabel, topicEmpty, chairsLine }: {
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
    <div aria-hidden className="flex flex-shrink-0 items-center gap-4">
      {/* The white disc. The artwork is re-keyed, so a new match fades in instead of snapping. */}
      <span
        className="relative flex flex-shrink-0 items-center justify-center rounded-full bg-white"
        style={{
          width: 'clamp(72px, 9.5vh, 96px)', aspectRatio: '1', containerType: 'size',
          boxShadow: '0 1px 2px rgba(27,56,40,0.10), 0 8px 22px rgba(27,56,40,0.14), inset 0 0 0 1px rgba(0,0,0,0.06)',
        }}
      >
        <span key={shown ?? `mono:${monogram}`} className="create-emblem-in flex h-full w-full items-center justify-center" style={{ padding: '15%' }}>
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={shown}
              alt=""
              draggable={false}
              decoding="async"
              onError={() => setFailed((prev) => { const n = new Set(prev); n.add(shown); return n; })}
              className="block h-full w-full object-contain"
            />
          ) : (
            <span style={{ fontFamily: OUTFIT, fontWeight: 900, fontSize: '26cqw', letterSpacing: '0.02em', color: C.forest }}>{monogram}</span>
          )}
        </span>
      </span>

      <div className="min-w-0 flex-1">
        <p
          className="truncate"
          title={primary || placeholder}
          style={{
            fontFamily: OUTFIT, fontWeight: 800, letterSpacing: '-0.015em', lineHeight: 1.12,
            fontSize: (primary || placeholder).length > 22 ? 20 : 26,
            color: hasName ? C.forest : C.muted,
          }}
        >
          {primary || placeholder}
        </p>
        {secondary && (
          <p className="mt-0.5 truncate" style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 500, lineHeight: 1.35, color: C.inkSoft }}>
            {secondary}
          </p>
        )}
        <p className="mt-1 line-clamp-2" style={{ fontFamily: OUTFIT, fontSize: 13, lineHeight: 1.4, color: topic ? C.ink : C.muted, textWrap: 'pretty' }}>
          <span style={{ fontWeight: 800, color: C.goldDeep }}>{topicLabel}</span>{' '}
          <span style={{ fontWeight: 500 }}>{topic || topicEmpty}</span>
        </p>
        {chairsLine && (
          <p className="mt-0.5 truncate" style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 600, color: C.inkSoft }}>
            {chairsLine}
          </p>
        )}
      </div>
    </div>
  );
}

// ── The delegation count ─────────────────────────────────────────────────────
// Plain typography, never a pill (CLAUDE.md §8): a large tabular numeral with its
// word beside it, and the observers in a quiet line beneath. The numeral re-keys
// on change so it settles in with a short rise (off under reduced motion).
export function DelegationCount({ count, word, observersLine, liveLabel }: {
  count: number;
  word: string;
  observersLine: string | null;
  /** The full sentence ("15 delegations, 2 observers") for screen readers. */
  liveLabel: string;
}) {
  return (
    <div className="flex min-w-0 items-end gap-3">
      <span className="sr-only" aria-live="polite">{liveLabel}</span>
      <span
        aria-hidden
        key={count}
        className="create-count-in flex-shrink-0 tabular-nums"
        style={{ fontFamily: OUTFIT, fontSize: 52, fontWeight: 800, lineHeight: 0.9, letterSpacing: '-0.04em', color: count > 0 ? C.forest : C.muted }}
      >
        {count}
      </span>
      <span aria-hidden className="flex min-w-0 flex-col pb-0.5">
        <span className="truncate" style={{ fontFamily: OUTFIT, fontSize: 17, fontWeight: 800, lineHeight: 1.15, color: C.forest }}>{word}</span>
        <span className="flex min-w-0 items-center gap-1.5 truncate" style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 600, lineHeight: 1.3, color: observersLine ? '#8A6414' : 'transparent' }}>
          {observersLine ? <><Megaphone size={13} strokeWidth={2.2} className="flex-shrink-0" />{observersLine}</> : '\u00A0'}
        </span>
      </span>
    </div>
  );
}

// ── Start session ────────────────────────────────────────────────────────────
// The one primary action. Forest with gold, a gold gavel disc at the inline end,
// a sub line that says what will happen (or what is missing), a soft lift on
// hover, scale on press. When the form is incomplete it stays focusable
// (aria-disabled) so a press can take the chair to the missing field.
export function StartSessionButton({ label, sub, state, onClick }: {
  label: string;
  sub: string | null;
  state: 'ready' | 'blocked' | 'creating';
  onClick: () => void;
}) {
  const ready = state === 'ready';
  const creating = state === 'creating';
  const blocked = state === 'blocked';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-disabled={!ready || undefined}
      aria-busy={creating || undefined}
      disabled={creating}
      className={`create-start group relative flex w-full items-center gap-3 overflow-hidden text-start focus:outline-none focus-visible:shadow-[0_0_0_3px_#EDE7D8,0_0_0_5px_#1B3828] ${ready ? 'is-ready active:scale-[0.96]' : ''}`}
      style={{
        minHeight: 64, borderRadius: 20, paddingInlineStart: 20, paddingInlineEnd: 8,
        backgroundColor: blocked ? 'rgba(27,56,40,0.06)' : C.forest,
        boxShadow: blocked
          ? 'inset 0 0 0 1.5px rgba(27,56,40,0.14)'
          : 'inset 0 1px 0 rgba(238,217,138,0.22), inset 0 0 0 1px rgba(238,217,138,0.14), 0 2px 4px rgba(27,56,40,0.16), 0 12px 28px rgba(27,56,40,0.26)',
        cursor: blocked ? 'not-allowed' : creating ? 'progress' : 'pointer',
      }}
    >
      {!blocked && <span aria-hidden className="pointer-events-none absolute inset-0" style={{ backgroundImage: GRAIN, backgroundSize: '300px 300px', mixBlendMode: 'overlay', opacity: 0.08 }} />}
      <span className="relative flex min-w-0 flex-1 flex-col py-2.5">
        <span className="truncate" style={{ fontFamily: OUTFIT, fontSize: 17, fontWeight: 800, letterSpacing: '0.01em', lineHeight: 1.2, color: blocked ? C.forest : C.gold }}>
          {label}
        </span>
        {sub && (
          <span className="truncate" style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 600, lineHeight: 1.3, marginTop: 2, color: blocked ? C.inkSoft : 'rgba(237,231,216,0.72)' }}>
            {sub}
          </span>
        )}
      </span>
      <span
        aria-hidden
        className="create-start-disc relative flex flex-shrink-0 items-center justify-center rounded-full"
        style={{
          width: 48, height: 48,
          backgroundColor: blocked ? 'rgba(27,56,40,0.08)' : C.gold,
          color: blocked ? C.muted : C.forest,
          boxShadow: blocked ? 'none' : 'inset 0 1px 0 rgba(255,255,255,0.55), 0 2px 6px rgba(0,0,0,0.22)',
        }}
      >
        {creating ? <Loader2 size={21} strokeWidth={2.6} className="animate-spin" /> : blocked ? <Lock size={18} strokeWidth={2.4} /> : <Gavel size={21} strokeWidth={2.3} className="rtl:-scale-x-100" />}
      </span>
    </button>
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
      style={{ color: tone === 'gold' ? '#6E500F' : C.inkSoft, backgroundColor: tone === 'gold' ? 'rgba(238,217,138,0.62)' : undefined }}
    >
      {children}
    </button>
  );
}
