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

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ImagePlus, RotateCcw, Loader2, Lock, X, Users2, Landmark, Scale, Zap, Minus, Plus, ChevronDown, Check, Languages } from 'lucide-react';
import Portal from '@/components/Portal';
import { CircleFlag } from '@/components/CircleFlag';
import { viewBox, useReposition } from '@/lib/visualViewport';
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
  DEFAULT_COMMITTEE_LANGUAGE,
  committeeLanguageFlag,
  isListedCommitteeLanguage,
  normaliseCommitteeLanguage,
} from '@/lib/committeeLanguage';

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
export function CommitteeIdentityPreview({ src, primary, secondary, placeholder, topic, topicLabel, topicEmpty, tone, monogramText, emblemAction }: {
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
  /** Drawn right under the emblem (the committee editor's "Change emblem",
   *  24 Sep 2026, owner: "right below the emblem itself, saving a lot of space"). */
  emblemAction?: ReactNode;
}) {
  const hasName = !!primary;
  const shown = primary || placeholder;
  const medallion = src ? (
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
      );
  return (
    <div className="flex flex-shrink-0 items-center gap-4">
      {emblemAction ? (
        <div className="flex flex-shrink-0 flex-col items-center gap-1.5">
          <span aria-hidden className="flex">{medallion}</span>
          {emblemAction}
        </div>
      ) : (
        <span aria-hidden className="flex flex-shrink-0">{medallion}</span>
      )}

      <div aria-hidden className="min-w-0 flex-1">
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
          onKeyDown={(e) => { if (e.key === 'Enter' && onSubmit) { e.preventDefault(); onSubmit(); } }}
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
      {onUpload && (
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
      )}

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
          <MonogramMedallion text={monogramText || '–'} tone={tone} size={26} />
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
  /** `conference_committees.working_language`: a display name. New drafts start
   *  on English (the column default); null still means "not set". Optional:
   *  the picker shows only where the caller passes `showLanguage`. */
  workingLanguage?: string | null;
}

export function emptyCommitteeSetupDraft(): CommitteeSetupDraft {
  return {
    name: '', abbreviation: '', topics: [], difficulty: 'intermediate',
    roster: [], groups: [], doubleDelegation: false,
    logoUrl: null, emblemManuallySet: false, presetRosterMode: null,
    workingLanguage: DEFAULT_COMMITTEE_LANGUAGE,
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

// ── The set-up fields: step 1 (Committee) and step 2 (the seats) ─────────────
// ── Delegates per seat ───────────────────────────────────────────────────────
// (23 Sep 2026, owner: "I don't like the single/double delegation slider".) A
// stepper that states the answer as a number and a plain sentence: "[−] 2 [+]
// delegates per country". It stores exactly what it always did: the draft's
// `doubleDelegation` boolean, written as delegation_size 1 or 2 (all the
// allocation model supports).
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
        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-white transition-[background-color,color,transform,opacity] duration-150 enabled:hover:bg-[#1B3828] enabled:hover:text-[#EED98A] enabled:active:scale-[0.94] disabled:opacity-35 focus:outline-none focus-visible:shadow-[0_0_0_2px_#1B3828]"
        style={{ color: C.forest, boxShadow: '0 1px 2px rgba(27,56,40,0.14), inset 0 0 0 1px rgba(27,56,40,0.12)' }}
      >
        <Icon size={13} strokeWidth={2.6} />
      </button>
    );
  };
  return (
    <div role="group" aria-label="Delegates per seat" className="inline-flex flex-shrink-0 items-center gap-2.5">
      <span className="inline-flex items-center gap-2 rounded-full p-1" style={{ backgroundColor: '#EFE9DB', boxShadow: 'inset 0 1px 2px rgba(27,56,40,0.10)' }}>
        {btn(-1)}
        <span aria-live="polite" className="tabular-nums" style={{ minWidth: 14, textAlign: 'center', fontFamily: OUTFIT, fontSize: 16, fontWeight: 800, color: C.forest }}>
          {value}
        </span>
        {btn(1)}
      </span>
      <span style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 700, color: C.inkSoft, whiteSpace: 'nowrap' }}>
        {value === 1 ? 'delegate' : 'delegates'} per {noun}
      </span>
    </div>
  );
}

// ── The working language ─────────────────────────────────────────────────────
// (23 Sep 2026, owner: "Language selection by default should be English; use
// flags for it as well.") A listbox, not a native select, because an <option>
// cannot draw a flag: each listed language wears its round flag (CircleFlag,
// `committeeLanguageFlag`), "Other" the Languages glyph and a free-text field.
// The list renders through Portal at fixed coordinates, flipped above near the
// bottom, so the editor's overflow can never clip it (UI RULES).
function LanguageArt({ name, size }: { name: string | null; size: number }) {
  const code = committeeLanguageFlag(name);
  if (code) return <CircleFlag code={code} size={size} decorative />;
  return (
    <span className="flex flex-shrink-0 items-center justify-center rounded-full" style={{ width: size, height: size, backgroundColor: 'rgba(27,56,40,0.08)', color: C.forest }}>
      <Languages size={Math.round(size * 0.58)} strokeWidth={2.1} aria-hidden />
    </span>
  );
}

export function CommitteeLanguagePicker({ value, onChange, id, compact = false }: {
  value: string | null;
  onChange: (next: string | null) => void;
  id?: string;
  /** The committee editor's header: a 36px button, the "Other" field wraps below. */
  compact?: boolean;
}) {
  const listed = isListedCommitteeLanguage(value);
  const [otherOpen, setOtherOpen] = useState<boolean>(!!value && !listed);
  const showOther = otherOpen || (!!value && !listed);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<{ left: number; top: number; width: number; maxH: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const options: { key: string; label: string }[] = [
    ...COMMITTEE_LANGUAGES.map((l) => ({ key: l, label: l })),
    { key: '__other', label: 'Other…' },
  ];
  const current = showOther
    ? options.length - 1
    : Math.max(0, COMMITTEE_LANGUAGES.findIndex((l) => l.toLowerCase() === (value ?? '').trim().toLowerCase()));

  const place = useCallback(() => {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vb = viewBox();
    const want = Math.min(320, options.length * 38 + 12);
    const below = vb.bottom - r.bottom - 8;
    const above = r.top - vb.top - 8;
    const up = below < Math.min(want, 220) && above > below;
    const maxH = Math.max(120, Math.min(want, up ? above : below));
    const width = Math.max(r.width, 200);
    const left = Math.min(Math.max(vb.left + 8, r.left), vb.right - width - 8);
    setPos({ left, width, maxH, top: up ? r.top - 6 - maxH : r.bottom + 6 });
  }, [options.length]);
  useReposition(open, place);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || listRef.current?.contains(t)) return;
      setOpen(false);
    };
    // Escape folds the list only. The editor's own Escape (useModalEscape) is a
    // DOCUMENT capture listener, so this one sits on WINDOW capture, earlier.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
      btnRef.current?.focus();
    };
    document.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  function openList() {
    place();
    setActive(current);
    setOpen(true);
  }
  function choose(i: number) {
    const o = options[i];
    setOpen(false);
    btnRef.current?.focus();
    if (o.key === '__other') { setOtherOpen(true); onChange(listed ? null : value); return; }
    setOtherOpen(false);
    onChange(o.key);
  }

  const shownName = showOther ? (value || 'Other') : (value || DEFAULT_COMMITTEE_LANGUAGE);
  return (
    <div className={`flex min-w-0 items-center gap-2 ${compact ? 'flex-wrap' : ''}`}>
      <button
        ref={btnRef}
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={(e) => {
          if (!open) {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openList(); }
            return;
          }
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(options.length - 1, a + 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
          else if (e.key === 'Home') { e.preventDefault(); setActive(0); }
          else if (e.key === 'End') { e.preventDefault(); setActive(options.length - 1); }
          else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(active); }
          else if (e.key === 'Tab') setOpen(false);
        }}
        className={`inline-flex ${compact ? 'h-9 rounded-[12px] ps-1 pe-2' : 'h-11 rounded-[14px] ps-1.5 pe-2.5'} min-w-0 flex-shrink-0 items-center gap-2 bg-white/80 transition-[box-shadow] duration-150 focus:outline-none focus-visible:shadow-[inset_0_0_0_2px_#1B3828,0_0_0_4px_rgba(27,56,40,0.08)]`}
        style={{ boxShadow: open ? 'inset 0 0 0 2px #1B3828' : 'inset 0 0 0 1px rgba(27,56,40,0.16)', cursor: 'pointer' }}
        title={`Working language: ${shownName}`}
      >
        <LanguageArt name={showOther ? null : shownName} size={compact ? 26 : 30} />
        <span className="min-w-0 truncate" style={{ fontFamily: OUTFIT, fontSize: compact ? 13.5 : 14.5, fontWeight: 700, color: C.forest }}>
          {showOther ? 'Other' : shownName}
        </span>
        <ChevronDown aria-hidden size={15} strokeWidth={2.4} className="ms-auto flex-shrink-0" style={{ color: C.inkSoft, transform: open ? 'rotate(180deg)' : undefined, transition: 'transform 150ms' }} />
      </button>
      {showOther && (
        <input
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value.slice(0, COMMITTEE_LANGUAGE_MAX) || null)}
          onBlur={(e) => onChange(normaliseCommitteeLanguage(e.target.value))}
          maxLength={COMMITTEE_LANGUAGE_MAX}
          placeholder="Which language?"
          aria-label="Working language"
          className={SETUP_INPUT_CLS}
          style={{ flex: 1, minWidth: compact ? 140 : 0 }}
        />
      )}
      {open && pos && (
        <Portal>
          <div
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label="Working language"
            aria-activedescendant={`${listId}-${active}`}
            className="overflow-y-auto overscroll-contain p-1.5 [scrollbar-width:thin]"
            style={{
              position: 'fixed', zIndex: 10000, left: pos.left, top: pos.top, width: pos.width, maxHeight: pos.maxH,
              backgroundColor: C.surface, borderRadius: 14,
              boxShadow: '0 12px 34px rgba(27,56,40,0.18), 0 2px 8px rgba(27,56,40,0.08), inset 0 0 0 1px rgba(27,56,40,0.10)',
              fontFamily: OUTFIT,
            }}
          >
            {options.map((o, i) => {
              const selected = i === current;
              return (
                <div
                  key={o.key}
                  id={`${listId}-${i}`}
                  data-idx={i}
                  role="option"
                  aria-selected={selected}
                  onPointerEnter={() => setActive(i)}
                  onClick={() => choose(i)}
                  className="flex cursor-pointer items-center gap-2.5 rounded-[10px] px-2 py-1.5"
                  style={{ backgroundColor: i === active ? 'rgba(27,56,40,0.07)' : undefined }}
                >
                  <LanguageArt name={o.key === '__other' ? null : o.key} size={24} />
                  <span className="min-w-0 flex-1 truncate" style={{ fontSize: 14, fontWeight: selected ? 800 : 600, color: selected ? C.forest : C.ink }}>{o.label}</span>
                  {selected && <Check size={15} strokeWidth={2.6} style={{ color: C.forest }} aria-hidden />}
                </div>
              );
            })}
          </div>
        </Portal>
      )}
    </div>
  );
}

// ── Difficulty + language, compact (the committee editor's header) ───────────
// (23 Sep 2026, owner: "add the language and difficulty at the top to save
// space".) The same two answers CommitteeSetupFields collects, drawn small
// enough to sit beside the live identity: the four MUN-level insignia as 34px
// discs (the word is the tooltip and the accessible name; the chosen level is
// written beside the label), then the language picker at 36px. Writes exactly
// what the full rows write: `difficulty` and `workingLanguage`.
export function CommitteeMetaControls({ draft, onChange, idPrefix }: {
  draft: CommitteeSetupDraft;
  onChange: (patch: Partial<CommitteeSetupDraft>) => void;
  idPrefix: string;
}) {
  const current = DIFFICULTIES.find((d) => d === draft.difficulty);
  const label = current ? current.charAt(0).toUpperCase() + current.slice(1) : null;
  return (
    <div className="flex flex-shrink-0 flex-col gap-2.5" style={{ width: 196 }}>
      <div>
        <SetupLabel aside={label ?? undefined}>Difficulty</SetupLabel>
        <div role="group" aria-label="Difficulty" className="flex gap-1.5">
          {DIFFICULTIES.map((lvl) => {
            const active = draft.difficulty === lvl;
            const accent = LEVEL_ACCENT[lvl] ?? C.muted;
            const lbl = lvl.charAt(0).toUpperCase() + lvl.slice(1);
            return (
              <button
                key={lvl}
                type="button"
                onClick={() => onChange({ difficulty: lvl })}
                aria-pressed={active}
                aria-label={lbl}
                title={lbl}
                className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-full transition-[background-color,box-shadow,transform] duration-150 active:scale-[0.96] focus:outline-none focus-visible:shadow-[0_0_0_2px_#1B3828]"
                style={{
                  background: active ? `linear-gradient(150deg, ${accent}2E, ${accent}18)` : 'rgba(255,255,255,0.6)',
                  boxShadow: active ? `inset 0 0 0 1.5px ${accent}` : 'inset 0 0 0 1px rgba(27,56,40,0.14)',
                  cursor: 'pointer',
                }}
              >
                <LevelInsignia level={lvl} size={16} />
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <SetupLabel htmlFor={`${idPrefix}-language`}>Language</SetupLabel>
        <CommitteeLanguagePicker
          id={`${idPrefix}-language`}
          compact
          value={draft.workingLanguage ?? null}
          onChange={(v) => onChange({ workingLanguage: v })}
        />
      </div>
    </div>
  );
}

// ── "Change emblem", under the emblem itself ────────────────────────────────
// (24 Sep 2026, owner: "the change emblem should be right below the emblem itself,
// saving a lot of space".) A small pill under the header medallion; pressing it opens
// a panel through Portal (never clipped by the editor's scroller) with the same three
// choices the folded row had: Choose a preset (the EmblemPicker swatches), Upload your
// own, Automatic. Same writes as before.
export function EmblemChangeButton({ value, onPick, onUpload, onReset, uploading, canReset, tone, monogramText }: {
  value: string | null;
  onPick: (logo: string) => void;
  onUpload?: () => void;
  onReset: () => void;
  uploading: boolean;
  canReset: boolean;
  tone: MedallionTone;
  monogramText: string;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number; width: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  const place = useCallback(() => {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vb = viewBox();
    const width = Math.min(360, vb.right - vb.left - 16);
    const left = Math.min(Math.max(vb.left + 8, r.left + r.width / 2 - 28), vb.right - width - 8);
    setPos({ left, width, top: r.bottom + 6 });
  }, []);
  useReposition(open, place);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    // Escape folds the panel only (the editor's own Escape is a document capture listener).
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
      btnRef.current?.focus();
    };
    document.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  const choice = 'inline-flex items-center gap-1.5 rounded-[10px] px-3 py-1.5 transition-[background-color,transform] duration-150 hover:bg-[#1B3828]/[0.06] active:scale-[0.97] focus:outline-none focus-visible:shadow-[0_0_0_2px_#1B3828]';
  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => { if (open) setOpen(false); else { place(); setOpen(true); } }}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 transition-[background-color,transform] duration-150 hover:bg-[#1B3828]/[0.07] active:scale-[0.97] focus:outline-none focus-visible:shadow-[0_0_0_2px_#1B3828]"
        style={{ fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 800, color: C.forest, boxShadow: 'inset 0 0 0 1px rgba(27,56,40,0.16)', backgroundColor: 'rgba(255,255,255,0.6)', whiteSpace: 'nowrap' }}
      >
        {uploading
          ? <Loader2 size={12} strokeWidth={2.4} className="animate-spin" aria-hidden />
          : <ImagePlus size={12} strokeWidth={2.4} aria-hidden />}
        {uploading ? 'Uploading…' : 'Change emblem'}
      </button>
      {open && pos && (
        <Portal>
          <div
            ref={panelRef}
            id={panelId}
            role="dialog"
            aria-label="Change emblem"
            className="fixed rounded-[16px] p-3"
            style={{ left: pos.left, top: pos.top, width: pos.width, zIndex: 1300, backgroundColor: C.surface, boxShadow: SHADOW.card + ', inset 0 0 0 1px rgba(27,56,40,0.10)' }}
          >
            <div className="flex flex-wrap items-center gap-2">
              {onUpload && (
                <button
                  type="button"
                  onClick={() => { if (!uploading) { setOpen(false); onUpload(); } }}
                  disabled={uploading}
                  className={choice}
                  style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 800, color: C.forest, boxShadow: 'inset 0 0 0 1px rgba(27,56,40,0.18)' }}
                >
                  <ImagePlus size={13} strokeWidth={2.3} aria-hidden />
                  Upload your own
                </button>
              )}
              {canReset && (
                <button
                  type="button"
                  onClick={() => { onReset(); setOpen(false); }}
                  title="Go back to the emblem Gavelling picks from the committee name"
                  className={choice}
                  style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 700, color: C.inkSoft }}
                >
                  <RotateCcw size={13} strokeWidth={2.3} aria-hidden />
                  Automatic
                </button>
              )}
            </div>
            <p className="mb-1.5 mt-3 flex items-center gap-1.5" style={{ fontFamily: OUTFIT, fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.inkSoft }}>
              <Landmark size={12} strokeWidth={2.3} aria-hidden />
              Presets
            </p>
            <EmblemPicker
              value={value}
              onPick={(logo) => { onPick(logo); setOpen(false); }}
              onReset={() => { onReset(); setOpen(false); }}
              uploading={uploading}
              canReset={canReset}
              tone={tone}
              monogramText={monogramText}
            />
          </div>
        </Portal>
      )}
    </>
  );
}

export function CommitteeSetupFields({
  draft, onChange, committeeType, isEdit = false,
  nameInputId = 'committee-setup-name',
  onUploadEmblem, emblemUploading = false,
  onUploadFlag, selectedInline = false,
  onSubmit,
  showLanguage = false,
  compactPaste = false,
  seatsElsewhere = false,
  metaElsewhere = false,
  foldEmblem = false,
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
  /** True renders the selected roster directly under the add controls (the
   *  wizard). False leaves it to the caller, which is what the editor's docked
   *  rail does. */
  selectedInline?: boolean;
  /** Enter in the name or acronym field. The wizard saves the draft with it. */
  onSubmit?: () => void;
  /** Offer the working-language picker (beside Difficulty). Only a caller that
   *  SAVES `workingLanguage` may turn it on. */
  showLanguage?: boolean;
  /** Fold the paste box behind a "Paste a list" button (the committee editor,
   *  where the set-up card must fit one screen). */
  compactPaste?: boolean;
  /** The caller renders step 2 itself (CommitteeSeatsStep), elsewhere. */
  seatsElsewhere?: boolean;
  /** The caller renders Difficulty and Language itself (CommitteeMetaControls,
   *  the committee editor's header), so the rows here are left out. */
  metaElsewhere?: boolean;
  /** The emblem is one "Change emblem" row that opens to Presets / Upload. */
  foldEmblem?: boolean;
}) {
  const [topicInput, setTopicInput] = useState('');
  const [topicError, setTopicError] = useState('');
  const isCrisis = committeeType === 'crisis';
  const isCustom = committeeType === 'custom';
  const { suggestion, emblem } = committeeSetupPreview(draft);

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
      <section aria-labelledby={`${nameInputId}-step-committee`} className="mt-3.5 pt-3" style={{ boxShadow: 'inset 0 1px 0 rgba(27,56,40,0.08)' }}>
        <SetupStep step={1} id={`${nameInputId}-step-committee`} title="Committee" />
        <div className="flex flex-col gap-3.5">
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
            <SetupLabel aside="up to 3">Topics</SetupLabel>
            <div className="flex items-start gap-2">
              <textarea
                value={topicInput}
                onChange={(e) => { setTopicInput(e.target.value); if (topicError) setTopicError(''); }}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addTopic(); } }}
                placeholder={draft.topics.length >= 3 ? 'Three topics is the maximum' : 'Type a topic, then press Enter'}
                rows={2}
                disabled={draft.topics.length >= 3}
                className={SETUP_INPUT_CLS}
                style={{ flex: 1, resize: 'vertical', lineHeight: 1.5, minHeight: 52 }}
              />
              <button
                type="button"
                onClick={addTopic}
                disabled={draft.topics.length >= 3 || !topicInput.trim()}
                className="flex-shrink-0 rounded-[14px] px-4 transition-[background-color,transform,opacity] duration-150 enabled:hover:bg-[#2A5A3C] enabled:active:scale-[0.97] disabled:opacity-40 focus:outline-none focus-visible:shadow-[0_0_0_2px_#1B3828]"
                style={{ minHeight: 44, backgroundColor: C.forest, color: C.gold, fontFamily: OUTFIT, fontSize: 13.5, fontWeight: 800, whiteSpace: 'nowrap' }}
              >
                Add topic
              </button>
            </div>
            {topicError ? (
              <p role="alert" className="mt-1.5" style={{ color: C.danger, fontFamily: OUTFIT, fontSize: 12 }}>{topicError}</p>
            ) : null}
            {draft.topics.length > 0 && (
              <div className="mt-2 flex flex-col gap-1.5">
                {draft.topics.map((t, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 rounded-[12px] px-3 py-1.5"
                    style={{ backgroundColor: 'rgba(27,56,40,0.06)', fontFamily: OUTFIT, fontSize: 13, lineHeight: 1.45, color: C.ink }}
                  >
                    <span aria-hidden className="flex-shrink-0 tabular-nums" style={{ fontWeight: 800, color: C.goldDeep }}>{i + 1}</span>
                    <span className="min-w-0 flex-1" style={{ wordBreak: 'break-word' }}>{t}</span>
                    <button
                      type="button"
                      onClick={() => onChange({ topics: draft.topics.filter((_, j) => j !== i) })}
                      aria-label={`Remove topic ${i + 1}`}
                      title="Remove this topic"
                      className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full transition-[background-color,color,transform] duration-150 hover:bg-[#8B2020]/[0.10] hover:text-[#8B2020] active:scale-[0.96] focus:outline-none focus-visible:shadow-[0_0_0_2px_#1B3828]"
                      style={{ color: C.muted }}
                    >
                      <X size={12} strokeWidth={2.4} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {!metaElsewhere && (
          <div className={showLanguage ? 'grid gap-x-3 gap-y-3.5 sm:grid-cols-[minmax(0,1fr)_auto]' : undefined}>
          <div className="min-w-0">
            <SetupLabel>Difficulty</SetupLabel>
            {/* Same MUN-level insignia the applications/account pages use to rank
                delegates (beginner chevron → crowned-star expert), for consistency. */}
            <div className="flex gap-2">
              {DIFFICULTIES.map((lvl) => {
                const active = draft.difficulty === lvl;
                const accent = LEVEL_ACCENT[lvl] ?? C.muted;
                const lbl = lvl.charAt(0).toUpperCase() + lvl.slice(1);
                return (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => onChange({ difficulty: lvl })}
                    aria-pressed={active}
                    className="flex flex-1 flex-col items-center gap-1 rounded-[14px] py-2 transition-[background-color,box-shadow] duration-150 focus:outline-none focus-visible:shadow-[0_0_0_2px_#1B3828]"
                    style={{
                      boxShadow: active ? `inset 0 0 0 1.5px ${accent}` : 'inset 0 0 0 1px rgba(27,56,40,0.14)',
                      backgroundColor: active ? `${accent}14` : 'rgba(255,255,255,0.55)',
                      cursor: 'pointer',
                    }}
                  >
                    <span
                      className="flex items-center justify-center"
                      style={{ width: 26, height: 26, borderRadius: '9999px', background: `linear-gradient(150deg, ${accent}22, ${accent}12)`, border: `1px solid ${accent}55` }}
                    >
                      <LevelInsignia level={lvl} size={16} />
                    </span>
                    <span style={{ fontFamily: OUTFIT, fontSize: 11, fontWeight: 700, color: active ? accent : C.inkSoft, letterSpacing: '0.01em' }}>{lbl}</span>
                  </button>
                );
              })}
            </div>
          </div>
          {showLanguage && (
            <div className="min-w-0 sm:w-[190px]">
              <SetupLabel htmlFor={`${nameInputId}-language`}>Language</SetupLabel>
              <CommitteeLanguagePicker
                id={`${nameInputId}-language`}
                value={draft.workingLanguage ?? null}
                onChange={(v) => onChange({ workingLanguage: v })}
              />
            </div>
          )}
          </div>
          )}

          {/* foldEmblem: the committee editor draws "Change emblem" under the header's
              emblem instead (EmblemChangeButton), so no emblem row here. */}
          {!foldEmblem && <div>
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
          </div>}
        </div>
      </section>

      {!seatsElsewhere && (
        <CommitteeSeatsStep
          draft={draft}
          onChange={onChange}
          committeeType={committeeType}
          nameInputId={nameInputId}
          onUploadFlag={onUploadFlag}
          selectedInline={selectedInline}
          compactPaste={compactPaste}
        />
      )}
    </>
  );
}

// ── Step 2, the seats ────────────────────────────────────────────────────────
// Its own component so the committee editor can put it in the roster card
// OUTSIDE the set-up card (owner, 23 Sep 2026: "one panel should be the set-up,
// the other, outside of it, should be the list of countries"), while the wizard
// keeps it under step 1 through CommitteeSetupFields. `panel` = the editor's
// card: a flex column whose list fills the rest of the card and is the only
// thing that scrolls.
export function CommitteeSeatsStep({
  draft, onChange, committeeType,
  nameInputId = 'committee-setup-name',
  onUploadFlag, selectedInline = false, compactPaste = false,
  panel = false, className, style, part = 'all',
}: {
  draft: CommitteeSetupDraft;
  onChange: (patch: Partial<CommitteeSetupDraft>) => void;
  committeeType: CommitteeType;
  nameInputId?: string;
  onUploadFlag?: (file: File, kind: 'seat' | 'group') => Promise<string | null>;
  selectedInline?: boolean;
  compactPaste?: boolean;
  panel?: boolean;
  className?: string;
  style?: React.CSSProperties;
  /** The committee editor splits step 2 in two (owner, 23 Sep 2026: "the
   *  ENTIRE right side should just be the countries already added"):
   *  'add' = the heading plus search, bundles and paste (the left card);
   *  'list' = only the added seats, with the delegates-per-seat stepper in
   *  the list's own header (the right card). 'all' = both, as before. */
  part?: 'all' | 'add' | 'list';
}) {
  const isCustom = committeeType === 'custom';
  const mode = rosterModeOf(draft, committeeType);
  const isCharacterRoster = mode === 'character';
  const { noun: seatNoun } = seatNounsOf(committeeType, isCharacterRoster);
  const stepper = (
    <DelegationSizeStepper
      value={draft.doubleDelegation ? 2 : 1}
      onChange={(n) => onChange({ doubleDelegation: n === 2 })}
      noun={seatNoun}
    />
  );
  const title = isCustom ? 'Members' : isCharacterRoster ? 'Characters' : 'Countries';

  if (part === 'list') {
    // Only the added seats: the count, the stepper and CLEAR ALL on one header
    // line, then the list, which fills the card and is the only scroller.
    return (
      <section aria-label={`${title} added`} className={`flex min-h-0 flex-col ${className ?? ''}`} style={style}>
        <ConferenceRosterSelected
          mode={mode}
          value={draft.roster}
          onChange={(roster) => onChange({ roster })}
          committeeType={committeeType}
          groups={draft.groups}
          onGroupsChange={isCustom ? (groups) => onChange({ groups }) : undefined}
          onUploadLogo={onUploadFlag}
          variant="panel"
          headerAside={stepper}
          className="min-h-0 flex-1"
        />
      </section>
    );
  }

  // DELEGATES PER SEAT sits on the step heading's own line, which is where it
  // belongs semantically: it describes the list about to be built. In the
  // editor's 'add' half it moves to the list's header instead.
  return (
    <section
      aria-labelledby={`${nameInputId}-step-seats`}
      className={panel ? `flex min-h-0 flex-col ${className ?? ''}` : `mt-4 pt-3.5 ${className ?? ''}`}
      style={panel ? style : { boxShadow: 'inset 0 1px 0 rgba(27,56,40,0.08)', ...style }}
    >
      <SetupStep
        step={2}
        id={`${nameInputId}-step-seats`}
        title={part === 'add' ? `Add ${title.toLowerCase()}` : title}
        aside={part === 'add' ? undefined : stepper}
      />
      {/* The add controls, then (wizard, or the editor's card) the list. */}
      <ConferenceRosterPicker
        mode={mode}
        value={draft.roster}
        onChange={(roster) => onChange({ roster })}
        showSelected={false}
        compact={compactPaste}
      />
      {part === 'all' && (selectedInline || panel) && (
        <ConferenceRosterSelected
          mode={mode}
          value={draft.roster}
          onChange={(roster) => onChange({ roster })}
          committeeType={committeeType}
          groups={draft.groups}
          onGroupsChange={isCustom ? (groups) => onChange({ groups }) : undefined}
          onUploadLogo={onUploadFlag}
          variant={panel ? 'panel' : 'dense'}
          className={panel ? 'mt-3 min-h-0 flex-1' : 'mt-3 rounded-2xl'}
          style={panel ? undefined : {
            maxHeight: 340, padding: '14px 14px 12px',
            backgroundColor: 'rgba(255,255,255,0.55)',
            boxShadow: 'inset 0 0 0 1px rgba(27,56,40,0.12)',
          }}
        />
      )}
    </section>
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
