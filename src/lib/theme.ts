/**
 * theme.ts — conference colour themes: the arithmetic, none of the wiring.
 *
 * An organizer picks two colours, main and accent. Everything else —
 * background, surface, border, two mid-tones of the main colour, a muted
 * tone and both text colours — is Gavelling's own, fixed, and never derived
 * from the organizer's picks. Backgrounds used to be theirs too; that broke
 * on a dark background, because on-page text, the surface tint and the
 * neumorphic highlight all assume a light page underneath them, so the
 * organizer's canvas is no longer part of the input.
 *
 * Persisted as `conferences.theme` / `conferences.theme_draft` (jsonb,
 * default `{}`). An empty object, or an object missing `main` or `accent`,
 * means "use Gavelling's own colour for that key" — a partial theme is a
 * legal theme, not an error.
 *
 * WHY THE GAVELLING DEFAULTS BELOW ARE LITERAL, NOT DERIVED
 * It would be tempting to compute GAVELLING_THEME's surface/border/mid-tones
 * from its own background/main the same way `resolveTheme` derives them for
 * an organizer's theme. That would mean our own product's palette silently
 * shifts every time the derivation formula is retuned for someone else's
 * colours — a designer nudging `mix()`'s blend amount for readability on an
 * organizer's neon theme should never also repaint Gavelling's own surfaces.
 * The eleven Gavelling values are our real, chosen hex colours, hand-picked and
 * frozen; `resolveTheme` reuses the same MATH but never the same OUTPUT path
 * for us. `GAVELLING_THEME` is also the exact fast-path return for "no theme
 * set" (an empty or missing object), so it has to be correct standalone, not
 * as a side effect of a formula.
 *
 * Everything in this file is a pure function: no React, no imports from the
 * rest of the app, no side effects. Nothing here is wired into any component
 * yet — that is deliberately a later change.
 */

export interface ConferenceTheme {
  main?: string;
  accent?: string;
}

export interface ResolvedTheme {
  background: string;
  surface: string;
  border: string;
  main: string;
  mainMid: string;
  mainLight: string;
  accent: string;
  accentLight: string;
  textLight: string;
  textDark: string;
  muted: string;
}

/** Gavelling's own palette, hand-chosen and frozen — see the file header for
 *  why these are literal values rather than run through `resolveTheme`. */
export const GAVELLING_THEME: Readonly<ResolvedTheme> = Object.freeze({
  background: '#EDE7D8',
  surface: '#FAF8F3',
  border: '#DDD4C0',
  main: '#1B3828',
  mainMid: '#2A5A3C',
  mainLight: '#3D7A52',
  accent: '#B6871F',
  accentLight: '#EED98A',
  textLight: '#EED98A',
  textDark: '#1C1410',
  muted: '#9A8A78',
});

// ── Colour primitives ───────────────────────────────────────────────────────

/** Parses a 6-digit hex colour into 0-255 RGB channels. Tolerant of a missing
 *  leading `#` and of lowercase digits. */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.trim().replace(/^#/, '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return { r, g, b };
}

/** Inverse of `hexToRgb`: three 0-255 channels to a `#rrggbb` string. */
export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  const toHex = (n: number) => clamp(n).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** WCAG relative luminance of a hex colour, 0 (black) to 1 (white). */
export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const transfer = (channel: number) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const R = transfer(r);
  const G = transfer(g);
  const B = transfer(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

/** WCAG contrast ratio between two hex colours. Always >= 1: the lighter of
 *  the two luminances is always the numerator. */
export function contrastRatio(a: string, b: string): number {
  const lumA = relativeLuminance(a);
  const lumB = relativeLuminance(b);
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Linear RGB blend of two hex colours. `amount` is how much of `b` to mix
 *  in: 0 returns `a`, 1 returns `b`. */
export function mix(a: string, b: string, amount: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const t = Math.max(0, Math.min(1, amount));
  return rgbToHex(
    ca.r + (cb.r - ca.r) * t,
    ca.g + (cb.g - ca.g) * t,
    ca.b + (cb.b - ca.b) * t,
  );
}

/**
 * Picks whichever candidate text colour reads best on `surface`, by contrast
 * ratio alone. Never consults a "light" or "dark" label and never trusts the
 * order of `candidates` — an organizer's own Light/Dark labels on their two
 * text colours are advisory, not load bearing. If they set both to dark
 * colours, this still returns the better of the two rather than guaranteeing
 * unreadable text.
 */
export function pickTextColor(surface: string, candidates: string[]): string {
  let best = candidates[0];
  let bestRatio = -Infinity;
  for (const candidate of candidates) {
    const ratio = contrastRatio(surface, candidate);
    if (ratio > bestRatio) {
      bestRatio = ratio;
      best = candidate;
    }
  }
  return best;
}

// ── Resolution ───────────────────────────────────────────────────────────────

function isEmptyTheme(theme: ConferenceTheme | null | undefined): boolean {
  return !theme || Object.keys(theme).length === 0;
}

/**
 * Fills in an organizer's missing `main` / `accent` with the Gavelling
 * defaults, derives the two lighter steps of `main`, and returns Gavelling's
 * own values for every other colour — the organizer's canvas is not theirs
 * to set.
 *
 * The empty/missing case is an exact fast path: it returns `GAVELLING_THEME`
 * itself rather than running an equivalent object through the derivation
 * below, so "no theme set" can never drift from Gavelling's real palette by
 * so much as a rounding error.
 */
export function resolveTheme(theme: ConferenceTheme | null | undefined): ResolvedTheme {
  if (isEmptyTheme(theme)) return GAVELLING_THEME;

  const main = theme!.main ?? GAVELLING_THEME.main;
  const accent = theme!.accent ?? GAVELLING_THEME.accent;

  // Two lighter steps of the main colour, for hover states and secondary fills.
  const mainMid = mix(main, '#FFFFFF', 0.18);
  const mainLight = mix(main, '#FFFFFF', 0.34);
  // Light stop of the accent gradient/disc pairing, derived the same way.
  const accentLight = mix(accent, '#FFFFFF', 0.55);

  return {
    background: GAVELLING_THEME.background,
    surface: GAVELLING_THEME.surface,
    border: GAVELLING_THEME.border,
    main,
    mainMid,
    mainLight,
    accent,
    accentLight,
    textLight: GAVELLING_THEME.textLight,
    textDark: GAVELLING_THEME.textDark,
    muted: GAVELLING_THEME.muted,
  };
}

// ── CSS custom properties ────────────────────────────────────────────────────

/**
 * Resolves a theme and returns it as `--gv-*` custom properties, namespaced
 * to avoid colliding with the shadcn/Tailwind variables already defined in
 * globals.css. Includes four convenience "on-X" variables (computed with
 * `pickTextColor`) so components reading this theme never do contrast maths
 * inline — they just pick the on-X variable for whatever surface they sit on.
 *
 * Cast to `React.CSSProperties` because custom properties are not part of
 * that type; callers spread the result onto a wrapper element's `style`.
 */
export function themeCssVars(theme: ConferenceTheme | null | undefined): React.CSSProperties {
  const t = resolveTheme(theme);
  return {
    '--gv-bg': t.background,
    '--gv-surface': t.surface,
    '--gv-border': t.border,
    '--gv-main': t.main,
    '--gv-main-mid': t.mainMid,
    '--gv-main-light': t.mainLight,
    '--gv-accent': t.accent,
    '--gv-accent-light': t.accentLight,
    '--gv-text-light': t.textLight,
    '--gv-text-dark': t.textDark,
    '--gv-muted': t.muted,
    '--gv-on-bg': pickTextColor(t.background, [t.textLight, t.textDark]),
    '--gv-on-surface': pickTextColor(t.surface, [t.textLight, t.textDark]),
    '--gv-on-main': pickTextColor(t.main, [t.textLight, t.textDark]),
    '--gv-on-accent': pickTextColor(t.accent, [t.textLight, t.textDark]),
  } as React.CSSProperties;
}

// ── Warnings ─────────────────────────────────────────────────────────────────

/**
 * Plain-English warnings for a live picker to show while an organizer is
 * building a theme. Checks exactly three things, nothing more: both text
 * colours failing against main, the main colour washing out against the
 * (fixed, Gavelling) page, and the accent doing the same.
 */
export function themeWarnings(theme: ConferenceTheme | null | undefined): string[] {
  const t = resolveTheme(theme);
  const warnings: string[] = [];

  const lightOnMain = contrastRatio(t.textLight, t.main);
  const darkOnMain = contrastRatio(t.textDark, t.main);
  if (lightOnMain < 4.5 && darkOnMain < 4.5) {
    warnings.push('Text on your main colour will be hard to read.');
  }

  if (contrastRatio(t.main, t.background) < 1.6) {
    warnings.push('Your main colour barely shows against the page.');
  }

  if (contrastRatio(t.accent, t.background) < 1.6) {
    warnings.push('Your accent colour barely shows against the page.');
  }

  return warnings;
}
