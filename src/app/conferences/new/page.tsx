'use client';

/**
 * /conferences/new, page-by-page conference creation wizard.
 *
 * One question per screen, built on the shared wizard kit
 * (src/components/wizard.tsx). The submit logic writes exactly the same
 * columns as the old two-step form and redirects to /manage/{slug}.
 * Description, socials and banner are collected in their own skippable steps;
 * the remaining optional fields (visibility, previous editions) are deferred
 * to Settings after creation.
 *
 * Progress lives in component state only, a refresh restarts the wizard.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ArrowRight, Mail, Pencil, Upload, Check, ImagePlus, Camera, ThumbsUp, Music2, MessageCircle, Globe, Plus, X, ClipboardList, CreditCard, Building2, Megaphone, Trash2, type LucideIcon } from 'lucide-react';
import SiteNav from '@/components/SiteNav';
import Loader from '@/components/Loader';
import { useAuth } from '@/components/AuthProvider';
import { createClient } from '@supabase/supabase-js';
import { conferenceSlugAttempts, conferenceYear, isSlugTakenError } from '@/lib/conferenceSlug';
import { UN_COUNTRIES } from '@/lib/countries';
import { FlagImg } from '@/components/FlagImg';
import { WizardShell, TwoTabPick, CardSelect } from '@/components/wizard';
import { NEU, NEU_GRADIENTS, OUTFIT, EASE, NeuButton, NeuInset, Emoji3D } from '@/components/neu';
import { DatePicker } from '@/components/DatePicker';
import { LogoCropModal } from '@/components/LogoCropModal';
import { uploadConferenceAsset } from '@/lib/conferenceAssets';
import { CurrencyPicker } from '@/components/CurrencyPicker';
import { normalizeSocialUrl } from '@/lib/socialLinks';
import { acronymProblem } from '@/lib/conferenceLabels';
import { committeeDisplayName, deriveCommitteeAcronym, matchPresetEmblem } from '@/lib/presetNames';
import { INTENT_OPTIONS, intentPayload } from '@/lib/conferenceIntent';
// Pure presentation from the committee editor (the medallion fallback and the
// canonical type labels) and the account pages' rank insignia, so a committee
// card here draws exactly what /manage/[slug]/committees draws. Nothing
// imported from these touches the database.
import {
  MonogramMedallion, medallionTone, COMMITTEE_TYPE_LABEL, type CommitteeType,
} from '@/components/CommitteeEditorModal';
import { LevelInsignia, LEVEL_ACCENT } from '@/app/account/accountUi';


// Mirrors settings' ensureRoleConfigs default set (source of truth there) —
// seeded here too so a freshly created conference already has per-role fee
// configs instead of relying on that lazy $0-delegate-fee fallback.
const ROLE_DEFAULTS = ['delegate', 'chair', 'head-delegate', 'faculty-advisor', 'observer'] as const;

// ── Step model ─────────────────────────────────────────────────────────────

const TOTAL_STEPS = 13;
const REVIEW_STEP = TOTAL_STEPS;
// 1 name+acronym · 2 format · 3 level · 4 where · 5 when · 6 delegates (REQUIRED)
// · 7 committees (REQUIRED) · 8 fee · 9 logo (skippable) · 10 banner (skippable)
// · 11 description + socials (skippable) · 12 what they will use Gavelling for
// (REQUIRED) · 13 review. Every skippable step's "Do this later" leaves it
// exactly as editable from Settings afterwards as it already was.
//
// WHY COMMITTEES SIT AT 7. A conference with no committees cannot receive a
// meaningful application, and the wizard used to let organisers leave without
// one: 76 of 169 conferences never added a single committee, and the setup
// checklist's committee item is the first and biggest funnel cliff (169 → 83).
// So the step is REQUIRED. It goes here, straight after the head count, because
// "how many delegates" and "which rooms do they sit in" are one thought, and
// because everything from 9 to 11 is presentation and skippable: a mandatory
// step must not land AFTER a run of skippable ones, where the organiser has
// already built up "skip everything" momentum. Seats and countries are
// deliberately NOT asked here — they belong to the full editor at
// /manage/[slug]/committees, and the step says so.

// STEP 12, "What will you use Gavelling for?", is asked BEFORE the insert and
// is REQUIRED.
//
// It used to be a bonus screen shown after the row was already real, recorded
// by a follow-up UPDATE that raced a timeout. Now the answer travels inside the
// insert itself (`intent: intentPayload(intentKeys)`), so there is no second
// write to fail, nothing to time out, and no way to reach the dashboard with an
// unanswered `intent`. It sits last before the review because it is the one
// question about the organiser rather than about the conference. That does put
// it after the three skippable steps, which the note above warns against — but
// that warning is about a step an organiser can walk PAST. This one has no skip
// link and a disabled Continue, so there is no momentum to carry them over it.

// Lucide stand-in per intent option, handed to Emoji3D so a card can never be
// left with an empty icon well when a Fluent asset does not resolve. The case
// that prompted it is fixed (INTENT_OPTIONS asked for "Globe showing
// Europe-Africa"; the asset folder is lower case), but the Fluent names are
// hand-written strings with no compile-time check, so the net stays.
const INTENT_FALLBACK_ICONS: Record<string, LucideIcon> = {
  applications: ClipboardList,
  payments: CreditCard,
  committees: Building2,
  emails: Mail,
  chairs: Globe,
  marketing: Megaphone,
};

// Bundled banner artwork, mirrors settings' BANNER_PRESETS so the organiser
// can set a banner during creation exactly as they would afterwards.
const BANNER_PRESETS = [
  '/banners/preset-1.jpg',
  '/banners/preset-2.jpg',
  '/banners/preset-3.jpg',
  '/banners/preset-4.jpg',
  '/banners/preset-5.jpg',
];

// Fluent 3D emoji picked to read small→large at a glance: one silhouette →
// two silhouettes → a huddle of people → a packed stadium for the flagship
// tier (all four asset paths verified to resolve; Emoji3D falls back to a
// lucide glyph if a CDN image ever 404s).
const DELEGATE_RANGES = [
  { key: '50', label: 'Up to 50', sub: 'Intimate', emoji: 'Bust in silhouette' },
  { key: '100', label: '~100', sub: 'Mid-size', emoji: 'Busts in silhouette' },
  { key: '250', label: '~250', sub: 'Large', emoji: 'People hugging' },
  { key: '500', label: '500+', sub: 'Flagship', emoji: 'Stadium' },
];

// One-tap committees for step 7. Only the full NAME is declared: the acronym
// comes from deriveCommitteeAcronym (the shared whole-name table — DISEC,
// SOCHUM, ECOSOC are exactly the cases a naive initialism gets wrong) and the
// emblem from matchPresetEmblem, the same resolver the full committee editor
// auto-assigns with. Nothing is duplicated here, so a preset that gains a
// better acronym or emblem upstream gains it here too.
const QUICK_COMMITTEES: { name: string; type: CommitteeType }[] = [
  { name: 'UN Security Council', type: 'specialised' },
  { name: 'UN General Assembly', type: 'general-assembly' },
  { name: 'Disarmament and International Security Committee', type: 'general-assembly' },
  { name: 'Social, Humanitarian and Cultural Committee', type: 'general-assembly' },
  { name: 'Economic and Social Council', type: 'specialised' },
  { name: 'UN Human Rights Council', type: 'specialised' },
  { name: 'World Health Organization', type: 'specialised' },
  { name: 'Crisis Committee', type: 'crisis' },
];

const DIFFICULTIES = ['beginner', 'intermediate', 'advanced', 'expert'] as const;
type Difficulty = (typeof DIFFICULTIES)[number];

// Declared in the order the full committee editor offers them, rather than read
// off COMMITTEE_TYPE_LABEL's key order, so the pills cannot silently reshuffle.
const COMMITTEE_TYPES: CommitteeType[] = ['general-assembly', 'specialised', 'crisis', 'custom'];

/** A committee as collected by the wizard: the four things the organiser's own
 *  committees page shows on a card, and nothing else. Countries, seats, topics
 *  and chairs are the full editor's job at /manage/[slug]/committees.
 *
 *  EVERY field here is persisted by handleCreate's conference_committees
 *  insert. If you add one, add it there too. */
interface DraftCommittee {
  /** Local list key only. The DB mints the real id. */
  key: string;
  name: string;
  /** '' when the organiser gave none and none could be derived. */
  abbreviation: string;
  /** conference_committees.committee_type. */
  type: CommitteeType;
  /** conference_committees.difficulty. */
  difficulty: Difficulty;
}

/** Case/space-insensitive identity, so "unsc " and "UNSC" are one committee. */
function committeeKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

function makeDraftCommittee(
  name: string,
  abbreviation?: string,
  type: CommitteeType = 'general-assembly',
  difficulty: Difficulty = 'intermediate',
): DraftCommittee {
  const trimmed = name.trim();
  return {
    key: crypto.randomUUID(),
    name: trimmed,
    abbreviation: (abbreviation ?? '').trim() || deriveCommitteeAcronym(trimmed),
    type,
    difficulty,
  };
}

// ── Small shared bits ──────────────────────────────────────────────────────

const bigInputStyle: React.CSSProperties = {
  width: '100%',
  backgroundColor: NEU.base,
  border: '1.5px solid transparent',
  borderRadius: 16,
  padding: '15px 18px',
  fontSize: 16,
  fontWeight: 600,
  color: NEU.ink,
  fontFamily: OUTFIT,
  outline: 'none',
  boxShadow: NEU.inSm,
  transition: `border-color 180ms ${EASE}`,
};

function focusForest(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) {
  e.currentTarget.style.borderColor = NEU.forest;
}
function blurClear(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) {
  e.currentTarget.style.borderColor = 'transparent';
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontFamily: OUTFIT, fontSize: 11, fontWeight: 800, letterSpacing: '0.12em',
        color: NEU.muted, textTransform: 'uppercase', marginBottom: 8,
      }}
    >
      {children}
    </p>
  );
}

function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="flex items-center gap-1.5"
      style={{ color: NEU.amber, fontFamily: OUTFIT, fontSize: 13, fontWeight: 600, marginTop: 8 }}
    >
      <AlertTriangle size={14} />
      {children}
    </p>
  );
}

/** Subtle third choice under a TwoTabPick (hybrid / both). */
function TertiaryPick({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="focus:outline-none"
      style={{
        marginTop: 14,
        padding: '9px 20px',
        borderRadius: 999,
        border: selected ? `2px solid ${NEU.forest}` : '2px solid rgba(27,56,40,0.14)',
        backgroundColor: selected ? NEU.surface : 'transparent',
        boxShadow: selected ? NEU.outSm : 'none',
        color: selected ? NEU.forest : NEU.muted,
        fontFamily: OUTFIT, fontSize: 13, fontWeight: 700,
        cursor: 'pointer',
        transition: `all 220ms ${EASE}`,
      }}
    >
      {label}
    </button>
  );
}

/** Muted text button for skippable steps. */
function SkipLink({ label, onClick }: { label: string; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="focus:outline-none"
      style={{
        background: 'none', border: 'none', cursor: 'pointer',
        fontFamily: OUTFIT, fontSize: 13, fontWeight: 700,
        color: hovered ? NEU.forest : NEU.muted,
        textDecoration: 'underline', textDecorationColor: 'rgba(154,138,120,0.5)',
        textUnderlineOffset: 3, transition: `color 200ms ${EASE}`,
      }}
    >
      {label}
    </button>
  );
}

/** The committee's picture, exactly what /manage/[slug]/committees draws: the
 *  emblem matchPresetEmblem resolves from the name, and the gradient monogram
 *  medallion when there is none. */
function CommitteeEmblem({ committee, size }: { committee: DraftCommittee; size: number }) {
  const emblem = matchPresetEmblem(committee.name, committee.abbreviation);
  if (emblem) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={emblem}
        alt=""
        style={{
          width: size, height: size, objectFit: 'contain', flexShrink: 0,
          filter: 'drop-shadow(0 6px 12px color-mix(in srgb, var(--gv-main) 24%, transparent))',
        }}
      />
    );
  }
  return (
    <MonogramMedallion
      text={committee.abbreviation || committee.name}
      tone={medallionTone(committee.type)}
      size={size}
    />
  );
}

/** The rank insignia with its level named underneath, the corner stamp from the
 *  organiser's committee card. */
function DifficultyStamp({ level }: { level: Difficulty }) {
  const accent = LEVEL_ACCENT[level] ?? NEU.muted;
  return (
    <span className="inline-flex flex-col items-center flex-shrink-0" style={{ gap: 4 }}>
      <span
        className="inline-flex items-center justify-center flex-shrink-0"
        style={{
          width: 30, height: 30, borderRadius: 9999,
          background: `linear-gradient(150deg, ${accent}26, ${accent}12)`,
          border: `1px solid ${accent}55`,
        }}
      >
        <LevelInsignia level={level} size={21} />
      </span>
      <span style={{ fontFamily: OUTFIT, fontSize: 11, fontWeight: 700, color: NEU.ink, lineHeight: '13px' }}>
        {level.charAt(0).toUpperCase() + level.slice(1)}
      </span>
    </span>
  );
}

/** One committee on the wizard's list (step 7), drawn as the card an organiser
 *  will see on /manage/[slug]/committees once the conference exists: difficulty
 *  stamp in the corner, emblem, acronym eyebrow, full name, type. Edit and
 *  remove sit in the footer. */
function DraftCommitteeCard({
  committee, onEdit, onRemove,
}: { committee: DraftCommittee; onEdit: () => void; onRemove: () => void }) {
  const [hovered, setHovered] = useState(false);
  const [removeHover, setRemoveHover] = useState(false);
  const [editHover, setEditHover] = useState(false);
  return (
    <article
      className="flex flex-col"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        backgroundColor: NEU.surface,
        borderRadius: 22,
        boxShadow: hovered ? NEU.outHover : NEU.out,
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        transition: `transform 300ms ${EASE}, box-shadow 300ms ${EASE}`,
      }}
    >
      <div className="flex flex-col items-center px-3.5 pt-2 flex-1">
        <div className="w-full flex justify-end" style={{ minHeight: 47 }}>
          <DifficultyStamp level={committee.difficulty} />
        </div>

        <CommitteeEmblem committee={committee} size={56} />

        {/* Acronym eyebrow. #7A5A10, the manage layout's own gold ink: the
            brighter #B6871F fails contrast at this size. */}
        {committee.abbreviation && (
          <p
            style={{
              margin: '9px 0 0 0', fontFamily: OUTFIT, fontSize: 9.5, fontWeight: 700,
              letterSpacing: '0.18em', color: '#7A5A10', fontVariantNumeric: 'tabular-nums',
            }}
          >
            {committee.abbreviation.toUpperCase()}
          </p>
        )}

        {/* `balance` so a two-line name breaks evenly instead of leaving an orphan. */}
        <h3
          className="text-center font-bold"
          style={{
            color: NEU.ink, fontFamily: OUTFIT, fontSize: 13, lineHeight: 1.35,
            margin: committee.abbreviation ? '3px 0 0 0' : '10px 0 0 0',
            minHeight: '2.4em', textWrap: 'balance',
          }}
        >
          {committee.name}
        </h3>

        <span
          style={{
            marginTop: 4, fontFamily: OUTFIT, fontSize: 11, fontWeight: 600, color: NEU.inkSoft,
          }}
        >
          {COMMITTEE_TYPE_LABEL[committee.type] ?? committee.type}
        </span>
      </div>

      <div className="flex items-center justify-center gap-2" style={{ padding: '12px 12px 14px' }}>
        <button
          type="button"
          onClick={onEdit}
          onMouseEnter={() => setEditHover(true)}
          onMouseLeave={() => setEditHover(false)}
          className="flex items-center gap-1.5 focus:outline-none"
          style={{
            padding: '7px 14px', borderRadius: 9999, border: 'none',
            backgroundColor: NEU.base,
            boxShadow: editHover ? NEU.outSmHover : NEU.outSm,
            color: NEU.forest, fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 800,
            letterSpacing: '0.08em', cursor: 'pointer',
            transition: `box-shadow 200ms ${EASE}`,
          }}
        >
          <Pencil size={12} strokeWidth={2.6} />
          EDIT
        </button>
        <button
          type="button"
          onClick={onRemove}
          onMouseEnter={() => setRemoveHover(true)}
          onMouseLeave={() => setRemoveHover(false)}
          aria-label={`Remove ${committee.name}`}
          className="flex items-center justify-center focus:outline-none"
          style={{
            width: 32, height: 32, borderRadius: 9999, border: 'none',
            backgroundColor: NEU.base,
            boxShadow: removeHover ? NEU.outSmHover : NEU.outSm,
            color: '#8B2020', cursor: 'pointer',
            transition: `box-shadow 200ms ${EASE}`,
          }}
        >
          <Trash2 size={14} strokeWidth={2.4} />
        </button>
      </div>
    </article>
  );
}

/** The wizard's stand-in for CommitteeEditorModal.
 *
 *  It CANNOT be that modal: at this point in the wizard there is no conference
 *  row, and every save path in the real editor writes to the database. So this
 *  collects the same four card-facing fields into local state and hands them
 *  back; handleCreate writes them with the conference_committees insert.
 *
 *  Inline rather than a modal on purpose — a dialog over a wizard step is one
 *  layer too many, and an inline panel can never be clipped. */
function CommitteeEditor({
  draft, isEdit, onChange, onSave, onCancel, error,
}: {
  draft: DraftCommittee;
  /** Editing a committee already on the list, rather than adding a new one. */
  isEdit: boolean;
  onChange: (next: DraftCommittee) => void;
  onSave: () => void;
  onCancel: () => void;
  error: string;
}) {
  return (
    <NeuInset style={{ padding: '18px 20px', borderRadius: 20 }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
        <p style={{ fontFamily: OUTFIT, fontSize: 14.5, fontWeight: 800, color: NEU.ink }}>
          {isEdit ? 'Edit committee' : 'New committee'}
        </p>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Close the committee editor"
          className="focus:outline-none"
          style={{ background: 'none', border: 'none', color: NEU.muted, cursor: 'pointer' }}
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 min-w-0">
              <FieldLabel>Committee name</FieldLabel>
              <input
                type="text"
                value={draft.name}
                autoFocus
                onChange={(e) => onChange({ ...draft, name: e.target.value })}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onSave(); } }}
                placeholder="e.g. UN Human Rights Council"
                style={{ ...bigInputStyle, backgroundColor: NEU.surface, boxShadow: NEU.outSm }}
                onFocus={focusForest}
                onBlur={blurClear}
              />
            </div>
            <div style={{ width: 120, flexShrink: 0 }}>
              <FieldLabel>Short name</FieldLabel>
              <input
                type="text"
                value={draft.abbreviation}
                onChange={(e) => onChange({ ...draft, abbreviation: e.target.value })}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onSave(); } }}
                aria-label="Committee short name"
                placeholder="UNHRC"
                style={{ ...bigInputStyle, backgroundColor: NEU.surface, boxShadow: NEU.outSm, letterSpacing: '0.06em' }}
                onFocus={focusForest}
                onBlur={blurClear}
              />
            </div>
          </div>

          <div>
            <FieldLabel>Type</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {COMMITTEE_TYPES.map((t) => {
                const active = draft.type === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => onChange({ ...draft, type: t })}
                    aria-pressed={active}
                    className="focus:outline-none"
                    style={{
                      padding: '8px 14px', borderRadius: 9999,
                      border: active ? `1.5px solid ${NEU.forest}` : '1.5px solid rgba(27,56,40,0.14)',
                      backgroundColor: active ? NEU.surface : 'transparent',
                      boxShadow: active ? NEU.outSm : 'none',
                      color: active ? NEU.forest : NEU.inkSoft,
                      fontFamily: OUTFIT, fontSize: 12, fontWeight: 700,
                      cursor: 'pointer',
                      transition: `box-shadow 200ms ${EASE}, color 200ms ${EASE}, border-color 200ms ${EASE}`,
                    }}
                  >
                    {COMMITTEE_TYPE_LABEL[t]}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <FieldLabel>Difficulty</FieldLabel>
            {/* The same MUN-level insignia the committee editor and the account
                pages rank with, so the level means one thing everywhere. */}
            <div className="flex gap-2">
              {DIFFICULTIES.map((lvl) => {
                const active = draft.difficulty === lvl;
                const accent = LEVEL_ACCENT[lvl] ?? NEU.muted;
                return (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => onChange({ ...draft, difficulty: lvl })}
                    aria-pressed={active}
                    className="flex-1 flex flex-col items-center gap-1 focus:outline-none"
                    style={{
                      padding: '9px 4px', borderRadius: 14,
                      border: active ? `1.5px solid ${accent}` : '1.5px solid rgba(27,56,40,0.12)',
                      backgroundColor: active ? `${accent}14` : 'transparent',
                      cursor: 'pointer',
                      transition: `background-color 200ms ${EASE}, border-color 200ms ${EASE}`,
                    }}
                  >
                    <span
                      className="flex items-center justify-center"
                      style={{
                        width: 26, height: 26, borderRadius: 9999,
                        background: `linear-gradient(150deg, ${accent}22, ${accent}12)`,
                        border: `1px solid ${accent}55`,
                      }}
                    >
                      <LevelInsignia level={lvl} size={16} />
                    </span>
                    <span style={{ fontFamily: OUTFIT, fontSize: 11, fontWeight: 700, color: active ? accent : NEU.inkSoft }}>
                      {lvl.charAt(0).toUpperCase() + lvl.slice(1)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Live emblem preview, the same one the card and the full editor show. */}
        <div className="hidden sm:flex flex-col items-center gap-2" style={{ width: 96, flexShrink: 0 }}>
          <FieldLabel>Emblem</FieldLabel>
          <CommitteeEmblem committee={draft} size={64} />
          <span style={{ fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 600, color: NEU.inkSoft, textAlign: 'center', lineHeight: 1.35 }}>
            Picked from the name
          </span>
        </div>
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}

      <div className="flex items-center justify-end gap-3" style={{ marginTop: 16 }}>
        <SkipLink label="Cancel" onClick={onCancel} />
        <NeuButton
          onClick={onSave}
          disabled={!draft.name.trim()}
          icon={Check}
          style={{ padding: '11px 22px', fontSize: 12.5 }}
        >
          {isEdit ? 'SAVE' : 'ADD COMMITTEE'}
        </NeuButton>
      </div>
    </NeuInset>
  );
}

/** A single labelled social-link input with a leading lucide brand glyph. */
function SocialInput({
  Icon, label, value, onChange, placeholder,
}: { Icon: LucideIcon; label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  const [focused, setFocused] = useState(false);
  return (
    <div className="relative flex items-center">
      <span className="absolute left-3.5 pointer-events-none" style={{ color: focused ? NEU.forest : NEU.muted, transition: `color 180ms ${EASE}` }}>
        <Icon size={17} strokeWidth={2.2} />
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={(e) => { setFocused(true); focusForest(e); }}
        onBlur={(e) => { setFocused(false); blurClear(e); }}
        aria-label={label}
        placeholder={placeholder}
        style={{ ...bigInputStyle, paddingLeft: 42, fontSize: 14, backgroundColor: NEU.surface, boxShadow: NEU.inSm }}
      />
    </div>
  );
}

/** A banner preset rendered as a big enlarging picture card (matches the
 *  wizard-kit CardSelect lift: hover grows the card, blooms a gold-tinted
 *  glow, and frosts the rim). Selected keeps a forest border + gold check. */
function BannerPreset({ src, selected, onClick }: { src: string; selected: boolean; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label="Use this banner preset"
      aria-pressed={selected}
      className="focus:outline-none"
      style={{
        position: 'relative', height: 78, borderRadius: 16, overflow: 'hidden',
        border: selected
          ? `2px solid ${NEU.forest}`
          : hovered
            ? '2px solid rgba(255,255,255,0.8)'
            : '2px solid rgba(27,56,40,0.10)',
        backgroundImage: `url(${src})`, backgroundSize: 'cover', backgroundPosition: 'center',
        boxShadow: hovered
          ? '-5px -6px 16px rgba(255,255,255,0.85), 9px 15px 34px rgba(27,56,40,0.20), 0 9px 28px rgba(182,135,31,0.22)'
          : selected
            ? NEU.outSm
            : '-3px -3px 8px rgba(255,255,255,0.5), 5px 8px 16px rgba(27,56,40,0.12)',
        transform: hovered
          ? 'translateY(-5px) scale(1.05)'
          : selected
            ? 'translateY(-1px) scale(1.01)'
            : 'translateY(0) scale(1)',
        transformOrigin: 'center', willChange: 'transform', cursor: 'pointer',
        transition: `transform 300ms ${EASE}, box-shadow 300ms ${EASE}, border-color 300ms ${EASE}`,
      }}
    >
      {selected && (
        <span
          className="absolute flex items-center justify-center"
          style={{
            top: 5, right: 5, width: 20, height: 20, borderRadius: 999,
            background: `linear-gradient(135deg, ${NEU.gold}, ${NEU.deepGold})`,
            boxShadow: `0 2px 7px ${NEU.deepGold}66`,
          }}
        >
          <Check size={12} strokeWidth={3.2} style={{ color: NEU.forest }} />
        </span>
      )}
    </button>
  );
}

function ContinueButton({ label = 'Continue', disabled, onClick }: { label?: string; disabled?: boolean; onClick: () => void }) {
  return (
    <div className="flex justify-center" style={{ marginTop: 26 }}>
      <NeuButton onClick={onClick} disabled={disabled} icon={ArrowRight} style={{ padding: '13px 34px', fontSize: 14 }}>
        {label}
      </NeuButton>
    </div>
  );
}

// ── Acronym suggestion ─────────────────────────────────────────────────────

const STOP_WORDS = new Set(['the', 'of', 'and', 'for', 'a', 'an', 'in', 'on', 'at']);

function suggestAcronym(fullName: string): string {
  const initials = fullName
    .split(/[\s-]+/)
    .filter((w) => w && !STOP_WORDS.has(w.toLowerCase()))
    // The first LETTER OR DIGIT of the word, not its first character.
    // "Model UN (Bangalore)" used to suggest "MU(", which fails
    // ACRONYM_ALLOWED and disabled Continue with a red error under a field the
    // organiser had never touched. A word with nothing usable in it drops out.
    .map((w) => w.match(/[\p{L}\p{N}]/u)?.[0].toUpperCase() ?? '')
    .join('');
  // Never suggest a value the organiser would then have to repair. Anything
  // acronymProblem() rejects (under 2 characters, over 40) becomes an empty
  // field, which reads as "please fill this in" and never as an error.
  if (acronymProblem(initials)) return '';
  // Conferences do NOT need 'MUN' in their acronym. Only suggest a …MUN acronym
  // when the full name actually ends with "Model United Nations" (or a variant:
  // "Model UN" / "MUN") — those already yield …MUN from the initials anyway.
  // Otherwise the acronym is just the organizer's plain initials.
  return initials;
}


// ── Main page ──────────────────────────────────────────────────────────────

export default function NewConferencePage() {
  const router = useRouter();
  const { user, session, profile, loading } = useAuth();

  function getAuthedClient() {
    return createClient(
      'https://luruhkwrgisytejswlas.supabase.co',
      'sb_publishable_k7NdduzaXK358z8ew18ZKA_vBSieDlV',
      session ? { global: { headers: { Authorization: 'Bearer ' + session.access_token } } } : {}
    );
  }

  // Auth gate, unchanged from the old form.
  useEffect(() => {
    if (!loading && !user) {
      router.replace('/auth/signin?next=/conferences/new');
    }
  }, [loading, user, router]);

  const [step, setStep] = useState(1);
  const [returnToReview, setReturnToReview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [stepError, setStepError] = useState('');

  // Answers
  const [fullName, setFullName] = useState('');
  const [acronym, setAcronym] = useState('');
  const acronymTouched = useRef(false);
  const [contactEmail, setContactEmail] = useState('');
  const [format, setFormat] = useState<'in-person' | 'online' | 'hybrid' | ''>('');
  const [studentLevel, setStudentLevel] = useState<'school' | 'university' | 'both' | ''>('');
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  // Dates "to be decided": the conference can be created and take applications
  // before dates are fixed. A TBD conference stays private until dates are set.
  const [datesTbd, setDatesTbd] = useState(false);
  const [delegateRange, setDelegateRange] = useState('');
  const [expectedDelegates, setExpectedDelegates] = useState('');
  // Committees (step 7). At least one is REQUIRED to create — see the step
  // model note at the top of this file. Written to conference_committees by
  // handleCreate, right after the conferences row.
  //
  // `editing` is the open inline editor: a draft plus the key it will replace
  // (null key = a new committee). Everything the editor collects is a field of
  // DraftCommittee, so nothing typed here can be dropped on the way to the
  // insert.
  const [committees, setCommittees] = useState<DraftCommittee[]>([]);
  const [editing, setEditing] = useState<{ draft: DraftCommittee; replacing: string | null } | null>(null);
  const [editorError, setEditorError] = useState('');
  const [feeKind, setFeeKind] = useState<'free' | 'paid' | ''>('');
  const [feeAmount, setFeeAmount] = useState('');
  const [feeCurrency, setFeeCurrency] = useState('GBP');

  // Logo (mandatory) + banner (skippable). Assets upload to storage during
  // their step under a client-minted conference id, reused verbatim by the
  // insert below so logo_url / banner_url land on the created row.
  const conferenceIdRef = useRef<string>('');
  if (!conferenceIdRef.current) conferenceIdRef.current = crypto.randomUUID();
  // Set only when a creation got as far as a real conferences row that could
  // NOT be rolled back (see handleCreate). A retry then skips straight to the
  // committee insert instead of minting a second conference.
  const createdSlugRef = useRef<string>('');
  const [logoUrl, setLogoUrl] = useState('');
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState('');
  const [logoCropFile, setLogoCropFile] = useState<File | null>(null);
  const [bannerUrl, setBannerUrl] = useState('');
  const [bannerUploading, setBannerUploading] = useState(false);
  const [bannerError, setBannerError] = useState('');
  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  // What they came here to do (step 12). Required, and written as part of the
  // conferences insert — there is no second write and nothing to fail.
  const [intentKeys, setIntentKeys] = useState<string[]>([]);

  // Description + social links (all skippable). Stored raw here; each social
  // value is passed through normalizeSocialUrl at insert time so bare handles
  // ("@mymun") and domains ("mymun.org") become valid absolute URLs.
  const [description, setDescription] = useState('');
  const [instagram, setInstagram] = useState('');
  const [facebook, setFacebook] = useState('');
  const [tiktok, setTiktok] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [website, setWebsite] = useState('');

  // Pre-fill email from profile (same behaviour as the old form).
  useEffect(() => {
    if (profile?.email && !contactEmail) setContactEmail(profile.email);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.email]);

  const acronymError = acronym ? acronymProblem(acronym) : '';

  // Local "today" (YYYY-MM-DD), start date can't be before it.
  const todayISO = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const countryOptions = useMemo(
    () =>
      UN_COUNTRIES.map((c) => ({
        key: c.name,
        label: c.name,
        icon: <FlagImg code={c.code} size={42} />,
      })),
    [],
  );

  // ── Committees (step 7) ──────────────────────────────────────────────────
  // Identity is the NAME, so a one-tap preset and the same name typed by hand
  // are the same committee and can never be added twice.
  const committeeKeys = useMemo(
    () => new Set(committees.map((c) => committeeKey(c.name))),
    [committees],
  );

  function removeCommittee(key: string) {
    setCommittees((prev) => prev.filter((c) => c.key !== key));
    setStepError('');
    // Removing the committee whose editor is open would leave that editor
    // pointing at a row that no longer exists, and saving it would resurrect it.
    setEditing((cur) => (cur?.replacing === key ? null : cur));
  }

  /** One-tap preset: adds it with the type the preset actually is, or takes it
   *  back off if it is already on the list. */
  function toggleQuickCommittee(name: string, type: CommitteeType) {
    const k = committeeKey(name);
    if (committeeKeys.has(k)) {
      setCommittees((prev) => prev.filter((c) => committeeKey(c.name) !== k));
      setStepError('');
      return;
    }
    setCommittees((prev) => [...prev, makeDraftCommittee(name, undefined, type)]);
    setStepError('');
  }

  function openNewCommittee() {
    setEditorError('');
    setStepError('');
    setEditing({ draft: makeDraftCommittee(''), replacing: null });
  }

  function openEditCommittee(c: DraftCommittee) {
    setEditorError('');
    setStepError('');
    setEditing({ draft: { ...c }, replacing: c.key });
  }

  /**
   * Commits the open editor. Returns false when it refused, so Continue can
   * stop rather than silently throwing away what is on screen.
   *
   * The acronym is only derived when the organiser left the field empty, so a
   * short name they typed is never overwritten.
   */
  function saveEditingCommittee(): boolean {
    if (!editing) return true;
    const name = editing.draft.name.trim();
    if (!name) { setEditorError('Give the committee a name.'); return false; }
    const clash = committees.some(
      (c) => committeeKey(c.name) === committeeKey(name) && c.key !== editing.replacing,
    );
    if (clash) { setEditorError(`${name} is already on your list.`); return false; }
    const saved: DraftCommittee = {
      ...editing.draft,
      name,
      abbreviation: editing.draft.abbreviation.trim() || deriveCommitteeAcronym(name),
    };
    setCommittees((prev) =>
      editing.replacing
        ? prev.map((c) => (c.key === editing.replacing ? saved : c))
        : [...prev, saved],
    );
    setEditing(null);
    setEditorError('');
    setStepError('');
    return true;
  }

  function goTo(next: number) {
    setStepError('');
    setStep(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function advance(from: number) {
    if (returnToReview) {
      setReturnToReview(false);
      goTo(REVIEW_STEP);
    } else {
      goTo(from + 1);
    }
  }

  function editFromReview(target: number) {
    setReturnToReview(true);
    goTo(target);
  }

  function back() {
    if (returnToReview) {
      setReturnToReview(false);
      goTo(REVIEW_STEP);
    } else if (step > 1) {
      goTo(step - 1);
    }
  }

  // ── Logo + banner uploads (same recipe as Settings) ──────────────────────
  async function handleLogoUpload(file: File) {
    if (!session) { setLogoError('You must be signed in to upload a logo.'); return; }
    setLogoUploading(true);
    setLogoError('');
    const supabase = getAuthedClient();
    const res = await uploadConferenceAsset(supabase, 'logos', conferenceIdRef.current, file);
    setLogoUploading(false);
    if (res.error || !res.url) { setLogoError(res.error || 'Upload failed.'); return; }
    setLogoUrl(res.url);
    setStepError('');
  }

  async function handleBannerUpload(file: File) {
    if (!session) { setBannerError('You must be signed in to upload a banner.'); return; }
    setBannerUploading(true);
    setBannerError('');
    const supabase = getAuthedClient();
    const res = await uploadConferenceAsset(supabase, 'banners', conferenceIdRef.current, file);
    setBannerUploading(false);
    if (res.error || !res.url) { setBannerError(res.error || 'Upload failed.'); return; }
    setBannerUrl(res.url);
  }

  // ── Submit, preserved exactly from the old form ─────────────────────────
  async function handleCreate() {
    if (!user || !session) {
      setError('You must be signed in to create a conference.');
      return;
    }
    setSubmitting(true);
    setError('');

    try {
      const supabase = getAuthedClient();

      // Minted client-side (at mount) so the logo/banner uploads earlier in the
      // wizard, the role-config seeding insert below, and this row all share one
      // id without reading it back (see the RETURNING/RLS note just below).
      const conferenceId = conferenceIdRef.current;

      // Non-empty only on a retry after a committee insert failed AND could not
      // be rolled back: that conferences row is real and already ours, so we
      // skip straight to the committees instead of minting a second conference.
      let slug = createdSlugRef.current;

      if (!slug) {
        // Short, human URLs: /conferences/limun2027. The ladder and the reasons
        // behind it live in src/lib/conferenceSlug.ts. `attempts` is ordered
        // best-first and always ends with a legacy random-suffix slug, so the
        // loop below can never run out of names.
        const attempts = await conferenceSlugAttempts(supabase, {
          acronym,
          fullName,
          year: datesTbd ? null : conferenceYear(startDate, endDate),
        });

        // No .select() after insert: the new row is only SELECT-visible once the
        // ownership trigger has run, so RETURNING fails RLS for private conferences.
        // We already know the slug, we generated it.
        const insertRow = (slug: string) => ({
            id: conferenceId,
            slug,
            organizer_id: user.id,
            full_name: fullName,
            acronym: acronym.trim(),
            contact_email: contactEmail,
            student_level: studentLevel,
            start_date: datesTbd ? null : (startDate || null),
            end_date: datesTbd ? null : (endDate || null),
            dates_tbd: datesTbd,
            country,
            city,
            format,
            // Step 6 has no skip any more, so this always carries a real number.
            // The 0 fallback stays as a belt-and-braces default: the column is
            // `integer NOT NULL` with no default, and writing null used to fail
            // the WHOLE insert with a 23502 after the organiser had filled in
            // every step. 0 is the sentinel the rest of the product already
            // reads as "no expectation set" — conference_setup_status() does
            // `coalesce(expected_delegates, 0)` and passes the committees
            // checklist row on `v_expected = 0`, the dashboard guards on
            // `expectedDelegates > 0` and offers SET AN EXPECTED HEAD COUNT,
            // and admin's isShortOnSeats() skips it.
            expected_delegates: expectedDelegates ? parseInt(expectedDelegates) : 0,
            // What they came here to do, step 12. Part of the insert, so it can
            // never be a follow-up write that fails after the conference is real.
            intent: intentPayload(intentKeys),
            fee_amount: feeKind === 'paid' ? parseFloat(feeAmount) || 0 : 0,
            fee_currency: feeCurrency,
            description: description.trim() || null,
            instagram_url: normalizeSocialUrl(instagram, 'instagram'),
            facebook_url: normalizeSocialUrl(facebook, 'facebook'),
            tiktok_url: normalizeSocialUrl(tiktok, 'tiktok'),
            whatsapp_url: normalizeSocialUrl(whatsapp, 'whatsapp'),
            website_url: normalizeSocialUrl(website),
            logo_url: logoUrl || null,
            banner_url: bannerUrl || null,
            is_public: false,
            status: 'private',
            predecessor_conference_id: null,
        });

        // `conferences.slug` has a real UNIQUE constraint, so the pre-filter in
        // conferenceSlugAttempts is an optimisation, not the guarantee: two
        // organizers creating the same acronym+year at the same moment can both
        // see a rung free. Walk down the list on a slug 23505 rather than failing
        // the creation. Any other error is real and aborts immediately.
        let dbError: { code?: string; message: string } | null = null;
        for (const candidate of attempts) {
          const { error } = await supabase.from('conferences').insert(insertRow(candidate));
          if (!error) { slug = candidate; dbError = null; break; }
          dbError = error;
          if (!isSlugTakenError(error)) break;
        }

        if (dbError || !slug) {
          setSubmitting(false);
          setError('Failed to create conference: ' + (dbError?.message ?? 'could not assign a URL.'));
          return;
        }

        // Seed default per-role application configs so the delegate fee
        // entered above is the role config's fee from day one, otherwise
        // Settings' own ensureRoleConfigs seeds it lazily with a $0 delegate
        // fee the first time the organizer opens Settings, disagreeing with
        // the fee just entered here. Non-fatal: that lazy fallback still
        // covers this conference if the insert below fails.
        const { error: roleConfigError } = await supabase.from('application_role_configs').insert(
          ROLE_DEFAULTS.map(role => ({
            conference_id: conferenceId,
            role,
            // Applications now start closed by design: a brand new conference
            // has no payment_method yet (not set above), so it can never be
            // ready, and the INSERT trigger would coerce this to false anyway.
            // They open once financial setup is done, from Settings.
            is_enabled: false,
            fee_amount: role === 'delegate' ? (parseFloat(feeAmount) || 0) : 0,
            fee_currency: feeCurrency,
            auto_accept: false,
            payment_timing: 'anytime' as const,
            custom_questions: [],
          }))
        );
        if (roleConfigError) {
          console.error('Failed to seed role configs:', roleConfigError.message);
        }
      }

      // Committees. NOT optional and NOT best-effort: an organiser who leaves
      // here with zero committees has a conference that cannot receive a
      // meaningful application, which is the whole reason step 7 exists. They
      // cannot be written before the conference (conference_id is a FK), so a
      // failure is undone rather than shrugged off.
      //
      // Name, abbreviation, type and difficulty all come from the wizard's own
      // committee editor — every field DraftCommittee carries is written here,
      // so nothing the organiser typed on step 7 is dropped. delegation_size
      // takes its column default (1); `topics` stays empty, which the 1..3
      // CHECK permits (array_length of an empty array is NULL, and a third of
      // production rows already sit this way). The emblem is resolved by the
      // same matcher CommitteeEditorModal auto-assigns with.
      //
      // total_slots is a PLACEHOLDER 1, not a claim. The truthful value here is
      // 0 — no roster has been picked yet — but the column carries a
      // `total_slots > 0` CHECK, so 0 is rejected outright; 1 is the smallest
      // value the schema allows and the lowest already in production. The real
      // number is minted by the country roster in the full editor
      // (CommitteeEditorModal writes total_slots = roster.length), and nothing
      // that matters counts this field: the dashboard's seat coverage sums
      // committee_country_slots, so an empty committee cannot falsely tick
      // "Add committees with enough seats".
      const { error: committeesError } = await supabase.from('conference_committees').insert(
        committees.map((c) => ({
          conference_id: conferenceId,
          name: c.name,
          abbreviation: c.abbreviation || null,
          committee_type: c.type,
          difficulty: c.difficulty,
          topics: [],
          total_slots: 1,
          logo_url: matchPresetEmblem(c.name, c.abbreviation),
        }))
      );

      if (committeesError) {
        // Roll the conference back so a failed creation leaves nothing behind.
        // `delete_conference` is the owner-only SECURITY DEFINER RPC Settings
        // deletes with — `conferences` has no DELETE policy, so a plain
        // .delete() would silently affect zero rows. Every child table cascades.
        const { error: rollbackError } = await supabase.rpc('delete_conference', { p_conference_id: conferenceId });
        setSubmitting(false);
        if (rollbackError) {
          // The row survived the rollback. It is a real conference and they own
          // it, so don't strand them behind a button that can only fail: keep
          // the id and slug, and let Create again retry just the committees.
          createdSlugRef.current = slug;
          setError(
            'Your conference was saved, but its committees were not: ' + committeesError.message +
            ' Tap Create conference again to add them.'
          );
          return;
        }
        // Nothing was created. The id is spent, a retry needs a fresh one (the
        // uploaded logo/banner URLs stay valid whatever id the next row gets).
        conferenceIdRef.current = crypto.randomUUID();
        setError('Could not save your committees: ' + committeesError.message + '. Nothing was created, please try again.');
        return;
      }

      // Created, intent and all. Straight to the dashboard — `submitting` stays
      // true through the navigation so the button cannot fire a second time
      // while the route loads.
      router.push('/manage/' + slug);
    } catch (err) {
      setSubmitting(false);
      setError('Unexpected error: ' + (err instanceof Error ? err.message : String(err)));
    }
  }

  function toggleIntent(key: string) {
    setIntentKeys((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  const allIntentsPicked = intentKeys.length === INTENT_OPTIONS.length;

  /** Tick to take everything, untick to clear it. Rebuilt in INTENT_OPTIONS
   *  order so the stored array is stable whichever way it was filled. */
  function toggleAllIntents() {
    setIntentKeys(allIntentsPicked ? [] : INTENT_OPTIONS.map((o) => o.key));
  }

  // ── Per-step validation before advancing ─────────────────────────────────

  function continueStep1() {
    if (!fullName.trim()) { setStepError('Give your conference its full name.'); return; }
    const problem = acronymProblem(acronym);
    if (problem) { setStepError(problem); return; }
    advance(1);
  }

  function continueStep4() {
    if (!country) { setStepError('Pick the country your conference is in.'); return; }
    if (!city.trim()) { setStepError('And the city, delegates will look for it.'); return; }
    advance(4);
  }

  function continueStep5() {
    if (startDate && endDate && endDate < startDate) { setStepError('The end date cannot be before the start date.'); return; }
    advance(5);
  }

  function continueStep6() {
    const n = parseInt(expectedDelegates);
    if (!expectedDelegates || isNaN(n) || n < 1) { setStepError('Give us a rough number of delegates.'); return; }
    advance(6);
  }

  function continueStep7() {
    // A committee half-typed in the open editor counts — nobody should lose a
    // room to an unpressed Save button. A named draft is committed here; an
    // untouched one is simply closed.
    if (editing) {
      if (editing.draft.name.trim()) {
        if (!saveEditingCommittee()) return;
      } else {
        setEditing(null);
      }
    }
    if (committees.length === 0) { setStepError('Add at least one committee. Delegates apply to a committee, not to a conference.'); return; }
    advance(7);
  }

  function continueStep8() {
    if (!feeKind) { setStepError('Is your conference free or paid?'); return; }
    if (feeKind === 'paid') {
      const amt = parseFloat(feeAmount);
      if (!feeAmount || isNaN(amt) || amt <= 0) { setStepError('Enter the delegate fee amount.'); return; }
    }
    advance(8);
  }

  // Acronyms where there is one, so the row reads "UNSC, DISEC, WHO" rather
  // than three wrapped sentences. ReviewRow truncates a long list on its own.
  const committeesSummary = committees.length
    ? committees.map((c) => committeeDisplayName(c.name, c.abbreviation)).join(', ')
    : 'None yet';

  // Titles rather than the admin's SHOUTING short codes: this row sits beside
  // "Committees" and "Fee" in a sentence-case list.
  const intentSummary = intentKeys.length
    ? INTENT_OPTIONS.filter((o) => intentKeys.includes(o.key)).map((o) => o.label).join(', ')
    : 'Not answered';

  const socialsSummary = [
    instagram.trim() && 'Instagram',
    facebook.trim() && 'Facebook',
    tiktok.trim() && 'TikTok',
    whatsapp.trim() && 'WhatsApp',
    website.trim() && 'Website',
  ].filter(Boolean).join(', ');

  // The logo, banner, description and socials steps are skippable and none of
  // them gates creation. Everything else does: the head count is a real
  // positive number, at least one committee exists (one is the minimum a
  // conference needs to be applied to at all), and the intent question has an
  // answer. Each of those three has a step with no skip link, so a review
  // screen that could not submit would mean an editable row is empty — hence a
  // ReviewRow for every one of them.
  const readyToCreate =
    fullName.trim() && acronym.trim() && !acronymProblem(acronym) && contactEmail.trim() &&
    studentLevel && country && city.trim() && format &&
    parseInt(expectedDelegates) > 0 &&
    committees.length > 0 &&
    intentKeys.length > 0 &&
    (feeKind === 'free' || (feeKind === 'paid' && parseFloat(feeAmount) > 0));

  // Loading / auth spinner
  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: NEU.base }}>
        <Loader size={72} label="Loading" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col relative" style={{ backgroundColor: NEU.base }}>
      {/* Grain */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23grain)' opacity='1'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
          backgroundSize: '300px 300px',
          mixBlendMode: 'multiply',
          opacity: 0.18,
        }}
      />

      <div className="relative z-10 flex flex-col min-h-screen">
        <SiteNav hideLanguage />

        <main className="flex-1 flex justify-center px-5 py-10">
          <div className="w-full">

            {/* ── Step 1, name + acronym ─────────────────────────────── */}
            {step === 1 && (
              <WizardShell
                step={1} total={TOTAL_STEPS}
                title="What's your conference called?"
                sub="The full name delegates will see, and the short acronym everyone actually uses."
                onBack={returnToReview ? back : undefined}
              >
                <div className="flex flex-col gap-5">
                  <div>
                    <FieldLabel>Full conference name</FieldLabel>
                    <input
                      type="text"
                      value={fullName}
                      autoFocus
                      onChange={(e) => {
                        setFullName(e.target.value);
                        if (!acronymTouched.current) setAcronym(suggestAcronym(e.target.value));
                      }}
                      placeholder="e.g. The European International Model United Nations"
                      style={bigInputStyle}
                      onFocus={focusForest}
                      onBlur={blurClear}
                    />
                  </div>
                  <div>
                    <FieldLabel>Short name / acronym</FieldLabel>
                    <input
                      type="text"
                      value={acronym}
                      onChange={(e) => {
                        acronymTouched.current = true;
                        setAcronym(e.target.value);
                      }}
                      placeholder="e.g. TEIMUN, or Model NATO Germany"
                      style={{ ...bigInputStyle, letterSpacing: '0.08em', fontVariantNumeric: 'tabular-nums' }}
                      onFocus={focusForest}
                      onBlur={blurClear}
                    />
                    {acronymError ? (
                      <ErrorNote>{acronymError}</ErrorNote>
                    ) : (
                      <p style={{ fontFamily: OUTFIT, fontSize: 12, color: NEU.muted, marginTop: 8 }}>
                        Suggested from your conference name. Use whatever your conference actually goes by — &ldquo;MODEL NATO GERMANY&rdquo; is as valid as &ldquo;TEIMUN&rdquo;. The edition year is added automatically.
                      </p>
                    )}
                  </div>
                </div>
                {stepError && <ErrorNote>{stepError}</ErrorNote>}
                <ContinueButton onClick={continueStep1} disabled={!fullName.trim() || !acronym.trim() || !!acronymError} />
              </WizardShell>
            )}

            {/* ── Step 2, format ─────────────────────────────────────── */}
            {step === 2 && (
              <WizardShell
                step={2} total={TOTAL_STEPS}
                title="In person or online?"
                sub="How will delegates attend your conference?"
                onBack={back}
              >
                <TwoTabPick
                  options={[
                    { key: 'in-person', label: 'In Person', image: '/onboarding/hall-01.jpg', sub: 'A real venue, real gavels' },
                    { key: 'online', label: 'Online', image: '/onboarding/laptop-01.jpg', sub: 'Fully remote committees' },
                  ]}
                  value={format || null}
                  onChange={(k) => { setFormat(k as 'in-person' | 'online'); setStepError(''); }}
                />
                <div className="flex justify-center">
                  <TertiaryPick label="A bit of both, it's hybrid" selected={format === 'hybrid'} onClick={() => { setFormat('hybrid'); setStepError(''); }} />
                </div>
                {stepError && <ErrorNote>{stepError}</ErrorNote>}
                <ContinueButton onClick={() => (format ? advance(2) : setStepError('Pick how delegates will attend.'))} disabled={!format} />
              </WizardShell>
            )}

            {/* ── Step 3, level ──────────────────────────────────────── */}
            {step === 3 && (
              <WizardShell
                step={3} total={TOTAL_STEPS}
                title="High school or university level?"
                sub="Who is your conference for?"
                onBack={back}
              >
                <TwoTabPick
                  options={[
                    { key: 'school', label: 'High School', image: '/onboarding/classroom-01.jpg', sub: 'Secondary-school delegates' },
                    { key: 'university', label: 'University', image: '/onboarding/campus-01.jpg', sub: 'University students and above' },
                  ]}
                  value={studentLevel || null}
                  onChange={(k) => { setStudentLevel(k as 'school' | 'university'); setStepError(''); }}
                />
                <div className="flex justify-center">
                  <TertiaryPick label="Open to both" selected={studentLevel === 'both'} onClick={() => { setStudentLevel('both'); setStepError(''); }} />
                </div>
                {stepError && <ErrorNote>{stepError}</ErrorNote>}
                <ContinueButton onClick={() => (studentLevel ? advance(3) : setStepError('Pick your delegate level.'))} disabled={!studentLevel} />
              </WizardShell>
            )}

            {/* ── Step 4, where ──────────────────────────────────────── */}
            {step === 4 && (
              <WizardShell
                step={4} total={TOTAL_STEPS}
                title="Where is it happening?"
                sub="Country first, then the city."
                onBack={back}
              >
                <CardSelect
                  options={countryOptions}
                  value={country || null}
                  onChange={(k) => { setCountry(k); setStepError(''); }}
                  searchable
                  columns={3}
                />
                <div style={{ marginTop: 18 }}>
                  <FieldLabel>City</FieldLabel>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g. The Hague"
                    style={bigInputStyle}
                    onFocus={focusForest}
                    onBlur={blurClear}
                  />
                </div>
                {stepError && <ErrorNote>{stepError}</ErrorNote>}
                <ContinueButton onClick={continueStep4} disabled={!country || !city.trim()} />
              </WizardShell>
            )}

            {/* ── Step 5, when ───────────────────────────────────────── */}
            {step === 5 && (
              <WizardShell
                step={5} total={TOTAL_STEPS}
                title="When does it run?"
                sub="First and last day of the conference."
                onBack={back}
              >
                <NeuInset style={{ padding: '20px 22px', borderRadius: 20 }}>
                  <div className="grid grid-cols-2 gap-4" style={datesTbd ? { opacity: 0.4, pointerEvents: 'none' } : undefined}>
                    <div>
                      <FieldLabel>First day</FieldLabel>
                      <DatePicker
                        value={startDate}
                        min={todayISO}
                        onChange={(iso) => { setStartDate(iso); if (!endDate || endDate < iso) setEndDate(iso); setStepError(''); }}
                        placeholder="First day"
                      />
                    </div>
                    <div>
                      <FieldLabel>Last day</FieldLabel>
                      <DatePicker
                        value={endDate}
                        min={startDate || todayISO}
                        onChange={(iso) => { setEndDate(iso); setStepError(''); }}
                        placeholder="Last day"
                      />
                    </div>
                  </div>

                  {/* Dates TBD: create now, decide dates later. A TBD conference
                      stays private (no public listing) until dates are set, but
                      can still open delegate applications. */}
                  <button
                    type="button"
                    onClick={() => {
                      const next = !datesTbd;
                      setDatesTbd(next);
                      setStepError('');
                      if (next) { setStartDate(''); setEndDate(''); }
                    }}
                    className="flex items-center gap-2.5 mt-4 w-full text-left focus:outline-none"
                  >
                    <span
                      className="flex items-center justify-center flex-shrink-0"
                      style={{
                        width: 20, height: 20, borderRadius: 6,
                        border: `1.5px solid ${datesTbd ? '#1B3828' : '#C9BEA6'}`,
                        backgroundColor: datesTbd ? '#1B3828' : 'transparent',
                      }}
                    >
                      {datesTbd && <Check size={13} strokeWidth={3} style={{ color: '#EED98A' }} />}
                    </span>
                    <span>
                      <span className="block text-sm font-semibold" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
                        Dates are to be decided
                      </span>
                      <span className="block text-xs" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
                        Set them any time later. A TBD conference stays private (no public link) until you add dates — you can still open applications.
                      </span>
                    </span>
                  </button>
                </NeuInset>
                {stepError && <ErrorNote>{stepError}</ErrorNote>}
                <ContinueButton onClick={continueStep5} />
              </WizardShell>
            )}

            {/* ── Step 6, expected delegates ─────────────────────────── */}
            {step === 6 && (
              <WizardShell
                step={6} total={TOTAL_STEPS}
                title="How many delegates do you expect?"
                sub="A rough number is fine, you can change it any time in Settings."
                onBack={back}
              >
                <CardSelect
                  options={DELEGATE_RANGES.map((r) => ({
                    key: r.key,
                    label: r.label,
                    sub: r.sub,
                    icon: <Emoji3D name={r.emoji} size={48} />,
                  }))}
                  value={delegateRange || null}
                  onChange={(k) => { setDelegateRange(k); setExpectedDelegates(k); setStepError(''); }}
                  columns={4}
                />
                <div style={{ marginTop: 18 }}>
                  <FieldLabel>Or an exact number</FieldLabel>
                  <input
                    type="number"
                    min={1}
                    value={expectedDelegates}
                    onChange={(e) => { setExpectedDelegates(e.target.value); setDelegateRange(''); }}
                    placeholder="e.g. 300"
                    style={{ ...bigInputStyle, fontVariantNumeric: 'tabular-nums' }}
                    onFocus={focusForest}
                    onBlur={blurClear}
                  />
                </div>
                {stepError && <ErrorNote>{stepError}</ErrorNote>}
                {/* No skip. A conference with no expected head count cannot be
                    sized: the dashboard's seat coverage, the committees
                    checklist row and admin's short-on-seats check all read
                    `expected_delegates`, and 0 makes every one of them shrug.
                    A rough number is enough and it is editable in Settings. */}
                <ContinueButton onClick={continueStep6} disabled={!expectedDelegates || parseInt(expectedDelegates) < 1} />
              </WizardShell>
            )}

            {/* ── Step 7, committees (REQUIRED, no skip) ─────────────── */}
            {/* Deliberately shaped like /manage/[slug]/committees, the page the
                organiser will run this conference from: a list of committee
                cards you add to, edit and remove. It cannot BE that page's
                editor — CommitteeEditorModal writes straight to the database
                and there is no conference row yet — so the same four card
                fields are collected locally and written with the
                conference_committees insert in handleCreate. */}
            {step === 7 && (
              <WizardShell
                step={7} total={TOTAL_STEPS}
                title="Set up your committees"
                sub="Delegates apply to a committee, so you need at least one. Add as many as you like, you can add more any time."
                onBack={back}
              >
                {/* Header row, the committees page's own: a count on the left,
                    the single add action on the right. */}
                <div className="flex items-center justify-between gap-3" style={{ marginBottom: 14 }}>
                  <p
                    style={{
                      fontFamily: OUTFIT, fontSize: 11, fontWeight: 800, letterSpacing: '0.12em',
                      color: NEU.muted, textTransform: 'uppercase', fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {committees.length === 0
                      ? 'Your committees'
                      : `${committees.length} committee${committees.length === 1 ? '' : 's'}`}
                  </p>
                  <NeuButton
                    onClick={openNewCommittee}
                    icon={Plus}
                    style={{ padding: '10px 18px', fontSize: 12 }}
                  >
                    ADD COMMITTEE
                  </NeuButton>
                </div>

                {editing && (
                  <div style={{ marginBottom: 16 }}>
                    <CommitteeEditor
                      draft={editing.draft}
                      onChange={(next) => { setEditing({ ...editing, draft: next }); setEditorError(''); }}
                      onSave={saveEditingCommittee}
                      onCancel={() => { setEditing(null); setEditorError(''); }}
                      isEdit={!!editing.replacing}
                      error={editorError}
                    />
                  </div>
                )}

                {committees.length === 0 && !editing ? (
                  /* Empty state, matching the one on the committees page. It
                     stands down while the editor is open — the editor is then
                     the thing to fill in, and two calls to action would fight. */
                  <div
                    className="flex flex-col items-center text-center"
                    style={{
                      padding: '38px 24px', borderRadius: 20,
                      border: '1.5px dashed rgba(27,56,40,0.24)',
                      backgroundColor: 'color-mix(in srgb, var(--gv-surface) 60%, transparent)',
                    }}
                  >
                    <span
                      className="flex items-center justify-center"
                      style={{
                        width: 56, height: 56, borderRadius: 9999, marginBottom: 14,
                        background: 'linear-gradient(150deg, color-mix(in srgb, var(--gv-main) 12%, transparent), color-mix(in srgb, var(--gv-main) 5%, transparent))',
                        border: '1.5px solid color-mix(in srgb, var(--gv-main) 18%, transparent)',
                      }}
                    >
                      <Building2 size={24} style={{ color: NEU.forest }} />
                    </span>
                    <p style={{ fontFamily: OUTFIT, fontSize: 17, fontWeight: 800, color: NEU.ink }}>
                      No committees yet
                    </p>
                    <p
                      style={{
                        fontFamily: OUTFIT, fontSize: 13.5, color: NEU.inkSoft,
                        lineHeight: 1.55, marginTop: 6, maxWidth: 340,
                      }}
                    >
                      Committees are where delegates debate. Add your first one, or tap a common committee below.
                    </p>
                    <div style={{ marginTop: 16 }}>
                      <NeuButton onClick={openNewCommittee} icon={Plus} style={{ padding: '11px 22px', fontSize: 12.5 }}>
                        ADD YOUR FIRST COMMITTEE
                      </NeuButton>
                    </div>
                  </div>
                ) : (
                  <div
                    className="grid gap-3.5 items-stretch"
                    // Floor picked so the row is two cards wide on a 375px
                    // phone and four wide in the 720px shell.
                    style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 152px), 1fr))' }}
                  >
                    {committees.map((c) => (
                      <DraftCommitteeCard
                        key={c.key}
                        committee={c}
                        onEdit={() => openEditCommittee(c)}
                        onRemove={() => removeCommittee(c.key)}
                      />
                    ))}
                  </div>
                )}

                {/* One-tap common committees. Secondary to the cards now: they
                    are a shortcut to a first committee, not the step itself.
                    Tapping one already on the list takes it back off. */}
                <div style={{ marginTop: 20 }}>
                  <FieldLabel>Quick add</FieldLabel>
                  <div className="flex flex-wrap gap-2">
                    {QUICK_COMMITTEES.map(({ name, type }) => {
                      const acr = deriveCommitteeAcronym(name);
                      const on = committeeKeys.has(committeeKey(name));
                      const emblem = matchPresetEmblem(name, acr);
                      return (
                        <button
                          key={name}
                          type="button"
                          onClick={() => toggleQuickCommittee(name, type)}
                          aria-pressed={on}
                          title={name}
                          className="flex items-center gap-2 focus:outline-none"
                          style={{
                            padding: '8px 14px 8px 10px', borderRadius: 9999,
                            border: on ? `1.5px solid ${NEU.forest}` : '1.5px solid rgba(27,56,40,0.14)',
                            backgroundColor: on ? NEU.surface : 'transparent',
                            boxShadow: on ? NEU.outSm : 'none',
                            color: on ? NEU.forest : NEU.inkSoft,
                            fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 700,
                            cursor: 'pointer',
                            transition: `box-shadow 200ms ${EASE}, color 200ms ${EASE}, border-color 200ms ${EASE}`,
                          }}
                        >
                          <span className="flex items-center justify-center flex-shrink-0" style={{ width: 20, height: 20 }}>
                            {on ? (
                              <Check size={14} strokeWidth={3} style={{ color: NEU.forest }} />
                            ) : emblem ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={emblem} alt="" style={{ width: 18, height: 18, objectFit: 'contain' }} />
                            ) : (
                              <Building2 size={14} strokeWidth={2.4} />
                            )}
                          </span>
                          {committeeDisplayName(name, acr)}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <p
                  style={{
                    fontFamily: OUTFIT, fontSize: 12.5, lineHeight: 1.6, color: NEU.inkSoft,
                    textAlign: 'center', marginTop: 18, padding: '0 8px',
                  }}
                >
                  Countries, seats, topics and chairs come later in
                  Manage&nbsp;→&nbsp;Committees, where this same list is waiting for you.
                </p>

                {stepError && <ErrorNote>{stepError}</ErrorNote>}
                <ContinueButton
                  onClick={continueStep7}
                  disabled={committees.length === 0 && !editing?.draft.name.trim()}
                />
              </WizardShell>
            )}

            {/* ── Step 8, fee ────────────────────────────────────────── */}
            {step === 8 && (
              <WizardShell
                step={8} total={TOTAL_STEPS}
                title="Is there a delegate fee?"
                sub="Free conferences fill fast. Paid fees are collected per delegate."
                onBack={back}
              >
                <TwoTabPick
                  options={[
                    { key: 'free', label: 'Free', icon: <Emoji3D name="Party popper" size={52} />, sub: 'No delegate fee' },
                    { key: 'paid', label: 'Paid', icon: <Emoji3D name="Money bag" size={52} />, sub: 'Delegates pay to attend' },
                  ]}
                  value={feeKind || null}
                  onChange={(k) => { setFeeKind(k as 'free' | 'paid'); setStepError(''); }}
                />
                {feeKind === 'paid' && (
                  <NeuInset style={{ padding: '18px 20px', borderRadius: 20, marginTop: 18 }}>
                    <FieldLabel>Base delegate fee</FieldLabel>
                    <p style={{ fontFamily: OUTFIT, fontSize: 12.5, lineHeight: 1.55, color: NEU.muted, margin: '2px 0 12px' }}>
                      Just your <strong style={{ color: NEU.ink }}>lowest / earliest</strong> delegate price for now. After you create the
                      conference, Settings&nbsp;→&nbsp;Financials lets you add phased pricing (early-bird through later
                      deadlines) and separate fees for <strong style={{ color: NEU.ink }}>delegations</strong> and
                      <strong style={{ color: NEU.ink }}> faculty advisors</strong>.
                    </p>
                    {/* items-stretch so the amount input matches the picker's
                        44px trigger height rather than sitting shorter than it. */}
                    <div className="flex items-stretch gap-3">
                      <CurrencyPicker
                        value={feeCurrency}
                        onChange={setFeeCurrency}
                        ariaLabel="Base delegate fee currency"
                        style={{ width: 132, flexShrink: 0 }}
                      />
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={feeAmount}
                        onChange={(e) => setFeeAmount(e.target.value)}
                        placeholder="0.00"
                        autoFocus
                        style={{ ...bigInputStyle, flex: 1, backgroundColor: NEU.surface, boxShadow: NEU.outSm, fontVariantNumeric: 'tabular-nums' }}
                        onFocus={focusForest}
                        onBlur={blurClear}
                      />
                    </div>
                  </NeuInset>
                )}
                {stepError && <ErrorNote>{stepError}</ErrorNote>}
                <ContinueButton
                  onClick={continueStep8}
                  disabled={!feeKind || (feeKind === 'paid' && !(parseFloat(feeAmount) > 0))}
                />
              </WizardShell>
            )}

            {/* ── Step 9, logo (MANDATORY) ───────────────────────────── */}
            {step === 9 && (
              <WizardShell
                step={9} total={TOTAL_STEPS}
                title="Add your conference logo"
                sub="Every conference needs a logo. It's how delegates recognise you across Gavelling."
                onBack={back}
              >
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) setLogoCropFile(f); e.target.value = ''; }}
                />
                <div className="flex flex-col items-center" style={{ gap: 20 }}>
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    aria-label={logoUrl ? 'Replace logo' : 'Upload logo'}
                    className="flex items-center justify-center focus:outline-none"
                    style={{
                      width: 168, height: 168, borderRadius: 999,
                      backgroundColor: '#FDFCF9',
                      border: logoUrl ? `2px solid ${NEU.forest}` : `2px dashed rgba(27,56,40,0.28)`,
                      boxShadow: NEU.out,
                      cursor: 'pointer', overflow: 'hidden', position: 'relative',
                      transition: `border-color 220ms ${EASE}`,
                    }}
                  >
                    {logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={logoUrl} alt="Conference logo" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 14 }} />
                    ) : (
                      <span className="flex flex-col items-center" style={{ gap: 8, color: NEU.muted }}>
                        <Emoji3D name="Framed picture" size={46} fallback={ImagePlus} fallbackColor={NEU.forest} />
                        <span style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 700 }}>Choose an image</span>
                      </span>
                    )}
                  </button>

                  <NeuButton
                    onClick={() => logoInputRef.current?.click()}
                    icon={logoUploading ? undefined : Upload}
                    disabled={logoUploading}
                    style={{ padding: '11px 26px', fontSize: 13 }}
                  >
                    {logoUploading ? 'UPLOADING…' : logoUrl ? 'REPLACE LOGO' : 'UPLOAD LOGO'}
                  </NeuButton>
                </div>

                {logoError && <ErrorNote>{logoError}</ErrorNote>}
                {stepError && <ErrorNote>{stepError}</ErrorNote>}
                <ContinueButton
                  onClick={() => (logoUrl ? advance(9) : setStepError('A logo is required to continue.'))}
                  disabled={!logoUrl || logoUploading}
                />
                <div className="flex justify-center" style={{ marginTop: 12 }}>
                  <SkipLink onClick={() => advance(9)} label="Do this later" />
                </div>
              </WizardShell>
            )}

            {/* ── Step 10, banner (SKIPPABLE) ────────────────────────── */}
            {step === 10 && (
              <WizardShell
                step={10} total={TOTAL_STEPS}
                title="Add a banner"
                sub="A wide header image for your conference page. Pick a preset, upload your own, or skip for now."
                onBack={back}
              >
                <input
                  ref={bannerInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleBannerUpload(f); e.target.value = ''; }}
                />

                <NeuInset style={{ padding: 10, borderRadius: 18, marginBottom: 16 }}>
                  <div
                    style={{
                      width: '100%', height: 150, borderRadius: 12, overflow: 'hidden',
                      backgroundColor: NEU.base, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    {bannerUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={bannerUrl} alt="Conference banner" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 600, color: NEU.muted }}>No banner yet</span>
                    )}
                  </div>
                </NeuInset>

                <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', padding: '4px 2px' }}>
                  {BANNER_PRESETS.map((p) => (
                    <BannerPreset
                      key={p}
                      src={p}
                      selected={bannerUrl === p}
                      onClick={() => { setBannerUrl(p); setBannerError(''); }}
                    />
                  ))}
                </div>

                <div className="flex justify-center" style={{ marginTop: 16 }}>
                  <NeuButton
                    onClick={() => bannerInputRef.current?.click()}
                    icon={bannerUploading ? undefined : Upload}
                    disabled={bannerUploading}
                    gradient={NEU_GRADIENTS.forest}
                    style={{ padding: '10px 22px', fontSize: 13 }}
                  >
                    {bannerUploading ? 'UPLOADING…' : 'UPLOAD YOUR OWN'}
                  </NeuButton>
                </div>

                {bannerError && <ErrorNote>{bannerError}</ErrorNote>}
                <ContinueButton onClick={() => advance(10)} />
                <div className="flex justify-center" style={{ marginTop: 12 }}>
                  <SkipLink onClick={() => { setBannerUrl(''); advance(10); }} label="Do this later" />
                </div>
              </WizardShell>
            )}

            {/* ── Step 11, description + socials (SKIPPABLE) ─────────── */}
            {step === 11 && (
              <WizardShell
                step={11} total={TOTAL_STEPS}
                title="Tell delegates about it"
                sub="A short description and your social links for the public page. All optional, skip if you'd rather add them later."
                onBack={back}
              >
                <div className="flex flex-col gap-5">
                  <div>
                    <FieldLabel>Description</FieldLabel>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="What makes your conference special? Themes, committees, the experience delegates can expect…"
                      rows={4}
                      maxLength={1500}
                      style={{ ...bigInputStyle, resize: 'vertical', lineHeight: 1.55, minHeight: 108 }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = NEU.forest; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = 'transparent'; }}
                    />
                    <div style={{ textAlign: 'right', marginTop: 6, fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 600, color: NEU.muted, fontVariantNumeric: 'tabular-nums' }}>
                      {description.length} / 1500
                    </div>
                  </div>

                  <NeuInset style={{ padding: '18px 20px', borderRadius: 20 }}>
                    <FieldLabel>Social links</FieldLabel>
                    <div className="flex flex-col gap-3" style={{ marginTop: 4 }}>
                      <SocialInput Icon={Camera} label="Instagram" value={instagram} onChange={setInstagram} placeholder="@yourmun or instagram.com/yourmun" />
                      <SocialInput Icon={ThumbsUp} label="Facebook" value={facebook} onChange={setFacebook} placeholder="facebook.com/yourmun" />
                      <SocialInput Icon={Music2} label="TikTok" value={tiktok} onChange={setTiktok} placeholder="@yourmun" />
                      <SocialInput Icon={MessageCircle} label="WhatsApp" value={whatsapp} onChange={setWhatsapp} placeholder="wa.me/44… or your number" />
                      <SocialInput Icon={Globe} label="Website" value={website} onChange={setWebsite} placeholder="yourmun.org" />
                    </div>
                  </NeuInset>
                </div>

                <ContinueButton onClick={() => advance(11)} />
                <div className="flex justify-center" style={{ marginTop: 12 }}>
                  <SkipLink
                    onClick={() => {
                      setDescription('');
                      setInstagram(''); setFacebook(''); setTiktok(''); setWhatsapp(''); setWebsite('');
                      advance(11);
                    }}
                    label="Do this later"
                  />
                </div>
              </WizardShell>
            )}

            {/* ── Step 12, what they will use Gavelling for (REQUIRED) ── */}
            {step === 12 && (
              <WizardShell
                step={12} total={TOTAL_STEPS}
                title="What will you use Gavelling for?"
                sub="Pick everything that applies. Your dashboard will put those first. Nothing is switched off by this."
                onBack={back}
              >
                <CardSelect
                  options={INTENT_OPTIONS.map((o) => ({
                    key: o.key,
                    label: o.label,
                    sub: o.sub,
                    icon: (
                      <Emoji3D
                        name={o.emoji}
                        size={56}
                        fallback={INTENT_FALLBACK_ICONS[o.key]}
                        fallbackColor={NEU.forest}
                      />
                    ),
                  }))}
                  value={intentKeys}
                  onChange={toggleIntent}
                  multiple
                  columns={3}
                  size="lg"
                  // Short headings, so the big cards can carry them — and both
                  // opt-ins are on: the labels wrap instead of truncating, and
                  // the grid drops to fewer columns rather than squeezing three
                  // big cards into a phone. This replaced a scoped CSS override
                  // that un-truncated the shared component from the outside.
                  wrapText
                  minColumnWidth={190}
                />

                {/* Select all. Secondary to the cards on purpose: a tick, not a
                    seventh card. Ticked once all six are on, however they got
                    there, and unticking clears them. */}
                <div className="flex justify-center" style={{ marginTop: 18 }}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={allIntentsPicked}
                    onClick={toggleAllIntents}
                    className="flex items-center gap-2.5 focus:outline-none"
                    style={{
                      padding: '9px 16px', borderRadius: 999, border: 'none',
                      background: 'none', cursor: 'pointer',
                    }}
                  >
                    <span
                      className="flex items-center justify-center flex-shrink-0"
                      style={{
                        width: 20, height: 20, borderRadius: 6,
                        border: `1.5px solid ${allIntentsPicked ? NEU.forest : 'rgba(27,56,40,0.28)'}`,
                        backgroundColor: allIntentsPicked ? NEU.forest : 'transparent',
                        transition: `background-color 180ms ${EASE}, border-color 180ms ${EASE}`,
                      }}
                    >
                      {allIntentsPicked && <Check size={13} strokeWidth={3} style={{ color: NEU.gold }} />}
                    </span>
                    <span style={{ fontFamily: OUTFIT, fontSize: 13.5, fontWeight: 700, color: NEU.inkSoft }}>
                      Select all
                    </span>
                  </button>
                </div>

                {stepError && <ErrorNote>{stepError}</ErrorNote>}
                <ContinueButton
                  label="Continue to review"
                  disabled={intentKeys.length === 0}
                  onClick={() => (intentKeys.length > 0 ? advance(12) : setStepError('Pick at least one.'))}
                />
              </WizardShell>
            )}

            {/* ── Step 13, review + create ───────────────────────────── */}
            {step === REVIEW_STEP && (
              <WizardShell
                step={REVIEW_STEP} total={TOTAL_STEPS}
                title="Ready to create it?"
                sub="Check everything over, tap any row to change it."
                onBack={back}
              >
                <div className="flex flex-col gap-2.5">
                  <ReviewRow label="Conference" value={`${fullName} (${acronym.trim()})`} onEdit={() => editFromReview(1)} />
                  <ReviewRow label="Format" value={format === 'in-person' ? 'In person' : format === 'online' ? 'Online' : 'Hybrid'} onEdit={() => editFromReview(2)} />
                  <ReviewRow label="Level" value={studentLevel === 'school' ? 'High school' : studentLevel === 'university' ? 'University' : 'Both'} onEdit={() => editFromReview(3)} />
                  <ReviewRow label="Location" value={`${city}, ${country}`} onEdit={() => editFromReview(4)} />
                  <ReviewRow label="Dates" value={datesTbd ? 'To be decided' : formatDateRange(startDate, endDate)} onEdit={() => editFromReview(5)} />
                  <ReviewRow label="Expected delegates" value={expectedDelegates || 'Not set'} onEdit={() => editFromReview(6)} />
                  <ReviewRow
                    label={`Committees (${committees.length})`}
                    value={committeesSummary}
                    onEdit={() => editFromReview(7)}
                  />
                  <ReviewRow
                    label="Fee"
                    value={feeKind === 'free' ? 'Free' : `${feeCurrency} ${parseFloat(feeAmount || '0').toFixed(2)} per delegate`}
                    onEdit={() => editFromReview(8)}
                  />
                  <ReviewRow label="Logo" value={logoUrl ? 'Added' : 'Skipped'} onEdit={() => editFromReview(9)} />
                  <ReviewRow label="Banner" value={bannerUrl ? 'Added' : 'Skipped'} onEdit={() => editFromReview(10)} />
                  <ReviewRow label="Description" value={description.trim() ? 'Added' : 'Skipped'} onEdit={() => editFromReview(11)} />
                  <ReviewRow label="Social links" value={socialsSummary || 'Skipped'} onEdit={() => editFromReview(11)} />
                  <ReviewRow label="Using Gavelling for" value={intentSummary} onEdit={() => editFromReview(12)} />
                </div>

                {/* Contact email, required by the directory, prefilled from your profile */}
                <div style={{ marginTop: 20 }}>
                  <FieldLabel>Organizer contact email</FieldLabel>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: NEU.muted }}>
                      <Mail size={16} />
                    </span>
                    <input
                      type="email"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      placeholder="conference@example.com"
                      style={{ ...bigInputStyle, paddingLeft: 42, fontSize: 14 }}
                      onFocus={focusForest}
                      onBlur={blurClear}
                    />
                  </div>
                </div>

                <p
                  style={{
                    fontFamily: OUTFIT, fontSize: 12.5, color: NEU.muted, lineHeight: 1.6,
                    textAlign: 'center', marginTop: 22, padding: '0 12px',
                  }}
                >
                  Visibility, previous editions and finer details:
                  you can set everything else later in Settings. Your conference starts private.
                </p>

                {error && (
                  <div
                    className="mt-4 px-4 py-3 rounded-xl text-sm"
                    style={{
                      backgroundColor: 'rgba(139, 32, 32, 0.08)',
                      border: '1px solid rgba(139, 32, 32, 0.2)',
                      color: '#8B2020',
                      fontFamily: OUTFIT,
                    }}
                  >
                    {error}
                  </div>
                )}

                <div className="flex justify-center" style={{ marginTop: 24 }}>
                  <NeuButton
                    onClick={handleCreate}
                    disabled={submitting || !readyToCreate || !contactEmail.trim()}
                    gradient={NEU_GRADIENTS.gold}
                    style={{ padding: '15px 44px', fontSize: 15 }}
                  >
                    {submitting ? 'CREATING…' : 'CREATE CONFERENCE'}
                  </NeuButton>
                </div>
              </WizardShell>
            )}

          </div>
        </main>
      </div>

      {/* Drag-to-fit crop step, flattens the chosen framing into a square
          transparent PNG, then hands off to the storage upload path. */}
      {logoCropFile && (
        <LogoCropModal
          file={logoCropFile}
          onCancel={() => setLogoCropFile(null)}
          onSave={(blob) => {
            setLogoCropFile(null);
            handleLogoUpload(new File([blob], 'logo.png', { type: 'image/png' }));
          }}
        />
      )}
    </div>
  );
}

// ── Review row ─────────────────────────────────────────────────────────────

function ReviewRow({ label, value, onEdit }: { label: string; value: string; onEdit: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onEdit}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="w-full flex items-center gap-3 text-left focus:outline-none"
      style={{
        padding: '13px 18px',
        borderRadius: 16,
        border: 'none',
        backgroundColor: NEU.surface,
        boxShadow: hovered ? NEU.outSmHover : NEU.outSm,
        transform: hovered ? 'translateY(-1px)' : 'translateY(0)',
        transition: `all 220ms ${EASE}`,
        cursor: 'pointer',
      }}
    >
      <span
        style={{
          fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 800, letterSpacing: '0.1em',
          color: NEU.muted, textTransform: 'uppercase', width: 132, flexShrink: 0,
        }}
      >
        {label}
      </span>
      <span
        className="flex-1 truncate"
        style={{ fontFamily: OUTFIT, fontSize: 14.5, fontWeight: 700, color: NEU.ink, fontVariantNumeric: 'tabular-nums' }}
      >
        {value}
      </span>
      <Pencil size={14} style={{ color: hovered ? NEU.forest : NEU.muted, flexShrink: 0, transition: `color 220ms ${EASE}` }} />
    </button>
  );
}

function formatDateRange(start: string, end: string): string {
  if (!start || !end) return '';
  const fmt = (d: string) =>
    new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  return start === end ? fmt(start) : `${fmt(start)} – ${fmt(end)}`;
}
