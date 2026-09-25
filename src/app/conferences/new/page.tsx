'use client';

/**
 * /conferences/new, page-by-page conference creation wizard.
 *
 * Built on the shared wizard kit (src/components/wizard.tsx). The first step
 * is one rich page (name, acronym, logo, banner, dates, with a live preview:
 * IdentityStep.tsx); the rest are one question per screen. The submit logic
 * writes exactly the same columns as before and redirects to /manage/{slug}.
 * Description and socials are collected in their own skippable step; the
 * remaining optional fields (visibility, previous editions) are deferred to
 * Settings after creation.
 *
 * Progress lives in component state only, a refresh restarts the wizard.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Mail, Pencil, Check, Camera, ThumbsUp, Music2, MessageCircle, Globe, Plus, ClipboardList, CreditCard, Building2, Megaphone, Trash2, type LucideIcon } from 'lucide-react';
import SiteNav from '@/components/SiteNav';
import Loader from '@/components/Loader';
import { useAuth } from '@/components/AuthProvider';
import { createClient } from '@supabase/supabase-js';
import { conferenceSlugAttempts, conferenceYear, isSlugTakenError } from '@/lib/conferenceSlug';
import { UN_COUNTRIES, getCountryByName } from '@/lib/countries';
import { FlagImg } from '@/components/FlagImg';
import { WizardShell, TwoTabPick, CardSelect } from '@/components/wizard';
import { NEU, OUTFIT, EASE, Emoji3D } from '@/components/neu';
import { IdentityStep } from './IdentityStep';
import { LogoCropModal } from '@/components/LogoCropModal';
import { uploadConferenceAsset } from '@/lib/conferenceAssets';
import { normalizeSocialUrl } from '@/lib/socialLinks';
import { acronymProblem } from '@/lib/conferenceLabels';
import { committeeDisplayName, deriveCommitteeAcronym } from '@/lib/presetNames';
import { INTENT_OPTIONS, intentPayload } from '@/lib/conferenceIntent';
import { friendlyError } from '@/lib/friendlyError';
// THE ORGANISER DASHBOARD'S COMMITTEE POP-UP, the very component
// /manage/[slug]/committees opens (24 Sep 2026, owner: "the committee creation
// in there should be a pop-up, EXACTLY EXACTLY how it is on the organiser
// dashboard"). The wizard opens it in DRAFT MODE (`draft` prop): same type
// chooser, same set-up card, same seat list, but Save hands the committee back
// here instead of writing, because the conference does not exist yet.
// handleCreate writes it. The medallion and type labels come from the same
// file, and the rank insignia from the account pages, so a card here draws
// exactly what the committees page draws.
import {
  CommitteeEditorModal, MonogramMedallion, medallionTone, COMMITTEE_TYPE_LABEL,
  type CommitteeDraft,
} from '@/components/CommitteeEditorModal';
import { LevelInsignia, LEVEL_ACCENT } from '@/app/account/accountUi';
import { effectiveEmblem } from '@/components/committeeSetupKit';
import { normaliseCommitteeLanguage, DEFAULT_COMMITTEE_LANGUAGE } from '@/lib/committeeLanguage';


// Mirrors settings' ensureRoleConfigs default set (source of truth there) —
// seeded here too so a freshly created conference already has per-role fee
// configs instead of relying on that lazy $0-delegate-fee fallback.
const ROLE_DEFAULTS = ['delegate', 'chair', 'head-delegate', 'faculty-advisor', 'observer'] as const;

// ── Step model ─────────────────────────────────────────────────────────────

const TOTAL_STEPS = 9;
const REVIEW_STEP = TOTAL_STEPS;
// 1 your conference: name + acronym (REQUIRED), logo, banner, dates (all three
// optional, as they were as separate steps) · 2 format · 3 level · 4 where
// · 5 delegates (REQUIRED) · 6 committees (REQUIRED) · 7 description + socials
// (skippable) · 8 what they will use Gavelling for (REQUIRED) · 9 review.
//
// Step 1 used to be four screens (name, then logo, banner and dates as steps
// 5, 8 and 9 of 12). Owner, 24 Sep 2026: "make the first wizard have more
// information in one page and better looking ... do name, logo, banner and
// dates in that first step". It is one page with a live preview now
// (IdentityStep.tsx); every rule each old step had is kept: the logo and the
// banner were skippable and still are, the dates were optional (or TBD) and
// still are, and the last day still may not be before the first.
//
// THERE IS NO FEE STEP (owner, 18 Sep 2026). A price is not something to set
// before a conference exists: the conference and the delegate role config are
// created at a fee of 0 and applications closed, prices are set in Settings →
// Financials, and every public surface shows "TBD" until delegate applications
// are open (displayDelegatePrice in src/lib/publicFees.ts).
//
// Every optional field stays exactly as editable from Settings afterwards as
// it already was.
//
// WHY COMMITTEES ARE REQUIRED. A conference with no committees cannot receive
// a meaningful application, and the wizard used to let organisers leave
// without one: 76 of 169 conferences never added a single committee, and the
// setup checklist's committee item is the first and biggest funnel cliff
// (169 → 83). It goes straight after the head count, because "how many
// delegates" and "which rooms do they sit in" are one thought.

// STEP 8, "What will you use Gavelling for?", is asked BEFORE the insert and
// is REQUIRED.
//
// It used to be a bonus screen shown after the row was already real, recorded
// by a follow-up UPDATE that raced a timeout. Now the answer travels inside the
// insert itself (`intent: intentPayload(intentKeys)`), so there is no second
// write to fail, nothing to time out, and no way to reach the dashboard with an
// unanswered `intent`. It sits last before the review because it is the one
// question about the organiser rather than about the conference. It has no
// skip link and a disabled Continue.

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

/** A committee as collected by the wizard: EXACTLY what the organiser
 *  dashboard's committee pop-up collects (CommitteeDraft: name, acronym,
 *  topics, difficulty, seats, groups, delegation size, emblem, language, type),
 *  plus a local list key.
 *
 *  EVERY field here is persisted by handleCreate: the `conference_committees`
 *  insert writes the committee, and the `committee_country_slots` insert right
 *  after it writes the seats. If you add one, add it there too.
 *
 *  Chairs are deliberately absent: seating or inviting one needs a committee
 *  id, so the pop-up does not draw its chairs section in draft mode. They stay
 *  in the same pop-up at /manage/[slug]/committees. */
interface DraftCommittee extends CommitteeDraft {
  /** Local list key only. The DB mints the real id. */
  key: string;
}

/** Case/space-insensitive identity, so "unsc " and "UNSC" are one committee. */
function committeeKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

// ── Small shared bits ──────────────────────────────────────────────────────

// Taste board (CLAUDE.md §8): a label above a white box, never a pressed-in
// well; white cards with a soft forest-tinted shadow, never neumorphic; the
// main button is the forest gradient rounded rectangle in sentence case.
const FIELD_BORDER = 'rgba(27,56,40,0.22)';
const CARD_SHADOW = '0 1px 2px rgba(27,56,40,0.06), 0 6px 20px -6px rgba(27,56,40,0.16)';
const CARD_SHADOW_HOVER = '0 2px 4px rgba(27,56,40,0.08), 0 12px 28px -8px rgba(27,56,40,0.22)';
const FOREST_BUTTON = 'linear-gradient(90deg,#1B3828 0%,#2A5A3C 55%,#1E4A31 100%)';

const bigInputStyle: React.CSSProperties = {
  width: '100%',
  backgroundColor: '#FFFFFF',
  border: `1.5px solid ${FIELD_BORDER}`,
  borderRadius: 12,
  padding: '14px 16px',
  fontSize: 16,
  fontWeight: 600,
  color: NEU.ink,
  fontFamily: OUTFIT,
  outline: 'none',
  transition: `border-color 180ms ${EASE}`,
};

function focusForest(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
  e.currentTarget.style.borderColor = NEU.forest;
}
function blurClear(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
  e.currentTarget.style.borderColor = FIELD_BORDER;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontFamily: OUTFIT, fontSize: 14, fontWeight: 700,
        color: NEU.ink, marginBottom: 8,
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
        padding: '10px 20px',
        borderRadius: 10,
        border: selected ? `2px solid ${NEU.forest}` : `2px solid ${FIELD_BORDER}`,
        backgroundColor: '#FFFFFF',
        boxShadow: selected ? CARD_SHADOW : 'none',
        color: selected ? NEU.forest : NEU.ink,
        fontFamily: OUTFIT, fontSize: 14, fontWeight: 700,
        cursor: 'pointer',
        transition: `border-color 220ms ${EASE}, box-shadow 220ms ${EASE}, color 220ms ${EASE}`,
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
        fontFamily: OUTFIT, fontSize: 14, fontWeight: 700,
        color: hovered ? NEU.forest : NEU.ink,
        textDecoration: 'underline', textDecorationThickness: 1.5,
        textUnderlineOffset: 3, transition: `color 200ms ${EASE}`,
      }}
    >
      {label}
    </button>
  );
}

/** The committee's picture, exactly what /manage/[slug]/committees draws: the
 *  emblem it will be saved with (`effectiveEmblem`: the organiser's own pick or
 *  upload, else what the name resolves to), and the gradient monogram
 *  medallion when there is none. */
function CommitteeEmblem({ committee, size }: { committee: DraftCommittee; size: number }) {
  const emblem = effectiveEmblem(committee);
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
function DifficultyStamp({ level }: { level: string }) {
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

/** One committee on the wizard's list (step 6), drawn as the card an organiser
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
        backgroundColor: '#FFFFFF',
        borderRadius: 18,
        boxShadow: hovered ? CARD_SHADOW_HOVER : CARD_SHADOW,
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        transition: `transform 300ms ${EASE}, box-shadow 300ms ${EASE}`,
      }}
    >
      <div className="flex flex-col items-center px-3.5 pt-2 flex-1">
        <div className="w-full flex justify-end" style={{ minHeight: 47 }}>
          <DifficultyStamp level={committee.difficulty} />
        </div>

        <CommitteeEmblem committee={committee} size={56} />

        {/* Two rows (CLAUDE.md §8): the acronym big, the full name smaller
            beneath, wrapping, never cut. */}
        {committee.abbreviation && (
          <p
            style={{
              margin: '9px 0 0 0', fontFamily: OUTFIT, fontSize: 16, fontWeight: 800,
              color: NEU.ink, lineHeight: 1.15, textAlign: 'center',
              overflowWrap: 'anywhere', fontVariantNumeric: 'tabular-nums',
            }}
          >
            {committee.abbreviation.toUpperCase()}
          </p>
        )}

        {/* `balance` so a two-line name breaks evenly instead of leaving an orphan. */}
        <h3
          className="text-center"
          style={{
            color: committee.abbreviation ? NEU.inkSoft : NEU.ink, fontFamily: OUTFIT,
            fontSize: committee.abbreviation ? 12 : 14, fontWeight: committee.abbreviation ? 600 : 800,
            lineHeight: 1.35,
            margin: committee.abbreviation ? '3px 0 0 0' : '10px 0 0 0',
            minHeight: '2.4em', textWrap: 'balance', overflowWrap: 'anywhere',
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
            height: 32, padding: '0 12px', borderRadius: 10,
            border: `1.5px solid ${editHover ? NEU.ink : FIELD_BORDER}`,
            backgroundColor: '#FFFFFF',
            color: NEU.ink, fontFamily: OUTFIT, fontSize: 13, fontWeight: 700,
            cursor: 'pointer',
            transition: `border-color 200ms ${EASE}`,
          }}
        >
          <Pencil size={13} strokeWidth={2.4} />
          Edit
        </button>
        <button
          type="button"
          onClick={onRemove}
          onMouseEnter={() => setRemoveHover(true)}
          onMouseLeave={() => setRemoveHover(false)}
          aria-label={`Remove ${committee.name}`}
          className="flex items-center justify-center focus:outline-none"
          style={{
            width: 32, height: 32, borderRadius: 10,
            border: `1.5px solid ${removeHover ? '#8B2020' : FIELD_BORDER}`,
            backgroundColor: '#FFFFFF',
            color: '#8B2020', cursor: 'pointer',
            transition: `border-color 200ms ${EASE}`,
          }}
        >
          <Trash2 size={14} strokeWidth={2.4} />
        </button>
      </div>
    </article>
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
        style={{ ...bigInputStyle, paddingLeft: 42, fontSize: 14 }}
      />
    </div>
  );
}

/** The main action: the Airbnb-style forest gradient rounded rectangle,
 *  sentence case, white text (taste board two, CLAUDE.md §8). */
function PrimaryButton({ children, disabled, onClick, style }: {
  children: React.ReactNode; disabled?: boolean; onClick: () => void; style?: React.CSSProperties;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center justify-center gap-2 focus:outline-none focus-visible:shadow-[0_0_0_3px_#EED98A] transition-[transform,filter,opacity] duration-200 enabled:hover:brightness-110 enabled:active:scale-[0.98]"
      style={{
        background: FOREST_BUTTON, color: '#FFFFFF', border: 'none', borderRadius: 11,
        padding: '13px 30px', fontFamily: OUTFIT, fontSize: 15, fontWeight: 700,
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.45 : 1,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function ContinueButton({ label = 'Continue', disabled, onClick }: { label?: string; disabled?: boolean; onClick: () => void }) {
  return (
    <div className="flex justify-center" style={{ marginTop: 24 }}>
      <PrimaryButton onClick={onClick} disabled={disabled}>
        {label}
      </PrimaryButton>
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
  // Committees (step 6). At least one is REQUIRED to create — see the step
  // model note at the top of this file. Written to conference_committees by
  // handleCreate, right after the conferences row.
  //
  // `committeeModal` is the open pop-up: null key = adding a new committee,
  // otherwise the key of the committee being edited. The pop-up itself is the
  // dashboard's CommitteeEditorModal in draft mode, so everything it collects
  // is a field of CommitteeDraft and nothing typed there can be dropped on the
  // way to the insert.
  const [committees, setCommittees] = useState<DraftCommittee[]>([]);
  const [committeeModal, setCommitteeModal] = useState<{ editingKey: string | null; nonce: number } | null>(null);

  // Logo + banner (both optional, step 1). Assets upload to storage as they
  // are picked, under a client-minted conference id, reused verbatim by the
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

  // What they came here to do (step 8). Required, and written as part of the
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

  // ── Committees (step 6) ──────────────────────────────────────────────────
  function removeCommittee(key: string) {
    setCommittees((prev) => prev.filter((c) => c.key !== key));
    setStepError('');
  }

  function openNewCommittee() {
    setStepError('');
    setCommitteeModal({ editingKey: null, nonce: Date.now() });
  }

  function openEditCommittee(c: DraftCommittee) {
    setStepError('');
    setCommitteeModal({ editingKey: c.key, nonce: Date.now() });
  }

  /**
   * The pop-up's Save, in draft mode. Returns a sentence the pop-up shows (and
   * stays open) when it refuses, or null to accept and close.
   *
   * Identity is the NAME (seats are matched back to the minted committee ids by
   * name in handleCreate), so a second committee with the same name is
   * refused. The acronym is only derived when the organiser left the field
   * empty, so a short name they typed is never overwritten; that is how the
   * wizard has always stored it.
   */
  function saveDraftCommittee(editingKey: string | null, d: CommitteeDraft): string | null {
    const name = d.name.trim();
    if (!name) return 'Committee name is required.';
    const clash = committees.some((c) => committeeKey(c.name) === committeeKey(name) && c.key !== editingKey);
    if (clash) return `${name} is already on your list.`;
    const saved: DraftCommittee = {
      ...d,
      key: editingKey ?? crypto.randomUUID(),
      name,
      abbreviation: d.abbreviation.trim() || deriveCommitteeAcronym(name),
    };
    setCommittees((prev) =>
      editingKey ? prev.map((c) => (c.key === editingKey ? saved : c)) : [...prev, saved],
    );
    setStepError('');
    return null;
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
            // Step 5 has no skip, so this always carries a real number.
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
            // What they came here to do, step 8. Part of the insert, so it can
            // never be a follow-up write that fails after the conference is real.
            intent: intentPayload(intentKeys),
            // No price is asked while creating (see the step model): the
            // legacy conference-level fee columns keep their defaults.
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
          setError(dbError ? friendlyError(dbError, "Couldn't create your conference. Please try again.") : "Couldn't create your conference: we couldn't assign a URL for it. Please try again.");
          return;
        }

        // Seed default per-role application configs so every role has a row
        // (fee 0, closed) from day one; prices are set in Settings →
        // Financials. Non-fatal: Settings' own ensureRoleConfigs seeds them
        // lazily if the insert below fails.
        const { error: roleConfigError } = await supabase.from('application_role_configs').insert(
          ROLE_DEFAULTS.map(role => ({
            conference_id: conferenceId,
            role,
            // Applications now start closed by design: a brand new conference
            // has no payment_method yet (not set above), so it can never be
            // ready, and the INSERT trigger would coerce this to false anyway.
            // They open once financial setup is done, from Settings.
            is_enabled: false,
            fee_amount: 0,
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
      // meaningful application, which is the whole reason step 6 exists. They
      // cannot be written before the conference (conference_id is a FK), so a
      // failure is undone rather than shrugged off.
      //
      // EVERY field the committee pop-up collects is written here (23 Sep
      // 2026; the pop-up itself since 24 Sep): name, abbreviation, type, difficulty,
      // topics, delegation size, parliamentary groups and the emblem. Nothing
      // the organiser filled in on step 6 is dropped. The emblem goes through
      // `effectiveEmblem`, the one derivation the committee editor saves with
      // too: their own pick or upload when they made one, otherwise whatever
      // `matchPresetEmblem` resolves from the name and acronym.
      //
      // total_slots mirrors the roster, exactly as CommitteeEditorModal writes
      // it. A committee left with NO seats still has to say 1: the column
      // carries a `total_slots > 0` CHECK, so 0 is rejected outright and 1 is
      // the smallest the schema allows. It is a placeholder in that case and
      // nothing that matters counts it — the dashboard's seat coverage sums
      // `committee_country_slots`, so a seatless committee cannot falsely tick
      // "Add committees with enough seats".
      //
      // `.select('id, name')` because the seats below need the minted ids.
      const { data: createdCommittees, error: committeesError } = await supabase
        .from('conference_committees')
        .insert(
          committees.map((c) => ({
            conference_id: conferenceId,
            name: c.name,
            abbreviation: c.abbreviation || null,
            committee_type: c.type,
            difficulty: c.difficulty,
            topics: c.topics,
            total_slots: Math.max(1, c.roster.length),
            delegation_size: c.doubleDelegation ? 2 : 1,
            groups: c.type === 'custom' ? c.groups : [],
            logo_url: effectiveEmblem(c),
            working_language: normaliseCommitteeLanguage(c.workingLanguage) ?? DEFAULT_COMMITTEE_LANGUAGE,
          }))
        )
        .select('id, name');

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
            friendlyError(committeesError, "Your conference was saved, but its committees were not.") +
            ' Tap Create conference again to add them.'
          );
          return;
        }
        // Nothing was created. The id is spent, a retry needs a fresh one (the
        // uploaded logo/banner URLs stay valid whatever id the next row gets).
        conferenceIdRef.current = crypto.randomUUID();
        setError(friendlyError(committeesError, 'Could not save your committees.') + ' Nothing was created, please try again.');
        return;
      }

      // SEATS. The pop-up collects a full roster, so it has to land
      // somewhere — a country list the organiser picked and then could not find
      // would be worse than never offering the control. Matched back to the
      // minted ids BY NAME rather than by position: names are unique across the
      // wizard's list (`committeeKey` refuses a duplicate), and nothing
      // promises an INSERT returns its rows in input order.
      //
      // Written exactly as CommitteeEditorModal's own create writes them, one
      // for one. No live session is minted here and none ever was: the
      // committees page mints and seats any room that has none the moment the
      // organiser lands on it, which is where these committees go next.
      //
      // NOT a rollback path, unlike the committees above. The conference and
      // its committees exist and are useful; a failed seat write is fixed in
      // Manage → Committees in a few taps, and deleting a real conference over
      // it would be far more destructive than the fault.
      const slotRows = committees.flatMap((c) => {
        const created = (createdCommittees ?? []).find((r) => committeeKey(r.name) === committeeKey(c.name));
        if (!created) return [];
        const size = c.doubleDelegation ? 2 : 1;
        const isCustom = c.type === 'custom';
        return c.roster.map((r) => ({
          conference_committee_id: created.id,
          country_code: getCountryByName(r.name)?.code ?? r.name,
          country_name: r.name,
          delegation_size: size,
          importance: r.importance,
          is_observer: !!r.isObserver,
          logo_url: r.logoUrl ?? null,
          group_id: isCustom ? (r.groupId && c.groups.some((g) => g.id === r.groupId) ? r.groupId : null) : null,
        }));
      });
      if (slotRows.length > 0) {
        const { error: slotsError } = await supabase
          .from('committee_country_slots')
          .insert(slotRows);
        if (slotsError) {
          console.error('Failed to seed committee seats:', slotsError.message);
        }
      }

      // Created, intent and all. Straight to the dashboard — `submitting` stays
      // true through the navigation so the button cannot fire a second time
      // while the route loads.
      router.push('/manage/' + slug);
    } catch (err) {
      setSubmitting(false);
      setError(friendlyError(err, 'Something went wrong. Please try again.'));
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
    if (!datesTbd && startDate && endDate && endDate < startDate) { setStepError('The end date cannot be before the start date.'); return; }
    if (logoUploading || bannerUploading) { setStepError('Wait for the upload to finish.'); return; }
    advance(1);
  }

  function continueStep4() {
    if (!country) { setStepError('Pick the country your conference is in.'); return; }
    if (!city.trim()) { setStepError('And the city, delegates will look for it.'); return; }
    advance(4);
  }

  function continueDelegates() {
    const n = parseInt(expectedDelegates);
    if (!expectedDelegates || isNaN(n) || n < 1) { setStepError('Give us a rough number of delegates.'); return; }
    advance(5);
  }

  function continueCommittees() {
    if (committees.length === 0) { setStepError('Add at least one committee. Delegates apply to a committee, not to a conference.'); return; }
    advance(6);
  }

  // Acronyms where there is one, so the row reads "UNSC, DISEC, WHO" rather
  // than three wrapped sentences. ReviewRow wraps a long list, never cuts it.
  const committeesSummary = committees.length
    ? committees.map((c) => committeeDisplayName(c.name, c.abbreviation)).join(', ')
    : 'None yet';

  // Titles rather than the admin's SHOUTING short codes: this row sits beside
  // "Committees" and "Logo" in a sentence-case list.
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
    intentKeys.length > 0;

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

            {/* ── Step 1, your conference: name, acronym, logo, banner, dates ── */}
            {step === 1 && (
              <WizardShell
                step={1} total={TOTAL_STEPS}
                maxWidth={1080}
                title="Your Conference"
                sub="Its name, its look and its dates. You can change any of it later."
                onBack={returnToReview ? back : undefined}
              >
                <IdentityStep
                  fullName={fullName}
                  acronym={acronym}
                  acronymError={acronymError}
                  onFullName={(v) => {
                    setFullName(v);
                    if (!acronymTouched.current) setAcronym(suggestAcronym(v));
                    setStepError('');
                  }}
                  onAcronym={(v) => {
                    acronymTouched.current = true;
                    setAcronym(v);
                    setStepError('');
                  }}
                  logoUrl={logoUrl}
                  logoUploading={logoUploading}
                  logoError={logoError}
                  onPickLogo={(f) => setLogoCropFile(f)}
                  bannerUrl={bannerUrl}
                  bannerUploading={bannerUploading}
                  bannerError={bannerError}
                  onPickBanner={(f) => handleBannerUpload(f)}
                  onBannerPreset={(src) => { setBannerUrl(src); setBannerError(''); }}
                  bannerPresets={BANNER_PRESETS}
                  startDate={startDate}
                  endDate={endDate}
                  datesTbd={datesTbd}
                  todayISO={todayISO}
                  onStartDate={(iso) => { setStartDate(iso); if (!endDate || endDate < iso) setEndDate(iso); setStepError(''); }}
                  onEndDate={(iso) => { setEndDate(iso); setStepError(''); }}
                  onToggleTbd={() => {
                    const next = !datesTbd;
                    setDatesTbd(next);
                    setStepError('');
                    if (next) { setStartDate(''); setEndDate(''); }
                  }}
                />
                {stepError && <ErrorNote>{stepError}</ErrorNote>}
                <ContinueButton
                  onClick={continueStep1}
                  disabled={
                    !fullName.trim() || !acronym.trim() || !!acronymError ||
                    logoUploading || bannerUploading ||
                    (!datesTbd && !!startDate && !!endDate && endDate < startDate)
                  }
                />
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
                  // Country names wrap rather than end in an ellipsis.
                  wrapText
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

            {/* ── Step 5, expected delegates ─────────────────────────── */}
            {step === 5 && (
              <WizardShell
                step={5} total={TOTAL_STEPS}
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
                <ContinueButton onClick={continueDelegates} disabled={!expectedDelegates || parseInt(expectedDelegates) < 1} />
              </WizardShell>
            )}

            {/* ── Step 6, committees (REQUIRED, no skip) ─────────────── */}
            {/* The page an organiser will run this conference from, in
                miniature: the committee cards /manage/[slug]/committees shows,
                one big plus to add, a card to edit. Adding and editing open THE
                SAME pop-up as that page (CommitteeEditorModal, draft mode):
                nothing is written until Create conference. */}
            {step === 6 && (
              <WizardShell
                step={6} total={TOTAL_STEPS}
                title="Set up your committees"
                sub="Delegates apply to a committee, so you need at least one. Add as many as you like, you can add more any time."
                onBack={back}
              >
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
                  <button
                    type="button"
                    onClick={openNewCommittee}
                    className="flex flex-col items-center justify-center gap-2 focus:outline-none focus-visible:shadow-[0_0_0_2px_#1B3828]"
                    style={{
                      minHeight: 176, borderRadius: 22,
                      border: '1.5px dashed rgba(27,56,40,0.26)',
                      backgroundColor: 'color-mix(in srgb, var(--gv-surface) 55%, transparent)',
                      color: NEU.forest, cursor: 'pointer',
                      transition: `background-color 220ms ${EASE}, border-color 220ms ${EASE}`,
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = NEU.forest; e.currentTarget.style.backgroundColor = 'color-mix(in srgb, var(--gv-surface) 90%, transparent)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(27,56,40,0.26)'; e.currentTarget.style.backgroundColor = 'color-mix(in srgb, var(--gv-surface) 55%, transparent)'; }}
                  >
                    <span
                      className="flex items-center justify-center"
                      style={{
                        width: 54, height: 54, borderRadius: 9999,
                        background: 'linear-gradient(150deg, color-mix(in srgb, var(--gv-main) 14%, transparent), color-mix(in srgb, var(--gv-main) 6%, transparent))',
                        border: '1.5px solid color-mix(in srgb, var(--gv-main) 20%, transparent)',
                      }}
                    >
                      <Plus size={26} strokeWidth={2.6} />
                    </span>
                    <span style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 800 }}>
                      {committees.length === 0 ? 'Add your first committee' : 'Add a committee'}
                    </span>
                  </button>
                </div>

                <p
                  style={{
                    fontFamily: OUTFIT, fontSize: 12.5, lineHeight: 1.6, color: NEU.inkSoft,
                    textAlign: 'center', marginTop: 18, padding: '0 8px',
                  }}
                >
                  Chairs come later in Manage&nbsp;→&nbsp;Committees, in this
                  same pop-up. Everything else is right here.
                </p>

                {stepError && <ErrorNote>{stepError}</ErrorNote>}
                <ContinueButton onClick={continueCommittees} disabled={committees.length === 0} />
              </WizardShell>
            )}

            {/* ── Step 7, description + socials (SKIPPABLE) ──────────── */}
            {step === 7 && (
              <WizardShell
                step={7} total={TOTAL_STEPS}
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
                      onFocus={focusForest}
                      onBlur={blurClear}
                    />
                    <div style={{ textAlign: 'right', marginTop: 6, fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 600, color: NEU.muted, fontVariantNumeric: 'tabular-nums' }}>
                      {description.length} / 1500
                    </div>
                  </div>

                  <div style={{ padding: '18px 20px', borderRadius: 16, backgroundColor: '#FFFFFF', boxShadow: CARD_SHADOW }}>
                    <FieldLabel>Social links</FieldLabel>
                    <div className="flex flex-col gap-3" style={{ marginTop: 4 }}>
                      <SocialInput Icon={Camera} label="Instagram" value={instagram} onChange={setInstagram} placeholder="@yourmun or instagram.com/yourmun" />
                      <SocialInput Icon={ThumbsUp} label="Facebook" value={facebook} onChange={setFacebook} placeholder="facebook.com/yourmun" />
                      <SocialInput Icon={Music2} label="TikTok" value={tiktok} onChange={setTiktok} placeholder="@yourmun" />
                      <SocialInput Icon={MessageCircle} label="WhatsApp" value={whatsapp} onChange={setWhatsapp} placeholder="wa.me/44… or your number" />
                      <SocialInput Icon={Globe} label="Website" value={website} onChange={setWebsite} placeholder="yourmun.org" />
                    </div>
                  </div>
                </div>

                <ContinueButton onClick={() => advance(7)} />
                <div className="flex justify-center" style={{ marginTop: 12 }}>
                  <SkipLink
                    onClick={() => {
                      setDescription('');
                      setInstagram(''); setFacebook(''); setTiktok(''); setWhatsapp(''); setWebsite('');
                      advance(7);
                    }}
                    label="Do this later"
                  />
                </div>
              </WizardShell>
            )}

            {/* ── Step 8, what they will use Gavelling for (REQUIRED) ─── */}
            {step === 8 && (
              <WizardShell
                step={8} total={TOTAL_STEPS}
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
                  onClick={() => (intentKeys.length > 0 ? advance(8) : setStepError('Pick at least one.'))}
                />
              </WizardShell>
            )}

            {/* ── Step 9, review + create ────────────────────────────── */}
            {step === REVIEW_STEP && (
              <WizardShell
                step={REVIEW_STEP} total={TOTAL_STEPS}
                title="Ready to create it?"
                sub="Check everything over, tap any row to change it."
                onBack={back}
              >
                <div className="flex flex-col gap-2.5">
                  <ReviewRow label="Conference" value={`${fullName} (${acronym.trim()})`} onEdit={() => editFromReview(1)} />
                  <ReviewRow label="Logo" value={logoUrl ? 'Added' : 'Skipped'} onEdit={() => editFromReview(1)} />
                  <ReviewRow label="Banner" value={bannerUrl ? 'Added' : 'Skipped'} onEdit={() => editFromReview(1)} />
                  <ReviewRow label="Dates" value={datesTbd ? 'To be decided' : (formatDateRange(startDate, endDate) || 'Not set')} onEdit={() => editFromReview(1)} />
                  <ReviewRow label="Format" value={format === 'in-person' ? 'In person' : format === 'online' ? 'Online' : 'Hybrid'} onEdit={() => editFromReview(2)} />
                  <ReviewRow label="Level" value={studentLevel === 'school' ? 'High school' : studentLevel === 'university' ? 'University' : 'Both'} onEdit={() => editFromReview(3)} />
                  <ReviewRow label="Location" value={`${city}, ${country}`} onEdit={() => editFromReview(4)} />
                  <ReviewRow label="Expected delegates" value={expectedDelegates || 'Not set'} onEdit={() => editFromReview(5)} />
                  <ReviewRow
                    label={`Committees (${committees.length})`}
                    value={committeesSummary}
                    onEdit={() => editFromReview(6)}
                  />
                  <ReviewRow label="Description" value={description.trim() ? 'Added' : 'Skipped'} onEdit={() => editFromReview(7)} />
                  <ReviewRow label="Social links" value={socialsSummary || 'Skipped'} onEdit={() => editFromReview(7)} />
                  <ReviewRow label="Using Gavelling for" value={intentSummary} onEdit={() => editFromReview(8)} />
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
                  <PrimaryButton
                    onClick={handleCreate}
                    disabled={submitting || !readyToCreate || !contactEmail.trim()}
                    style={{ padding: '14px 38px' }}
                  >
                    {submitting ? 'Creating' : 'Create conference'}
                  </PrimaryButton>
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

      {/* THE DASHBOARD'S COMMITTEE POP-UP, in draft mode. Keyed per opening,
          so it always starts from the committee being edited (or empty). Its
          emblem and seat-flag uploads go to storage under the id minted for
          this conference, exactly like the logo and banner above; nothing is
          written to the database until Create conference. */}
      {committeeModal && (
        <CommitteeEditorModal
          key={committeeModal.nonce}
          conference={{ id: conferenceIdRef.current }}
          committee={null}
          onSaved={() => {}}
          onClose={() => setCommitteeModal(null)}
          draft={{
            initial: committeeModal.editingKey
              ? committees.find((c) => c.key === committeeModal.editingKey) ?? null
              : null,
            onSave: (d) => saveDraftCommittee(committeeModal.editingKey, d),
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
      className="w-full flex items-center gap-3 text-left focus:outline-none focus-visible:shadow-[0_0_0_2px_#1B3828]"
      style={{
        padding: '12px 16px',
        borderRadius: 12,
        border: 'none',
        backgroundColor: '#FFFFFF',
        boxShadow: hovered ? CARD_SHADOW_HOVER : CARD_SHADOW,
        transition: `box-shadow 220ms ${EASE}`,
        cursor: 'pointer',
      }}
    >
      <span
        style={{
          fontFamily: OUTFIT, fontSize: 13, fontWeight: 600,
          color: NEU.inkSoft, width: 140, flexShrink: 0,
        }}
      >
        {label}
      </span>
      <span
        className="flex-1 min-w-0"
        style={{ fontFamily: OUTFIT, fontSize: 14.5, fontWeight: 700, color: NEU.ink, fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere' }}
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
