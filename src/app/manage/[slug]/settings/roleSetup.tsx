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
  Check, Copy, Eye, ChevronDown, Plus, Star, X,
  CheckCircle2, Clock, MinusCircle, XCircle, CalendarDays, Wallet,
  UserCheck, ListChecks, PartyPopper, type LucideIcon,
} from 'lucide-react';
import Portal from '@/components/Portal';
import { DatePicker } from '@/components/DatePicker';
import { CurrencyPicker } from '@/components/CurrencyPicker';
import { useScrollLock } from '@/hooks/useScrollLock';
import { activeFeePhase, type FeePhase } from '@/lib/finance';
import { conferencePaymentsReady, paymentGateBlocks } from '@/lib/payments';
import type { TimelineContext, TimelineInput } from '@/lib/roleTimeline';
import type { Conference } from '@/app/manage/[slug]/layout';
import { STORE_CSS } from '../store/storeKit';
import { DASH_CSS } from '../financials/dashboardKit';
import { ROLE_BLURB, InfoHint } from './applicationsUi';
import { TimelineNotice, TimelineWarning } from './timelineUi';
import { RoleTimelineBar } from './roleTimelineBar';
import {
  F, INK, INK_SOFT, FOREST, AMBER, DANGER, HAIRLINE, TEXT_LINK, INPUT, ROW_CSS,
  Switch, FieldLabel, Notice, PREF_MODE_OPTIONS, Row, SwitchRow, TINT_GOLD_BG, TINT_GREEN_BG, EmojiDisc, RoleDisc,
  inGeneralScope, generalValue, type GeneralField,
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
.gvs-panel { position: relative; display: flex; flex-direction: column; width: min(880px, 100%); height: min(100%, 980px);
  background: ${SHEET_BG}; border-radius: 24px; overflow: hidden; box-shadow: 0 30px 90px rgba(27,20,16,0.35); }
@media (max-width: 720px) {
  .gvs-backdrop { padding: 0; }
  .gvs-panel { width: 100%; height: 100%; border-radius: 0;
    padding-top: env(safe-area-inset-top, 0px); padding-bottom: env(safe-area-inset-bottom, 0px); }
}
.gvs-body { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; -webkit-overflow-scrolling: touch;
  container-type: inline-size; }
.gvs-col { width: 100%; max-width: 760px; margin: 0 auto; padding: 16px clamp(10px, 3vw, 22px) 36px;
  display: flex; flex-direction: column; gap: 12px; }
.gvs-two { display: grid; gap: 10px; grid-template-columns: minmax(0, 1fr); }
@container (min-width: 480px) { .gvs-two { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
/* Fee stages: a compact table. On a phone one stage is the name, then from
   and to side by side, then the price and remove; one line of five from 620px. */
.gvs-stages { display: flex; flex-direction: column; gap: 8px; }
.gvs-stage { display: grid; gap: 8px; align-items: center; padding: 8px; border-radius: 14px; background: #FAF8F3;
  grid-template-columns: repeat(2, minmax(0, 1fr)); grid-template-areas: "name name" "from to" "price rm"; }
.gvs-stage[data-today="true"] { background: rgba(238,217,138,0.28); box-shadow: inset 3px 0 0 #B6871F; }
.gvs-stage[data-bad="true"] { box-shadow: inset 0 0 0 1.5px rgba(139,32,32,0.45); }
.gvs-st-name { grid-area: name; } .gvs-st-price { grid-area: price; } .gvs-st-from { grid-area: from; } .gvs-st-to { grid-area: to; }
.gvs-st-rm { grid-area: rm; justify-self: end; }
.gvs-stage-head { display: none; }
@container (min-width: 620px) {
  .gvs-stage { grid-template-columns: minmax(0, 1fr) 84px 160px 160px 34px; grid-template-areas: "name price from to rm"; }
  .gvs-st-rm { justify-self: center; }
  .gvs-stage-head { display: grid; grid-template-columns: minmax(0, 1fr) 84px 160px 160px 34px; gap: 8px; padding: 0 8px; }
}
.gvs-st-from > div > button, .gvs-st-to > div > button { padding-left: 10px !important; padding-right: 10px !important; gap: 8px !important; }
.gvs-head-word { display: none; }
@media (min-width: 560px) { .gvs-head-word { display: inline; } }
`;

// ── Pieces ───────────────────────────────────────────────────────────────────

/** One card of the form: the Store's white card, a 3D emoji in a tinted disc,
 *  a Title Case heading with its last word gold. */
function Section({ id, emoji, icon, tint = TINT_GREEN_BG, title, hint, children }: {
  id: string;
  /** Fluent 3D emoji name; `icon` is its Lucide fallback. */
  emoji: string;
  icon: LucideIcon;
  tint?: string;
  title: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-h`}
      className="gv-st-card gvk-group"
      style={{ padding: 'clamp(14px, 3vw, 20px)', scrollMarginTop: 16 }}
    >
      <h3 id={`${id}-h`} className="flex items-center gap-2.5 mb-3" style={{ fontFamily: F, fontSize: 18, fontWeight: 800, color: INK, lineHeight: 1.25 }}>
        <EmojiDisc emoji={emoji} icon={icon} tint={tint} size={36} />
        <span style={{ overflowWrap: 'anywhere' }}>{title}</span>
        {hint}
      </h3>
      {children}
    </section>
  );
}

function TimelineMsg({ msg }: { msg: { kind: 'info' | 'error'; text: string } | null }) {
  if (!msg) return null;
  return msg.kind === 'info'
    ? <TimelineNotice text={msg.text} />
    : <div className="mt-2"><Notice tone="danger" role="alert">{msg.text}</Notice></div>;
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
  /** Every role listed on the Applications page (this one included): the
   *  rules for every role are compared against them. */
  peers: RoleSetupConfig[];
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

  // The rules for every role (panelKit.inGeneralScope). A field this role is
  // covered by sits under "Different rules for {role}", open by itself when
  // this role already differs from another covered role. A field the rule
  // does not cover (the secretariat's acceptance) is shown plainly.
  const covered = (f: GeneralField) => inGeneralScope(f, role);
  const differs = (f: GeneralField) => !!config && covered(f)
    && props.peers.some(p => p.role !== role && inGeneralScope(f, p.role) && generalValue(p, f) !== generalValue(config, f));
  const showPaying = priced && !free;
  const showRank = roleCanHavePreference(role) && role !== 'chair';
  const ownFields: GeneralField[] = (['auto_accept', 'allow_resubmission', 'payment_timing', 'hide_dashboard_until_paid', 'preference_mode'] as GeneralField[])
    .filter(f => (f === 'payment_timing' || f === 'hide_dashboard_until_paid') ? showPaying : f === 'preference_mode' ? showRank : true);
  const plainFields = ownFields.filter(f => !covered(f));
  const overrideFields = ownFields.filter(f => covered(f));
  const anyDiffers = overrideFields.some(differs);
  const [overrideOpen, setOverrideOpen] = useState(anyDiffers || startStepIsRule(props.initialStep));

  return (
    <Portal>
      <div ref={rootRef} className="gvs-backdrop" onClick={props.onClose}>
        <style>{STORE_CSS}</style>
        <style>{DASH_CSS}</style>
        <style>{ROW_CSS}</style>
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
            <RoleDisc role={role} tint={TINT_GOLD_BG} size={46} />
            <div className="min-w-0 flex-1">
              <h2 id="role-sheet-title" className="flex items-center gap-1.5" style={{ fontFamily: F, fontSize: 'clamp(19px, 2.4vw, 24px)', fontWeight: 800, color: INK, lineHeight: 1.15, letterSpacing: '-0.01em' }}>
                <span style={{ overflowWrap: 'anywhere' }}>{roleTitle(role)} Applications</span>
                {ROLE_BLURB[role] && <InfoHint label={`What a ${roleTitle(role)} is`} text={ROLE_BLURB[role]} size={16} />}
              </h2>
              <p className="mt-0.5" style={{ fontFamily: F, fontSize: 13.5, color: INK_SOFT }}>
                {props.appliedCount !== null && (
                  <><b style={{ fontSize: 22, fontWeight: 900, color: FOREST, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>{props.appliedCount}</b> applied · </>
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
              {/* ── What the switch means now, the link and the preview ── */}
              <section id="step-review" className="gv-st-card gv-fd-wash-green" style={{ padding: 'clamp(14px, 3vw, 18px)' }}>
                <p id="role-switch-line" style={{ fontFamily: F, fontSize: 15, color: INK, lineHeight: 1.5, overflowWrap: 'anywhere' }}>
                  {blocked
                    ? <>Set up payments before you switch this on. You can still fill in everything below.{' '}
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
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button type="button" onClick={props.onCopyLink} className="gv-st-btn gv-st-outline" style={{ minHeight: 40, padding: '0 14px' }}>
                    {props.linkCopied ? <Check size={15} strokeWidth={3} aria-hidden /> : <Copy size={15} strokeWidth={2.3} aria-hidden />}
                    {props.linkCopied ? 'Link copied' : 'Copy application link'}
                  </button>
                  <a href={`/conferences/${c.slug}/apply?role=${role}&preview=1`} target="_blank" rel="noopener noreferrer" className="gv-st-btn gv-st-outline" style={{ minHeight: 40, padding: '0 14px' }}>
                    <Eye size={15} strokeWidth={2.3} aria-hidden />
                    Preview the form
                  </a>
                </div>
              </section>

              {!config ? (
                <div aria-busy="true" className="flex flex-col gap-3">
                  {[0, 1, 2].map(i => <div key={i} className="gv-fd-ph" style={{ height: 120 }} />)}
                </div>
              ) : (
                <>
                  {/* ── When: one row ── */}
                  <Section id="step-when" emoji="Spiral calendar" icon={CalendarDays} tint={TINT_GOLD_BG} title="When">
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
                      {windowBackwards && (
                        <div className="mt-3"><Notice tone="danger" role="alert">This closes before it opens, so nobody can apply. Move one of the two.</Notice></div>
                      )}
                      {datedPhases && !windowBackwards && (
                        <p className="mt-2" style={{ fontFamily: F, fontSize: 13, color: INK_SOFT }}>Your prices have dates, so the window follows them.</p>
                      )}
                      {timelineMsg?.where === 'window' && <TimelineMsg msg={timelineMsg} />}
                      <TimelineWarning config={config} roleLabel={role} ctx={timelineCtx} onFix={(patch) => props.onSaveTimeline(patch, 'window')} />
                      {(config.applications_open_at || config.applications_close_at || datedPhases) && (
                        <div className="mt-3">
                          <RoleTimelineBar config={config} now={now} fallbackCurrency={currency} timeZone={timelineCtx.timeZone} compact />
                        </div>
                      )}
                    </div>
                  </Section>

                  {/* ── Price: one row, then the stages as a small table ── */}
                  {priced && (
                    <Section id="step-price" emoji="Money bag" icon={Wallet} tint={TINT_GOLD_BG} title="Price">
                      <div key={configVersion}>
                        <div className="flex items-center gap-2 flex-wrap">
                          <CurrencyPicker
                            value={config.fee_currency}
                            onChange={(code) => props.onSave({ fee_currency: code })}
                            ariaLabel={`${roleTitle(role)} fee currency`}
                            variant="bordered"
                            style={{ width: 112, flexShrink: 0 }}
                          />
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            placeholder="0"
                            aria-label={`${roleTitle(role)} price`}
                            defaultValue={config.fee_amount}
                            onBlur={(e) => props.onSave({ fee_amount: parseFloat(e.target.value) || 0 })}
                            style={{ ...INPUT, fontSize: 18, fontWeight: 800, width: 150, flex: '0 1 150px', fontVariantNumeric: 'tabular-nums' }}
                          />
                          <span style={{ fontFamily: F, fontSize: 13, color: INK_SOFT }}>
                            {phases.length > 0 ? 'On days no stage covers. 0 is free.' : '0 is free'}
                          </span>
                        </div>

                        <div className="mt-3">
                          <StageTable
                            phases={phases}
                            active={active}
                            configVersion={configVersion}
                            onUpdatePhase={props.onUpdatePhase}
                            onSaveTimeline={props.onSaveTimeline}
                          />
                          {timelineMsg?.where === 'phases' && <TimelineMsg msg={timelineMsg} />}
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
                          <button
                            type="button"
                            disabled={hasInvalidPhase}
                            title={hasInvalidPhase ? 'Give the last stage its dates first' : undefined}
                            onClick={() => props.onSaveTimeline({ fee_phases: [...phases, { label: phases.length === 0 ? 'Early bird' : `Stage ${phases.length + 1}`, start_date: '', end_date: '', amount: config.fee_amount }] }, 'phases')}
                            className="gv-st-btn gv-st-outline"
                            style={{ minHeight: 40, padding: '0 14px' }}
                          >
                            <Plus size={15} strokeWidth={2.6} aria-hidden />
                            {phases.length === 0 ? 'Add a price by date' : 'Add a stage'}
                          </button>
                          <button type="button" onClick={props.onCopyPhases} className="inline-flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 rounded" style={{ ...TEXT_LINK, fontSize: 14 }}>
                            <Copy size={14} strokeWidth={2.4} aria-hidden />
                            Use this price for another role
                          </button>
                        </div>
                      </div>
                    </Section>
                  )}

                  {/* ── Questions ── */}
                  <Section id="step-form" emoji="Memo" icon={ListChecks} title="Questions">
                    <div key={configVersion}>
                      {(role === 'chair' || role === 'secretariat') && (
                        <div className="gvk-rows mb-3">
                          {role === 'chair' && (
                            <SwitchRow
                              label="Ask which committee they want"
                              desc="They rank committees, you assign from it."
                              checked={config.preference_mode === 'committees_only'}
                              onChange={(v) => props.onSave({ preference_mode: v ? 'committees_only' : 'none' })}
                            />
                          )}
                          {/* Chair and secretariat only: the database CHECK refuses it for
                              every other role, so no control exists for them at all. */}
                          <SwitchRow
                            label="Ask for their MUN experience"
                            desc="They can bring it in from their MUN CV."
                            checked={config.collect_mun_experience ?? false}
                            onChange={(v) => props.onSave({ collect_mun_experience: v })}
                          />
                        </div>
                      )}
                      {props.formSlot}
                    </div>
                  </Section>

                  {/* ── After they apply ── */}
                  <Section id="step-after" emoji="Party popper" icon={PartyPopper} tint={TINT_GOLD_BG} title="After They Apply">
                    <p className="mb-3" style={{ fontFamily: F, fontSize: 13.5, color: INK_SOFT, lineHeight: 1.5 }}>
                      A short note on the confirmation screen, like a group chat to join. Optional.
                    </p>
                    {props.afterSlot}
                  </Section>

                  {/* ── Who gets in: the per-role cap, and this role's own rules ── */}
                  <Section id="step-entry" emoji="Door" icon={UserCheck} title="Who Gets In">
                    <div key={configVersion} className="gvk-rows">
                      <Row label="Most people you will accept" htmlFor="role-max-accepted" align="end" desc="Leave it empty for no limit." on={config.max_accepted != null}>
                        <input
                          id="role-max-accepted"
                          type="number"
                          min={1}
                          placeholder="No limit"
                          defaultValue={config.max_accepted ?? ''}
                          onBlur={(e) => props.onSave({ max_accepted: e.target.value ? parseInt(e.target.value) : null })}
                          style={{ ...INPUT, fontSize: 16, width: 120, fontVariantNumeric: 'tabular-nums' }}
                        />
                      </Row>
                      {plainFields.map(f => <RuleControl key={f} field={f} config={config} onSave={props.onSave} />)}
                    </div>

                    {overrideFields.length > 0 && (
                      <div id="step-paying" className="mt-3" style={{ scrollMarginTop: 16 }}>
                        <button
                          type="button"
                          onClick={() => setOverrideOpen(o => !o)}
                          aria-expanded={overrideOpen}
                          className="w-full flex items-center justify-between gap-3 text-left focus:outline-none focus-visible:ring-2 rounded-xl"
                          style={{ padding: '12px 14px', borderRadius: 14, border: 'none', cursor: 'pointer', background: anyDiffers ? 'rgba(238,217,138,0.28)' : '#FAF8F3', boxShadow: anyDiffers ? 'inset 3px 0 0 #B6871F' : undefined, fontFamily: F }}
                        >
                          <span className="min-w-0">
                            <span className="block" style={{ fontSize: 15, fontWeight: 800, color: INK }}>Different rules for {plural}</span>
                            <span className="block" style={{ fontSize: 13, color: INK_SOFT, lineHeight: 1.45, overflowWrap: 'anywhere' }}>
                              {anyDiffers ? 'This role already differs from the others.' : 'These follow the rules for every role on the Applications page.'}
                            </span>
                          </span>
                          <ChevronDown size={18} strokeWidth={2.4} color={INK} aria-hidden style={{ transform: overrideOpen ? 'rotate(180deg)' : 'none', transition: 'transform 200ms ease', flexShrink: 0 }} />
                        </button>
                        {overrideOpen && (
                          <div className="gvk-rows mt-2">
                            {overrideFields.map(f => <RuleControl key={f} field={f} config={config} onSave={props.onSave} differs={differs(f)} />)}
                          </div>
                        )}
                      </div>
                    )}
                  </Section>

                  <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
                    <span style={{ fontFamily: F, fontSize: 13.5, color: INK_SOFT }}>Everything saves by itself</span>
                    <button type="button" onClick={props.onClose} className="gv-st-btn gv-st-forest">
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

function startStepIsRule(step: string | null): boolean {
  return step === 'paying';
}

// ── One of the rules for every role, for this role only ───────────────────────

function RuleControl({ field, config, onSave, differs = false }: {
  field: GeneralField;
  config: RoleSetupConfig;
  onSave: (updates: Partial<RoleSetupConfig>) => void;
  differs?: boolean;
}) {
  const note = differs ? 'Different from your other roles.' : undefined;
  if (field === 'preference_mode') {
    const value = config.preference_mode || 'none';
    return (
      <Row label="What they rank" desc={note ?? PREF_MODE_OPTIONS.find(o => o.value === value)?.desc} need={differs}>
        <div role="radiogroup" aria-label="What they rank" className="flex flex-wrap gap-1.5">
          {PREF_MODE_OPTIONS.map(opt => {
            const on = value === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => onSave({ preference_mode: opt.value })}
                className="focus:outline-none focus-visible:ring-2"
                style={{
                  minHeight: 38, padding: '0 12px', borderRadius: 10, cursor: 'pointer', fontFamily: F, fontSize: 13.5, fontWeight: 700,
                  background: on ? FOREST : '#FFFFFF', color: on ? '#EED98A' : INK, border: 'none',
                  boxShadow: on ? '0 6px 14px -8px rgba(27,56,40,0.7)' : 'inset 0 0 0 1.5px rgba(27,56,40,0.18)',
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </Row>
    );
  }
  const words: Record<Exclude<GeneralField, 'preference_mode'>, [string, string]> = {
    auto_accept: ['Accept everyone straight away', 'Off: you review each application.'],
    allow_resubmission: ['Let turned-down people try again', 'They change their answers and send it back.'],
    payment_timing: ['Pay only after you accept them', 'Off: they can pay as soon as they apply.'],
    hide_dashboard_until_paid: ['Hide their dashboard until they pay', 'Waived and sponsored people always see everything.'],
  };
  const [label, desc] = words[field];
  const checked = field === 'payment_timing' ? config.payment_timing === 'after_acceptance' : config[field] === true;
  return (
    <Row label={label} desc={note ?? desc} align="end" on={checked} need={differs}>
      <Switch
        label={label}
        checked={checked}
        onChange={(v) => onSave(field === 'payment_timing' ? { payment_timing: v ? 'after_acceptance' : 'anytime' } : { [field]: v } as Partial<RoleSetupConfig>)}
      />
    </Row>
  );
}

// ── Prices by date: a compact table ───────────────────────────────────────────

function StageTable({ phases, active, configVersion, onUpdatePhase, onSaveTimeline }: {
  phases: FeePhase[];
  active: FeePhase | null;
  configVersion: number;
  onUpdatePhase: RoleSheetProps['onUpdatePhase'];
  onSaveTimeline: RoleSheetProps['onSaveTimeline'];
}) {
  if (phases.length === 0) return null;
  const head: React.CSSProperties = { fontFamily: F, fontSize: 12, fontWeight: 700, color: INK_SOFT };
  const cell: React.CSSProperties = { ...INPUT, padding: '8px 10px', fontSize: 15 };
  return (
    <div>
      <div className="gvs-stage-head mb-1.5" aria-hidden>
        <span style={head}>Stage</span><span style={head}>Price</span><span style={head}>From</span><span style={head}>To</span><span />
      </div>
      <div className="gvs-stages">
        {phases.map((phase, pi) => {
          const isActive = active !== null && phase === active;
          const invalid = !phase.start_date || !phase.end_date;
          return (
            <div key={`${pi}-${phases.length}-${configVersion}`}>
              <div className="gvs-stage" data-today={isActive ? 'true' : undefined} data-bad={invalid ? 'true' : undefined}>
                <div className="gvs-st-name flex items-center gap-2 min-w-0">
                  <input
                    type="text"
                    placeholder="Name, e.g. Early bird"
                    aria-label="Stage name"
                    defaultValue={phase.label}
                    onBlur={(e) => { if (e.target.value.trim() !== phase.label) onUpdatePhase(phases, pi, { label: e.target.value.trim() }); }}
                    style={cell}
                  />
                  {isActive && (
                    <span className="inline-flex items-center flex-shrink-0" title="The price today" style={{ color: AMBER }}>
                      <Star size={16} strokeWidth={2.4} fill="#EED98A" aria-hidden /><span className="sr-only">Today</span>
                    </span>
                  )}
                </div>
                <input
                  className="gvs-st-price"
                  type="number"
                  min={0}
                  step={0.01}
                  aria-label="Stage price"
                  placeholder="0"
                  defaultValue={phase.amount}
                  onBlur={(e) => {
                    const next = parseFloat(e.target.value) || 0;
                    if (next !== phase.amount) onUpdatePhase(phases, pi, { amount: next });
                  }}
                  style={{ ...cell, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}
                />
                <div className="gvs-st-from min-w-0">
                  <DatePicker
                    value={phase.start_date}
                    max={phase.end_date || undefined}
                    placeholder="From"
                    onChange={(iso) => { if (iso !== phase.start_date) onUpdatePhase(phases, pi, { start_date: iso }); }}
                  />
                </div>
                <div className="gvs-st-to min-w-0">
                  <DatePicker
                    value={phase.end_date}
                    min={phase.start_date || undefined}
                    placeholder="To"
                    onChange={(iso) => { if (iso !== phase.end_date) onUpdatePhase(phases, pi, { end_date: iso }); }}
                  />
                </div>
                <button
                  type="button"
                  aria-label={`Remove ${phase.label || 'this stage'}`}
                  title="Remove"
                  onClick={() => onSaveTimeline({ fee_phases: phases.filter((_, i2) => i2 !== pi) }, 'phases')}
                  className="gvs-st-rm flex items-center justify-center focus:outline-none focus-visible:ring-2 rounded-full"
                  style={{ width: 34, height: 34, background: 'none', border: 'none', color: DANGER, cursor: 'pointer' }}
                >
                  <X size={17} strokeWidth={2.6} />
                </button>
              </div>
              {invalid && (
                <p className="mt-1" style={{ fontFamily: F, fontSize: 13, color: DANGER }}>This stage needs both dates before it counts.</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
