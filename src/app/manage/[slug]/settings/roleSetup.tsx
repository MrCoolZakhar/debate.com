'use client';

/**
 * Set up one role's applications, step by step (Oct 2026 redesign; owner:
 * "think about redoing every single step in the settings for the
 * applications, definitely could be better showcased").
 *
 * One card per question, in the order an organiser decides them:
 *
 *   1  Taking applications   the role's on/off switch, always visible
 *   2  When                  opens / closes, drawn as a bar with the prices
 *   3  Price                 one price, or prices that change by date
 *   4  Paying                payment timing and the dashboard lock (paid roles only)
 *   5  Who gets in           auto-accept, max accepted, resubmission
 *   6  The form              preferences, MUN experience, the questions
 *   7  After they apply      the message shown once after submitting
 *   8  Check everything      every answer in one place, with Change links
 *
 * Each card shows its current answer in a sentence while closed; one card is
 * open at a time. Presentation and flow only: every field, every validation
 * (roleTimeline.ts through the page's saveTimeline, CONSTRAINT_MESSAGES), every
 * autosave and every write is the settings page's own, passed in unchanged.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Check, Copy, Eye, ChevronDown, Plus, Star, X, Building2, Globe, Lock,
  CheckCircle2, Clock, MinusCircle, XCircle, type LucideIcon,
} from 'lucide-react';
import { Emoji3D } from '@/components/neu';
import { GoldWord } from '@/components/BrandHeading';
import { DatePicker } from '@/components/DatePicker';
import { CurrencyPicker } from '@/components/CurrencyPicker';
import { activeFeePhase, type FeePhase } from '@/lib/finance';
import { conferencePaymentsReady, paymentGateBlocks } from '@/lib/payments';
import { normalizeBlocks } from '@/lib/customQuestions';
import type { TimelineContext, TimelineInput } from '@/lib/roleTimeline';
import type { Conference } from '@/app/manage/[slug]/layout';
import { ROLE_ORDER, ROLE_EMOJI, ROLE_BLURB, InfoHint } from './applicationsUi';
import { TimelineNotice, TimelineWarning } from './timelineUi';
import { RoleTimelineBar } from './roleTimelineBar';
import {
  F, INK, INK_SOFT, FOREST, GOLD, AMBER, DANGER, HAIRLINE, CARD, PRIMARY_BTN, SECOND_BTN, TEXT_LINK, INPUT,
  Switch, ToggleRow, FieldLabel, Notice, PREF_MODE_OPTIONS,
  roleIsFree, roleHasPrice, roleCanHavePreference, rolePlural, roleTitle, windowState, dateAndTime, rolePriceText,
  moneyText, toDatetimeLocal, fromDatetimeLocal, localZoneLabel, type RoleSetupConfig, type WindowState,
} from './panelKit';

export type StepKey = 'when' | 'price' | 'paying' | 'entry' | 'form' | 'after' | 'review';
export const STEP_KEYS: readonly StepKey[] = ['when', 'price', 'paying', 'entry', 'form', 'after', 'review'];

const STEP_TITLE: Record<StepKey, string> = {
  when: 'When Can People Apply?',
  price: 'What Does It Cost?',
  paying: 'When Do People Pay?',
  entry: 'Who Gets In?',
  form: 'What Do You Ask Them?',
  after: 'What Do They See After Applying?',
  review: 'Check Everything',
};

const STATE_MARK: Record<WindowState, { icon: LucideIcon; word: string; color: string }> = {
  open: { icon: CheckCircle2, word: 'Open', color: FOREST },
  scheduled: { icon: Clock, word: 'Opens later', color: AMBER },
  closed: { icon: XCircle, word: 'Closed', color: DANGER },
  off: { icon: MinusCircle, word: 'Off', color: INK_SOFT },
};

const CSS = `
.gvr-root { container-type: inline-size; }
.gvr-roles { display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none; padding: 2px 2px 8px; margin: 0 -2px; }
.gvr-roles::-webkit-scrollbar { display: none; }
@container (min-width: 820px) { .gvr-roles { flex-wrap: wrap; overflow: visible; } }
.gvr-two { display: grid; gap: 14px; grid-template-columns: minmax(0, 1fr); }
@container (min-width: 640px) { .gvr-two { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
/* A price row: name, from, to, amount, remove. One field per line on a
   phone, the two dates side by side from 520px, all five in a row from 800px. */
.gvr-phase { display: grid; gap: 8px; grid-template-columns: minmax(0, 1fr) 32px; align-items: center; }
.gvr-phase > :nth-child(-n+3) { grid-column: 1 / -1; }
@container (min-width: 520px) {
  .gvr-phase { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
  .gvr-phase > :nth-child(-n+3) { grid-column: auto; }
  .gvr-phase > .gvr-phase-name { grid-column: 1 / -1; }
}
@container (min-width: 800px) {
  .gvr-phase { grid-template-columns: minmax(0, 1.1fr) minmax(0, 1.2fr) minmax(0, 1.2fr) minmax(0, 0.75fr) 32px; }
  .gvr-phase > .gvr-phase-name { grid-column: auto; }
}
.gvr-review { display: grid; grid-template-columns: minmax(0, 1fr) auto; column-gap: 14px; row-gap: 2px; }
`;

// ── The answers, one sentence each ───────────────────────────────────────────

function windowAnswer(cfg: RoleSetupConfig, now: number): string {
  const o = cfg.applications_open_at;
  const c = cfg.applications_close_at;
  if (!o && !c) return 'Opens when you switch it on, and stays open until you switch it off.';
  if (o && c) return `Opens ${dateAndTime(o, now)} and closes ${dateAndTime(c, now)}.`;
  if (o) return `Opens ${dateAndTime(o, now)}, with no closing date.`;
  return `Open now, and closes ${dateAndTime(c, now)}.`;
}

function priceAnswer(cfg: RoleSetupConfig, currency: string, now: number): string {
  const phases = (cfg.fee_phases ?? []).filter(p => p.start_date && p.end_date);
  if (roleIsFree(cfg)) return 'Free.';
  if (phases.length === 0) return `${moneyText(cfg.fee_amount, cfg.fee_currency || currency)}.`;
  return `${rolePriceText(cfg, currency, now)} now, ${phases.length} ${phases.length === 1 ? 'price' : 'prices'} by date.`;
}

function payingAnswer(cfg: RoleSetupConfig): string {
  const when = cfg.payment_timing === 'after_acceptance' ? 'After you accept them' : 'As soon as they apply';
  return `${when}${cfg.hide_dashboard_until_paid ? ', and their dashboard stays hidden until they pay' : ''}.`;
}

function entryAnswer(cfg: RoleSetupConfig): string {
  const parts = [cfg.auto_accept ? 'Everyone is accepted straight away' : 'You review each application'];
  if (cfg.max_accepted != null) parts.push(`up to ${cfg.max_accepted}`);
  if (cfg.allow_resubmission) parts.push('turned-down applicants can try again');
  return `${parts.join(', ')}.`;
}

function formAnswer(cfg: RoleSetupConfig): string {
  const n = normalizeBlocks(cfg.custom_questions ?? []).filter(b => b.kind === 'question').length;
  const q = n === 0 ? 'No questions of your own yet' : `${n} ${n === 1 ? 'question' : 'questions'} of your own`;
  if (!roleCanHavePreference(cfg.role)) return `${q}.`;
  const mode = cfg.preference_mode ?? 'none';
  if (cfg.role === 'chair') return `${q}${mode === 'committees_only' ? ', and they rank committees' : ''}.`;
  const label = PREF_MODE_OPTIONS.find(o => o.value === mode)?.label.toLowerCase();
  return `${q}${mode !== 'none' && label ? `, and they rank ${label}` : ''}.`;
}

function afterAnswer(cfg: RoleSetupConfig): string {
  const m = (cfg.submission_message ?? '').trim();
  if (!m) return 'Nothing extra. They see the usual confirmation.';
  return cfg.submission_link_label ? `A message and a "${cfg.submission_link_label}" button.` : 'A message, with no button.';
}

// ── Pieces ───────────────────────────────────────────────────────────────────

function StepCard({ id, n, title, answer, extra, open, onToggle, todo, children, footer }: {
  id: string;
  n: number;
  title: string;
  answer: string;
  extra?: ReactNode;
  open: boolean;
  onToggle: () => void;
  todo?: boolean;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section
      id={id}
      style={{
        ...CARD,
        scrollMarginTop: 20,
        // A coloured edge on a step that still wants an answer (taste board).
        boxShadow: todo && !open ? `inset 4px 0 0 #D9B65A, ${CARD.boxShadow}` : CARD.boxShadow,
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={`${id}-body`}
        className="w-full flex items-start gap-3.5 text-left focus:outline-none focus-visible:ring-2 rounded-[20px]"
        style={{ background: 'none', border: 'none', padding: 'clamp(16px, 2.6vw, 22px)', cursor: 'pointer' }}
      >
        <span
          aria-hidden
          className="flex items-center justify-center flex-shrink-0"
          style={{
            width: 32, height: 32, borderRadius: '50%', marginTop: 1,
            fontFamily: F, fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
            ...(todo
              ? { backgroundColor: '#FFFFFF', color: FOREST, boxShadow: 'inset 0 0 0 1.5px rgba(27,56,40,0.28)' }
              : { background: 'linear-gradient(140deg, #1B3828, #2A5A3C)', color: GOLD }),
          }}
        >
          {n}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block" style={{ fontFamily: F, fontSize: 18, fontWeight: 700, color: INK, lineHeight: 1.25, overflowWrap: 'anywhere' }}>{title}</span>
          {!open && (
            <span className="block mt-1" style={{ fontFamily: F, fontSize: 14.5, color: INK_SOFT, lineHeight: 1.45, overflowWrap: 'anywhere' }}>{answer}</span>
          )}
        </span>
        <span className="flex items-center gap-1.5 flex-shrink-0 mt-1" style={{ fontFamily: F, fontSize: 14, fontWeight: 700, color: FOREST }}>
          <span className="hidden sm:inline" style={{ textDecoration: open ? 'none' : 'underline', textUnderlineOffset: 3 }}>{open ? 'Close' : 'Change'}</span>
          <ChevronDown size={18} strokeWidth={2.4} aria-hidden style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 200ms ease' }} />
        </span>
      </button>
      {!open && extra && (
        <div style={{ padding: '0 clamp(16px, 2.6vw, 22px) clamp(16px, 2.6vw, 20px)', paddingLeft: 'calc(clamp(16px, 2.6vw, 22px) + 46px)' }}>{extra}</div>
      )}
      {open && (
        <div id={`${id}-body`} style={{ padding: '0 clamp(16px, 2.6vw, 22px) clamp(16px, 2.6vw, 22px)' }}>
          <div style={{ borderTop: `1px solid ${HAIRLINE}`, paddingTop: 16 }}>{children}</div>
          {footer && <div className="mt-5 flex flex-wrap items-center justify-end gap-3">{footer}</div>}
        </div>
      )}
    </section>
  );
}

/** Tucked-away options: closed by default unless they are already in use. */
function Advanced({ label, defaultOpen, children }: { label: string; defaultOpen: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 rounded"
        style={{ ...TEXT_LINK, fontSize: 14.5 }}
      >
        <ChevronDown size={16} strokeWidth={2.5} aria-hidden style={{ transform: open ? 'rotate(180deg)' : 'rotate(-90deg)', transition: 'transform 200ms ease' }} />
        {label}
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  );
}

function TimelineMsg({ msg }: { msg: { kind: 'info' | 'error'; text: string } | null }) {
  if (!msg) return null;
  return msg.kind === 'info'
    ? <TimelineNotice text={msg.text} />
    : <div className="mt-2"><Notice tone="danger" role="alert">{msg.text}</Notice></div>;
}

// ── The editor ───────────────────────────────────────────────────────────────

export interface RoleSetupProps {
  conference: Conference;
  roles: RoleSetupConfig[];
  role: string;
  config: RoleSetupConfig | undefined;
  now: number;
  appliedCount: number | null;
  /** Bumps whenever stored values must replace what an uncontrolled field shows. */
  configVersion: number;
  saveState: 'idle' | 'saving' | 'saved';
  timelineCtx: TimelineContext;
  timelineMsg: { where: 'window' | 'phases'; kind: 'info' | 'error'; text: string } | null;
  initialStep: string | null;
  linkCopied: boolean;
  onHome: () => void;
  onPickRole: (role: string) => void;
  onSave: (updates: Partial<RoleSetupConfig>) => void;
  onSaveTimeline: (change: Partial<TimelineInput>, where: 'window' | 'phases') => void;
  onUpdatePhase: (phases: FeePhase[], idx: number, patch: Partial<FeePhase>) => void;
  onCopyPhases: () => void;
  onCopyLink: () => void;
  /** Write the form's pending questions now (leaving the form step). */
  onLeaveForm: () => void;
  /** The copy-form menu, the refusal line and the question builder. */
  formSlot: ReactNode;
  /** The after-submitting message fields (their state lives in the page). */
  afterSlot: ReactNode;
}

export function RoleSetup(props: RoleSetupProps) {
  const { conference: c, roles, role, config, now, configVersion, timelineCtx, timelineMsg } = props;
  const currency = c.fee_currency || 'USD';
  const priced = roleHasPrice(role);
  const free = config ? roleIsFree(config) : true;
  const gate = paymentGateBlocks(c);

  const visible: StepKey[] = STEP_KEYS.filter(k => (k !== 'price' || priced) && (k !== 'paying' || (priced && !free)));

  // Which steps still want an answer: soft hints, never a block.
  const windowBackwards = !!(config?.applications_open_at && config?.applications_close_at
    && new Date(config.applications_close_at).getTime() <= new Date(config.applications_open_at).getTime());
  const invalidPhase = (config?.fee_phases ?? []).some(p => !p.start_date || !p.end_date);
  const todo: Partial<Record<StepKey, boolean>> = {
    when: windowBackwards,
    price: invalidPhase,
  };

  const startStep = STEP_KEYS.includes(props.initialStep as StepKey) ? props.initialStep as StepKey : null;
  const [openStep, setOpenStep] = useState<StepKey | null>(startStep);

  // Deep link (?step=) scrolls its card into view once.
  useEffect(() => {
    if (!startStep) return;
    const t = window.setTimeout(() => document.getElementById(`step-${startStep}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
    return () => window.clearTimeout(t);
  }, [startStep]);

  // Leaving the form step writes its pending questions (the page's flush).
  const leaveForm = useRef(props.onLeaveForm);
  useEffect(() => { leaveForm.current = props.onLeaveForm; });
  useEffect(() => {
    if (openStep !== 'form') leaveForm.current();
  }, [openStep]);

  function goTo(step: StepKey | null) {
    setOpenStep(step);
    if (step) {
      window.setTimeout(() => document.getElementById(`step-${step}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30);
    }
  }
  function nextOf(step: StepKey): StepKey | null {
    const i = visible.indexOf(step);
    return visible[i + 1] ?? null;
  }
  function footerFor(step: StepKey): ReactNode {
    const next = nextOf(step);
    return next ? (
      <button type="button" onClick={() => goTo(next)} className="inline-flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-[0.98] transition-transform" style={PRIMARY_BTN}>
        Next: {STEP_TITLE[next].replace(/\?$/, '').toLowerCase().replace(/^\w/, ch => ch.toUpperCase())}
      </button>
    ) : null;
  }

  const plural = rolePlural(role);
  const st = windowState(config, now);
  const mark = STATE_MARK[st];
  const enabled = config?.is_enabled ?? false;
  const blocked = gate && !enabled;

  const saveWord = props.saveState === 'saving' ? 'Saving' : props.saveState === 'saved' ? 'Saved' : 'Changes save by themselves';

  const statusLine = st === 'open'
    ? (config?.applications_close_at ? `Taking applications until ${dateAndTime(config.applications_close_at, now)}.` : 'Taking applications, with no closing date.')
    : st === 'scheduled' ? `Switched on. Opens ${dateAndTime(config?.applications_open_at, now)}.`
    : st === 'closed' ? `Switched on, but the window closed ${dateAndTime(config?.applications_close_at, now)}. Move the closing date to open it again.`
    : 'Switched off. Nobody can apply for this role.';

  const phases = config?.fee_phases ?? [];
  const active = activeFeePhase(phases);

  return (
    <div className="gvr-root">
      <style>{CSS}</style>

      <button type="button" onClick={props.onHome} className="inline-flex items-center gap-1.5 mb-4 focus:outline-none focus-visible:ring-2 rounded" style={{ ...TEXT_LINK, fontSize: 14.5 }}>
        <ArrowLeft size={15} strokeWidth={2.5} aria-hidden />
        All settings
      </button>

      {/* Role picker: round emoji, name, and the state as an icon. */}
      <nav aria-label="Roles" className="gvr-roles mb-5">
        {ROLE_ORDER.map(r => {
          const on = r === role;
          const s = STATE_MARK[windowState(roles.find(x => x.role === r), now)];
          return (
            <button
              key={r}
              type="button"
              aria-current={on ? 'page' : undefined}
              onClick={() => { if (!on) props.onPickRole(r); }}
              className="inline-flex items-center gap-2 flex-shrink-0 focus:outline-none focus-visible:ring-2"
              style={{
                padding: '7px 13px 7px 8px', borderRadius: 999, whiteSpace: 'nowrap', cursor: 'pointer',
                fontFamily: F, fontSize: 14, fontWeight: 600,
                backgroundColor: on ? FOREST : '#FFFFFF', color: on ? '#FFFFFF' : INK,
                border: on ? '1px solid transparent' : '1px solid rgba(27,56,40,0.10)',
                boxShadow: on ? '0 4px 12px rgba(27,56,40,0.22)' : '0 1px 2px rgba(27,56,40,0.05)',
              }}
            >
              <Emoji3D name={ROLE_EMOJI[r] ?? 'Busts in silhouette'} size={20} fallback={Building2} fallbackColor={on ? GOLD : FOREST} />
              {rolePlural(r)}
              <s.icon size={15} strokeWidth={2.4} aria-label={s.word} style={{ color: on ? GOLD : s.color }} />
            </button>
          );
        })}
      </nav>

      <header className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2" style={{ fontFamily: F, fontSize: 'clamp(26px, 3vw, 36px)', fontWeight: 800, color: INK, lineHeight: 1.1, letterSpacing: '-0.015em', overflowWrap: 'anywhere' }}>
            <span>{roleTitle(role)} <GoldWord>Applications</GoldWord></span>
            {ROLE_BLURB[role] && <InfoHint label={`What a ${roleTitle(role)} is`} text={ROLE_BLURB[role]} size={18} />}
          </h1>
          <p className="mt-1.5" style={{ fontFamily: F, fontSize: 14.5, color: INK_SOFT }}>
            {props.appliedCount !== null && (
              <><b style={{ fontSize: 18, fontWeight: 700, color: INK, fontVariantNumeric: 'tabular-nums' }}>{props.appliedCount}</b> applied · </>
            )}
            <span role="status" aria-live="polite">{saveWord}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button type="button" onClick={props.onCopyLink} className="inline-flex items-center gap-1.5 focus:outline-none focus-visible:ring-2" style={SECOND_BTN}>
            {props.linkCopied ? <Check size={15} strokeWidth={3} aria-hidden /> : <Copy size={15} strokeWidth={2.3} aria-hidden />}
            {props.linkCopied ? 'Link copied' : 'Copy application link'}
          </button>
          <a href={`/conferences/${c.slug}/apply?role=${role}&preview=1`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 focus:outline-none focus-visible:ring-2" style={SECOND_BTN}>
            <Eye size={15} strokeWidth={2.3} aria-hidden />
            Preview the form
          </a>
        </div>
      </header>

      {c.payment_gate_exempt && !conferencePaymentsReady(c) && (
        <div className="mb-4">
          <Notice>
            <b>Applicants cannot pay you yet.</b> Your applications are open, but nothing gives them a way to pay.{' '}
            <Link href={`/manage/${c.slug}/financials?open=payment`} style={{ ...TEXT_LINK, color: '#6B4F12' }}>Set up payments</Link>
          </Notice>
        </div>
      )}

      {!config ? (
        <div aria-busy="true" style={{ ...CARD, padding: 24 }}>
          <span className="block rounded-lg animate-pulse" style={{ height: 22, width: '60%', backgroundColor: '#F1ECE0' }} />
        </div>
      ) : (
        <div className="flex flex-col gap-3.5">
          {/* 1. The switch. Always visible: the one answer that matters most. */}
          <section style={{ ...CARD, padding: 'clamp(16px, 2.6vw, 22px)' }}>
            <div className="flex items-start gap-3.5">
              <span aria-hidden className="flex items-center justify-center flex-shrink-0" style={{ width: 32, height: 32, borderRadius: '50%', marginTop: 1, background: 'linear-gradient(140deg, #1B3828, #2A5A3C)', color: GOLD, fontFamily: F, fontSize: 14, fontWeight: 700 }}>
                1
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span style={{ fontFamily: F, fontSize: 18, fontWeight: 700, color: INK, lineHeight: 1.25 }}>Taking Applications</span>
                  <span className="inline-flex items-center gap-1.5" style={{ fontFamily: F, fontSize: 14, fontWeight: 600, color: mark.color }}>
                    <mark.icon size={16} strokeWidth={2.4} aria-hidden />
                    {mark.word}
                  </span>
                </p>
                <p id="role-switch-line" className="mt-1" style={{ fontFamily: F, fontSize: 14.5, color: INK_SOFT, lineHeight: 1.45, overflowWrap: 'anywhere' }}>
                  {blocked
                    ? <>Set up payments before you open this role. Even a free conference needs a way to pay on file. You can still set everything else up now.{' '}
                      <Link href={`/manage/${c.slug}/financials?open=payment`} style={{ ...TEXT_LINK, fontSize: 14.5 }}>Set up payments</Link></>
                    : statusLine}
                </p>
              </div>
              <Switch
                size="lg"
                label={`${plural} taking applications`}
                checked={enabled}
                disabled={blocked}
                describedBy="role-switch-line"
                onChange={(v) => props.onSave({ is_enabled: v })}
              />
            </div>
          </section>

          {/* Every card below re-mounts its fields when stored values replace
              what an uncontrolled field shows (a refused timeline edit). */}
          {visible.map((key, i) => {
            const n = i + 2;
            const open = openStep === key;
            const toggle = () => goTo(open ? null : key);
            const id = `step-${key}`;
            if (key === 'when') return (
              <StepCard
                key={key} id={id} n={n} title={STEP_TITLE.when} answer={windowAnswer(config, now)} todo={todo.when}
                open={open} onToggle={toggle} footer={footerFor(key)}
                extra={<RoleTimelineBar config={config} now={now} fallbackCurrency={currency} timeZone={timelineCtx.timeZone} compact />}
              >
                <div key={configVersion}>
                  <div className="gvr-two">
                    <div>
                      <FieldLabel>
                        Opens
                        <InfoHint label="About the opening time" text="The moment this role starts taking applications. Before it, the application link says the window has not opened yet and shows when it will. It opens by itself. Leave it empty to open the instant you switch the role on." />
                      </FieldLabel>
                      <DatePicker
                        withTime
                        clearable
                        value={toDatetimeLocal(config.applications_open_at)}
                        onChange={(v) => props.onSaveTimeline({ applications_open_at: fromDatetimeLocal(v) }, 'window')}
                        placeholder="Opens as soon as it is switched on"
                        zoneNote={`Times are in ${localZoneLabel()}.`}
                      />
                    </div>
                    <div>
                      <FieldLabel>
                        Closes
                        <InfoHint label="About the closing time" text="The moment this role stops taking new applications. Applications already sent are kept. Leave it empty to keep it open until you switch the role off yourself." />
                      </FieldLabel>
                      <DatePicker
                        withTime
                        clearable
                        value={toDatetimeLocal(config.applications_close_at)}
                        onChange={(v) => props.onSaveTimeline({ applications_close_at: fromDatetimeLocal(v) }, 'window')}
                        min={toDatetimeLocal(config.applications_open_at).slice(0, 10) || undefined}
                        placeholder="Stays open until switched off"
                        zoneNote={`Times are in ${localZoneLabel()}.`}
                      />
                    </div>
                  </div>
                  <div className="mt-3">
                    {windowBackwards ? (
                      <Notice tone="danger" role="alert">This window closes at or before it opens, so nobody can apply. Move one of the two.</Notice>
                    ) : (
                      <p suppressHydrationWarning style={{ fontFamily: F, fontSize: 13, color: INK_SOFT }}>
                        Times are in {localZoneLabel()}. Applicants see them in their own time zone.
                      </p>
                    )}
                    {phases.some(p => p.start_date && p.end_date) && (
                      <p className="mt-1" style={{ fontFamily: F, fontSize: 13, color: INK_SOFT, lineHeight: 1.5 }}>
                        Your prices have dates, so applications open when the first price starts and close when the last one ends. Moving one moves the other.
                      </p>
                    )}
                    {timelineMsg?.where === 'window' && <TimelineMsg msg={timelineMsg} />}
                    <TimelineWarning config={config} roleLabel={role} ctx={timelineCtx} onFix={(patch) => props.onSaveTimeline(patch, 'window')} />
                  </div>
                  <div className="mt-5 rounded-2xl p-4" style={{ backgroundColor: '#FBF8F1' }}>
                    <RoleTimelineBar config={config} now={now} fallbackCurrency={currency} timeZone={timelineCtx.timeZone} />
                  </div>
                </div>
              </StepCard>
            );

            if (key === 'price') {
              const hasInvalid = phases.some(p => !p.start_date || !p.end_date);
              return (
                <StepCard
                  key={key} id={id} n={n} title={STEP_TITLE.price} answer={priceAnswer(config, currency, now)} todo={todo.price}
                  open={open} onToggle={toggle} footer={footerFor(key)}
                >
                  <div key={configVersion}>
                    <FieldLabel>Price</FieldLabel>
                    <div className="flex gap-2 flex-wrap" style={{ maxWidth: 420 }}>
                      <CurrencyPicker
                        value={config.fee_currency}
                        onChange={(code) => props.onSave({ fee_currency: code })}
                        ariaLabel={`${roleTitle(role)} fee currency`}
                        variant="bordered"
                        style={{ width: 118, flexShrink: 0 }}
                      />
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        placeholder="0"
                        aria-label={`${roleTitle(role)} price`}
                        defaultValue={config.fee_amount}
                        onBlur={(e) => props.onSave({ fee_amount: parseFloat(e.target.value) || 0 })}
                        style={{ ...INPUT, flex: 1, width: 'auto', minWidth: 120, fontVariantNumeric: 'tabular-nums' }}
                      />
                    </div>
                    <p className="mt-1.5" style={{ fontFamily: F, fontSize: 13, color: INK_SOFT }}>
                      Put 0 if it is free.{phases.length > 0 ? ' This price applies on any day none of the prices below covers.' : ''}
                    </p>

                    <Advanced label="Change the price on certain dates" defaultOpen={phases.length > 0}>
                      <p className="mb-3" style={{ fontFamily: F, fontSize: 13.5, color: INK_SOFT, lineHeight: 1.5 }}>
                        For example an early bird price, then a standard price. Each price starts the day after the one before ends, and both dates count.
                      </p>
                      <div className="flex flex-col gap-2.5">
                        {phases.map((phase, pi) => {
                          const isActive = active !== null && phase === active;
                          const invalid = !phase.start_date || !phase.end_date;
                          return (
                            <div key={`${pi}-${phases.length}-${configVersion}`}>
                              <div
                                className="gvr-phase rounded-xl px-3 py-2.5"
                                style={{
                                  backgroundColor: isActive ? 'rgba(238,217,138,0.22)' : '#FBF8F1',
                                  border: invalid ? '1.5px solid rgba(139,32,32,0.45)' : isActive ? '1.5px solid rgba(182,135,31,0.45)' : '1px solid #EFE9DC',
                                }}
                              >
                                <div className="gvr-phase-name flex items-center gap-2 min-w-0">
                                  <input
                                    type="text"
                                    placeholder="Name, e.g. Early bird"
                                    aria-label="Price name"
                                    defaultValue={phase.label}
                                    onBlur={(e) => { if (e.target.value.trim() !== phase.label) props.onUpdatePhase(phases, pi, { label: e.target.value.trim() }); }}
                                    style={{ ...INPUT, padding: '8px 11px', fontSize: 14 }}
                                  />
                                  {isActive && (
                                    <span className="inline-flex items-center gap-1 flex-shrink-0" style={{ fontFamily: F, fontSize: 13, fontWeight: 700, color: AMBER }}>
                                      <Star size={14} strokeWidth={2.4} aria-hidden /> Today
                                    </span>
                                  )}
                                </div>
                                <DatePicker
                                  value={phase.start_date}
                                  max={phase.end_date || undefined}
                                  placeholder="From"
                                  onChange={(iso) => { if (iso !== phase.start_date) props.onUpdatePhase(phases, pi, { start_date: iso }); }}
                                />
                                <DatePicker
                                  value={phase.end_date}
                                  min={phase.start_date || undefined}
                                  placeholder="To"
                                  onChange={(iso) => { if (iso !== phase.end_date) props.onUpdatePhase(phases, pi, { end_date: iso }); }}
                                />
                                <input
                                  type="number"
                                  min={0}
                                  step={0.01}
                                  aria-label="Price amount"
                                  placeholder="0"
                                  defaultValue={phase.amount}
                                  onBlur={(e) => {
                                    const next = parseFloat(e.target.value) || 0;
                                    if (next !== phase.amount) props.onUpdatePhase(phases, pi, { amount: next });
                                  }}
                                  style={{ ...INPUT, padding: '8px 10px', fontSize: 14, fontVariantNumeric: 'tabular-nums' }}
                                />
                                <button
                                  type="button"
                                  aria-label={`Remove ${phase.label || 'this price'}`}
                                  onClick={() => props.onSaveTimeline({ fee_phases: phases.filter((_, i2) => i2 !== pi) }, 'phases')}
                                  className="flex items-center justify-center justify-self-end focus:outline-none focus-visible:ring-2 rounded-full"
                                  style={{ width: 32, height: 32, background: 'none', border: 'none', color: DANGER, cursor: 'pointer' }}
                                >
                                  <X size={17} strokeWidth={2.6} />
                                </button>
                              </div>
                              {invalid && (
                                <p className="mt-1" style={{ fontFamily: F, fontSize: 13, color: DANGER }}>This price needs both dates before it counts.</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
                        <button
                          type="button"
                          disabled={hasInvalid}
                          title={hasInvalid ? 'Give the last price its dates first' : undefined}
                          onClick={() => props.onSaveTimeline({ fee_phases: [...phases, { label: `Price ${phases.length + 1}`, start_date: '', end_date: '', amount: config.fee_amount }] }, 'phases')}
                          className="inline-flex items-center gap-1.5 focus:outline-none focus-visible:ring-2"
                          style={{ ...SECOND_BTN, opacity: hasInvalid ? 0.5 : 1, cursor: hasInvalid ? 'not-allowed' : 'pointer' }}
                        >
                          <Plus size={15} strokeWidth={2.6} aria-hidden />
                          Add a price
                        </button>
                        {phases.length > 0 && (
                          <button type="button" onClick={props.onCopyPhases} className="inline-flex items-center gap-1.5" style={{ ...TEXT_LINK, fontSize: 14 }}>
                            <Copy size={14} strokeWidth={2.4} aria-hidden />
                            Use these prices for another role
                          </button>
                        )}
                      </div>
                      {timelineMsg?.where === 'phases' && <TimelineMsg msg={timelineMsg} />}
                      {phases.length > 0 && (
                        <TimelineWarning config={config} roleLabel={role} ctx={timelineCtx} onFix={(patch) => props.onSaveTimeline(patch, 'phases')} />
                      )}
                    </Advanced>

                    {phases.some(p => p.start_date && p.end_date) && (
                      <div className="mt-5 rounded-2xl p-4" style={{ backgroundColor: '#FBF8F1' }}>
                        <RoleTimelineBar config={config} now={now} fallbackCurrency={currency} timeZone={timelineCtx.timeZone} />
                      </div>
                    )}
                  </div>
                </StepCard>
              );
            }

            if (key === 'paying') return (
              <StepCard key={key} id={id} n={n} title={STEP_TITLE.paying} answer={payingAnswer(config)} open={open} onToggle={toggle} footer={footerFor(key)}>
                <ToggleRow
                  title="Only after you accept them"
                  desc="On: the pay button appears once you accept someone, so you only charge people you took. Off: they can pay as soon as they apply."
                  checked={config.payment_timing === 'after_acceptance'}
                  onChange={(v) => props.onSave({ payment_timing: v ? 'after_acceptance' : 'anytime' })}
                />
                <ToggleRow
                  title="Hide their dashboard until they pay"
                  desc="Accepted people who have not paid see only their overview and payment. Waived and sponsored people always see everything."
                  checked={config.hide_dashboard_until_paid === true}
                  onChange={(v) => props.onSave({ hide_dashboard_until_paid: v })}
                />
              </StepCard>
            );

            if (key === 'entry') return (
              <StepCard key={key} id={id} n={n} title={STEP_TITLE.entry} answer={entryAnswer(config)} open={open} onToggle={toggle} footer={footerFor(key)}>
                <div key={configVersion}>
                  <ToggleRow
                    title="Accept everyone straight away"
                    desc="On: people are accepted the moment they apply, right for observers and advisors. Off: you review each application."
                    checked={config.auto_accept === true}
                    onChange={(v) => props.onSave({ auto_accept: v })}
                  />
                  <div className="py-3.5" style={{ borderTop: `1px solid ${HAIRLINE}` }}>
                    <FieldLabel htmlFor="role-max-accepted">
                      Most people you will accept
                      <InfoHint label="About the most you will accept" text="A ceiling on acceptances, not on applications. People can keep applying past it; you simply cannot accept more than this many. Leave it empty for no limit." />
                    </FieldLabel>
                    <input
                      id="role-max-accepted"
                      type="number"
                      min={1}
                      placeholder="No limit"
                      defaultValue={config.max_accepted ?? ''}
                      onBlur={(e) => props.onSave({ max_accepted: e.target.value ? parseInt(e.target.value) : null })}
                      style={{ ...INPUT, maxWidth: 200, fontVariantNumeric: 'tabular-nums' }}
                    />
                  </div>
                  <ToggleRow
                    title="Let turned-down applicants try again"
                    desc="They can reopen their form, change their answers and send it back for another look."
                    checked={config.allow_resubmission ?? false}
                    onChange={(v) => props.onSave({ allow_resubmission: v })}
                  />
                </div>
              </StepCard>
            );

            if (key === 'form') return (
              <StepCard key={key} id={id} n={n} title={STEP_TITLE.form} answer={formAnswer(config)} open={open} onToggle={toggle} footer={footerFor(key)}>
                <div key={configVersion}>
                  {roleCanHavePreference(role) && (role === 'chair' ? (
                    <ToggleRow
                      title="Ask which committee they want"
                      desc="Chairs rank the committees they would like to chair, and you assign from their ranking."
                      checked={config.preference_mode === 'committees_only'}
                      onChange={(v) => props.onSave({ preference_mode: v ? 'committees_only' : 'none' })}
                    />
                  ) : (
                    <div className="pb-4">
                      <FieldLabel>
                        What do they rank?
                        <InfoHint label="About preferences" text="What applicants rank on the form, and so what your allocation has to work with. Committee and country pairs give the fullest picture but make the longest form. Nothing skips the step and leaves every seat for you to assign by hand." />
                      </FieldLabel>
                      <div role="radiogroup" aria-label="What do they rank?" className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 170px), 1fr))' }}>
                        {PREF_MODE_OPTIONS.map(opt => {
                          const on = (config.preference_mode ?? 'none') === opt.value;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              role="radio"
                              aria-checked={on}
                              onClick={() => props.onSave({ preference_mode: opt.value })}
                              className="flex items-center gap-2.5 text-left focus:outline-none focus-visible:ring-2"
                              style={{
                                padding: '11px 13px', borderRadius: 12, cursor: 'pointer',
                                fontFamily: F, fontSize: 14, fontWeight: 600, lineHeight: 1.25,
                                backgroundColor: on ? 'rgba(27,56,40,0.06)' : '#FFFFFF',
                                color: INK,
                                border: on ? `2px solid ${FOREST}` : '1.5px solid #DDD4C0',
                              }}
                            >
                              <span className="inline-flex items-center flex-shrink-0" style={{ gap: 2 }}>
                                {opt.value !== 'countries_only' && opt.value !== 'none' && <Emoji3D name="Classical building" size={20} fallback={Building2} fallbackColor={FOREST} />}
                                {opt.value !== 'committees_only' && opt.value !== 'none' && <Emoji3D name="Crossed flags" size={20} fallback={Globe} fallbackColor={FOREST} />}
                                {opt.value === 'none' && <Emoji3D name="Cross mark" size={20} fallback={X} fallbackColor={FOREST} />}
                              </span>
                              <span className="min-w-0" style={{ overflowWrap: 'anywhere' }}>{opt.label}</span>
                            </button>
                          );
                        })}
                      </div>
                      <p className="mt-1.5" style={{ fontFamily: F, fontSize: 13, color: INK_SOFT }}>
                        {PREF_MODE_OPTIONS.find(o => o.value === (config.preference_mode ?? 'none'))?.desc}
                      </p>
                    </div>
                  ))}
                  {/* Chair and secretariat only: the database CHECK refuses it for
                      every other role, so no control exists for them at all. */}
                  {(role === 'chair' || role === 'secretariat') && (
                    <ToggleRow
                      title="Ask for their MUN experience"
                      desc="They list the conferences they have chaired or staffed, and can bring them in from their Gavelling MUN CV."
                      checked={config.collect_mun_experience ?? false}
                      onChange={(v) => props.onSave({ collect_mun_experience: v })}
                    />
                  )}
                  <div className={roleCanHavePreference(role) || role === 'secretariat' ? 'pt-4' : ''} style={roleCanHavePreference(role) || role === 'secretariat' ? { borderTop: `1px solid ${HAIRLINE}` } : undefined}>
                    <p className="mb-2" style={{ fontFamily: F, fontSize: 15, fontWeight: 600, color: INK }}>Your own questions</p>
                    {props.formSlot}
                  </div>
                </div>
              </StepCard>
            );

            if (key === 'after') return (
              <StepCard key={key} id={id} n={n} title={STEP_TITLE.after} answer={afterAnswer(config)} open={open} onToggle={toggle} footer={footerFor(key)}>
                <p className="mb-3" style={{ fontFamily: F, fontSize: 13.5, color: INK_SOFT, lineHeight: 1.5 }}>
                  A short message in the corner of the confirmation screen for about twenty seconds. Good for what to do next, like joining a group chat. It is not saved anywhere they can go back to.
                </p>
                {props.afterSlot}
              </StepCard>
            );

            // Review: every answer, with a way back to it.
            const rows: { k: StepKey; label: string; answer: string }[] = visible
              .filter(k => k !== 'review')
              .map(k => ({
                k,
                label: STEP_TITLE[k].replace(/\?$/, ''),
                answer: k === 'when' ? windowAnswer(config, now)
                  : k === 'price' ? priceAnswer(config, currency, now)
                  : k === 'paying' ? payingAnswer(config)
                  : k === 'entry' ? entryAnswer(config)
                  : k === 'form' ? formAnswer(config)
                  : afterAnswer(config),
              }));
            return (
              <StepCard
                key={key} id={id} n={n} title={STEP_TITLE.review}
                answer={enabled ? `${plural} can apply. Open this to see every answer in one place.` : `${plural} cannot apply yet. Open this to see every answer in one place.`}
                open={open} onToggle={toggle}
                footer={
                  <a href={`/conferences/${c.slug}/apply?role=${role}&preview=1`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 focus:outline-none focus-visible:ring-2" style={PRIMARY_BTN}>
                    <Eye size={15} strokeWidth={2.3} aria-hidden />
                    Preview the form
                  </a>
                }
              >
                <dl className="flex flex-col">
                  <div className="gvr-review py-3" style={{ borderBottom: `1px solid ${HAIRLINE}` }}>
                    <dt style={{ fontFamily: F, fontSize: 13, fontWeight: 600, color: INK_SOFT }}>Taking applications</dt>
                    <span />
                    <dd style={{ fontFamily: F, fontSize: 15, color: INK, overflowWrap: 'anywhere' }}>
                      {blocked ? <span className="inline-flex items-center gap-1.5"><Lock size={14} aria-hidden /> Waiting for payments to be set up</span> : statusLine}
                    </dd>
                    <span />
                  </div>
                  {rows.map(r => (
                    <div key={r.k} className="gvr-review py-3" style={{ borderBottom: `1px solid ${HAIRLINE}` }}>
                      <dt style={{ fontFamily: F, fontSize: 13, fontWeight: 600, color: INK_SOFT }}>{r.label}</dt>
                      <span />
                      <dd style={{ fontFamily: F, fontSize: 15, color: INK, overflowWrap: 'anywhere' }}>{r.answer}</dd>
                      <button type="button" onClick={() => goTo(r.k)} aria-label={`Change: ${r.label}`} style={{ ...TEXT_LINK, fontSize: 14, alignSelf: 'start' }}>Change</button>
                    </div>
                  ))}
                </dl>
              </StepCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
