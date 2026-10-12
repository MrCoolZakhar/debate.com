'use client';

/**
 * Settings → General, the compact layout (11 Oct 2026; owner: "compact it
 * more. There could be a more compact thing, like a big card with information
 * like the logo, banner as well as stuff like dates and stuff").
 *
 * The first card is the conference's identity: the banner across the top, the
 * logo as a big round disc hanging over the banner's lower edge, the name and
 * acronym beside it, and the facts (dates, place, format, level, size, ages)
 * in a dense grid with each label ABOVE its field. The other groups follow as
 * compact cards.
 *
 * Presentation only. Every value, handler, autosave and write is the settings
 * page's own, passed in unchanged.
 */

import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { Camera, ImagePlus } from 'lucide-react';
import { LogoDisc } from '@/components/LogoDisc';
import { Emoji3D } from '@/components/neu';
import { F, INK, INK_SOFT, FOREST } from './panelKit';

export const GENERAL_CSS = `
.gvg-id { padding: 0 !important; container-type: inline-size; scroll-margin-top: 140px; }
.gvg-banner { position: relative; height: clamp(104px, 11.5cqw, 140px); border-radius: 20px 20px 0 0; overflow: hidden;
  background: radial-gradient(120% 140% at 85% 0%, rgba(238,217,138,0.55) 0%, rgba(238,217,138,0) 60%), linear-gradient(135deg, #E9E2CF 0%, #F6F1E4 100%); }
.gvg-banner img.gvg-banner-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.gvg-banner::after { content: ""; position: absolute; inset: 0; pointer-events: none;
  background: linear-gradient(180deg, rgba(10,22,15,0.18) 0%, rgba(10,22,15,0) 38%, rgba(10,22,15,0) 62%, rgba(10,22,15,0.22) 100%); }
.gvg-glass { display: inline-flex; align-items: center; gap: 6px; border: none; cursor: pointer; font-family: ${F};
  font-size: 13px; font-weight: 700; color: ${INK}; background: rgba(255,255,255,0.86); border-radius: 999px;
  -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px);
  box-shadow: 0 1px 0 rgba(255,255,255,0.8) inset, 0 6px 16px -8px rgba(10,22,15,0.55); transition: background-color 140ms ease, transform 120ms ease; }
.gvg-glass:hover { background: #FFFFFF; }
.gvg-glass:active { transform: scale(0.97); }
.gvg-glass:focus { outline: none; }
.gvg-glass:focus-visible { outline: 2px solid ${FOREST}; outline-offset: 2px; }
.gvg-glass:disabled { opacity: 0.7; cursor: wait; }
.gvg-banner-change { position: absolute; top: 12px; right: 12px; z-index: 1; min-height: 34px; padding: 0 12px; }
.gvg-presets { position: absolute; right: 12px; bottom: 12px; z-index: 1; padding: 4px 4px 4px 10px; gap: 4px; cursor: default; }
.gvg-presets-word { font-size: 12px; font-weight: 700; color: ${INK_SOFT}; margin-right: 2px; white-space: nowrap; }
.gvg-preset { width: 38px; height: 26px; padding: 0; border: none; border-radius: 999px; overflow: hidden; cursor: pointer; background: #EDE7D8;
  box-shadow: 0 0 0 1px rgba(27,56,40,0.14); transition: transform 140ms ease, box-shadow 140ms ease; }
.gvg-preset:hover { transform: translateY(-1px); }
.gvg-preset[aria-pressed="true"] { box-shadow: 0 0 0 2px #B6871F, 0 0 0 4px rgba(238,217,138,0.6); }
.gvg-preset:focus { outline: none; }
.gvg-preset:focus-visible { box-shadow: 0 0 0 2px #FFFFFF, 0 0 0 4px ${FOREST}; }
.gvg-preset img { width: 100%; height: 100%; object-fit: cover; display: block; }
.gvg-body { position: relative; padding: 0 clamp(16px, 2.6cqw, 24px) clamp(18px, 2.6cqw, 24px); border-radius: 0 0 20px 20px;
  background: radial-gradient(90% 70% at 100% 100%, rgba(238,217,138,0.20) 0%, rgba(238,217,138,0) 60%), radial-gradient(70% 60% at 0% 100%, rgba(61,122,82,0.06) 0%, rgba(61,122,82,0) 60%); }
.gvg-top { display: grid; grid-template-columns: auto minmax(0, 1fr); column-gap: 16px; align-items: start; }
.gvg-logo { position: relative; margin-top: -52px; width: 104px; height: 104px; z-index: 2; }
.gvg-logo-change { position: absolute; left: 50%; bottom: -8px; transform: translateX(-50%); min-height: 28px; padding: 0 10px; font-size: 12px;
  background: #FFFFFF; box-shadow: 0 0 0 1px rgba(27,56,40,0.10), 0 6px 14px -6px rgba(27,56,40,0.45); white-space: nowrap; }
.gvg-logo-change:active { transform: translateX(-50%) scale(0.97); }
.gvg-head { min-width: 0; padding-top: 14px; display: flex; flex-direction: column; gap: 4px; }
.gvg-head-line { display: flex; align-items: center; justify-content: space-between; gap: 10px; min-height: 24px; }
.gvg-name { display: block; width: 100%; min-width: 0; resize: none; overflow: hidden; field-sizing: content; font-family: ${F}; font-size: clamp(19px, 2.6cqw, 24px); font-weight: 800; letter-spacing: -0.015em;
  color: ${INK}; line-height: 1.2; padding: 4px 8px; margin-left: -8px; border-radius: 10px; border: 1.5px solid transparent;
  background: transparent; outline: none; transition: border-color 140ms ease, background-color 140ms ease; }
.gvg-name::placeholder { color: #9A8A78; font-weight: 700; }
.gvg-name:hover { border-color: #DDD4C0; background: #FFFFFF; }
.gvg-name:focus { border-color: ${FOREST}; background: #FFFFFF; }
/* Acronym: its label above its field, like every other field, and the
   "Shown as" line beside the field, centred on it. */
.gvg-acro { display: grid; grid-template-columns: minmax(0, 1fr); gap: 6px 14px; margin-top: 8px; align-items: end; }
.gvg-acro-note { display: flex; align-items: center; margin: 0 !important; }
@container (min-width: 440px) {
  .gvg-acro { grid-template-columns: minmax(150px, 220px) minmax(0, 1fr); }
  .gvg-acro-note { min-height: 46px; }
}
.gvg-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 18px 16px; margin-top: 22px; padding-top: 20px;
  border-top: 1px solid rgba(27,56,40,0.07); align-items: start; }
.gvg-field { min-width: 0; border-radius: 14px; transition: box-shadow 400ms ease; }
.gvg-field[data-ring="true"] { box-shadow: 0 0 0 6px rgba(238,217,138,0.55), 0 0 0 7px rgba(182,135,31,0.35); }
.gvg-label { display: flex; align-items: center; gap: 7px; margin-bottom: 6px; font-family: ${F}; font-size: 13.5px; font-weight: 700; color: #3A2E24; line-height: 1.25; }
.gvg-label img { flex-shrink: 0; }
/* Every field's label line is the same height (the Dates switch included), so
   the fields in one grid row start on one line. */
.gvg-labelrow { display: flex; align-items: center; justify-content: space-between; gap: 10px; min-height: 30px; margin-bottom: 6px; }
.gvg-note { margin-top: 6px; font-family: ${F}; font-size: 12.5px; color: ${INK_SOFT}; line-height: 1.4; overflow-wrap: anywhere; }
/* One control look for the whole card: 46px tall, ivory fill, the same edge
   and radius as the date picker beside it. */
.gvg-input { display: block; width: 100%; min-width: 0; height: 46px; padding: 0 14px; border-radius: 12px; border: 1.5px solid #D9CFBA;
  background: #FAF8F3; font-family: ${F}; font-size: 16px; color: ${INK}; outline: none; -webkit-appearance: none; appearance: none;
  transition: border-color 140ms ease, background-color 140ms ease, box-shadow 160ms ease; }
.gvg-input::placeholder { color: #8C7E68; }
.gvg-input:hover { border-color: #C4B697; }
.gvg-input:focus, .gvg-input:focus-visible, .gvg-input[data-open="true"] { border-color: ${FOREST}; background: #FFFFFF; box-shadow: 0 0 0 3px rgba(27,56,40,0.10); }
.gvg-input[type="number"] { font-variant-numeric: tabular-nums; -moz-appearance: textfield; }
.gvg-input[type="number"]::-webkit-outer-spin-button, .gvg-input[type="number"]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
.gvg-input.gvg-area { height: auto; min-height: 96px; padding: 12px 14px; line-height: 1.55; resize: vertical; }
.gvg-country { display: flex; align-items: center; gap: 10px; cursor: pointer; text-align: left; padding: 0 12px 0 11px; }
.gvg-country-name { flex: 1; min-width: 0; line-height: 1.2; overflow-wrap: anywhere; }
.gvg-country-name[data-empty="true"] { color: #8C7E68; }
.gvg-country-empty { width: 24px; height: 24px; border-radius: 999px; flex-shrink: 0; border: 1.5px dashed #C4B697; }
/* The shared DatePicker's trigger, drawn as a .gvg-input. */
.gvg-date > div > button { height: 46px !important; padding: 0 14px !important; border-radius: 12px !important; font-size: 16px !important;
  border: 1.5px solid #D9CFBA !important; background: #FAF8F3 !important; }
.gvg-date > div > button:hover { border-color: #C4B697 !important; }
.gvg-date > div > button:focus-visible { border-color: ${FOREST} !important; box-shadow: 0 0 0 3px rgba(27,56,40,0.10) !important; }
.gvg-dates { display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px; }
@container (min-width: 420px) { .gvg-dates { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); } }
.gvg-ages { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: center; gap: 8px; }
.gvg-ages-to { font-family: ${F}; font-size: 14px; font-weight: 600; color: ${INK_SOFT}; }
.gvg-seg { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.gvg-seg button[aria-checked="false"] { background: #FAF8F3; border-color: #D9CFBA; }
.gvg-seg button[aria-checked="false"]:hover { border-color: #C4B697; background: #FFFFFF; }
.gvg-seg button:focus { outline: none; }
.gvg-seg button:focus-visible { outline: 2px solid ${FOREST}; outline-offset: 2px; }
.gvg-seg button { min-height: 46px !important; height: 46px; font-size: 14px !important; padding: 0 6px; border-radius: 12px !important; line-height: 1.15; }
@container (max-width: 520px) {
  .gvg-presets-word { display: none; }
  .gvg-logo { width: 88px; height: 88px; margin-top: -44px; }
  .gvg-top { grid-template-columns: minmax(0, 1fr); }
  .gvg-head { padding-top: 18px; }
}
@container (min-width: 520px) {
  .gvg-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .gvg-span-4, .gvg-span-6 { grid-column: span 2; }
}
@container (min-width: 680px) {
  .gvg-grid { grid-template-columns: repeat(6, minmax(0, 1fr)); }
  .gvg-span-2 { grid-column: span 2; }
  .gvg-span-3 { grid-column: span 3; }
  .gvg-span-4 { grid-column: span 4; }
  .gvg-span-6 { grid-column: span 6; }
}
.gvg-fields { display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px 14px; }
@container (min-width: 520px) { .gvg-fields { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@container (min-width: 760px) { .gvg-fields { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@media (prefers-reduced-motion: reduce) {
  .gvg-glass, .gvg-preset, .gvg-name, .gvg-field, .gvg-input { transition: none; }
}
`;

/** The banner across the top of the identity card, with Change and the preset photos. */
export function IdentityBanner({ src, uploading, onChange, presets, onPick }: {
  src: string | null | undefined;
  uploading: boolean;
  onChange: () => void;
  presets: readonly string[];
  onPick: (path: string) => void;
}) {
  return (
    <div className="gvg-banner">
      {src && <img src={src} alt="Your banner" className="gvg-banner-img" />}
      <button type="button" className="gvg-glass gvg-banner-change" onClick={onChange} disabled={uploading}>
        {uploading
          ? <span className="w-3.5 h-3.5 rounded-full border-2 animate-spin" style={{ borderColor: FOREST, borderTopColor: 'transparent' }} aria-hidden />
          : <ImagePlus size={15} strokeWidth={2.4} aria-hidden style={{ color: FOREST }} />}
        {uploading ? 'Uploading' : src ? 'Change banner' : 'Add a banner'}
      </button>
      <div className="gvg-glass gvg-presets" role="group" aria-label="Pick a banner photo">
        <span className="gvg-presets-word">Or pick one</span>
        {presets.map((pth, i) => (
          <button
            key={pth}
            type="button"
            className="gvg-preset"
            aria-label={`Use banner photo ${i + 1}`}
            aria-pressed={src === pth}
            disabled={uploading}
            onClick={() => onPick(pth)}
          >
            <img src={pth} alt="" />
          </button>
        ))}
      </div>
    </div>
  );
}

/** The logo as a big round disc hanging over the banner's lower edge. */
export function IdentityLogo({ src, alt, fallbackText, uploading, onChange }: {
  src: string | null | undefined;
  alt: string;
  fallbackText: string;
  uploading: boolean;
  onChange: () => void;
}) {
  return (
    <div className="gvg-logo">
      <LogoDisc
        src={src}
        alt={alt}
        size={104}
        fallbackText={fallbackText}
        style={{ width: '100%', height: '100%', boxShadow: '0 0 0 5px #FFFFFF, 0 14px 30px -10px rgba(27,56,40,0.45)' }}
      />
      <button type="button" className="gvg-glass gvg-logo-change" onClick={onChange} disabled={uploading} aria-label={src ? 'Change logo' : 'Upload a logo'}>
        {uploading
          ? <span className="w-3 h-3 rounded-full border-2 animate-spin" style={{ borderColor: FOREST, borderTopColor: 'transparent' }} aria-hidden />
          : <Camera size={13} strokeWidth={2.4} aria-hidden style={{ color: FOREST }} />}
        {uploading ? 'Uploading' : src ? 'Change' : 'Upload'}
      </button>
    </div>
  );
}

/** A field with its label above. `span` is out of 6 columns on a wide card
 *  (2 of 2 at medium widths for 4 and 6, one column on phones). */
export function IdField({ label, emoji, htmlFor, hint, aside, note, span = 2, id, ring, children, style }: {
  label: ReactNode;
  /** A Fluent 3D emoji drawn small before the label (dates, place, size). */
  emoji?: string;
  htmlFor?: string;
  hint?: ReactNode;
  /** A small control at the end of the label line (the Dates TBD switch). */
  aside?: ReactNode;
  note?: ReactNode;
  span?: 2 | 3 | 4 | 6;
  id?: string;
  ring?: boolean;
  children: ReactNode;
  style?: CSSProperties;
}) {
  const Label = htmlFor ? 'label' : 'p';
  return (
    <div id={id} className={`gvg-field gvg-span-${span}`} data-ring={ring ? 'true' : undefined} style={{ scrollMarginTop: 140, ...style }}>
      <div className="gvg-labelrow">
        <Label htmlFor={htmlFor} className="gvg-label" style={{ marginBottom: 0 }}>
          {emoji && <Emoji3D name={emoji} size={20} />}
          <span style={{ overflowWrap: 'anywhere' }}>{label}</span>
          {hint}
        </Label>
        {aside && <div style={{ flexShrink: 0 }}>{aside}</div>}
      </div>
      {children}
      {note && <div className="gvg-note">{note}</div>}
    </div>
  );
}

/** A plain field with its label above, for the compact grids (`.gvg-fields`). */
export function PlainField({ label, htmlFor, note, children, wide = false }: {
  label: ReactNode; htmlFor?: string; note?: ReactNode; children: ReactNode; wide?: boolean;
}) {
  const Label = htmlFor ? 'label' : 'p';
  return (
    <div className="min-w-0" style={wide ? { gridColumn: '1 / -1' } : undefined}>
      <Label htmlFor={htmlFor} className="gvg-label"><span style={{ overflowWrap: 'anywhere' }}>{label}</span></Label>
      {children}
      {note && <div className="gvg-note">{note}</div>}
    </div>
  );
}


/**
 * The conference's full name, edited in place: large type that reads as the
 * title until it is hovered or focused. A one-row textarea that grows, so a
 * long name wraps onto a second line instead of being cut off (never an
 * ellipsis on a name). Enter does not add a line break, and a pasted line
 * break becomes a space, exactly what a single-line input would keep.
 */
export function NameField({ id, value, onChange, placeholder, onFocus, onBlur }: {
  id: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  onFocus?: () => void;
  onBlur?: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`; };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [value]);
  return (
    <textarea
      ref={ref}
      id={id}
      rows={1}
      className="gvg-name"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value.replace(/[\r\n]+/g, ' '))}
      onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
      onFocus={onFocus}
      onBlur={onBlur}
    />
  );
}
