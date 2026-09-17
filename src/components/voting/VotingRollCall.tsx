'use client';

/**
 * VotingRollCall: the roll call every new ballot on /voting/[code] passes through.
 *
 * Owner, 17 Sep 2026: "The roll call should be conducted right after clicking on 'Vote'.
 * Bring back a similar roll call to what is at the start, with bookmark tabs on the side
 * to set up the voting." It replaced the two-column PreVoteScreen.
 *
 * The look is the session's initial full-screen roll call (RollCallPanel with
 * `isRollCallPhase`, the "bigRoll" sizing): a forest card, projector-sized rows (54px round
 * flags, 21px names, 70px rows), the three-state A / P / PV slider, the megaphone observer
 * toggle beside it with the word "observer" under an observer's megaphone, and Clear All /
 * All Present / All P+V. It is a sibling of RollCallPanel, not an instance of it: that panel
 * owns Begin Session (`beginSessionAfterRollCall`, a phase change) and writes observers
 * itself, neither of which this page may do.
 *
 * The card is centred on the screen; the rules sit to its right (owner, 17 Sep 2026). Three
 * icon ribbons (Threshold with quorum, Abstentions, Veto), in the manner of the Settings
 * spine, hang off a drawer that slides out from under the card. Threshold is open on arrival;
 * pressing an open ribbon again (or the drawer's X, or Escape) folds it away. The veto holders
 * are a vertical list of large rows. From xl the page reserves the drawer + ribbons' width on
 * the card's other side too, so opening or folding the drawer never moves the card. Below xl
 * the ribbons sit in a row above the card and the drawer opens beneath them.
 *
 * It owns no rule state and writes nothing. Statuses go through `onSetStatus` /
 * `onBulkStatus`, observers through `onToggleObserver`, rules through `onRulesChange` with
 * only the changed keys (the page's `applyRules`, one patch, AGENTS.md rule 12). The
 * pass/fail maths is `computeVoteOutcome`, the function the ballot uses.
 *
 * Only the Moderator's device renders it (the page gates it on `!isViewOnly`); `readOnly`
 * still disables every control.
 */

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { ArrowLeft, CircleSlash, Megaphone, Scale, ShieldCheck, X, type LucideIcon } from 'lucide-react';
import Portal from '@/components/Portal';
import { SeatCircleFlag, SIDEBAR_MONOGRAM } from '@/components/CircleFlag';
import { useT, useLanguage } from '@/contexts/LanguageContext';
import { getCountryDisplayName, compareCountryNames } from '@/lib/countries';
import type { CommitteeSettings } from '@/lib/settingsStore';
import type { Delegate, DelegateStatus } from '@/lib/types';
import { computeVoteOutcome } from '@/components/VotingRulesPanel';
import { vetoEntryMatches } from '@/lib/vetoMatch';
import { VetoCountryPicker } from '@/components/voting/VetoCountryPicker';

const INK = '#1C1410';
const INK_SOFT = '#6A5A4A';
const FOREST = '#1B3828';
const GOLD = '#EED98A';
/** The drawer's visible width, how far it tucks under the card's rounded edge, and the
 *  icon ribbons' width. Side by side from xl (1280px): the card stays centred on the screen,
 *  so the same width is reserved on its inline-start side as the drawer + ribbons take on its
 *  inline-end side. Wider screens get a wider drawer. */
const DRAWER_W = 300;
const DRAWER_W_2XL = 380;
const RIBBON_W = 76;
const RIBBON_W_ON = 84;
const TUCK = 24;
const EASE = 'cubic-bezier(0.32,0.72,0,1)';
const PRESS = 'transition-[background-color,color,box-shadow,transform] duration-150 active:scale-[0.96] motion-reduce:transition-none motion-reduce:active:scale-100';
const GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23grain)' opacity='1'/%3E%3C/svg%3E")`;

/** Quorum is part of the Threshold bookmark (owner, 17 Sep 2026). */
type RuleTab = 'threshold' | 'abstentions' | 'veto';

export interface VotingRollCallProps {
  delegates: Delegate[];
  rollCallStatuses: Record<string, DelegateStatus>;
  isObserverSeat: (d: Delegate) => boolean;
  onToggleObserver: (d: Delegate) => void;
  onSetStatus: (id: string, status: DelegateStatus) => void;
  /** Every seat to one status (observers get Present for All P+V). */
  onBulkStatus: (status: DelegateStatus) => void;
  onConfirm: () => void;
  onClose: () => void;
  /** The draft resolution this roll call opens a vote on. Null: a roll call on its own. */
  doc?: { code: string; title: string } | null;
  settings: CommitteeSettings;
  /** Only the changed keys. */
  onRulesChange: (patch: Partial<CommitteeSettings>) => void;
  onVetoModeChange: (mode: CommitteeSettings['vetoMode']) => void;
  /** The veto seats in force (P5 list or the custom list). */
  vetoEntries: string[];
  readOnly?: boolean;
  /** Drawn above the primary action: the device-voting switch and join check (DeviceVoteGate). */
  footerExtra?: ReactNode;
  /** Start is not allowed yet (a device ballot with delegations not joined on a device). */
  confirmBlocked?: boolean;
}

// ── The session roll call's slider, projector size ───────────────────────────
// Same geometry as RollCallPanel's StatusSlider `large` (44px track and segments, the thumb
// centred on its segment in the padding box). One difference: a pointer press lands on the
// segment under it instead of cycling, so a chair can go straight from Absent to P+V; the
// keyboard (Enter / Space) still cycles.
function StatusSlider({ status, isObserver, onPick, label, disabled }: {
  status: DelegateStatus; isObserver: boolean; onPick: (s: DelegateStatus) => void; label: string; disabled?: boolean;
}) {
  const seg = 44;
  const h = 44;
  const thumbW = 40;
  const thumbH = 36;
  const values: DelegateStatus[] = isObserver ? ['absent', 'present'] : ['absent', 'present', 'present-voting'];
  const keys = isObserver ? ['A', 'P'] : ['A', 'P', 'PV'];
  const index = status === 'absent' ? 0 : isObserver || status === 'present' ? 1 : 2;
  const thumbColor = status === 'absent' ? '#8B2020' : status === 'present' || isObserver ? '#3D7A52' : '#B6871F';
  const innerW = seg * values.length - 3;
  const innerH = h - 3;
  const cellW = innerW / values.length;
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={label}
      onClick={(e) => {
        if (e.detail === 0) { onPick(values[(index + 1) % values.length]); return; }   // keyboard
        const box = e.currentTarget.getBoundingClientRect();
        const rtl = getComputedStyle(e.currentTarget).direction === 'rtl';
        const frac = (e.clientX - box.left) / Math.max(1, box.width);
        const i = Math.min(values.length - 1, Math.max(0, Math.floor((rtl ? 1 - frac : frac) * values.length)));
        onPick(i === index ? values[(index + 1) % values.length] : values[i]);
      }}
      className="relative rounded-full cursor-pointer shrink-0 select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EED98A]/80 disabled:cursor-not-allowed"
      style={{ width: seg * values.length, height: h, backgroundColor: 'rgba(255,255,255,0.10)', border: '1.5px solid rgba(255,255,255,0.22)' }}
    >
      <div className="absolute inset-0 grid items-center pointer-events-none" style={{ gridTemplateColumns: `repeat(${values.length}, 1fr)` }}>
        {keys.map((k, i) => (
          <span key={k} className={`text-[13.5px] font-extrabold text-center relative z-[1] ${i === index ? 'text-white' : 'text-white/40'}`}>{k}</span>
        ))}
      </div>
      <div
        className="absolute rounded-full shadow-sm transition-[inset-inline-start,background-color] duration-200 motion-reduce:transition-none"
        style={{ top: (innerH - thumbH) / 2, width: thumbW, height: thumbH, insetInlineStart: index * cellW + (cellW - thumbW) / 2, backgroundColor: thumbColor }}
      />
    </button>
  );
}

/** A radio group of calm options, each with an optional second line. */
function Choice<T extends string>({ value, options, onChange, label, disabled }: {
  value: T;
  options: { value: T; label: string; sub?: string }[];
  onChange: (v: T) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid gap-2" style={{ gridTemplateColumns: options.some((o) => o.sub) ? '1fr' : 'repeat(2, minmax(0, 1fr))' }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={disabled}
            onClick={() => { if (!on) onChange(o.value); }}
            className={`min-h-12 rounded-2xl px-4 py-2.5 text-start focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] disabled:cursor-not-allowed ${PRESS}`}
            style={{
              backgroundColor: on ? FOREST : '#FCFAF5',
              color: on ? GOLD : INK,
              boxShadow: on ? '0 1px 2px rgba(27,56,40,0.25), 0 6px 16px rgba(27,56,40,0.18)' : '0 0 0 1px rgba(27,56,40,0.10)',
              opacity: disabled && !on ? 0.6 : 1,
            }}
          >
            <span className="block text-[15px] font-semibold leading-tight">{o.label}</span>
            {o.sub && (
              <span className="block text-[13px] font-medium leading-snug mt-0.5" style={{ color: on ? 'rgba(238,217,138,0.8)' : INK_SOFT }}>
                {o.sub}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <label className="flex items-center gap-3 min-h-14" style={{ opacity: disabled ? 0.45 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}>
      <span className="flex-1 text-[15px] font-semibold leading-snug" style={{ color: INK }}>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className="relative shrink-0 w-12 h-7 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] transition-[background-color] duration-200 motion-reduce:transition-none disabled:cursor-not-allowed"
        style={{ backgroundColor: checked ? '#3D7A52' : 'rgba(27,56,40,0.18)' }}
      >
        <span
          className="absolute top-1 start-1 w-5 h-5 rounded-full bg-white transition-transform duration-200 motion-reduce:transition-none"
          style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.3)', transform: checked ? 'translateX(calc(var(--gv-dir, 1) * 20px))' : 'translateX(0)' }}
        />
      </button>
    </label>
  );
}

/** The one-sentence consequence of the rule, under its controls. */
function Note({ children, warn = false }: { children: ReactNode; warn?: boolean }) {
  return (
    <p className="text-[14px] font-medium leading-snug mt-4 rounded-2xl px-4 py-3 [text-wrap:pretty]"
      style={{ backgroundColor: warn ? 'rgba(139,32,32,0.08)' : 'rgba(27,56,40,0.06)', color: warn ? '#8B2020' : INK_SOFT }}>
      {children}
    </p>
  );
}

export function VotingRollCall({
  delegates, rollCallStatuses, isObserverSeat, onToggleObserver, onSetStatus, onBulkStatus, onConfirm, onClose,
  doc = null, settings, onRulesChange, onVetoModeChange, vetoEntries, readOnly = false,
  footerExtra = null, confirmBlocked = false,
}: VotingRollCallProps) {
  const t = useT();
  const { language } = useLanguage();
  const rtl = language === 'ar';
  // The pass threshold is open on arrival (owner, 17 Sep 2026).
  const [tab, setTab] = useState<RuleTab | null>('threshold');
  // The drawer keeps showing the last tab while it folds away.
  const [shownTab, setShownTab] = useState<RuleTab>('threshold');
  const rootRef = useRef<HTMLDivElement>(null);

  // Focus lands inside the roll call, so Escape and Tab start here, and goes back to whatever
  // opened it (the Vote Again button, a picker card) when it closes.
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    rootRef.current?.focus({ preventScroll: true });
    return () => {
      if (opener && opener.isConnected && opener !== document.body) opener.focus({ preventScroll: true });
    };
  }, []);

  // No Tab trap and no aria-modal: the roll call sits BELOW the page's top bar (session code,
  // Chat, Scoreboard, Settings, End debate), which stays usable, so keyboard and screen-reader
  // users must be able to reach it too. It is a labelled region; the top bar comes before it in
  // the document, so Shift+Tab from the first control lands there.

  // Escape folds the open drawer first, then leaves the roll call. On the window, not the
  // dialog, so it works wherever focus is (a click on a row's background leaves it on the
  // body). The veto picker's list stops its own Escape before it gets here.
  const escRef = useRef({ drawerOpen: false, onClose });
  useEffect(() => { escRef.current = { drawerOpen: tab !== null, onClose }; });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      // A dialog opened from the top bar over the roll call (Chat, Scoreboard, Settings, the
      // session code) closes on its own Escape; the roll call stays.
      const root = rootRef.current;
      const other = Array.from(document.querySelectorAll('[role="dialog"], [role="alertdialog"], [aria-modal="true"]'))
        .some((el) => root && el !== root && !root.contains(el));
      if (other) return;
      e.preventDefault();
      if (escRef.current.drawerOpen) setTab(null); else escRef.current.onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const statusOf = (d: Delegate): DelegateStatus => rollCallStatuses[d.id] ?? d.status;
  const seats = [...delegates].sort((a, b) => compareCountryNames(a.country, b.country, language));
  const votable = seats.filter((d) => !isObserverSeat(d));
  const presentCount = votable.filter((d) => statusOf(d) !== 'absent').length;
  const roomPresent = seats.filter((d) => statusOf(d) !== 'absent').length;

  const outcome = computeVoteOutcome({
    tally: { forCount: presentCount, againstCount: 0, abstainCount: 0 },
    rules: settings,
    presentCount,
    totalCount: votable.length,
    vetoBlocked: false,
    unanimousFail: false,
  });

  const vetoOn = settings.vetoMode === 'p5' || settings.vetoMode === 'custom';
  const seatedVeto = vetoOn ? votable.filter((d) => vetoEntries.some((e) => vetoEntryMatches(e, d.country))) : [];
  const consensus = settings.substantiveThreshold === 'consensus';

  const thresholdFact = consensus
    ? t('voting_rc_needed_consensus')
    : presentCount === 0
    ? t('voting_mark_present')
    : t('voting_rc_needed_line', { needed: outcome.needed, n: presentCount });
  const abstentionFact = !settings.allowAbstentions
    ? t('voting_rc_abstain_off')
    : outcome.countsAbstentions ? t('voting_rc_abstain_counted') : t('voting_rc_abstain_excluded');
  const vetoFact: { text: string; warn: boolean } = settings.vetoMode === 'unanimous'
    ? { text: t('voting_rc_veto_unanimous_line'), warn: false }
    : !vetoOn
    ? { text: t('voting_rc_veto_off_line'), warn: false }
    : seatedVeto.length === 0
    ? { text: t('voting_veto_none_seated'), warn: true }
    : { text: t('voting_rc_veto_line', { names: seatedVeto.map((d) => getCountryDisplayName(d.country, language)).join(rtl ? '، ' : ', ') }), warn: false };
  const quorumFact: { text: string; warn: boolean } = outcome.quorumNeeded === 0
    ? { text: t('voting_rc_quorum_none'), warn: false }
    : outcome.quorumMet
    ? { text: t('voting_rc_quorum_met', { present: presentCount, needed: outcome.quorumNeeded }), warn: false }
    : { text: t('voting_rc_quorum_not_met', { present: presentCount, needed: outcome.quorumNeeded }), warn: true };

  const thresholdValue = settings.substantiveThreshold === 'supermajority-2-3' ? '2/3'
    : consensus ? t('voting_rules_threshold_consensus') : t('voting_rules_threshold_simple');
  const abstValue = !settings.allowAbstentions ? t('voting_rc_tab_abst_off')
    : outcome.countsAbstentions ? t('voting_rc_tab_abst_counted') : t('voting_rc_tab_abst_excluded');
  const vetoValue = settings.vetoMode === 'p5' ? 'P5'
    : settings.vetoMode === 'custom' ? `${t('voting_rules_veto_custom_short')} · ${vetoEntries.length}`
    : settings.vetoMode === 'unanimous' ? t('voting_rc_veto_unanimous') : t('voting_rules_veto_off');
  const quorumValue = settings.quorumThreshold === 'none' ? t('voting_rules_quorum_none_short') : settings.quorumThreshold.replace('-', '/');

  const tabs: { key: RuleTab; label: string; value: string; icon: LucideIcon; warn?: boolean }[] = [
    { key: 'threshold', label: t('voting_rules_threshold_info_title'), value: `${thresholdValue} · ${t('voting_rules_quorum_info_title')} ${quorumValue}`, icon: Scale, warn: quorumFact.warn },
    { key: 'abstentions', label: t('voting_abstain_label'), value: abstValue, icon: CircleSlash },
    { key: 'veto', label: t('voting_rules_veto_info_title'), value: vetoValue, icon: ShieldCheck, warn: vetoFact.warn },
  ];
  const openTab = (key: RuleTab) => {
    if (tab === key) { setTab(null); return; }
    setShownTab(key);
    setTab(key);
  };
  const onTabKey = (e: React.KeyboardEvent, i: number) => {
    let next = -1;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = (i + 1) % tabs.length;
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') next = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    if (next < 0) return;
    e.preventDefault();
    const key = tabs[next].key;
    // Within the tablist the key was pressed in: below lg the ribbons (which carry the ids) are
    // hidden, so an id lookup focused nothing there.
    (e.currentTarget as HTMLElement).closest('[role="tablist"]')?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
    if (tab !== null) { setShownTab(key); setTab(key); }
  };

  const canConfirm = presentCount > 0 && !readOnly && !(doc && confirmBlocked);
  const drawerOpen = tab !== null;
  const active = tabs.find((x) => x.key === shownTab) ?? tabs[0];

  const bulkBtn = `font-bold uppercase tracking-wide transition-colors gv-lift-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EED98A]/70 text-[13.5px] px-3 py-3.5 min-h-[48px] rounded-xl disabled:opacity-40 disabled:cursor-not-allowed`;

  // Ribbon: square where it meets the card or drawer, a swallowtail notch at its free end.
  const ribbon = rtl
    ? 'polygon(0 0, 100% 0, 100% 100%, 0 100%, 10px 50%)'
    : 'polygon(0 0, 100% 0, calc(100% - 10px) 50%, 100% 100%, 0 100%)';

  return (
    <Portal>
      <div
        ref={rootRef}
        tabIndex={-1}
        // Below the page's 44px top bar, never over it: the session code, Chat, Scoreboard and
        // Settings stay on screen through the roll call too (owner, 17 Sep 2026).
        className="gv-rc fixed inset-x-0 bottom-0 top-11 z-50 flex flex-col focus:outline-none"
        style={{ backgroundColor: '#EDE7D8', ['--gv-dir' as string]: rtl ? -1 : 1 }}
        dir={rtl ? 'rtl' : undefined}
        role="region"
        aria-labelledby="gv-rc-title"
      >
        <style>{`
          @keyframes gvRcIn { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: none } }
          .gv-rc .gv-rc-in { animation: gvRcIn 360ms ${EASE} backwards }
          .gv-rc .gv-rc-in-2 { animation-delay: 80ms }
          .gv-rc-list { scrollbar-width: none } .gv-rc-list::-webkit-scrollbar { display: none }
          .gv-rc-drawer { display: none }
          .gv-rc-drawer[data-open="true"] { display: block; max-height: 46% }
          .gv-rc-tab:not([aria-selected="true"]):hover { filter: brightness(1.18) }
          .gv-rc-tab:focus-visible .gv-rc-stitch { border: 2px solid #B6871F !important }
          .gv-rc-side-l { display: none } .gv-rc-side-r { display: contents }
          @media (min-width: 1280px) {
            .gv-rc { --gv-rc-d: ${DRAWER_W}px }
            .gv-rc-side-l { display: block; flex: 0 0 calc(var(--gv-rc-d) + ${RIBBON_W_ON}px - 12px) }
            .gv-rc-side-r { display: flex; flex: 0 0 calc(var(--gv-rc-d) + ${RIBBON_W_ON}px - 12px); min-height: 0 }
            .gv-rc-card { flex: 0 1 672px !important; width: auto !important }
            .gv-rc-panel { width: calc(var(--gv-rc-d) + ${TUCK}px) !important; padding-inline-start: ${TUCK}px }
            .gv-rc-drawer, .gv-rc-drawer[data-open="true"] { display: block; max-height: none; width: ${TUCK}px; margin-inline-start: -${TUCK}px; transition: width 300ms ${EASE} }
            .gv-rc-drawer[data-open="true"] { width: calc(var(--gv-rc-d) + ${TUCK}px) }
          }
          @media (min-width: 1536px) { .gv-rc { --gv-rc-d: ${DRAWER_W_2XL}px } }
          @media (prefers-reduced-motion: reduce) { .gv-rc .gv-rc-in { animation: none } .gv-rc-drawer, .gv-rc-drawer[data-open="true"] { transition: none } }
        `}</style>

        {/* Top line: the way back and what this roll call is for */}
        <div className="gv-rc-in shrink-0 flex items-center gap-3 px-4 sm:px-6 h-16">
          <button
            type="button"
            onClick={onClose}
            className={`inline-flex items-center gap-2 h-10 ps-2.5 pe-4 rounded-full text-[14px] font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] hover:bg-[rgba(27,56,40,0.08)] ${PRESS}`}
            style={{ color: INK_SOFT }}
          >
            <ArrowLeft size={17} strokeWidth={2.25} aria-hidden style={{ transform: rtl ? 'scaleX(-1)' : undefined }} />
            {t('voting_rc_back')}
          </button>
          <h1 id="gv-rc-title" className="min-w-0 flex-1 truncate text-[19px] sm:text-[21px] font-bold leading-tight" style={{ color: INK, letterSpacing: '-0.01em' }}>
            {doc ? t('voting_rc_for_doc', { code: doc.code }) : t('voting_roll_call_heading')}
            {doc?.title && <span className="font-medium text-[15px] sm:text-[16px] ms-3" style={{ color: INK_SOFT, letterSpacing: 0 }}>{doc.title}</span>}
          </h1>
        </div>

        <div className="flex-1 min-h-0 px-4 sm:px-6 pb-4 sm:pb-5 flex justify-center">
          <div className="gv-rc-in gv-rc-in-2 h-full min-h-0 w-full max-w-[720px] xl:max-w-none flex flex-col xl:flex-row xl:justify-center items-stretch">

            {/* Bookmarks, small screens: a row above the card */}
            <div role="tablist" aria-label={t('voting_rules_title')} className="xl:hidden shrink-0 flex gap-1.5 overflow-x-auto pb-2 [scrollbar-width:none]">
              {tabs.map((x, i) => {
                const on = tab === x.key;
                return (
                  <button key={x.key} type="button" role="tab" aria-selected={on} aria-controls="gv-rc-drawer"
                    onClick={() => openTab(x.key)} onKeyDown={(e) => onTabKey(e, i)}
                    className={`shrink-0 rounded-xl px-3 py-2 text-start focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] ${PRESS}`}
                    style={{ backgroundColor: on ? GOLD : FOREST, color: on ? FOREST : 'rgba(243,234,208,0.85)' }}>
                    <span className="block text-[11.5px] font-semibold">{x.label}</span>
                    <span className="block text-[14px] font-bold" style={{ color: x.warn && !on ? '#F6B4B4' : undefined }}>{x.value}</span>
                  </button>
                );
              })}
            </div>

            {/* xl and up: the same width as the drawer + ribbons on the other side, so the card
                sits in the middle of the screen whether the drawer is open or folded. */}
            <div aria-hidden className="gv-rc-side-l" />

            {/* ── The roll call card (the session's pre-session card) ── */}
            <section
              className="gv-rc-card order-3 xl:order-none relative flex flex-col min-h-0 flex-1 rounded-3xl overflow-hidden"
              style={{ minWidth: 0, backgroundColor: FOREST, border: '1.5px solid #3D7A52', boxShadow: '0 32px 80px rgba(27,56,40,0.40)', zIndex: 2 }}
              aria-label={t('voting_roll_call_heading')}
            >
              <div className="pointer-events-none absolute inset-0 z-[1]" style={{ backgroundImage: GRAIN, backgroundSize: '300px 300px', mixBlendMode: 'overlay', opacity: 0.07 }} />
              <div className="relative z-[2] shrink-0 px-5 pt-4 pb-2.5">
                <div className="flex items-baseline justify-between gap-3 mb-3">
                  <p className="text-[18px] font-black leading-tight truncate" style={{ color: GOLD }}>{t('voting_roll_call_heading')}</p>
                  <p className="shrink-0 text-[14px] font-bold tabular-nums" style={{ color: 'rgba(237,231,216,0.8)' }} aria-live="polite">
                    {roomPresent}/{seats.length} {t('voting_rc_present')}
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-2.5">
                  <button type="button" disabled={readOnly || seats.length === 0} onClick={() => onBulkStatus('absent')} className={bulkBtn} style={{ backgroundColor: 'rgba(139,32,32,0.30)', color: '#F6B4B4' }}>{t('rollcall_clear_all')}</button>
                  <button type="button" disabled={readOnly || seats.length === 0} onClick={() => onBulkStatus('present')} className={bulkBtn} style={{ backgroundColor: 'rgba(61,122,82,0.40)', color: '#EDE7D8' }}>{t('rollcall_all_present')}</button>
                  <button type="button" disabled={readOnly || seats.length === 0} onClick={() => onBulkStatus('present-voting')} className={bulkBtn} style={{ backgroundColor: 'rgba(182,135,31,0.30)', color: GOLD }}>{t('rollcall_all_pv')}</button>
                </div>
              </div>

              <div
                tabIndex={0}
                aria-label={t('rollcall_list_label')}
                className="gv-rc-list relative z-[2] flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 pt-1.5 space-y-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#EED98A]/50"
                style={{ paddingBottom: 24 }}
              >
                {seats.length === 0 && (
                  <p className="text-[15px] py-8 text-center" style={{ color: 'rgba(237,231,216,0.72)' }}>{t('rollcall_add_delegate')}</p>
                )}
                {seats.map((d) => {
                  const s = statusOf(d);
                  const observer = isObserverSeat(d);
                  const name = getCountryDisplayName(d.country, language);
                  const bg = s === 'absent' ? 'transparent' : s === 'present' || observer ? 'rgba(61,122,82,0.26)' : 'rgba(182,135,31,0.20)';
                  const bgHover = s === 'absent' ? 'rgba(237,231,216,0.06)' : s === 'present' || observer ? 'rgba(61,122,82,0.40)' : 'rgba(182,135,31,0.32)';
                  const statusName = s === 'absent' ? t('voting_rc_status_absent') : s === 'present' || observer ? t('voting_rc_status_present') : t('voting_rc_status_pv');
                  return (
                    <div
                      key={d.id}
                      className="flex items-center gap-3.5 px-3 rounded-2xl transition-[background-color] duration-150 motion-reduce:transition-none bg-[var(--row-bg)] hover:bg-[var(--row-bg-hover)]"
                      style={{ ['--row-bg' as string]: bg, ['--row-bg-hover' as string]: bgHover, minHeight: 70, paddingBlock: 8 } as CSSProperties}
                    >
                      <SeatCircleFlag
                        country={d.country}
                        size={54}
                        decorative
                        fallback="initials"
                        monogramColors={SIDEBAR_MONOGRAM}
                        ring="rgba(255,255,255,0.18)"
                        style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.30), 0 2px 7px rgba(0,0,0,0.22)' }}
                      />
                      <span className="flex-1 min-w-0 truncate" style={{ fontSize: 21, fontWeight: 600, lineHeight: 1.2, color: '#F4EFE3' }}>{name}</span>
                      <div className={`shrink-0 flex items-center gap-2.5 ${readOnly ? 'opacity-50' : ''}`}>
                        {/* Fixed width on every row, so the word under an observer's megaphone
                            never shifts the slider column. */}
                        <span className="shrink-0 flex flex-col items-center" style={{ width: 66 }}>
                          <button
                            type="button"
                            onClick={() => onToggleObserver(d)}
                            disabled={readOnly}
                            title={observer ? t('rollcall_observer_remove') : t('rollcall_observer_make')}
                            aria-label={`${observer ? t('rollcall_observer_remove') : t('rollcall_observer_make')}: ${name}`}
                            aria-pressed={observer}
                            className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 transition-[background-color,color,transform,box-shadow] duration-150 active:scale-[0.92] motion-reduce:transition-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EED98A]/80 hover:brightness-125 disabled:cursor-not-allowed"
                            style={{
                              backgroundColor: observer ? GOLD : 'rgba(237,231,216,0.06)',
                              color: observer ? FOREST : 'rgba(237,231,216,0.42)',
                              boxShadow: observer ? '0 1px 3px rgba(0,0,0,0.3)' : 'inset 0 0 0 1.5px rgba(237,231,216,0.14)',
                            }}
                          >
                            <Megaphone size={19} strokeWidth={2.4} aria-hidden />
                          </button>
                          {observer && (
                            <span aria-hidden className="whitespace-nowrap uppercase" style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.03em', lineHeight: 1.1, color: GOLD, marginTop: 2 }}>
                              {t('rollcall_observer')}
                            </span>
                          )}
                        </span>
                        <div className="flex justify-start" style={{ width: 132 }}>
                          <StatusSlider
                            status={s}
                            isObserver={observer}
                            disabled={readOnly}
                            label={`${name}: ${statusName}`}
                            onPick={(next) => { if (next !== s) onSetStatus(d.id, next); }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {footerExtra}
              {/* The one primary action, where Begin Session sits on the session's roll call */}
              <div className="relative z-[2] shrink-0 px-4 py-3.5 flex items-center gap-4" style={{ backgroundColor: 'rgba(0,0,0,0.14)' }}>
                {doc && presentCount > 0 && (
                  <p className="hidden sm:block shrink-0 text-[13px] font-semibold tabular-nums" style={{ color: 'rgba(238,217,138,0.85)' }}>
                    {t('voting_rc_start_sub', { n: presentCount })}
                  </p>
                )}
                <button
                  type="button"
                  onClick={onConfirm}
                  disabled={!canConfirm}
                  className="flex-1 px-5 py-3.5 text-[15px] leading-tight rounded-xl font-black uppercase tracking-widest gv-lift-dark bg-[#EDE7D8] hover:enabled:bg-[#DDD4C0] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EED98A] disabled:opacity-40 disabled:cursor-not-allowed transition-[background-color,transform] duration-150 active:scale-[0.98] motion-reduce:transition-none"
                  style={{ color: FOREST }}
                >
                  {presentCount === 0 ? t('voting_mark_present') : doc ? t('voting_rc_start') : t('voting_rc_done')}
                </button>
              </div>
            </section>

            {/* The settings side: the drawer and its ribbons, to the right of the card from xl
                (display: contents below that, so the drawer takes its place above the card). */}
            <div className="gv-rc-side-r">
            {/* ── The drawer: the controls of the bookmark pressed ── */}
            <div
              id="gv-rc-drawer"
              className="gv-rc-drawer order-2 xl:order-none shrink-0 relative overflow-hidden mb-2 xl:mb-0 xl:py-6"
              data-open={drawerOpen}
              inert={!drawerOpen}
              style={{ zIndex: 1 }}
            >
              <div
                role="tabpanel"
                aria-labelledby={`gv-rc-tab-${active.key}`}
                className="gv-rc-panel h-full w-full flex flex-col rounded-3xl xl:rounded-s-none"
                style={{
                  backgroundColor: '#F6F1E6',
                  boxShadow: 'inset 0 0 0 1px rgba(27,56,40,0.08)',
                }}
              >
                <div className="shrink-0 flex items-start gap-3 ps-6 pe-3 pt-5 pb-2">
                  <span className="mt-0.5 shrink-0 w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(27,56,40,0.08)', color: FOREST }} aria-hidden>
                    <active.icon size={18} strokeWidth={2.3} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-[20px] font-bold leading-tight" style={{ color: INK }}>{active.label}</h2>
                    <p className="text-[12.5px] mt-0.5 leading-snug" style={{ color: INK_SOFT }}>{readOnly ? t('voting_rules_read_only') : t('settings_changes_apply')}</p>
                  </div>
                  <button type="button" onClick={() => setTab(null)} aria-label={t('sb_close')}
                    className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] hover:bg-[rgba(27,56,40,0.08)] ${PRESS}`}
                    style={{ color: INK_SOFT }}>
                    <X size={18} strokeWidth={2.4} aria-hidden />
                  </button>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain ps-6 pe-5 pt-3 pb-6">
                  {shownTab === 'threshold' && (
                    <>
                      <div className="flex items-baseline gap-2 mb-4" aria-live="polite">
                        <span className="text-[13px] font-semibold" style={{ color: INK_SOFT }}>{t('voting_rc_to_pass')}</span>
                        <span className="text-[34px] font-bold leading-none tabular-nums" style={{ color: FOREST }}>{consensus ? 0 : presentCount === 0 ? '–' : outcome.needed}</span>
                        <span className="text-[14px] font-medium" style={{ color: INK_SOFT }}>{consensus ? t('voting_rules_stat_against_max').toLowerCase() : t('voting_rc_of_total', { total: presentCount })}</span>
                      </div>
                      <Choice
                        label={t('voting_rules_threshold_info_title')}
                        value={settings.substantiveThreshold}
                        disabled={readOnly}
                        onChange={(v) => onRulesChange({ substantiveThreshold: v })}
                        options={[
                          { value: 'simple', label: t('voting_rules_threshold_simple'), sub: t('voting_rc_threshold_simple_sub') },
                          { value: 'supermajority-2-3', label: '2/3', sub: t('voting_rc_threshold_two_thirds_sub') },
                          { value: 'consensus', label: t('voting_rules_threshold_consensus'), sub: t('voting_rc_threshold_consensus_sub') },
                        ]}
                      />
                      <Note>{thresholdFact}</Note>
                      {/* Quorum lives under the threshold (owner, 17 Sep 2026): both decide whether
                          the room can pass the paper at all. */}
                      <div className="mt-6 pt-5" style={{ boxShadow: 'inset 0 1px 0 rgba(27,56,40,0.10)' }}>
                        <h3 className="text-[16px] font-bold leading-tight mb-3" style={{ color: INK }}>{t('voting_rules_quorum_info_title')}</h3>
                        <Choice
                          label={t('settings_quorum_label')}
                          value={settings.quorumThreshold}
                          disabled={readOnly}
                          onChange={(v) => onRulesChange({ quorumThreshold: v })}
                          options={[
                            { value: 'none', label: t('voting_rules_quorum_none_short') },
                            { value: '1-4', label: '1/4' },
                            { value: '1-3', label: '1/3' },
                            { value: '1-2', label: '1/2' },
                          ]}
                        />
                        <Note warn={quorumFact.warn}>{quorumFact.text}</Note>
                      </div>
                    </>
                  )}
                  {shownTab === 'abstentions' && (
                    <>
                      <div className="divide-y divide-[rgba(27,56,40,0.08)]">
                        <Switch label={t('settings_allow_abstentions_label')} checked={settings.allowAbstentions} disabled={readOnly}
                          onChange={(v) => onRulesChange({ allowAbstentions: v })} />
                        <Switch label={t('voting_rules_count_abstentions_label')} checked={settings.abstentionsInDenominator === true}
                          disabled={readOnly || !settings.allowAbstentions}
                          onChange={(v) => onRulesChange({ abstentionsInDenominator: v })} />
                      </div>
                      <Note>{abstentionFact}</Note>
                      <p className="text-[13px] mt-3 leading-snug [text-wrap:pretty]" style={{ color: INK_SOFT }}>{t('voting_rules_count_abstentions_info_body')}</p>
                    </>
                  )}
                  {shownTab === 'veto' && (
                    <>
                      <Choice
                        label={t('voting_rules_veto_mode')}
                        value={settings.vetoMode}
                        disabled={readOnly}
                        onChange={onVetoModeChange}
                        options={[
                          { value: 'none', label: t('voting_rules_veto_off') },
                          { value: 'p5', label: 'P5' },
                          { value: 'unanimous', label: t('voting_rc_veto_unanimous') },
                          { value: 'custom', label: t('voting_rules_veto_custom_short') },
                        ]}
                      />
                      {vetoOn && (
                        <div className="mt-5">
                          {/* One large row per veto holder, stacked (owner, 17 Sep 2026: "the P5
                              vote should be vertical and bigger, more important"). */}
                          <VetoCountryPicker
                            layout="list"
                            selected={vetoEntries}
                            roster={votable}
                            readOnly={readOnly || settings.vetoMode === 'p5'}
                            onChange={(next) => onRulesChange({ vetoCountries: next })}
                          />
                          {settings.vetoMode === 'p5' && !readOnly && (
                            <p className="text-[13px] mt-2.5 leading-snug" style={{ color: INK_SOFT }}>{t('voting_veto_p5_fixed')}</p>
                          )}
                        </div>
                      )}
                      <Note warn={vetoFact.warn}>{vetoFact.text}</Note>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* ── Bookmarks, xl and up: icon ribbons hanging off the drawer's edge, in the manner
                of the Settings spine (an icon over a short label, gold when open). ── */}
            <div role="tablist" aria-orientation="vertical" aria-label={t('voting_rules_title')} className="hidden xl:flex shrink-0 flex-col gap-2.5 pt-16" style={{ width: RIBBON_W_ON, marginInlineStart: -12, zIndex: 0 }}>
              {tabs.map((x, i) => {
                const on = tab === x.key;
                const Icon = x.icon;
                return (
                  <div key={x.key} style={{ filter: on ? 'drop-shadow(0 8px 10px rgba(27,56,40,0.28))' : 'drop-shadow(0 3px 5px rgba(27,56,40,0.16))' }}>
                    <button
                      id={`gv-rc-tab-${x.key}`}
                      type="button"
                      role="tab"
                      aria-selected={on}
                      aria-controls="gv-rc-drawer"
                      aria-expanded={on}
                      aria-label={`${x.label}: ${x.value}`}
                      title={`${x.label}: ${x.value}`}
                      tabIndex={on || (tab === null && i === 0) ? 0 : -1}
                      onClick={() => openTab(x.key)}
                      onKeyDown={(e) => onTabKey(e, i)}
                      className="gv-rc-tab relative flex flex-col items-center justify-center gap-1 focus:outline-none"
                      style={{
                        width: on ? RIBBON_W_ON : RIBBON_W,
                        height: 74,
                        clipPath: ribbon,
                        paddingInlineStart: 12,
                        paddingInlineEnd: 16,
                        background: on
                          ? `linear-gradient(100deg, #D9BC5E 0%, ${GOLD} 45%, #F6E7A8 100%)`
                          : 'linear-gradient(100deg, #17301F 0%, #1B3828 60%, #24503A 100%)',
                        color: on ? FOREST : 'rgba(243,234,208,0.88)',
                        transition: `width 220ms ${EASE}`,
                      }}
                    >
                      <span aria-hidden className="gv-rc-stitch absolute pointer-events-none" style={{ top: 5, bottom: 5, insetInlineStart: 4, insetInlineEnd: 13, borderRadius: 7, border: `1px dashed ${on ? 'rgba(27,56,40,0.28)' : 'rgba(238,217,138,0.18)'}` }} />
                      <Icon aria-hidden size={21} strokeWidth={on ? 2.5 : 2.1} style={{ position: 'relative', flexShrink: 0 }} />
                      <span aria-hidden className="relative block max-w-full text-center text-[10px] font-semibold leading-[1.15] line-clamp-2">{x.label}</span>
                      {x.warn && (
                        <span aria-hidden className="absolute rounded-full" style={{ top: 9, insetInlineEnd: 18, width: 8, height: 8, backgroundColor: on ? '#8B2020' : '#F6B4B4', boxShadow: `0 0 0 2px ${on ? GOLD : FOREST}` }} />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
}
