'use client';

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN, the fifth section of the palette rail.
//
// The conference's email theme (header shape, accent, button colour, logo,
// footer line) used to live at the BOTTOM OF THE COMMUNICATIONS PAGE, behind a
// collapsed disclosure, several screens away from the email it governs. So the
// one place you could see the effect of a colour and the one place you could
// change it were never on screen together.
//
// Here it is a rail section like any other, and the canvas one column to the
// right IS the live preview, the sheet already draws the spine, the banner,
// the identity row, the gold pill and the footer band from exactly these
// values. Change the accent and the spine changes while you watch. That is
// why this panel ships no preview iframe of its own: it would be a smaller,
// staler copy of the thing already next to it.
//
// STATE LIVES ON THE PAGE, NOT HERE. The page owns `themeDraft`, its single
// `patchTheme` mutator and the debounced autosave into `conferences.email_theme`
// (with its two independent guards against a seed-triggered write). This is a
// controlled view of that state and nothing more: it never writes, never
// debounces, and never holds a second copy that could drift.
// ─────────────────────────────────────────────────────────────────────────────

import { Check, Image as ImageIcon, Palette } from 'lucide-react';
import { NEU, OUTFIT, EASE } from '@/components/neu';
import { SOFT, GREEN_INK, RED, CARD_BORDER } from '@/app/manage/[slug]/live/tokens';
import type { EmailTheme } from '@/lib/emailHtml';

const FOREST = '#1B3828';
const INK = '#1C1410';

/** The same two lists the communications page offered. They move here with
 *  the controls; the page's copies go dead when its Design section does. */
const ACCENT_PALETTE = ['#1B3828', '#8A6614', '#8B2020', '#2A4B7C', '#5C3A72', '#1C1410'];
const BUTTON_PALETTE = ['#EED98A', '#F3E3A1', '#B6871F', '#9AC6A8', '#DCEAF5', '#F5D6C6'];

export interface DesignControls {
  theme: Required<EmailTheme>;
  onPatch: (patch: Partial<EmailTheme>) => void;
  saving: boolean;
  saved: boolean;
  error: string | null;
  /** False when the conference has no banner image, so "Banner" would be a
   *  choice with nothing behind it. The renderer falls back to the solid bar
   *  in that case anyway, so the panel says so rather than letting the
   *  control look broken. */
  hasBanner: boolean;
}

function SwatchRow({
  label, value, palette, onChange,
}: {
  label: string; value: string; palette: string[]; onChange: (hex: string) => void;
}) {
  return (
    <div className="mb-3.5">
      <p className="mb-1.5" style={{ fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 800, letterSpacing: '0.08em', color: SOFT }}>
        {label}
      </p>
      {/* A 3×2 GRID, not a wrapping row. Six 30px swatches with gaps need
          210px and the rail gives 180, so a flex row broke 5 + 1, a lone
          orphan swatch on a second line, which reads as a mistake. Three
          columns fit exactly, each cell is a 40px-tall target (the dense
          desktop floor) with a 22px jewel centred in it, and the two rows
          look like a palette rather than an accident. */}
      <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        {palette.map(c => {
          const active = value.toLowerCase() === c.toLowerCase();
          return (
            <button
              key={c}
              type="button"
              title={c}
              aria-label={`${label.toLowerCase()} ${c}`}
              aria-pressed={active}
              onClick={() => onChange(c)}
              className="inline-flex items-center justify-center focus:outline-none"
              style={{
                width: '100%', minHeight: 40, borderRadius: 13, padding: 0, border: 'none',
                background: active ? 'rgba(27,56,40,0.06)' : 'transparent', cursor: 'pointer',
                transitionProperty: 'background-color',
                transitionDuration: '180ms',
                transitionTimingFunction: EASE,
              }}
            >
              <span
                className="inline-flex items-center justify-center"
                style={{
                  width: 22, height: 22, borderRadius: 999, backgroundColor: c,
                  boxShadow: active
                    ? `0 0 0 2px ${NEU.surface}, 0 0 0 3.5px ${FOREST}`
                    : 'inset 0 0 0 1px rgba(0,0,0,0.16)',
                  transitionProperty: 'box-shadow, transform',
                  transitionDuration: '200ms',
                  transitionTimingFunction: EASE,
                  transform: active ? 'scale(1)' : 'scale(0.94)',
                }}
              >
                {active && <Check size={11} strokeWidth={3.4} style={{ color: '#FFFFFF', mixBlendMode: 'difference' }} />}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function DesignPanel({ design }: { design: DesignControls }) {
  const { theme, onPatch } = design;
  return (
    <div>
      <p className="mb-1.5" style={{ fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 800, letterSpacing: '0.08em', color: SOFT }}>
        TOP OF THE EMAIL
      </p>
      <div
        className="flex items-center gap-0.5 mb-3.5"
        style={{ padding: 3, borderRadius: 999, backgroundColor: 'rgba(27,56,40,0.055)', boxShadow: NEU.inSm }}
      >
        {([
          ['banner', 'Banner', ImageIcon],
          ['solid', 'Colour bar', Palette],
        ] as const).map(([v, label, Icon]) => {
          const active = theme.headerStyle === v;
          const dead = v === 'banner' && !design.hasBanner;
          return (
            <button
              key={v}
              type="button"
              title={dead ? 'No banner uploaded yet, so this falls back to the colour bar.' : label}
              aria-pressed={active}
              onClick={() => onPatch({ headerStyle: v })}
              className="flex-1 inline-flex items-center justify-center gap-1.5 focus:outline-none"
              style={{
                minHeight: 34, padding: '5px 10px', borderRadius: 999, border: 'none',
                background: active ? `linear-gradient(135deg, ${FOREST}, #2E6041)` : 'transparent',
                color: active ? '#EED98A' : SOFT,
                fontFamily: OUTFIT, fontSize: 11, fontWeight: 800, letterSpacing: '0.04em',
                cursor: 'pointer',
                opacity: dead ? 0.6 : 1,
                boxShadow: active ? '0 3px 8px rgba(27,56,40,0.28)' : 'none',
                transitionProperty: 'background, color, box-shadow',
                transitionDuration: '200ms',
                transitionTimingFunction: EASE,
              }}
            >
              <Icon size={12} strokeWidth={2.4} />
              {label}
            </button>
          );
        })}
      </div>

      <SwatchRow label="ACCENT" value={theme.accentColor} palette={ACCENT_PALETTE} onChange={c => onPatch({ accentColor: c })} />
      <SwatchRow label="BUTTONS" value={theme.buttonColor} palette={BUTTON_PALETTE} onChange={c => onPatch({ buttonColor: c })} />

      <button
        type="button"
        role="switch"
        aria-checked={theme.showLogo}
        onClick={() => onPatch({ showLogo: !theme.showLogo })}
        className="w-full flex items-center justify-between gap-2 focus:outline-none mb-3.5"
        style={{
          minHeight: 40, padding: '8px 11px', borderRadius: 13,
          border: CARD_BORDER, backgroundColor: '#FFFDF8',
          cursor: 'pointer', textAlign: 'left',
        }}
      >
        <span style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 700, color: INK }}>Show the logo</span>
        <span
          className="inline-flex items-center flex-shrink-0"
          style={{
            width: 38, height: 22, borderRadius: 999, padding: 3,
            backgroundColor: theme.showLogo ? FOREST : 'rgba(27,56,40,0.16)',
            justifyContent: theme.showLogo ? 'flex-end' : 'flex-start',
            transitionProperty: 'background-color',
            transitionDuration: '200ms',
            transitionTimingFunction: EASE,
          }}
        >
          <span style={{ width: 16, height: 16, borderRadius: 999, backgroundColor: '#FFFDF8', boxShadow: '0 1px 3px rgba(27,56,40,0.3)' }} />
        </span>
      </button>

      <p className="mb-1.5" style={{ fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 800, letterSpacing: '0.08em', color: SOFT }}>
        A LINE IN THE FOOTER
      </p>
      <input
        value={theme.footerLine}
        onChange={e => onPatch({ footerLine: e.target.value })}
        placeholder="Optional, e.g. an office address"
        className="w-full focus:outline-none"
        style={{
          minHeight: 40, borderRadius: 12, padding: '10px 12px',
          fontFamily: OUTFIT, fontSize: 12.5, color: INK,
          backgroundColor: '#FFFDF8', border: '1px solid rgba(27,56,40,0.13)', boxShadow: NEU.inSm,
        }}
      />

      <p
        className="mt-2"
        style={{
          fontFamily: OUTFIT, fontSize: 11, fontWeight: 700, minHeight: 16,
          color: design.error ? RED : GREEN_INK, textWrap: 'pretty',
        }}
      >
        {design.error || (design.saving ? 'Saving…' : design.saved ? 'Saved ✓' : '')}
      </p>
      <p className="mt-1" style={{ fontFamily: OUTFIT, fontSize: 11, color: SOFT, lineHeight: 1.5, textWrap: 'pretty' }}>
        Every email this conference sends inherits these. Watch the sheet beside you change as you pick.
      </p>
    </div>
  );
}
