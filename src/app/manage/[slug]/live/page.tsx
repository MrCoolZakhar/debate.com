'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import {
  RefreshCw, Copy, Check, Gavel, Users, Mic, FileText, ScrollText,
  FileCheck, Trophy, Radio, PauseCircle, Flag, MessageSquareText, Timer, Megaphone,
} from 'lucide-react';
import { useManage } from '@/app/manage/[slug]/layout';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { supabase as anonSupabase } from '@/lib/supabase';
import { FlagImg } from '@/components/FlagImg';
import { LogoDisc } from '@/components/LogoDisc';
import {
  NeuCard, NeuInset, NeuIconDisc, Emoji3D,
  NEU, NEU_GRADIENTS, type NeuGradient, OUTFIT, EASE,
} from '@/components/neu';
import AvatarStack from '@/components/AvatarStack';
import { getScoringConfig } from '@/lib/scoring';
import type { ScoringConfig } from '@/lib/settingsStore';
import {
  type LiveCommittee, type CaucusJson, type ChairPerson, cardStatus, PHASE_LABELS, flagCodeFor,
  RecapModal, AwardsModal, RosterModal,
} from './LiveModals';
import {
  cardVariant, UnmoderatedBody, ModeratedBody, VotingBody, feedbackPulse,
} from './PhaseVariants';
import {
  BroadcastComposer, RecentBroadcasts, broadcastTargets, groupBroadcasts,
  mapBroadcastRow, deleteBroadcastGroup, BROADCAST_COLUMNS,
  type BroadcastRow, type BroadcastGroup,
} from './BroadcastComposer';

type LucideIcon = React.ComponentType<{ size?: number; strokeWidth?: number; style?: React.CSSProperties }>;

// ── Small shared bits ───────────────────────────────────────────────────────

function Eyebrow({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <p
      className="text-[11px] font-bold uppercase"
      style={{ color: NEU.muted, fontFamily: OUTFIT, letterSpacing: '0.08em', ...style }}
    >
      {children}
    </p>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(value).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="inline-flex items-center justify-center rounded-xl focus:outline-none flex-shrink-0"
      style={{
        width: 32, height: 32, border: 'none', backgroundColor: NEU.surface,
        color: copied ? NEU.green : NEU.forest,
        boxShadow: hovered ? NEU.outSmHover : NEU.outSm,
        transition: `box-shadow 200ms ${EASE}`, cursor: 'pointer',
      }}
      title="Copy to clipboard"
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
    </button>
  );
}

function FlagDot({ country }: { country: string }) {
  return (
    <span
      className="flex items-center justify-center rounded-full overflow-hidden flex-shrink-0"
      style={{ width: 24, height: 24, backgroundColor: NEU.surface, boxShadow: NEU.outSm, marginLeft: -6 }}
      title={country}
    >
      <FlagImg code={flagCodeFor(country)} size={15} />
    </span>
  );
}

/** Acronym-forward committee identity, shared by both cards. */
function committeeIdentity(conf: LiveCommittee['conf']): { title: string; subtitle: string | null; mono: string } {
  const acr = conf.abbreviation?.trim() || null;
  const full = conf.name;
  const title = acr ?? full;
  return { title, subtitle: acr && acr !== full ? full : null, mono: (acr ?? full).slice(0, 3) };
}

/** Compact status glyph pill for the at-a-glance indicator row. */
function StatusGlyph({
  gradient, emoji, icon: Icon, value, label, accent, pulse = false,
}: {
  gradient: NeuGradient;
  emoji: string;
  icon: LucideIcon;
  value: number;
  label: string;
  accent: string;
  pulse?: boolean;
}) {
  const dim = value === 0;
  return (
    <div
      className="inline-flex items-center gap-2 rounded-full pl-1.5 pr-3.5 py-1.5"
      style={{ backgroundColor: NEU.surface, boxShadow: NEU.outSm, opacity: dim ? 0.55 : 1, transition: `opacity 220ms ${EASE}` }}
      title={`${value} ${label.toLowerCase()}`}
    >
      <span className="relative inline-flex flex-shrink-0">
        <NeuIconDisc gradient={gradient} emoji={emoji} icon={Icon} size={28} />
        {pulse && !dim && (
          <span
            className="absolute rounded-full animate-pulse"
            style={{ top: -1, right: -1, width: 9, height: 9, backgroundColor: NEU.green, boxShadow: `0 0 0 2px ${NEU.surface}` }}
          />
        )}
      </span>
      <span className="flex items-baseline gap-1.5">
        <span style={{ fontFamily: OUTFIT, fontWeight: 900, fontSize: 17, lineHeight: 1, color: dim ? NEU.muted : accent, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
        <span style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 9.5, letterSpacing: '0.11em', textTransform: 'uppercase', color: NEU.muted }}>{label}</span>
      </span>
    </div>
  );
}

// ── Not-started card ────────────────────────────────────────────────────────

function NotStartedCard({
  data,
  committeesHref,
}: {
  data: LiveCommittee;
  committeesHref: string;
}) {
  const session = data.session;
  const id = committeeIdentity(data.conf);

  return (
    <NeuCard style={{ padding: 20, display: 'flex', flexDirection: 'column' }}>
      {/* Greyed-out committee identity */}
      <div className="flex items-center justify-between gap-3" style={{ opacity: 0.6, filter: 'saturate(0.7)' }}>
        <div className="flex items-center gap-3 min-w-0">
          <LogoDisc src={data.conf.logoUrl} size={44} fallbackText={id.mono} alt={id.title} style={{ filter: 'grayscale(0.4)' }} />
          <div className="min-w-0">
            <h3 className="font-extrabold truncate" style={{ color: NEU.ink, fontFamily: OUTFIT, fontSize: 21, lineHeight: 1.1 }}>
              {id.title}
            </h3>
            {id.subtitle && (
              <p className="text-xs truncate" style={{ color: NEU.muted, fontFamily: OUTFIT }}>{id.subtitle}</p>
            )}
          </div>
        </div>
        <span
          className="text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase flex-shrink-0"
          style={{ backgroundColor: NEU.base, color: NEU.muted, boxShadow: NEU.inSm, fontFamily: OUTFIT, letterSpacing: '0.08em' }}
        >
          Not started
        </span>
      </div>

      {/* Centered well: session code, ready to share */}
      <NeuInset className="flex flex-col items-center text-center" style={{ padding: '26px 20px', margin: '18px 0', borderRadius: 18 }}>
        <Emoji3D name="Hourglass not done" size={34} fallback={Timer} fallbackColor={NEU.muted} style={{ opacity: 0.9 }} />
        {session ? (
          <>
            <Eyebrow style={{ letterSpacing: '0.12em', marginTop: 10 }}>Session not in progress yet</Eyebrow>
            <div className="flex items-center gap-2.5 mt-3">
              <span style={{ fontFamily: OUTFIT, fontWeight: 900, fontSize: 30, color: NEU.ink, letterSpacing: '0.14em', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                {session.code}
              </span>
              <CopyButton value={session.code} />
            </div>
            <p className="text-[11px] mt-3" style={{ color: NEU.muted, fontFamily: OUTFIT }}>
              Session code: share with your chairs
            </p>
          </>
        ) : (
          <>
            <Eyebrow style={{ letterSpacing: '0.12em', marginTop: 10 }}>Session not in progress yet</Eyebrow>
            <p className="text-sm font-bold mt-3" style={{ color: NEU.ink, fontFamily: OUTFIT }}>No session code yet</p>
            <Link
              href={committeesHref}
              className="text-sm font-bold inline-block mt-1 transition-colors"
              style={{ color: NEU.forest, fontFamily: OUTFIT, textDecoration: 'none' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = NEU.green; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = NEU.forest; }}
            >
              Generate it in Committees →
            </Link>
          </>
        )}
      </NeuInset>

      {/* Chair assignment line (greyed) — same avatar stack as the live card,
          so the dais reads identically before and after the gavel falls. */}
      <div className="flex items-center justify-between gap-3" style={{ opacity: 0.6 }}>
        <p className="text-xs flex items-center gap-1.5 min-w-0" style={{ color: NEU.muted, fontFamily: OUTFIT }}>
          <Gavel size={12} style={{ flexShrink: 0 }} />
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>
            {data.conf.chairs.length} chair{data.conf.chairs.length === 1 ? '' : 's'} assigned
            {session && session.chairNames.length > 0 && <> · {session.chairNames.length} joined</>}
          </span>
        </p>
        <AvatarStack
          people={data.conf.chairs}
          size={26}
          max={4}
          label="Chairs"
          ringColor={NEU.surface}
          shadow={NEU.outSm}
        />
      </div>
    </NeuCard>
  );
}

// ── Live / suspended / ended card ───────────────────────────────────────────

// The clock deliberately does NOT live here any more. A caucus card's countdown
// is owned by its phase variant, which re-derives it from the persisted anchor
// every second; the flat `caucus.remainingTime` this used to print was the value
// at the anchor instant, so it sat frozen until the next chair write.
function currentMotionLabel(phase: string, caucus: CaucusJson | null): { label: string; detail: string | null } {
  if (caucus && (caucus.active ?? true)) {
    const label = caucus.type === 'unmoderated' ? 'Unmoderated Caucus' : 'Moderated Caucus';
    return { label: caucus.motionLabel || label, detail: caucus.purpose || null };
  }
  if (phase === 'speakers-list') return { label: "General Speakers' List (GSL)", detail: null };
  return { label: PHASE_LABELS[phase] ?? phase, detail: null };
}

/** 3D glyph for the current motion, so the card reads at a glance. */
function motionVisual(phase: string, caucus: CaucusJson | null): { emoji: string; fallback: LucideIcon; gradient: NeuGradient } {
  if (caucus && (caucus.active ?? true)) {
    if (caucus.type === 'unmoderated') return { emoji: 'Hourglass not done', fallback: Timer, gradient: NEU_GRADIENTS.amber };
    return { emoji: 'Speaking head', fallback: Mic, gradient: NEU_GRADIENTS.sage };
  }
  if (phase === 'voting') return { emoji: 'Ballot box with ballot', fallback: Gavel, gradient: NEU_GRADIENTS.gold };
  if (phase === 'speakers-list') return { emoji: 'Speech balloon', fallback: MessageSquareText, gradient: NEU_GRADIENTS.forest };
  return { emoji: 'Speech balloon', fallback: Gavel, gradient: NEU_GRADIENTS.forest };
}

function LiveCard({
  data,
  onOpenRecap,
  onOpenAwards,
  onOpenRoster,
}: {
  data: LiveCommittee;
  onOpenRecap: (data: LiveCommittee) => void;
  onOpenAwards: (data: LiveCommittee) => void;
  onOpenRoster: (data: LiveCommittee) => void;
}) {
  const status = cardStatus(data);
  const session = data.session!;
  const caucusActive = !!session.caucus && (session.caucus.active ?? true);
  const motion = currentMotionLabel(session.phase, session.caucus);
  const mv = motionVisual(session.phase, session.caucus);
  const id = committeeIdentity(data.conf);

  // Which body this card renders. Default keeps the original layout untouched;
  // the other three replace the middle of the card (see PhaseVariants.tsx).
  const variant = cardVariant(data);
  const showFloorSpeaker = variant === 'default' || variant === 'moderated';
  const showQueue = variant === 'default' || variant === 'moderated';
  const showMotionInset = variant !== 'voting';

  const speaker = data.currentSpeaker;
  const speaking = !!speaker?.startedAt;
  const present = data.delegates.filter((d) => d.status !== 'absent').length;

  const wps = data.documents.filter((d) => d.type === 'working-paper');
  const drs = data.documents.filter((d) => d.type === 'draft-resolution');
  const wpsPresented = wps.filter((d) => d.status !== 'submitted').length;
  const drsPresented = drs.filter((d) => d.status !== 'submitted').length;
  const passedCount = data.documents.filter((d) => d.status === 'passed').length;

  const pulse = feedbackPulse(data);

  // Chairs for the corner stack: the conference dais (real profile pictures),
  // falling back to whoever actually joined this session by name.
  const chairPeople: ChairPerson[] = data.conf.chairs.length > 0
    ? data.conf.chairs
    : session.chairNames.map((name) => ({ id: null, name, avatarUrl: null }));

  const upNext = caucusActive ? data.caucusQueue : data.gslQueue;
  const shownFlags = upNext.slice(0, 10);
  const overflow = upNext.length - shownFlags.length;

  const chipStyle: React.CSSProperties = {
    backgroundColor: NEU.surface,
    boxShadow: NEU.outSm,
    color: NEU.ink,
    fontFamily: OUTFIT,
    fontVariantNumeric: 'tabular-nums',
  };

  return (
    <NeuCard hover onClick={() => onOpenRecap(data)} style={{ padding: 20, display: 'flex', flexDirection: 'column' }}>
      {/* Status eyebrow */}
      {status === 'live' && (
        <div className="flex items-center gap-2 mb-3">
          <span className="rounded-full animate-pulse flex-shrink-0" style={{ width: 8, height: 8, backgroundColor: NEU.green, boxShadow: `0 0 0 3px ${NEU.green}22` }} />
          <span className="text-[11px] font-extrabold uppercase" style={{ color: NEU.forest, fontFamily: OUTFIT, letterSpacing: '0.09em' }}>
            In session
          </span>
        </div>
      )}
      {status === 'suspended' && (
        <div
          className="inline-flex items-center gap-2 mb-3 rounded-full px-3 py-1.5 self-start"
          style={{ backgroundColor: 'rgba(184,132,74,0.14)', boxShadow: NEU.outSm }}
        >
          <Emoji3D name="Pause button" size={15} fallback={PauseCircle} fallbackColor={NEU.amber} />
          <span className="text-[11px] font-extrabold uppercase" style={{ color: '#8A5A2E', fontFamily: OUTFIT, letterSpacing: '0.08em' }}>
            Suspended
          </span>
        </div>
      )}
      {status === 'ended' && (
        <div
          className="inline-flex items-center gap-2 mb-3 rounded-full px-3 py-1.5 self-start"
          style={{ backgroundColor: NEU.base, boxShadow: NEU.inSm }}
        >
          <Emoji3D name="Chequered flag" size={15} fallback={Flag} fallbackColor={NEU.muted} />
          <span className="text-[11px] font-extrabold uppercase" style={{ color: NEU.muted, fontFamily: OUTFIT, letterSpacing: '0.08em' }}>
            Adjourned
          </span>
        </div>
      )}

      {/* Header: committee logo + acronym-forward identity + chairs */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <LogoDisc src={data.conf.logoUrl} size={46} fallbackText={id.mono} alt={id.title} />
          <div className="min-w-0">
            <h3 className="font-extrabold truncate" style={{ color: NEU.ink, fontFamily: OUTFIT, fontSize: 22, lineHeight: 1.05 }}>
              {id.title}
            </h3>
            {id.subtitle && (
              <p className="text-xs truncate" style={{ color: NEU.muted, fontFamily: OUTFIT }}>{id.subtitle}</p>
            )}
          </div>
        </div>
        {/* Chair corner — stacked profile pictures, no names on screen. Each
            avatar carries title + aria-label, so the dais stays reachable on
            hover and to a screen reader without eating the header. */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Gavel size={13} style={{ color: NEU.muted, flexShrink: 0 }} />
          <AvatarStack
            people={chairPeople}
            size={28}
            max={4}
            label="Chairs"
            ringColor={NEU.surface}
            shadow={NEU.outSm}
            empty={
              <span className="text-xs" style={{ color: NEU.muted, fontFamily: OUTFIT }}>No chairs</span>
            }
          />
        </div>
      </div>

      {/* Current motion */}
      {showMotionInset && (
        <NeuInset className="flex items-center gap-3" style={{ padding: '11px 13px', marginTop: 16, borderRadius: 14 }}>
          <NeuIconDisc gradient={mv.gradient} emoji={mv.emoji} icon={mv.fallback} size={36} />
          <div className="min-w-0 flex-1">
            <Eyebrow style={{ fontSize: 10 }}>Current motion</Eyebrow>
            <p className="text-sm font-bold truncate" style={{ color: NEU.ink, fontFamily: OUTFIT }}>{motion.label}</p>
            {motion.detail && (
              <p className="text-xs truncate" style={{ color: NEU.muted, fontFamily: OUTFIT }} title={motion.detail}>{motion.detail}</p>
            )}
          </div>
        </NeuInset>
      )}

      {/* ── Phase-specific body ── */}
      {variant === 'unmoderated' && session.caucus && <UnmoderatedBody caucus={session.caucus} />}
      {variant === 'voting' && <VotingBody data={data} />}

      {/* Current speaker — the focal point, deliberately large.
          Hidden in an unmod (nobody holds the floor) and during voting
          (the ballot, not the last speaker, is the story). */}
      {showFloorSpeaker && (
      <div className="mt-4">
        <Eyebrow style={{ fontSize: 10, marginBottom: 6 }}>On the floor</Eyebrow>
        {speaker?.country ? (
          <div
            className="flex items-center gap-3.5 rounded-2xl"
            style={{
              padding: '12px 14px',
              backgroundColor: NEU.surface,
              boxShadow: speaking ? `0 0 0 1.5px ${NEU.green}55, ${NEU.outSm}` : NEU.outSm,
            }}
          >
            <span
              className="flex items-center justify-center rounded-full overflow-hidden flex-shrink-0"
              style={{ width: 52, height: 52, backgroundColor: NEU.base, boxShadow: NEU.inSm }}
            >
              <FlagImg code={flagCodeFor(speaker.country)} size={34} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-extrabold truncate" style={{ color: NEU.ink, fontFamily: OUTFIT, fontSize: 20, lineHeight: 1.1 }}>
                {speaker.country}
              </p>
              <div className="flex items-center gap-1.5 mt-1">
                {speaking ? (
                  <>
                    <span className="rounded-full animate-pulse flex-shrink-0" style={{ width: 7, height: 7, backgroundColor: NEU.green }} />
                    <span className="text-xs font-bold uppercase" style={{ color: NEU.green, fontFamily: OUTFIT, letterSpacing: '0.06em' }}>
                      Speaking now
                    </span>
                  </>
                ) : (
                  <span className="text-xs font-bold uppercase" style={{ color: NEU.muted, fontFamily: OUTFIT, letterSpacing: '0.06em' }}>
                    Paused
                  </span>
                )}
              </div>
            </div>
            <Emoji3D
              name="Studio microphone"
              size={34}
              fallback={Mic}
              fallbackColor={speaking ? NEU.green : NEU.muted}
              style={speaking ? undefined : { opacity: 0.5, filter: 'grayscale(0.6) drop-shadow(0 2px 4px rgba(27,56,40,0.30))' }}
            />
          </div>
        ) : (
          <NeuInset className="flex items-center gap-2.5" style={{ padding: '14px 16px', borderRadius: 16 }}>
            <Mic size={16} style={{ color: NEU.muted, flexShrink: 0 }} />
            <span className="text-sm" style={{ color: NEU.muted, fontFamily: OUTFIT }}>No speaker on the floor</span>
          </NeuInset>
        )}
      </div>
      )}

      {/* Moderated caucus keeps its speaker and queue, and adds the caucus clock. */}
      {variant === 'moderated' && session.caucus && <ModeratedBody caucus={session.caucus} />}

      {/* Doc + delegate chips */}
      <div className="flex flex-wrap gap-2 mt-3.5">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-full" style={chipStyle}>
          <FileText size={12} style={{ color: NEU.forest }} />
          WPs {wpsPresented}/{wps.length}
        </span>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-full" style={chipStyle}>
          <ScrollText size={12} style={{ color: NEU.forest }} />
          DRs {drsPresented}/{drs.length}
        </span>
        {passedCount > 0 && (
          <span
            className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-full"
            style={{ ...chipStyle, color: NEU.green }}
          >
            <FileCheck size={12} />
            {passedCount} passed
          </span>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onOpenRoster(data); }}
          className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-full focus:outline-none"
          style={{ ...chipStyle, border: 'none', cursor: 'pointer', transition: `box-shadow 200ms ${EASE}` }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = NEU.outSmHover; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = NEU.outSm; }}
          title="View present delegates"
        >
          <Users size={12} style={{ color: NEU.forest }} />
          {present}/{data.delegates.length} present
        </button>
        {(pulse.rated > 0 || pulse.notes > 0) && (
          <span
            className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-full"
            style={chipStyle}
            title={`${pulse.rated} speech ${pulse.rated === 1 ? 'rating' : 'ratings'} and ${pulse.notes} written ${pulse.notes === 1 ? 'note' : 'notes'} across ${pulse.delegations} delegation${pulse.delegations === 1 ? '' : 's'} — open the card for the recap`}
          >
            <MessageSquareText size={12} style={{ color: NEU.forest }} />
            {pulse.rated + pulse.notes} feedback
          </span>
        )}
      </div>

      {/* Up next, flowing speakers strip. Removed entirely in an unmod (there is
          no speakers list) and during voting (the roll, not a queue, is live). */}
      {showQueue && (
      <div className="mt-4">
        <Eyebrow style={{ fontSize: 10 }}>Up next</Eyebrow>
        <div className="flex items-center mt-1.5" style={{ paddingLeft: 6, minHeight: 24 }}>
          {shownFlags.length > 0 ? (
            <>
              {shownFlags.map((country, i) => <FlagDot key={`${country}-${i}`} country={country} />)}
              {overflow > 0 && (
                <span
                  className="flex items-center justify-center rounded-full text-[9px] font-extrabold flex-shrink-0"
                  style={{ width: 24, height: 24, marginLeft: -6, background: `linear-gradient(135deg, ${NEU_GRADIENTS.forest[0]}, ${NEU_GRADIENTS.forest[1]})`, color: NEU.gold, boxShadow: NEU.outSm, fontFamily: OUTFIT, fontVariantNumeric: 'tabular-nums' }}
                >
                  +{overflow}
                </span>
              )}
            </>
          ) : (
            <span className="text-xs" style={{ color: NEU.muted, fontFamily: OUTFIT }}>Queue empty</span>
          )}
        </div>
      </div>
      )}

      {/* Awards footer */}
      {/* TODO(merge): wire to chair award allocation from production branch */}
      <button
        onClick={(e) => { e.stopPropagation(); onOpenAwards(data); }}
        className="flex items-center gap-2 mt-4 pt-3 w-full text-left focus:outline-none transition-colors"
        style={{ borderTop: '1px solid rgba(27,56,40,0.1)', color: NEU.muted, fontFamily: OUTFIT, backgroundColor: 'transparent', cursor: 'pointer' }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = NEU.forest; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = NEU.muted; }}
      >
        <Trophy size={13} style={{ flexShrink: 0 }} />
        <span className="text-xs font-semibold">Awards: not allocated</span>
      </button>
    </NeuCard>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function LiveStatusPage() {
  const { conference } = useManage();
  const { session: authSession } = useAuth();

  const [rows, setRows] = useState<LiveCommittee[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<number | null>(null);
  const [, setTick] = useState(0);
  const [recapFor, setRecapFor] = useState<string | null>(null);
  const [awardsFor, setAwardsFor] = useState<string | null>(null);
  const [rosterFor, setRosterFor] = useState<string | null>(null);
  const [refreshHover, setRefreshHover] = useState(false);
  const [broadcastHover, setBroadcastHover] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [broadcasts, setBroadcasts] = useState<BroadcastRow[]>([]);
  const [broadcastBusyKey, setBroadcastBusyKey] = useState<string | null>(null);
  const [broadcastError, setBroadcastError] = useState('');
  const loadingRef = useRef(false);

  const loadAll = useCallback(async () => {
    if (!conference || !authSession) return;
    if (loadingRef.current) return;
    loadingRef.current = true;
    setRefreshing(true);
    try {
      const authed = getAuthedClient(authSession.access_token);
      const { data: confCommittees } = await authed
        .from('conference_committees')
        .select('id, name, abbreviation, logo_url, topics, difficulty, committee_type, total_slots, session_id, session_code, chair_user_ids, display_chairs')
        .eq('conference_id', conference.id)
        .order('name', { ascending: true });

      const confRows = confCommittees ?? [];
      const sessionIds = confRows.map((c) => c.session_id).filter((id): id is string => !!id);

      // Chair profile pictures. `display_chairs` is a trigger-maintained mirror
      // index-aligned with chair_user_ids and already carries {name, avatar_url},
      // so it is the fallback whenever a chair's profile row is not readable
      // under the organiser's RLS (a chair who never applied to this conference).
      const chairIds = Array.from(new Set(confRows.flatMap((c) => (c.chair_user_ids as string[] | null) ?? [])));
      const chairProfiles = new Map<string, { display_name: string; avatar_url: string | null }>();
      if (chairIds.length > 0) {
        const { data: profs } = await authed
          .from('profiles')
          .select('id, display_name, avatar_url')
          .in('id', chairIds);
        for (const p of (profs ?? []) as { id: string; display_name: string; avatar_url: string | null }[]) {
          chairProfiles.set(p.id, { display_name: p.display_name, avatar_url: p.avatar_url });
        }
      }

      // Batched anon reads, live session tables carry public RLS.
      let sessions: Record<string, unknown>[] = [];
      let speakers: Record<string, unknown>[] = [];
      let delegates: Record<string, unknown>[] = [];
      let queues: Record<string, unknown>[] = [];
      let motions: Record<string, unknown>[] = [];
      let documents: Record<string, unknown>[] = [];
      let sysMessages: Record<string, unknown>[] = [];
      let feedback: Record<string, unknown>[] = [];

      if (sessionIds.length > 0) {
        const [sRes, csRes, dRes, qRes, mRes, docRes, msgRes, fbRes] = await Promise.all([
          anonSupabase.from('committees')
            .select('id, code, name, phase, caucus, chair_names, suspended_at, ended_at, settings')
            .in('id', sessionIds),
          anonSupabase.from('current_speaker')
            .select('committee_id, country, time_remaining, started_at')
            .in('committee_id', sessionIds),
          anonSupabase.from('delegates')
            .select('committee_id, country, status')
            .in('committee_id', sessionIds),
          anonSupabase.from('speakers_list')
            .select('committee_id, country, position, list_type')
            .in('committee_id', sessionIds)
            .order('position', { ascending: true }),
          anonSupabase.from('motions')
            .select('committee_id, type, topic, disruptiveness')
            .eq('status', 'pending')
            .in('committee_id', sessionIds),
          anonSupabase.from('documents')
            .select('committee_id, type, status, doc_code, title, sponsors')
            .in('committee_id', sessionIds),
          anonSupabase.from('messages')
            .select('committee_id, sender, content, created_at')
            .eq('sender', '__system__')
            .in('committee_id', sessionIds),
          // Chair feedback: ratings AND private notes. In practice almost every
          // row is a factor rating with no prose, so factor_scores is as much
          // the payload as `content` is.
          anonSupabase.from('feedback')
            .select('committee_id, country, chair_name, content, created_at, level, factor_scores, speech_context, speech_seconds')
            .in('committee_id', sessionIds)
            .order('created_at', { ascending: true }),
        ]);
        sessions = sRes.data ?? [];
        speakers = csRes.data ?? [];
        delegates = dRes.data ?? [];
        queues = qRes.data ?? [];
        motions = mRes.data ?? [];
        documents = docRes.data ?? [];
        sysMessages = msgRes.data ?? [];
        feedback = fbRes.data ?? [];
      }

      const bySession = <T extends Record<string, unknown>>(list: T[], sid: string) =>
        list.filter((r) => r.committee_id === sid);

      const assembled: LiveCommittee[] = confRows.map((c) => {
        const sid = c.session_id as string | null;
        const sRow = sid ? sessions.find((s) => s.id === sid) ?? null : null;
        const speakerRow = sid ? speakers.find((s) => s.committee_id === sid) ?? null : null;

        const speechLogs = sid
          ? bySession(sysMessages, sid)
              .filter((m) => typeof m.content === 'string' && (m.content as string).startsWith('__log__:'))
              .map((m) => {
                try { return JSON.parse((m.content as string).slice('__log__:'.length)); } catch { return null; }
              })
              .filter((e): e is { country: string; seconds: number; context: string; topic: string } => e !== null)
          : [];

        const chairUserIds = (c.chair_user_ids as string[] | null) ?? [];
        const displayChairs = (c.display_chairs as { name: string; avatar_url: string | null }[] | null) ?? [];
        const chairs: ChairPerson[] = chairUserIds.map((uid, i) => {
          const prof = chairProfiles.get(uid);
          const fallback = displayChairs[i];
          return {
            id: uid,
            name: prof?.display_name ?? fallback?.name ?? 'Chair',
            avatarUrl: prof?.avatar_url ?? fallback?.avatar_url ?? null,
          };
        });
        // A dais seeded straight into display_chairs (no linked account) still
        // deserves a face in the stack.
        if (chairs.length === 0 && displayChairs.length > 0) {
          for (const d of displayChairs) chairs.push({ id: null, name: d.name, avatarUrl: d.avatar_url ?? null });
        }

        // committees.settings.scoring → the chair's own ranking factors, so the
        // feedback recap labels ratings the way the dais named them. Read as a
        // pure function of the row; the settings store is never touched here.
        const scoring = getScoringConfig({ dbScoring: (sRow?.settings as { scoring?: ScoringConfig } | null)?.scoring ?? null });

        return {
          conf: {
            id: c.id as string,
            name: c.name as string,
            abbreviation: (c.abbreviation as string | null) ?? null,
            logoUrl: (c.logo_url as string | null) ?? null,
            topics: (c.topics as string[] | null) ?? null,
            totalSlots: (c.total_slots as number) ?? 0,
            sessionId: sid,
            sessionCode: (c.session_code as string | null) ?? null,
            chairUserIds,
            chairs,
          },
          session: sRow
            ? {
                id: sRow.id as string,
                code: sRow.code as string,
                name: sRow.name as string,
                phase: sRow.phase as string,
                caucus: (sRow.caucus as CaucusJson | null) ?? null,
                chairNames: (sRow.chair_names as string[] | null) ?? [],
                suspendedAt: (sRow.suspended_at as string | null) ?? null,
                endedAt: (sRow.ended_at as string | null) ?? null,
                scoringFactors: scoring.factors.filter((f) => f.enabled).map((f) => ({ id: f.id, name: f.name })),
                factorScaleMax: scoring.factorScaleMax,
              }
            : null,
          currentSpeaker: speakerRow
            ? {
                country: (speakerRow.country as string | null) ?? null,
                timeRemaining: (speakerRow.time_remaining as number) ?? 0,
                startedAt: (speakerRow.started_at as string | null) ?? null,
              }
            : null,
          delegates: sid ? bySession(delegates, sid).map((d) => ({ country: d.country as string, status: d.status as string })) : [],
          gslQueue: sid ? bySession(queues, sid).filter((q) => q.list_type === 'gsl').map((q) => q.country as string) : [],
          caucusQueue: sid ? bySession(queues, sid).filter((q) => q.list_type === 'caucus').map((q) => q.country as string) : [],
          pendingMotions: sid
            ? bySession(motions, sid)
                .filter((m) => m.type !== 'join-request' && m.type !== 'gsl-request')
                .map((m) => ({ type: m.type as string, topic: (m.topic as string) ?? '' }))
            : [],
          documents: sid
            ? bySession(documents, sid).map((d) => ({
                type: d.type as string,
                status: d.status as string,
                docCode: (d.doc_code as string) ?? '',
                title: (d.title as string) ?? '',
                sponsors: (d.sponsors as string[] | null) ?? [],
              }))
            : [],
          speechLogs,
          feedback: sid
            ? bySession(feedback, sid).map((f) => ({
                country: f.country as string,
                chairName: (f.chair_name as string) ?? '',
                content: (f.content as string) ?? '',
                createdAt: (f.created_at as string) ?? '',
                level: (f.level as string) ?? 'speech',
                factorScores: (f.factor_scores as Record<string, number> | null) ?? {},
                speechContext: (f.speech_context as string | null) ?? null,
                speechSeconds: (f.speech_seconds as number | null) ?? null,
              }))
            : [],
        };
      });

      setRows(assembled);
      setLastRefreshed(Date.now());
    } finally {
      loadingRef.current = false;
      setRefreshing(false);
    }
  }, [conference?.id, authSession?.access_token]); // eslint-disable-line react-hooks/exhaustive-deps

  // Broadcasts this conference has sent. Kept out of loadAll so a broadcast
  // send/withdraw can refresh just this slice without re-fetching every
  // session table. `expires_at` is the natural horizon: a broadcast past it is
  // no longer on any dais, so the log stops at the ones that still matter plus
  // a short tail of history.
  const loadBroadcasts = useCallback(async () => {
    if (!conference || !authSession) return;
    const authed = getAuthedClient(authSession.access_token);
    const { data } = await authed
      .from('session_broadcasts')
      .select(BROADCAST_COLUMNS)
      .eq('conference_id', conference.id)
      .order('created_at', { ascending: false })
      .limit(120);
    setBroadcasts(((data ?? []) as Record<string, unknown>[]).map(mapBroadcastRow));
  }, [conference?.id, authSession?.access_token]); // eslint-disable-line react-hooks/exhaustive-deps

  // Initial load + 10s polling (kept simple + robust for N committees, no per-committee channels)
  useEffect(() => {
    loadAll();
    loadBroadcasts();
    const poll = setInterval(() => { loadAll(); loadBroadcasts(); }, 10_000);
    return () => clearInterval(poll);
  }, [loadAll, loadBroadcasts]);

  // 1s tick for the "Refreshed Xs ago" label
  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // ── Derived ──
  const recapData = recapFor ? rows?.find((r) => r.conf.id === recapFor) ?? null : null;
  const awardsData = awardsFor ? rows?.find((r) => r.conf.id === awardsFor) ?? null : null;
  const rosterData = rosterFor ? rows?.find((r) => r.conf.id === rosterFor) ?? null : null;

  // Stable identity: `rows ?? []` minted a fresh array on every tick while the
  // page was still loading, which would re-run every memo hanging off it.
  const allRows = useMemo(() => rows ?? [], [rows]);
  const liveCount = allRows.filter((r) => cardStatus(r) === 'live').length;
  const chairsJoined = allRows.reduce((sum, r) => sum + (r.session?.chairNames.length ?? 0), 0);

  // Aggregate glyph-row indicators — computed across every committee on the floor.
  const speakingNow = allRows.filter((r) => !!r.currentSpeaker?.startedAt).length;
  const rollCallCount = allRows.filter((r) => cardStatus(r) === 'not-started').length;
  const motionsPending = allRows.reduce((sum, r) => sum + r.pendingMotions.length, 0);
  const suspendedCount = allRows.filter((r) => cardStatus(r) === 'suspended').length;
  const presentTotal = allRows.reduce((sum, r) => sum + r.delegates.filter((d) => d.status !== 'absent').length, 0);

  const secondsAgo = lastRefreshed ? Math.max(0, Math.floor((Date.now() - lastRefreshed) / 1000)) : null;

  // Only a committee with a linked session (and not already adjourned for good)
  // has a `committees.id` to address, so those are the only broadcast targets.
  // Memoised: the composer diffs this list to fold in committees that come
  // online while it is open, so a fresh array on every 1s tick would churn.
  const targets = useMemo(() => broadcastTargets(allRows), [allRows]);
  const broadcastGroups = useMemo(() => groupBroadcasts(broadcasts).slice(0, 5), [broadcasts]);

  async function handleWithdraw(g: BroadcastGroup) {
    setBroadcastBusyKey(g.key);
    setBroadcastError('');
    const err = await deleteBroadcastGroup(g.ids);
    setBroadcastBusyKey(null);
    if (err) { setBroadcastError("Couldn't withdraw that broadcast: " + err); return; }
    await loadBroadcasts();
  }

  return (
    <div className="px-6 md:px-10 py-8 max-w-6xl" style={{ fontFamily: OUTFIT }}>
      {/* Header */}
      <div className="flex items-end justify-between gap-4 mb-6 flex-wrap">
        <div>
          <Eyebrow>Live status</Eyebrow>
          <h1 className="font-black" style={{ color: NEU.ink, fontFamily: OUTFIT, fontSize: 28, lineHeight: 1.1, marginTop: 2 }}>
            Committee floor
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {secondsAgo !== null && (
            <span className="text-xs" style={{ color: NEU.muted, fontFamily: OUTFIT, fontVariantNumeric: 'tabular-nums' }}>
              Refreshed {secondsAgo}s ago
            </span>
          )}
          <button
            onClick={loadAll}
            disabled={refreshing}
            onMouseEnter={() => setRefreshHover(true)}
            onMouseLeave={() => setRefreshHover(false)}
            className="inline-flex items-center gap-2 rounded-full py-2.5 px-4 text-xs font-bold uppercase focus:outline-none"
            style={{
              border: 'none', color: NEU.forest, backgroundColor: NEU.surface,
              fontFamily: OUTFIT, letterSpacing: '0.06em',
              boxShadow: refreshHover && !refreshing ? NEU.outSmHover : NEU.outSm,
              opacity: refreshing ? 0.6 : 1, cursor: refreshing ? 'default' : 'pointer',
              transition: `box-shadow 200ms ${EASE}`,
            }}
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
          {/* Broadcast — writes session_broadcasts rows, one per targeted
              committee. Nothing here suspends or ends a session itself. */}
          <button
            onClick={() => setComposerOpen(true)}
            onMouseEnter={() => setBroadcastHover(true)}
            onMouseLeave={() => setBroadcastHover(false)}
            className="inline-flex items-center gap-2 rounded-full py-2.5 px-4 text-xs font-bold uppercase focus:outline-none"
            style={{
              border: 'none', color: NEU.gold,
              background: `linear-gradient(135deg, ${NEU_GRADIENTS.forest[0]}, ${NEU_GRADIENTS.forest[1]})`,
              fontFamily: OUTFIT, letterSpacing: '0.06em',
              boxShadow: broadcastHover
                ? `0 6px 16px ${NEU_GRADIENTS.forest[0]}66, ${NEU.outSmHover}`
                : `0 4px 10px ${NEU_GRADIENTS.forest[0]}4D, ${NEU.outSm}`,
              transform: broadcastHover ? 'translateY(-2px)' : 'translateY(0)',
              cursor: 'pointer',
              transition: `box-shadow 220ms ${EASE}, transform 200ms ${EASE}`,
            }}
            title="Send a message to every committee on the floor"
          >
            <Megaphone size={13} />
            Broadcast
          </button>
        </div>
      </div>

      {/* Status glyph row — at-a-glance indicators across the whole floor */}
      <div className="flex items-center gap-2.5 mb-4 flex-wrap">
        <StatusGlyph gradient={NEU_GRADIENTS.green} emoji="Satellite antenna" icon={Radio} value={liveCount} label="Live" accent={NEU.green} pulse />
        <StatusGlyph gradient={NEU_GRADIENTS.sage} emoji="Studio microphone" icon={Mic} value={speakingNow} label="Speaking" accent={NEU.forest} />
        <StatusGlyph gradient={NEU_GRADIENTS.forest} emoji="Person raising hand" icon={Users} value={rollCallCount} label="Roll call" accent={NEU.forest} />
        <StatusGlyph gradient={NEU_GRADIENTS.gold} emoji="Ballot box with ballot" icon={Gavel} value={motionsPending} label="Motions" accent={NEU.deepGold} />
        <StatusGlyph gradient={NEU_GRADIENTS.amber} emoji="Pause button" icon={PauseCircle} value={suspendedCount} label="Suspended" accent={NEU.amber} />
      </div>

      {/* Summary strip — floor overview + live counts */}
      <NeuCard
        className="mb-7 flex items-center justify-between gap-6 flex-wrap relative overflow-hidden"
        style={{ padding: '20px 24px' }}
      >
        {/* Gold accent rail — a small hit of colour on the left edge */}
        <span
          className="absolute left-0 top-0 bottom-0"
          style={{ width: 5, background: `linear-gradient(180deg, ${NEU.gold}, ${NEU.deepGold})`, boxShadow: `2px 0 6px ${NEU.deepGold}44` }}
        />
        <div className="flex items-center gap-4 min-w-0" style={{ paddingLeft: 8 }}>
          <span className="relative inline-flex flex-shrink-0">
            <NeuIconDisc gradient={NEU_GRADIENTS.forest} emoji="Satellite antenna" icon={Radio} size={58} />
            {liveCount > 0 && (
              <span
                className="absolute rounded-full animate-pulse"
                style={{ top: 0, right: 0, width: 13, height: 13, backgroundColor: NEU.green, boxShadow: `0 0 0 3px ${NEU.surface}, 0 0 0 5px ${NEU.green}33` }}
              />
            )}
          </span>
          <div className="min-w-0">
            <p style={{ fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 800, letterSpacing: '0.16em', color: NEU.deepGold }}>
              {conference?.acronym ?? '…'} · FLOOR OVERVIEW
            </p>
            <p className="font-black truncate" style={{ color: liveCount > 0 ? NEU.forest : NEU.ink, fontFamily: OUTFIT, fontSize: 21, lineHeight: 1.12, marginTop: 2 }}>
              {liveCount > 0 ? 'Committees are in session' : 'All quiet on the floor'}
            </p>
            {presentTotal > 0 && (
              <p className="text-xs" style={{ color: NEU.muted, fontFamily: OUTFIT, marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>
                {presentTotal} delegate{presentTotal === 1 ? '' : 's'} present across the floor
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-6 flex-wrap">
          {[
            { value: rows?.length ?? 0, label: 'COMMITTEES', color: NEU.ink },
            { value: liveCount, label: 'IN SESSION', color: liveCount > 0 ? NEU.green : NEU.muted },
            { value: chairsJoined, label: 'CHAIRS JOINED', color: NEU.deepGold },
          ].map((s) => (
            <NeuInset key={s.label} className="text-center" style={{ padding: '10px 18px', borderRadius: 14, minWidth: 92 }}>
              <p style={{ fontFamily: OUTFIT, fontWeight: 900, fontSize: 30, color: s.color, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{s.value}</p>
              <p style={{ fontFamily: OUTFIT, fontSize: 9.5, fontWeight: 800, letterSpacing: '0.12em', color: NEU.muted, marginTop: 5 }}>{s.label}</p>
            </NeuInset>
          ))}
        </div>
      </NeuCard>

      {/* What the secretariat has already sent to the floor */}
      <RecentBroadcasts
        groups={broadcastGroups}
        onDelete={(g) => { void handleWithdraw(g); }}
        busyKey={broadcastBusyKey}
        error={broadcastError}
      />

      {/* Grid */}
      {rows === null ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="rounded-[22px] animate-pulse" style={{ height: 320, backgroundColor: NEU.surface, boxShadow: NEU.out }} />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <NeuCard style={{ padding: 40, textAlign: 'center' }}>
          <p className="text-sm font-bold mb-1" style={{ color: NEU.ink, fontFamily: OUTFIT }}>No committees yet</p>
          <Link
            href={conference ? `/manage/${conference.slug}/committees` : '#'}
            className="text-sm font-bold transition-colors"
            style={{ color: NEU.forest, fontFamily: OUTFIT, textDecoration: 'none' }}
          >
            Create them in Committees →
          </Link>
        </NeuCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {rows.map((r) => {
            const status = cardStatus(r);
            return status === 'no-session' || status === 'not-started' ? (
              <NotStartedCard
                key={r.conf.id}
                data={r}
                committeesHref={conference ? `/manage/${conference.slug}/committees` : '#'}
              />
            ) : (
              <LiveCard
                key={r.conf.id}
                data={r}
                onOpenRecap={(d) => setRecapFor(d.conf.id)}
                onOpenAwards={(d) => setAwardsFor(d.conf.id)}
                onOpenRoster={(d) => setRosterFor(d.conf.id)}
              />
            );
          })}
        </div>
      )}

      {/* Modals */}
      {recapData && <RecapModal data={recapData} onClose={() => setRecapFor(null)} />}
      {awardsData && <AwardsModal data={awardsData} onClose={() => setAwardsFor(null)} />}
      {rosterData && <RosterModal data={rosterData} onClose={() => setRosterFor(null)} />}
      {composerOpen && conference && (
        <BroadcastComposer
          conferenceId={conference.id}
          conferenceLabel={conference.acronym ?? conference.full_name}
          createdBy={authSession?.user?.id ?? null}
          targets={targets}
          onClose={() => setComposerOpen(false)}
          onSent={() => { void loadBroadcasts(); }}
        />
      )}
    </div>
  );
}
