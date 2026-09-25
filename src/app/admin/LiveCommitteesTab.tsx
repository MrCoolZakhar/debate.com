'use client';

// ─────────────────────────────────────────────────────────────────────────────
// Gavelling staff → Live committees.
//
// Every committee on the platform that is actually being used right now,
// whether it belongs to a conference or is a standalone session someone
// started from the landing page.
//
// SECURITY: this component holds no access logic worth trusting. The gate is
// admin_live_committees(), a SECURITY DEFINER function that raises
// 'not authorised' unless is_platform_admin() — the identical shape to
// admin_conference_overview(). A non-staff visitor gets an error from the
// database and sees an inert panel; the route being reachable leaks nothing.
//
// DEFINITION OF "LIVE" (Peter's, adopted verbatim — see admin_live_committees):
//   updated_at >= now() - 24h          … used in the last day
//   updated_at - created_at > 30 min   … lived long enough to be a real session
//   ended_at is null                   … not gavelled out
// The lifespan filter is the important one: hundreds of committees get created
// and abandoned within a minute or two, and without it the board is noise.
//
// STATUS vs PHASE — deliberately two separate things:
//   status answers "is anyone actually in there right now"  (Live / Idle / Suspended)
//   phase  answers "what are they doing"                    (GSL, caucus, voting…)
//
// LOOK (23 Sep 2026, owner: "design them similar to the live status for
// conferences"): each room is the organiser live wall's card
// (manage/[slug]/live/CommitteeCard.tsx), mirrored rather than imported, since
// that card needs the full per-conference LiveCommittee load and this board
// only has one aggregate row per room. Same bands: status rail, emblem
// straddling the top edge, identity with the status word and the dais beneath
// it, a NOW PLAYING well (round speaker flag, motion, clock meter, up-next
// flags per list, never merged: RULE 1), then the facts and one footer action.
// Hairline forest borders and forest-tinted shadows only; no white halo.
// Every clock is derived from its stored anchor on a 1 s tick; nothing writes.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  RefreshCw, Search, Copy, Check, Gavel, Users, Mic, Info, Radio, Timer, Pause,
  PauseCircle, Globe2, ScrollText, FileText, Hand, ArrowUpRight, Clock,
} from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { CircleFlag } from '@/components/CircleFlag';
import { conferenceAcronymLabel } from '@/lib/conferenceLabels';
import { LogoDisc } from '@/components/LogoDisc';
import Portal from '@/components/Portal';
import { getCountryByCode } from '@/lib/countries';
import { committeeDisplayName } from '@/lib/presetNames';
import { caucusRemainingNow, speakerRemainingNow } from '@/lib/committeeService';
import type { CaucusState } from '@/lib/types';
import Loader from '@/components/Loader';
import { NEU, NEU_GRADIENTS, OUTFIT, EASE } from '@/components/neu';
import {
  SOFT, AMBER_INK, GREEN_INK, RED, CARD_BORDER, CARD_BORDER_COLOR, CARD_SHADOW, CARD_SHADOW_HOVER,
} from '@/components/scoreboardTokens';

const MONO = 'ui-monospace, monospace';
const SURFACE = '#F0EBDD';
// The neumorphic dent: the page ground pressed into the card.
const WELL = NEU.base;
const WELL_EDGE = NEU.in;

// ── Row shape, mirrors admin_live_committees() exactly ──────────────────────

interface CaucusJson {
  active?: boolean;
  type?: 'moderated' | 'unmoderated';
  motionLabel?: string;
  purpose?: string;
  totalTime?: number;
  remainingTime?: number;
  speakingTime?: number;
  currentSpeaker?: string | null;
  totalStartedAt?: string | null;
  isConsultation?: boolean;
}

interface LiveRow {
  id: string;
  code: string;
  name: string;
  topic: string | null;
  phase: string;
  chair_names: string[] | null;
  caucus: CaucusJson | null;
  created_at: string;
  updated_at: string;
  suspended_at: string | null;
  expires_at: string | null;
  session_origin: string | null;
  active_minutes: number;
  idle_minutes: number;
  suspended: boolean;
  speaker_country: string | null;
  speaker_started_at: string | null;
  speaker_time_remaining: number;
  delegates_total: number;
  delegates_present: number;
  gsl_queue: number;
  caucus_queue: number;
  pending_motions: number;
  documents_total: number;
  /** ISO 3166-1 alpha-2 captured at creation. NULL for every session created
   *  before the column existed, rendered as "Unknown", never guessed. */
  creator_country: string | null;
  conference_id: string | null;
  conference_slug: string | null;
  conference_acronym: string | null;
  conference_name: string | null;
  conference_city: string | null;
  conference_country: string | null;
  committee_abbreviation: string | null;
  committee_logo_url: string | null;
  conference_start_date: string | null;
  // Appended by migration admin_live_committees_live_wall_fields.
  conference_logo_url: string | null;
  speaker_time_granted: number | null;
  gsl_next: string[] | null;
  caucus_next: string[] | null;
}

type Status = 'live' | 'idle' | 'suspended';
type Filter = 'all' | 'live' | 'idle' | 'suspended' | 'conference' | 'standalone';

/** Peter's three-state model: suspended wins, then a 15-minute idle cut. */
function statusOf(r: LiveRow): Status {
  if (r.suspended) return 'suspended';
  return r.idle_minutes <= 15 ? 'live' : 'idle';
}

// Rail colour, and the WORD in an ink that passes AA (the live wall's rule).
const STATUS_META: Record<Status, { label: string; color: string; ink: string; pulse?: boolean }> = {
  live: { label: 'Live', color: NEU.green, ink: GREEN_INK, pulse: true },
  idle: { label: 'Idle', color: '#B8A98F', ink: SOFT },
  suspended: { label: 'Suspended', color: RED, ink: RED },
};

function fmtActive(mins: number): string {
  const m = Math.max(0, Math.round(mins));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return m % 60 === 0 ? `${h}h` : `${h}h ${m % 60}m`;
  const d = Math.floor(h / 24);
  return h % 24 === 0 ? `${d}d` : `${d}d ${h % 24}h`;
}

function fmtIdle(mins: number): string {
  const m = Math.max(0, Math.round(mins));
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function fmtClock(s: number): string {
  const v = Math.max(0, Math.round(s));
  return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`;
}

// ── NOW PLAYING, derived from one row ───────────────────────────────────────

type Glyph = 'mic' | 'timer' | 'users' | 'ballot' | 'pause';
type Tone = 'live' | 'warn' | 'off';
interface NowPlaying {
  context: string;
  topic: string | null;
  headline: string;
  dim: boolean;
  flag: string | null;
  glyph: Glyph;
  tone: Tone;
  pct: number | null;
  left: string;
  right: string;
  next: { label: string; names: string[] } | null;
}

const GLYPH_ICON: Record<Glyph, typeof Mic> = { mic: Mic, timer: Timer, users: Users, ballot: ScrollText, pause: Pause };

function isTour(c: CaucusJson | null): boolean {
  return !!c?.purpose && /^Tour de Table/i.test(c.purpose);
}

function nowPlaying(r: LiveRow): NowPlaying {
  const c = r.caucus;
  const inCaucus = (r.phase === 'moderated-caucus' || r.phase === 'unmoderated-caucus') && !!c && c.active !== false;
  const gsl = r.gsl_next ?? [];
  const cq = r.caucus_next ?? [];

  if (r.suspended || (r.phase === 'adjourned')) {
    return {
      context: 'Suspended', topic: null, headline: 'Paused by the dais', dim: true, flag: null,
      glyph: 'pause', tone: 'warn', pct: null, left: r.suspended_at ? `since ${fmtIdle((Date.now() - new Date(r.suspended_at).getTime()) / 60000).replace(' ago', '')}` : '',
      right: '', next: gsl.length ? { label: "General Speakers' List", names: gsl } : null,
    };
  }

  if (r.phase === 'pre-session' || r.phase === 'roll-call') {
    const total = r.delegates_total;
    return {
      context: 'Roll call', topic: null,
      headline: total ? `${r.delegates_present} of ${total} present` : 'No delegations yet',
      dim: total === 0, flag: null, glyph: 'users', tone: 'off',
      pct: total ? (r.delegates_present / total) * 100 : null,
      left: 'Before debate', right: total ? `${Math.round((r.delegates_present / total) * 100)}%` : '',
      next: null,
    };
  }

  if (r.phase === 'voting') {
    return {
      context: 'Voting procedure', topic: null, headline: 'A draft resolution is being voted on',
      dim: false, flag: null, glyph: 'ballot', tone: 'live', pct: null,
      left: 'Clocks paused for the vote', right: '', next: null,
    };
  }

  if (inCaucus && c) {
    const total = Number(c.totalTime) || 0;
    const left = caucusRemainingNow(c as unknown as CaucusState);
    const running = !!c.totalStartedAt;
    const pct = total > 0 ? Math.min(100, (left / total) * 100) : null;
    if (c.type === 'unmoderated') {
      return {
        context: c.isConsultation ? 'Consultation of the Whole' : (c.motionLabel?.trim() || 'Unmoderated caucus'),
        topic: c.purpose?.trim() || null,
        headline: c.isConsultation ? (r.speaker_country ?? 'The floor is open') : 'Delegates negotiating',
        dim: false, flag: c.isConsultation ? r.speaker_country : null, glyph: 'timer',
        tone: left <= 0 ? 'warn' : running ? 'live' : 'warn', pct,
        left: running ? 'Running' : 'Paused', right: `${fmtClock(left)} left`, next: null,
      };
    }
    const speaker = r.speaker_country || c.currentSpeaker || null;
    const onDeck = !speaker && cq.length ? cq[0] : null;
    const spkLeft = speaker ? speakerRemainingNow(r.speaker_time_remaining, r.speaker_started_at) : 0;
    return {
      context: isTour(c) ? 'Tour de Table' : (c.motionLabel?.trim() || 'Moderated caucus'),
      topic: isTour(c) ? null : (c.purpose?.trim() || null),
      headline: speaker ?? (onDeck ? `${onDeck} is ready to speak` : 'Nobody on the floor'),
      dim: !speaker && !onDeck, flag: speaker ?? onDeck, glyph: 'mic',
      tone: left <= 0 ? 'warn' : r.speaker_started_at ? 'live' : 'warn', pct,
      left: speaker ? `${fmtClock(spkLeft)} for the speaker` : running ? 'Running' : 'Paused',
      right: `${fmtClock(left)} left`,
      next: cq.slice(onDeck ? 1 : 0).length ? { label: 'Caucus queue', names: cq.slice(onDeck ? 1 : 0) } : null,
    };
  }

  // General Speakers' List (and anything unrecognised).
  const speaker = r.speaker_country;
  const onDeck = !speaker && gsl.length ? gsl[0] : null;
  const granted = Number(r.speaker_time_granted) || 0;
  const spkLeft = speaker ? speakerRemainingNow(r.speaker_time_remaining, r.speaker_started_at) : 0;
  const running = !!(speaker && r.speaker_started_at);
  return {
    context: "General Speakers' List", topic: null,
    headline: speaker ?? (onDeck ? `${onDeck} is ready to speak` : 'Nobody on the list'),
    dim: !speaker && !onDeck, flag: speaker ?? onDeck, glyph: 'mic',
    tone: running ? (spkLeft <= 0 ? 'warn' : 'live') : speaker ? 'warn' : 'off',
    pct: speaker && granted > 0 ? Math.min(100, (spkLeft / granted) * 100) : null,
    left: speaker ? (running ? 'Speaking' : 'Paused') : onDeck ? 'On deck' : 'Waiting for the next speaker',
    right: speaker ? `${fmtClock(spkLeft)} left` : '',
    next: gsl.slice(onDeck ? 1 : 0).length ? { label: "General Speakers' List", names: gsl.slice(onDeck ? 1 : 0) } : null,
  };
}

function toneInk(t: Tone): string { return t === 'live' ? GREEN_INK : t === 'warn' ? AMBER_INK : SOFT; }
function toneFill(t: Tone): [string, string] { return t === 'warn' ? NEU_GRADIENTS.amber : NEU_GRADIENTS.sage; }

// ── HoverHint: portaled, flips at the viewport edges, opens on HOVER ────────

function HoverHint({ children, width = 300 }: { children: React.ReactNode; width?: number }) {
  const btnRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const place = useCallback(() => {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const margin = 10;
    const left = Math.max(margin, Math.min(r.left, window.innerWidth - width - margin));
    const below = window.innerHeight - r.bottom;
    const top = below < 150 ? Math.max(margin, r.top - 8 - 140) : r.bottom + 8;
    setPos({ left, top });
  }, [width]);

  useEffect(() => {
    if (!open) return;
    place();
    const onScroll = () => place();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open, place]);

  const show = () => { if (closeTimer.current) clearTimeout(closeTimer.current); setOpen(true); };
  const hide = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 160);
  };

  return (
    <>
      <span
        ref={btnRef}
        tabIndex={0}
        role="button"
        aria-label="More information"
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        className="inline-flex items-center justify-center rounded-full align-middle focus:outline-none"
        style={{ width: 17, height: 17, backgroundColor: SURFACE, border: CARD_BORDER, color: SOFT, cursor: 'help', flexShrink: 0 }}
      >
        <Info size={10} strokeWidth={2.6} />
      </span>
      {open && pos && (
        <Portal>
          <div
            onMouseEnter={show}
            onMouseLeave={hide}
            style={{
              position: 'fixed', left: pos.left, top: pos.top, width, zIndex: 9000,
              backgroundColor: SURFACE, borderRadius: 14, padding: '11px 13px',
              border: CARD_BORDER, boxShadow: CARD_SHADOW, fontFamily: OUTFIT, fontSize: 11.5, lineHeight: 1.5,
              color: NEU.ink,
            }}
          >
            {children}
          </div>
        </Portal>
      )}
    </>
  );
}

// ── Small parts ─────────────────────────────────────────────────────────────

function Eyebrow({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <p className="font-bold uppercase" style={{ color: SOFT, fontFamily: OUTFIT, fontSize: 9.5, letterSpacing: '0.13em', ...style }}>
      {children}
    </p>
  );
}

function CopyCode({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(value).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="inline-flex items-center gap-1.5 focus:outline-none focus-visible:ring-2"
      style={{
        border: 'none', boxShadow: NEU.outSm, borderRadius: 999, padding: '5px 10px', backgroundColor: SURFACE, cursor: 'pointer',
        fontFamily: MONO, fontSize: 12, fontWeight: 700, letterSpacing: '0.09em',
        color: copied ? GREEN_INK : NEU.ink,
      }}
      title="Copy session code"
    >
      {value}
      {copied ? <Check size={11} /> : <Copy size={11} style={{ opacity: 0.55 }} />}
    </button>
  );
}

/** A round flag, or a person/seat monogram when the delegation is not a country. */
function Mark({ country, size }: { country: string; size: number }) {
  return <CircleFlag country={country} size={size} label={country} title={country} />;
}

// ── The card ────────────────────────────────────────────────────────────────

const LOGO_SIZE = 60;
const LOGO_OVERHANG = 20;
const PAD_START = 22;
const PAD_END = 20;

function NowPlayingPanel({ np }: { np: NowPlaying }) {
  const Glyph = GLYPH_ICON[np.glyph];
  const ink = toneInk(np.tone);
  const [from, to] = toneFill(np.tone);
  const hasMeter = np.pct !== null;
  const pct = Math.max(0, Math.min(100, np.pct ?? 0));
  return (
    <div className="flex flex-col flex-1" style={{ backgroundColor: WELL, boxShadow: WELL_EDGE, borderRadius: 16, padding: '12px 13px 11px', minHeight: 160 }}>
      <div className="flex items-start gap-3 min-w-0">
        <span
          className="flex items-center justify-center rounded-full flex-shrink-0 overflow-hidden"
          style={{ width: 56, height: 56, backgroundColor: SURFACE, border: CARD_BORDER, boxShadow: '0 4px 10px -4px rgba(27,56,40,0.25)' }}
          aria-hidden
        >
          {np.flag ? <Mark country={np.flag} size={54} /> : <Glyph size={25} style={{ color: np.tone === 'off' ? SOFT : ink }} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-extrabold uppercase" style={{ color: ink, fontFamily: OUTFIT, fontSize: 12, letterSpacing: '0.075em', lineHeight: 1.25, overflowWrap: 'anywhere' }}>
            {np.context}
          </p>
          {np.topic && (
            <p className="font-semibold" style={{ color: SOFT, fontFamily: OUTFIT, fontSize: 11, lineHeight: 1.32, marginBlockStart: 2, overflowWrap: 'anywhere' }}>
              {np.topic}
            </p>
          )}
          <p className="font-extrabold" style={{
            color: np.dim ? SOFT : NEU.ink, fontFamily: OUTFIT, fontSize: np.headline.length > 30 ? 17 : 21,
            lineHeight: 1.16, letterSpacing: '-0.012em', overflowWrap: 'anywhere', marginBlockStart: 4,
            fontVariantNumeric: 'tabular-nums',
          }}>
            {np.headline}
          </p>
        </div>
      </div>

      <div style={{ marginBlockStart: 9 }}>
        <div className="w-full overflow-hidden" style={{ height: 6, borderRadius: 6, backgroundColor: SURFACE, boxShadow: 'inset 1px 1px 3px rgba(27,56,40,0.18), inset -1px -1px 3px rgba(255,255,255,0.7)', opacity: hasMeter ? 1 : 0.55 }}>
          <div style={{ inlineSize: `${hasMeter ? pct : 0}%`, height: '100%', borderRadius: 6, background: `linear-gradient(90deg, ${from}, ${to})`, transition: 'inline-size 900ms linear' }} />
        </div>
        <div className="flex items-start justify-between gap-3" style={{ marginBlockStart: 6 }}>
          <span className="font-semibold" style={{ color: SOFT, fontFamily: OUTFIT, fontSize: 11.5, lineHeight: 1.3, fontVariantNumeric: 'tabular-nums' }}>{np.left}</span>
          <span className="font-extrabold text-right" style={{ color: np.tone === 'off' ? SOFT : NEU.ink, fontFamily: OUTFIT, fontSize: 12.5, lineHeight: 1.3, fontVariantNumeric: 'tabular-nums' }}>{np.right}</span>
        </div>
        <div className="flex flex-col justify-end" style={{ minHeight: 38, marginBlockStart: 7 }}>
          {np.next && (
            <>
              <p className="font-extrabold uppercase" style={{ color: SOFT, fontFamily: OUTFIT, fontSize: 9.5, letterSpacing: '0.08em', marginBlockEnd: 5 }}>
                {np.next.label}
              </p>
              <div className="flex flex-wrap items-center" style={{ gap: 4 }}>
                {np.next.names.map((n, i) => (
                  <span key={`${n}-${i}`} title={`${i + 1}. ${n}`} style={{ lineHeight: 0 }}>
                    <Mark country={n} size={22} />
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
      <div style={{ flex: '1 1 0', minHeight: 0 }} aria-hidden />
    </div>
  );
}

function Fact({ icon: Icon, children, title, tone }: { icon: typeof Mic; children: React.ReactNode; title: string; tone?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5" title={title} style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 700, color: tone ?? NEU.ink, fontVariantNumeric: 'tabular-nums' }}>
      <Icon size={13} style={{ color: SOFT, flexShrink: 0 }} aria-hidden />
      {children}
    </span>
  );
}

function OriginFact({ r }: { r: LiveRow }) {
  const code = r.creator_country?.trim().toUpperCase() || null;
  if (!code) {
    return (
      <span className="inline-flex items-center gap-1.5" style={{ fontFamily: OUTFIT, fontSize: 12, color: SOFT }}>
        <Globe2 size={13} aria-hidden /> Origin unknown
        <HoverHint width={310}>
          <strong style={{ fontWeight: 800 }}>Not recorded.</strong> Sessions created before
          <code style={{ fontFamily: MONO }}> committees.creator_country</code> existed have no origin.
          {r.conference_country && <> This room&apos;s conference is held in <strong>{r.conference_country}</strong>, which is not necessarily where the chair opened it.</>}
        </HoverHint>
      </span>
    );
  }
  const country = getCountryByCode(code);
  return (
    <span className="inline-flex items-center gap-1.5" title={`Session created from ${country?.name ?? code}`} style={{ fontFamily: OUTFIT, fontSize: 12, color: SOFT }}>
      <CircleFlag code={code} size={16} decorative />
      Created from <strong style={{ color: NEU.ink }}>{country?.name ?? code}</strong>
    </span>
  );
}

function CommitteeCard({ r }: { r: LiveRow }) {
  const [hover, setHover] = useState(false);
  const status = statusOf(r);
  const meta = STATUS_META[status];
  const acr = r.committee_abbreviation?.trim() || null;
  const short = committeeDisplayName(r.name, acr);
  const title = short || r.name;
  const subtitle = title !== r.name ? r.name : null;
  const mono = (acr ?? r.name).slice(0, 3).toUpperCase();
  const chairs = (r.chair_names ?? []).filter(Boolean);
  const np = nowPlaying(r);
  const confLabel = r.conference_id
    ? conferenceAcronymLabel({ acronym: r.conference_acronym, start_date: r.conference_start_date }) || r.conference_name
    : null;
  // The emblem: the conference's when there is one (as on the live wall), with
  // the committee's own crest on its corner; a standalone room shows its crest
  // or its monogram.
  const emblem = r.conference_id ? r.conference_logo_url : r.committee_logo_url;
  const emblemText = r.conference_id ? (r.conference_acronym || r.conference_name || mono).slice(0, 3) : mono;

  return (
    <article
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="relative flex flex-col"
      style={{
        backgroundColor: SURFACE, borderRadius: 24, border: CARD_BORDER,
        boxShadow: hover ? CARD_SHADOW_HOVER : CARD_SHADOW,
        transition: `box-shadow 220ms ${EASE}`, minHeight: 318,
      }}
    >
      <span className="absolute" style={{ insetBlockStart: -LOGO_OVERHANG, insetInlineStart: PAD_START, zIndex: 2, lineHeight: 0 }}>
        <LogoDisc src={emblem} size={LOGO_SIZE} fallbackText={emblemText} alt={confLabel ?? title} />
        {r.conference_id && r.committee_logo_url && (
          <span className="absolute" style={{ right: -4, bottom: -2, borderRadius: 999, border: `2px solid ${SURFACE}`, lineHeight: 0 }}>
            <LogoDisc src={r.committee_logo_url} size={24} fallbackText={mono} alt="" />
          </span>
        )}
      </span>

      <div className="flex flex-col flex-1 relative" style={{ overflow: 'hidden', borderRadius: 23 }}>
        <span aria-hidden className="absolute left-0 top-0 bottom-0" style={{ width: 4, backgroundColor: meta.color }} />

        <div className="flex flex-col flex-1" style={{ padding: `8px ${PAD_END}px 0 ${PAD_START}px` }}>
          {/* Identity */}
          <div className="flex items-start justify-between gap-3" style={{ marginInlineStart: LOGO_SIZE + 12, minHeight: 44 }}>
            <div className="min-w-0">
              <h3 className="font-extrabold" style={{ color: NEU.ink, fontFamily: OUTFIT, fontSize: acr ? 21 : 17, lineHeight: 1.14, letterSpacing: '-0.015em', overflowWrap: 'anywhere' }}>
                {title}
              </h3>
              {subtitle && <p style={{ color: SOFT, fontFamily: OUTFIT, fontSize: 11, lineHeight: 1.3 }}>{subtitle}</p>}
              <p className="mt-0.5" style={{ color: SOFT, fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 700 }}>
                {confLabel ?? 'Standalone session'}
              </p>
            </div>
            <div className="flex flex-col items-end flex-shrink-0" style={{ paddingBlockStart: 3, maxWidth: '50%' }}>
              <span className="inline-flex items-center gap-1.5" title={`Last activity ${fmtIdle(r.idle_minutes)}`}>
                <span className={`rounded-full flex-shrink-0${meta.pulse ? ' animate-pulse' : ''}`} style={{ width: 8, height: 8, backgroundColor: meta.color, boxShadow: `0 0 0 3px color-mix(in srgb, ${meta.color} 18%, transparent), 0 0 6px color-mix(in srgb, ${meta.color} 45%, transparent)` }} />
                <span className="font-extrabold uppercase" style={{ color: meta.ink, fontFamily: OUTFIT, fontSize: 12, letterSpacing: '0.09em' }}>{meta.label}</span>
              </span>
              <div className="flex flex-col items-end" style={{ marginBlockStart: 5, gap: 3 }}>
                {chairs.length === 0
                  ? <span style={{ color: AMBER_INK, fontFamily: OUTFIT, fontSize: 12, fontWeight: 600 }}>No chair yet</span>
                  : chairs.map((c, i) => (
                    <span key={`${c}-${i}`} className="inline-flex items-center gap-1.5 justify-end" style={{ color: SOFT, fontFamily: OUTFIT, fontSize: 12, fontWeight: 600, overflowWrap: 'anywhere' }}>
                      {c}
                      <Gavel size={11} style={{ color: SOFT, flexShrink: 0 }} aria-hidden />
                    </span>
                  ))}
              </div>
            </div>
          </div>

          {r.topic && r.topic !== 'TBD' && (
            <p className="mt-2" style={{ color: NEU.ink, fontFamily: OUTFIT, fontSize: 12, lineHeight: 1.35 }}>
              <span style={{ color: SOFT, fontWeight: 700 }}>Topic: </span>{r.topic}
            </p>
          )}

          {/* NOW PLAYING */}
          <div className="flex flex-col flex-1" style={{ marginBlockStart: 10, marginInlineStart: -(PAD_START - 8), marginInlineEnd: -(PAD_END - 8) }}>
            <NowPlayingPanel np={np} />
          </div>

          {/* Facts */}
          <div className="flex items-center gap-x-4 gap-y-1.5 flex-wrap" style={{ padding: '11px 0 10px' }}>
            <Fact icon={Users} title={`${r.delegates_present} of ${r.delegates_total} delegations present`}>
              {r.delegates_present}/{r.delegates_total}
            </Fact>
            <Fact icon={Hand} title="Motions on the floor" tone={r.pending_motions > 0 ? NEU.ink : SOFT}>{r.pending_motions}</Fact>
            <Fact icon={FileText} title="Documents submitted" tone={r.documents_total > 0 ? NEU.ink : SOFT}>{r.documents_total}</Fact>
            <Fact icon={Clock} title={`Used for ${fmtActive(r.active_minutes)}, last activity ${fmtIdle(r.idle_minutes)}`}>
              {fmtActive(r.active_minutes)}
            </Fact>
          </div>
        </div>

        {/* Footer: one action */}
        <div className="flex items-center justify-between gap-3 flex-wrap" style={{ padding: `10px ${PAD_END}px 12px ${PAD_START}px`, borderTop: `1px solid ${CARD_BORDER_COLOR}` }}>
          {r.conference_slug ? (
            <Link
              href={`/manage/${r.conference_slug}/live`}
              target="_blank"
              className="inline-flex items-center gap-1 focus:outline-none focus-visible:underline"
              style={{ color: NEU.forest, fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 800, textDecoration: 'none' }}
              title={[r.conference_name, [r.conference_city, r.conference_country].filter(Boolean).join(', ')].filter(Boolean).join(' · ')}
            >
              Open live status <ArrowUpRight size={13} aria-hidden />
            </Link>
          ) : <OriginFact r={r} />}
          <CopyCode value={r.code} />
        </div>
      </div>
    </article>
  );
}

// ── Tab ─────────────────────────────────────────────────────────────────────

export default function LiveCommitteesTab() {
  const { session, loading: authLoading } = useAuth();
  const [rows, setRows] = useState<LiveRow[] | null>(null);
  const [error, setError] = useState<'denied' | 'missing-rpc' | 'failed' | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<number | null>(null);
  const [, setTick] = useState(0);
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    if (!session) { setError('denied'); setRows([]); return; }
    if (inFlight.current) return;
    inFlight.current = true;
    setRefreshing(true);
    try {
      const supabase = getAuthedClient(session.access_token);
      const { data, error: err } = await supabase.rpc('admin_live_committees');
      if (err) {
        const msg = `${err.message ?? ''} ${err.details ?? ''}`.toLowerCase();
        if (err.code === '42883' || msg.includes('could not find the function') || msg.includes('does not exist')) {
          setError('missing-rpc');
        } else if (msg.includes('not authorised') || msg.includes('not authorized')) {
          setError('denied');
        } else {
          setError('failed');
        }
        setRows([]);
        return;
      }
      setError(null);
      setRows((data ?? []) as LiveRow[]);
      setLastRefreshed(Date.now());
    } catch {
      setError('failed');
      setRows([]);
    } finally {
      inFlight.current = false;
      setRefreshing(false);
    }
  }, [session]);

  // Poll every 30s, paused while the tab is hidden, refreshed on return.
  useEffect(() => {
    if (authLoading) return;
    void load();
    const poll = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      void load();
    }, 30_000);
    const onVisible = () => { if (!document.hidden) void load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(poll);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [authLoading, load]);

  // 1s tick: the clocks on the cards and "Refreshed Xs ago" are derived from
  // their anchors on every render. Nothing is written.
  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const all = useMemo(() => rows ?? [], [rows]);

  const stats = useMemo(() => ({
    total: all.length,
    live: all.filter((r) => statusOf(r) === 'live').length,
    suspended: all.filter((r) => statusOf(r) === 'suspended').length,
  }), [all]);

  const shown = useMemo(() => {
    let r = all;
    if (filter === 'conference') r = r.filter((x) => !!x.conference_id);
    else if (filter === 'standalone') r = r.filter((x) => !x.conference_id);
    else if (filter !== 'all') r = r.filter((x) => statusOf(x) === filter);
    const s = q.trim().toLowerCase();
    if (s) {
      r = r.filter((x) =>
        x.name.toLowerCase().includes(s) ||
        x.code.toLowerCase().includes(s) ||
        (x.topic ?? '').toLowerCase().includes(s) ||
        (x.conference_name ?? '').toLowerCase().includes(s) ||
        (x.conference_acronym ?? '').toLowerCase().includes(s) ||
        (x.chair_names ?? []).some((c) => c.toLowerCase().includes(s)));
    }
    return r;
  }, [all, filter, q]);

  const secondsAgo = lastRefreshed ? Math.max(0, Math.floor((Date.now() - lastRefreshed) / 1000)) : null;

  const FILTERS: { key: Filter; label: string; n: number }[] = [
    { key: 'all', label: 'All', n: all.length },
    { key: 'live', label: 'Live now', n: stats.live },
    { key: 'idle', label: 'Idle', n: all.filter((r) => statusOf(r) === 'idle').length },
    { key: 'suspended', label: 'Suspended', n: stats.suspended },
    { key: 'conference', label: 'Conference', n: all.filter((r) => !!r.conference_id).length },
    { key: 'standalone', label: 'Standalone', n: all.filter((r) => !r.conference_id).length },
  ];

  const panel = (children: React.ReactNode) => (
    <div style={{ padding: 34, textAlign: 'center', borderRadius: 22, border: CARD_BORDER, backgroundColor: WELL }}>{children}</div>
  );

  return (
    <div style={{ fontFamily: OUTFIT }}>
      {/* Header */}
      <div className="flex items-end justify-between gap-4 mb-5 flex-wrap">
        <div>
          <Eyebrow>Live status · platform-wide</Eyebrow>
          <h2 className="font-black" style={{ color: NEU.ink, fontFamily: OUTFIT, fontSize: 25, lineHeight: 1.1, marginTop: 3 }}>
            Committees in use
          </h2>
          <p className="flex items-center gap-1.5" style={{ color: SOFT, fontFamily: OUTFIT, fontSize: 11.5, marginTop: 4 }}>
            Lived over 30 min · touched in the last 24 h · not ended
            <HoverHint width={330}>
              <strong style={{ fontWeight: 800 }}>What counts as live.</strong> A committee appears here when
              it has not been gavelled out, was written to in the last 24 hours, and existed for more than
              30 minutes between creation and its last write. Hundreds of committees get created and abandoned
              within a minute, and without that filter this board is unreadable.
              <br /><br />
              <strong style={{ fontWeight: 800 }}>Status is not phase.</strong> Status says whether anyone is
              in there right now (Live up to 15 min idle, Idle beyond that, Suspended when the session is paused);
              the panel in the middle of each card says what they are doing.
            </HoverHint>
          </p>
        </div>
        <div className="flex items-center gap-3">
          {secondsAgo !== null && (
            <span style={{ color: SOFT, fontFamily: OUTFIT, fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>
              Refreshed {secondsAgo}s ago · auto every 30s
            </span>
          )}
          <button
            type="button"
            onClick={() => void load()}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-full py-2 px-3.5 focus:outline-none focus-visible:ring-2"
            style={{
              border: 'none', boxShadow: NEU.outSm, color: NEU.forest, backgroundColor: SURFACE,
              fontFamily: OUTFIT, fontSize: 12, fontWeight: 800,
              opacity: refreshing ? 0.6 : 1, cursor: refreshing ? 'default' : 'pointer',
            }}
          >
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Numbers */}
      <div className="grid grid-cols-3 gap-2.5 mb-5" style={{ maxWidth: 540 }}>
        {[
          { label: 'Matching', v: stats.total, color: NEU.ink, icon: Radio, tint: '#1B3828' },
          { label: 'Live now', v: stats.live, color: stats.live > 0 ? GREEN_INK : SOFT, icon: Radio, tint: '#3D7A52' },
          { label: 'Suspended', v: stats.suspended, color: stats.suspended > 0 ? RED : SOFT, icon: PauseCircle, tint: RED },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="flex items-center gap-3" style={{ padding: '12px 14px', borderRadius: 18, border: CARD_BORDER, backgroundColor: SURFACE, boxShadow: CARD_SHADOW }}>
              <span className="inline-flex items-center justify-center flex-shrink-0" style={{ width: 34, height: 34, borderRadius: 999, background: `linear-gradient(135deg, color-mix(in srgb, ${s.tint} 78%, white), ${s.tint})`, color: '#FFFFFF', boxShadow: `0 4px 10px -2px color-mix(in srgb, ${s.tint} 45%, transparent), inset 0 1px 0 rgba(255,255,255,0.28)` }}>
                <Icon size={16} strokeWidth={2.4} aria-hidden />
              </span>
              <div className="min-w-0">
                <p style={{ fontFamily: OUTFIT, fontSize: 24, fontWeight: 900, lineHeight: 1, color: s.color, fontVariantNumeric: 'tabular-nums' }}>
                  {rows === null ? '–' : s.v}
                </p>
                <p className="truncate" style={{ fontFamily: OUTFIT, fontSize: 11, fontWeight: 700, color: SOFT, marginTop: 4 }}>{s.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filters + search */}
      <div className="flex items-center gap-2 flex-wrap mb-4">
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              aria-pressed={active}
              className="rounded-full px-3 py-1.5 focus:outline-none focus-visible:ring-2"
              style={{
                fontFamily: OUTFIT, fontSize: 12, fontWeight: 800, cursor: 'pointer',
                border: 'none',
                backgroundColor: active ? NEU.forest : SURFACE,
                boxShadow: active ? '0 4px 10px -2px rgba(27,56,40,0.4), inset 0 1px 0 rgba(255,255,255,0.14)' : NEU.outSm,
                color: active ? NEU.gold : NEU.ink,
                transition: `background-color 200ms ${EASE}, color 200ms ${EASE}, box-shadow 200ms ${EASE}`,
              }}
            >
              {f.label} <span style={{ opacity: 0.7, fontVariantNumeric: 'tabular-nums' }}>{f.n}</span>
            </button>
          );
        })}
        <span className="flex items-center gap-2 rounded-full px-3 py-2 ml-auto" style={{ backgroundColor: NEU.base, boxShadow: NEU.inSm }}>
          <Search size={13} style={{ color: SOFT }} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Committee, code, chair, conference…"
            className="focus:outline-none"
            style={{ fontFamily: OUTFIT, fontSize: 12.5, background: 'transparent', border: 'none', color: NEU.ink, width: 220 }}
          />
        </span>
      </div>

      {/* Body */}
      {rows === null ? (
        panel(<div className="flex flex-col items-center gap-3"><Loader size={26} /><p style={{ color: SOFT, fontSize: 12.5 }}>Reading the floor…</p></div>)
      ) : error === 'missing-rpc' ? (
        panel(<>
          <p className="font-black" style={{ color: NEU.ink, fontSize: 15 }}>Not wired up yet</p>
          <p style={{ color: SOFT, fontSize: 12.5, marginTop: 6, lineHeight: 1.55 }}>
            The <code style={{ fontFamily: MONO }}>admin_live_committees()</code> function has not been applied to the database.
          </p>
        </>)
      ) : error ? (
        panel(<>
          <p className="font-black" style={{ color: NEU.ink, fontSize: 15 }}>{error === 'denied' ? 'Nothing here' : 'Could not load the floor'}</p>
          <p style={{ color: SOFT, fontSize: 12.5, marginTop: 6 }}>
            {error === 'denied' ? "This view isn't available for your account." : 'The request failed. Try refreshing in a moment.'}
          </p>
        </>)
      ) : shown.length === 0 ? (
        panel(<>
          <p className="font-black" style={{ color: NEU.ink, fontSize: 15 }}>{all.length === 0 ? 'All quiet on the floor' : 'Nothing matches'}</p>
          <p style={{ color: SOFT, fontSize: 12.5, marginTop: 6 }}>
            {all.length === 0 ? 'No committee has been used in the last 24 hours.' : 'Try a different filter or search.'}
          </p>
        </>)
      ) : (
        <div
          className="grid items-stretch"
          style={{
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
            columnGap: 18, rowGap: LOGO_OVERHANG + 18, paddingBlockStart: LOGO_OVERHANG + 4,
          }}
        >
          {shown.map((r) => <CommitteeCard key={r.id} r={r} />)}
        </div>
      )}
    </div>
  );
}
