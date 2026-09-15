'use client';

// ─────────────────────────────────────────────────────────────────────────────
// SpeakerControls: the row of speaker buttons under the floor (GSL, moderated caucus,
// Tour de Table). Restart, Start / Pause, Next (or Finish), Add time, Right of Reply.
//
// The row is ALWAYS rendered for the Moderator, speaker or not. A control that cannot act
// right now stays in place and says why in its tooltip, instead of the row vanishing and
// the layout jumping when the floor empties. Unavailable controls use aria-disabled (not
// the disabled attribute) so the tooltip still shows on hover and focus; their click
// handler is simply not called.
//
// Colours are vibrant and keep AA contrast for the labels: Start forest green with white,
// Pause gold with ink, Next forest with gold, Add time light blue with navy, Right of Reply
// full orange with ink. Every button is 48px tall with a visible focus ring.
//
// Purely presentational: every handler belongs to the chair page, which owns the clocks
// and every write (RULES 3 to 5).
// ─────────────────────────────────────────────────────────────────────────────

import type { ReactNode } from 'react';
import { ClockPlus, Pause, Play, RotateCcw, SkipForward, MessageSquareReply, Flag } from 'lucide-react';
import { useT } from '@/contexts/LanguageContext';

const OUTFIT = "'Outfit', sans-serif";

/** The legacy labels carry their own glyphs ("▶ START", "NEXT →"); the icons replace them. */
const clean = (label: string) => label.replace(/[▶►⏸→←‖]/g, '').replace(/\s+/g, ' ').trim();

type Tone = { bg: string; hover: string; fg: string };
const TONES = {
  neutral: { bg: '#DDD4C0', hover: '#CFC4AD', fg: '#1C1410' },
  start: { bg: '#197A43', hover: '#146638', fg: '#FFFFFF' },
  pause: { bg: '#F2C230', hover: '#E5B21C', fg: '#1C1410' },
  next: { bg: '#1B3828', hover: '#24503A', fg: '#EED98A' },
  time: { bg: '#A5D8FA', hover: '#8DCBF5', fg: '#0A3350' },
  reply: { bg: '#F97316', hover: '#EA6A0C', fg: '#1C1410' },
} satisfies Record<string, Tone>;

function ControlButton({
  tone, label, title, blockedReason, onClick, children, grow = false, iconOnly = false, active = false, tutorial,
}: {
  tone: Tone;
  label: string;
  /** Tooltip while the control can act. */
  title?: string;
  /** Non-null = the control cannot act; this is the tooltip that says why. */
  blockedReason?: string | null;
  onClick: () => void;
  children: ReactNode;
  grow?: boolean;
  iconOnly?: boolean;
  active?: boolean;
  tutorial?: string;
}) {
  const blocked = !!blockedReason;
  return (
    <button
      type="button"
      data-tutorial={tutorial}
      aria-disabled={blocked || undefined}
      aria-label={iconOnly ? label : undefined}
      aria-pressed={active || undefined}
      title={blocked ? blockedReason! : (title ?? (iconOnly ? label : undefined))}
      onClick={() => { if (!blocked) onClick(); }}
      className={`inline-flex items-center justify-center gap-2 rounded-xl whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] focus-visible:ring-offset-2 focus-visible:ring-offset-[#EDE7D8] transition-[background-color,transform,opacity] duration-150 motion-reduce:transition-none ${
        blocked ? 'cursor-not-allowed opacity-45' : 'cursor-pointer active:scale-[0.97] bg-[var(--ctl-bg)] hover:bg-[var(--ctl-hover)]'
      } ${grow ? 'flex-[1.4] min-w-[8.5rem]' : ''} ${iconOnly ? 'w-12' : 'px-4'}`}
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
        boxShadow: active ? `inset 0 0 0 2px ${tone.fg}` : undefined,
      } as React.CSSProperties}
    >
      {children}
      {!iconOnly && <span>{label}</span>}
    </button>
  );
}

export default function SpeakerControls({
  hasSpeaker,
  timerRunning,
  onToggleTimer,
  startBlockedReason = null,
  onRestart,
  next,
  onAddTime,
  addTimeActive = false,
  onRightOfReply,
  rightOfReplyActive = false,
  tutorialTargets = false,
}: {
  /** Somebody holds the floor. Restart and Add time need one; Start needs one too. */
  hasSpeaker: boolean;
  timerRunning: boolean;
  onToggleTimer: () => void;
  /** Extra reason Start cannot run (e.g. "require next speaker" on the last speaker). */
  startBlockedReason?: string | null;
  onRestart: () => void;
  /** Next, or Finish when nobody is queued. `blockedReason` non-null = unavailable. */
  next: { label: string; title: string; onClick: () => void; blockedReason?: string | null; finish?: boolean; tutorial?: string };
  onAddTime: () => void;
  addTimeActive?: boolean;
  /** Omitted (Tour de Table) = no Right of Reply button. */
  onRightOfReply?: () => void;
  rightOfReplyActive?: boolean;
  /** The GSL instance carries the onboarding tutorial's data-tutorial targets. */
  tutorialTargets?: boolean;
}) {
  const t = useT();
  const needSpeaker = hasSpeaker ? null : t('speaker_ctl_need_speaker');
  const startReason = needSpeaker ?? startBlockedReason;
  const addTimeLabel = t('gsl_add_time').replace(/\s*\n\s*/g, ' ');
  return (
    <div className="shrink-0 flex flex-wrap justify-center gap-2 w-full max-w-2xl px-4 pb-3 mx-auto">
      <ControlButton tone={TONES.neutral} label={t('speaker_ctl_restart')} iconOnly blockedReason={needSpeaker} onClick={onRestart}>
        <RotateCcw size={19} strokeWidth={2.4} aria-hidden />
      </ControlButton>
      <ControlButton
        tone={timerRunning ? TONES.pause : TONES.start}
        label={clean(timerRunning ? t('gsl_pause') : t('gsl_start'))}
        blockedReason={timerRunning ? null : startReason}
        onClick={onToggleTimer}
        grow
        tutorial={tutorialTargets ? 'timer-toggle' : undefined}
      >
        {timerRunning ? <Pause size={18} strokeWidth={2.6} aria-hidden /> : <Play size={18} strokeWidth={2.6} aria-hidden />}
      </ControlButton>
      <ControlButton tone={TONES.next} label={clean(next.label)} title={next.title} blockedReason={next.blockedReason ?? null} onClick={next.onClick} tutorial={next.tutorial}>
        {next.finish ? <Flag size={17} strokeWidth={2.4} aria-hidden /> : <SkipForward size={18} strokeWidth={2.4} aria-hidden className="rtl:-scale-x-100" />}
      </ControlButton>
      <ControlButton
        tone={TONES.time}
        label={addTimeLabel}
        title={t('speaker_ctl_add_time_title')}
        blockedReason={needSpeaker}
        onClick={onAddTime}
        active={addTimeActive}
        tutorial={tutorialTargets ? 'add-time-button' : undefined}
      >
        <ClockPlus size={19} strokeWidth={2.4} aria-hidden />
      </ControlButton>
      {onRightOfReply && (
        <ControlButton
          tone={TONES.reply}
          label={t('gsl_right_to_reply')}
          title={t('speaker_ctl_rtr_title')}
          onClick={onRightOfReply}
          active={rightOfReplyActive}
          tutorial={tutorialTargets ? 'rtr-button' : undefined}
        >
          <MessageSquareReply size={18} strokeWidth={2.4} aria-hidden />
        </ControlButton>
      )}
    </div>
  );
}
