'use client';

// The participant dashboard's shell and vocabulary (26 Sep 2026, owner: "do a
// redesign of the chair dashboard as well as FA, delegate, observer dashboards
// in the conference page ... MyMUN does this pretty well in essence").
//
// MyMUN's shape, in Gavelling's language: a sub-nav per conference (a sticky
// column from xl, a scrolling row of pills below it), a status row of three
// facts at the top of Overview (application, payment, what happens next as ONE
// sentence), then the assignment. Every pane is mounted once and hidden with
// display:none when it is not the one shown, so switching sections never
// refetches a card, loses a half-typed request, or drops an unsaved awards
// slate.
//
// Rules this file holds for every role (CLAUDE.md §8): white cards with a soft
// shadow on the ivory page, status as icon + plain word (never a pill), counts
// as a big number with the word beside it, sentence-case buttons in the forest
// gradient, no "…" on a name, no em dashes, no tinted band behind anything.

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowDown, ArrowRight, BadgeCheck, CheckCircle2, Clock, DoorOpen, MinusCircle, Hourglass,
} from 'lucide-react';
import { MonogramMedallion } from '@/components/CommitteeEditorModal';
import { committeeDisplayName } from '@/lib/presetNames';
import { OUTFIT, CARD_SHADOW, CHIP_STYLES, derivePaymentChip } from './shared';

export const INK = '#1C1410';
export const INK_SOFT = '#6B5F52';
export const FOREST = '#1B3828';
export const GOLD_DEEP = '#8A6614';
export const FOREST_GRADIENT = 'linear-gradient(90deg, #1B3828 0%, #2A5A3C 100%)';

// ── Cards and headings ───────────────────────────────────────────────────────

export function DashCard({ children, className = '', style, id }: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  id?: string;
}) {
  return (
    <div
      id={id}
      className={`rounded-[20px] p-5 md:p-6 ${className}`}
      style={{ backgroundColor: '#FFFFFF', boxShadow: CARD_SHADOW, ...style }}
    >
      {children}
    </div>
  );
}

/** A small label above a sans heading (liked on the taste board), never an
 *  all-capitals tracked heading on its own. `aside` sits at the inline end.
 *  `stackedHide`: the card's title says the same as the section heading above
 *  it on the one-page phone dashboard, so below xl it is left out there (the
 *  aside stays); 'label' leaves out only the small label above the title.
 *  From xl, and outside a stacked dashboard, nothing changes. */
export function CardHeading({ label, title, aside, stackedHide = false }: { label?: string; title: React.ReactNode; aside?: React.ReactNode; stackedHide?: boolean | 'label' }) {
  const stacked = useDashStacked();
  const hide = stacked && stackedHide === true;
  const hideLabel = stacked && stackedHide === 'label';
  return (
    <div className={`${hide && !aside ? 'hidden xl:flex' : 'flex'} items-start justify-between gap-3 flex-wrap mb-4`}>
      <div className={hide ? 'hidden xl:block min-w-0' : 'min-w-0'}>
        {label && (
          <p className={hideLabel ? 'hidden xl:block' : undefined} style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 700, color: GOLD_DEEP, margin: '0 0 2px 0' }}>{label}</p>
        )}
        <h3 className="[overflow-wrap:anywhere]" style={{ fontFamily: OUTFIT, fontSize: 19, fontWeight: 800, color: INK, margin: 0, lineHeight: 1.25 }}>
          {title}
        </h3>
      </div>
      {aside && <div className="flex items-center gap-2 flex-wrap">{aside}</div>}
    </div>
  );
}

// ── Buttons ─────────────────────────────────────────────────────────────────

const BTN_BASE: React.CSSProperties = {
  minHeight: 44, padding: '0 18px', borderRadius: 10, fontFamily: OUTFIT,
  fontSize: 14, fontWeight: 700, textDecoration: 'none', cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
};

/** The Airbnb button in forest (CLAUDE.md §8, taste board two). */
export function ForestLink({ href, children, external, className = '' }: {
  href: string; children: React.ReactNode; external?: boolean; className?: string;
}) {
  const style: React.CSSProperties = { ...BTN_BASE, background: FOREST_GRADIENT, color: '#FFFFFF', border: 'none', boxShadow: '0 6px 16px -8px rgba(27,56,40,0.55)' };
  const cls = `focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#B6871F] ${className}`;
  return external
    ? <a href={href} className={cls} style={style}>{children}</a>
    : <Link href={href} className={cls} style={style}>{children}</Link>;
}

/** The second action: an ink outline rectangle. */
export function OutlineLink({ href, children, className = '' }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Link
      href={href}
      className={`focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] ${className}`}
      style={{ ...BTN_BASE, background: '#FFFFFF', color: INK, border: '1.5px solid rgba(28,20,16,0.55)' }}
    >
      {children}
    </Link>
  );
}

// ── Status as icon + plain word ─────────────────────────────────────────────

export function IconWord({ icon: Icon, word, color = INK, size = 'md' }: {
  icon: LucideIcon; word: string; color?: string; size?: 'sm' | 'md' | 'lg';
}) {
  const px = size === 'lg' ? 20 : size === 'sm' ? 14 : 16;
  const fs = size === 'lg' ? 17 : size === 'sm' ? 12 : 14;
  return (
    <span className="inline-flex items-center gap-1.5" style={{ color, fontFamily: OUTFIT, fontSize: fs, fontWeight: 700, lineHeight: 1.3 }}>
      <Icon size={px} strokeWidth={2.2} aria-hidden style={{ flexShrink: 0 }} />
      {word}
    </span>
  );
}

const APP_STATUS: Record<string, { icon: LucideIcon; word: string; color: string }> = {
  submitted: { icon: Clock, word: 'Under review', color: '#8A6614' },
  accepted: { icon: CheckCircle2, word: 'Accepted', color: '#2A5A3C' },
  assigned: { icon: BadgeCheck, word: 'Assigned', color: '#2A5A3C' },
  'checked-in': { icon: DoorOpen, word: 'Checked in', color: '#2A5A3C' },
  withdrawn: { icon: MinusCircle, word: 'Withdrawn', color: INK_SOFT },
  rejected: { icon: MinusCircle, word: 'Not accepted', color: '#8B2020' },
};

export function appStatusMark(status: string) {
  return APP_STATUS[status] ?? { icon: Hourglass, word: status.replace(/-/g, ' '), color: INK_SOFT };
}

export function AppStatusMark({ status, size = 'md' }: { status: string; size?: 'sm' | 'md' | 'lg' }) {
  const s = appStatusMark(status);
  return <IconWord icon={s.icon} word={s.word} color={s.color} size={size} />;
}

/** A count: the big number with its word beside it (taste board: "LIKE A LOT"). */
export function BigCount({ n, word, of }: { n: number | string; word: string; of?: number | string }) {
  return (
    <div className="flex items-baseline gap-1.5 flex-wrap">
      <span style={{ fontFamily: OUTFIT, fontSize: 30, fontWeight: 800, color: INK, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
        {n}
        {of !== undefined && <span style={{ fontSize: 18, color: INK_SOFT, fontWeight: 700 }}> of {of}</span>}
      </span>
      <span style={{ fontFamily: OUTFIT, fontSize: 13.5, fontWeight: 600, color: INK_SOFT }}>{word}</span>
    </div>
  );
}

// ── The status row (MyMUN's three boxes) ────────────────────────────────────

export interface StatusRowInput {
  role: string;
  status: string;
  paymentStatus: string;
  selfPaid: boolean;
  amountPaid: number;
  /** The role's fee today (roleFeeToday); 0 = free, -1 = unknown. */
  feeToday: number;
  paymentTiming: string;
  hasAllocation: boolean;
  paperDeadline: string | null;
  hasSociety: boolean;
  /** The role page is locked until payment (hide_dashboard_until_paid). */
  locked?: boolean;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtDay(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

const PAID = new Set(['paid', 'waived']);

/** One sentence, from the person's real state, for "What happens next". */
export function nextStepSentence(i: StatusRowInput): string {
  const owes = i.feeToday !== 0 && !PAID.has(i.paymentStatus);
  if (i.status === 'submitted') {
    return 'The organisers are reviewing your application. You will get an email when they decide.';
  }
  if (i.status === 'checked-in') return 'You are checked in. Enjoy the conference.';
  if (owes && i.locked) return 'Pay your registration fee to unlock your conference materials.';
  switch (i.role) {
    case 'chair':
      return i.status === 'assigned'
        ? 'Read your delegates’ position papers and open your session on the day.'
        : 'The organisers will assign your committee next.';
    case 'faculty-advisor':
      return i.hasSociety
        ? 'Bring your delegates in and follow their allocations from Delegation.'
        : 'The organisers will link your delegation to your application.';
    case 'observer':
      return 'The organisers will share the event details before the conference.';
    case 'delegate':
    case 'head-delegate':
      if (!i.hasAllocation) return 'The organisers will assign your committee and country next.';
      if (i.paperDeadline && new Date(i.paperDeadline).getTime() > Date.now()) {
        return `Read your study guide and submit your position paper by ${fmtDay(i.paperDeadline)}.`;
      }
      return 'Read your study guide and prepare your speeches for the committee.';
    default:
      return owes ? 'Pay your registration fee when payments open.' : 'The organisers will share the next steps by email.';
  }
}

function Fact({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? 'col-span-2' : ''} style={{ minWidth: 0 }}>
      <p style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 700, color: INK_SOFT, margin: '0 0 6px 0' }}>{label}</p>
      {children}
    </div>
  );
}

export function StatusRow({ input }: { input: StatusRowInput }) {
  const free = input.feeToday === 0;
  const chip = derivePaymentChip(input.paymentStatus, input.selfPaid, input.amountPaid);
  const beforeAcceptance = input.paymentTiming === 'after_acceptance' && input.status === 'submitted' && !PAID.has(input.paymentStatus);
  return (
    <DashCard>
      <div className="grid grid-cols-2 gap-x-6 gap-y-5">
        <Fact label="Application">
          <AppStatusMark status={input.status} size="lg" />
        </Fact>
        <Fact label="Payment">
          {free && !PAID.has(input.paymentStatus) ? (
            <IconWord icon={MinusCircle} word="No fee" color={INK_SOFT} size="lg" />
          ) : free ? (
            <IconWord icon={CheckCircle2} word="No fee" color="#2A5A3C" size="lg" />
          ) : beforeAcceptance ? (
            <IconWord icon={Hourglass} word="After acceptance" color={INK_SOFT} size="lg" />
          ) : (
            <IconWord icon={CHIP_STYLES[chip].icon} word={CHIP_STYLES[chip].word} color={CHIP_STYLES[chip].color} size="lg" />
          )}
        </Fact>
        <div className="col-span-2" style={{ height: 1, background: 'rgba(27,56,40,0.08)' }} aria-hidden />
        <Fact label="What happens next" wide>
          <p style={{ fontFamily: OUTFIT, fontSize: 15, fontWeight: 600, color: INK, margin: 0, lineHeight: 1.5 }}>
            {nextStepSentence(input)}
          </p>
        </Fact>
      </div>
    </DashCard>
  );
}

// ── The shell: sub-nav + panes ──────────────────────────────────────────────

export interface DashSection {
  key: string;
  label: string;
  icon: LucideIcon;
}

/** True inside a DashboardShell drawn as ONE page below xl (the delegate
 *  dashboard, 10 Oct 2026, owner: "on the phone ... just have everything in
 *  one page"). Below xl every pane shows, in DOM order; from xl the sub-nav
 *  and one pane at a time, exactly as before. */
const StackedContext = createContext(false);

/** Whether the current dashboard stacks every pane below xl. */
export function useDashStacked(): boolean {
  return useContext(StackedContext);
}

/** A section's heading on the one-page phone dashboard (10 Oct 2026, owner:
 *  "there is still multiple tabs in you ... not yet clear enough"): Title
 *  Case, a duotone icon in a soft tinted disc (CLAUDE.md §8), sitting closer
 *  to its own cards than to the section above. Below xl only: from xl the
 *  sub-nav names the section. */
export function StackHeading({ title, icon: Icon }: { title: string; icon: LucideIcon }) {
  return (
    <h2
      className="xl:hidden flex items-center gap-3 mt-5 -mb-2 [overflow-wrap:anywhere]"
      style={{ fontFamily: OUTFIT, fontSize: 20, fontWeight: 800, color: INK, lineHeight: 1.25 }}
    >
      <span
        aria-hidden
        className="inline-flex items-center justify-center flex-shrink-0"
        style={{ width: 38, height: 38, borderRadius: 999, backgroundColor: 'rgba(61,122,82,0.13)' }}
      >
        <Icon size={18} strokeWidth={2.2} style={{ color: FOREST, fill: 'rgba(238,217,138,0.6)' }} />
      </span>
      <span className="min-w-0">{title}</span>
    </h2>
  );
}

/** A pane that stays mounted: display:none when it is not the one shown. In a
 *  stacked dashboard a pane that is not the one shown is hidden from xl only,
 *  so a phone or tablet reads every section on one scrolling page, each
 *  section under its `title` (drawn below xl only). `phone={false}` keeps a
 *  pane off the phone page (it would repeat what is already there) while the
 *  desktop section is unchanged. `anchor` is the id a "next step" button
 *  scrolls to. */
export function Pane({ show, children, gap = 6, title, icon, phone = true, anchor }: {
  show: boolean;
  children: React.ReactNode;
  gap?: 4 | 6;
  title?: string;
  icon?: LucideIcon;
  phone?: boolean;
  anchor?: string;
}) {
  const stacked = useContext(StackedContext);
  const flow = gap === 4 ? 'flex-col gap-4' : 'flex-col gap-6';
  const base = `flex ${flow}`;
  if (stacked) {
    const cls = !phone
      ? (show ? `hidden xl:flex ${flow}` : 'hidden')
      : (show ? base : `${base} xl:hidden`);
    return (
      <div id={anchor} className={cls} style={anchor ? { scrollMarginTop: 96 } : undefined}>
        {phone && title && icon && <StackHeading title={title} icon={icon} />}
        {children}
      </div>
    );
  }
  return (
    <div className={base} style={show ? undefined : { display: 'none' }}>
      {children}
    </div>
  );
}

// ── The next step (the first thing on the phone page) ───────────────────────

export type NextStepAction =
  | { label: string; href: string; external?: boolean }
  | { label: string; scrollTo: string };

/** What this person should do now, in one line, with at most one button. A
 *  'done' step has no button: "You're all set" and what happens next. */
export interface NextStep {
  kind: 'action' | 'done';
  line: string;
  action?: NextStepAction;
}

const NextStepReportContext = createContext<((step: NextStep | null) => void) | null>(null);
export const NextStepReportProvider = NextStepReportContext.Provider;

/** A role's own dashboard tells the page its next step (the chair's room is
 *  loaded inside ChairParticipant, not by the page). Reported by value, so a
 *  re-render with the same step changes nothing. */
export function useReportNextStep(step: NextStep | null) {
  const report = useContext(NextStepReportContext);
  const key = step ? JSON.stringify(step) : '';
  useEffect(() => {
    if (!report) return;
    report(key ? (JSON.parse(key) as NextStep) : null);
  }, [report, key]);
  useEffect(() => () => { report?.(null); }, [report]);
}

/** The page's side of useReportNextStep: a stable setter that ignores a
 *  report equal to the one it already holds. */
export function useNextStepSlot(): [NextStep | null, (step: NextStep | null) => void] {
  const [step, setStep] = useState<NextStep | null>(null);
  const report = useCallback((next: NextStep | null) => {
    setStep(prev => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
  }, []);
  return [step, report];
}

function scrollToAnchor(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
}

/** "What do I do next", answered in one line with one button, or "You're all
 *  set" when there is nothing to do. The application's status sits at the
 *  top right as icon + word. Below xl only (the desktop Overview keeps its
 *  status row). */
export function NextStepCard({ step, status }: { step: NextStep; status: string }) {
  const action = step.action;
  return (
    <DashCard className="xl:hidden">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        {step.kind === 'action' ? (
          <p style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 700, color: GOLD_DEEP, margin: 0 }}>Your next step</p>
        ) : (
          <p className="inline-flex items-center gap-2.5" style={{ fontFamily: OUTFIT, fontSize: 19, fontWeight: 800, color: INK, margin: 0 }}>
            <span aria-hidden className="inline-flex items-center justify-center flex-shrink-0" style={{ width: 36, height: 36, borderRadius: 999, backgroundColor: 'rgba(61,122,82,0.14)' }}>
              <CheckCircle2 size={19} strokeWidth={2.3} style={{ color: FOREST, fill: 'rgba(238,217,138,0.6)' }} />
            </span>
            You&apos;re all set
          </p>
        )}
        <AppStatusMark status={status} size="sm" />
      </div>
      <p
        className="[overflow-wrap:anywhere]"
        style={step.kind === 'action'
          ? { fontFamily: OUTFIT, fontSize: 18, fontWeight: 700, color: INK, margin: 0, lineHeight: 1.4 }
          : { fontFamily: OUTFIT, fontSize: 15, fontWeight: 500, color: INK_SOFT, margin: 0, lineHeight: 1.5 }}
      >
        {step.line}
      </p>
      {step.kind === 'action' && action && (
        <div className="mt-4">
          {'href' in action ? (
            <ForestLink href={action.href} external={action.external} className="w-full sm:w-auto">
              {action.label} <ArrowRight size={16} strokeWidth={2.4} aria-hidden />
            </ForestLink>
          ) : (
            <button
              type="button"
              onClick={() => scrollToAnchor(action.scrollTo)}
              className="w-full sm:w-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#B6871F]"
              style={{ ...BTN_BASE, background: FOREST_GRADIENT, color: '#FFFFFF', border: 'none', boxShadow: '0 6px 16px -8px rgba(27,56,40,0.55)' }}
            >
              {action.label} <ArrowDown size={16} strokeWidth={2.4} aria-hidden />
            </button>
          )}
        </div>
      )}
    </DashCard>
  );
}

function NavItem({ s, on, onSelect, row }: { s: DashSection; on: boolean; onSelect: () => void; row: boolean }) {
  const Icon = s.icon;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={on ? 'page' : undefined}
      className={`${row ? 'flex-shrink-0' : 'w-full'} inline-flex items-center gap-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F]`}
      style={{
        minHeight: 44, padding: row ? '0 14px 0 6px' : '0 12px 0 6px', borderRadius: 999,
        border: 'none', cursor: 'pointer', textAlign: 'start',
        backgroundColor: on ? '#FFFFFF' : 'transparent',
        boxShadow: on ? CARD_SHADOW : 'none',
        color: on ? FOREST : INK_SOFT,
        fontFamily: OUTFIT, fontSize: 14, fontWeight: on ? 800 : 600,
        transition: 'background-color 180ms ease, box-shadow 180ms ease, color 180ms ease',
      }}
    >
      {/* The icon in a soft tinted disc (the taste board's acceptable form):
          a pale green fill when active, a faint wash otherwise. */}
      <span
        aria-hidden
        className="inline-flex items-center justify-center flex-shrink-0"
        style={{ width: 32, height: 32, borderRadius: 999, backgroundColor: on ? 'rgba(61,122,82,0.14)' : 'rgba(27,56,40,0.05)' }}
      >
        <Icon size={16} strokeWidth={2.2} style={{ color: on ? FOREST : INK_SOFT, fill: on ? 'rgba(238,217,138,0.55)' : 'none' }} />
      </span>
      <span style={{ whiteSpace: 'nowrap' }}>{s.label}</span>
    </button>
  );
}

/** Sub-nav on the left from xl (sticky under the fixed site nav), a scrolling
 *  pill row above the content below that. With `stackBelowXl` there is no pill
 *  row: below xl every pane is shown, one after another, on one page (the
 *  pills hid sections off the edge of a phone, and a delegate could not tell
 *  where anything was). */
export function DashboardShell({ sections, active, onSelect, children, ariaLabel, stackBelowXl = false }: {
  sections: DashSection[];
  active: string;
  onSelect: (key: string) => void;
  children: React.ReactNode;
  ariaLabel: string;
  stackBelowXl?: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  // Fade whichever edge of the phone pill row has more pills beyond it.
  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    const update = () => {
      const left = el.scrollLeft > 2;
      const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
      setEdges(prev => (prev.left === left && prev.right === right ? prev : { left, right }));
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => { el.removeEventListener('scroll', update); ro.disconnect(); };
  }, []);

  // Keep the active pill in view on phones.
  useEffect(() => {
    const el = rowRef.current?.querySelector<HTMLElement>('[aria-current="page"]');
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [active]);

  function select(key: string) {
    onSelect(key);
    // After a switch far down a long pane, bring the top of the dashboard back.
    const top = rootRef.current?.getBoundingClientRect().top ?? 0;
    if (top < 0) rootRef.current?.scrollIntoView({ block: 'start' });
  }

  const mask = `linear-gradient(90deg, ${edges.left ? 'transparent 0, #000 28px' : '#000 0'}, ${edges.right ? '#000 calc(100% - 28px), transparent 100%' : '#000 100%'})`;

  return (
    <div ref={rootRef} className="flex flex-col xl:flex-row gap-5 xl:gap-7" style={{ scrollMarginTop: 96 }}>
      <nav aria-label={ariaLabel} className={`${stackBelowXl ? 'hidden xl:block ' : ''}xl:w-[176px] xl:flex-shrink-0`}>
        {/* Phones and tablets: a row of pills that scrolls sideways (not in a
            stacked dashboard, which shows every section instead). */}
        {!stackBelowXl && (
        <div
          ref={rowRef}
          className="xl:hidden flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ WebkitMaskImage: mask, maskImage: mask, padding: '6px 2px 10px' }}
        >
          {sections.map(s => <NavItem key={s.key} s={s} on={s.key === active} onSelect={() => select(s.key)} row />)}
        </div>
        )}
        {/* Desktop: a sticky column. */}
        <div className="hidden xl:flex flex-col gap-1 sticky top-[96px]">
          {sections.map(s => <NavItem key={s.key} s={s} on={s.key === active} onSelect={() => select(s.key)} row={false} />)}
        </div>
      </nav>
      <div className="flex-1 min-w-0 @container">
        <StackedContext.Provider value={stackBelowXl}>{children}</StackedContext.Provider>
      </div>
    </div>
  );
}

// ── Committee identity ─────────────────────────────────────────────────────

/** The committee's own logo, else its monogram medallion. */
export function CommitteeEmblem({ logoUrl, name, abbreviation, size = 48, isCrisis = false }: {
  logoUrl: string | null; name: string; abbreviation: string | null; size?: number; isCrisis?: boolean;
}) {
  if (logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logoUrl} alt="" style={{ width: size, height: size, objectFit: 'contain', flexShrink: 0, filter: 'drop-shadow(0 6px 12px rgba(27,56,40,0.22))' }} />;
  }
  return <MonogramMedallion text={abbreviation || name} isCrisis={isCrisis} size={size} />;
}

/** Two rows, never an ellipsis (CLAUDE.md §8): the short form big, the full
 *  name small beneath it, both wrapping. One row when there is no short form. */
export function TwoRowName({ short, full, size = 17 }: { short: string; full?: string | null; size?: number }) {
  const showFull = !!full && full.trim() !== short.trim();
  return (
    <div className="min-w-0">
      <p className="[overflow-wrap:anywhere]" style={{ fontFamily: OUTFIT, fontSize: size, fontWeight: 800, color: INK, margin: 0, lineHeight: 1.2 }}>{short}</p>
      {showFull && (
        <p className="[overflow-wrap:anywhere]" style={{ fontFamily: OUTFIT, fontSize: Math.max(12, Math.round(size * 0.72)), fontWeight: 500, color: INK_SOFT, margin: '2px 0 0 0', lineHeight: 1.35 }}>{full}</p>
      )}
    </div>
  );
}

export function committeeShort(name: string, abbreviation: string | null): string {
  return (abbreviation ?? '').trim() || committeeDisplayName(name, abbreviation);
}
