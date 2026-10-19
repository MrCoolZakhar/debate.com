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
 *   section rail       (13 Oct 2026, owner: "a left tab to signalize each
 *                      section ... it will still be scrollable") the section
 *                      names on the cream ground at the left, the one in view
 *                      bold forest (an IntersectionObserver on the headings);
 *                      a sticky row across the top at 720px and below
 *   title card         what the switch means right now (Copy application link
 *                      and Preview the form moved to the role row, prompt 122)
 *   Dates              opens / closes, the timeline bar
 *   Prices             one price, prices by date as a small table (priced roles)
 *   Preferences        what delegates and head delegates rank, for THIS role
 *                      (preference_mode), four cards in a 2 by 2 grid
 *   Questions          chair committee / MUN experience switches and the
 *                      question builder (every question in full)
 *   Final Message      the message shown once after submitting
 *   footer             Remove this role, Done
 * Dates, Prices and Questions each carry "Copy from another role" right under
 * their title; with nothing to copy it stays visible, aria-disabled, and says
 * why in a tooltip.
 *
 * Accepting and paying are the rules for every role on the Applications page
 * only (owner, 12 Oct 2026). What they rank came back into the pop-up per role
 * on 13 Oct 2026 (owner: "move the what they rank back inside the pop up for
 * delegates and head delegates"). The columns are untouched.
 *
 * The URL stays ?tab=applications&role=<role> (and ?step=<section> scrolls to
 * a section), so every old deep link opens this sheet. Escape and the X close
 * it, Tab stays inside it, focus goes back to whatever opened it.
 *
 * Presentation only: every field, every validation (roleTimeline.ts through the
 * page's saveTimeline, CONSTRAINT_MESSAGES), every autosave and every write is
 * the settings page's own, passed in unchanged.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  Check, Plus, Star, X, Trash2,
  CheckCircle2, Clock, MinusCircle, XCircle, CalendarDays, Wallet,
  ListChecks, PartyPopper, ListOrdered, type LucideIcon,
} from 'lucide-react';
import Portal from '@/components/Portal';
import { DatePicker } from '@/components/DatePicker';
import { CurrencyChip, ConferenceCurrencyLine } from '@/components/ConferenceCurrency';
import { useScrollLock } from '@/hooks/useScrollLock';
import { activeFeePhase, type FeePhase } from '@/lib/finance';
import { conferencePaymentsReady } from '@/lib/payments';
import type { TimelineContext, TimelineInput } from '@/lib/roleTimeline';
import type { Conference } from '@/app/manage/[slug]/layout';
import { STORE_CSS } from '../store/storeKit';
import { DASH_CSS } from '../financials/dashboardKit';
import { ROLE_BLURB, InfoHint } from './applicationsUi';
import { TimelineNotice, TimelineWarning } from './timelineUi';
import { RoleTimelineBar } from './roleTimelineBar';
import { CopyFromMenu, type CopySource } from './roleCopy';
import { RankPreview, RANK_PREVIEW_CSS } from './controlPanel';
import { roleSetupProblems, OPEN_DATE_MESSAGE, STAGE_PRICE_MESSAGE } from '@/lib/roleSetupProblems';
import {
  F, INK, INK_SOFT, FOREST, AMBER, DANGER, HAIRLINE, TEXT_LINK, INPUT, ROW_CSS, TYPE,
  Switch, FieldLabel, Notice, SwitchRow, TINT_GOLD_BG, TINT_GREEN_BG, EmojiDisc, RoleDisc,
  roleHasPrice, rolePlural, roleTitle, windowState, dateAndTime, PREF_MODE_OPTIONS, FixBadge,
  toDatetimeLocal, fromDatetimeLocal, localZoneLabel, type RoleSetupConfig, type WindowState, TYPE_PX
} from './panelKit';

/** The ?step= values. Old links used all seven; 'review' now means the top,
 *  and 'paying' / 'entry' (the per-role rules, removed 12 Oct 2026) open the
 *  pop-up at the top too. */
export type StepKey = 'when' | 'price' | 'paying' | 'entry' | 'form' | 'after' | 'review';
export const STEP_KEYS: readonly StepKey[] = ['when', 'price', 'paying', 'entry', 'form', 'after', 'review'];

const STATE_MARK: Record<WindowState, { icon: LucideIcon; word: string; color: string }> = {
  open: { icon: CheckCircle2, word: 'Open', color: FOREST },
  scheduled: { icon: Clock, word: 'Opens later', color: AMBER },
  closed: { icon: XCircle, word: 'Closed', color: DANGER },
  off: { icon: MinusCircle, word: 'Off', color: INK_SOFT },
};

const SHEET_BG = '#F3EEE2';

/** The rail's sections, in order. Ids stay the ?step= ids. */
interface RailSection { id: string; label: string; fixes?: number }

const CSS = `
/* Settings buttons are 38px tall (owner, 12 Oct 2026: some were "way too big"). */
.gvs-backdrop .gv-st-btn { min-height: 38px; padding: 0 14px; font-size: 14px; border-radius: 11px; }
.gvs-backdrop { position: fixed; inset: 0; z-index: 50; display: flex; align-items: center; justify-content: center;
  background: rgba(27,20,16,0.42); padding: 24px; }
.gvs-panel { position: relative; display: flex; flex-direction: column; width: min(1080px, 100%); height: min(100%, 980px);
  background: ${SHEET_BG}; border-radius: 24px; overflow: hidden; box-shadow: 0 30px 90px rgba(27,20,16,0.35); }
@media (max-width: 720px) {
  .gvs-backdrop { padding: 0; }
  .gvs-panel { width: 100%; height: 100%; border-radius: 0;
    padding-top: env(safe-area-inset-top, 0px); padding-bottom: env(safe-area-inset-bottom, 0px); }
}
.gvs-body { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; -webkit-overflow-scrolling: touch;
  container-type: inline-size; }
.gvs-layout { display: grid; grid-template-columns: 170px minmax(0, 1fr); gap: 8px; max-width: 1000px; margin: 0 auto;
  padding: 0 clamp(10px, 2.4vw, 22px) 0 clamp(10px, 2vw, 18px); }
.gvs-col { width: 100%; max-width: 800px; min-width: 0; padding: 16px 0 36px clamp(4px, 1.2vw, 12px);
  display: flex; flex-direction: column; gap: 12px; }
/* The section rail: names on the cream ground, the one in view bold forest. */
.gvs-rail { position: sticky; top: 0; align-self: start; padding: 18px 0 18px; display: flex; flex-direction: column; gap: 2px; }
.gvs-rail-item { display: flex; align-items: center; gap: 10px; width: 100%; text-align: left; border: none; background: none; cursor: pointer;
  padding: 9px 12px; border-radius: 12px; font-family: ${F}; font-size: ${TYPE_PX.body}px; font-weight: 500; color: ${INK_SOFT};
  white-space: nowrap; transition: color 160ms ease, background-color 160ms ease; }
.gvs-rail-item::before { content: ""; width: 3px; height: 18px; border-radius: 3px; background: transparent; flex-shrink: 0; transition: background-color 160ms ease; }
.gvs-rail-item:hover { color: ${INK}; background: rgba(27,56,40,0.04); }
.gvs-rail-item:focus { outline: none; }
.gvs-rail-item:focus-visible { box-shadow: 0 0 0 2px ${FOREST}; }
.gvs-rail-item[aria-current="true"] { color: ${FOREST}; font-weight: 800; }
.gvs-rail-item[aria-current="true"]::before { background: ${FOREST}; }
@media (max-width: 720px) {
  .gvs-layout { grid-template-columns: minmax(0, 1fr); gap: 0; padding: 0 clamp(10px, 3vw, 16px); }
  .gvs-col { padding: 12px 0 36px; }
  .gvs-rail { z-index: 2; flex-direction: row; gap: 4px; padding: 8px 0; margin: 0 calc(-1 * clamp(10px, 3vw, 16px));
    padding-inline: clamp(10px, 3vw, 16px); overflow-x: auto; scrollbar-width: none; background: ${SHEET_BG};
    box-shadow: 0 1px 0 ${HAIRLINE}; }
  .gvs-rail::-webkit-scrollbar { display: none; }
  .gvs-rail-item { width: auto; padding: 8px 12px; }
  .gvs-rail-item::before { display: none; }
  .gvs-rail-item[aria-current="true"] { background: #FFFFFF; box-shadow: inset 0 -2px 0 ${FOREST}; }
}
/* Preferences: four short cards, two by two (one column on a phone). */
.gvs-prefs { display: grid; gap: 10px; grid-template-columns: minmax(0, 1fr); }
@container (min-width: 440px) { .gvs-prefs { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
.gvs-pref { position: relative; border-radius: 16px; background: #FAF8F3; box-shadow: inset 0 0 0 1.5px rgba(27,56,40,0.10);
  transition: box-shadow 160ms ease, background-color 160ms ease; }
.gvs-pref:hover { background: #F5F0E4; }
.gvs-pref[data-on="true"] { background: linear-gradient(150deg, rgba(61,122,82,0.14), rgba(61,122,82,0.05)); box-shadow: inset 0 0 0 2px ${FOREST}; }
.gvs-pref-btn { display: flex; flex-direction: column; gap: 8px; width: 100%; padding: 10px; border: none; background: none; cursor: pointer;
  text-align: left; border-radius: 16px; font-family: ${F}; }
.gvs-pref-btn:focus { outline: none; }
.gvs-pref-btn:focus-visible { box-shadow: 0 0 0 2px #FFFFFF, 0 0 0 4px ${FOREST}; }
.gvs-pref-btn:active { transform: scale(0.99); }
.gvs-pref .gvc-mini { min-height: 72px; padding: 8px 10px; gap: 5px; }
.gvs-pref-info { position: absolute; right: 10px; bottom: 10px; }
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
function Section({ id, emoji, icon, tint = TINT_GREEN_BG, title, hint, aside, fixes = 0, children }: {
  id: string;
  /** Things to fix in this section (roleSetupProblems), as a badge by the title. */
  fixes?: number;
  /** Right under the title: "Copy from another role" (13 Oct 2026). */
  aside?: ReactNode;
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
      <h3 id={`${id}-h`} tabIndex={-1} data-rail-heading={id} className="flex items-center gap-2.5 mb-3 focus:outline-none" style={TYPE.card}>
        <EmojiDisc emoji={emoji} icon={icon} tint={tint} size={36} />
        <span style={{ overflowWrap: 'anywhere' }}>{title}</span>
        {hint}
        <FixBadge n={fixes} size={22} />
      </h3>
      {aside && <div className="mb-3" style={{ marginTop: -4 }}>{aside}</div>}
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
  /** The role was switched on after its closing date passed (13 Oct 2026): the line shown at
   *  the top of When, asking for a new closing date first. Null when nothing to say. */
  closedNotice?: string | null;
  onClose: () => void;
  onSave: (updates: Partial<RoleSetupConfig>) => void;
  onSaveTimeline: (change: Partial<TimelineInput>, where: 'window' | 'phases') => void;
  onUpdatePhase: (phases: FeePhase[], idx: number, patch: Partial<FeePhase>) => void;
  /** "Copy from another role": the roles that have each thing set up. */
  copySources: { price: CopySource[]; window: CopySource[]; questions: CopySource[] };
  onCopyFrom: (what: 'price' | 'window' | 'questions', sourceRole: string) => void;
  /** "Remove this role" (the page confirms, switches it off and unlists it). */
  onRemove: () => void;
  /** The refusal line and the question builder. */
  formSlot: ReactNode;
  /** The after-submitting message fields (their state lives in the page). */
  afterSlot: ReactNode;
}

export function RoleSheet(props: RoleSheetProps) {
  const { conference: c, role, config, now, configVersion, timelineCtx, timelineMsg } = props;
  const currency = c.fee_currency;
  const priced = roleHasPrice(role);
  const plural = rolePlural(role);
  const st = windowState(config, now);
  const mark = STATE_MARK[st];
  const enabled = config?.is_enabled ?? false;
  const phases = config?.fee_phases ?? [];
  const active = activeFeePhase(phases);
  const datedPhases = phases.some(p => p.start_date && p.end_date);

  const prefs = role === 'delegate' || role === 'head-delegate';
  // Things to fix (src/lib/roleSetupProblems.ts), plus stage prices left blank
  // in this open pop-up (never stored, so only counted here).
  const problems = roleSetupProblems(config);
  // Keyed on the stage list and the field remount, which both refill the fields.
  const blankScope = `${phases.length}:${configVersion}`;
  const [blankPrices, setBlankPrices] = useState<{ scope: string; idx: number[] }>({ scope: '', idx: [] });
  const blankIdx = blankPrices.scope === blankScope ? blankPrices.idx : [];
  const setBlankPrice = (i: number, blank: boolean) => setBlankPrices(prev => {
    const base = prev.scope === blankScope ? prev.idx : [];
    const next = blank ? (base.includes(i) ? base : [...base, i]) : base.filter(x => x !== i);
    return { scope: blankScope, idx: next };
  });
  const dateFixes = problems.filter(p => p.section === 'dates').length;
  const priceFixes = problems.filter(p => p.section === 'prices').length + blankIdx.length;
  const openDateMissing = problems.some(p => p.key === 'open-date');
  const railSections: RailSection[] = [
    { id: 'step-when', label: 'Dates', fixes: dateFixes },
    ...(priced ? [{ id: 'step-price', label: 'Prices', fixes: priceFixes }] : []),
    ...(prefs ? [{ id: 'step-prefs', label: 'Preferences' }] : []),
    { id: 'step-form', label: 'Questions' },
    { id: 'step-after', label: 'Final Message' },
  ];
  const railKey = railSections.map(r => r.id).join('|');
  const [activeSection, setActiveSection] = useState(railSections[0].id);
  const loaded = !!config;

  const rootRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  // The body as state too (prompt 136): the sheet is portaled, and Portal
  // mounts its children a render later, so an effect reading bodyRef on the
  // first render found null and the scroll-spy never attached. A callback ref
  // re-runs it once the body really exists.
  const [bodyEl, setBodyEl] = useState<HTMLDivElement | null>(null);
  const setBody = useCallback((el: HTMLDivElement | null) => { bodyRef.current = el; setBodyEl(el); }, []);
  // A rail click pins its section until that scroll ends.
  const pinnedRef = useRef<string | null>(null);
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

  // Scroll-spy (prompt 136): a passive scroll listener on the body, throttled
  // to one read per frame. The active section is the last one whose heading
  // has passed the top third of the body; scrolled to the bottom, the LAST
  // section is active. Re-attached whenever the body or the sections change.
  useEffect(() => {
    const body = bodyEl;
    if (!body || !loaded) return;
    const ids = railKey.split('|');
    let raf = 0;
    let endTimer = 0;
    const compute = () => {
      raf = 0;
      if (pinnedRef.current) return;
      const rect = body.getBoundingClientRect();
      const line = rect.top + body.clientHeight / 3;
      let next = ids[0];
      if (body.scrollTop + body.clientHeight >= body.scrollHeight - 2) {
        next = ids[ids.length - 1];
      } else {
        for (const id of ids) {
          const h = body.querySelector<HTMLElement>(`[data-rail-heading="${id}"]`);
          if (h && h.getBoundingClientRect().top <= line) next = id;
        }
      }
      setActiveSection(prev => (prev === next ? prev : next));
    };
    const onScroll = () => {
      if (pinnedRef.current) {
        // A rail click's own scroll: keep its section until the scroll ends.
        window.clearTimeout(endTimer);
        endTimer = window.setTimeout(() => { pinnedRef.current = null; }, 160);
        return;
      }
      if (!raf) raf = requestAnimationFrame(compute);
    };
    body.addEventListener('scroll', onScroll, { passive: true });
    raf = requestAnimationFrame(compute);
    return () => {
      body.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
      window.clearTimeout(endTimer);
    };
  }, [bodyEl, railKey, loaded]);

  // On a phone the rail is a sideways row: keep the active name in view.
  // Runs when the active section changes, never per scroll event.
  const railRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const rail = railRef.current;
    if (!rail || rail.scrollWidth <= rail.clientWidth + 1) return;
    const btn = rail.querySelector<HTMLElement>('[aria-current="true"]');
    if (!btn) return;
    const left = btn.offsetLeft - 16;
    const right = btn.offsetLeft + btn.offsetWidth + 16 - rail.clientWidth;
    if (rail.scrollLeft > left) rail.scrollLeft = left;
    else if (rail.scrollLeft < right) rail.scrollLeft = right;
  }, [activeSection]);

  // One measurement on the click (never on scroll), then the body scrolls
  // itself; the heading takes focus when the scroll ends, because a focus
  // call during a smooth scroll can cancel it.
  function goToSection(id: string) {
    const body = bodyRef.current;
    const sec = body?.querySelector<HTMLElement>(`#${id}`);
    if (!body || !sec) return;
    setActiveSection(id);
    pinnedRef.current = id;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const rail = body.querySelector<HTMLElement>('.gvs-rail');
    const railOnTop = window.matchMedia?.('(max-width: 720px)').matches;
    const gap = railOnTop && rail ? rail.offsetHeight + 8 : 16;
    const top = Math.max(0, sec.getBoundingClientRect().top - body.getBoundingClientRect().top + body.scrollTop - gap);
    const heading = body.querySelector<HTMLElement>(`#${id}-h`);
    let done = false;
    const focus = () => { if (done) return; done = true; body.removeEventListener('scrollend', focus); heading?.focus({ preventScroll: true }); };
    if (reduce || Math.abs(body.scrollTop - top) < 2) {
      // No smooth scroll to wait for: the pin ends with this frame's scroll (if any).
      body.scrollTop = top; focus();
      window.setTimeout(() => { pinnedRef.current = null; }, 160);
      return;
    }
    const from = body.scrollTop;
    body.addEventListener('scrollend', focus);
    // A browser that never animates (a background frame, some embedded views)
    // still lands on the section.
    window.setTimeout(() => { if (!done && body.scrollTop === from) body.scrollTop = top; focus(); }, 900);
    body.scrollTo({ top, behavior: 'smooth' });
  }

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
        <style>{STORE_CSS}</style>
        <style>{DASH_CSS}</style>
        <style>{ROW_CSS}</style>
        <style>{RANK_PREVIEW_CSS}</style>
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
              <p className="mt-0.5" style={{ fontFamily: F, fontSize: TYPE_PX.hint, color: INK_SOFT }}>
                {props.appliedCount !== null && (
                  <><b style={{ fontSize: 22, fontWeight: 900, color: FOREST, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>{props.appliedCount}</b> applied · </>
                )}
                <span role="status" aria-live="polite">{saveWord}</span>
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="inline-flex items-center gap-1.5" style={{ fontFamily: F, fontSize: TYPE_PX.body, fontWeight: 600, color: mark.color }}>
                <mark.icon size={16} strokeWidth={2.4} aria-hidden />
                <span className="gvs-head-word">{mark.word}</span>
              </span>
              <Switch
                size="lg"
                label={`${plural} taking applications`}
                checked={enabled}
                disabled={!config}
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

          <div ref={setBody} className="gvs-body">
            <div className="gvs-layout">
            <nav ref={railRef} className="gvs-rail" aria-label="Sections">
              {railSections.map(r => (
                <button
                  key={r.id}
                  type="button"
                  className="gvs-rail-item"
                  aria-current={activeSection === r.id ? 'true' : undefined}
                  onClick={() => goToSection(r.id)}
                >
                  {r.label}
                  <FixBadge n={r.fixes ?? 0} size={20} />
                </button>
              ))}
            </nav>
            <div className="gvs-col">
              {/* ── What the switch means now, the link and the preview ── */}
              <section id="step-review" className="gv-st-card gv-fd-wash-green" style={{ padding: 'clamp(14px, 3vw, 18px)' }}>
                <p id="role-switch-line" style={{ fontFamily: F, fontSize: TYPE_PX.body, color: INK, lineHeight: 1.5, overflowWrap: 'anywhere' }}>
                  {statusLine}
                </p>
                {/* Applications never wait for payments (owner, 12 Oct 2026); only paying does. An option, never a requirement. */}
                {priced && !conferencePaymentsReady(c) && (
                  <div className="mt-3">
                    <Notice>
                      People can apply now and pay once you set up how you get paid.{' '}
                      <Link href={`/manage/${c.slug}/financials?open=payment`} style={{ ...TEXT_LINK, color: '#6B4F12' }}>Set up payments</Link>
                    </Notice>
                  </div>
                )}
              </section>

              {!config ? (
                <div aria-busy="true" className="flex flex-col gap-3">
                  {[0, 1, 2].map(i => <div key={i} className="gv-fd-ph" style={{ height: 120 }} />)}
                </div>
              ) : (
                <>
                  {/* ── When: one row ── */}
                  <Section
                    id="step-when" emoji="Spiral calendar" icon={CalendarDays} tint={TINT_GOLD_BG} title="Dates" fixes={dateFixes}
                    aside={<CopyFromMenu what="dates" emptyText="No other role has dates yet" sources={props.copySources.window} onPick={(r) => props.onCopyFrom('window', r)} />}
                  >
                    {props.closedNotice && (
                      <p role="alert" className="mb-3 rounded-xl px-3 py-2.5" style={{ fontFamily: F, fontSize: TYPE_PX.body, fontWeight: 600, lineHeight: 1.45, color: '#8B2020', backgroundColor: 'rgba(139,32,32,0.07)', boxShadow: 'inset 3px 0 0 #8B2020', overflowWrap: 'anywhere' }}>
                        {props.closedNotice}
                      </p>
                    )}
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
                          {openDateMissing && <FixLine>{OPEN_DATE_MESSAGE}</FixLine>}
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
                        <p className="mt-2" style={{ fontFamily: F, fontSize: TYPE_PX.hint, color: INK_SOFT }}>Your prices have dates, so the window follows them.</p>
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
                    <Section
                      id="step-price" emoji="Money bag" icon={Wallet} tint={TINT_GOLD_BG} title="Prices" fixes={priceFixes}
                      aside={<CopyFromMenu what="prices" emptyText="No other role has a price yet" sources={props.copySources.price} onPick={(r) => props.onCopyFrom('price', r)} />}
                    >
                      <div key={configVersion}>
                        <div className="flex items-center gap-2 flex-wrap">
                          <CurrencyChip code={c.fee_currency} width={112} />
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            placeholder="0"
                            aria-label={`${roleTitle(role)} price`}
                            defaultValue={config.fee_amount}
                            onBlur={(e) => props.onSave({ fee_amount: parseFloat(e.target.value) || 0 })}
                            style={{ ...INPUT, fontSize: TYPE_PX.card, fontWeight: 800, width: 150, flex: '0 1 150px', fontVariantNumeric: 'tabular-nums' }}
                          />
                          <span style={{ fontFamily: F, fontSize: TYPE_PX.hint, color: INK_SOFT }}>
                            {phases.length > 0 ? 'On days no stage covers. 0 is free.' : '0 is free'}
                          </span>
                        </div>
                        <ConferenceCurrencyLine code={c.fee_currency} slug={c.slug} style={{ marginTop: 6 }} />

                        <div className="mt-3">
                          <StageTable
                            phases={phases}
                            active={active}
                            configVersion={configVersion}
                            blankIdx={blankIdx}
                            onBlank={setBlankPrice}
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
                        </div>
                      </div>
                    </Section>
                  )}

                  {/* ── Preferences: delegates and head delegates, THIS role only ── */}
                  {prefs && (
                    <Section id="step-prefs" emoji="Bar chart" icon={ListOrdered} title="Preferences">
                      <PreferencePicker
                        value={config.preference_mode ?? 'none'}
                        onPick={(v) => { if (v !== (config.preference_mode ?? 'none')) props.onSave({ preference_mode: v }); }}
                      />
                    </Section>
                  )}

                  {/* ── Questions ── */}
                  <Section
                    id="step-form" emoji="Memo" icon={ListChecks} title="Questions"
                    aside={<CopyFromMenu what="questions" emptyText="No other role has questions yet" sources={props.copySources.questions} onPick={(r) => props.onCopyFrom('questions', r)} />}
                  >
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
                  <Section id="step-after" emoji="Party popper" icon={PartyPopper} tint={TINT_GOLD_BG} title="Final Message">
                    <p className="mb-3" style={{ fontFamily: F, fontSize: TYPE_PX.hint, color: INK_SOFT, lineHeight: 1.5 }}>
                      A short note on the confirmation screen, like a group chat to join. Optional.
                    </p>
                    {props.afterSlot}
                  </Section>

                  <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
                    <button
                      type="button"
                      onClick={props.onRemove}
                      className="inline-flex items-center gap-1.5 mr-auto focus:outline-none focus-visible:ring-2 rounded-lg"
                      style={{ fontFamily: F, fontSize: TYPE_PX.body, fontWeight: 700, color: DANGER, background: 'none', border: 'none', padding: '8px 4px', cursor: 'pointer' }}
                    >
                      <Trash2 size={16} strokeWidth={2.3} aria-hidden />
                      Remove this role
                    </button>
                    <span style={{ fontFamily: F, fontSize: TYPE_PX.hint, color: INK_SOFT }}>Everything saves by itself</span>
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
      </div>
    </Portal>
  );
}

// ── Preferences: four short cards, two by two ─────────────────────────────────

function PreferencePicker({ value, onPick }: { value: string; onPick: (v: string) => void }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  function onKey(e: React.KeyboardEvent, i: number) {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const n = (i + step + PREF_MODE_OPTIONS.length) % PREF_MODE_OPTIONS.length;
    refs.current[n]?.focus();
    onPick(PREF_MODE_OPTIONS[n].value);
  }
  return (
    <div role="radiogroup" aria-label="What they rank" className="gvs-prefs">
      {PREF_MODE_OPTIONS.map((o, i) => {
        const on = value === o.value;
        return (
          <div key={o.value} className="gvs-pref" data-on={on ? 'true' : undefined}>
            <button
              ref={(el) => { refs.current[i] = el; }}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={on || (!PREF_MODE_OPTIONS.some(x => x.value === value) && i === 0) ? 0 : -1}
              onClick={() => onPick(o.value)}
              onKeyDown={(e) => onKey(e, i)}
              className="gvs-pref-btn"
            >
              <RankPreview value={o.value} />
              <span className="flex items-center gap-2" style={{ paddingInlineEnd: 26 }}>
                <span
                  aria-hidden
                  className="inline-flex items-center justify-center flex-shrink-0 rounded-full"
                  style={{ width: 20, height: 20, backgroundColor: on ? FOREST : 'transparent', boxShadow: on ? 'none' : 'inset 0 0 0 1.5px rgba(27,56,40,0.28)', color: '#FFFFFF' }}
                >
                  {on && <Check size={13} strokeWidth={3.2} />}
                </span>
                <span style={{ fontSize: TYPE_PX.body, fontWeight: 700, color: INK, overflowWrap: 'anywhere' }}>{o.label}</span>
              </span>
            </button>
            <span className="gvs-pref-info">
              <InfoHint label={o.label} text={o.desc} size={18} />
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** A thing to fix, said next to the field it is about. */
function FixLine({ children }: { children: ReactNode }) {
  return (
    <p className="mt-1.5 inline-flex items-center gap-1.5" style={{ fontFamily: F, fontSize: TYPE_PX.hint, fontWeight: 700, color: '#8A6614' }}>
      <span aria-hidden className="inline-block rounded-full" style={{ width: 7, height: 7, backgroundColor: '#B6871F' }} />
      {children}
    </p>
  );
}

// ── Prices by date: a compact table ───────────────────────────────────────────

function StageTable({ phases, active, configVersion, blankIdx, onBlank, onUpdatePhase, onSaveTimeline }: {
  phases: FeePhase[];
  active: FeePhase | null;
  configVersion: number;
  /** Stages whose price field is blank right now (never written). */
  blankIdx: number[];
  onBlank: (index: number, blank: boolean) => void;
  onUpdatePhase: RoleSheetProps['onUpdatePhase'];
  onSaveTimeline: RoleSheetProps['onSaveTimeline'];
}) {
  if (phases.length === 0) return null;
  const head: React.CSSProperties = { fontFamily: F, fontSize: TYPE_PX.hint, fontWeight: 700, color: INK_SOFT };
  const cell: React.CSSProperties = { ...INPUT, padding: '8px 10px', fontSize: TYPE_PX.body };
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
                  // A blank price is never saved as free (13 Oct 2026): it stays
                  // blank and flagged until a number is typed; 0 on purpose is free.
                  onChange={(e) => onBlank(pi, e.target.value.trim() === '')}
                  onBlur={(e) => {
                    const raw = e.target.value.trim();
                    if (raw === '') { onBlank(pi, true); return; }
                    const next = parseFloat(raw);
                    if (!Number.isFinite(next)) return;
                    onBlank(pi, false);
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
                <p className="mt-1" style={{ fontFamily: F, fontSize: TYPE_PX.hint, color: DANGER }}>This stage needs both dates before it counts.</p>
              )}
              {blankIdx.includes(pi) && <FixLine>{STAGE_PRICE_MESSAGE}</FixLine>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
