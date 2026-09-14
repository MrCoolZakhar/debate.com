// ── Notification glass ─────────────────────────────────────────────────────
//
// The one material every session banner is drawn in: a light frosted pane in the
// manner of an iOS / macOS notification. Shared so the stack, the gavel handover
// toast and the conferences `Toast` cannot drift into three different glasses.
//
// Colours come from the theme variables in globals.css (`--gv-*`), mixed toward
// transparent, so a re-themed deployment tints the glass with it.
//
// CONTRAST (computed, WCAG relative luminance, against the theme defaults). The
// fill is opaque enough to carry dark ink WITHOUT the blur: 92% surface at the top
// edge, 90% of a 6%-forest-washed surface at the bottom edge. Composited over the
// two backdrops the pane actually sits on, the weakest (bottom) edge becomes:
//   over ivory  #EDE7D8  -> ~#EDECE5        over forest #1B3828 -> ~#D8DAD4
// and every text colour on it clears AA (4.5:1) on both, worst case first:
//   ink      #1C1410                 12.9 forest / 15.3 ivory
//   inkSoft  80% ink  (#48423D)       7.1 forest /  8.4 ivory
//   inkFaint 72% ink  (#5A5450)       5.3 forest /  6.3 ivory   (11px timestamps)
//   goldInk  55% gold (#715318)       5.1 forest /  6.0 ivory   (12px bold countdown)
//   reject   #8B2020 on its 8% wash   5.7 forest /  6.7 ivory
// The solid no-blur fill (96% surface, #F1F0EB) gives inkFaint 6.6 and goldInk 6.2.
// Even over pure black the bottom edge keeps inkFaint at 5.1 and goldInk at 4.8.
// Before this pass the fill was 84% / 80% and inkFaint (60%) / goldInk (78% gold)
// measured 2.9 and 2.8 over forest, and 4.2 / 3.9 over ivory.
//
// FALLBACKS. Every mixed colour is a `color-mix()`. An engine without it DROPS the
// whole declaration, and an inline `background` that is dropped leaves the pane
// transparent. `GLASS_SAFE` holds the same colours pre-computed as plain rgb/rgba
// for the default theme, and `glassFallbackCss(selector)` restores them with
// `!important` (the only way a stylesheet can stand in for a dropped inline style)
// under `@supports not (color-mix)`. It also swaps in the solid fill where
// backdrop-filter is unsupported. Every glass surface must call it.

import type { CSSProperties } from 'react';

export const GLASS = {
  /** Top-lit ivory with the faintest forest wash toward the bottom edge. */
  fill:
    'linear-gradient(180deg, color-mix(in srgb, var(--gv-surface, #FAF8F3) 92%, transparent) 0%, ' +
    'color-mix(in srgb, color-mix(in srgb, var(--gv-surface, #FAF8F3) 94%, var(--gv-main, #1B3828)) 90%, transparent) 100%)',
  /** Solid equivalent for engines without backdrop-filter. */
  solid: 'color-mix(in srgb, var(--gv-surface, #FAF8F3) 96%, var(--gv-main, #1B3828))',
  blur: 'blur(28px) saturate(180%)',
  /** A light hairline reads as the lit glass edge; the outer forest ring separates it from ivory. */
  border: '1px solid rgba(255,255,255,0.62)',
  /** Layered: specular top edge, contact shadow, ambient lift, long soft drop. All forest-tinted. */
  shadow:
    'inset 0 1px 0 rgba(255,255,255,0.75), 0 0 0 0.5px rgba(27,56,40,0.14), ' +
    '0 1px 2px rgba(27,56,40,0.08), 0 8px 22px rgba(27,56,40,0.13), 0 26px 50px -14px rgba(27,56,40,0.22)',
  shadowHover:
    'inset 0 1px 0 rgba(255,255,255,0.8), 0 0 0 0.5px rgba(27,56,40,0.16), ' +
    '0 2px 4px rgba(27,56,40,0.09), 0 12px 28px rgba(27,56,40,0.16), 0 32px 60px -14px rgba(27,56,40,0.26)',
  ink: 'var(--gv-on-surface, #1C1410)',
  inkSoft: 'color-mix(in srgb, var(--gv-on-surface, #1C1410) 80%, var(--gv-surface, #FAF8F3))',
  /** Timestamps and small captions. >= 5.3:1 on the fill over ivory or forest; never body copy. */
  inkFaint: 'color-mix(in srgb, var(--gv-on-surface, #1C1410) 72%, var(--gv-surface, #FAF8F3))',
  /** Readable gold for text on the light glass. `--gv-accent-light` fails contrast as ink. */
  goldInk: 'color-mix(in srgb, var(--gv-accent, #B6871F) 55%, var(--gv-on-surface, #1C1410))',
  radius: 18,
} as const;

/**
 * The `GLASS` colours pre-mixed for the default theme, for engines without `color-mix()`.
 * Keep in step with `GLASS`: same percentages, computed from #FAF8F3 / #1B3828 / #1C1410 / #B6871F.
 */
export const GLASS_SAFE = {
  fill: 'linear-gradient(180deg, rgba(250,248,243,0.92) 0%, rgba(237,237,231,0.90) 100%)',
  solid: 'rgb(241,240,235)',
  inkSoft: 'rgb(72,66,61)',
  inkFaint: 'rgb(90,84,80)',
  goldInk: 'rgb(113,83,24)',
} as const;

/** Inline style for any element that should BE a pane of notification glass. Pair with `glassFallbackCss`. */
export const glassSurface: CSSProperties = {
  background: GLASS.fill,
  backdropFilter: GLASS.blur,
  WebkitBackdropFilter: GLASS.blur,
  border: GLASS.border,
  boxShadow: GLASS.shadow,
  borderRadius: GLASS.radius,
  color: GLASS.ink,
};

/**
 * Stylesheet backstop for a glass surface, keyed by class name. Two jobs:
 *  1. no `color-mix()`: the inline fill was dropped at parse time, so restore the
 *     pre-mixed `GLASS_SAFE` fill (`!important` is what lets it beat the inline slot);
 *  2. no backdrop-filter: swap the translucent fill for the solid one, plain value
 *     first so an engine missing both still gets a solid pane.
 * The second block comes last so it wins where both apply.
 */
export function glassFallbackCss(selector: string): string {
  return `@supports not (background: color-mix(in srgb, red 50%, transparent)) {
  ${selector} { background: ${GLASS_SAFE.fill} !important; }
}
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  ${selector} { background: ${GLASS_SAFE.solid} !important; background: ${GLASS.solid} !important; }
}`;
}

/**
 * A spring-like settle. `linear()` approximates a lightly damped spring (one small
 * overshoot); engines that do not parse it keep the cubic-bezier declared before it.
 */
export const SPRING_BEZIER = 'cubic-bezier(0.32, 1.28, 0.54, 1)';
export const SPRING_LINEAR =
  'linear(0, 0.009, 0.035 2.1%, 0.141 4.4%, 0.723 12.9%, 0.938 16.7%, 1.017 19.4%, 1.067, 1.089 24.3%, 1.093 26%, 1.08 28.7%, 1.018 36.1%, 0.996 41.3%, 0.991 46.7%, 1.001 63%, 1)';
