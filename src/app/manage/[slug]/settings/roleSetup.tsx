'use client';

/**
 * One role's applications, as ONE pop-up form (Oct 2026, second pass).
 *
 * Owner: "let's have applications in settings in pop ups rather than
 * individual pages ... the fact that i have to open them is very annoying ...
 * they are used to google forms set-up". So the step cards that opened one at
 * a time are gone. Editing a role opens a large sheet over the Settings front
 * page (full screen on a phone) with everything visible on one scrolling form,
 * Google Forms style: a title card, then plain white section cards.
 *
 *   header             the role, how many applied, the save state, its
 *                      Taking applications switch and the X
 *   title card         what the switch means right now, Copy application link,
 *                      Preview the form
 *   When               opens / closes, the timeline bar
 *   Price              one price; "Prices by date" and "Use this price for
 *                      another role" are one small link each (priced roles only)
 *   Paying             payment timing and the dashboard lock (paid roles only)
 *   Who Gets In        auto-accept, the most you accept, try again
 *   Questions          preferences, MUN experience, the question builder
 *   After They Apply   the message shown once after submitting
 *
 * The URL stays ?tab=applications&role=<role> (and ?step=<section> scrolls to
 * a section), so every old deep link opens this sheet. Escape and the X close
 * it, Tab stays inside it, focus goes back to whatever opened it.
 *
 * Presentation only: every field, every validation (roleTimeline.ts through the
 * page's saveTimeline, CONSTRAINT_MESSAGES), every autosave and every write is
 * the settings page's own, passed in unchanged.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  Check, Copy, Eye, ChevronDown, Plus, Star, X, Building2, Globe,
  CheckCircle2, Clock, MinusCircle, XCircle, CalendarDays, Wallet, CreditCard,
  UserCheck, ListChecks, PartyPopper, UsersRound, type LucideIcon,
} from 'lucide-react';
import Portal from '@/components/Portal';
import { Emoji3D } from '@/components/neu';
import { GoldWord } from '@/components/BrandHeading';
import { DatePicker } from '@/components/DatePicker';
import { CurrencyPicker } from '@/components/CurrencyPicker';
import { useScrollLock } from '@/hooks/useScrollLock';
import { activeFeePhase, type FeePhase } from '@/lib/finance';
import { conferencePaymentsReady, paymentGateBlocks } from '@/lib/payments';
import type { TimelineContext, TimelineInput } from '@/lib/roleTimeline';
import type { Conference } from '@/app/manage/[slug]/layout';
import { ROLE_EMOJI, ROLE_BLURB, InfoHint } from './applicationsUi';
import { TimelineNotice, TimelineWarning } from './timelineUi';
import { RoleTimelineBar } from './roleTimelineBar';
import {
  F, INK, INK_SOFT, FOREST, AMBER, DANGER, HAIRLINE, PRIMARY_BTN, SECOND_BTN, TEXT_LINK, INPUT,
  Switch, ToggleRow, FieldLabel, Notice, PREF_MODE_OPTIONS,
  roleIsFree, roleHasPrice, roleCanHavePreference, rolePlural, roleTitle, windowState, dateAndTime,
  toDatetimeLocal, fromDatetimeLocal, localZoneLabel, type RoleSetupConfig, type WindowState,
} from './panelKit';

/** The ?step= values. Old links used all seven; 'review' now means the top. */
export type StepKey = 'when' | 'price' | 'paying' | 'entry' | 'form' | 'after' | 'review';
export const STEP_KEYS: readonly StepKey[] = ['when', 'price', 'paying', 'entry', 'form', 'after', 'review'];

const STATE_MARK: Record<WindowState, { icon: LucideIcon; word: string; color: string }> = {
  open: { icon: CheckCircle2, word: 'Open', color: FOREST },
  scheduled: { icon: Clock, word: 'Opens later', color: AMBER },
  closed: { icon: XCircle, word: 'Closed', color: DANGER },
  off: { icon: MinusCircle, word: 'Off', color: INK_SOFT },
};

const SHEET_BG = '#F3EEE2';

const CSS = `
.gvs-backdrop { position: fixed; inset: 0; z-index: 50; display: flex; align-items: center; justify-content: center;
  background: rgba(27,20,16,0.42); padding: 24px; }
.gvs-panel { position: relative; display: flex; flex-direction: column; width: min(920px, 100%); height: min(100%, 980px);
  background: ${SHEET_BG}; border-radius: 24px; overflow: hidden; box-shadow: 0 30px 90px rgba(27,20,16,0.35); }
@media (max-width: 720px) {
  .gvs-backdrop { padding: 0; }
  .gvs-panel { width: 100%; height: 100%; border-radius: 0;
    padding-top: env(safe-area-inset-top, 0px); padding-bottom: env(safe-area-inset-bottom, 0px); }
}
.gvs-body { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; -webkit-overflow-scrolling: touch;
  container-type: inline-size; }
.gvs-col { width: 100%; max-width: 760px; margin: 0 auto; padding: 20px clamp(12px, 3vw, 24px) 40px;
  display: flex; flex-direction: column; gap: 14px; }
.gvs-two { display: grid; gap: 14px; grid-template-columns: minmax(0, 1fr); }
@container (min-width: 560px) { .gvs-two { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
.gvs-rows > :first-child { border-top: none !important; padding-top: 4px !important; }
/* A price row: the name on its own line (never squeezed), then from, to,
   amount and remove. One field per line on a phone, the dates side by side
   from 480px, dates, amount and remove on one line from 600px. */
.gvs-phase { display: grid; gap: 8px; grid-template-columns: minmax(0, 1fr) 32px; align-items: center; }
.gvs-phase > :nth-child(-n+3) { grid-column: 1 / -1; }
@container (min-width: 480px) {
  .gvs-phase { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
  .gvs-phase > :nth-child(-n+3) { grid-column: auto; }
  .gvs-phase > .gvs-phase-name { grid-column: 1 / -1; }
}
@container (min-width: 600px) {
  .gvs-phase { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 112px 32px; }
}
.gvs-head-word { display: none; }
@media (min-width: 560px) { .gvs-head-word { display: inline; } }
`;

// ── Pieces ───────────────────────────────────────────────────────────────────

function Section({ id, icon: Icon, title, hint, children }: {
  id: string;
  icon: LucideIcon;
  title: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-h`}
      style={{
        backgroundColor: '#FFFFFF', borderRadius: 16, border: '1px solid rgba(27,56,40,0.08)',
        boxShadow: '0 1px 2px rgba(27,56,40,0.05), 0 6px 18px rgba(27,56,40,0.06)',
        padding: 'clamp(16px, 3vw, 22px)', scrollMarginTop: 16,
      }}
    >
      <h3 id={`${id}-h`} className="flex items-center gap-2.5 mb-3" style={{ fontFamily: F, fontSize: 19, fontWeight: 700, color: INK, lineHeight: 1.25 }}>
        <span aria-hidden className="flex items-center justify-center flex-shrink-0" style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: 'rgba(238,217,138,0.38)' }}>
          <Icon size={17} strokeWidth={2.2} color={FOREST} />
        </span>
        <span style={{ overflowWrap: 'anywhere' }}>{title}</span>
        {hint}
      </h3>
      {children}
    </section>
  );
}

/** One small link that shows tucked-away options (open already when in use). */
function MoreLink({ label, defaultOpen, children }: { label: string; defaultOpen: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 rounded"
        style={{ ...TEXT_LINK, fontSize: 14 }}
      >
        <ChevronDown size={15} strokeWidth={2.5} aria-hidden style={{ transform: open ? 'rotate(180deg)' : 'rotate(-90deg)', transition: 'transform 200ms ease' }} />
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

function Hint({ children }: { children: ReactNode }) {
  return <p className="mt-1.5" style={{ fontFamily: F, fontSize: 13, color: INK_SOFT, lineHeight: 1.5, overflowWrap: 'anywhere' }}>{children}</p>;
}

/** Nodes that can sit at the end of <body> without being a layer over us
 *  (browser and dev tooling inject iframes and custom elements there). */
const NOT_A_LAYER = new Set(['NEXT-ROUTE-ANNOUNCER', 'NEXTJS-PORTAL', 'SCRIPT', 'STYLE', 'TEMPLATE', 'IFRAME']);

// ── The sheet ────────────────────────────────────────────────────────────────

export interface RoleSheetProps {
  conference: Conference;
  role: string;
  config: RoleSetupConfig | undefined;
  now: number;
  appliedCount: number | null;
  /** Bumps whenever stored values must replace what an uncontrolled field shows. */
  configVersion: number;
  saveState: 'idle' | 'saving' | 'saved';
  timelineCtx: TimelineContext;
  timelineMsg: { where: 'window' | 'phases'; kind: 'info' | 'error'; text: string } | null;
  /** ?step=, scrolled into view once on open. */
  initialStep: string | null;
  linkCopied: boolean;
  onClose: () => void;
  onSave: (updates: Partial<RoleSetupConfig>) => void;
  onSaveTimeline: (change: Partial<TimelineInput>, where: 'window' | 'phases') => void;
  onUpdatePhase: (phases: FeePhase[], idx: number, patch: Partial<FeePhase>) => void;
  onCopyPhases: () => void;
  onCopyLink: () => void;
  /** The copy-form menu, the refusal line and the question builder. */
  formSlot: ReactNode;
  /** The after-submitting message fields (their state lives in the page). */
  afterSlot: ReactNode;
}

export function RoleSheet(props: RoleSheetProps) {
  const { conference: c, role, config, now, configVersion, timelineCtx, timelineMsg } = props;
  const currency = c.fee_currency || 'USD';
  const priced = roleHasPrice(role);
  const free = config ? roleIsFree(config) : true;
  const gate = paymentGateBlocks(c);
  const plural = rolePlural(role);
  const st = windowState(config, now);
  const mark = STATE_MARK[st];
  const enabled = config?.is_enabled ?? false;
  const blocked = gate && !enabled;
  const phases = config?.fee_phases ?? [];
  const active = activeFeePhase(phases);
  const datedPhases = phases.some(p => p.start_date && p.end_date);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const onCloseRef = useRef(props.onClose);
  useEffect(() => { onCloseRef.current = props.onClose; });

  useScrollLock(true);

  // Focus: into the sheet on open, back to whatever opened it on close.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const t = window.setTimeout(() => closeRef.current?.focus({ preventScroll: true }), 40);
    return () => {
      window.clearTimeout(t);
      if (opener && opener.isConnected && typeof opener.focus === 'function') opener.focus({ preventScroll: true });
    };
  }, []);

  // ?step= scrolls its section into view once.
  const startStep = STEP_KEYS.includes(props.initialStep as StepKey) ? props.initialStep as StepKey : null;
  useEffect(() => {
    if (!startStep || startStep === 'review') return;
    const t = window.setTimeout(() => {
      const el = bodyRef.current?.querySelector<HTMLElement>(`#step-${startStep}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 160);
    return () => window.clearTimeout(t);
  }, [startStep]);

  // Escape closes the sheet only while it is the top layer. Anything portaled
  // after it (a confirm, the copy-prices pop-up, a date or currency picker, a
  // question menu) is on top and owns that Escape.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      const root = rootRef.current;
      if (!root) return;
      for (let n = root.nextElementSibling; n; n = n.nextElementSibling) {
        if (NOT_A_LAYER.has(n.tagName)) continue;
        if (n.getClientRects().length === 0) continue;
        const pos = window.getComputedStyle(n).position;
        if (pos === 'fixed' || pos === 'absolute') return;
      }
      onCloseRef.current();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Tab stays inside the sheet.
  function trapTab(e: React.KeyboardEvent) {
    if (e.key !== 'Tab') return;
    const panel = panelRef.current;
    if (!panel || !panel.contains(document.activeElement)) return;
    const items = Array.from(panel.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )).filter(el => el.getClientRects().length > 0);
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  const saveWord = props.saveState === 'saving' ? 'Saving' : props.saveState === 'saved' ? 'Saved' : 'Saves by itself';

  const statusLine = st === 'open'
    ? (config?.applications_close_at ? `Open now, until ${dateAndTime(config.applications_close_at, now)}.` : 'Open now, with no closing date.')
    : st === 'scheduled' ? `Switched on. Opens ${dateAndTime(config?.applications_open_at, now)}.`
    : st === 'closed' ? `Switched on, but it closed ${dateAndTime(config?.applications_close_at, now)}. Move the closing date to open it again.`
    : 'Switched off. Nobody can apply yet. Set it up below, then switch it on at the top.';

  const windowBackwards = !!(config?.applications_open_at && config?.applications_close_at
    && new Date(config.applications_close_at).getTime() <= new Date(config.applications_open_at).getTime());
  const hasInvalidPhase = phases.some(p => !p.start_date || !p.end_date);

  return (
    <Portal>
      <div ref={rootRef} className="gvs-backdrop" onClick={props.onClose}>
        <style>{CSS}</style>
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="role-sheet-title"
          className="gvs-panel"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={trapTab}
        >
          {/* ── Header: who, how many, saved, the switch, close ── */}
          <header
            className="flex items-center gap-3 flex-shrink-0"
            style={{ backgroundColor: '#FFFFFF', borderBottom: `1px solid ${HAIRLINE}`, padding: '12px clamp(12px, 2.6vw, 20px)' }}
          >
            <span aria-hidden className="flex items-center justify-center flex-shrink-0" style={{ width: 44, height: 44, borderRadius: '50%', background: 'radial-gradient(circle at 35% 30%, #FFFFFF 0%, #F3EEDD 70%)', boxShadow: '0 0 0 1px rgba(27,56,40,0.07), 0 2px 6px rgba(27,56,40,0.08)' }}>
              <Emoji3D name={ROLE_EMOJI[role] ?? 'Busts in silhouette'} size={26} fallback={UsersRound} fallbackColor={FOREST} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 id="role-sheet-title" className="flex items-center gap-1.5" style={{ fontFamily: F, fontSize: 'clamp(19px, 2.4vw, 24px)', fontWeight: 800, color: INK, lineHeight: 1.15, letterSpacing: '-0.01em' }}>
                <span style={{ overflowWrap: 'anywhere' }}>{roleTitle(role)} <GoldWord>Applications</GoldWord></span>
                {ROLE_BLURB[role] && <InfoHint label={`What a ${roleTitle(role)} is`} text={ROLE_BLURB[role]} size={16} />}
              </h2>
              <p className="mt-0.5" style={{ fontFamily: F, fontSize: 13.5, color: INK_SOFT }}>
                {props.appliedCount !== null && (
                  <><b style={{ fontSize: 15, fontWeight: 700, color: INK, fontVariantNumeric: 'tabular-nums' }}>{props.appliedCount}</b> applied · </>
                )}
                <span role="status" aria-live="polite">{saveWord}</span>
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="inline-flex items-center gap-1.5" style={{ fontFamily: F, fontSize: 14, fontWeight: 600, color: mark.color }}>
                <mark.icon size={16} strokeWidth={2.4} aria-hidden />
                <span className="gvs-head-word">{mark.word}</span>
              </span>
              <Switch
                size="lg"
                label={`${plural} taking applications`}
                checked={enabled}
                disabled={blocked || !config}
                describedBy="role-switch-line"
                onChange={(v) => props.onSave({ is_enabled: v })}
              />
            </div>
            <button
              ref={closeRef}
              type="button"
              onClick={props.onClose}
              aria-label="Close"
              title="Close"
              className="flex items-center justify-center flex-shrink-0 focus:outline-none focus-visible:ring-2 rounded-full"
              style={{ width: 44, height: 44, border: 'none', cursor: 'pointer', backgroundColor: '#F3EEE2', color: INK }}
            >
              <X size={20} strokeWidth={2.4} />
            </button>
          </header>

          <div ref={bodyRef} className="gvs-body">
            <div className="gvs-col">
              {/* ── Title card (the Google Forms header card) ── */}
              <section
                id="step-review"
                style={{
                  backgroundColor: '#FFFFFF', borderRadius: 16, border: '1px solid rgba(27,56,40,0.08)',
                  borderTop: `8px solid ${FOREST}`, boxShadow: '0 6px 18px rgba(27,56,40,0.06)',
                  padding: 'clamp(16px, 3vw, 22px)',
                }}
              >
                <p id="role-switch-line" style={{ fontFamily: F, fontSize: 15, color: INK, lineHeight: 1.5, overflowWrap: 'anywhere' }}>
                  {blocked
                    ? <>Set up payments before you switch this on. Even a free conference needs one. You can still fill in everything below.{' '}
                      <Link href={`/manage/${c.slug}/financials?open=payment`} style={{ ...TEXT_LINK, fontSize: 15 }}>Set up payments</Link></>
                    : statusLine}
                </p>
                {c.payment_gate_exempt && !conferencePaymentsReady(c) && (
                  <div className="mt-3">
                    <Notice>
                      <b>Applicants cannot pay you yet.</b>{' '}
                      <Link href={`/manage/${c.slug}/financials?open=payment`} style={{ ...TEXT_LINK, color: '#6B4F12' }}>Set up payments</Link>
                    </Notice>
                  </div>
                )}
                <div className="mt-4 flex flex-wrap items-center gap-2.5">
                  <button type="button" onClick={props.onCopyLink} className="inline-flex items-center gap-1.5 focus:outline-none focus-visible:ring-2" style={SECOND_BTN}>
                    {props.linkCopied ? <Check size={15} strokeWidth={3} aria-hidden /> : <Copy size={15} strokeWidth={2.3} aria-hidden />}
                    {props.linkCopied ? 'Link copied' : 'Copy application link'}
                  </button>
                  <a href={`/conferences/${c.slug}/apply?role=${role}&preview=1`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 focus:outline-none focus-visible:ring-2" style={SECOND_BTN}>
                    <Eye size={15} strokeWidth={2.3} aria-hidden />
                    Preview the form
                  </a>
                </div>
              </section>

              {!config ? (
                <div aria-busy="true" className="flex flex-col gap-3">
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{ backgroundColor: '#FFFFFF', borderRadius: 16, padding: 22 }}>
                      <span className="block rounded-lg animate-pulse" style={{ height: 20, width: '50%', backgroundColor: '#F1ECE0' }} />
                      <span className="block rounded-lg animate-pulse mt-3" style={{ height: 40, backgroundColor: '#F6F2E8' }} />
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  {/* ── When ── */}
                  <Section id="step-when" icon={CalendarDays} title="When">
                    <div key={configVersion}>
                      <div className="gvs-two">
                        <div>
                          <FieldLabel>
                            Opens
                            <InfoHint label="About the opening time" text="Before it, the application link says when it opens. It opens by itself. Leave it empty to open the moment you switch the role on." />
                          </FieldLabel>
                          <DatePicker
                            withTime
                            clearable
                            value={toDatetimeLocal(config.applications_open_at)}
                            onChange={(v) => props.onSaveTimeline({ applications_open_at: fromDatetimeLocal(v) }, 'window')}
                            placeholder="When you switch it on"
                            zoneNote={`Times are in ${localZoneLabel()}.`}
                          />
                        </div>
                        <div>
                          <FieldLabel>
                            Closes
                            <InfoHint label="About the closing time" text="No new applications after this. The ones already sent are kept. Leave it empty to stay open until you switch the role off." />
                          </FieldLabel>
                          <DatePicker
                            withTime
                            clearable
                            value={toDatetimeLocal(config.applications_close_at)}
                            onChange={(v) => props.onSaveTimeline({ applications_close_at: fromDatetimeLocal(v) }, 'window')}
                            min={toDatetimeLocal(config.applications_open_at).slice(0, 10) || undefined}
                            placeholder="When you switch it off"
                            zoneNote={`Times are in ${localZoneLabel()}.`}
                          />
                        </div>
                      </div>
                      {windowBackwards ? (
                        <div className="mt-3"><Notice tone="danger" role="alert">This closes before it opens, so nobody can apply. Move one of the two.</Notice></div>
                      ) : (
                        <p suppressHydrationWarning className="mt-2" style={{ fontFamily: F, fontSize: 13, color: INK_SOFT }}>
                          Times are in {localZoneLabel()}.
                          {datedPhases ? ' Your prices have dates, so the window follows them.' : ''}
                        </p>
                      )}
                      {timelineMsg?.where === 'window' && <TimelineMsg msg={timelineMsg} />}
                      <TimelineWarning config={config} roleLabel={role} ctx={timelineCtx} onFix={(patch) => props.onSaveTimeline(patch, 'window')} />
                      {(config.applications_open_at || config.applications_close_at || datedPhases) && (
                        <div className="mt-4 rounded-2xl p-4" style={{ backgroundColor: '#FBF8F1' }}>
                          <RoleTimelineBar config={config} now={now} fallbackCurrency={currency} timeZone={timelineCtx.timeZone} />
                        </div>
                      )}
                    </div>
                  </Section>

                  {/* ── Price ── */}
                  {priced && (
                    <Section id="step-price" icon={Wallet} title="Price">
                      <div key={configVersion}>
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
                            style={{ ...INPUT, fontSize: 16, flex: 1, width: 'auto', minWidth: 120, fontVariantNumeric: 'tabular-nums' }}
                          />
                        </div>
                        <Hint>
                          0 means free.{phases.length > 0 ? ' This price is used on days no dated price covers.' : ''}
                        </Hint>

                        <MoreLink label="Prices by date" defaultOpen={phases.length > 0}>
                          <PhaseEditor
                            phases={phases}
                            active={active}
                            configVersion={configVersion}
                            baseAmount={config.fee_amount}
                            hasInvalid={hasInvalidPhase}
                            onUpdatePhase={props.onUpdatePhase}
                            onSaveTimeline={props.onSaveTimeline}
                          />
                          {timelineMsg?.where === 'phases' && <TimelineMsg msg={timelineMsg} />}
                        </MoreLink>
                        <div className="mt-3">
                          <button type="button" onClick={props.onCopyPhases} className="inline-flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 rounded" style={{ ...TEXT_LINK, fontSize: 14 }}>
                            <Copy size={14} strokeWidth={2.4} aria-hidden />
                            Use this price for another role
                          </button>
                        </div>
                      </div>
                    </Section>
                  )}

                  {/* ── Paying (paid roles only) ── */}
                  {priced && !free && (
                    <Section id="step-paying" icon={CreditCard} title="Paying">
                      <div className="gvs-rows">
                        <ToggleRow
                          title="Only after you accept them"
                          desc="Off: they can pay as soon as they apply."
                          checked={config.payment_timing === 'after_acceptance'}
                          onChange={(v) => props.onSave({ payment_timing: v ? 'after_acceptance' : 'anytime' })}
                        />
                        <ToggleRow
                          title="Hide their dashboard until they pay"
                          desc="Waived and sponsored people always see everything."
                          checked={config.hide_dashboard_until_paid === true}
                          onChange={(v) => props.onSave({ hide_dashboard_until_paid: v })}
                        />
                      </div>
                    </Section>
                  )}

                  {/* ── Who gets in ── */}
                  <Section id="step-entry" icon={UserCheck} title="Who Gets In">
                    <div key={configVersion} className="gvs-rows">
                      <ToggleRow
                        title="Accept everyone straight away"
                        desc="Off: you review each application."
                        checked={config.auto_accept === true}
                        onChange={(v) => props.onSave({ auto_accept: v })}
                      />
                      <div className="flex items-center justify-between gap-4 flex-wrap py-3.5" style={{ borderTop: `1px solid ${HAIRLINE}` }}>
                        <label htmlFor="role-max-accepted" className="flex items-center gap-1.5" style={{ fontFamily: F, fontSize: 15, fontWeight: 600, color: INK }}>
                          Most people you will accept
                          <InfoHint label="About the most you will accept" text="A limit on acceptances, not on applications. Leave it empty for no limit." />
                        </label>
                        <input
                          id="role-max-accepted"
                          type="number"
                          min={1}
                          placeholder="No limit"
                          defaultValue={config.max_accepted ?? ''}
                          onBlur={(e) => props.onSave({ max_accepted: e.target.value ? parseInt(e.target.value) : null })}
                          style={{ ...INPUT, fontSize: 16, width: 140, fontVariantNumeric: 'tabular-nums' }}
                        />
                      </div>
                      <ToggleRow
                        title="Let turned-down people try again"
                        desc="They can change their answers and send it back."
                        checked={config.allow_resubmission ?? false}
                        onChange={(v) => props.onSave({ allow_resubmission: v })}
                      />
                    </div>
                  </Section>

                  {/* ── Questions ── */}
                  <Section id="step-form" icon={ListChecks} title="Questions">
                    <div key={configVersion}>
                      {roleCanHavePreference(role) && (role === 'chair' ? (
                        <div className="gvs-rows mb-2">
                          <ToggleRow
                            title="Ask which committee they want"
                            desc="They rank committees, you assign from it."
                            checked={config.preference_mode === 'committees_only'}
                            onChange={(v) => props.onSave({ preference_mode: v ? 'committees_only' : 'none' })}
                          />
                        </div>
                      ) : (
                        <div className="pb-4">
                          <FieldLabel>
                            What do they rank?
                            <InfoHint label="About preferences" text="What applicants rank on the form, so what your allocation works with. Nothing skips the step and you place everyone yourself." />
                          </FieldLabel>
                          <div role="radiogroup" aria-label="What do they rank?" className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))' }}>
                            {PREF_MODE_OPTIONS.map(opt => {
                              const on = (config.preference_mode ?? 'none') === opt.value;
                              return (
                                <button
                                  key={opt.value}
                                  type="button"
                                  role="radio"
                                  aria-checked={on}
                                  title={opt.desc}
                                  onClick={() => props.onSave({ preference_mode: opt.value })}
                                  className="flex items-center gap-2 text-left focus:outline-none focus-visible:ring-2"
                                  style={{
                                    padding: '10px 12px', borderRadius: 12, cursor: 'pointer',
                                    fontFamily: F, fontSize: 14, fontWeight: 600, lineHeight: 1.25,
                                    backgroundColor: on ? 'rgba(27,56,40,0.06)' : '#FFFFFF',
                                    color: INK,
                                    border: on ? `2px solid ${FOREST}` : '1.5px solid #DDD4C0',
                                  }}
                                >
                                  <span className="inline-flex items-center flex-shrink-0" style={{ gap: 2 }}>
                                    {opt.value !== 'countries_only' && opt.value !== 'none' && <Emoji3D name="Classical building" size={18} fallback={Building2} fallbackColor={FOREST} />}
                                    {opt.value !== 'committees_only' && opt.value !== 'none' && <Emoji3D name="Crossed flags" size={18} fallback={Globe} fallbackColor={FOREST} />}
                                    {opt.value === 'none' && <Emoji3D name="Cross mark" size={18} fallback={X} fallbackColor={FOREST} />}
                                  </span>
                                  <span className="min-w-0" style={{ overflowWrap: 'anywhere' }}>{opt.label}</span>
                                </button>
                              );
                            })}
                          </div>
                          <Hint>{PREF_MODE_OPTIONS.find(o => o.value === (config.preference_mode ?? 'none'))?.desc}</Hint>
                        </div>
                      ))}
                      {/* Chair and secretariat only: the database CHECK refuses it for
                          every other role, so no control exists for them at all. */}
                      {(role === 'chair' || role === 'secretariat') && (
                        <div className="gvs-rows mb-2">
                          <ToggleRow
                            title="Ask for their MUN experience"
                            desc="They can bring it in from their MUN CV."
                            checked={config.collect_mun_experience ?? false}
                            onChange={(v) => props.onSave({ collect_mun_experience: v })}
                          />
                        </div>
                      )}
                      <div className={roleCanHavePreference(role) || role === 'secretariat' ? 'pt-4' : ''} style={roleCanHavePreference(role) || role === 'secretariat' ? { borderTop: `1px solid ${HAIRLINE}` } : undefined}>
                        <p className="mb-2" style={{ fontFamily: F, fontSize: 15, fontWeight: 600, color: INK }}>Your own questions</p>
                        {props.formSlot}
                      </div>
                    </div>
                  </Section>

                  {/* ── After they apply ── */}
                  <Section id="step-after" icon={PartyPopper} title="After They Apply">
                    <p className="mb-3" style={{ fontFamily: F, fontSize: 13.5, color: INK_SOFT, lineHeight: 1.5 }}>
                      A short note on the confirmation screen, like a group chat to join. Optional.
                    </p>
                    {props.afterSlot}
                  </Section>

                  <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
                    <span style={{ fontFamily: F, fontSize: 13.5, color: INK_SOFT }}>Everything saves by itself</span>
                    <button type="button" onClick={props.onClose} className="inline-flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-[0.98] transition-transform" style={PRIMARY_BTN}>
                      Done
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
}

// ── Prices by date ───────────────────────────────────────────────────────────

function PhaseEditor({ phases, active, configVersion, baseAmount, hasInvalid, onUpdatePhase, onSaveTimeline }: {
  phases: FeePhase[];
  active: FeePhase | null;
  configVersion: number;
  baseAmount: number;
  hasInvalid: boolean;
  onUpdatePhase: RoleSheetProps['onUpdatePhase'];
  onSaveTimeline: RoleSheetProps['onSaveTimeline'];
}) {
  return (
    <div>
      <p className="mb-3" style={{ fontFamily: F, fontSize: 13.5, color: INK_SOFT, lineHeight: 1.5 }}>
        For example an early bird price, then a standard price. Each one starts the day after the last one ends.
      </p>
      <div className="flex flex-col gap-2.5">
        {phases.map((phase, pi) => {
          const isActive = active !== null && phase === active;
          const invalid = !phase.start_date || !phase.end_date;
          return (
            <div key={`${pi}-${phases.length}-${configVersion}`}>
              <div
                className="gvs-phase rounded-xl px-3 py-2.5"
                style={{
                  backgroundColor: isActive ? 'rgba(238,217,138,0.22)' : '#FBF8F1',
                  border: invalid ? '1.5px solid rgba(139,32,32,0.45)' : isActive ? '1.5px solid rgba(182,135,31,0.45)' : '1px solid #EFE9DC',
                }}
              >
                <div className="gvs-phase-name flex items-center gap-2 min-w-0">
                  <input
                    type="text"
                    placeholder="Name, e.g. Early bird"
                    aria-label="Price name"
                    defaultValue={phase.label}
                    onBlur={(e) => { if (e.target.value.trim() !== phase.label) onUpdatePhase(phases, pi, { label: e.target.value.trim() }); }}
                    style={{ ...INPUT, padding: '8px 11px', fontSize: 16 }}
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
                  onChange={(iso) => { if (iso !== phase.start_date) onUpdatePhase(phases, pi, { start_date: iso }); }}
                />
                <DatePicker
                  value={phase.end_date}
                  min={phase.start_date || undefined}
                  placeholder="To"
                  onChange={(iso) => { if (iso !== phase.end_date) onUpdatePhase(phases, pi, { end_date: iso }); }}
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
                    if (next !== phase.amount) onUpdatePhase(phases, pi, { amount: next });
                  }}
                  style={{ ...INPUT, padding: '8px 10px', fontSize: 16, fontVariantNumeric: 'tabular-nums' }}
                />
                <button
                  type="button"
                  aria-label={`Remove ${phase.label || 'this price'}`}
                  onClick={() => onSaveTimeline({ fee_phases: phases.filter((_, i2) => i2 !== pi) }, 'phases')}
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
      <button
        type="button"
        disabled={hasInvalid}
        title={hasInvalid ? 'Give the last price its dates first' : undefined}
        onClick={() => onSaveTimeline({ fee_phases: [...phases, { label: `Price ${phases.length + 1}`, start_date: '', end_date: '', amount: baseAmount }] }, 'phases')}
        className="mt-3 inline-flex items-center gap-1.5 focus:outline-none focus-visible:ring-2"
        style={{ ...SECOND_BTN, opacity: hasInvalid ? 0.5 : 1, cursor: hasInvalid ? 'not-allowed' : 'pointer' }}
      >
        <Plus size={15} strokeWidth={2.6} aria-hidden />
        Add a price
      </button>
    </div>
  );
}
