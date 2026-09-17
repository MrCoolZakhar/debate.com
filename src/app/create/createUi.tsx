'use client';

// ─────────────────────────────────────────────────────────────────────────────
// createUi — the visual kit for the /create build screen, and nothing else.
//
// WHY IT EXISTS. The build screen used to be a two-column split (every field on
// the left, the roster on the right) squeezed into FitToScreen, so the whole
// page re-scaled to the window and the roster was a tall narrow strip. It is
// now one focused column that reads top to bottom, in the join page's visual
// language (it borrows `joinUi` directly so the two stay one family):
//
//   1. Committee   name (preset typeahead), topic, chair name
//   2. Delegations add field, presets, the roster as a full-width panel with a
//                  FIXED height (it scrolls inside, so adding 190 seats never
//                  moves anything below it), then "Paste a list" last
//   + a sticky action bar with the summary and the one primary button.
//
// Presentational only: no data, no routing, no state beyond what is passed in.
// ─────────────────────────────────────────────────────────────────────────────

import type { ReactNode } from 'react';
import { C, OUTFIT, SHADOW } from '../join/joinUi';

export { C, OUTFIT, SHADOW };

/** One input look for every field on the page. 16px on phones so iOS never zooms. */
export const INPUT_CLS =
  'w-full h-[50px] rounded-[14px] bg-white/80 px-4 text-base sm:text-[15px] text-[#1C1410] placeholder-[#8A7C6B] ' +
  'shadow-[inset_0_0_0_1px_rgba(27,56,40,0.16)] focus:outline-none ' +
  'focus:shadow-[inset_0_0_0_2px_#1B3828,0_0_0_4px_rgba(27,56,40,0.08)] transition-[box-shadow] duration-150';

/** A numbered section card. No overflow clipping, so typeaheads can hang out of it. */
export function StepCard({ step, title, hint, aside, children, labelledBy }: {
  step: number;
  title: string;
  hint: string;
  aside?: ReactNode;
  children: ReactNode;
  labelledBy: string;
}) {
  return (
    <section
      aria-labelledby={labelledBy}
      className="relative"
      style={{
        borderRadius: 24,
        backgroundColor: C.surface,
        boxShadow: `${SHADOW.card}, inset 0 0 0 1px rgba(27,56,40,0.07)`,
      }}
    >
      <div className="px-4 pb-5 pt-5 sm:px-7 sm:pb-7 sm:pt-6">
        <header className="mb-4 flex items-start gap-3 sm:mb-5">
          <span
            aria-hidden
            className="flex flex-shrink-0 items-center justify-center tabular-nums"
            style={{
              width: 30, height: 30, borderRadius: 999,
              backgroundColor: C.forest, color: C.gold,
              fontFamily: OUTFIT, fontSize: 14, fontWeight: 800,
              boxShadow: '0 2px 6px rgba(27,56,40,0.18)',
            }}
          >
            {step}
          </span>
          <div className="min-w-0 flex-1">
            {/* Title and aside share one row, so the hint below always gets the full width. */}
            <div className="flex min-h-[30px] flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <h2
                id={labelledBy}
                style={{ fontFamily: OUTFIT, fontSize: 19, fontWeight: 800, letterSpacing: '-0.01em', color: C.forest, lineHeight: 1.25, margin: 0, textWrap: 'balance' }}
              >
                {title}
              </h2>
              {aside && <div className="flex flex-shrink-0 items-center gap-2">{aside}</div>}
            </div>
            <p style={{ fontFamily: OUTFIT, fontSize: 13, lineHeight: 1.45, color: C.inkSoft, marginTop: 2, textWrap: 'pretty' }}>
              {hint}
            </p>
          </div>
        </header>
        {children}
      </div>
    </section>
  );
}

/** Small uppercase heading for a group inside a card (presets, the roster). */
export function GroupLabel({ children, htmlFor, id }: { children: ReactNode; htmlFor?: string; id?: string }) {
  const style = { fontFamily: OUTFIT, fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', color: C.inkSoft } as const;
  return htmlFor
    ? <label id={id} htmlFor={htmlFor} className="mb-2 block uppercase" style={style}>{children}</label>
    : <p id={id} className="mb-2 uppercase" style={style}>{children}</p>;
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
      style={{ color: tone === 'gold' ? C.goldDeep : C.muted }}
    >
      {children}
    </button>
  );
}
