'use client';

// ─────────────────────────────────────────────────────────────────────────────
// committeeSetupKit — the visual kit for CONFERENCE committee set-up, written to
// match the sessions /create build screen (23 Sep 2026, owner: "copy how
// committee set-up is done in Gavelling Sessions now, since that has been
// updated. Some features are special to the conference committee set-up, so
// adapt those").
//
// WHAT IT COPIES from src/app/create/createUi.tsx:
//   • the live identity at the top — the emblem in a WHITE DISC, the acronym
//     big with the full name small beneath, the topic on its own line. The
//     organiser sees the committee exactly as the chair masthead will state it,
//     before anything is saved;
//   • numbered step headings (forest disc, gold numeral) instead of a wall of
//     equal-weight labels;
//   • one input look: 42/48px, rounded 14, white/80 with an inset forest ring;
//   • small uppercase field labels;
//   • the forest-gradient primary action with a sub line that says what is
//     MISSING, never a count;
//   • no count or status pills (CLAUDE.md §8): counts are plain typography and
//     a status is an icon beside a plain word.
//
// WHAT IS ADAPTED, because the conference editor carries more than /create:
//   • the fallback emblem is MonogramMedallion, so a crisis committee keeps its
//     red seal and a custom (parliamentary) one its amber seal;
//   • an acronym chip on the name field (`AcronymField`), because a conference
//     committee has a real `abbreviation` column and /create has nowhere to put
//     one;
//   • a six-swatch emblem picker (`EmblemPicker`), because a conference
//     committee has a `logo_url` column and /create has no emblem to store.
//
// Presentational only: no data, no routing, no writes. Palette and shadows come
// from joinUi so /join, /create and the organiser editor stay one family.
// ─────────────────────────────────────────────────────────────────────────────

import { useId, useRef, type ReactNode } from 'react';
import { ImagePlus, RotateCcw, Loader2, Lock, X } from 'lucide-react';
import { C, OUTFIT, SHADOW } from '@/app/join/joinUi';
import { EMBLEM_PICKS } from '@/lib/presetNames';
import { MonogramMedallion, type MedallionTone } from '@/components/MonogramMedallion';

export { C, OUTFIT, SHADOW };

/** One input look for every field in the editor. 16px on phones so iOS never zooms. */
export const SETUP_INPUT_CLS =
  'w-full rounded-[14px] bg-white/80 px-3.5 py-2.5 text-base sm:text-[15px] text-[#1C1410] placeholder-[#8A7C6B] ' +
  'shadow-[inset_0_0_0_1px_rgba(27,56,40,0.16)] focus:outline-none ' +
  'focus:shadow-[inset_0_0_0_2px_#1B3828,0_0_0_4px_rgba(27,56,40,0.08)] transition-[box-shadow] duration-150 ' +
  'disabled:opacity-55';

/** Small uppercase label above a field. */
export function SetupLabel({ children, htmlFor, aside }: { children: ReactNode; htmlFor?: string; aside?: ReactNode }) {
  const style = { fontFamily: OUTFIT, fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', color: C.inkSoft } as const;
  return (
    <div className="mb-1.5 flex items-baseline gap-2">
      {htmlFor
        ? <label htmlFor={htmlFor} className="block uppercase" style={style}>{children}</label>
        : <span className="block uppercase" style={style}>{children}</span>}
      {aside && <span className="min-w-0 flex-1 truncate" style={{ fontFamily: OUTFIT, fontSize: 11, fontWeight: 600, color: C.muted }}>{aside}</span>}
    </div>
  );
}

/** The numbered step heading: a forest disc with the gold numeral, then the title. */
export function SetupStep({ step, title, id, aside }: { step: number; title: string; id: string; aside?: ReactNode }) {
  return (
    <header className="mb-2.5 flex min-h-[30px] flex-wrap items-center gap-x-3 gap-y-1.5">
      <span
        aria-hidden
        className="flex flex-shrink-0 items-center justify-center tabular-nums"
        style={{
          width: 26, height: 26, borderRadius: 999, backgroundColor: C.forest, color: C.gold,
          fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 800, boxShadow: '0 2px 6px rgba(27,56,40,0.18)',
        }}
      >
        {step}
      </span>
      <h3 id={id} className="me-auto" style={{ fontFamily: OUTFIT, fontSize: 17, fontWeight: 800, letterSpacing: '-0.01em', color: C.forest, lineHeight: 1.2, margin: 0 }}>
        {title}
      </h3>
      {aside && <div className="flex flex-wrap items-center gap-2">{aside}</div>}
    </header>
  );
}

// ── The live committee identity ──────────────────────────────────────────────
// The /create preview, with the conference editor's type-toned monogram as the
// fallback so nothing about crisis / custom committees is lost.
export function CommitteeIdentityPreview({ src, primary, secondary, placeholder, topic, topicLabel, topicEmpty, tone, monogramText }: {
  src: string | null;
  primary: string;
  secondary: string | null;
  placeholder: string;
  topic: string;
  topicLabel: string;
  topicEmpty: string;
  tone: MedallionTone;
  /** Initials for the fallback seal when there is no emblem. */
  monogramText: string;
}) {
  const hasName = !!primary;
  const shown = primary || placeholder;
  return (
    <div aria-hidden className="flex flex-shrink-0 items-center gap-4">
      {src ? (
        <span
          key={src}
          className="relative flex flex-shrink-0 items-center justify-center rounded-full bg-white"
          style={{
            width: 84, height: 84,
            boxShadow: '0 1px 2px rgba(27,56,40,0.10), 0 8px 22px rgba(27,56,40,0.14), inset 0 0 0 1px rgba(0,0,0,0.06)',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" draggable={false} decoding="async" className="block h-full w-full object-contain" style={{ padding: '15%' }} />
        </span>
      ) : (
        /* No name yet → MonogramMedallion's own em-dash, never initials of the
           placeholder ("Untitled committee" used to read UNTITL). */
        <MonogramMedallion text={monogramText} tone={tone} size={84} />
      )}

      <div className="min-w-0 flex-1">
        <p
          className="truncate"
          title={shown}
          style={{
            fontFamily: OUTFIT, fontWeight: 800, letterSpacing: '-0.015em', lineHeight: 1.12,
            fontSize: shown.length > 22 ? 21 : 27,
            color: hasName ? C.forest : C.muted,
          }}
        >
          {shown}
        </p>
        {secondary && (
          <p className="mt-0.5 truncate" style={{ fontFamily: OUTFIT, fontSize: 13.5, fontWeight: 500, lineHeight: 1.35, color: C.inkSoft }}>
            {secondary}
          </p>
        )}
        <p className="mt-1 line-clamp-2" style={{ fontFamily: OUTFIT, fontSize: 13.5, lineHeight: 1.4, color: topic ? C.ink : C.muted, textWrap: 'pretty' }}>
          <span style={{ fontWeight: 800, color: C.goldDeep }}>{topicLabel}</span>{' '}
          <span style={{ fontWeight: 500 }}>{topic || topicEmpty}</span>
        </p>
      </div>
    </div>
  );
}

// ── The acronym chip ─────────────────────────────────────────────────────────
// (23 Sep 2026, an organiser: "some standard committees automatically get an
// abbreviation while others don't. Could you let organisers set an abbreviation
// for custom committees?")
//
// NOT a separate form row (owner: avoid one if it can be avoided). It is a
// second line ON the name field: the acronym the app would derive, shown as a
// greyed suggestion, which the organiser can simply type over.
//
// CONTRACT, and the reason there is no new column:
//   • `value` is `conference_committees.abbreviation`, the EXISTING column;
//   • empty means "no explicit abbreviation" and is saved as NULL, which is
//     exactly what makes `deriveCommitteeAcronym` fall back to its automatic
//     answer on every surface. So clearing the chip restores the suggestion
//     with no extra state and nothing stored;
//   • `suggestion` is that automatic answer (`deriveCommitteeAcronym(name)`),
//     drawn as the placeholder. It is a suggestion, never a silent write.
export function AcronymField({ value, suggestion, onChange, disabled }: {
  value: string;
  suggestion: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const ref = useRef<HTMLInputElement>(null);
  const shown = value.trim();
  const has = !!shown;
  // Wide enough for whatever is in it (or for the suggestion behind it), so the
  // chip is a chip and not a full-width field pretending to be one.
  const ch = Math.max(5, Math.min(18, (shown || suggestion || 'Add one').length + 1));
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
      <label htmlFor={id} style={{ fontFamily: OUTFIT, fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', color: C.inkSoft, textTransform: 'uppercase' }}>
        Short name
      </label>
      <span className="relative inline-flex items-center">
        <input
          ref={ref}
          id={id}
          type="text"
          value={value}
          disabled={disabled}
          maxLength={16}
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => onChange(e.target.value.replace(/\s{2,}/g, ' ').trimStart())}
          placeholder={suggestion || 'Add one'}
          title="The acronym shown wherever the full name is too long. Leave it empty to use the suggestion."
          className="rounded-[10px] bg-white/80 px-2.5 py-1 text-center focus:outline-none focus:shadow-[inset_0_0_0_2px_#1B3828,0_0_0_3px_rgba(27,56,40,0.08)] transition-[box-shadow] duration-150 disabled:opacity-55"
          style={{
            width: `calc(${ch}ch + 22px)`, minWidth: 72,
            fontFamily: OUTFIT, fontSize: 13.5, fontWeight: 800, letterSpacing: '0.05em',
            color: C.forest,
            boxShadow: has
              ? 'inset 0 0 0 1.5px rgba(27,56,40,0.28)'
              : 'inset 0 0 0 1.5px rgba(27,56,40,0.14)',
          }}
        />
        {has && (
          <button
            type="button"
            onClick={() => { onChange(''); ref.current?.focus(); }}
            aria-label="Clear the short name and use the suggestion"
            title="Clear the short name and use the suggestion"
            className="ms-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full transition-[background-color,color,transform] duration-150 hover:bg-[#1B3828]/[0.08] active:scale-[0.96] focus:outline-none focus-visible:shadow-[0_0_0_2px_#1B3828]"
            style={{ color: C.inkSoft }}
          >
            <X size={13} strokeWidth={2.4} />
          </button>
        )}
      </span>
      <span className="min-w-0 flex-1 truncate" style={{ fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 600, color: C.muted }}>
        {has
          ? 'Shown when the full name is long'
          : suggestion
            ? `Suggested from the name`
            : 'Optional. Shown when the full name is long'}
      </span>
    </div>
  );
}

// ── The emblem picker ────────────────────────────────────────────────────────
// (23 Sep 2026, owner: "provide a few preset emblems for organisers to choose
// from: 6 presets, or upload your own".) Six swatches in a row, then the upload
// tile; the seventh control is "Back to automatic", offered only once the
// organiser has made a choice of their own. The big preview lives in the
// identity row above, so nothing here has to be large.
export function EmblemPicker({ value, onPick, onUpload, onReset, uploading, canReset, tone, monogramText }: {
  value: string | null;
  onPick: (logo: string) => void;
  onUpload: () => void;
  onReset: () => void;
  uploading: boolean;
  canReset: boolean;
  tone: MedallionTone;
  monogramText: string;
}) {
  return (
    <div className="flex flex-wrap items-start gap-2">
      {EMBLEM_PICKS.map((p) => {
        const active = value === p.logo;
        return (
          <button
            key={p.key}
            type="button"
            onClick={() => onPick(p.logo)}
            aria-pressed={active}
            title={p.title}
            aria-label={p.title}
            className="flex flex-col items-center gap-1 rounded-[14px] px-1.5 pb-1 pt-1.5 transition-[background-color,transform,box-shadow] duration-150 hover:bg-[#1B3828]/[0.05] active:scale-[0.96] focus:outline-none focus-visible:shadow-[0_0_0_2px_#1B3828]"
            style={{ width: 56, backgroundColor: active ? 'rgba(238,217,138,0.38)' : undefined }}
          >
            <span
              className="relative flex items-center justify-center rounded-full bg-white"
              style={{
                width: 38, height: 38,
                boxShadow: active
                  ? '0 0 0 2px #1B3828, 0 2px 6px rgba(27,56,40,0.18)'
                  : '0 1px 2px rgba(27,56,40,0.10), inset 0 0 0 1px rgba(0,0,0,0.07)',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.logo} alt="" draggable={false} decoding="async" className="block h-full w-full object-contain" style={{ padding: 5 }} />
            </span>
            <span className="max-w-full truncate" style={{ fontFamily: OUTFIT, fontSize: 9.5, fontWeight: 800, letterSpacing: '0.04em', color: active ? C.forest : C.inkSoft }}>
              {p.label}
            </span>
          </button>
        );
      })}

      {/* Upload your own. Same footprint as a swatch, so the row reads as one set. */}
      <button
        type="button"
        onClick={() => { if (!uploading) onUpload(); }}
        disabled={uploading}
        title="Upload your own emblem"
        aria-label="Upload your own emblem"
        className="flex flex-col items-center gap-1 rounded-[14px] px-1.5 pb-1 pt-1.5 transition-[background-color,transform] duration-150 enabled:hover:bg-[#1B3828]/[0.05] enabled:active:scale-[0.96] focus:outline-none focus-visible:shadow-[0_0_0_2px_#1B3828]"
        style={{ width: 56 }}
      >
        <span
          className="flex items-center justify-center rounded-full"
          style={{ width: 38, height: 38, color: C.forest, boxShadow: 'inset 0 0 0 1.5px rgba(27,56,40,0.22)' }}
        >
          {uploading ? <Loader2 size={16} strokeWidth={2.4} className="animate-spin" /> : <ImagePlus size={16} strokeWidth={2.2} />}
        </span>
        <span style={{ fontFamily: OUTFIT, fontSize: 9.5, fontWeight: 800, letterSpacing: '0.04em', color: C.inkSoft }}>
          {uploading ? 'Wait' : 'Upload'}
        </span>
      </button>

      {/* The current emblem, and the way back to the automatic one. */}
      {canReset && (
        <button
          type="button"
          onClick={onReset}
          title="Go back to the emblem Gavelling picks from the committee name"
          className="flex flex-col items-center gap-1 rounded-[14px] px-1.5 pb-1 pt-1.5 transition-[background-color,transform] duration-150 hover:bg-[#1B3828]/[0.05] active:scale-[0.96] focus:outline-none focus-visible:shadow-[0_0_0_2px_#1B3828]"
          style={{ width: 56 }}
        >
          <span className="flex items-center justify-center rounded-full" style={{ width: 38, height: 38, color: C.inkSoft, boxShadow: 'inset 0 0 0 1.5px rgba(27,56,40,0.16)' }}>
            <RotateCcw size={15} strokeWidth={2.2} />
          </span>
          <span style={{ fontFamily: OUTFIT, fontSize: 9.5, fontWeight: 800, letterSpacing: '0.04em', color: C.inkSoft }}>Auto</span>
        </button>
      )}

      {/* No emblem at all: the type-toned seal the committee would ship with. */}
      {!value && !uploading && (
        <span className="flex items-center gap-2 self-center ps-1" style={{ fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 600, color: C.muted }}>
          <MonogramMedallion text={monogramText || '—'} tone={tone} size={26} />
          Initials, until you pick one
        </span>
      )}
    </div>
  );
}

// ── The primary action ───────────────────────────────────────────────────────
// /create's Start session button: the label centred on a deep forest gradient
// with a faint gold rim, and a sub line that says what is MISSING. Blocked but
// still focusable (aria-disabled), so a press can take the organiser to the
// missing field instead of doing nothing.
export function SetupPrimaryButton({ label, sub, state, onClick }: {
  label: string;
  sub: string | null;
  state: 'ready' | 'blocked' | 'saving';
  onClick: () => void;
}) {
  const ready = state === 'ready';
  const saving = state === 'saving';
  const blocked = state === 'blocked';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-disabled={!ready || undefined}
      aria-busy={saving || undefined}
      disabled={saving}
      className={`relative flex w-full flex-col items-center justify-center overflow-hidden px-5 text-center transition-[transform,box-shadow,background-color] duration-150 focus:outline-none focus-visible:shadow-[0_0_0_3px_#FAF8F3,0_0_0_5px_#1B3828] ${ready ? 'hover:-translate-y-px active:scale-[0.97]' : ''}`}
      style={{
        minHeight: 52, borderRadius: 16,
        backgroundColor: blocked ? 'rgba(27,56,40,0.06)' : C.forest,
        backgroundImage: blocked ? undefined : 'linear-gradient(135deg, #2E6446 0%, #1F4230 42%, #1B3828 62%, #122A1D 100%)',
        boxShadow: blocked
          ? 'inset 0 0 0 1.5px rgba(27,56,40,0.14)'
          : 'inset 0 1px 0 rgba(238,217,138,0.22), inset 0 0 0 1px rgba(238,217,138,0.14), 0 2px 4px rgba(27,56,40,0.16), 0 10px 24px rgba(27,56,40,0.24)',
        cursor: blocked ? 'not-allowed' : saving ? 'progress' : 'pointer',
      }}
    >
      <span className="relative flex max-w-full items-center justify-center gap-2 py-2">
        {saving && <Loader2 size={16} strokeWidth={2.6} className="shrink-0 animate-spin" style={{ color: C.gold }} aria-hidden />}
        {blocked && <Lock size={14} strokeWidth={2.4} className="shrink-0" style={{ color: C.muted }} aria-hidden />}
        <span className="flex min-w-0 flex-col items-center">
          <span className="max-w-full truncate" style={{ fontFamily: OUTFIT, fontSize: 15.5, fontWeight: 800, letterSpacing: '0.01em', lineHeight: 1.2, color: blocked ? C.forest : C.gold }}>
            {label}
          </span>
          {sub && (
            <span className="max-w-full truncate" style={{ fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 600, lineHeight: 1.3, marginTop: 1, color: blocked ? C.inkSoft : 'rgba(237,231,216,0.72)' }}>
              {sub}
            </span>
          )}
        </span>
      </span>
    </button>
  );
}

/** The quiet companion to SetupPrimaryButton (Cancel). */
export function SetupGhostButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-center px-5 transition-[background-color,transform] duration-150 hover:bg-[#1B3828]/[0.06] active:scale-[0.97] focus:outline-none focus-visible:shadow-[0_0_0_2px_#1B3828]"
      style={{
        minHeight: 52, borderRadius: 16, backgroundColor: 'transparent',
        boxShadow: 'inset 0 0 0 1.5px rgba(27,56,40,0.16)',
        fontFamily: OUTFIT, fontSize: 14.5, fontWeight: 800, color: C.forest,
      }}
    >
      {label}
    </button>
  );
}
