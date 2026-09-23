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

import { useId, useRef, useState, type ReactNode } from 'react';
import { ImagePlus, RotateCcw, Loader2, Lock, X, Users2, Landmark, Scale, Zap, Minus, Plus, ChevronDown, Languages } from 'lucide-react';
import { C, OUTFIT, SHADOW } from '@/app/join/joinUi';
import {
  EMBLEM_PICKS,
  matchPresetEmblem,
  deriveCommitteeAcronym,
  committeeDisplayName,
} from '@/lib/presetNames';
import { MonogramMedallion, medallionTone, type MedallionTone } from '@/components/MonogramMedallion';
import {
  ConferenceRosterPicker,
  ConferenceRosterSelected,
  ConferenceCommitteeNameInput,
  entry,
  type RosterEntry,
} from '@/components/ConferenceRosterPicker';
import { effectiveSlotArt, type SlotGroup } from '@/lib/slotGroups';
import { getCountryByName } from '@/lib/countries';
import { LevelInsignia, LEVEL_ACCENT } from '@/app/account/accountUi';
import {
  COMMITTEE_LANGUAGES,
  COMMITTEE_LANGUAGE_MAX,
  isListedCommitteeLanguage,
  normaliseCommitteeLanguage,
} from '@/lib/committeeLanguage';

export { C, OUTFIT, SHADOW };

/** One input look for every field in the editor. 16px on phones so iOS never zooms. */
export const SETUP_INPUT_CLS =
  'w-full rounded-[12px] bg-white/80 px-3 py-2 text-base sm:text-[14px] text-[#1C1410] placeholder-[#8A7C6B] ' +
  'shadow-[inset_0_0_0_1px_rgba(27,56,40,0.16)] focus:outline-none ' +
  'focus:shadow-[inset_0_0_0_2px_#1B3828,0_0_0_4px_rgba(27,56,40,0.08)] transition-[box-shadow] duration-150 ' +
  'disabled:opacity-55';

/** Small uppercase label above a field. */
export function SetupLabel({ children, htmlFor, aside }: { children: ReactNode; htmlFor?: string; aside?: ReactNode }) {
  const style = { fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 800, letterSpacing: '0.14em', color: C.inkSoft } as const;
  return (
    <div className="mb-1 flex items-baseline gap-2">
      {htmlFor
        ? <label htmlFor={htmlFor} className="block uppercase" style={style}>{children}</label>
        : <span className="block uppercase" style={style}>{children}</span>}
      {aside && <span className="min-w-0 flex-1 truncate" style={{ fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 600, color: C.inkSoft }}>{aside}</span>}
    </div>
  );
}

/** The numbered step heading: a forest disc with the gold numeral, then the title. */
export function SetupStep({ step, title, id, aside }: { step: number; title: string; id: string; aside?: ReactNode }) {
  return (
    <header className="mb-2 flex min-h-[28px] flex-wrap items-center gap-x-2.5 gap-y-1.5">
      <span
        aria-hidden
        className="flex flex-shrink-0 items-center justify-center tabular-nums"
        style={{
          width: 22, height: 22, borderRadius: 999, backgroundColor: C.forest, color: C.gold,
          fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 800, boxShadow: '0 1px 3px rgba(27,56,40,0.18)',
        }}
      >
        {step}
      </span>
      <h3 id={id} className="me-auto" style={{ fontFamily: OUTFIT, fontSize: 15, fontWeight: 800, letterSpacing: '-0.01em', color: C.forest, lineHeight: 1.2, margin: 0 }}>
        {title}
      </h3>
      {aside && <div className="flex flex-wrap items-center gap-2">{aside}</div>}
    </header>
  );
}

// ── The live committee identity ──────────────────────────────────────────────
// The /create preview, with the conference editor's type-toned monogram as the
// fallback so nothing about crisis / custom committees is lost.
export function CommitteeIdentityPreview({ src, primary, secondary, placeholder, topic, topicLabel, topicEmpty, tone, monogramText, compact = false, eyebrow }: {
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
  /** The editor's header: a 56px emblem, one line each, so the identity IS the
   *  dialog's title bar instead of a block of its own under it. */
  compact?: boolean;
  /** A small line above the name (the editor says what it is doing there). */
  eyebrow?: ReactNode;
}) {
  const hasName = !!primary;
  const shown = primary || placeholder;
  const disc = compact ? 56 : 84;
  return (
    <div aria-hidden className={`flex min-w-0 flex-shrink-0 items-center ${compact ? 'gap-3' : 'gap-4'}`}>
      {src ? (
        <span
          key={src}
          className="relative flex flex-shrink-0 items-center justify-center rounded-full bg-white"
          style={{
            width: disc, height: disc,
            boxShadow: '0 1px 2px rgba(27,56,40,0.10), 0 8px 22px rgba(27,56,40,0.14), inset 0 0 0 1px rgba(0,0,0,0.06)',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" draggable={false} decoding="async" className="block h-full w-full object-contain" style={{ padding: '15%' }} />
        </span>
      ) : (
        /* No name yet → MonogramMedallion's own em-dash, never initials of the
           placeholder ("Untitled committee" used to read UNTITL). */
        <MonogramMedallion text={monogramText} tone={tone} size={disc} />
      )}

      <div className="min-w-0 flex-1">
        {eyebrow && <div className="mb-0.5">{eyebrow}</div>}
        <p
          className="truncate"
          title={shown}
          style={{
            fontFamily: OUTFIT, fontWeight: 800, letterSpacing: '-0.015em', lineHeight: 1.12,
            fontSize: compact ? (shown.length > 22 ? 18 : 22) : (shown.length > 22 ? 21 : 27),
            color: hasName ? C.forest : C.inkSoft,
          }}
        >
          {shown}
        </p>
        {secondary && (
          <p className="mt-0.5 truncate" style={{ fontFamily: OUTFIT, fontSize: compact ? 12.5 : 13.5, fontWeight: 500, lineHeight: 1.35, color: C.inkSoft }}>
            {secondary}
          </p>
        )}
        <p className={`mt-0.5 ${compact ? 'truncate' : 'line-clamp-2'}`} style={{ fontFamily: OUTFIT, fontSize: compact ? 12.5 : 13.5, lineHeight: 1.4, color: topic ? C.ink : C.inkSoft, textWrap: 'pretty' }}>
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
export function AcronymField({ value, suggestion, onChange, disabled, onSubmit }: {
  value: string;
  suggestion: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  /** Enter in the chip. The wizard saves the draft with it. */
  onSubmit?: () => void;
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
      <label htmlFor={id} style={{ fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 800, letterSpacing: '0.1em', color: C.inkSoft, textTransform: 'uppercase' }}>
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
          onKeyDown={(e) => { if (e.key === 'Enter' && onSubmit) { e.preventDefault(); onSubmit(); } }}
          placeholder={suggestion || 'Add one'}
          title="The acronym shown wherever the full name is too long. Leave it empty to use the suggestion."
          className="rounded-[9px] bg-white/80 px-2 py-0.5 text-center focus:outline-none focus:shadow-[inset_0_0_0_2px_#1B3828,0_0_0_3px_rgba(27,56,40,0.08)] transition-[box-shadow] duration-150 disabled:opacity-55"
          style={{
            width: `calc(${ch}ch + 22px)`, minWidth: 72,
            fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 800, letterSpacing: '0.05em',
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
      <span className="min-w-0 flex-1 truncate" style={{ fontFamily: OUTFIT, fontSize: 11, fontWeight: 600, color: C.inkSoft }}>
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
  /** Omitted → no Upload tile (a caller with nowhere to put the file). */
  onUpload?: () => void;
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
            className="flex flex-col items-center gap-0.5 rounded-[12px] px-1 pb-0.5 pt-1 transition-[background-color,transform,box-shadow] duration-150 hover:bg-[#1B3828]/[0.05] active:scale-[0.96] focus:outline-none focus-visible:shadow-[0_0_0_2px_#1B3828]"
            style={{ width: 46, backgroundColor: active ? 'rgba(238,217,138,0.38)' : undefined }}
          >
            <span
              className="relative flex items-center justify-center rounded-full bg-white"
              style={{
                width: 32, height: 32,
                boxShadow: active
                  ? '0 0 0 2px #1B3828, 0 2px 6px rgba(27,56,40,0.18)'
                  : '0 1px 2px rgba(27,56,40,0.10), inset 0 0 0 1px rgba(0,0,0,0.07)',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.logo} alt="" draggable={false} decoding="async" className="block h-full w-full object-contain" style={{ padding: 4 }} />
            </span>
            <span className="max-w-full truncate" style={{ fontFamily: OUTFIT, fontSize: 9, fontWeight: 800, letterSpacing: '0.04em', color: active ? C.forest : C.inkSoft }}>
              {p.label}
            </span>
          </button>
        );
      })}

      {/* Upload your own. Same footprint as a swatch, so the row reads as one set. */}
      {onUpload && (
      <button
        type="button"
        onClick={() => { if (!uploading) onUpload(); }}
        disabled={uploading}
        title="Upload your own emblem"
        aria-label="Upload your own emblem"
        className="flex flex-col items-center gap-0.5 rounded-[12px] px-1 pb-0.5 pt-1 transition-[background-color,transform] duration-150 enabled:hover:bg-[#1B3828]/[0.05] enabled:active:scale-[0.96] focus:outline-none focus-visible:shadow-[0_0_0_2px_#1B3828]"
        style={{ width: 46 }}
      >
        <span
          className="flex items-center justify-center rounded-full"
          style={{ width: 32, height: 32, color: C.forest, boxShadow: 'inset 0 0 0 1.5px rgba(27,56,40,0.22)' }}
        >
          {uploading ? <Loader2 size={16} strokeWidth={2.4} className="animate-spin" /> : <ImagePlus size={16} strokeWidth={2.2} />}
        </span>
        <span style={{ fontFamily: OUTFIT, fontSize: 9, fontWeight: 800, letterSpacing: '0.04em', color: C.inkSoft }}>
          {uploading ? 'Wait' : 'Upload'}
        </span>
      </button>
      )}

      {/* The current emblem, and the way back to the automatic one. */}
      {canReset && (
        <button
          type="button"
          onClick={onReset}
          title="Go back to the emblem Gavelling picks from the committee name"
          className="flex flex-col items-center gap-0.5 rounded-[12px] px-1 pb-0.5 pt-1 transition-[background-color,transform] duration-150 hover:bg-[#1B3828]/[0.05] active:scale-[0.96] focus:outline-none focus-visible:shadow-[0_0_0_2px_#1B3828]"
          style={{ width: 46 }}
        >
          <span className="flex items-center justify-center rounded-full" style={{ width: 32, height: 32, color: C.inkSoft, boxShadow: 'inset 0 0 0 1.5px rgba(27,56,40,0.16)' }}>
            <RotateCcw size={15} strokeWidth={2.2} />
          </span>
          <span style={{ fontFamily: OUTFIT, fontSize: 9, fontWeight: 800, letterSpacing: '0.04em', color: C.inkSoft }}>Auto</span>
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
        minHeight: 46, borderRadius: 14,
        backgroundColor: blocked ? 'rgba(27,56,40,0.06)' : C.forest,
        backgroundImage: blocked ? undefined : 'linear-gradient(135deg, #2E6446 0%, #1F4230 42%, #1B3828 62%, #122A1D 100%)',
        boxShadow: blocked
          ? 'inset 0 0 0 1.5px rgba(27,56,40,0.14)'
          : 'inset 0 1px 0 rgba(238,217,138,0.22), inset 0 0 0 1px rgba(238,217,138,0.14), 0 2px 4px rgba(27,56,40,0.16), 0 10px 24px rgba(27,56,40,0.24)',
        cursor: blocked ? 'not-allowed' : saving ? 'progress' : 'pointer',
      }}
    >
      <span className="relative flex max-w-full items-center justify-center gap-2 py-1.5">
        {saving && <Loader2 size={16} strokeWidth={2.6} className="shrink-0 animate-spin" style={{ color: C.gold }} aria-hidden />}
        {blocked && <Lock size={14} strokeWidth={2.4} className="shrink-0" style={{ color: C.muted }} aria-hidden />}
        <span className="flex min-w-0 flex-col items-center">
          <span className="max-w-full truncate" style={{ fontFamily: OUTFIT, fontSize: 14.5, fontWeight: 800, letterSpacing: '0.01em', lineHeight: 1.2, color: blocked ? C.forest : C.gold }}>
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
        minHeight: 46, borderRadius: 14, backgroundColor: 'transparent',
        boxShadow: 'inset 0 0 0 1.5px rgba(27,56,40,0.16)',
        fontFamily: OUTFIT, fontSize: 14, fontWeight: 800, color: C.forest,
      }}
    >
      {label}
    </button>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// THE SHARED COMMITTEE SET-UP SURFACE
// ═════════════════════════════════════════════════════════════════════════════
// (23 Sep 2026, owner: "In the actual initial conference set-up flow, literally
// add the exact same committee set-up. It should always match.")
//
// ONE implementation of the set-up body, used by BOTH:
//   • CommitteeEditorModal — /manage/[slug]/committees, writes straight to the
//     database;
//   • the creation wizard's step 7 — /conferences/new, which has no conference
//     row yet and collects drafts that `handleCreate` writes after the review
//     screen.
//
// The two callers differ ONLY in the shell around it (a modal with a docked
// rail vs an inline panel in the wizard) and in what they do with the answer.
// Everything an organiser sees and touches is here, so the two can never drift.
//
// WHAT IS DELIBERATELY *NOT* IN HERE: chair assignment. `ChairsDock` needs a
// committee id to seat or invite anyone against, and in the wizard the
// committee does not exist yet, so it stays in the editor's rail and the wizard
// step keeps saying chairs come later. That is unchanged from today.

/** The committee type. Governs rostering: GA + Specialised roster by country
 *  slots; Crisis rosters free-text character names; Custom is the parliamentary
 *  type (free-text seats plus seat GROUPS with their own crests). */
export type CommitteeType = 'general-assembly' | 'specialised' | 'crisis' | 'custom';

export const COMMITTEE_TYPE_LABEL: Record<string, string> = {
  'general-assembly': 'General Assembly',
  specialised: 'Specialised',
  crisis: 'Crisis',
  custom: 'Custom',
};

/** Declared in the order the editor's type picker offers them, rather than read
 *  off COMMITTEE_TYPE_LABEL's key order, so nothing can silently reshuffle. */
export const COMMITTEE_TYPES: CommitteeType[] = ['general-assembly', 'specialised', 'crisis', 'custom'];

export const DIFFICULTIES = ['beginner', 'intermediate', 'advanced', 'expert'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

/** Everything the set-up surface collects. The editor keeps these as its own
 *  useStates and assembles this view of them; the wizard stores one per draft
 *  committee. Every field maps onto a `conference_committees` column or onto
 *  `committee_country_slots`. */
export interface CommitteeSetupDraft {
  name: string;
  /** `conference_committees.abbreviation`. '' means "none": saved as NULL, and
   *  every reader derives the suggestion again. */
  abbreviation: string;
  topics: string[];
  difficulty: string;
  roster: RosterEntry[];
  /** `conference_committees.groups`, custom (parliamentary) committees only. */
  groups: SlotGroup[];
  /** delegation_size 2 when on. */
  doubleDelegation: boolean;
  /** The organiser's OWN emblem, or null. Never the derived one — see
   *  `effectiveEmblem`. */
  logoUrl: string | null;
  /** True once they picked, uploaded or kept an emblem of their own. False puts
   *  the emblem back under `matchPresetEmblem`. */
  emblemManuallySet: boolean;
  /** A selected preset can force the roster path (ICC/ICJ/Crisis/HoC/Senate/
   *  Press roster free-text seats even under a non-crisis type). Null → the
   *  committee type's own default. */
  presetRosterMode: 'country' | 'character' | null;
  /** `conference_committees.working_language`: a display name, or null for
   *  "not set" (see src/lib/committeeLanguage.ts). Optional: the picker shows
   *  only where the caller passes `showLanguage` (the editor and the wizard). */
  workingLanguage?: string | null;
}

export function emptyCommitteeSetupDraft(): CommitteeSetupDraft {
  return {
    name: '', abbreviation: '', topics: [], difficulty: 'intermediate',
    roster: [], groups: [], doubleDelegation: false,
    logoUrl: null, emblemManuallySet: false, presetRosterMode: null,
    workingLanguage: null,
  };
}

/** THE emblem a committee ships with, DERIVED, never stored in two places:
 *  the organiser's own choice when they made one, otherwise whatever the name
 *  and acronym resolve to. Both callers write exactly this to `logo_url`.
 *
 *  It is a pure derivation on purpose. It used to be an effect in the editor
 *  that wrote `logoUrl` on every name keystroke, which is a cascading-render
 *  setState-in-effect and could disagree with what was about to be saved. */
export function effectiveEmblem(draft: CommitteeSetupDraft): string | null {
  return draft.emblemManuallySet ? draft.logoUrl : matchPresetEmblem(draft.name, draft.abbreviation);
}

/** Which roster a draft is building: countries, or free-text characters/members. */
export function rosterModeOf(draft: CommitteeSetupDraft, type: CommitteeType): 'country' | 'character' {
  return draft.presetRosterMode ?? ((type === 'crisis' || type === 'custom') ? 'character' : 'country');
}

/** What one row of the roster is called in copy. */
export function seatNounsOf(type: CommitteeType, isCharacterRoster: boolean): { noun: string; plural: string } {
  if (type === 'custom') return { noun: 'member', plural: 'members' };
  return isCharacterRoster ? { noun: 'character', plural: 'characters' } : { noun: 'country', plural: 'countries' };
}

/** The type as an icon and an ink colour — an icon beside a plain word, never a
 *  status pill (CLAUDE.md §8). Written as four literal elements rather than a
 *  returned component type, so nothing creates a component during render. */
export function CommitteeTypeGlyph({ type, size = 14 }: { type: CommitteeType; size?: number }) {
  if (type === 'crisis') return <Zap size={size} strokeWidth={2.2} />;
  if (type === 'custom') return <Users2 size={size} strokeWidth={2.2} />;
  if (type === 'specialised') return <Scale size={size} strokeWidth={2.2} />;
  return <Landmark size={size} strokeWidth={2.2} />;
}
export function committeeTypeAccent(type: CommitteeType): string {
  return type === 'crisis' ? '#8B2020' : type === 'custom' ? '#7A5416' : '#1B3828';
}

/** Exactly what the chair masthead and every conference card will show for this
 *  draft (the AGENTS.md UI RULE: acronym big, full name small beneath), plus the
 *  emblem and the acronym suggestion behind the SHORT NAME chip. ONE derivation,
 *  so the editor, the wizard and the saved row cannot disagree. */
export function committeeSetupPreview(draft: CommitteeSetupDraft) {
  const trimmedName = draft.name.trim();
  // The AUTOMATIC answer only: `deriveCommitteeAcronym` is called WITHOUT the
  // abbreviation on purpose, because passing it would just hand back what the
  // organiser already typed and the chip would have nothing to suggest.
  const suggestion = deriveCommitteeAcronym(trimmedName);
  const acronym = draft.abbreviation.trim() || suggestion;
  const primary = trimmedName ? committeeDisplayName(trimmedName, acronym) : '';
  return {
    trimmedName,
    suggestion,
    acronym,
    primary,
    secondary: primary && primary !== trimmedName ? trimmedName : null,
    emblem: effectiveEmblem(draft),
  };
}

// ── Delegates per seat ───────────────────────────────────────────────────────
// (23 Sep 2026, owner: "I don't like the single/double delegation slider".) A
// stepper that states the answer as a number and a plain sentence: "[−] 2 [+]
// delegates per country". It still stores exactly what it always did: the draft's
// `doubleDelegation` boolean, which the editor writes as delegation_size 1 or 2.
// The range is 1 to 2 because that is all the allocation model supports.
export function DelegationSizeStepper({ value, onChange, noun }: {
  value: 1 | 2;
  onChange: (next: 1 | 2) => void;
  /** "country", "character", "member". */
  noun: string;
}) {
  const btn = (dir: -1 | 1) => {
    const next = (value + dir) as 1 | 2;
    const can = next === 1 || next === 2;
    const Icon = dir < 0 ? Minus : Plus;
    return (
      <button
        type="button"
        onClick={() => { if (can) onChange(next); }}
        disabled={!can}
        aria-label={dir < 0 ? 'One delegate per seat' : 'Two delegates per seat'}
        title={dir < 0 ? `Single delegation: one delegate per ${noun}` : `Double delegation: two delegates share each ${noun}`}
        className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full transition-[background-color,color,transform] duration-150 enabled:hover:bg-[#1B3828] enabled:hover:text-[#EED98A] enabled:active:scale-[0.94] disabled:opacity-30 focus:outline-none focus-visible:shadow-[0_0_0_2px_#1B3828]"
        style={{ color: C.forest, boxShadow: 'inset 0 0 0 1px rgba(27,56,40,0.22)' }}
      >
        <Icon size={12} strokeWidth={2.6} />
      </button>
    );
  };
  return (
    <div role="group" aria-label="Delegates per seat" className="inline-flex flex-shrink-0 items-center gap-2">
      <span className="inline-flex items-center gap-1.5 rounded-full px-1 py-0.5" style={{ backgroundColor: 'rgba(27,56,40,0.05)' }}>
        {btn(-1)}
        <span aria-live="polite" className="tabular-nums" style={{ minWidth: 14, textAlign: 'center', fontFamily: OUTFIT, fontSize: 15, fontWeight: 800, color: C.forest }}>
          {value}
        </span>
        {btn(1)}
      </span>
      <span style={{ fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 700, color: C.inkSoft, whiteSpace: 'nowrap' }}>
        {value === 1 ? 'delegate' : 'delegates'} per {noun}
      </span>
    </div>
  );
}

// ── The working language ─────────────────────────────────────────────────────
// A small select of the usual MUN languages, "Not set", and Other (free text).
// Writes `workingLanguage` as a display name or null; see src/lib/committeeLanguage.ts.
export function CommitteeLanguagePicker({ value, onChange, id }: {
  value: string | null;
  onChange: (next: string | null) => void;
  id?: string;
}) {
  const listed = isListedCommitteeLanguage(value);
  const [otherOpen, setOtherOpen] = useState<boolean>(!!value && !listed);
  const showOther = otherOpen || (!!value && !listed);
  const selectValue = showOther ? '__other' : (value ? COMMITTEE_LANGUAGES.find((l) => l.toLowerCase() === value.trim().toLowerCase()) ?? '' : '');
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <span className="relative inline-flex flex-shrink-0 items-center">
        <select
          id={id}
          value={selectValue}
          onChange={(e) => {
            const v = e.target.value;
            if (v === '__other') { setOtherOpen(true); onChange(listed ? null : value); return; }
            setOtherOpen(false);
            onChange(v || null);
          }}
          className="appearance-none rounded-[10px] bg-white/80 py-1.5 ps-2.5 pe-7 focus:outline-none focus:shadow-[inset_0_0_0_2px_#1B3828] transition-[box-shadow] duration-150"
          style={{
            fontFamily: OUTFIT, fontSize: 13, fontWeight: 700, color: value || showOther ? C.forest : C.inkSoft,
            boxShadow: 'inset 0 0 0 1px rgba(27,56,40,0.16)', cursor: 'pointer',
          }}
        >
          <option value="">Not set</option>
          {COMMITTEE_LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
          <option value="__other">Other…</option>
        </select>
        <ChevronDown aria-hidden size={13} strokeWidth={2.4} className="pointer-events-none absolute end-2" style={{ color: C.inkSoft }} />
      </span>
      {showOther && (
        <input
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value.slice(0, COMMITTEE_LANGUAGE_MAX) || null)}
          onBlur={(e) => onChange(normaliseCommitteeLanguage(e.target.value))}
          maxLength={COMMITTEE_LANGUAGE_MAX}
          placeholder="Which language?"
          aria-label="Working language"
          className="min-w-0 flex-1 rounded-[10px] bg-white/80 px-2.5 py-1.5 text-base sm:text-[13px] focus:outline-none focus:shadow-[inset_0_0_0_2px_#1B3828]"
          style={{ fontFamily: OUTFIT, fontWeight: 600, color: C.ink, boxShadow: 'inset 0 0 0 1px rgba(27,56,40,0.16)' }}
        />
      )}
    </div>
  );
}

// ── The set-up fields: step 1 (Committee) and step 2 (the seats) ─────────────
//
// TWO LAYOUTS (23 Sep 2026, owner: "a lot of things are just too big ... in an
// ideal world, no scrolling is needed when setting up the committee"):
//   • 'stacked' — the creation wizard: the two steps one above the other.
//   • 'columns' — the committee editor: the fragment's two sections become two
//     grid items of the caller's grid. Step 1 scrolls on its own if it must;
//     step 2 is a flex column whose selected list takes the rest of the height
//     and scrolls inside its own box, so the dialog itself never scrolls at
//     1280x800 for a typical committee.
export function CommitteeSetupFields({
  draft, onChange, committeeType, isEdit = false,
  nameInputId = 'committee-setup-name',
  onUploadEmblem, emblemUploading = false,
  onUploadFlag, selectedInline = false,
  onSubmit,
  layout = 'stacked',
  showLanguage = false,
}: {
  draft: CommitteeSetupDraft;
  /** A PARTIAL patch, so a caller holding separate useStates can fan it out. */
  onChange: (patch: Partial<CommitteeSetupDraft>) => void;
  committeeType: CommitteeType;
  /** Editing a committee that already exists: a preset pick must not replace
   *  a roster somebody has already allocated against. */
  isEdit?: boolean;
  nameInputId?: string;
  /** Opens the caller's own file picker. Omitted → no Upload tile. */
  onUploadEmblem?: () => void;
  emblemUploading?: boolean;
  /** Uploads a seat or group crest. Omitted → the per-row flag control is off. */
  onUploadFlag?: (file: File, kind: 'seat' | 'group') => Promise<string | null>;
  /** True renders the selected roster directly under the add controls. Always
   *  on in the 'columns' layout. */
  selectedInline?: boolean;
  /** Enter in the name or acronym field. The wizard saves the draft with it. */
  onSubmit?: () => void;
  layout?: 'stacked' | 'columns';
  /** Offer the working-language picker. Only a caller that SAVES
   *  `workingLanguage` may turn it on. */
  showLanguage?: boolean;
}) {
  const [topicInput, setTopicInput] = useState('');
  const [topicError, setTopicError] = useState('');
  const isCrisis = committeeType === 'crisis';
  const isCustom = committeeType === 'custom';
  const cols = layout === 'columns';
  const mode = rosterModeOf(draft, committeeType);
  const isCharacterRoster = mode === 'character';
  const { noun: seatNoun } = seatNounsOf(committeeType, isCharacterRoster);
  const { suggestion, emblem } = committeeSetupPreview(draft);
  const inline = cols || selectedInline;

  function addTopic() {
    const t = topicInput.trim();
    if (!t || draft.topics.length >= 3) return;
    if (draft.topics.includes(t)) { setTopicError('That topic is already on the list.'); return; }
    onChange({ topics: [...draft.topics, t] });
    setTopicInput('');
    setTopicError('');
  }

  return (
    <>
      {/* ── 1. Committee ──────────────────────────────────────────────── */}
      <section
        aria-labelledby={`${nameInputId}-step-committee`}
        className={cols ? 'min-h-0 overflow-y-auto overscroll-contain pe-1' : 'mt-3.5 pt-3'}
        style={cols ? undefined : { boxShadow: 'inset 0 1px 0 rgba(27,56,40,0.08)' }}
      >
        <SetupStep step={1} id={`${nameInputId}-step-committee`} title="Committee" />
        <div className="flex flex-col gap-3">
          <div>
            <SetupLabel htmlFor={nameInputId}>Name</SetupLabel>
            {!isCrisis && !isCustom ? (
              <ConferenceCommitteeNameInput
                id={nameInputId}
                className={SETUP_INPUT_CLS}
                value={draft.name}
                onChange={(v) => onChange({ name: v })}
                onPresetSelect={(p) => {
                  // Store the CANONICAL FULL NAME, always — the acronym goes in
                  // its own column and the display layer collapses the two
                  // (committeeDisplayName). This used to store the collapsed
                  // label as the name, which is why production has rows whose
                  // name and abbreviation are both literally "DISEC": the full
                  // name was thrown away at creation and no surface could ever
                  // show it beneath the acronym again.
                  onChange({
                    name: p.name,
                    abbreviation: p.acronym,
                    presetRosterMode: p.rosterMode ?? 'country',
                    ...(isEdit ? {} : { roster: p.members.map((m) => entry(m)) }),
                  });
                }}
              />
            ) : (
              <input
                id={nameInputId}
                value={draft.name}
                onChange={(e) => onChange({ name: e.target.value })}
                onKeyDown={(e) => { if (e.key === 'Enter' && onSubmit) { e.preventDefault(); onSubmit(); } }}
                placeholder={isCustom ? 'e.g. Model European Parliament, Youth Lok Sabha' : 'e.g. The Cuban Missile Crisis, 1962'}
                className={SETUP_INPUT_CLS}
              />
            )}
            {/* The acronym, ON the name field rather than in a row of its own. */}
            <AcronymField
              value={draft.abbreviation}
              suggestion={suggestion}
              onChange={(v) => onChange({ abbreviation: v })}
              onSubmit={onSubmit}
            />
          </div>

          <div>
            <SetupLabel htmlFor={`${nameInputId}-topic`} aside="up to 3">Topics</SetupLabel>
            {/* One line, Enter adds. It was a two-row textarea; a topic is a
                sentence, and the list below shows it whole once added. */}
            <div className="flex items-center gap-1.5">
              <input
                id={`${nameInputId}-topic`}
                value={topicInput}
                onChange={(e) => { setTopicInput(e.target.value); if (topicError) setTopicError(''); }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTopic(); } }}
                placeholder={draft.topics.length >= 3 ? 'Three topics is the maximum' : 'Type a topic, then press Enter'}
                disabled={draft.topics.length >= 3}
                className={SETUP_INPUT_CLS}
                style={{ flex: 1 }}
              />
              <button
                type="button"
                onClick={addTopic}
                disabled={draft.topics.length >= 3 || !topicInput.trim()}
                aria-label="Add topic"
                title="Add topic"
                className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-[12px] transition-[background-color,transform,opacity] duration-150 enabled:hover:bg-[#2A5A3C] enabled:active:scale-[0.96] disabled:opacity-35 focus:outline-none focus-visible:shadow-[0_0_0_2px_#1B3828]"
                style={{ backgroundColor: C.forest, color: C.gold }}
              >
                <Plus size={17} strokeWidth={2.6} />
              </button>
            </div>
            {topicError ? (
              <p role="alert" className="mt-1" style={{ color: C.danger, fontFamily: OUTFIT, fontSize: 12 }}>{topicError}</p>
            ) : null}
            {draft.topics.length > 0 && (
              <div className="mt-1.5 flex flex-col gap-1">
                {draft.topics.map((t, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 rounded-[10px] px-2.5 py-1"
                    style={{ backgroundColor: 'rgba(27,56,40,0.05)', fontFamily: OUTFIT, fontSize: 12.5, lineHeight: 1.4, color: C.ink }}
                  >
                    <span aria-hidden className="flex-shrink-0 tabular-nums" style={{ fontWeight: 800, color: C.goldDeep }}>{i + 1}</span>
                    <span className="min-w-0 flex-1 line-clamp-2" style={{ wordBreak: 'break-word' }} title={t}>{t}</span>
                    <button
                      type="button"
                      onClick={() => onChange({ topics: draft.topics.filter((_, j) => j !== i) })}
                      aria-label={`Remove topic ${i + 1}`}
                      title="Remove this topic"
                      className="mt-px flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full transition-[background-color,color,transform] duration-150 hover:bg-[#8B2020]/[0.10] hover:text-[#8B2020] active:scale-[0.96] focus:outline-none focus-visible:shadow-[0_0_0_2px_#1B3828]"
                      style={{ color: C.inkSoft }}
                    >
                      <X size={12} strokeWidth={2.4} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <SetupLabel>Difficulty</SetupLabel>
            {/* Same MUN-level insignia the applications/account pages use to rank
                delegates (beginner chevron → crowned-star expert), for consistency.
                One compact row: insignia beside the word. */}
            <div className="flex gap-1.5">
              {DIFFICULTIES.map((lvl) => {
                const active = draft.difficulty === lvl;
                const accent = LEVEL_ACCENT[lvl] ?? C.inkSoft;
                const lbl = lvl.charAt(0).toUpperCase() + lvl.slice(1);
                return (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => onChange({ difficulty: lvl })}
                    aria-pressed={active}
                    className="flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-[10px] px-1.5 transition-[background-color,box-shadow] duration-150 focus:outline-none focus-visible:shadow-[0_0_0_2px_#1B3828]"
                    style={{
                      height: 34,
                      boxShadow: active ? `inset 0 0 0 1.5px ${accent}` : 'inset 0 0 0 1px rgba(27,56,40,0.12)',
                      backgroundColor: active ? `${accent}14` : 'rgba(27,56,40,0.025)',
                      cursor: 'pointer',
                    }}
                  >
                    <span className="flex flex-shrink-0 items-center justify-center"><LevelInsignia level={lvl} size={14} /></span>
                    <span className="truncate" style={{ fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 700, color: active ? accent : C.inkSoft }}>{lbl}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {showLanguage && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <label htmlFor={`${nameInputId}-language`} className="inline-flex items-center gap-1.5 uppercase" style={{ fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 800, letterSpacing: '0.14em', color: C.inkSoft }}>
                <Languages size={13} strokeWidth={2.2} aria-hidden style={{ color: C.goldDeep }} />
                Language
              </label>
              <div className="min-w-0 flex-1">
                <CommitteeLanguagePicker
                  id={`${nameInputId}-language`}
                  value={draft.workingLanguage ?? null}
                  onChange={(v) => onChange({ workingLanguage: v })}
                />
              </div>
            </div>
          )}

          <div>
            <SetupLabel aside={onUploadEmblem ? 'or upload your own' : undefined}>Emblem</SetupLabel>
            <EmblemPicker
              value={emblem}
              onPick={(logo) => onChange({ logoUrl: logo, emblemManuallySet: true })}
              onUpload={onUploadEmblem}
              onReset={() => onChange({ emblemManuallySet: false })}
              uploading={emblemUploading}
              canReset={draft.emblemManuallySet && !emblemUploading}
              tone={medallionTone(committeeType)}
              monogramText={draft.abbreviation || draft.name}
            />
          </div>
        </div>
      </section>

      {/* ── 2. Seats ───────────────────────────────────────────────────────
          DELEGATES PER SEAT sits on the step heading's own line: it describes
          the list about to be built. */}
      <section
        aria-labelledby={`${nameInputId}-step-seats`}
        className={cols ? 'flex min-h-0 flex-col' : 'mt-4 pt-3.5'}
        style={cols ? undefined : { boxShadow: 'inset 0 1px 0 rgba(27,56,40,0.08)' }}
      >
        <SetupStep
          step={2}
          id={`${nameInputId}-step-seats`}
          title={isCustom ? 'Members' : isCharacterRoster ? 'Characters' : 'Countries'}
          aside={
            <DelegationSizeStepper
              value={draft.doubleDelegation ? 2 : 1}
              onChange={(n) => onChange({ doubleDelegation: n === 2 })}
              noun={seatNoun}
            />
          }
        />
        {/* Add controls only; the chosen list renders right below. */}
        <ConferenceRosterPicker
          mode={mode}
          value={draft.roster}
          onChange={(roster) => onChange({ roster })}
          showSelected={false}
          compact={cols}
        />
        {inline && (
          <ConferenceRosterSelected
            mode={mode}
            value={draft.roster}
            onChange={(roster) => onChange({ roster })}
            committeeType={committeeType}
            groups={draft.groups}
            onGroupsChange={isCustom ? (groups) => onChange({ groups }) : undefined}
            onUploadLogo={onUploadFlag}
            className={cols ? 'mt-2.5 rounded-2xl' : 'mt-3 rounded-2xl'}
            style={{
              ...(cols ? { flex: '1 1 auto', minHeight: 180 } : { maxHeight: 340 }),
              padding: '10px 10px 8px',
              backgroundColor: 'rgba(27,56,40,0.03)',
              boxShadow: 'inset 0 0 0 1px rgba(27,56,40,0.10)',
            }}
          />
        )}
      </section>
    </>
  );
}

// ── What a seat actually draws ───────────────────────────────────────────────
// Its own crest, else its group's crest, else nothing (the session falls back to
// the country flag on its own).
//
// ART IS RESOLVED AT WRITE TIME and copied onto `delegates.logo_url`. It cannot
// be resolved when the session renders: the session client is anonymous, and
// committee_country_slots / conference_committees.groups are not readable by it
// for a private conference, so a seat that inherits its party's crest would
// render nothing on the floor. Whoever holds both does the resolving and stores
// the answer — the committee editor on save, and the creation wizard when it
// writes its slots.
//
// `gs` is passed in rather than read from a draft so the same rule can be run
// against the BASELINE groups to work out what a seat used to show.
export function resolveSeatArt(
  r: { name: string; logoUrl?: string | null; groupId?: string | null },
  gs: SlotGroup[],
  isCustom: boolean,
): string | null {
  const groupId = isCustom && r.groupId && gs.some((g) => g.id === r.groupId) ? r.groupId : null;
  const art = effectiveSlotArt(
    {
      country_code: getCountryByName(r.name)?.code ?? r.name,
      logo_url: r.logoUrl ?? null,
      group_id: groupId,
    },
    gs,
  );
  return art.kind === 'logo' ? art.url : null;
}
