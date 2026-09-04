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
import { AlertTriangle, ArrowRight, Mail, Pencil, Upload, Check, ImagePlus, Camera, ThumbsUp, Music2, MessageCircle, Globe, Plus, X, type LucideIcon } from 'lucide-react';
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
import { currencyPickerGroups } from '@/lib/currencies';
import { normalizeSocialUrl } from '@/lib/socialLinks';
import { acronymProblem } from '@/lib/conferenceLabels';
import { committeeDisplayName, deriveCommitteeAcronym, matchPresetEmblem } from '@/lib/presetNames';

const CURRENCY_GROUPS = currencyPickerGroups();

// Mirrors settings' ensureRoleConfigs default set (source of truth there) —
// seeded here too so a freshly created conference already has per-role fee
// configs instead of relying on that lazy $0-delegate-fee fallback.
const ROLE_DEFAULTS = ['delegate', 'chair', 'head-delegate', 'faculty-advisor', 'observer'] as const;

// ── Step model ─────────────────────────────────────────────────────────────

const TOTAL_STEPS = 12;
const REVIEW_STEP = TOTAL_STEPS;
// 1 name+acronym · 2 format · 3 level · 4 where · 5 when · 6 delegates (skippable)
// · 7 committees (REQUIRED) · 8 fee · 9 logo (skippable) · 10 banner (skippable)
// · 11 description + socials (skippable) · 12 review. Every skippable step's
// "Do this later" leaves it exactly as editable from Settings afterwards as it
// already was.
//
// WHY COMMITTEES SIT AT 7. A conference with no committees cannot receive a
// meaningful application, and the wizard used to let organisers leave without
// one: 76 of 169 conferences never added a single committee, and the setup
// checklist's committee item is the first and biggest funnel cliff (169 → 83).
// So the step is REQUIRED — it is the only non-skippable answer after step 5.
// It goes here, straight after the head count, because "how many delegates"
// and "which rooms do they sit in" are one thought, and because everything
// from 9 on is presentation and skippable: a mandatory step must not land
// AFTER a run of skippable ones, where the organiser has already built up
// "skip everything" momentum. Seats and countries are deliberately NOT asked
// here — they belong to the full editor at /manage/[slug]/committees, and the
// step says so.

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
const QUICK_COMMITTEES: string[] = [
  'UN Security Council',
  'UN General Assembly',
  'Disarmament and International Security Committee',
  'Social, Humanitarian and Cultural Committee',
  'Economic and Social Council',
  'UN Human Rights Council',
  'World Health Organization',
  'Crisis Committee',
];

/** A committee as collected by the wizard — name plus an optional acronym, and
 *  nothing else. Countries, seats, topics and difficulty are the full editor's
 *  job at /manage/[slug]/committees. */
interface DraftCommittee {
  /** Local list key only. The DB mints the real id. */
  key: string;
  name: string;
  /** '' when the organiser gave none and none could be derived. */
  abbreviation: string;
}

/** Case/space-insensitive identity, so "unsc " and "UNSC" are one committee. */
function committeeKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

function makeDraftCommittee(name: string, abbreviation?: string): DraftCommittee {
  const trimmed = name.trim();
  return {
    key: crypto.randomUUID(),
    name: trimmed,
    abbreviation: (abbreviation ?? '').trim() || deriveCommitteeAcronym(trimmed),
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

/** One committee already on the list (step 7). Shows the emblem the full editor
 *  would auto-assign, the AGENTS.md UI-rule label (acronym big, full name small
 *  beneath when they differ), and a remove control. */
function DraftCommitteeRow({ committee, onRemove }: { committee: DraftCommittee; onRemove: () => void }) {
  const [hovered, setHovered] = useState(false);
  const emblem = matchPresetEmblem(committee.name, committee.abbreviation);
  const primary = committeeDisplayName(committee.name, committee.abbreviation);
  const secondary = primary !== committee.name ? committee.name : null;
  return (
    <div
      className="flex items-center gap-3"
      style={{
        padding: '11px 12px 11px 14px',
        borderRadius: 14,
        backgroundColor: NEU.surface,
        boxShadow: NEU.outSm,
      }}
    >
      <span
        aria-hidden
        className="flex items-center justify-center flex-shrink-0"
        style={{
          width: 34, height: 34, borderRadius: 999,
          backgroundColor: NEU.base, boxShadow: NEU.inSm, overflow: 'hidden',
        }}
      >
        {emblem ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={emblem} alt="" style={{ width: 22, height: 22, objectFit: 'contain' }} />
        ) : (
          <Emoji3D name="Classical building" size={20} />
        )}
      </span>
      <span className="flex-1 min-w-0">
        <span
          className="block truncate"
          style={{ fontFamily: OUTFIT, fontSize: 14.5, fontWeight: 700, color: NEU.ink }}
        >
          {primary}
        </span>
        {secondary && (
          <span
            className="block truncate"
            style={{ fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 500, color: NEU.inkSoft, marginTop: 1 }}
          >
            {secondary}
          </span>
        )}
      </span>
      <button
        type="button"
        onClick={onRemove}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        aria-label={`Remove ${committee.name}`}
        className="flex items-center justify-center flex-shrink-0 focus:outline-none"
        style={{
          width: 30, height: 30, borderRadius: 999, border: 'none',
          backgroundColor: NEU.base,
          boxShadow: hovered ? NEU.outSmHover : NEU.outSm,
          color: hovered ? '#8B2020' : NEU.muted,
          cursor: 'pointer',
          transition: `color 200ms ${EASE}, box-shadow 200ms ${EASE}`,
        }}
      >
        <X size={15} strokeWidth={2.6} />
      </button>
    </div>
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
    .map((w) => w[0].toUpperCase())
    .join('');
  if (!initials) return '';
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
  const [committees, setCommittees] = useState<DraftCommittee[]>([]);
  const [committeeName, setCommitteeName] = useState('');
  const [committeeAbbr, setCommitteeAbbr] = useState('');
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

  function addCommittee(name: string, abbreviation?: string) {
    const trimmed = name.trim();
    if (!trimmed) { setStepError('Give the committee a name.'); return; }
    if (committeeKeys.has(committeeKey(trimmed))) { setStepError(`${trimmed} is already on your list.`); return; }
    setCommittees((prev) => [...prev, makeDraftCommittee(trimmed, abbreviation)]);
    setStepError('');
  }

  function removeCommittee(key: string) {
    setCommittees((prev) => prev.filter((c) => c.key !== key));
  }

  /** One-tap preset card: adds it, or takes it back off if it is already on. */
  function toggleQuickCommittee(name: string) {
    const k = committeeKey(name);
    if (committeeKeys.has(k)) {
      setCommittees((prev) => prev.filter((c) => committeeKey(c.name) !== k));
      setStepError('');
      return;
    }
    addCommittee(name);
  }

  function addTypedCommittee() {
    const trimmed = committeeName.trim();
    if (!trimmed) { setStepError('Give the committee a name.'); return; }
    if (committeeKeys.has(committeeKey(trimmed))) { setStepError(`${trimmed} is already on your list.`); return; }
    addCommittee(trimmed, committeeAbbr);
    setCommitteeName('');
    setCommitteeAbbr('');
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
            expected_delegates: expectedDelegates ? parseInt(expectedDelegates) : null,
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
      // Only name + abbreviation come from the wizard. difficulty,
      // committee_type and delegation_size take their column defaults
      // ('intermediate', 'general-assembly', 1); `topics` stays empty, which
      // the 1..3 CHECK permits (array_length of an empty array is NULL, and a
      // third of production rows already sit this way). The emblem is resolved
      // by the same matcher CommitteeEditorModal auto-assigns with.
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

      setSubmitting(false);
      router.push('/manage/' + slug);
    } catch (err) {
      setSubmitting(false);
      setError('Unexpected error: ' + (err instanceof Error ? err.message : String(err)));
    }
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
    // The one hard gate in the wizard. A committee typed but not yet added
    // counts — nobody should lose a room to an unpressed Add button.
    if (committeeName.trim() && !committeeKeys.has(committeeKey(committeeName))) {
      addCommittee(committeeName, committeeAbbr);
      setCommitteeName('');
      setCommitteeAbbr('');
      advance(7);
      return;
    }
    if (committees.length === 0) { setStepError('Add at least one committee — delegates apply to a committee, not to a conference.'); return; }
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

  const socialsSummary = [
    instagram.trim() && 'Instagram',
    facebook.trim() && 'Facebook',
    tiktok.trim() && 'TikTok',
    whatsapp.trim() && 'WhatsApp',
    website.trim() && 'Website',
  ].filter(Boolean).join(', ');

  // Logo and expected delegates are both skippable now (their steps carry a
  // "Do this later" escape hatch) — neither gates creation. A non-empty
  // expected-delegates value still has to be a real positive number, it's
  // only the empty (skipped) case that's tolerated. Committees DO gate it:
  // one is the minimum a conference needs to be applied to at all.
  const readyToCreate =
    fullName.trim() && acronym.trim() && !acronymProblem(acronym) && contactEmail.trim() &&
    studentLevel && country && city.trim() && format &&
    (!expectedDelegates || parseInt(expectedDelegates) > 0) &&
    committees.length > 0 &&
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
                sub="A rough number is fine, you can refine it later."
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
                <ContinueButton onClick={continueStep6} disabled={!expectedDelegates || parseInt(expectedDelegates) < 1} />
                <div className="flex justify-center" style={{ marginTop: 12 }}>
                  <SkipLink onClick={() => { setExpectedDelegates(''); setDelegateRange(''); advance(6); }} label="Do this later" />
                </div>
              </WizardShell>
            )}

            {/* ── Step 7, committees (REQUIRED, no skip) ─────────────── */}
            {step === 7 && (
              <WizardShell
                step={7} total={TOTAL_STEPS}
                title="Which committees will you run?"
                sub="Delegates apply to a committee, so you need at least one. Tap the ones you're running, or type your own — the rest can wait."
                onBack={back}
              >
                <CardSelect
                  options={QUICK_COMMITTEES.map((name) => {
                    const acr = deriveCommitteeAcronym(name);
                    const emblem = matchPresetEmblem(name, acr);
                    return {
                      key: name,
                      label: committeeDisplayName(name, acr),
                      sub: committeeDisplayName(name, acr) === name ? undefined : name,
                      icon: emblem ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={emblem} alt="" style={{ width: 40, height: 40, objectFit: 'contain' }} />
                      ) : (
                        <Emoji3D name="Classical building" size={40} />
                      ),
                    };
                  })}
                  value={committees.map((c) => c.name)}
                  onChange={toggleQuickCommittee}
                  multiple
                  columns={4}
                />

                {/* Free text, for every committee no preset covers. Deliberately
                    NOT a typeahead: the presets are already on screen as cards,
                    so there is no floating layer here to clip. */}
                <div style={{ marginTop: 18 }}>
                  <FieldLabel>Or add your own</FieldLabel>
                  {/* One row on desktop; on a phone the name takes the full
                      width and the short name + Add share the line below it,
                      so the name field never shrinks to a stub. */}
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="text"
                      value={committeeName}
                      onChange={(e) => { setCommitteeName(e.target.value); setStepError(''); }}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTypedCommittee(); } }}
                      placeholder="e.g. Historical Crisis: Cuban Missile Crisis"
                      style={{ ...bigInputStyle, flex: 1, minWidth: 0 }}
                      onFocus={focusForest}
                      onBlur={blurClear}
                    />
                    <div className="flex gap-3">
                      <input
                        type="text"
                        value={committeeAbbr}
                        onChange={(e) => setCommitteeAbbr(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTypedCommittee(); } }}
                        aria-label="Committee abbreviation (optional)"
                        placeholder="Short"
                        style={{ ...bigInputStyle, width: 108, flexShrink: 0, letterSpacing: '0.06em' }}
                        onFocus={focusForest}
                        onBlur={blurClear}
                      />
                      <NeuButton
                        onClick={addTypedCommittee}
                        disabled={!committeeName.trim()}
                        icon={Plus}
                        style={{ padding: '13px 22px', fontSize: 13, flex: 1 }}
                      >
                        ADD
                      </NeuButton>
                    </div>
                  </div>
                </div>

                {committees.length > 0 && (
                  <NeuInset style={{ padding: '16px 18px', borderRadius: 20, marginTop: 18 }}>
                    <FieldLabel>
                      {committees.length} committee{committees.length === 1 ? '' : 's'}
                    </FieldLabel>
                    <div className="flex flex-col gap-2.5" style={{ marginTop: 4 }}>
                      {committees.map((c) => (
                        <DraftCommitteeRow key={c.key} committee={c} onRemove={() => removeCommittee(c.key)} />
                      ))}
                    </div>
                  </NeuInset>
                )}

                <p
                  style={{
                    fontFamily: OUTFIT, fontSize: 12.5, lineHeight: 1.6, color: NEU.inkSoft,
                    textAlign: 'center', marginTop: 16, padding: '0 8px',
                  }}
                >
                  Just the names for now — countries, seats, topics and chairs come later
                  in Manage&nbsp;→&nbsp;Committees, and you can add more committees any time.
                </p>

                {stepError && <ErrorNote>{stepError}</ErrorNote>}
                <ContinueButton
                  onClick={continueStep7}
                  disabled={committees.length === 0 && !committeeName.trim()}
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
                    <div className="flex gap-3">
                      <select
                        value={feeCurrency}
                        onChange={(e) => setFeeCurrency(e.target.value)}
                        style={{ ...bigInputStyle, width: 132, cursor: 'pointer', backgroundColor: NEU.surface, boxShadow: NEU.outSm }}
                        onFocus={focusForest}
                        onBlur={blurClear}
                      >
                        {CURRENCY_GROUPS.pinned.map((c) => (
                          <option key={c.code} value={c.code} title={c.name}>
                            {c.symbol} {c.code}
                          </option>
                        ))}
                        <option disabled>──────────</option>
                        {CURRENCY_GROUPS.rest.map((c) => (
                          <option key={c.code} value={c.code} title={c.name}>
                            {c.symbol} {c.code}
                          </option>
                        ))}
                      </select>
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

                <ContinueButton label="Continue to review" onClick={() => advance(11)} />
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

            {/* ── Step 11, review + create ───────────────────────────── */}
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
                  <ReviewRow label="Expected delegates" value={expectedDelegates || 'Skipped'} onEdit={() => editFromReview(6)} />
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
