'use client';

// ─────────────────────────────────────────────────────────────────────────────
// SpeakerControls: the speaker buttons on the floor (GSL, moderated caucus, Tour de Table).
//
//   Row under the floor:     Restart (icon), Start / Pause, Next (or Finish), Add time
//                            (icon only). There is no "Call first speaker" label any more
//                            (owner, 16 Sep 2026): on the GSL the delegation at the head of
//                            the list is already on deck and Start calls them.
//   Beside the progress bar: Right of Reply (`RtrButton`: icon with "RTR" beneath), placed
//                            to the inline-end of the bar by `FloorProgress`. With nobody on
//                            the floor there is no bar, so the row carries it at its end.
//   The countdown itself:    `SpeakerClock` toggles start / pause for the Moderator.
//
// The row is ALWAYS rendered for the Moderator, speaker or not. A control that cannot act
// right now stays in place and says why in its tooltip, instead of the row vanishing and
// the layout jumping when the floor empties. Unavailable controls use aria-disabled (not
// the disabled attribute) so the tooltip still shows on hover and focus; their click
// handler is simply not called.
//
// Depth: every available button carries `gv-lift` (globals.css), the soft forest-tinted
// resting shadow the controls had before the 15 Sep redesign, deeper on hover, collapsed
// on press. Unavailable buttons lose it, because a floating disabled button reads as live.
//
// Colours keep AA contrast for icons and labels: Start forest green with white, Pause gold
// with ink, Next forest with gold, Add time a pale sky blue with navy, Right of Reply a
// soft apricot orange with a deep rust (16 Sep 2026, owner: "a more pleasant orange"; the
// muted sand before it read as beige, the saturated orange before that as an alarm).
//
// Purely presentational: every handler belongs to the chair page, which owns the clocks
// and every write (RULES 3 to 5). `SpeakerClock` calls the SAME toggle handler as the
// Start / Pause button and is blocked by the SAME reasons.
// ─────────────────────────────────────────────────────────────────────────────

import type { CSSProperties, ReactNode } from 'react';
import { ClockPlus, Pause, Play, RotateCcw, SkipForward, MessageSquareReply, Flag } from 'lucide-react';
import { useT } from '@/contexts/LanguageContext';

const OUTFIT = "'Outfit', sans-serif";

/** The legacy labels carry their own glyphs ("▶ START", "NEXT →"); the icons replace them. */
const clean = (label: string) => label.replace(/[▶►⏸→←‖]/g, '').replace(/\s+/g, ' ').trim();

type Tone = { bg: string; hover: string; fg: string };
export const SPEAKER_TONES = {
  neutral: { bg: '#DDD4C0', hover: '#CFC4AD', fg: '#1C1410' },
  start: { bg: '#197A43', hover: '#146638', fg: '#FFFFFF' },
  pause: { bg: '#F2C230', hover: '#E5B21C', fg: '#1C1410' },
  next: { bg: '#1B3828', hover: '#24503A', fg: '#EED98A' },
  // Lighter sky blue; navy on it is ~10:1.
  time: { bg: '#D4EAFB', hover: '#C2E0F7', fg: '#0A3350' },
  // Soft apricot; deep rust on it is ~6:1.
  reply: { bg: '#FAD0A4', hover: '#F6C18C', fg: '#7A3A0C' },
} satisfies Record<string, Tone>;
const TONES = SPEAKER_TONES;

/**
 * The two floor popovers (owner, 16 Sep 2026): Add time in a deep blue, Right of Reply in a
 * warm, soft orange (a burnt-orange header over a peach body, replacing the brown that read
 * as "deep orange"). Both headers are darker than the button that opens them so the panel
 * reads as a surface rather than a second button.
 *   header  #0E3A57 / #DCEBF8  ≈ 11:1       header  #AD4F18 / #FFF6EC  ≈ 5.2:1
 *   body    #0A3350 on #D9E8F4 ≈ 10:1       body    #5A2A08 on #FCE3C8 ≈ 9.5:1
 */
export const POPOVER_TONES = {
  time: { surface: '#D9E8F4', headerBg: '#0E3A57', headerFg: '#DCEBF8', ink: '#0A3350', accent: 'rgba(14,58,87,0.45)', btn: '#0E3A57', btnHover: '#16506F', btnFg: '#EAF4FC', chip: '#C6DCEE', chipOn: '#0E3A57' },
  reply: { surface: '#FCE3C8', headerBg: '#AD4F18', headerFg: '#FFF6EC', ink: '#5A2A08', accent: 'rgba(173,79,24,0.45)', btn: '#AD4F18', btnHover: '#964313', btnFg: '#FFF6EC', chip: '#F7CFA2', chipOn: '#AD4F18' },
} as const;

/**
 * A Commenter's view of a Moderator-only control (the RTR button, the clock): drawn disabled
 * with `reason` as its tooltip, and a press calls `onAttempt` (the "only the Moderator"
 * notice, src/lib/commenterNotice.ts) instead of the handler. UI only (rule 15).
 */
export interface ControlLock { reason: string; onAttempt: () => void }

const ACTIVE_RING = (fg: string) => `inset 0 0 0 2px ${fg}, 0 1px 2px rgba(27,56,40,0.10), 0 4px 10px rgba(27,56,40,0.16)`;

function ControlButton({
  tone, label, title, blockedReason, onClick, onBlockedClick, children, variant = 'normal', active = false, tutorial, className = '', stacked, anchor,
}: {
  tone: Tone;
  label: string;
  /** Tooltip while the control can act. */
  title?: string;
  /** Non-null = the control cannot act; this is the tooltip that says why. */
  blockedReason?: string | null;
  onClick: () => void;
  /** Called instead when the control is blocked (a Commenter's attempt raises a notice). */
  onBlockedClick?: () => void;
  children: ReactNode;
  /** grow = the primary (Start / Pause), next = shares the rest of the row, icon = square. */
  variant?: 'normal' | 'grow' | 'next' | 'icon';
  active?: boolean;
  tutorial?: string;
  /** `data-floor-anchor`: a popover this button opens places itself above it. */
  anchor?: string;
  className?: string;
  /** Short caption rendered under the icon (RTR). The full name is the aria-label. */
  stacked?: string;
}) {
  const blocked = !!blockedReason;
  const iconOnly = variant === 'icon' || !!stacked;
  // Basis `auto`: each flexible button starts at its own label's width and only then shares
  // the spare room, so a long label (fr "APPELER LE PREMIER ORATEUR") gets the space it
  // needs and truncates only when the row is genuinely too narrow.
  const sizing = variant === 'grow' ? 'flex-[1.4_1_auto] min-w-0 px-4'
    : variant === 'next' ? 'flex-[1_1_auto] min-w-0 px-4'
    : stacked ? 'shrink-0 w-12 flex-col gap-0.5'
    : variant === 'icon' ? 'shrink-0 w-12' : 'shrink-0 px-4';
  return (
    <button
      type="button"
      data-tutorial={tutorial}
      data-floor-anchor={anchor}
      aria-disabled={blocked || undefined}
      aria-label={iconOnly ? label : undefined}
      aria-pressed={active || undefined}
      title={blocked ? blockedReason! : (title ?? (iconOnly ? label : undefined))}
      onClick={() => { if (!blocked) onClick(); else onBlockedClick?.(); }}
      className={`inline-flex items-center justify-center gap-2 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] focus-visible:ring-offset-2 focus-visible:ring-offset-[#EDE7D8] ${
        blocked ? 'cursor-not-allowed opacity-45' : 'gv-lift cursor-pointer bg-[var(--ctl-bg)] hover:bg-[var(--ctl-hover)]'
      } ${sizing} ${className}`}
      style={{
        height: 48,
        ['--ctl-bg' as string]: tone.bg,
        ['--ctl-hover' as string]: tone.hover,
        backgroundColor: blocked ? tone.bg : undefined,
        color: tone.fg,
        fontFamily: OUTFIT,
        fontSize: 15,
        fontWeight: 800,
        letterSpacing: '0.01em',
        boxShadow: active ? ACTIVE_RING(tone.fg) : undefined,
      } as CSSProperties}
    >
      {children}
      {stacked && <span aria-hidden className="leading-none" style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.04em' }}>{stacked}</span>}
      {!iconOnly && <span className="min-w-0 truncate">{label}</span>}
    </button>
  );
}

/** Right of Reply: the icon with a short "RTR" caption beneath it. */
export function RtrButton({ onClick, active = false, tutorial, locked }: { onClick: () => void; active?: boolean; tutorial?: string; locked?: ControlLock | null }) {
  const t = useT();
  return (
    <ControlButton
      tone={TONES.reply}
      label={t('gsl_right_to_reply')}
      title={t('speaker_ctl_rtr_title')}
      blockedReason={locked?.reason ?? null}
      onBlockedClick={locked?.onAttempt}
      onClick={onClick}
      active={active}
      tutorial={tutorial}
      anchor="rtr"
      stacked={t('speaker_ctl_rtr_short')}
    >
      <MessageSquareReply size={18} strokeWidth={2.4} aria-hidden />
    </ControlButton>
  );
}

/**
 * The floor's progress bar with Right of Reply to its inline-end. `rtr` omitted (Tour de
 * Table, a Commenter) = the bar alone, full width, exactly as before.
 */
export function FloorProgress({ percent, barClassName, rtr }: {
  percent: number;
  barClassName: string;
  rtr?: { onClick: () => void; active: boolean; tutorial?: string; locked?: ControlLock | null } | null;
}) {
  return (
    // The button row below is max-w-3xl with 1rem gutters, and this bar already sits inside
    // the floor's 1rem padding: 46rem makes their content edges line up, so RTR sits
    // directly above Add time.
    <div className="w-full max-w-[46rem] flex items-center gap-3" style={{ marginBottom: 6 }}>
      <div className="flex-1 min-w-0 h-2 bg-[#DDD4C0] rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-[width] duration-300 ${barClassName}`} style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} />
      </div>
      {rtr && <RtrButton onClick={rtr.onClick} active={rtr.active} tutorial={rtr.tutorial} locked={rtr.locked} />}
    </div>
  );
}

/**
 * The big countdown. For the Moderator (`onToggle` given) it is a button: click, Enter or
 * Space starts or pauses the speaker clock through the page's own handler. While it cannot
 * start, it is aria-disabled and its tooltip says why, exactly like the Start button.
 * Without `onToggle` (a Commenter) it is plain text.
 */
export function SpeakerClock({
  running, onToggle, blockedReason = null, className = '', style, tutorial, children, locked,
}: {
  running: boolean;
  onToggle?: () => void;
  /** A Commenter: the clock stays plain text, and a press raises the notice. */
  locked?: ControlLock | null;
  /** Why it cannot START right now. Ignored while running (pausing is always offered). */
  blockedReason?: string | null;
  className?: string;
  style?: CSSProperties;
  tutorial?: string;
  children: ReactNode;
}) {
  const t = useT();
  if (locked) {
    return (
      <div data-tutorial={tutorial} className={`cursor-not-allowed ${className}`} style={style} title={locked.reason} onClick={locked.onAttempt}>
        {children}
      </div>
    );
  }
  if (!onToggle) {
    return <div data-tutorial={tutorial} className={className} style={style}>{children}</div>;
  }
  const blocked = !running && !!blockedReason;
  const label = running ? t('speaker_clock_pause') : t('speaker_clock_start');
  const activate = () => { if (!blocked) onToggle(); };
  return (
    <div
      role="button"
      tabIndex={0}
      data-tutorial={tutorial}
      aria-label={label}
      aria-pressed={running}
      aria-disabled={blocked || undefined}
      title={blocked ? blockedReason! : label}
      onClick={activate}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); }
      }}
      className={`group/clock relative select-none rounded-2xl px-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] focus-visible:ring-offset-2 focus-visible:ring-offset-[#EDE7D8] transition-[background-color,box-shadow] duration-150 ${
        blocked ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-[#1B3828]/[0.035] hover:shadow-[inset_0_0_0_1.5px_rgba(27,56,40,0.10)] active:bg-[#1B3828]/[0.07]'
      } ${className}`}
      style={style}
    >
      {children}
      {!blocked && (
        <span
          aria-hidden
          className="pointer-events-none absolute top-1/2 -translate-y-1/2 -end-7 opacity-0 group-hover/clock:opacity-100 group-focus-visible/clock:opacity-100 transition-opacity duration-150 text-[#1B3828]"
        >
          {running ? <Pause size={22} strokeWidth={2.6} /> : <Play size={22} strokeWidth={2.6} />}
        </span>
      )}
    </div>
  );
}

export default function SpeakerControls({
  hasSpeaker,
  floorReady,
  addTimeReady,
  timerRunning,
  onToggleTimer,
  startBlockedReason = null,
  onRestart,
  startTutorial,
  next,
  onAddTime,
  addTimeActive = false,
  onRightOfReply,
  rightOfReplyActive = false,
  tutorialTargets = false,
}: {
  /** Somebody holds the floor. Restart and Add time need one (they write `current_speaker`). */
  hasSpeaker: boolean;
  /**
   * Start may act. Defaults to `hasSpeaker`. The GSL passes true for a delegation that is on
   * deck but not seated yet: Start seats them and starts the clock in one press (owner, 16
   * Sep 2026). Restart and Add time stay gated on a real seated speaker.
   */
  floorReady?: boolean;
  /**
   * Add time may act. Defaults to `hasSpeaker`. The GSL passes true for a delegation on deck
   * (owner, 16 Sep 2026): the grant is held locally and folded into the slot Start seats them
   * with. Nothing is written, logged or started by the grant itself.
   */
  addTimeReady?: boolean;
  timerRunning: boolean;
  onToggleTimer: () => void;
  /** Extra reason Start cannot run (e.g. "require next speaker" on the last speaker). */
  startBlockedReason?: string | null;
  onRestart: () => void;
  /** data-tutorial on Start instead of `timer-toggle` (the GSL on deck: Start is the call). */
  startTutorial?: string;
  /** Next, or Finish when nobody is queued. `blockedReason` non-null = unavailable. */
  next: { label: string; title: string; onClick: () => void; blockedReason?: string | null; finish?: boolean; tutorial?: string };
  onAddTime: () => void;
  addTimeActive?: boolean;
  /**
   * Right of Reply IN THE ROW. Only passed while nobody holds the floor: with a speaker it
   * sits beside the progress bar instead (`FloorProgress`). Omitted = not in the row.
   */
  onRightOfReply?: () => void;
  rightOfReplyActive?: boolean;
  /** The GSL instance carries the onboarding tutorial's data-tutorial targets. */
  tutorialTargets?: boolean;
}) {
  const t = useT();
  const needSpeaker = hasSpeaker ? null : t('speaker_ctl_need_speaker');
  const startReason = ((floorReady ?? hasSpeaker) ? null : needSpeaker) ?? startBlockedReason;
  const addTimeLabel = t('gsl_add_time').replace(/\s*\n\s*/g, ' ');
  return (
    // No wrapping: two icon squares plus two flexible buttons always fit on one line, and
    // a long label (fr "APPELER LE PREMIER ORATEUR") truncates with its full text in the
    // tooltip instead of pushing Next onto a second row.
    <div className="shrink-0 flex flex-nowrap items-center justify-center gap-2 w-full max-w-3xl px-4 pb-3 pt-1 mx-auto">
      <ControlButton tone={TONES.neutral} label={t('speaker_ctl_restart')} variant="icon" blockedReason={needSpeaker} onClick={onRestart}>
        <RotateCcw size={19} strokeWidth={2.4} aria-hidden className="rtl:-scale-x-100" />
      </ControlButton>
      <ControlButton
        tone={timerRunning ? TONES.pause : TONES.start}
        label={clean(timerRunning ? t('gsl_pause') : t('gsl_start'))}
        blockedReason={timerRunning ? null : startReason}
        onClick={onToggleTimer}
        variant="grow"
        tutorial={startTutorial ?? (tutorialTargets ? 'timer-toggle' : undefined)}
      >
        {timerRunning ? <Pause size={18} strokeWidth={2.6} aria-hidden className="shrink-0" /> : <Play size={18} strokeWidth={2.6} aria-hidden className="shrink-0" />}
      </ControlButton>
      <ControlButton
        tone={TONES.next}
        label={clean(next.label)}
        // The label can truncate in a narrow row or a long locale, so the tooltip always
        // leads with the full label.
        title={`${clean(next.label)}. ${next.title}`}
        blockedReason={next.blockedReason ?? null}
        onClick={next.onClick}
        tutorial={next.tutorial}
        variant="next"
      >
        {next.finish ? <Flag size={17} strokeWidth={2.4} aria-hidden className="shrink-0" /> : <SkipForward size={18} strokeWidth={2.4} aria-hidden className="shrink-0 rtl:-scale-x-100" />}
      </ControlButton>
      <ControlButton
        tone={TONES.time}
        label={addTimeLabel}
        title={t('speaker_ctl_add_time_title')}
        blockedReason={(addTimeReady ?? hasSpeaker) ? null : needSpeaker}
        onClick={onAddTime}
        active={addTimeActive}
        variant="icon"
        tutorial={tutorialTargets ? 'add-time-button' : undefined}
        anchor="add-time"
      >
        <ClockPlus size={20} strokeWidth={2.4} aria-hidden />
      </ControlButton>
      {onRightOfReply && (
        <RtrButton onClick={onRightOfReply} active={rightOfReplyActive} tutorial={tutorialTargets ? 'rtr-button' : undefined} />
      )}
    </div>
  );
}
