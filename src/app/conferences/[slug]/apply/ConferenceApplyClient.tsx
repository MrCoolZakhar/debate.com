'use client';

import { Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import SiteNav from '@/components/SiteNav';
import Portal from '@/components/Portal';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient, getFreshAuthedClient } from '@/lib/supabase-auth';
import { useCredits } from '@/hooks/useCredits';
import { getFlagUrl, getCountryByName } from '@/lib/countries';
import { ageAt } from '@/lib/age';
import { formatFee } from '@/lib/utils';
import { Pill, LevelInsignia, LEVEL_ACCENT } from '@/app/account/accountUi';
import { experienceProgress, EXPERIENCE_BANDS } from '@/lib/munExperience';
import { creditPricing, extractFunctionErrorMessage } from '@/lib/payments';
import { computeCheckout, activePhaseFee, type VoucherInput, type FeePhase } from '@/lib/finance';
import { queueParticipantEventEmail } from '@/lib/emailEvents';
import { NEU, NeuInset, NeuCard, OUTFIT, EASE, Emoji3D } from '@/components/neu';
import { WizardShell, TwoTabPick } from '@/components/wizard';
import { CVEntryModal } from '@/components/CVEntryModal';
import { LogoDisc } from '@/components/LogoDisc';
import { FlagImg } from '@/components/FlagImg';
import { DatePicker } from '@/components/DatePicker';
import CustomQuestionsField from '@/components/CustomQuestionsField';
import { type CustomAnswers, normalizeBlocks, questionsOf, splitIntoSections, validateAnswers, answerIsEmpty, displayAnswer } from '@/lib/customQuestions';
import {
  Gavel, Users, Sprout,
  GraduationCap, Trophy, Crown, Sparkles,
  MapPin, Landmark, Check, X, Plus, Minus, ArrowRight, CalendarClock,
  Ticket, Infinity as InfinityIcon, Globe, Lock, ChevronUp, ChevronDown,
  Info, Coins,
} from 'lucide-react';

const GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23grain)' opacity='1'/%3E%3C/svg%3E")`;

// ── Types ──────────────────────────────────────────────────────────────────

/** Organiser-controlled: what a delegate may express as preferences. */
type PreferenceMode =
  | 'committees_and_countries'
  | 'committees_only'
  | 'countries_only'
  | 'none';

interface Conference {
  id: string;
  slug: string;
  full_name: string;
  acronym: string;
  fee_amount: number;
  fee_currency: string;
  start_date: string;
  min_age: number | null;
  logo_url: string | null;
  delegate_preference_mode: PreferenceMode;
  credits_sponsored: boolean;
}

interface RoleConfig {
  role: string;
  is_enabled: boolean;
  applications_open_at: string | null;
  applications_close_at: string | null;
  fee_amount: number;
  fee_currency: string;
  auto_accept: boolean;
  pay_at_application: boolean;
  payment_timing: 'after_application' | 'after_acceptance' | 'anytime' | string;
  custom_questions: unknown[];
  fee_phases: FeePhase[] | null;
}

interface CommitteeOption {
  id: string;
  name: string;
  abbreviation: string | null;
  topics: string[];
  difficulty: string;
  total_slots: number;
  logo_url: string | null;
  committee_type: string | null;
}

interface CountrySlot {
  id: string;
  country_code: string;
  country_name: string;
}

interface Society {
  id: string;
  name: string;
  name_normalized: string;
}

interface Preference {
  committeeId: string;
  committeeName: string;
  countryCode: string;
  countryName: string;
}

/** The applicant's own existing application for this role — the "already
 *  applied" gate, and (when editable) the prefill source for edit mode. */
interface ExistingApp {
  id: string;
  status: string;
  is_independent: boolean;
  society_id: string | null;
  experience_level: string | null;
  custom_answers: CustomAnswers | null;
  pledge_type: 'delegation' | null;
  spots_pledged: number | null;
  advisors_pledged: number | null;
}

/** An active (submitted/accepted/assigned/checked-in) application the user
 *  holds at this SAME conference under a DIFFERENT role — the one-active-
 *  application-per-conference gate. Rejected/withdrawn never populate this. */
interface OtherActiveApp {
  id: string;
  role: string;
  status: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

type IconType = typeof Gavel;

/** Escalating insignia per experience level (recruit → prestige). */
const EXPERIENCE_ICON: Record<string, IconType> = {
  beginner: Sprout,
  intermediate: GraduationCap,
  advanced: Trophy,
  expert: Crown,
};

const EXPERIENCE_ACCENT: Record<string, string> = {
  beginner: '#4A7896',
  intermediate: '#2A5A3C',
  advanced: '#B8844A',
  expert: '#B6871F',
};

/** Committee difficulty tier → label, accent colour and insignia. The four
 *  difficulty values map 1:1 to the experience tiers, so they reuse the same
 *  escalating insignia language. */
const DIFFICULTY_META: Record<string, { label: string; accent: string; icon: IconType }> = {
  beginner: { label: 'Beginner', accent: '#4A7896', icon: Sprout },
  intermediate: { label: 'Intermediate', accent: '#2A5A3C', icon: GraduationCap },
  advanced: { label: 'Advanced', accent: '#B8844A', icon: Trophy },
  expert: { label: 'Expert', accent: '#B6871F', icon: Crown },
};

/**
 * Shared step footer — the SAME centered pill button the delegate onboarding
 * wizard uses (src/app/auth/onboarding StepFooter): a filled forest/gold pill
 * for a real "Continue" / "Submit", or an underlined muted link when the step
 * is genuinely optional and nothing has been chosen ("Skip this question →").
 * WizardShell already owns the back arrow, so no back button lives here.
 */
function WizardFooter({
  onNext,
  nextLabel,
  primary,
  disabled = false,
}: {
  onNext: () => void;
  nextLabel: string;
  /** true → filled pill (Continue/Submit); false → underlined skip link. */
  primary: boolean;
  disabled?: boolean;
}) {
  const [hover, setHover] = useState(false);
  const [pressed, setPressed] = useState(false);
  return (
    <div className="flex justify-center" style={{ marginTop: 26 }}>
      <button
        type="button"
        onClick={onNext}
        disabled={disabled}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onPointerDown={() => setPressed(true)}
        onPointerUp={() => setPressed(false)}
        onPointerLeave={() => setPressed(false)}
        className="inline-flex items-center gap-2 focus:outline-none"
        style={{
          fontFamily: OUTFIT,
          fontWeight: 800,
          fontSize: 14,
          letterSpacing: '0.06em',
          padding: '14px 34px',
          borderRadius: 999,
          border: 'none',
          cursor: disabled ? 'default' : 'pointer',
          color: primary ? NEU.gold : NEU.muted,
          background: primary ? NEU.forest : 'transparent',
          boxShadow: primary ? (hover ? NEU.outSmHover : NEU.outSm) : 'none',
          textDecoration: primary ? 'none' : 'underline',
          textUnderlineOffset: 4,
          opacity: disabled ? 0.6 : 1,
          transform: `${primary && hover && !disabled ? 'translateY(-1px)' : 'translateY(0)'}${pressed && !disabled ? ' scale(0.96)' : ''}`,
          transition: `background-color 220ms ${EASE}, box-shadow 220ms ${EASE}, transform 160ms ${EASE}, opacity 220ms ${EASE}`,
        }}
      >
        {nextLabel}
        <ArrowRight size={16} strokeWidth={2.6} />
      </button>
    </div>
  );
}

/** Roles a Gavelling credit is charged for at submission — chairs and any
 *  other role are exempt (see consume_credit_for_application). */
const CREDIT_CHARGED_ROLES = ['delegate', 'head-delegate', 'faculty-advisor', 'observer'];

/**
 * The "ℹ️" credit explainer. Per the UI rules, hint/info affordances reveal on
 * HOVER (not click), and — since the Overview card that hosts it doesn't clip
 * overflow — still goes through Portal at fixed viewport coordinates so it can
 * never be cut off if that card's styling changes later (mirrors PaymentMenu's
 * portal pattern in the applications page).
 */
function CreditInfoTip() {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const place = useCallback(() => {
    const b = btnRef.current;
    if (!b) return;
    const r = b.getBoundingClientRect();
    const panelW = 280;
    const left = Math.min(Math.max(8, r.right - panelW), window.innerWidth - panelW - 8);
    setPos({ top: r.bottom + 8, left });
  }, []);

  const openNow = () => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
    place();
    setOpen(true);
  };
  const scheduleClose = () => {
    closeTimer.current = setTimeout(() => setOpen(false), 200);
  };

  useEffect(() => {
    if (!open) return;
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, place]);

  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label="What are Gavelling credits?"
        onMouseEnter={openNow}
        onMouseLeave={scheduleClose}
        onFocus={openNow}
        onBlur={scheduleClose}
        className="flex items-center justify-center rounded-full focus:outline-none"
        style={{ width: 24, height: 24, backgroundColor: 'rgba(27,56,40,0.08)', border: 'none', cursor: 'default' }}
      >
        <Info size={13} strokeWidth={2.4} style={{ color: NEU.forest }} />
      </button>
      {open && pos && (
        <Portal>
          <div
            onMouseEnter={openNow}
            onMouseLeave={scheduleClose}
            style={{
              position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999, width: 280,
              backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', borderRadius: 14,
              boxShadow: '0 10px 30px rgba(27,56,40,0.18)', padding: 14,
            }}
          >
            <p className="text-xs leading-relaxed mb-2" style={{ color: 'rgba(28,20,16,0.8)', fontFamily: OUTFIT }}>
              Credits are how Gavelling covers processing and platform automation. They&apos;re separate from what you pay the conference itself.
            </p>
            <p className="text-xs leading-relaxed mb-2" style={{ color: 'rgba(28,20,16,0.8)', fontFamily: OUTFIT }}>
              Credits can be bought individually or in bulk, and they&apos;re included with every subscription.
            </p>
            <p className="text-xs leading-relaxed font-semibold" style={{ color: NEU.forest, fontFamily: OUTFIT }}>
              Credits are refunded if your application is rejected, or if you no longer attend the conference.
            </p>
          </div>
        </Portal>
      )}
    </>
  );
}

/** SSR-safe prefers-reduced-motion hook. */
function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);
  return reduced;
}

// ── Preference-picker building blocks ─────────────────────────────────────

/** Difficulty tier chip: the SAME escalating delegate-rank insignia used for a
 *  delegate's MUN level (chevron marks + crowned star) — so a committee's level
 *  reads with the exact iconography as a delegate's rank. */
function DifficultyBadge({ difficulty }: { difficulty: string }) {
  const key = (difficulty ?? '').toLowerCase();
  const meta = DIFFICULTY_META[key];
  if (!meta) return null;
  const accent = LEVEL_ACCENT[key] ?? meta.accent;
  return (
    <span
      className="inline-flex items-center gap-1"
      style={{
        padding: '3px 9px 3px 6px',
        borderRadius: 999,
        background: `${accent}14`,
        border: `1px solid ${accent}44`,
        fontFamily: OUTFIT,
        fontWeight: 800,
        fontSize: 10,
        letterSpacing: '0.05em',
        color: accent,
      }}
    >
      <LevelInsignia level={key} size={13} />
      {meta.label}
    </span>
  );
}

/**
 * Rich, image-forward committee card. The committee emblem (logo_url via
 * LogoDisc, monogram fallback) leads; abbreviation, difficulty, topics and a
 * live availability meter follow. Tactile neumorphic press; a gold rank
 * medallion or check marks selection.
 */
function CommitteeCard({
  committee, openCount, totalCount, rank, active, disabled, showAvailability, onClick, reducedMotion,
}: {
  committee: CommitteeOption;
  openCount: number;
  totalCount: number;
  rank: number | null;
  active: boolean;
  disabled: boolean;
  showAvailability: boolean;
  onClick: () => void;
  reducedMotion: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const selected = rank != null || active;
  const monogram = (committee.abbreviation || committee.name).slice(0, 3).toUpperCase();
  const pct = totalCount > 0 ? Math.max(0, Math.min(1, openCount / totalCount)) : 0;
  const meterColor = openCount <= 0 ? '#8B2020' : openCount <= 2 ? '#B8844A' : NEU.green;

  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      aria-pressed={selected}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      className="relative w-full text-left focus:outline-none"
      style={{
        display: 'flex',
        gap: 14,
        alignItems: 'flex-start',
        padding: '16px 16px 15px',
        borderRadius: 20,
        backgroundColor: NEU.surface,
        border: selected ? '1.5px solid rgba(182,135,31,0.55)' : '1.5px solid transparent',
        boxShadow: selected
          ? `0 0 0 1px rgba(182,135,31,0.25), ${NEU.out}`
          : disabled ? NEU.inSm : hovered ? NEU.outHover : NEU.out,
        transform: `${!disabled && !reducedMotion && (hovered || selected) ? 'translateY(-2px)' : 'translateY(0)'}${pressed && !disabled && !reducedMotion ? ' scale(0.96)' : ''}`,
        opacity: disabled ? 0.6 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: reducedMotion ? 'none' : `box-shadow 240ms ${EASE}, transform 240ms ${EASE}, border-color 200ms ${EASE}`,
      }}
    >
      <LogoDisc src={committee.logo_url} alt={committee.name} size={54} fallbackText={monogram} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap" style={{ marginBottom: 3 }}>
          {committee.abbreviation && (
            <span style={{ fontFamily: OUTFIT, fontWeight: 900, fontSize: 15, color: NEU.ink, letterSpacing: '0.01em' }}>
              {committee.abbreviation}
            </span>
          )}
          <DifficultyBadge difficulty={committee.difficulty} />
        </div>
        <p className="truncate" style={{ fontFamily: OUTFIT, fontWeight: 600, fontSize: 12.5, color: NEU.muted, marginBottom: committee.topics?.length ? 8 : 0 }}>
          {committee.name}
        </p>

        {committee.topics?.length > 0 && (
          <div className="flex flex-wrap gap-1.5" style={{ marginBottom: showAvailability ? 10 : 0 }}>
            {committee.topics.slice(0, 2).map((t, i) => (
              <span
                key={i}
                className="truncate"
                style={{
                  maxWidth: 190, padding: '2.5px 8px', borderRadius: 999,
                  backgroundColor: 'rgba(27,56,40,0.06)', color: 'rgba(28,20,16,0.7)',
                  fontFamily: OUTFIT, fontWeight: 600, fontSize: 10.5,
                }}
              >
                {t}
              </span>
            ))}
            {committee.topics.length > 2 && (
              <span style={{ padding: '2.5px 6px', fontFamily: OUTFIT, fontWeight: 700, fontSize: 10.5, color: NEU.muted }}>
                +{committee.topics.length - 2}
              </span>
            )}
          </div>
        )}

        {showAvailability && (
          <div className="flex items-center gap-2.5">
            <div style={{ flex: 1, height: 6, borderRadius: 999, backgroundColor: NEU.base, boxShadow: NEU.inSm, overflow: 'hidden', maxWidth: 150 }}>
              <div style={{ width: `${pct * 100}%`, height: '100%', borderRadius: 999, background: meterColor, transition: reducedMotion ? 'none' : `width 500ms ${EASE}` }} />
            </div>
            <span style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 10.5, color: meterColor, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
              {openCount <= 0 ? 'FULL' : `${openCount} of ${totalCount} open`}
            </span>
          </div>
        )}
      </div>

      {/* Selection insignia: gold rank medallion (committees_only) or a check. */}
      {rank != null ? (
        <span
          className="flex items-center justify-center flex-shrink-0"
          style={{
            width: 28, height: 28, borderRadius: 999,
            background: 'linear-gradient(150deg, #EED98A, #B6871F)',
            boxShadow: '0 3px 8px rgba(182,135,31,0.4)',
            fontFamily: OUTFIT, fontWeight: 900, fontSize: 13, color: '#3A2A08',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {rank}
        </span>
      ) : active ? (
        <span className="flex items-center justify-center flex-shrink-0" style={{ width: 28, height: 28, borderRadius: 999, backgroundColor: NEU.forest }}>
          <Check size={16} strokeWidth={3} style={{ color: NEU.gold }} />
        </span>
      ) : disabled ? (
        <span className="flex items-center justify-center flex-shrink-0" style={{ width: 28, height: 28, borderRadius: 999, backgroundColor: 'rgba(139,32,32,0.1)' }}>
          <Lock size={13} strokeWidth={2.4} style={{ color: '#8B2020' }} />
        </span>
      ) : (
        <ChevronDown
          size={20}
          strokeWidth={2.4}
          style={{ color: NEU.muted, flexShrink: 0, transform: active ? 'rotate(180deg)' : 'none', transition: reducedMotion ? 'none' : `transform 200ms ${EASE}` }}
        />
      )}
    </button>
  );
}

/** Country slot as a flag chip. Taken → greyed + lock; selectable → tactile. */
function CountryChip({
  code, name, committeeLabel, taken, selected, onClick, reducedMotion,
}: {
  code: string;
  name: string;
  committeeLabel?: string;
  taken: boolean;
  selected: boolean;
  onClick: () => void;
  reducedMotion: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const resolved = code || getCountryByName(name)?.code || '';
  return (
    <button
      type="button"
      onClick={taken ? undefined : onClick}
      disabled={taken}
      aria-pressed={selected}
      title={taken ? `${name} — already taken` : name}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      className="relative inline-flex items-center gap-2 focus:outline-none"
      style={{
        padding: '7px 12px 7px 9px',
        borderRadius: 999,
        backgroundColor: selected ? NEU.forest : NEU.surface,
        border: selected ? '1.5px solid transparent' : taken ? '1.5px solid transparent' : '1.5px solid transparent',
        boxShadow: taken ? NEU.inSm : selected ? `0 3px 8px rgba(27,56,40,0.28), ${NEU.outSm}` : hovered ? NEU.outSmHover : NEU.outSm,
        opacity: taken ? 0.5 : 1,
        cursor: taken ? 'not-allowed' : 'pointer',
        transform: `${!taken && !reducedMotion && hovered && !selected ? 'translateY(-1px)' : 'translateY(0)'}${pressed && !taken && !reducedMotion ? ' scale(0.96)' : ''}`,
        transition: reducedMotion ? 'none' : `box-shadow 200ms ${EASE}, transform 200ms ${EASE}`,
        filter: taken ? 'grayscale(1)' : 'none',
      }}
    >
      <FlagImg code={resolved} size={22} />
      <span className="min-w-0">
        <span className="block truncate" style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: 12.5, color: selected ? NEU.gold : NEU.ink, maxWidth: 150 }}>
          {name}
        </span>
        {committeeLabel && (
          <span className="block truncate" style={{ fontFamily: OUTFIT, fontWeight: 600, fontSize: 9.5, color: selected ? 'rgba(238,217,138,0.7)' : NEU.muted, maxWidth: 150 }}>
            {committeeLabel}
          </span>
        )}
      </span>
      {taken ? (
        <Lock size={12} strokeWidth={2.4} style={{ color: '#8B2020', flexShrink: 0 }} />
      ) : selected ? (
        <Check size={14} strokeWidth={3} style={{ color: NEU.gold, flexShrink: 0 }} />
      ) : (
        <Plus size={14} strokeWidth={2.6} style={{ color: NEU.muted, flexShrink: 0 }} />
      )}
    </button>
  );
}

/** A confirmed preference in the ranked list: drag handle + rank medallion +
 *  emblem/flag. Reorders by native HTML5 drag (the handle) or, when the
 *  handle has keyboard focus, ArrowUp/ArrowDown — dragging is never the
 *  only way to reorder. */
function RankedRow({
  index, total, committee, countryCode, countryName, onMove, onRemove, reducedMotion, isDragging,
  onDragStart, onDragOver, onDrop, onDragEnd,
}: {
  index: number;
  total: number;
  committee: CommitteeOption | undefined;
  countryCode: string;
  countryName: string;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
  reducedMotion: boolean;
  isDragging: boolean;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
  onDragEnd: () => void;
}) {
  const monogram = committee ? (committee.abbreviation || committee.name).slice(0, 3).toUpperCase() : '?';
  const resolved = countryCode || (countryName ? getCountryByName(countryName)?.code || '' : '');
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className="flex items-center gap-3"
      style={{
        padding: '10px 12px', borderRadius: 16, backgroundColor: NEU.surface, boxShadow: NEU.outSm,
        opacity: isDragging ? 0.5 : 1,
        cursor: 'grab',
        transition: reducedMotion ? 'none' : `opacity 160ms ${EASE}`,
      }}
    >
      {/* Drag handle, dotted grip — keyboard-focusable so ArrowUp/ArrowDown
          reorder without a drag gesture. */}
      <div
        role="button"
        tabIndex={0}
        aria-label={`Reorder ${countryName || committee?.name || 'preference'}, currently rank ${index + 1} of ${total}`}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp') { e.preventDefault(); onMove(-1); }
          else if (e.key === 'ArrowDown') { e.preventDefault(); onMove(1); }
        }}
        className="shrink-0 flex flex-col gap-[3px] px-1 py-2 focus:outline-none"
        style={{ cursor: 'grab' }}
      >
        {[0, 1, 2].map(r => (
          <div key={r} className="flex gap-[3px]">
            {[0, 1].map(c => <div key={c} className="w-[3px] h-[3px] rounded-full" style={{ backgroundColor: '#C5B9A8' }} />)}
          </div>
        ))}
      </div>

      <span
        className="flex items-center justify-center flex-shrink-0"
        style={{
          width: 26, height: 26, borderRadius: 999,
          background: 'linear-gradient(150deg, #EED98A, #B6871F)',
          fontFamily: OUTFIT, fontWeight: 900, fontSize: 12.5, color: '#3A2A08',
          fontVariantNumeric: 'tabular-nums', boxShadow: '0 2px 6px rgba(182,135,31,0.35)',
        }}
      >
        {index + 1}
      </span>

      {committee && <LogoDisc src={committee.logo_url} alt={committee.name} size={34} fallbackText={monogram} />}
      {countryCode ? <FlagImg code={resolved} size={22} /> : null}

      <div className="min-w-0 flex-1">
        <p className="truncate" style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 13, color: NEU.ink }}>
          {countryName || committee?.abbreviation || committee?.name || 'Preference'}
        </p>
        <p className="truncate" style={{ fontFamily: OUTFIT, fontWeight: 600, fontSize: 10.5, color: NEU.muted }}>
          {countryName && committee ? (committee.abbreviation || committee.name) : committee ? committee.name : ''}
        </p>
      </div>

      <div className="flex items-center gap-0.5 flex-shrink-0">
        <button
          type="button" onClick={onRemove} aria-label="Remove preference"
          className="flex items-center justify-center rounded-lg focus:outline-none"
          style={{ width: 26, height: 26, color: NEU.muted }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#8B2020'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = NEU.muted; }}
        >
          <X size={15} strokeWidth={2.4} />
        </button>
      </div>
    </div>
  );
}

/**
 * Image-forward option card for the Overview upgrade surface (buy credits /
 * upgrade to Unlimited). A photo header carries a hover effect: on hover the
 * image darkens under a translucent scrim and a descriptive line fades in over
 * it. The footer slot holds the live controls (stepper + buy, or an upgrade
 * button). Consistent with the onboarding/apply neu photography.
 */
function UpgradePhotoCard({
  image, eyebrow, title, hoverText, accent, children,
}: {
  image: string;
  eyebrow: string;
  title: string;
  hoverText: string;
  accent: string;
  children: React.ReactNode;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex flex-col overflow-hidden"
      style={{
        borderRadius: 20,
        backgroundColor: NEU.surface,
        boxShadow: hovered ? NEU.outHover : NEU.out,
        border: `1.5px solid ${accent}33`,
        transition: `box-shadow 240ms ${EASE}, transform 240ms ${EASE}`,
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
      }}
    >
      {/* Photo header + hover reveal */}
      <div className="relative" style={{ height: 118, overflow: 'hidden' }}>
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${image})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            transform: hovered ? 'scale(1.05)' : 'scale(1)',
            transition: `transform 500ms ${EASE}, filter 300ms ${EASE}`,
            filter: hovered ? 'saturate(1.05)' : 'saturate(0.9)',
          }}
        />
        {/* Darkening scrim — deepens on hover */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background: hovered
              ? 'linear-gradient(180deg, rgba(16,28,21,0.42) 0%, rgba(16,28,21,0.72) 100%)'
              : 'linear-gradient(180deg, rgba(16,28,21,0.10) 0%, rgba(16,28,21,0.40) 100%)',
            transition: `background 300ms ${EASE}`,
          }}
        />
        {/* Eyebrow + title, fades out on hover so the description can take over */}
        <div
          className="absolute left-0 right-0 bottom-0 px-4 pb-3"
          style={{
            zIndex: 1,
            opacity: hovered ? 0 : 1,
            transform: hovered ? 'translateY(-4px)' : 'translateY(0)',
            transition: `opacity 220ms ${EASE}, transform 220ms ${EASE}`,
          }}
        >
          <p style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 9.5, letterSpacing: '0.16em', color: '#EED98A', marginBottom: 2 }}>
            {eyebrow}
          </p>
          <p style={{ fontFamily: OUTFIT, fontWeight: 900, fontSize: 17, color: '#FAF8F3', lineHeight: 1.1, textShadow: '0 1px 6px rgba(16,28,21,0.5)' }}>
            {title}
          </p>
        </div>
        {/* Descriptive copy, cross-fades in over the darkened image on hover */}
        <div
          className="absolute inset-0 flex items-center px-4 py-3"
          style={{
            zIndex: 2,
            opacity: hovered ? 1 : 0,
            transform: hovered ? 'translateY(0)' : 'translateY(6px)',
            transition: `opacity 260ms ${EASE}, transform 260ms ${EASE}`,
            pointerEvents: 'none',
          }}
        >
          <p style={{ fontFamily: OUTFIT, fontWeight: 600, fontSize: 12.5, color: '#FAF8F3', lineHeight: 1.5, textShadow: '0 1px 6px rgba(16,28,21,0.6)' }}>
            {hoverText}
          </p>
        </div>
      </div>

      {/* Live controls */}
      <div className="p-4">
        {children}
      </div>
    </div>
  );
}

// ── Inner component (requires Suspense for useSearchParams) ────────────────

function ConferenceApplyInner() {
  const { slug } = useParams() as { slug: string };
  const searchParams = useSearchParams();
  const role = searchParams.get('role') ?? 'delegate';
  // Delegation-invite token (?role=delegate&delegationInvite=<token>). We only
  // CONSUME it here — resolve it via the resolve_delegation_invite RPC and
  // pre-select the invited delegation (the invite creation + landing route +
  // RPCs are built elsewhere).
  const delegationInviteToken = searchParams.get('delegationInvite');
  // Snapshot key for the "buy credits mid-apply, come back and resume" flow
  // (see goBuyCredits / the resume-restore effect below) — namespaced per
  // conference + role so switching roles never clobbers another draft.
  const resumeKey = `gavelling-apply-resume:${slug}:${role}`;
  // Edit-and-resubmit: opens the same stepper prefilled from the applicant's
  // own existing application for this role, instead of the fresh-apply flow.
  // Only takes effect once fetchAll confirms the application is actually in
  // an editable status (rejected or submitted), see `canEdit` below — never
  // trust the query param alone.
  const isEditMode = searchParams.get('edit') === '1';
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const { user, session, loading: authLoading } = useAuth();

  // ── Data
  const [conference, setConference] = useState<Conference | null>(null);
  const [roleConfig, setRoleConfig] = useState<RoleConfig | null | undefined>(undefined);
  const [committees, setCommittees] = useState<CommitteeOption[]>([]);
  const [societies, setSocieties] = useState<Society[]>([]);
  const [existingApp, setExistingApp] = useState<ExistingApp | null | undefined>(undefined);
  const [otherRoleApp, setOtherRoleApp] = useState<OtherActiveApp | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // ── Age gate (conference.min_age), DOB comes from the user's profile
  const [myDob, setMyDob] = useState<string | null>(null);
  const [dobInput, setDobInput] = useState('');
  const [dobSaving, setDobSaving] = useState(false);
  const [dobError, setDobError] = useState('');

  // ── Step
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [resubmitNeedsCredit, setResubmitNeedsCredit] = useState(false);
  // Withdraw (edit mode, submitted applications only) — two-step confirm.
  const [withdrawConfirm, setWithdrawConfirm] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawError, setWithdrawError] = useState('');

  // ── Step 2, Society
  const [isIndependent, setIsIndependent] = useState(false);
  const [societyInput, setSocietyInput] = useState('');
  const [societySuggestions, setSocietySuggestions] = useState<Society[]>([]);
  const [selectedSocietyId, setSelectedSocietyId] = useState<string | null>(null);
  const [societyDropdownOpen, setSocietyDropdownOpen] = useState(false);
  const [societyError, setSocietyError] = useState('');
  // Delegations that ALREADY have a head-delegate / faculty-advisor application
  // for this conference — grayed out and non-selectable in the picker (a second
  // delegation application for the same society isn't allowed; joiners are
  // invited by that society's head delegate instead). Populated from the
  // conference_taken_society_ids RPC.
  const [takenSocietyIds, setTakenSocietyIds] = useState<Set<string>>(new Set());
  // Delegation-invite consume (?delegationInvite=<token>): the resolved society
  // is pre-selected AND bypasses the "already applied" grayout, since the
  // applicant was explicitly invited to join it.
  const [invitedSocietyId, setInvitedSocietyId] = useState<string | null>(null);
  const [inviteSocietyName, setInviteSocietyName] = useState<string | null>(null);

  // ── Step, Invoicing (head-delegate / faculty-advisor only). A pledge is
  // ONLY about paying for delegation spots, everyone's own fee flows through
  // the normal payment system, so this is a plain yes/no.
  const [willPledgeSpots, setWillPledgeSpots] = useState<boolean | null>(null);
  const [spotsPledged, setSpotsPledged] = useState<number | ''>('');
  // Parallel question, same step: paying for advisor tickets for the
  // delegation, priced and materialized server-side exactly like delegate
  // spots (see add_pledged_advisor_spots).
  const [willPledgeAdvisors, setWillPledgeAdvisors] = useState<boolean | null>(null);
  const [advisorsPledged, setAdvisorsPledged] = useState<number | ''>('');
  const [invoicingError, setInvoicingError] = useState('');

  // ── Step 3, Preferences
  const [preferences, setPreferences] = useState<Preference[]>([]);
  const [countrySlots, setCountrySlots] = useState<Record<string, CountrySlot[]>>({});
  // Taken country_codes per committee (from get_taken_allocations RPC —
  // conference_allocations RLS hides other people's allocations, so a
  // privacy-safe SECURITY DEFINER function returns only the taken pairs).
  const [takenByCommittee, setTakenByCommittee] = useState<Record<string, Set<string>>>({});
  const [prefDataLoading, setPrefDataLoading] = useState(false);
  const [prefDataLoaded, setPrefDataLoaded] = useState(false);
  // full mode: which committee's country tray is expanded for picking.
  const [expandedCommitteeId, setExpandedCommitteeId] = useState<string | null>(null);
  const [prefError, setPrefError] = useState('');
  // Scroll-anchor for the preference list. The "YOUR RANKING" panel sits ABOVE
  // the picker, so adding/removing a preference changes the document height and
  // drifts whatever chip you're clicking on. Before each mutation we snapshot
  // scrollY + document height; a layout effect then re-anchors the viewport by
  // the exact height delta so the picker stays put under the cursor (no jump).
  const prefScrollAnchor = useRef<{ y: number; h: number } | null>(null);
  const anchorPrefScroll = useCallback(() => {
    if (typeof window === 'undefined') return;
    prefScrollAnchor.current = { y: window.scrollY, h: document.documentElement.scrollHeight };
  }, []);
  // Native HTML5 drag reorder for the ranking list, same mechanics as
  // QuestionBuilder's block reorder (dragIndexRef + dragOverIndex + the
  // insertion line). anchorPrefScroll still fires on drop so the layout
  // effect above never fights it, though a reorder never changes document
  // height, so in practice the delta it computes is always 0.
  const prefDragIndexRef = useRef<number | null>(null);
  const [prefDragOverIndex, setPrefDragOverIndex] = useState<number | null>(null);

  // ── Step 4, Experience & Questions
  // experienceLevel is NO LONGER user-chosen. It is auto-derived from the
  // applicant's MUN CV (count of mun_cv_entries → experienceProgress) and shown
  // read-only. It still feeds the submit payload so the organiser sees the rank.
  const [experienceLevel, setExperienceLevel] = useState('');
  const [cvEntryCount, setCvEntryCount] = useState(0);
  // "Add to / import from my MUN CV" affordances on the Experience step — the
  // derived rank re-reads the live CV count, and the shared CVEntryModal lets
  // the applicant add a conference without leaving the flow.
  const [cvModalOpen, setCvModalOpen] = useState(false);
  const [cvRefreshing, setCvRefreshing] = useState(false);
  // The choosable experience slider's track — pointer x is mapped to a band.
  const expTrackRef = useRef<HTMLDivElement | null>(null);
  const [customAnswers, setCustomAnswers] = useState<CustomAnswers>({});
  const [customMissingIds, setCustomMissingIds] = useState<string[]>([]);
  // Custom questions render as one Section per page within this step.
  const [questionPage, setQuestionPage] = useState(0);

  // ── Checkout: vouchers + fee waivers (finance.ts is the single math source)
  const [financeProfile, setFinanceProfile] = useState({
    is_ambassador: false, unlimited_conferences_remaining: 0, has_active_subscription: false,
    subscription_plan: null as string | null, subscription_period_end: null as string | null,
  });
  const [voucherCode, setVoucherCode] = useState('');
  const [voucherChecking, setVoucherChecking] = useState(false);
  const [voucherError, setVoucherError] = useState('');
  const [appliedVoucher, setAppliedVoucher] = useState<VoucherInput | null>(null);
  // ── Credits, the personal balance comes from the shared header hook; the
  // pooled/delegation balance is fetched separately for whichever society
  // this application would attach to (see previewSocietyId below).
  const { balance: creditBalance, loading: creditBalanceLoading, refresh: refreshCredits } = useCredits();
  const [poolBalance, setPoolBalance] = useState<number | null>(null);
  const [recapOpen, setRecapOpen] = useState(false);

  /** Human copy for validate_voucher's machine reasons. */
  function voucherReasonText(reason: string): string {
    switch (reason) {
      case 'not_found': return 'That code doesn’t match any voucher for this conference.';
      case 'inactive': return 'This voucher is no longer active.';
      case 'expired': return 'This voucher has expired.';
      case 'limit_reached': return 'This voucher has reached its redemption limit.';
      case 'already_redeemed': return 'You’ve already used this voucher.';
      default: return 'That code could not be applied. Please check it and try again.';
    }
  }

  async function handleApplyVoucher() {
    const code = voucherCode.trim().toUpperCase();
    if (!code || !session || !conference) return;
    setVoucherChecking(true);
    setVoucherError('');
    const supabase = getAuthedClient(session.access_token);
    const { data, error } = await supabase.rpc('validate_voucher', {
      p_code: code,
      p_conference_id: conference.id,
      p_context: 'conference_signup',
    });
    setVoucherChecking(false);
    const res = data as { valid: boolean; reason: string | null; voucher_id: string; kind: 'percent' | 'flat'; amount: number; currency: string | null } | null;
    if (error || !res) {
      setVoucherError('Could not check that code right now. Please try again.');
      return;
    }
    if (!res.valid) {
      setVoucherError(voucherReasonText(res.reason ?? ''));
      return;
    }
    setAppliedVoucher({ voucherId: res.voucher_id, code, kind: res.kind, amount: Number(res.amount), currency: res.currency });
  }

  // ── Age gate derivations, age is computed at the conference START DATE
  const minAgeLimit = conference?.min_age ?? null;
  const ageAtStart = minAgeLimit != null && myDob && conference ? ageAt(myDob, conference.start_date) : null;
  const underAge = minAgeLimit != null && ageAtStart !== null && ageAtStart < minAgeLimit;
  const needsDob = minAgeLimit != null && !myDob;

  const isPreferenceRole = role === 'delegate' || role === 'head-delegate';
  const isObserver = role === 'observer';
  const isInvoicingRole = role === 'head-delegate' || role === 'faculty-advisor';
  // Chairs and observers are never part of a society/delegation — the
  // Independent/With-a-society step has nothing to ask them.
  const showSocietyStep = role !== 'chair' && role !== 'observer';

  // ── Preference mode (organiser-controlled). Governs whether the Preferences
  // step appears at all, and which pickers it shows.
  const prefMode: PreferenceMode = conference?.delegate_preference_mode ?? 'committees_and_countries';
  const showPreferenceStep = isPreferenceRole && prefMode !== 'none';
  const showCommitteePick = prefMode === 'committees_and_countries' || prefMode === 'committees_only';
  const showCountryPick = prefMode === 'committees_and_countries' || prefMode === 'countries_only';
  const committeesOnly = prefMode === 'committees_only';
  const countriesOnly = prefMode === 'countries_only';

  // Availability, derived from the loaded slot + taken-allocation data.
  const committeeSlotInfo = (id: string) => {
    const slots = countrySlots[id] ?? [];
    const taken = takenByCommittee[id] ?? new Set<string>();
    const openCount = slots.filter(s => !taken.has(s.country_code)).length;
    return { slots, taken, total: slots.length, openCount, full: slots.length > 0 && openCount === 0 };
  };
  // committees_only ranks whole committees; the other modes rank countries.
  const availableUnitCount = committeesOnly
    ? committees.filter(c => !committeeSlotInfo(c.id).full).length
    : committees.reduce((n, c) => n + committeeSlotInfo(c.id).openCount, 0);
  const minPrefs = Math.min(3, availableUnitCount);

  // F15: faculty advisors skip Experience entirely, MUN experience level
  // doesn't apply to them, so experience_level submits null for this role.
  const skipExperience = role === 'faculty-advisor';

  // Custom questions live in their OWN step (shown for ANY role that has them,
  // placed right before Overview) — NOT bolted onto Experience. Advisors skip
  // Experience, so hosting questions there meant their questions never
  // rendered and Submit silently stalled trying to jump to a step they don't
  // have; a dedicated 'questions' step fixes that for every role.
  const hasCustomQuestions = questionsOf(normalizeBlocks(roleConfig?.custom_questions ?? [])).length > 0;

  // ── Credit coverage — same logic backs Step 1's note and the Overview
  // step's gate, so it's computed once here. previewSocietyId anticipates
  // the society this application would attach to (mirrors handleSubmit's
  // own societyId resolution for the already-selected-society case; a
  // brand-new society created at submit time has no pool balance yet, so
  // it's correctly treated as uncovered until then).
  const isExemptRole = !CREDIT_CHARGED_ROLES.includes(role);
  const hasUnlimited = financeProfile.has_active_subscription;
  const previewSocietyId = !isIndependent && !isObserver ? selectedSocietyId : null;
  const poolCovered = !!previewSocietyId && (poolBalance ?? 0) > 0;
  // Gavelling-sponsored conferences: consume_credit_for_application always
  // succeeds without consuming a credit (reason:'sponsored') — never gate or
  // charge here, regardless of the applicant's own balance.
  const creditsSponsored = conference?.credits_sponsored ?? false;
  const canApply = creditsSponsored || isExemptRole || hasUnlimited || poolCovered || (creditBalance ?? 0) >= 1;

  // Redesign: the flow no longer opens on a price/credit ('role') step. It
  // starts straight at the Independent-vs-Delegation ('society') choice; any
  // fee/voucher detail for non-sponsored conferences is now surfaced minimally
  // on the final 'overview' review instead.
  const stepSequence = [
    ...(showSocietyStep ? ['society'] : []),
    ...(isInvoicingRole ? ['invoicing'] : []),
    ...(showPreferenceStep ? ['preferences'] : []),
    ...(skipExperience ? [] : ['experience']),
    ...(hasCustomQuestions ? ['questions'] : []),
    'overview',
  ] as const;
  type StepKind = (typeof stepSequence)[number];
  const totalSteps = stepSequence.length;
  const stepLabels = stepSequence.map((kind) => {
    switch (kind) {
      case 'society': return 'Society';
      case 'invoicing': return 'Invoicing';
      case 'preferences': return 'Preferences';
      case 'experience': return 'Experience';
      case 'questions': return 'Questions';
      case 'overview': return 'Overview';
    }
  });
  const currentStepKind: StepKind = stepSequence[step - 1] ?? 'role';

  // A role switch mid-flow means a different question set (different pages),
  // so any in-progress section pagination is stale — start over. Forward/back
  // step transitions into Experience reset the page themselves, right beside
  // the setStep call (see advanceStep and the Overview "back" button), so
  // handleSubmit's targeted redirect to the page holding a missing answer
  // isn't immediately clobbered by a separate effect.
  useEffect(() => {
    setQuestionPage(0);
  }, [role]);

  // ── Auth gate + fetch
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      const returnTo = `/conferences/${slug}/apply?role=${role}`;
      router.replace(`/auth/signin?next=${encodeURIComponent(returnTo)}`);
      return;
    }
    fetchAll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id, slug, role]);

  // Resume an in-progress application after a "buy credits" round trip
  // (goBuyCredits saved it to localStorage before sending them to the store).
  // Waits for the same load gate the rest of the flow uses (authLoading/
  // loading), so roleConfig/committees are already in place before jumping
  // straight to Overview. Never applies in edit mode — that flow prefills
  // from the existing application instead. The snapshot is removed the
  // moment it's read, restored or not, so it can never re-trigger (also
  // self-guards against React StrictMode's dev-mode double effect firing).
  useEffect(() => {
    if (isEditMode || authLoading || loading) return;
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(resumeKey);
    } catch {
      return;
    }
    if (!raw) return;
    try {
      localStorage.removeItem(resumeKey);
    } catch { /* ignore */ }
    try {
      const snap = JSON.parse(raw) as {
        savedAt: number;
        step: number;
        isIndependent: boolean;
        societyInput: string;
        selectedSocietyId: string | null;
        willPledgeSpots: boolean | null;
        spotsPledged: number | '';
        willPledgeAdvisors: boolean | null;
        advisorsPledged: number | '';
        preferences: Preference[];
        experienceLevel: string;
        customAnswers: CustomAnswers;
        voucherCode: string;
        appliedVoucher: VoucherInput | null;
      };
      if (typeof snap.savedAt !== 'number' || Date.now() - snap.savedAt > 2 * 60 * 60 * 1000) return;
      setIsIndependent(snap.isIndependent);
      setSocietyInput(snap.societyInput);
      setSelectedSocietyId(snap.selectedSocietyId);
      setWillPledgeSpots(snap.willPledgeSpots);
      setSpotsPledged(snap.spotsPledged);
      setWillPledgeAdvisors(snap.willPledgeAdvisors ?? null);
      setAdvisorsPledged(snap.advisorsPledged ?? '');
      setPreferences(snap.preferences);
      setExperienceLevel(snap.experienceLevel);
      setCustomAnswers(snap.customAnswers);
      setVoucherCode(snap.voucherCode);
      setAppliedVoucher(snap.appliedVoucher);
      setStep(totalSteps);
      refreshCredits();
    } catch {
      // Corrupted snapshot — nothing usable to restore.
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditMode, authLoading, loading]);

  // ── Pooled/delegation credit balance for the Overview gate, refetched
  // whenever the anticipated society changes (independent/observer → null).
  useEffect(() => {
    if (!previewSocietyId || !session) { setPoolBalance(null); return; }
    let cancelled = false;
    const supabase = getAuthedClient(session.access_token);
    supabase.rpc('society_credit_balance', { p_society: previewSocietyId }).then(({ data, error }) => {
      if (cancelled) return;
      setPoolBalance(!error && typeof data === 'number' ? data : null);
    });
    return () => { cancelled = true; };
  }, [previewSocietyId, session]);

  async function fetchAll() {
    setLoading(true);
    if (!session) return;
    const supabase = getAuthedClient(session.access_token);

    const { data: confData } = await supabase
      .from('conferences')
      .select('id, slug, full_name, acronym, fee_amount, fee_currency, start_date, min_age, logo_url, delegate_preference_mode, credits_sponsored')
      .eq('slug', slug)
      .single();

    if (!confData) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setConference(confData as Conference);

    const [roleRes, committeesRes, societiesRes, appRes, otherAppRes, profileRes, subRes, cvCountRes] = await Promise.all([
      supabase
        .from('application_role_configs')
        .select('*')
        .eq('conference_id', confData.id)
        .eq('role', role)
        .maybeSingle(),
      supabase
        .from('conference_committees')
        .select('id, name, abbreviation, topics, difficulty, total_slots, logo_url, committee_type')
        .eq('conference_id', confData.id)
        .order('name', { ascending: true }),
      supabase
        .from('societies')
        .select('id, name, name_normalized')
        .eq('conference_id', confData.id)
        .order('name', { ascending: true }),
      supabase
        .from('applications')
        .select('id, status, is_independent, society_id, experience_level, custom_answers, pledge_type, spots_pledged, advisors_pledged')
        .eq('conference_id', confData.id)
        .eq('user_id', user!.id)
        .eq('role', role)
        .maybeSingle(),
      // One-active-application-per-conference check: any OTHER role this
      // user already holds an active application under, at this same
      // conference. Rejected/withdrawn are excluded on purpose (#1 — they
      // don't count, so a rejected applicant can still apply fresh under a
      // different role). Not .maybeSingle(): nothing here guarantees a
      // single row today, and this must never throw.
      supabase
        .from('applications')
        .select('id, role, status')
        .eq('conference_id', confData.id)
        .eq('user_id', user!.id)
        .neq('role', role)
        .in('status', ['submitted', 'accepted', 'assigned', 'checked-in'])
        .limit(1),
      supabase
        .from('profiles')
        .select('date_of_birth, is_ambassador, unlimited_conferences_remaining, mun_experience_level')
        .eq('id', user!.id)
        .maybeSingle(),
      // Personal Gavelling Unlimited subscription: owner_user_id = the
      // applicant, conference_id NULL (never conference-scoped), active/
      // trialing and not expired. Drives has_active_subscription below,
      // recorded as fee_waiver_source for reporting — the conference fee
      // itself carries no Gavelling surcharge regardless.
      supabase
        .from('subscriptions')
        .select('plan, status, current_period_end')
        .eq('owner_user_id', user!.id)
        .is('conference_id', null)
        .in('status', ['active', 'trialing'])
        .or(`current_period_end.is.null,current_period_end.gt.${new Date().toISOString()}`)
        .limit(1)
        .maybeSingle(),
      // MUN CV entry count — the applicant's rank is derived from this (same
      // source the CV page uses: entries.length → experienceProgress). head+
      // count avoids pulling any rows.
      supabase
        .from('mun_cv_entries')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user!.id),
    ]);

    const committeesData = (committeesRes.data as CommitteeOption[]) ?? [];
    const societiesData = (societiesRes.data as Society[]) ?? [];
    const appData = (appRes.data as ExistingApp) ?? null;
    const otherAppData = ((otherAppRes.data as OtherActiveApp[]) ?? [])[0] ?? null;

    setRoleConfig((roleRes.data as RoleConfig) ?? null);
    setCommittees(committeesData);
    setSocieties(societiesData);
    setExistingApp(appData);
    setOtherRoleApp(otherAppData);
    const prof = profileRes.data as { date_of_birth: string | null; is_ambassador: boolean; unlimited_conferences_remaining: number; mun_experience_level: string | null } | null;
    const sub = subRes.data as { plan: string; status: string; current_period_end: string | null } | null;
    setMyDob(prof?.date_of_birth ?? null);
    setFinanceProfile({
      is_ambassador: prof?.is_ambassador ?? false,
      unlimited_conferences_remaining: prof?.unlimited_conferences_remaining ?? 0,
      has_active_subscription: !!sub,
      subscription_plan: sub?.plan ?? null,
      subscription_period_end: sub?.current_period_end ?? null,
    });

    // Auto-derive the MUN rank from the applicant's CV. We derive from the live
    // CV count (experienceProgress) rather than trusting the mirrored
    // profiles.mun_experience_level, which can lag behind CV edits; the mirror
    // is used only as a fallback if the count query somehow failed.
    const cvCount = cvCountRes.count ?? 0;
    setCvEntryCount(cvCount);
    const derivedLevel = cvCountRes.error
      ? (prof?.mun_experience_level ?? experienceProgress(0).level)
      : experienceProgress(cvCount).level;
    // Feed the derived rank into the submit payload (experience_level). This is
    // the single place experienceLevel is set on load, for both fresh and edit
    // applications — the stale saved manual value is never restored anymore.
    setExperienceLevel(derivedLevel);

    // Edit mode: prefill every step from the existing application, only once
    // it's confirmed editable (rejected or submitted) — never for accepted/
    // assigned/withdrawn, those still hit the "already applied" wall below.
    if (isEditMode && appData && (appData.status === 'rejected' || appData.status === 'submitted')) {
      setIsIndependent(appData.is_independent);
      setSelectedSocietyId(appData.society_id);
      setSocietyInput(appData.society_id ? (societiesData.find(s => s.id === appData.society_id)?.name ?? '') : '');
      // pledge_type/spots_pledged only ever get set for invoicing roles
      // (head-delegate/faculty-advisor); a submitted/rejected application
      // for one of those roles always has a definitive answer already, so
      // this is a plain boolean, never the "unanswered" null state.
      if (isInvoicingRole) {
        setWillPledgeSpots(appData.pledge_type === 'delegation');
        setSpotsPledged(appData.spots_pledged ? appData.spots_pledged : '');
        // No separate pledge_type flag for advisors — a positive count is
        // itself the "yes" answer, mirroring how it's written back (0 when
        // declined, see the insert/update payloads above).
        setWillPledgeAdvisors((appData.advisors_pledged ?? 0) > 0);
        setAdvisorsPledged(appData.advisors_pledged ? appData.advisors_pledged : '');
      }
      // NOTE: experience_level is intentionally NOT restored from the saved
      // application here — the rank is always the freshly derived one (set from
      // the CV count above), never a stale manual choice.
      setCustomAnswers(appData.custom_answers ?? {});

      const { data: prefRows } = await supabase
        .from('application_preferences')
        .select('preference_order, conference_committee_id, country_code, country_name')
        .eq('application_id', appData.id)
        .order('preference_order', { ascending: true });
      const existingPrefs = ((prefRows ?? []) as { preference_order: number; conference_committee_id: string; country_code: string | null; country_name: string | null }[])
        .map((p): Preference | null => {
          const committee = committeesData.find(c => c.id === p.conference_committee_id);
          if (!committee) return null;
          return {
            committeeId: p.conference_committee_id,
            committeeName: committee.abbreviation ?? committee.name,
            countryCode: p.country_code ?? '',
            countryName: p.country_name ?? '',
          };
        })
        .filter((p): p is Preference => p !== null);
      setPreferences(existingPrefs);
    }

    // Which delegations already have a head-delegate / faculty-advisor
    // application for this conference — grayed out in the society picker. A
    // privacy-safe SECURITY DEFINER RPC (returns only non-sensitive society ids;
    // RLS would otherwise hide other applicants' rows).
    supabase
      .rpc('conference_taken_society_ids', { p_conference_id: confData.id })
      .then(({ data, error }) => {
        if (error || !data) return;
        const ids = (data as Array<{ society_id?: string } | string>).map(
          (r) => (typeof r === 'string' ? r : r.society_id ?? ''),
        );
        setTakenSocietyIds(new Set(ids.filter(Boolean)));
      });

    // Delegation invite: resolve the token and, when it matches THIS
    // conference, pre-select that delegation (bypassing the grayout for it).
    if (delegationInviteToken && !isEditMode && !appData) {
      const { data: inviteData } = await supabase.rpc('resolve_delegation_invite', {
        p_token: delegationInviteToken,
      });
      const invite = inviteData as
        | { ok?: boolean; society_id?: string; society_name?: string; conference_id?: string }
        | null;
      if (invite?.ok && invite.society_id && invite.conference_id === confData.id) {
        setInvitedSocietyId(invite.society_id);
        setInviteSocietyName(invite.society_name ?? null);
        setIsIndependent(false);
        setSelectedSocietyId(invite.society_id);
        setSocietyInput(
          invite.society_name ?? societiesData.find(s => s.id === invite.society_id)?.name ?? '',
        );
      }
    }

    setLoading(false);
  }

  // head-delegate / faculty-advisor always belong to a society, no independent option
  useEffect(() => {
    if (isInvoicingRole) setIsIndependent(false);
  }, [isInvoicingRole]);

  // Chairs and observers skip the society step entirely — default to
  // "independent" so society_id stays null and nothing downstream (credit
  // pool coverage, submit payload) mistakes them for part of a delegation.
  useEffect(() => {
    if (!showSocietyStep) setIsIndependent(true);
  }, [showSocietyStep]);

  // Society autocomplete
  useEffect(() => {
    if (!societyInput.trim()) {
      setSocietySuggestions([]);
      setSocietyDropdownOpen(false);
      return;
    }
    const q = societyInput.toLowerCase();
    const filtered = societies.filter(s => s.name.toLowerCase().includes(q));
    setSocietySuggestions(filtered);
    setSocietyDropdownOpen(true);
  }, [societyInput, societies]);

  // Re-anchor the viewport after a preference add/remove so the picker doesn't
  // jump. Only fires when a mutating handler set the anchor (edit-mode prefill,
  // resume-restore and reorders leave it null / height-neutral). Runs before
  // paint (useLayoutEffect), so there's no visible flicker.
  useLayoutEffect(() => {
    const a = prefScrollAnchor.current;
    if (!a) return;
    prefScrollAnchor.current = null;
    const delta = document.documentElement.scrollHeight - a.h;
    if (delta !== 0) window.scrollTo(0, a.y + delta);
  }, [preferences]);

  // Load committee slots + availability once, as soon as we know a preference
  // step will be shown (mode-gated). Skipped entirely for mode 'none'.
  useEffect(() => {
    if (!showPreferenceStep || prefDataLoaded || prefDataLoading) return;
    if (!conference || !session) return;
    loadPreferenceData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPreferenceStep, prefDataLoaded, prefDataLoading, conference?.id, committees.length]);

  /**
   * Bulk-loads everything the preference picker needs: every committee's
   * country slots, plus which of those are already TAKEN. Availability comes
   * from get_taken_allocations (a privacy-safe RPC — the delegate can't read
   * conference_allocations directly under RLS).
   */
  async function loadPreferenceData() {
    if (!session || !conference) return;
    if (committees.length === 0) return;
    setPrefDataLoading(true);
    const supabase = getAuthedClient(session.access_token);
    const ids = committees.map(c => c.id);
    const [slotsRes, takenRes] = await Promise.all([
      supabase
        .from('committee_country_slots')
        .select('id, conference_committee_id, country_code, country_name')
        .in('conference_committee_id', ids)
        .order('country_name', { ascending: true }),
      supabase.rpc('get_taken_allocations', { p_conference_id: conference.id }),
    ]);

    const byCommittee: Record<string, CountrySlot[]> = {};
    for (const id of ids) byCommittee[id] = [];
    for (const s of (slotsRes.data as Array<CountrySlot & { conference_committee_id: string }> | null) ?? []) {
      (byCommittee[s.conference_committee_id] ??= []).push({ id: s.id, country_code: s.country_code, country_name: s.country_name });
    }

    const taken: Record<string, Set<string>> = {};
    for (const t of (takenRes.data as Array<{ conference_committee_id: string; country_code: string }> | null) ?? []) {
      (taken[t.conference_committee_id] ??= new Set()).add(t.country_code);
    }

    setCountrySlots(byCommittee);
    setTakenByCommittee(taken);
    setPrefDataLoading(false);
    setPrefDataLoaded(true);
  }

  async function handleSaveDob() {
    if (!session || !user) return;
    setDobError('');
    const age = ageAt(dobInput);
    if (age === null || age < 0 || age > 120) {
      setDobError('That date of birth doesn’t look right. Please double-check it.');
      return;
    }
    setDobSaving(true);
    const supabase = getAuthedClient(session.access_token);
    const { error } = await supabase.from('profiles').update({ date_of_birth: dobInput }).eq('id', user.id);
    setDobSaving(false);
    if (error) {
      setDobError('Your date of birth could not be saved. Please try again.');
      return;
    }
    setMyDob(dobInput);
  }

  // Re-pull the applicant's live MUN CV count and re-derive their rank — used
  // by the "Import my experience from my MUN CV" button and after adding a CV
  // entry inline, so the derived slider updates immediately.
  async function refreshCvCount() {
    if (!session || !user) return;
    setCvRefreshing(true);
    const supabase = getAuthedClient(session.access_token);
    const { count, error } = await supabase
      .from('mun_cv_entries')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id);
    setCvRefreshing(false);
    if (error) return;
    const c = count ?? 0;
    setCvEntryCount(c);
    setExperienceLevel(experienceProgress(c).level);
  }

  // Delete handler wired into the shared CVEntryModal (only reachable when
  // editing an existing entry — the inline "add" flow never triggers it).
  async function handleDeleteCvEntry(id: string) {
    if (!session) return;
    const supabase = getAuthedClient(session.access_token);
    await supabase.from('mun_cv_entries').delete().eq('id', id);
    await refreshCvCount();
  }

  // Advisors skip Experience (F15), so 'invoicing' can now be the final step
  // in their sequence, advance to it normally, but submit instead of
  // stepping past the end when there's nothing left.
  function advanceStep() {
    if (step >= totalSteps) {
      handleSubmit();
      return;
    }
    const nextStep = step + 1;
    // Entering the Questions step fresh (from whichever step precedes it in
    // this role's sequence) always starts on its first section page.
    if (stepSequence[nextStep - 1] === 'questions') setQuestionPage(0);
    setStep(nextStep);
  }

  function handleContinue() {
    if (currentStepKind === 'society') {
      if (!isObserver && !isIndependent && !societyInput.trim()) {
        setSocietyError('Please enter your society name.');
        return;
      }
      if (!isObserver && !isIndependent && !isInvoicingRole && societyInput.trim() && !selectedSocietyId) {
        setSocietyError('Please select an existing delegation from the list.');
        return;
      }
      // Block delegations that have already applied to this conference (unless
      // this applicant was explicitly invited to that one). Resolve the id the
      // application would attach to — an explicit selection, or an exact
      // name match for invoicing roles that type a name.
      if (!isObserver && !isIndependent) {
        const matchedByName = societies.find(
          s => s.name.toLowerCase() === societyInput.trim().toLowerCase(),
        );
        const resolvedId = selectedSocietyId ?? matchedByName?.id ?? null;
        if (resolvedId && resolvedId !== invitedSocietyId && takenSocietyIds.has(resolvedId)) {
          setSocietyError('This delegation has already applied — ask its head delegate or faculty advisor to invite you.');
          return;
        }
      }
      setSocietyError('');
      advanceStep();
      return;
    }
    if (currentStepKind === 'invoicing') {
      if (willPledgeSpots === null) {
        setInvoicingError('Please select an option.');
        return;
      }
      if (willPledgeSpots && (spotsPledged === '' || spotsPledged < 1)) {
        setInvoicingError('Please enter how many delegate spots you will pay for.');
        return;
      }
      if (willPledgeAdvisors === null) {
        setInvoicingError('Please select an option for advisor tickets.');
        return;
      }
      if (willPledgeAdvisors && (advisorsPledged === '' || advisorsPledged < 1)) {
        setInvoicingError('Please enter how many advisor tickets you will pay for.');
        return;
      }
      setInvoicingError('');
      advanceStep();
      return;
    }
    if (currentStepKind === 'preferences') {
      if (minPrefs > 0 && preferences.length < minPrefs) {
        setPrefError(
          minPrefs === 1
            ? 'Please add at least one preference.'
            : `Please add at least ${minPrefs} preferences, ranked in order of priority.`
        );
        return;
      }
      setPrefError('');
      advanceStep();
      return;
    }
    advanceStep();
  }

  async function handleSubmit() {
    const blocks = normalizeBlocks(roleConfig?.custom_questions ?? []);
    const questionCheck = validateAnswers(questionsOf(blocks), customAnswers);
    if (!questionCheck.valid) {
      setCustomMissingIds(questionCheck.missingIds);
      // Submit happens from the Overview step, but the answers live on the
      // dedicated Questions step — send the applicant back there, to the
      // specific section page holding the first missing answer, so the
      // missing-answer highlight is actually visible (not just on-page).
      const pages = splitIntoSections(blocks);
      const firstMissingId = questionCheck.missingIds[0];
      const targetPage = pages.findIndex(p => questionsOf(p.blocks).some(q => q.id === firstMissingId));
      setQuestionPage(targetPage >= 0 ? targetPage : 0);
      const questionsIdx = stepSequence.indexOf('questions');
      if (questionsIdx >= 0) setStep(questionsIdx + 1);
      return;
    }
    if (needsDob || underAge) {
      setSubmitError(
        minAgeLimit != null
          ? `This conference requires delegates to be at least ${minAgeLimit} years old.`
          : 'This conference has an age requirement you do not meet.'
      );
      return;
    }
    if (isEditMode) {
      await handleResubmit();
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    if (!session) { setSubmitError('Session expired. Please sign in again.'); setSubmitting(false); return; }
    const supabase = getAuthedClient(session.access_token);

    try {
      let societyId: string | null = null;
      if (!isIndependent && !isObserver && societyInput.trim()) {
        if (selectedSocietyId) {
          societyId = selectedSocietyId;
        } else if (isInvoicingRole) {
          const normalized = societyInput.trim().toLowerCase();
          const { data: existingSoc } = await supabase
            .from('societies')
            .select('id')
            .eq('conference_id', conference!.id)
            .eq('name_normalized', normalized)
            .maybeSingle();

          if (existingSoc) {
            societyId = (existingSoc as { id: string }).id;
          } else {
            const { data: newSoc } = await supabase
              .from('societies')
              .insert({ conference_id: conference!.id, name: societyInput.trim(), name_normalized: normalized })
              .select('id')
              .single();
            societyId = (newSoc as { id: string } | null)?.id ?? null;
          }
        }
      }

      // Auto-cover: if the society already has a purchased spot free, mark this
      // application paid immediately instead of leaving it unpaid. Only runs
      // when the role auto-accepts (the app lands accepted immediately) —
      // manual-review roles are always inserted unpaid; coverage happens at
      // acceptance time instead (see applications page handleAccept).
      let paymentStatus: 'unpaid' | 'paid' = 'unpaid';
      if (societyId && roleConfig?.auto_accept) {
        if (role === 'delegate' || role === 'head-delegate') {
          const [{ count: occupancy }, { data: socData }] = await Promise.all([
            supabase
              .from('applications')
              .select('id', { count: 'exact', head: true })
              .eq('society_id', societyId)
              .in('role', ['delegate', 'head-delegate'])
              .in('status', ['accepted', 'assigned'])
              .eq('attending', true)
              .eq('payment_status', 'paid'),
            supabase.from('societies').select('spots_purchased').eq('id', societyId).single(),
          ]);
          const spotsPurchased = (socData as { spots_purchased: number } | null)?.spots_purchased ?? 0;
          if ((occupancy ?? 0) < spotsPurchased) paymentStatus = 'paid';
        } else if (role === 'faculty-advisor') {
          const [{ count: occupancy }, { data: socData }] = await Promise.all([
            supabase
              .from('applications')
              .select('id', { count: 'exact', head: true })
              .eq('society_id', societyId)
              .eq('role', 'faculty-advisor')
              .in('status', ['accepted', 'assigned'])
              .eq('attending', true)
              .eq('payment_status', 'paid'),
            supabase.from('societies').select('advisor_spots_purchased').eq('id', societyId).single(),
          ]);
          const spotsPurchased = (socData as { advisor_spots_purchased: number } | null)?.advisor_spots_purchased ?? 0;
          if ((occupancy ?? 0) < spotsPurchased) paymentStatus = 'paid';
        }
      }

      // Checkout breakdown, the SAME pure math the order summary rendered.
      // fee_waiver_source is recorded at submit; the unlimited counter itself
      // is only decremented by the DB trigger when payment_status flips to
      // 'paid' (server-side, so it can't be gamed from the client).
      const breakdown = computeCheckout({
        // Phased pricing: charge the fee phase active TODAY (falls back to the
        // flat role fee when no phase window covers today), same resolution
        // the order summary rendered in step 1.
        feeAmount: roleConfig ? activePhaseFee(roleConfig).amount : 0,
        feeCurrency: roleConfig?.fee_currency ?? conference!.fee_currency,
        voucher: appliedVoucher,
        profile: financeProfile,
      });

      const insertPayload: Record<string, unknown> = {
        conference_id: conference!.id,
        user_id: user!.id,
        role,
        status: roleConfig?.auto_accept ? 'accepted' : 'submitted',
        // Derived convenience, kept in sync, society_id IS NULL is the
        // actual source of truth, never read is_independent for logic.
        is_independent: isIndependent,
        society_id: societyId,
        is_head_delegate: role === 'head-delegate',
        experience_level: experienceLevel || null,
        custom_answers: customAnswers,
        payment_status: paymentStatus,
      };
      if (breakdown.baseFee > 0 && breakdown.waiverSource) {
        insertPayload.fee_waiver_source = breakdown.waiverSource;
      }
      if (appliedVoucher && breakdown.voucherDiscount > 0) {
        insertPayload.voucher_id = appliedVoucher.voucherId;
        insertPayload.voucher_discount = breakdown.voucherDiscount;
      }
      if (isInvoicingRole) {
        insertPayload.pledge_type = willPledgeSpots ? 'delegation' : null;
        insertPayload.spots_pledged = willPledgeSpots ? (spotsPledged || 0) : 0;
        insertPayload.advisors_pledged = willPledgeAdvisors ? (advisorsPledged || 0) : 0;
      }

      const { data: app, error: appError } = await supabase
        .from('applications')
        .insert(insertPayload)
        .select('id')
        .single();

      if (appError) throw appError;
      const newAppId = (app as { id: string }).id;

      // Consume a Gavelling credit for this application. The Overview step
      // already gated submission on canApply, so need_credit here means the
      // applicant's coverage changed between viewing Overview and clicking
      // submit (e.g. balance spent in another tab) — block the redirect and
      // surface it rather than silently sending an uncharged application
      // through, the application row stays as-is so a retry (after buying
      // credits) doesn't create a duplicate.
      const { data: credit } = await supabase.rpc('consume_credit_for_application', {
        p_application_id: newAppId,
      });
      const creditResult = credit as { ok?: boolean; consumed?: boolean; need_credit?: boolean } | null;
      if (creditResult?.need_credit) {
        setSubmitError("You're out of credits. Buy more or upgrade your subscription, then try submitting again.");
        setSubmitting(false);
        return;
      }
      refreshCredits();

      // Record the voucher redemption atomically (BEFORE INSERT trigger locks
      // the voucher row, enforces active/expiry/limit, bumps redeemed_count).
      // Non-fatal: the application is already in, a failed redemption just
      // means the organizer sees the voucher columns without a redemption row.
      if (appliedVoucher && breakdown.voucherDiscount > 0) {
        await supabase.rpc('redeem_voucher', {
          p_voucher_id: appliedVoucher.voucherId,
          p_context: 'conference_signup',
          p_application_id: newAppId,
        });
      }

      if (showPreferenceStep && preferences.length > 0) {
        // country_code/country_name are null for committees_only rows (the
        // delegate ranked committees without a country). conference_committee_id
        // is always present in every mode.
        const prefRows = preferences.map((p, i) => ({
          application_id: newAppId,
          preference_order: i + 1,
          conference_committee_id: p.committeeId,
          country_code: p.countryCode || null,
          country_name: p.countryName || null,
        }));
        await supabase.from('application_preferences').insert(prefRows);
      }

      // Fire-and-forget: the confirmation redirect below must never wait on
      // (or fail because of) the email queue.
      if (session) void queueParticipantEventEmail(session.access_token, conference!.id, 'application_received', [newAppId]);

      try { localStorage.removeItem(resumeKey); } catch { /* ignore */ }
      const timingParam = roleConfig?.payment_timing ? `&timing=${roleConfig.payment_timing}` : '';
      router.push(`/conferences/${slug}/apply/confirmation?role=${role}${timingParam}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setSubmitError(msg);
      setSubmitting(false);
    }
  }

  // Edit mode's submit path: resubmit_application is the ONLY write path for
  // applicant edits — a whitelisted SECURITY DEFINER RPC, never a direct
  // `applications` update. It forces status back to 'submitted' and stamps
  // resubmitted_at itself when coming from 'rejected'; financial fields
  // (payment_status, vouchers, fee waivers) aren't in its whitelist and
  // aren't touched here either, resubmitting only edits the whitelisted
  // fields, it never re-runs checkout.
  async function handleResubmit() {
    const blocks = normalizeBlocks(roleConfig?.custom_questions ?? []);
    const questionCheck = validateAnswers(questionsOf(blocks), customAnswers);
    if (!questionCheck.valid) {
      setCustomMissingIds(questionCheck.missingIds);
      // Route to the Questions step / page holding the first missing answer,
      // so the highlight is visible instead of failing silently on Overview.
      const pages = splitIntoSections(blocks);
      const firstMissingId = questionCheck.missingIds[0];
      const targetPage = pages.findIndex(p => questionsOf(p.blocks).some(q => q.id === firstMissingId));
      setQuestionPage(targetPage >= 0 ? targetPage : 0);
      const questionsIdx = stepSequence.indexOf('questions');
      if (questionsIdx >= 0) setStep(questionsIdx + 1);
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    setResubmitNeedsCredit(false);
    if (!session || !existingApp) { setSubmitError('Session expired. Please sign in again.'); setSubmitting(false); return; }
    const supabase = getAuthedClient(session.access_token);

    try {
      let societyId: string | null = null;
      if (!isIndependent && !isObserver && societyInput.trim()) {
        if (selectedSocietyId) {
          societyId = selectedSocietyId;
        } else if (isInvoicingRole) {
          const normalized = societyInput.trim().toLowerCase();
          const { data: existingSoc } = await supabase
            .from('societies')
            .select('id')
            .eq('conference_id', conference!.id)
            .eq('name_normalized', normalized)
            .maybeSingle();

          if (existingSoc) {
            societyId = (existingSoc as { id: string }).id;
          } else {
            const { data: newSoc } = await supabase
              .from('societies')
              .insert({ conference_id: conference!.id, name: societyInput.trim(), name_normalized: normalized })
              .select('id')
              .single();
            societyId = (newSoc as { id: string } | null)?.id ?? null;
          }
        }
      }

      const updates: Record<string, unknown> = {
        is_independent: isIndependent,
        society_id: societyId,
        is_head_delegate: role === 'head-delegate',
        experience_level: experienceLevel || null,
        custom_answers: customAnswers,
      };
      if (isInvoicingRole) {
        updates.pledge_type = willPledgeSpots ? 'delegation' : null;
        updates.spots_pledged = willPledgeSpots ? (spotsPledged || 0) : 0;
        updates.advisors_pledged = willPledgeAdvisors ? (advisorsPledged || 0) : 0;
      }
      if (showPreferenceStep) {
        // Same row shape as the fresh-submit insert, minus application_id
        // (the RPC already has p_application_id) — the RPC owns replacing
        // application_preferences server-side.
        updates.preferences = preferences.map((p, i) => ({
          preference_order: i + 1,
          conference_committee_id: p.committeeId,
          country_code: p.countryCode || null,
          country_name: p.countryName || null,
        }));
      }

      const { data, error } = await supabase.rpc('resubmit_application', {
        p_application_id: existingApp.id,
        p_updates: updates,
      });
      if (error) throw error;
      const result = data as { ok: boolean; resubmitted?: boolean; error?: string };
      if (!result.ok) throw new Error(result.error ?? 'Could not resubmit your application. Please try again.');

      // Re-consume the credit that was refunded when this application was
      // rejected — resubmission spends it again, same as a fresh submit.
      const { data: credit } = await supabase.rpc('consume_credit_for_application', {
        p_application_id: existingApp.id,
      });
      const creditResult = credit as { ok?: boolean; consumed?: boolean; need_credit?: boolean } | null;
      // Sponsored conferences never need a credit — consume_credit_for_application
      // already returns ok without need_credit, but guard defensively so this
      // prompt can never surface here regardless.
      if (creditResult?.need_credit && !creditsSponsored) {
        setResubmitNeedsCredit(true);
        setSubmitting(false);
        return;
      }
      refreshCredits();

      // Same event key a fresh submission would use ('application_received'),
      // gated by the organizer's normal three-state template rules (drafted/
      // default/off/unconfigured) — no new event key, and this queues
      // nothing if the organizer hasn't configured anything for it.
      // queueParticipantEventEmail never throws, so no try/catch needed here.
      if (session) await queueParticipantEventEmail(session.access_token, conference!.id, 'application_received', [existingApp.id]);

      try { localStorage.removeItem(resumeKey); } catch { /* ignore */ }
      router.push(`/conferences/${slug}/apply/confirmation?role=${role}&resubmitted=1`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setSubmitError(msg);
      setSubmitting(false);
    }
  }

  // Withdraw the application entirely. There's no user DELETE policy on
  // `applications`, and the "update own submitted" RLS policy forbids moving
  // status off 'submitted', so this goes through the SECURITY DEFINER
  // withdraw_application RPC: it verifies auth.uid() owns the row, only allows
  // withdrawal while status is 'submitted', flips status to 'withdrawn', and
  // refunds any Gavelling credit that was held. On success we leave the apply
  // flow for the applicant's conferences list.
  async function handleWithdraw() {
    if (!session || !existingApp) { setWithdrawError('Your session expired. Please sign in again.'); return; }
    if (existingApp.status !== 'submitted') {
      setWithdrawError('This application can no longer be withdrawn.');
      return;
    }
    setWithdrawing(true);
    setWithdrawError('');
    const supabase = getAuthedClient(session.access_token);
    try {
      const { data, error } = await supabase.rpc('withdraw_application', { p_application_id: existingApp.id });
      if (error) throw error;
      const result = data as { ok: boolean; error?: string } | null;
      if (!result?.ok) throw new Error(result?.error ?? 'Could not withdraw your application. Please try again.');
      refreshCredits();
      try { localStorage.removeItem(resumeKey); } catch { /* ignore */ }
      router.push('/my-conferences');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not withdraw your application. Please try again.';
      setWithdrawError(msg);
      setWithdrawing(false);
    }
  }

  // Sent to the Credits & Subscription store when the applicant runs out of
  // credits mid-apply — snapshots every field they've filled in so far to
  // localStorage, then sends them off to buy a credit. The resume-restore
  // effect below reads this back once they're returned via ?returnTo.
  /** Snapshot the in-progress application to localStorage so a checkout /
   *  upgrade round trip (Stripe redirect, then a fresh mount back on this URL)
   *  can restore it straight to the Overview step. Shared by the "go buy a
   *  credit" link, the inline credits stepper, and the Unlimited upgrade card. */
  function saveResumeSnapshot() {
    try {
      const snapshot = {
        savedAt: Date.now(),
        step,
        isIndependent,
        societyInput,
        selectedSocietyId,
        willPledgeSpots,
        spotsPledged,
        willPledgeAdvisors,
        advisorsPledged,
        preferences,
        experienceLevel,
        customAnswers,
        voucherCode,
        appliedVoucher,
      };
      localStorage.setItem(resumeKey, JSON.stringify(snapshot));
    } catch {
      // Quota exceeded / serialization failure — nothing to restore later,
      // but that must never block the applicant from going to buy a credit.
    }
  }

  function goBuyCredits() {
    saveResumeSnapshot();
    router.push(`/account/unlimited?returnTo=${encodeURIComponent(`/conferences/${slug}/apply?role=${role}`)}`);
  }

  // ── Inline credit purchase (Overview step) ───────────────────────────────
  // The applicant can top up credits without leaving the apply flow: a simple
  // quantity stepper wired to the SAME create-credit-checkout edge function the
  // account + delegation buy-credit surfaces use. Region price comes from the
  // buyer's geo (creditPricing), and we snapshot the application first so the
  // returnTo round trip restores them to Overview.
  const [geoCountry, setGeoCountry] = useState<string | null>(null);
  useEffect(() => {
    fetch('/api/geo')
      .then(r => r.json())
      .then(g => setGeoCountry((g?.countryCode as string | null) ?? null))
      .catch(() => {});
  }, []);
  const [creditQty, setCreditQty] = useState(1);
  const [buyingCredits, setBuyingCredits] = useState(false);
  const [buyCreditsError, setBuyCreditsError] = useState('');
  const [upgradingUnlimited, setUpgradingUnlimited] = useState(false);
  const [unlimitedError, setUnlimitedError] = useState('');
  const CREDIT_MAX_QTY = 20;

  async function handleBuyCreditsInline() {
    if (buyingCredits) return;
    setBuyingCredits(true);
    setBuyCreditsError('');
    saveResumeSnapshot();
    const supabase = await getFreshAuthedClient();
    if (!supabase) {
      setBuyingCredits(false);
      setBuyCreditsError('Your session has expired, please refresh and sign in again.');
      return;
    }
    const { data, error } = await supabase.functions.invoke('create-credit-checkout', {
      body: {
        kind: 'credits',
        quantity: creditQty,
        returnTo: `/conferences/${slug}/apply?role=${role}`,
        ...(geoCountry ? { country: geoCountry } : {}),
      },
    });
    if (error) {
      setBuyingCredits(false);
      setBuyCreditsError(await extractFunctionErrorMessage(error));
      return;
    }
    const result = data as { ok?: boolean; url?: string; error?: string } | null;
    if (!result?.ok || !result.url) {
      setBuyingCredits(false);
      setBuyCreditsError(result?.error || 'Could not start checkout. Please try again.');
      return;
    }
    window.location.assign(result.url);
  }

  /** Upgrade to Gavelling Unlimited inline, mirroring handleBuyCreditsInline:
   *  invokes the subscription checkout function directly rather than routing
   *  to /account/unlimited, so the applicant never leaves the apply flow. */
  async function goUnlimited() {
    if (upgradingUnlimited) return;
    setUpgradingUnlimited(true);
    setUnlimitedError('');
    saveResumeSnapshot();
    try {
      const supabase = await getFreshAuthedClient();
      if (!supabase) {
        setUnlimitedError('Your session has expired, please refresh and sign in again.');
        return;
      }
      const { data, error } = await supabase.functions.invoke('create-subscription-checkout', {
        body: {
          plan: 'monthly',
          returnTo: `/conferences/${slug}/apply?role=${role}`,
          ...(geoCountry ? { country: geoCountry } : {}),
        },
      });
      if (error) {
        setUnlimitedError(await extractFunctionErrorMessage(error));
        return;
      }
      const result = data as { ok?: boolean; url?: string; error?: string } | null;
      if (!result?.ok || !result.url) {
        setUnlimitedError(result?.error || 'Could not start checkout. Please try again.');
        return;
      }
      window.location.assign(result.url);
    } finally {
      setUpgradingUnlimited(false);
    }
  }

  // ── Step render helpers ───────────────────────────────────────────────────

  /**
   * Compact registration-fee + voucher summary, surfaced ONLY on the final
   * 'overview' review (the old leading price step is gone). Returns null for
   * free roles / sponsored conferences / edit mode, so it never shows unless
   * there is a real conference fee to preview. All math from finance.ts.
   */
  function renderOrderSummary() {
    const rc = roleConfig;
    if (!rc || isEditMode) return null;
    const { amount: resolvedFee, phase: currentPhase } = activePhaseFee(rc);
    if (!(resolvedFee > 0)) return null;
    // The voucher is only useful when the fee is paid AT application. When the
    // conference doesn't require payment to submit (pay after acceptance), the
    // voucher is applied later on /pay — so hide it here, it's useless.
    const showVoucher = rc.pay_at_application === true;
    const breakdown = computeCheckout({
      feeAmount: resolvedFee,
      feeCurrency: rc.fee_currency,
      voucher: appliedVoucher,
      profile: financeProfile,
    });
    const summaryRow: React.CSSProperties = {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      fontFamily: OUTFIT, fontSize: 13.5, color: NEU.ink,
    };
    const amountStyle: React.CSSProperties = { fontVariantNumeric: 'tabular-nums', fontWeight: 700 };
    return (
      <NeuInset className="p-5 mb-4">
        <p style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 10, letterSpacing: '0.22em', color: NEU.muted, marginBottom: 14 }}>
          ORDER SUMMARY
        </p>

        {/* Fee line, names the active fee phase when one applies */}
        <div style={{ ...summaryRow, marginBottom: 10 }}>
          <span style={{ color: 'rgba(28,20,16,0.75)' }}>
            Registration fee
            {currentPhase && (
              <span style={{ color: NEU.muted, fontWeight: 600 }}>: {currentPhase.label || 'Current phase'}</span>
            )}
          </span>
          <span style={amountStyle}>{formatFee(breakdown.baseFee, breakdown.currency)}</span>
        </div>

        {/* Voucher, single field + APPLY chip, or the applied green line.
            Hidden when payment isn't taken at application (pay-after-acceptance). */}
        {showVoucher && (appliedVoucher ? (
          <div style={{ ...summaryRow, marginBottom: 10 }}>
            <span className="inline-flex items-center gap-1.5" style={{ color: NEU.green, fontWeight: 600 }}>
              <Ticket size={14} strokeWidth={2.2} />
              Voucher {appliedVoucher.code}
              <button
                onClick={() => { setAppliedVoucher(null); setVoucherCode(''); }}
                aria-label="Remove voucher"
                className="focus:outline-none"
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: NEU.muted, display: 'inline-flex', padding: 2 }}
              >
                <X size={13} strokeWidth={2.4} />
              </button>
            </span>
            <span style={{ ...amountStyle, color: NEU.green }}>
              −{formatFee(breakdown.voucherDiscount, breakdown.currency)}
            </span>
          </div>
        ) : (
          <div className="flex items-stretch gap-2" style={{ marginBottom: voucherError ? 4 : 10 }}>
            <input
              type="text"
              value={voucherCode}
              onChange={(e) => { setVoucherCode(e.target.value.toUpperCase()); setVoucherError(''); }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleApplyVoucher(); }}
              placeholder="Voucher code"
              aria-label="Voucher code"
              className="flex-1 min-w-0 rounded-xl px-3.5 py-2 text-sm focus:outline-none"
              style={{
                border: voucherError ? '1.5px solid #8B2020' : '1.5px solid #DDD4C0',
                backgroundColor: '#FAF8F3', color: NEU.ink, fontFamily: OUTFIT,
                letterSpacing: '0.08em', textTransform: 'uppercase',
              }}
            />
            <button
              onClick={handleApplyVoucher}
              disabled={voucherChecking || !voucherCode.trim()}
              className="rounded-full px-4 text-xs font-extrabold focus:outline-none"
              style={{
                border: 'none', fontFamily: OUTFIT, letterSpacing: '0.1em',
                background: voucherChecking || !voucherCode.trim() ? 'rgba(27,56,40,0.14)' : NEU.forest,
                color: voucherChecking || !voucherCode.trim() ? NEU.muted : NEU.gold,
                cursor: voucherChecking || !voucherCode.trim() ? 'default' : 'pointer',
                boxShadow: NEU.outSm,
              }}
            >
              {voucherChecking ? 'CHECKING…' : 'APPLY'}
            </button>
          </div>
        ))}
        {showVoucher && voucherError && !appliedVoucher && (
          <p className="text-xs" style={{ color: '#8B2020', fontFamily: OUTFIT, marginBottom: 10 }}>
            {voucherError}
          </p>
        )}

        {/* Conference fee, no service fee shown — payment happens later,
            direct to the conference, once the applicant is accepted. */}
        <div style={{ borderTop: '1.5px solid rgba(27,56,40,0.14)', paddingTop: 12 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 11, letterSpacing: '0.18em', color: NEU.muted }}>CONFERENCE FEE</span>
            <span style={{ fontFamily: OUTFIT, fontWeight: 900, fontSize: 28, color: NEU.ink, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
              {formatFee(breakdown.postDiscount, breakdown.currency)}
            </span>
          </div>
          <p className="text-right mt-1" style={{ fontFamily: OUTFIT, fontSize: 11, color: NEU.muted }}>
            Paid to the conference after you&apos;re accepted.
          </p>
        </div>
      </NeuInset>
    );
  }

  function renderStep2() {
    const showSociety = !isObserver;
    const takenMsg = 'This delegation has already applied — ask its head delegate or faculty advisor to invite you.';
    return (
      <WizardShell
        step={step}
        total={totalSteps}
        onBack={step > 1 ? () => setStep(s => s - 1) : undefined}
        title={!showSociety ? 'A little background' : isInvoicingRole ? 'Your delegation' : 'How are you applying?'}
        sub={
          !showSociety
            ? 'As an observer, no delegation information is required — just continue.'
            : isInvoicingRole
            ? 'Which society or high school are you representing?'
            : 'Are you applying independently or as part of a high school / society?'
        }
      >
        {showSociety && (
          <>
            {/* ── Big two-card choice (onboarding wizard parity): Independent vs
                Delegation. The image cards return here — the same podium /
                handshake photography the onboarding wizard uses. Invoicing roles
                are always with a society, so they skip straight to the picker. ── */}
            {!isInvoicingRole && (
              <TwoTabPick
                value={isIndependent ? 'independent' : 'society'}
                onChange={(key) => { setIsIndependent(key === 'independent'); setSocietyError(''); }}
                options={[
                  {
                    key: 'independent',
                    label: 'Independent',
                    image: '/onboarding/podium-01.jpg',
                    sub: 'Applying on your own',
                  },
                  {
                    key: 'society',
                    label: 'With a delegation',
                    image: '/onboarding/handshake-01.jpg',
                    sub: 'Part of a society or high school',
                  },
                ]}
              />
            )}
            {!isInvoicingRole && <div className="mb-6" />}

            {/* Invite banner — the applicant arrived via a delegation invite. */}
            {!isIndependent && invitedSocietyId && (
              <div
                className="flex items-center gap-3 rounded-2xl p-4 mb-5"
                style={{ background: 'linear-gradient(135deg, rgba(238,217,138,0.28), rgba(27,56,40,0.05))', border: '1.5px solid rgba(238,217,138,0.55)' }}
              >
                <span
                  className="flex items-center justify-center flex-shrink-0"
                  style={{ width: 34, height: 34, borderRadius: 11, background: 'linear-gradient(150deg, #16301F, #2A5A3C)' }}
                >
                  <Users size={17} strokeWidth={2.2} style={{ color: '#EED98A' }} />
                </span>
                <p className="font-semibold text-sm" style={{ color: '#1C1410', fontFamily: OUTFIT, lineHeight: 1.4 }}>
                  You&apos;ve been invited to join{' '}
                  <span className="font-bold">{inviteSocietyName ?? 'this delegation'}</span>.
                </p>
              </div>
            )}

            {/* Society input */}
            {!isIndependent && (
              <>
                <div className="relative">
                  <label className="block font-semibold text-sm mb-1.5" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
                    Society / High School Name
                  </label>
                  <input
                    type="text"
                    value={societyInput}
                    disabled={!!invitedSocietyId}
                    onChange={(e) => {
                      setSocietyInput(e.target.value);
                      setSelectedSocietyId(null);
                      setSocietyError('');
                    }}
                    onFocus={() => { if (societySuggestions.length > 0) setSocietyDropdownOpen(true); }}
                    onBlur={() => setTimeout(() => setSocietyDropdownOpen(false), 150)}
                    placeholder="e.g. HultMUN, LSE MUN Society..."
                    className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none"
                    style={{
                      border: societyError ? '1.5px solid #8B2020' : '1.5px solid #DDD4C0',
                      backgroundColor: invitedSocietyId ? 'rgba(27,56,40,0.05)' : '#FAF8F3',
                      color: '#1C1410',
                      fontFamily: "'Outfit', sans-serif",
                      cursor: invitedSocietyId ? 'not-allowed' : 'text',
                    }}
                  />
                  {!invitedSocietyId && societyDropdownOpen && societyInput.trim() && (
                    <div
                      className="absolute left-0 right-0 rounded-xl shadow-lg overflow-y-auto"
                      style={{ top: 'calc(100% + 4px)', maxHeight: '200px', backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', zIndex: 20 }}
                    >
                      {societySuggestions.map(s => {
                        // A delegation that already has a head/advisor application
                        // for this conference — grayed out and non-selectable.
                        const taken = takenSocietyIds.has(s.id) && s.id !== invitedSocietyId;
                        return (
                          <button
                            key={s.id}
                            disabled={taken}
                            className="w-full flex items-center justify-between gap-2 text-left px-4 py-2.5 text-sm focus:outline-none"
                            style={{
                              color: taken ? '#B4A992' : '#1C1410',
                              fontFamily: "'Outfit', sans-serif",
                              cursor: taken ? 'not-allowed' : 'pointer',
                              opacity: taken ? 0.7 : 1,
                            }}
                            onMouseEnter={(e) => { if (!taken) (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.05)'; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                            onMouseDown={(e) => {
                              if (taken) {
                                e.preventDefault();
                                setSocietyError(takenMsg);
                                return;
                              }
                              setSocietyInput(s.name);
                              setSelectedSocietyId(s.id);
                              setSocietyError('');
                              setSocietyDropdownOpen(false);
                            }}
                          >
                            <span className="truncate">{s.name}</span>
                            {taken && (
                              <span
                                className="flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold"
                                style={{ backgroundColor: 'rgba(139,32,32,0.1)', color: '#8B2020', letterSpacing: '0.04em' }}
                              >
                                ALREADY APPLIED
                              </span>
                            )}
                          </button>
                        );
                      })}
                      {isInvoicingRole ? (
                        !societySuggestions.some(s => s.name.toLowerCase() === societyInput.toLowerCase()) && (
                          <button
                            className="w-full text-left px-4 py-2.5 text-sm focus:outline-none"
                            style={{ color: '#1B3828', fontFamily: "'Outfit', sans-serif", borderTop: '1px solid #F0EDE6' }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.05)'; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                            onMouseDown={() => {
                              setSelectedSocietyId(null);
                              setSocietyError('');
                              setSocietyDropdownOpen(false);
                            }}
                          >
                            Create &quot;{societyInput}&quot;
                          </button>
                        )
                      ) : (
                        societySuggestions.length === 0 && (
                          <p
                            className="px-4 py-2.5 text-xs leading-relaxed"
                            style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif", borderTop: '1px solid #F0EDE6' }}
                          >
                            This delegation has not been created. Please ask your Head Delegate or Faculty Advisor to create it.
                          </p>
                        )
                      )}
                    </div>
                  )}
                </div>
                {societyError && (
                  <p className="mt-1.5 text-xs" style={{ color: '#8B2020', fontFamily: "'Outfit', sans-serif" }}>
                    {societyError}
                  </p>
                )}
              </>
            )}
          </>
        )}

        <WizardFooter onNext={handleContinue} nextLabel="Continue" primary />
      </WizardShell>
    );
  }

  function renderStepInvoicing() {
    const showSpots = willPledgeSpots === true;
    const pledgeValue = willPledgeSpots === null ? null : willPledgeSpots ? 'yes' : 'no';

    return (
      <WizardShell
        step={step}
        total={totalSteps}
        onBack={() => setStep(s => s - 1)}
        title="Paying for delegation spots?"
        sub="Separate from your own registration fee — this only covers spots for your delegates."
      >
        <TwoTabPick
          value={pledgeValue}
          onChange={(key) => { setWillPledgeSpots(key === 'yes'); setInvoicingError(''); }}
          options={[
            {
              key: 'yes',
              label: 'Yes',
              icon: <Coins size={78} strokeWidth={1.7} style={{ color: NEU.deepGold }} />,
              sub: "I'll pay for my delegation's spots",
            },
            {
              key: 'no',
              label: 'No',
              icon: <Users size={78} strokeWidth={1.7} style={{ color: NEU.forest }} />,
              sub: 'My delegates will pay their own way',
            },
          ]}
        />

        <div className="mt-6" />

        {showSpots && (
          <div className="mb-6">
            <label className="block font-semibold text-sm mb-1.5" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
              How many delegate spots will you pay for?
            </label>
            <input
              type="number"
              min={1}
              step={1}
              value={spotsPledged}
              onChange={(e) => {
                const raw = e.target.value;
                setSpotsPledged(raw === '' ? '' : Math.max(1, Math.floor(Number(raw))));
                setInvoicingError('');
              }}
              className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none"
              style={{ border: '1.5px solid #DDD4C0', backgroundColor: '#FAF8F3', color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}
              onFocus={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#1B3828'; }}
              onBlur={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#DDD4C0'; }}
            />
            <p className="mt-1.5 text-xs leading-relaxed" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
              These spots stay with your delegation once purchased. If a delegate drops out, the spot remains and can be given to their replacement.
            </p>
          </div>
        )}

        {/* Parallel question, quieter treatment than the big yes/no above —
            same step, a second decision rather than a second full screen. */}
        <div className="pt-6 mb-2" style={{ borderTop: '1px solid #F0EDE6' }}>
          <label className="flex items-center gap-2 font-semibold text-sm mb-3" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
            <GraduationCap size={16} style={{ color: NEU.forest }} />
            Paying for advisor tickets?
          </label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => { setWillPledgeAdvisors(true); setInvoicingError(''); }}
              className="flex-1 rounded-xl py-2.5 text-sm font-bold focus:outline-none transition-colors"
              style={{
                border: willPledgeAdvisors === true ? `1.5px solid ${NEU.forest}` : '1.5px solid #DDD4C0',
                backgroundColor: willPledgeAdvisors === true ? 'rgba(27,56,40,0.06)' : 'transparent',
                color: willPledgeAdvisors === true ? NEU.forest : '#6E5F4E',
                fontFamily: "'Outfit', sans-serif",
              }}
            >
              Yes
            </button>
            <button
              type="button"
              onClick={() => { setWillPledgeAdvisors(false); setInvoicingError(''); }}
              className="flex-1 rounded-xl py-2.5 text-sm font-bold focus:outline-none transition-colors"
              style={{
                border: willPledgeAdvisors === false ? `1.5px solid ${NEU.forest}` : '1.5px solid #DDD4C0',
                backgroundColor: willPledgeAdvisors === false ? 'rgba(27,56,40,0.06)' : 'transparent',
                color: willPledgeAdvisors === false ? NEU.forest : '#6E5F4E',
                fontFamily: "'Outfit', sans-serif",
              }}
            >
              No
            </button>
          </div>

          {willPledgeAdvisors === true && (
            <div className="mt-4">
              <label className="block font-semibold text-sm mb-1.5" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
                How many advisor tickets will you pay for?
              </label>
              <input
                type="number"
                min={1}
                step={1}
                value={advisorsPledged}
                onChange={(e) => {
                  const raw = e.target.value;
                  setAdvisorsPledged(raw === '' ? '' : Math.max(1, Math.floor(Number(raw))));
                  setInvoicingError('');
                }}
                className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none"
                style={{ border: '1.5px solid #DDD4C0', backgroundColor: '#FAF8F3', color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}
                onFocus={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#1B3828'; }}
                onBlur={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#DDD4C0'; }}
              />
              <p className="mt-1.5 text-xs leading-relaxed" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
                Tickets stay with your delegation once purchased, pooled the same way as delegate spots.
              </p>
            </div>
          )}
        </div>

        {invoicingError && (
          <p className="mt-3 text-xs text-center" style={{ color: '#8B2020', fontFamily: "'Outfit', sans-serif" }}>
            {invoicingError}
          </p>
        )}

        <WizardFooter
          onNext={handleContinue}
          nextLabel={step >= totalSteps ? (submitting ? 'Submitting…' : (isEditMode ? 'Resubmit application' : 'Submit application')) : 'Continue'}
          primary
          disabled={submitting}
        />
      </WizardShell>
    );
  }

  function renderStep3Preferences() {
    const subtitle = committeesOnly
      ? 'Rank the committees you would most like to sit in.'
      : countriesOnly
      ? 'Rank the countries you would most like to represent.'
      : 'Rank the committee-and-country pairings you would most like to represent.';
    const atMax = preferences.length >= 8;

    // Every mutator snapshots the scroll anchor first so the layout effect can
    // keep the picker from jumping when the ranking panel above grows/shrinks.
    const addPref = (entry: Preference) => {
      anchorPrefScroll();
      setPreferences(prev => (prev.length >= 8 ? prev : [...prev, entry]));
    };
    const removeAt = (i: number) => {
      anchorPrefScroll();
      setPreferences(prev => prev.filter((_, x) => x !== i));
    };
    const move = (i: number, dir: -1 | 1) => {
      anchorPrefScroll();
      setPreferences(prev => {
        const j = i + dir;
        if (j < 0 || j >= prev.length) return prev;
        const next = [...prev];
        [next[i], next[j]] = [next[j], next[i]];
        return next;
      });
    };
    // Native HTML5 drag reorder, same mechanics as QuestionBuilder's block
    // reorder — the index correction accounts for the removed item shifting
    // every later index down by one before the reinsertion.
    const handlePrefDrop = (dropIdx: number) => {
      const from = prefDragIndexRef.current;
      prefDragIndexRef.current = null;
      setPrefDragOverIndex(null);
      if (from === null || from === dropIdx) return;
      anchorPrefScroll();
      setPreferences(prev => {
        const reordered = [...prev];
        const [moved] = reordered.splice(from, 1);
        reordered.splice(from < dropIdx ? dropIdx - 1 : dropIdx, 0, moved);
        return reordered;
      });
    };
    const committeeRank = (id: string) => {
      const i = preferences.findIndex(p => p.committeeId === id);
      return i < 0 ? null : i + 1;
    };
    const isCountrySelected = (id: string, code: string) =>
      preferences.some(p => p.committeeId === id && p.countryCode === code);
    const toggleCommitteeOnly = (c: CommitteeOption) => {
      setPrefError('');
      const i = preferences.findIndex(p => p.committeeId === c.id);
      if (i >= 0) removeAt(i);
      else addPref({ committeeId: c.id, committeeName: c.name, countryCode: '', countryName: '' });
    };
    const toggleCountry = (c: CommitteeOption, slot: CountrySlot) => {
      setPrefError('');
      const i = preferences.findIndex(p => p.committeeId === c.id && p.countryCode === slot.country_code);
      if (i >= 0) removeAt(i);
      else addPref({ committeeId: c.id, committeeName: c.name, countryCode: slot.country_code, countryName: slot.country_name });
    };

    const rankedPanel = preferences.length > 0 && (
      <NeuInset className="mb-5" style={{ padding: 12 }}>
        <p style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 10, letterSpacing: '0.2em', color: NEU.muted, marginBottom: 10, marginLeft: 2 }}>
          YOUR RANKING · {preferences.length}
        </p>
        <p style={{ fontFamily: OUTFIT, fontSize: 11, color: NEU.muted, marginBottom: 8, marginLeft: 2 }}>
          Drag to reorder your preferences.
        </p>
        <div className="flex flex-col gap-2">
          {preferences.map((p, i) => (
            <div key={`${p.committeeId}-${p.countryCode}`}>
              {prefDragOverIndex === i && prefDragOverIndex !== prefDragIndexRef.current && (
                <div className="h-0.5 rounded-full mx-2 mb-2" style={{ backgroundColor: '#1B3828' }} />
              )}
              <RankedRow
                index={i}
                total={preferences.length}
                committee={committees.find(c => c.id === p.committeeId)}
                countryCode={p.countryCode}
                countryName={p.countryName}
                onMove={(dir) => move(i, dir)}
                onRemove={() => removeAt(i)}
                reducedMotion={reducedMotion}
                isDragging={prefDragIndexRef.current === i}
                onDragStart={() => { prefDragIndexRef.current = i; }}
                onDragOver={(e) => { e.preventDefault(); setPrefDragOverIndex(i); }}
                onDrop={() => handlePrefDrop(i)}
                onDragEnd={() => { prefDragIndexRef.current = null; setPrefDragOverIndex(null); }}
              />
            </div>
          ))}
        </div>
      </NeuInset>
    );

    // ── Loading skeleton while slots + availability load.
    if (prefDataLoading && !prefDataLoaded) {
      return (
        <WizardShell
          step={step}
          total={totalSteps}
          onBack={step > 1 ? () => setStep(s => s - 1) : undefined}
          title="Your preferences"
          sub={subtitle}
        >
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: NEU.forest, borderTopColor: 'transparent' }} />
          </div>
        </WizardShell>
      );
    }

    return (
      <WizardShell
        step={step}
        total={totalSteps}
        onBack={step > 1 ? () => setStep(s => s - 1) : undefined}
        title="Your preferences"
        sub={subtitle}
      >
        {minPrefs > 0 && (
          <p className="mb-4" style={{ fontFamily: OUTFIT, fontSize: 12.5, color: NEU.muted }}>
            Pick and order at least <span style={{ fontWeight: 800, color: NEU.ink, fontVariantNumeric: 'tabular-nums' }}>{minPrefs}</span>
            {atMax ? ' · maximum of 8 reached' : ' · rank up to 8'}. Taken options are greyed out.
          </p>
        )}

        {rankedPanel}

        {/* ── Picker ────────────────────────────────────────────────────────
            Scrollable, fixed-height viewport for the committee list. Expanding
            a committee's country tray now scrolls WITHIN this box instead of
            growing the page, so opening a committee never shifts / re-orders the
            list above it (the jarring reflow the old inline layout caused). */}
        <div
          className="pref-picker-scroll"
          style={{
            maxHeight: '58vh',
            overflowY: 'auto',
            overscrollBehavior: 'contain',
            paddingRight: 4,
            marginRight: -4,
            // Anchor the scrollport so a tray opening at the bottom reveals in
            // place rather than nudging the whole column.
            scrollbarGutter: 'stable',
          }}
        >
        {committees.length === 0 ? (
          <NeuInset style={{ padding: 20 }}>
            <p style={{ fontFamily: OUTFIT, fontSize: 13, color: NEU.muted, textAlign: 'center' }}>
              This conference hasn&apos;t published its committees yet. You can still submit — the organisers will assign you.
            </p>
          </NeuInset>
        ) : committeesOnly ? (
          <div className="flex flex-col gap-3">
            {committees.map(c => {
              const info = committeeSlotInfo(c.id);
              return (
                <CommitteeCard
                  key={c.id}
                  committee={c}
                  openCount={info.openCount}
                  totalCount={info.total}
                  rank={committeeRank(c.id)}
                  active={false}
                  disabled={info.full || (atMax && committeeRank(c.id) == null)}
                  showAvailability
                  onClick={() => toggleCommitteeOnly(c)}
                  reducedMotion={reducedMotion}
                />
              );
            })}
          </div>
        ) : countriesOnly ? (
          <div className="flex flex-col gap-5">
            {committees.map(c => {
              const info = committeeSlotInfo(c.id);
              if (info.total === 0) return null;
              const monogram = (c.abbreviation || c.name).slice(0, 3).toUpperCase();
              return (
                <div key={c.id}>
                  <div className="flex items-center gap-2.5 mb-2.5">
                    <LogoDisc src={c.logo_url} alt={c.name} size={30} fallbackText={monogram} />
                    <span style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 13, color: NEU.ink }}>
                      {c.abbreviation || c.name}
                    </span>
                    <DifficultyBadge difficulty={c.difficulty} />
                    {info.full && (
                      <span style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 10, color: '#8B2020', letterSpacing: '0.06em' }}>FULL</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {info.slots.map(slot => {
                      const taken = info.taken.has(slot.country_code);
                      return (
                        <CountryChip
                          key={slot.id}
                          code={slot.country_code}
                          name={slot.country_name}
                          taken={taken || (atMax && !isCountrySelected(c.id, slot.country_code))}
                          selected={isCountrySelected(c.id, slot.country_code)}
                          onClick={() => toggleCountry(c, slot)}
                          reducedMotion={reducedMotion}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          // full mode: committee card → expand → country tray
          <div className="flex flex-col gap-3">
            {committees.map(c => {
              const info = committeeSlotInfo(c.id);
              const expanded = expandedCommitteeId === c.id;
              const chosenHere = preferences.filter(p => p.committeeId === c.id).length;
              return (
                <div key={c.id}>
                  <CommitteeCard
                    committee={c}
                    openCount={info.openCount}
                    totalCount={info.total}
                    rank={null}
                    active={expanded || chosenHere > 0}
                    disabled={info.full && chosenHere === 0}
                    showAvailability
                    onClick={() => setExpandedCommitteeId(prev => (prev === c.id ? null : c.id))}
                    reducedMotion={reducedMotion}
                  />
                  {expanded && (
                    <NeuInset className="mt-2" style={{ padding: 12 }}>
                      {info.total === 0 ? (
                        <p style={{ fontFamily: OUTFIT, fontSize: 12, color: NEU.muted, textAlign: 'center', padding: '6px 0' }}>
                          No countries listed for this committee yet.
                        </p>
                      ) : (
                        <>
                        {/* Free-vs-taken summary — mirrors the conference-portal
                            roster: how many allocations are still open to pick. */}
                        <div className="flex items-center justify-between mb-2.5" style={{ paddingLeft: 2 }}>
                          <span style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 10, letterSpacing: '0.14em', color: NEU.muted }}>
                            PICK AN ALLOCATION
                          </span>
                          <span
                            className="inline-flex items-center gap-1"
                            style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 10.5, letterSpacing: '0.02em', color: info.openCount <= 0 ? '#8B2020' : NEU.green, fontVariantNumeric: 'tabular-nums' }}
                          >
                            {info.openCount <= 0 ? 'ALL TAKEN' : `${info.openCount} of ${info.total} free`}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {info.slots.map(slot => {
                            const taken = info.taken.has(slot.country_code);
                            const selected = isCountrySelected(c.id, slot.country_code);
                            return (
                              <CountryChip
                                key={slot.id}
                                code={slot.country_code}
                                name={slot.country_name}
                                taken={taken || (atMax && !selected)}
                                selected={selected}
                                onClick={() => toggleCountry(c, slot)}
                                reducedMotion={reducedMotion}
                              />
                            );
                          })}
                        </div>
                        </>
                      )}
                    </NeuInset>
                  )}
                </div>
              );
            })}
          </div>
        )}
        </div>

        {prefError && (
          <p className="mt-4 text-xs text-center" style={{ color: '#8B2020', fontFamily: OUTFIT }}>
            {prefError}
          </p>
        )}

        {/* Genuinely optional only when the conference sets no minimum (minPrefs
            === 0) AND nothing has been ranked — then this reads as a skip link,
            exactly like an optional onboarding question. Otherwise it's a real
            required "Continue" (handleContinue blocks below the minimum). */}
        <WizardFooter
          onNext={handleContinue}
          nextLabel={minPrefs === 0 && preferences.length === 0 ? 'Skip this question' : 'Continue'}
          primary={!(minPrefs === 0 && preferences.length === 0)}
        />
      </WizardShell>
    );
  }

  function renderStepExperience() {
    // Experience can be the very first step for roles with no society/
    // preference steps (chair, observer) — there's nowhere to go back to then.
    return (
      <WizardShell
        step={step}
        total={totalSteps}
        onBack={step > 1 ? () => setStep(s => s - 1) : undefined}
        title="About you"
        sub="Set your MUN experience level, or import it from your MUN CV. The organiser sees it with your application and uses it for allocations."
      >
        {(() => {
          // Choosable experience slider. The applicant DRAGS the thumb between
          // the four band stops (Beginner→Expert) — same thresholds as their
          // profile MUN rank — and whatever the slider shows is what submits as
          // experience_level. It can also be AUTOFILLED from the MUN CV: the
          // "Import" button and adding a conference both set it to the derived
          // level (cvEntryCount → experienceProgress).
          const bands = EXPERIENCE_BANDS;
          const n = bands.length;
          const cvDerived = experienceProgress(cvEntryCount);
          const chosenLevel = experienceLevel || cvDerived.level;
          const chosenIdx = Math.max(0, bands.findIndex(b => b.level === chosenLevel));
          const pct = (chosenIdx / (n - 1)) * 100;
          const accent = EXPERIENCE_ACCENT[chosenLevel] ?? NEU.deepGold;
          const RankIcon = EXPERIENCE_ICON[chosenLevel] ?? GraduationCap;

          const setLevelByIdx = (idx: number) => {
            const clamped = Math.min(n - 1, Math.max(0, idx));
            setExperienceLevel(bands[clamped].level);
          };
          const levelFromClientX = (clientX: number) => {
            const el = expTrackRef.current;
            if (!el) return;
            const r = el.getBoundingClientRect();
            if (r.width <= 0) return;
            const frac = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
            setLevelByIdx(Math.round(frac * (n - 1)));
          };
          const onTrackPointerDown = (e: React.PointerEvent) => {
            e.preventDefault();
            levelFromClientX(e.clientX);
            const move = (ev: PointerEvent) => levelFromClientX(ev.clientX);
            const up = () => {
              window.removeEventListener('pointermove', move);
              window.removeEventListener('pointerup', up);
            };
            window.addEventListener('pointermove', move);
            window.addEventListener('pointerup', up);
          };
          const onTrackKeyDown = (e: React.KeyboardEvent) => {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); setLevelByIdx(chosenIdx - 1); }
            else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); setLevelByIdx(chosenIdx + 1); }
            else if (e.key === 'Home') { e.preventDefault(); setLevelByIdx(0); }
            else if (e.key === 'End') { e.preventDefault(); setLevelByIdx(n - 1); }
          };
          const matchesCv = chosenLevel === cvDerived.level;
          return (
            <div className="mb-2">
              {/* ── Step imagery — the same onboarding photography used across
                  the apply flow, so "About you" no longer reads as a bare form. ── */}
              <div
                aria-hidden
                className="relative w-full overflow-hidden mb-5"
                style={{
                  height: 132,
                  borderRadius: 20,
                  backgroundImage: 'url(/onboarding/graduation-01.jpg)',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center 38%',
                  boxShadow: NEU.out,
                }}
              >
                <div
                  className="absolute inset-0"
                  style={{ background: 'linear-gradient(180deg, rgba(22,48,31,0.10) 0%, rgba(22,48,31,0.42) 100%)' }}
                />
              </div>

              {/* ── Level hero — the delegate-rank insignia, sized up so the
                  applicant's tier is the visual anchor of the step. ── */}
              {(() => {
                const heroAccent = LEVEL_ACCENT[chosenLevel] ?? NEU.deepGold;
                const heroLabel = chosenLevel ? chosenLevel.charAt(0).toUpperCase() + chosenLevel.slice(1) : 'Unranked';
                return (
                  <div className="flex items-center gap-3.5 mb-4">
                    <span
                      className="inline-flex items-center justify-center flex-shrink-0"
                      style={{
                        width: 54, height: 54, borderRadius: 9999,
                        background: `linear-gradient(150deg, ${heroAccent}26, ${heroAccent}12)`,
                        border: `1.5px solid ${heroAccent}55`,
                        boxShadow: NEU.outSm,
                      }}
                    >
                      <LevelInsignia level={chosenLevel} size={40} />
                    </span>
                    <div className="min-w-0">
                      <p style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 10, letterSpacing: '0.16em', color: NEU.muted, marginBottom: 2 }}>
                        YOUR MUN LEVEL
                      </p>
                      <p style={{ fontFamily: OUTFIT, fontWeight: 900, fontSize: 20, color: NEU.ink, lineHeight: 1.1 }}>
                        {heroLabel}
                      </p>
                    </div>
                  </div>
                );
              })()}

              {/* Choosable level slider — drag the thumb, click a stop/label, or
                  use the arrow keys; snaps to one of the four bands. */}
              <div
                ref={expTrackRef}
                role="slider"
                tabIndex={0}
                aria-label="MUN experience level"
                aria-valuemin={1}
                aria-valuemax={n}
                aria-valuenow={chosenIdx + 1}
                aria-valuetext={bands[chosenIdx]?.label}
                onPointerDown={onTrackPointerDown}
                onKeyDown={onTrackKeyDown}
                className="relative select-none focus:outline-none"
                style={{ height: 34, cursor: 'pointer', touchAction: 'none' }}
              >
                {/* Inset neu track */}
                <div
                  className="absolute left-0 right-0"
                  style={{ top: '50%', transform: 'translateY(-50%)', height: 8, borderRadius: 9999, backgroundColor: NEU.base, boxShadow: NEU.inSm }}
                />
                {/* Filled portion */}
                <div
                  className="absolute"
                  style={{ top: '50%', transform: 'translateY(-50%)', left: 0, width: `${pct}%`, height: 8, borderRadius: 9999, background: `linear-gradient(90deg, ${accent}CC, ${accent})`, transition: 'width 320ms cubic-bezier(0.22,1,0.36,1)' }}
                />
                {/* Band stops — each clickable to jump to that level */}
                {bands.map((b, i) => {
                  const on = i <= chosenIdx;
                  return (
                    <button
                      key={b.level}
                      type="button"
                      tabIndex={-1}
                      aria-label={`Set level to ${b.label}`}
                      onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); setLevelByIdx(i); }}
                      className="absolute focus:outline-none"
                      style={{
                        left: `${(i / (n - 1)) * 100}%`, top: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: 40, height: 40, borderRadius: 9999,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
                      }}
                    >
                      <span
                        aria-hidden
                        className="block"
                        style={{
                          width: 13, height: 13, borderRadius: 9999, margin: '0 auto',
                          background: on ? accent : NEU.surface,
                          border: `2px solid ${on ? '#FAF8F3' : '#DDD4C0'}`,
                          boxShadow: NEU.outSm,
                        }}
                      />
                    </button>
                  );
                })}
                {/* Thumb, carries the current rank insignia */}
                <span
                  aria-hidden
                  className="absolute flex items-center justify-center"
                  style={{
                    left: `${pct}%`, top: '50%', transform: 'translate(-50%, -50%)',
                    width: 30, height: 30, borderRadius: 9999,
                    background: `radial-gradient(120% 120% at 30% 25%, ${accent} 0%, ${accent}CC 70%)`,
                    border: '3px solid #FAF8F3', boxShadow: `0 3px 9px ${accent}66, ${NEU.outSm}`,
                    transition: 'left 320ms cubic-bezier(0.22,1,0.36,1)',
                    pointerEvents: 'none',
                  }}
                >
                  <RankIcon size={14} strokeWidth={2.4} style={{ color: '#FAF8F3' }} />
                </span>
              </div>
              {/* Stop labels — also clickable */}
              <div className="flex justify-between mt-2">
                {bands.map((b, i) => (
                  <button
                    key={b.level}
                    type="button"
                    onClick={() => setLevelByIdx(i)}
                    className="focus:outline-none"
                    style={{
                      fontFamily: OUTFIT, fontSize: 10.5,
                      fontWeight: i === chosenIdx ? 800 : 600,
                      color: i === chosenIdx ? accent : '#9A8A78',
                      flex: '1 1 0',
                      textAlign: i === 0 ? 'left' : i === n - 1 ? 'right' : 'center',
                      background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
                    }}
                  >
                    {b.label}
                  </button>
                ))}
              </div>

              <p className="text-xs mt-3" style={{ color: '#6E5F4E', fontFamily: OUTFIT, lineHeight: 1.5 }}>
                {matchesCv
                  ? (cvDerived.nextLabel
                      ? `This matches your MUN CV (${cvEntryCount} conference${cvEntryCount === 1 ? '' : 's'} → ${cvDerived.label}). Add ${cvDerived.remaining} more to reach ${cvDerived.nextLabel}.`
                      : `This matches your MUN CV — ${cvDerived.label}, the top rank. Nicely done.`)
                  : `Your MUN CV suggests ${cvDerived.label} (${cvEntryCount} conference${cvEntryCount === 1 ? '' : 's'}). Import to match, or keep your choice.`}
              </p>

              {/* ── CV action: import (re-pull the live conference count). The
                  separate "Add a conference" button was removed — importing from
                  the MUN CV is the single, clear affordance now. ── */}
              <div className="mt-5">
                <button
                  type="button"
                  onClick={refreshCvCount}
                  disabled={cvRefreshing}
                  className="w-full flex items-center justify-center gap-2.5 rounded-2xl px-5 py-3.5 focus:outline-none"
                  style={{
                    backgroundColor: NEU.surface,
                    boxShadow: cvRefreshing ? NEU.inSm : NEU.out,
                    border: '1.5px solid rgba(182,135,31,0.4)',
                    cursor: cvRefreshing ? 'default' : 'pointer',
                    transition: `box-shadow 220ms ${EASE}, transform 220ms ${EASE}`,
                  }}
                  onMouseEnter={(e) => { if (!cvRefreshing) { (e.currentTarget as HTMLElement).style.boxShadow = NEU.outHover; (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; } }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = cvRefreshing ? NEU.inSm : NEU.out; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}
                >
                  <Emoji3D name="Counterclockwise arrows button" size={26} fallback={Sparkles} fallbackColor={NEU.deepGold} />
                  <span style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 13.5, color: NEU.ink }}>
                    {cvRefreshing ? 'Importing…' : 'Import from my MUN CV'}
                  </span>
                </button>
                {/* How many conferences the delegate already has on their CV. */}
                <p className="text-center text-xs font-semibold mt-2.5" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
                  You have <span style={{ fontWeight: 800, color: NEU.ink, fontVariantNumeric: 'tabular-nums' }}>{cvEntryCount}</span> conference{cvEntryCount === 1 ? '' : 's'} on your MUN CV
                </p>
              </div>
            </div>
          );
        })()}

        <WizardFooter onNext={handleContinue} nextLabel="Continue" primary />
      </WizardShell>
    );
  }

  /**
   * Dedicated custom-questions step. Shown for ANY role whose role config has
   * questions (hasCustomQuestions), placed right before Overview — so advisors
   * (and any role that skips Experience) still see and answer their questions
   * instead of Submit stalling. Each Section block is its own page.
   */
  function renderStepQuestions() {
    const pages = splitIntoSections(normalizeBlocks(roleConfig?.custom_questions ?? []));
    const page = pages[questionPage] ?? { section: null, blocks: [] };
    const isFirstPage = questionPage === 0;
    const isLastPage = questionPage === pages.length - 1;

    // There's always a step before Questions (society/invoicing/preferences/
    // experience), but a later section page goes back a page, not a step.
    const canGoBack = !isFirstPage || step > 1;
    function handleBackQuestions() {
      if (!isFirstPage) { setQuestionPage(p => p - 1); return; }
      if (step > 1) setStep(s => s - 1);
    }
    function handleContinueQuestions() {
      const questionCheck = validateAnswers(questionsOf(page.blocks), customAnswers);
      if (!questionCheck.valid) {
        setCustomMissingIds(questionCheck.missingIds);
        return;
      }
      setCustomMissingIds([]);
      if (!isLastPage) { setQuestionPage(p => p + 1); return; }
      handleContinue();
    }

    return (
      <WizardShell
        step={step}
        total={totalSteps}
        onBack={canGoBack ? handleBackQuestions : undefined}
        title={page.section?.title || 'A few questions'}
        sub={page.section?.description || 'The organiser would like a little more from you.'}
      >
        {pages.length > 1 && (
          <p className="mb-3" style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 10, letterSpacing: '0.15em', color: NEU.muted }}>
            SECTION {questionPage + 1} OF {pages.length}
          </p>
        )}

        {page.blocks.length > 0 && (
          <div className="mb-2">
            <CustomQuestionsField
              blocks={page.blocks}
              answers={customAnswers}
              onChange={(next) => {
                setCustomAnswers(next);
                if (customMissingIds.length > 0) {
                  setCustomMissingIds(prev => prev.filter(id => answerIsEmpty(next[id])));
                }
              }}
              missingIds={customMissingIds}
            />
          </div>
        )}

        <WizardFooter onNext={handleContinueQuestions} nextLabel="Continue" primary />
      </WizardShell>
    );
  }

  /**
   * Final step — read-only recap + the credit gate. Submit lives here only;
   * every earlier step advances via handleContinue/advanceStep now that
   * 'overview' is always last in stepSequence.
   */
  function renderStepOverview() {
    const questions = questionsOf(normalizeBlocks(roleConfig?.custom_questions ?? []));
    const societyLabel = isObserver ? null : isIndependent ? 'Independent' : (societyInput.trim() || '—');
    const isTrialPlan = financeProfile.subscription_plan === 'unlimited_trial';
    const tierLabel = isTrialPlan ? 'Free trial' : hasUnlimited ? 'Unlimited' : 'Free';
    const costLabel = isExemptRole
      ? 'No credit needed for this role.'
      : isTrialPlan
      ? 'Included with your free trial'
      : hasUnlimited
      ? 'Included with Gavelling Unlimited ∞'
      : poolCovered
      ? 'Covered by your delegation'
      : 'This application uses 1 Gavelling credit';
    // Same formula as trialDaysLeft in account/unlimited/page.tsx: whole
    // days, floored at 0, never negative. Quiet nudge only, not an upsell.
    const trialDaysLeft = financeProfile.subscription_period_end
      ? Math.max(0, Math.ceil((new Date(financeProfile.subscription_period_end).getTime() - Date.now()) / 86_400_000))
      : null;
    const trialEndingSoon = isTrialPlan && trialDaysLeft !== null && trialDaysLeft <= 5;
    // Edit mode resubmits the existing application via resubmit_application —
    // it never runs the credit-consuming create path in handleSubmit, so the
    // gate/cost card only applies to fresh submissions.
    const gated = !isEditMode && !canApply;

    return (
      <WizardShell
        step={step}
        total={totalSteps}
        onBack={() => {
          // Landing back on Experience (skipped entirely for advisors) always
          // re-opens the Questions step's first section page.
          if (stepSequence[step - 2] === 'questions') setQuestionPage(0);
          setStep(s => s - 1);
        }}
        title="Overview"
        sub="Review your application before submitting."
      >
        {/* ── Application recap, collapsed by default (click to toggle) ── */}
        <button
          type="button"
          onClick={() => setRecapOpen(v => !v)}
          className="w-full flex items-center justify-between rounded-xl px-4 py-3 mb-2 focus:outline-none"
          style={{ backgroundColor: 'rgba(27,56,40,0.05)', border: '1.5px solid rgba(27,56,40,0.14)' }}
        >
          <span className="font-bold text-sm" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
            Your application
          </span>
          {recapOpen
            ? <ChevronUp size={18} strokeWidth={2.3} style={{ color: NEU.muted }} />
            : <ChevronDown size={18} strokeWidth={2.3} style={{ color: NEU.muted }} />}
        </button>

        {recapOpen && (
          <NeuInset className="p-4 mb-4" small>
            <div className="flex flex-col gap-3">
              <div>
                <p style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 10, letterSpacing: '0.15em', color: NEU.muted, marginBottom: 3 }}>ROLE</p>
                <p className="capitalize" style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: 13.5, color: NEU.ink }}>{role.replace(/-/g, ' ')}</p>
              </div>

              {societyLabel && (
                <div>
                  <p style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 10, letterSpacing: '0.15em', color: NEU.muted, marginBottom: 3 }}>DELEGATION</p>
                  <p style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: 13.5, color: NEU.ink }}>{societyLabel}</p>
                </div>
              )}

              {showPreferenceStep && (
                <div>
                  <p style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 10, letterSpacing: '0.15em', color: NEU.muted, marginBottom: 3 }}>PREFERENCES</p>
                  {preferences.length === 0 ? (
                    <p style={{ fontFamily: OUTFIT, fontSize: 13, color: NEU.muted, fontStyle: 'italic' }}>None selected.</p>
                  ) : (
                    <ol className="flex flex-col gap-1">
                      {preferences.map((p, i) => (
                        <li key={i} style={{ fontFamily: OUTFIT, fontSize: 13, color: NEU.ink }}>
                          {i + 1}. {p.committeeName}{p.countryName ? ` — ${p.countryName}` : ''}
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              )}

              {!skipExperience && (
                <div>
                  <p style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 10, letterSpacing: '0.15em', color: NEU.muted, marginBottom: 3 }}>EXPERIENCE</p>
                  <p className="capitalize" style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: 13.5, color: NEU.ink }}>{experienceLevel || '—'}</p>
                </div>
              )}

              {questions.length > 0 && (
                <div className="flex flex-col gap-2.5 pt-1" style={{ borderTop: '1px solid rgba(27,56,40,0.1)' }}>
                  {questions.map(q => {
                    const ans = displayAnswer(q, customAnswers[q.id]);
                    return (
                      <div key={q.id}>
                        <p style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: 12, color: NEU.ink, marginBottom: 2 }}>{q.label}</p>
                        <p className="whitespace-pre-wrap" style={{ fontFamily: OUTFIT, fontSize: 12.5, color: ans ? NEU.muted : '#B08A6A', fontStyle: ans ? 'normal' : 'italic' }}>
                          {ans || 'No answer provided.'}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </NeuInset>
        )}

        {/* ── Registration fee + voucher, surfaced here (final review) instead
            of a leading price step. Null for free/edit-mode. ── */}
        {renderOrderSummary()}

        {/* ── Cost card — sponsored conferences never gate or charge a credit,
            so the balance/plan/buy-more UI is replaced entirely by a single
            celebratory banner. ── */}
        {creditsSponsored ? (
          <div
            className="relative rounded-2xl p-5 mb-4 flex items-center gap-3"
            style={{ background: 'linear-gradient(135deg, rgba(238,217,138,0.28), rgba(27,56,40,0.06))', border: '1.5px solid rgba(238,217,138,0.55)' }}
          >
            <span
              className="flex items-center justify-center flex-shrink-0"
              style={{ width: 34, height: 34, borderRadius: 11, background: 'linear-gradient(150deg, #16301F, #2A5A3C)' }}
            >
              <Sparkles size={17} strokeWidth={2.2} style={{ color: '#EED98A' }} />
            </span>
            <p className="font-bold text-sm" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
              Credits for this conference have been sponsored by Gavelling!
            </p>
          </div>
        ) : (
          <>
            <div className="relative rounded-2xl p-5 mb-4" style={{ backgroundColor: 'rgba(27,56,40,0.05)', border: '1.5px solid rgba(27,56,40,0.14)' }}>
              <div className="absolute top-3.5 right-3.5">
                <CreditInfoTip />
              </div>

              <div className="flex items-center gap-3 mb-3 pr-8">
                <span
                  className="flex items-center justify-center flex-shrink-0"
                  style={{ width: 34, height: 34, borderRadius: 11, background: 'linear-gradient(150deg, #16301F, #2A5A3C)' }}
                >
                  <Coins size={17} strokeWidth={2.2} style={{ color: '#EED98A' }} />
                </span>
                <p className="font-bold text-sm" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
                  {costLabel}
                </p>
              </div>

              {!isExemptRole && !hasUnlimited && !poolCovered && (
                <p className="text-xs" style={{ color: NEU.muted, fontFamily: OUTFIT }}>
                  You have {creditBalanceLoading || creditBalance === null ? '—' : creditBalance} credit{creditBalance === 1 ? '' : 's'}.
                </p>
              )}

              {/* Subscription placard */}
              <div className="flex items-center justify-between mt-4 pt-3" style={{ borderTop: '1px solid rgba(27,56,40,0.1)' }}>
                <span style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: 11.5, color: NEU.muted }}>Your plan</span>
                <Pill tone={hasUnlimited ? 'gold' : 'neutral'} icon={hasUnlimited ? <InfinityIcon size={12} strokeWidth={2.4} /> : undefined}>
                  {tierLabel}
                </Pill>
              </div>
              {trialEndingSoon && (
                <p className="text-xs mt-2" style={{ color: NEU.muted, fontFamily: OUTFIT }}>
                  Your trial ends in {trialDaysLeft} day{trialDaysLeft === 1 ? '' : 's'}.
                </p>
              )}
            </div>

            {gated && (
              <div className="rounded-xl p-4 mb-4" style={{ backgroundColor: 'rgba(139,32,32,0.06)', border: '1.5px solid rgba(139,32,32,0.22)' }}>
                <p className="text-sm font-semibold" style={{ color: '#8B2020', fontFamily: OUTFIT }}>
                  Out of credits?{' '}
                  <button
                    type="button"
                    onClick={goBuyCredits}
                    className="focus:outline-none"
                    style={{ color: '#8B2020', textDecoration: 'underline', background: 'none', border: 'none', padding: 0, font: 'inherit', cursor: 'pointer' }}
                  >
                    Buy more or upgrade your subscription!
                  </button>
                </p>
              </div>
            )}

            {resubmitNeedsCredit && (
              <div className="rounded-xl p-4 mb-4" style={{ backgroundColor: 'rgba(139,32,32,0.06)', border: '1.5px solid rgba(139,32,32,0.22)' }}>
                <p className="text-sm font-semibold" style={{ color: '#8B2020', fontFamily: OUTFIT }}>
                  You need a credit to resubmit.{' '}
                  <button
                    type="button"
                    onClick={goBuyCredits}
                    className="focus:outline-none"
                    style={{ color: '#8B2020', textDecoration: 'underline', background: 'none', border: 'none', padding: 0, font: 'inherit', cursor: 'pointer' }}
                  >
                    Buy more or upgrade your subscription!
                  </button>
                </p>
              </div>
            )}
          </>
        )}

        {/* ── Inline top-up + upgrade — add credits or move to Gavelling
            Unlimited without leaving the application. Only shown when this role
            actually spends credits (never for sponsored / exempt / already-
            Unlimited / edit resubmits), so it stays additive to the summary
            above and never interferes with Submit. ── */}
        {!creditsSponsored && !isExemptRole && !hasUnlimited && !isEditMode && (() => {
          const creditPrice = creditPricing(geoCountry);
          const creditTotal = Math.round(creditPrice.each * creditQty * 100) / 100;
          return (
            <div className="mb-4">
              <p style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 10, letterSpacing: '0.2em', color: NEU.muted, marginBottom: 12 }}>
                NEED MORE CREDITS?
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Add credits — quantity stepper + direct checkout */}
                <UpgradePhotoCard
                  image="/onboarding/laptop-01.jpg"
                  eyebrow="TOP UP"
                  title="Add credits"
                  hoverText="Each credit gives one delegate fee-free access to one conference. Unused credits never expire."
                  accent={NEU.deepGold}
                >
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-1 rounded-full" style={{ backgroundColor: NEU.base, padding: 4, boxShadow: NEU.inSm }}>
                      <button
                        type="button"
                        onClick={() => setCreditQty(q => Math.max(1, q - 1))}
                        disabled={buyingCredits || creditQty <= 1}
                        aria-label="Fewer credits"
                        className="flex items-center justify-center rounded-full focus:outline-none"
                        style={{ width: 26, height: 26, backgroundColor: NEU.surface, boxShadow: NEU.outSm, border: 'none', cursor: buyingCredits || creditQty <= 1 ? 'default' : 'pointer', opacity: buyingCredits || creditQty <= 1 ? 0.5 : 1 }}
                      >
                        <Minus size={13} strokeWidth={2.6} style={{ color: NEU.ink }} />
                      </button>
                      <span className="text-center font-bold text-sm" style={{ width: 26, fontFamily: OUTFIT, color: NEU.ink, fontVariantNumeric: 'tabular-nums' }}>
                        {creditQty}
                      </span>
                      <button
                        type="button"
                        onClick={() => setCreditQty(q => Math.min(CREDIT_MAX_QTY, q + 1))}
                        disabled={buyingCredits || creditQty >= CREDIT_MAX_QTY}
                        aria-label="More credits"
                        className="flex items-center justify-center rounded-full focus:outline-none"
                        style={{ width: 26, height: 26, backgroundColor: NEU.surface, boxShadow: NEU.outSm, border: 'none', cursor: buyingCredits || creditQty >= CREDIT_MAX_QTY ? 'default' : 'pointer', opacity: buyingCredits || creditQty >= CREDIT_MAX_QTY ? 0.5 : 1 }}
                      >
                        <Plus size={13} strokeWidth={2.6} style={{ color: NEU.ink }} />
                      </button>
                    </div>
                    <span className="text-xs" style={{ color: NEU.muted, fontFamily: OUTFIT, whiteSpace: 'nowrap' }}>
                      {formatFee(creditPrice.each, creditPrice.currency)} each
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleBuyCreditsInline}
                    disabled={buyingCredits}
                    className="w-full rounded-xl py-2.5 font-bold text-xs focus:outline-none"
                    style={{
                      backgroundColor: buyingCredits ? 'rgba(27,56,40,0.14)' : NEU.forest,
                      color: buyingCredits ? NEU.muted : NEU.gold,
                      fontFamily: OUTFIT, letterSpacing: '0.06em', border: 'none',
                      boxShadow: NEU.outSm, cursor: buyingCredits ? 'default' : 'pointer',
                    }}
                  >
                    {buyingCredits ? 'STARTING CHECKOUT…' : `BUY FOR ${formatFee(creditTotal, creditPrice.currency)}`}
                  </button>
                </UpgradePhotoCard>

                {/* Upgrade to Gavelling Unlimited — existing subscription flow */}
                <UpgradePhotoCard
                  image="/onboarding/globe-01.jpg"
                  eyebrow="GO UNLIMITED"
                  title="Gavelling Unlimited"
                  hoverText="Apply to unlimited conferences with no per-application credits — one subscription covers it all."
                  accent="#B6871F"
                >
                  <div className="flex items-center gap-1.5 mb-3">
                    <InfinityIcon size={15} strokeWidth={2.4} style={{ color: '#B6871F' }} />
                    <span className="text-xs" style={{ color: NEU.muted, fontFamily: OUTFIT, lineHeight: 1.4 }}>
                      Never spend a credit again.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={goUnlimited}
                    disabled={upgradingUnlimited}
                    className="w-full rounded-xl py-2.5 font-bold text-xs focus:outline-none"
                    style={{
                      background: upgradingUnlimited ? 'rgba(182,135,31,0.4)' : 'linear-gradient(135deg, #EED98A, #B6871F)',
                      color: '#3A2A08',
                      fontFamily: OUTFIT, letterSpacing: '0.06em', border: 'none',
                      boxShadow: NEU.outSm, cursor: upgradingUnlimited ? 'default' : 'pointer',
                    }}
                  >
                    {upgradingUnlimited ? 'OPENING…' : 'UPGRADE'}
                  </button>
                  <Link
                    href="/account/unlimited"
                    className="block text-center text-[11px] mt-2"
                    style={{ color: NEU.muted, fontFamily: OUTFIT, textDecoration: 'underline', textUnderlineOffset: 2 }}
                  >
                    Yearly billing available in your account settings.
                  </Link>
                </UpgradePhotoCard>
              </div>
              {(buyCreditsError || unlimitedError) && (
                <p className="text-xs mt-2.5 text-center" style={{ color: '#8B2020', fontFamily: OUTFIT }}>
                  {buyCreditsError || unlimitedError}
                </p>
              )}
            </div>
          );
        })()}

        {submitError && (
          <p className="mb-4 text-sm text-center" style={{ color: '#8B2020', fontFamily: OUTFIT }}>
            {submitError}
          </p>
        )}

        <WizardFooter
          onNext={handleSubmit}
          nextLabel={submitting ? 'Submitting…' : (isEditMode ? 'Resubmit application' : 'Submit application')}
          primary
          disabled={submitting || gated}
        />

        {/* ── Withdraw application — secondary, destructive; only while the
            application is still pending ('submitted'). Two-step confirm. ── */}
        {isEditMode && existingApp?.status === 'submitted' && (
          <div className="mt-8 pt-6" style={{ borderTop: '1px solid rgba(27,56,40,0.12)' }}>
            {!withdrawConfirm ? (
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => { setWithdrawConfirm(true); setWithdrawError(''); }}
                  className="text-xs font-semibold focus:outline-none"
                  style={{ color: NEU.muted, fontFamily: OUTFIT, letterSpacing: '0.04em', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3 }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#8B2020'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = NEU.muted; }}
                >
                  Withdraw application
                </button>
              </div>
            ) : (
              <div className="rounded-xl p-4" style={{ backgroundColor: 'rgba(139,32,32,0.05)', border: '1.5px solid rgba(139,32,32,0.22)' }}>
                <p className="font-bold text-sm mb-1" style={{ color: '#8B2020', fontFamily: OUTFIT }}>
                  Withdraw this application?
                </p>
                <p className="text-xs mb-3" style={{ color: 'rgba(28,20,16,0.72)', fontFamily: OUTFIT, lineHeight: 1.6 }}>
                  Your application to {conference?.acronym} will be cancelled and removed from your conferences. Any Gavelling credit you spent is refunded. This can&apos;t be undone — you&apos;d need to apply again.
                </p>
                {withdrawError && (
                  <p className="text-xs mb-3" style={{ color: '#8B2020', fontFamily: OUTFIT }}>
                    {withdrawError}
                  </p>
                )}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleWithdraw}
                    disabled={withdrawing}
                    className="rounded-xl py-2 px-4 text-xs font-bold focus:outline-none"
                    style={{ backgroundColor: withdrawing ? 'rgba(139,32,32,0.4)' : '#8B2020', color: '#FBEDED', fontFamily: OUTFIT, letterSpacing: '0.06em', border: 'none', cursor: withdrawing ? 'not-allowed' : 'pointer' }}
                  >
                    {withdrawing ? 'WITHDRAWING…' : 'YES, WITHDRAW'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setWithdrawConfirm(false); setWithdrawError(''); }}
                    disabled={withdrawing}
                    className="rounded-xl py-2 px-4 text-xs font-bold focus:outline-none"
                    style={{ border: '1.5px solid #C8BEA8', color: NEU.ink, fontFamily: OUTFIT, background: 'transparent', cursor: withdrawing ? 'not-allowed' : 'pointer' }}
                  >
                    CANCEL
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </WizardShell>
    );
  }

  // ── Early returns ─────────────────────────────────────────────────────────

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#EDE7D8' }}>
        <div className="w-7 h-7 rounded-full border-2 animate-spin" style={{ borderColor: '#1B3828', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (notFound || !conference) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#EDE7D8' }}>
        <div className="pointer-events-none fixed inset-0 z-[1]" style={{ backgroundImage: GRAIN, backgroundRepeat: 'repeat', backgroundSize: '300px 300px', mixBlendMode: 'multiply', opacity: 0.18 }} />
        <SiteNav />
        <div className="relative z-10 flex-1 flex items-center justify-center px-6 py-20 text-center">
          <div>
            <p className="text-xs tracking-widest mb-3" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>404</p>
            <h1 className="font-black text-2xl mb-2" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>Conference Not Found</h1>
            <Link href="/conferences/explore" className="text-sm font-semibold" style={{ color: '#1B3828', textDecoration: 'none' }}>
              Explore conferences →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // A valid edit session (edit=1, resolved against an actually-editable
  // application) bypasses both the "already applied" wall and the
  // applications-closed wall below — they're editing an application that
  // already exists, not creating a new one. Requires roleConfig to still
  // exist (the submit path + order summary read it non-null) — is_enabled
  // doesn't matter here, an existing applicant can still edit while paused.
  const canEdit = isEditMode && !!existingApp && !!roleConfig
    && (existingApp.status === 'rejected' || existingApp.status === 'submitted');

  // One-active-application-per-conference: an active application under a
  // different role blocks a fresh apply here, same wall treatment as
  // "already applied". Checked BEFORE the same-role wall (and skipped
  // entirely by canEdit) so editing/resubmitting one's own rejected or
  // submitted application is never blocked by a second, unrelated role.
  if (!canEdit && otherRoleApp) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#EDE7D8' }}>
        <div className="pointer-events-none fixed inset-0 z-[1]" style={{ backgroundImage: GRAIN, backgroundRepeat: 'repeat', backgroundSize: '300px 300px', mixBlendMode: 'multiply', opacity: 0.18 }} />
        <SiteNav />
        <div className="relative z-10 flex-1 flex items-center justify-center px-6 py-20">
          <div className="rounded-2xl p-10 text-center max-w-sm w-full" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0' }}>
            <h2 className="font-semibold text-lg mb-2" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
              You&apos;ve already applied
            </h2>
            <p className="text-sm mb-6" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
              You already have an active {otherRoleApp.role.replace(/-/g, ' ')} application to this conference. Withdraw it or contact the organizing team if you need to change roles.
            </p>
            <Link
              href={`/conferences/${slug}`}
              className="inline-block rounded-xl py-2.5 px-6 font-bold text-sm focus:outline-none"
              style={{ backgroundColor: '#1B3828', color: '#EED98A', textDecoration: 'none', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.08em' }}
            >
              VIEW CONFERENCE →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (existingApp && !canEdit) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#EDE7D8' }}>
        <div className="pointer-events-none fixed inset-0 z-[1]" style={{ backgroundImage: GRAIN, backgroundRepeat: 'repeat', backgroundSize: '300px 300px', mixBlendMode: 'multiply', opacity: 0.18 }} />
        <SiteNav />
        <div className="relative z-10 flex-1 flex items-center justify-center px-6 py-20">
          <div className="rounded-2xl p-10 text-center max-w-sm w-full" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0' }}>
            <h2 className="font-semibold text-lg mb-2" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
              You&apos;ve already applied
            </h2>
            <p className="text-sm mb-6" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
              Your application as {role.replace(/-/g, ' ')} is {existingApp.status}.
            </p>
            <Link
              href={`/conferences/${slug}`}
              className="inline-block rounded-xl py-2.5 px-6 font-bold text-sm focus:outline-none"
              style={{ backgroundColor: '#1B3828', color: '#EED98A', textDecoration: 'none', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.08em' }}
            >
              VIEW CONFERENCE →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if ((!roleConfig || !roleConfig.is_enabled) && !canEdit) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#EDE7D8' }}>
        <div className="pointer-events-none fixed inset-0 z-[1]" style={{ backgroundImage: GRAIN, backgroundRepeat: 'repeat', backgroundSize: '300px 300px', mixBlendMode: 'multiply', opacity: 0.18 }} />
        <SiteNav />
        <div className="relative z-10 flex-1 flex items-center justify-center px-6 py-20">
          <div className="rounded-2xl p-10 text-center max-w-sm w-full" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0' }}>
            <h2 className="font-semibold text-lg mb-2" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
              Applications are not open
            </h2>
            <p className="text-sm mb-4" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
              Applications for {role.replace(/-/g, ' ')} are not currently open for this conference.
            </p>
            <Link
              href={`/conferences/${slug}`}
              className="text-sm font-semibold"
              style={{ color: '#1B3828', textDecoration: 'none', fontFamily: "'Outfit', sans-serif" }}
            >
              ← Back
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Age gate screens ──────────────────────────────────────────────────────

  if (underAge) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#EDE7D8' }}>
        <div className="pointer-events-none fixed inset-0 z-[1]" style={{ backgroundImage: GRAIN, backgroundRepeat: 'repeat', backgroundSize: '300px 300px', mixBlendMode: 'multiply', opacity: 0.18 }} />
        <SiteNav />
        <div className="relative z-10 flex-1 flex items-center justify-center px-6 py-20">
          <div className="rounded-2xl p-10 text-center max-w-md w-full" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0' }}>
            <span
              className="inline-flex items-center rounded-full px-3 py-1 mb-4 text-[11px] font-bold"
              style={{ backgroundColor: 'rgba(139,32,32,0.08)', border: '1px solid rgba(139,32,32,0.25)', color: '#8B2020', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.08em' }}
            >
              AGE REQUIREMENT
            </span>
            <h2 className="font-semibold text-lg mb-2" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
              This conference requires delegates to be at least {minAgeLimit} years old
            </h2>
            <p className="text-sm mb-6" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif", lineHeight: 1.7 }}>
              Based on your date of birth, you will be {ageAtStart} when {conference.acronym} starts, so you can&apos;t apply this time. If your date of birth is wrong, you can update it in your profile.
            </p>
            <div className="flex items-center justify-center gap-4">
              <Link
                href="/account/profile"
                className="text-sm font-semibold"
                style={{ color: '#1B3828', textDecoration: 'none', fontFamily: "'Outfit', sans-serif" }}
              >
                Edit profile
              </Link>
              <Link
                href={`/conferences/${slug}`}
                className="text-sm font-semibold"
                style={{ color: '#9A8A78', textDecoration: 'none', fontFamily: "'Outfit', sans-serif" }}
              >
                ← Back to {conference.acronym}
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (needsDob) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#EDE7D8' }}>
        <div className="pointer-events-none fixed inset-0 z-[1]" style={{ backgroundImage: GRAIN, backgroundRepeat: 'repeat', backgroundSize: '300px 300px', mixBlendMode: 'multiply', opacity: 0.18 }} />
        <SiteNav />
        <div className="relative z-10 flex-1 flex items-center justify-center px-6 py-20">
          <div className="rounded-2xl p-10 max-w-md w-full" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0' }}>
            <span
              className="inline-flex items-center rounded-full px-3 py-1 mb-4 text-[11px] font-bold"
              style={{ backgroundColor: 'rgba(182,135,31,0.12)', border: '1px solid rgba(182,135,31,0.35)', color: '#B6871F', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.08em' }}
            >
              {minAgeLimit}+ CONFERENCE
            </span>
            <h2 className="font-semibold text-lg mb-2" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
              Add your date of birth to continue
            </h2>
            <p className="text-sm mb-6" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif", lineHeight: 1.7 }}>
              This conference requires delegates to be at least {minAgeLimit} years old, and your profile doesn&apos;t have a date of birth yet. It will be saved to your profile.
            </p>
            <label className="block font-semibold text-sm mb-1.5" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
              Date of birth
            </label>
            <DatePicker
              value={dobInput}
              max={new Date().toISOString().slice(0, 10)}
              initialView="2005-06-15"
              placeholder="Select your date of birth"
              onChange={(iso) => { setDobInput(iso); setDobError(''); }}
            />
            {dobError && (
              <p className="mt-1.5 text-xs" style={{ color: '#8B2020', fontFamily: "'Outfit', sans-serif" }}>
                {dobError}
              </p>
            )}
            <button
              onClick={handleSaveDob}
              disabled={dobSaving || !dobInput}
              className="w-full mt-4 rounded-xl py-3 font-bold text-sm focus:outline-none transition-colors"
              style={{
                backgroundColor: (dobSaving || !dobInput) ? '#DDD4C0' : '#1B3828',
                color: (dobSaving || !dobInput) ? '#9A8A78' : '#EED98A',
                fontFamily: "'Outfit', sans-serif",
                letterSpacing: '0.08em',
                cursor: (dobSaving || !dobInput) ? 'default' : 'pointer',
              }}
              onMouseEnter={(e) => { if (!dobSaving && dobInput) (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
              onMouseLeave={(e) => { if (!dobSaving && dobInput) (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
            >
              {dobSaving ? 'SAVING...' : 'SAVE & CONTINUE'}
            </button>
            <div className="text-center mt-4">
              <Link
                href={`/conferences/${slug}`}
                className="text-sm font-semibold"
                style={{ color: '#9A8A78', textDecoration: 'none', fontFamily: "'Outfit', sans-serif" }}
              >
                ← Back to {conference.acronym}
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Main form ─────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col relative" style={{ backgroundColor: '#EDE7D8' }}>
      <div className="pointer-events-none fixed inset-0 z-[1]" style={{ backgroundImage: GRAIN, backgroundRepeat: 'repeat', backgroundSize: '300px 300px', mixBlendMode: 'multiply', opacity: 0.18 }} />
      <SiteNav />

      <div className="relative z-10 flex-1 px-6 py-10" style={{ maxWidth: 760, margin: '0 auto', width: '100%' }}>
        {/* Breadcrumb */}
        <div className="mb-4">
          <Link
            href={`/conferences/${slug}`}
            className="text-xs"
            style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif", fontWeight: 600, letterSpacing: '0.06em', textDecoration: 'none' }}
          >
            ← {conference.acronym}
          </Link>
        </div>

        {isEditMode && (
          <div className="flex justify-center mb-2">
            <div
              className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5"
              style={{ backgroundColor: 'rgba(182,135,31,0.14)', border: '1px solid rgba(182,135,31,0.35)' }}
            >
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: '#8A6614', fontFamily: "'Outfit', sans-serif" }}>
                EDITING YOUR APPLICATION
              </span>
            </div>
          </div>
        )}

        {/* Each step now supplies its own WizardShell — the golden segmented
            progress bar, big title/subtitle, top-left back arrow and (optional)
            skip link — so the flow reads exactly like the onboarding wizard.
            No separate step indicator or form card wrapper anymore. */}
        {currentStepKind === 'society' && renderStep2()}
        {currentStepKind === 'invoicing' && renderStepInvoicing()}
        {currentStepKind === 'preferences' && renderStep3Preferences()}
        {currentStepKind === 'experience' && renderStepExperience()}
        {currentStepKind === 'questions' && renderStepQuestions()}
        {currentStepKind === 'overview' && renderStepOverview()}
      </div>

      {/* Inline "add a conference to my MUN CV" — the shared modal. Saving
          re-pulls the CV count so the derived experience slider updates live. */}
      {cvModalOpen && user && (
        <CVEntryModal
          existing={null}
          userId={user.id}
          onClose={() => setCvModalOpen(false)}
          onSaved={refreshCvCount}
          onDelete={handleDeleteCvEntry}
        />
      )}
    </div>
  );
}

// ── Default export with Suspense ───────────────────────────────────────────

export default function ConferenceApplyClient() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#EDE7D8' }}>
          <div className="w-7 h-7 rounded-full border-2 animate-spin" style={{ borderColor: '#1B3828', borderTopColor: 'transparent' }} />
        </div>
      }
    >
      <ConferenceApplyInner />
    </Suspense>
  );
}
