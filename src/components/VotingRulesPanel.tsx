'use client';

/**
 * VotingRulesPanel — the chair's live rule console for the final voting screen.
 *
 * It sits beside the roll call on the voting page and (via VotingRulesPopover)
 * stays reachable from the header once the vote is running. Every control writes
 * the SAME CommitteeSettings fields the Settings drawer uses, so there is exactly
 * one rule set per committee — no parallel settings system.
 *
 * `computeVoteOutcome` is the single source of truth for the tally maths. The
 * voting page renders from it, so flipping any switch here recomputes the
 * denominator, the required-to-pass number and the pass/fail verdict on the spot.
 */

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import Portal from '@/components/Portal';
import { useT } from '@/contexts/LanguageContext';
import type { CommitteeSettings } from '@/lib/settingsStore';
import { UN_COUNTRIES, getCountryByName } from '@/lib/countries';

// ── Veto matching by country identity ───────────────────────────────────────
// A veto list holds free text ("Russia"), and so does a delegation name — which
// a chair imports from a roster in whatever spelling their conference uses. A
// raw `vetoList.includes(delegation)` therefore MISSES "Russian Federation",
// "United States of America", "USA" and "UK", and a vetoed resolution is silently
// recorded as PASSED. Both sides are resolved to an ISO-3166 alpha-2 identity
// first, and only fall back to string equality when neither side is a country
// (crisis cabinets, corporations, custom delegations).

/** Lowercase, de-accent, and reduce to single-spaced ASCII words. Non-Latin
 *  scripts reduce to '' — callers fall back to the raw string for those. */
function normalizeDelegation(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Spellings that are NOT the canonical UN_COUNTRIES name but mean the same seat.
 *  Keys are pre-normalization; they are normalized when the lookup map is built. */
const DELEGATION_ALIASES: Record<string, string> = {
  // P5 — the ones that actually decide a veto.
  // (alpha-3 forms too — some conferences import rosters as RUS/USA/GBR/CHN/FRA)
  'russian federation': 'RU', 'the russian federation': 'RU', 'rus': 'RU',
  'gbr': 'GB', 'chn': 'CN', 'fra': 'FR',
  'soviet union': 'RU', 'ussr': 'RU', 'union of soviet socialist republics': 'RU',
  'united states of america': 'US', 'the united states': 'US', 'the united states of america': 'US',
  'usa': 'US', 'u s a': 'US', 'u s': 'US', 'america': 'US', 'united states of america usa': 'US',
  'united kingdom of great britain and northern ireland': 'GB', 'the united kingdom': 'GB',
  'uk': 'GB', 'u k': 'GB', 'great britain': 'GB', 'britain': 'GB', 'england': 'GB',
  "people's republic of china": 'CN', 'peoples republic of china': 'CN', 'prc': 'CN',
  'mainland china': 'CN', 'china prc': 'CN',
  'french republic': 'FR', 'the french republic': 'FR',
  // Common roster spellings elsewhere — the same resolver serves custom veto lists.
  'republic of korea': 'KR', 'korea republic of': 'KR', 'rok': 'KR',
  "democratic people's republic of korea": 'KP', 'democratic peoples republic of korea': 'KP', 'dprk': 'KP',
  'democratic republic of the congo': 'CD', 'democratic republic of congo': 'CD', 'drc': 'CD',
  'republic of the congo': 'CG', 'congo brazzaville': 'CG',
  'islamic republic of iran': 'IR', 'iran islamic republic of': 'IR',
  'syrian arab republic': 'SY', 'uae': 'AE', 'the netherlands': 'NL', 'holland': 'NL',
  'turkiye': 'TR', 'czechia': 'CZ', 'burma': 'MM', 'cape verde': 'CV',
  'swaziland': 'SZ', 'macedonia': 'MK', 'vatican city': 'VA', 'vatican': 'VA',
  'ivory coast': 'CI', "cote d'ivoire": 'CI', 'cote divoire': 'CI',
  'bolivarian republic of venezuela': 'VE', 'state of palestine': 'PS',
  'united republic of tanzania': 'TZ', 'viet nam': 'VN', 'laos pdr': 'LA',
};

const DELEGATION_IDENTITY = (() => {
  const map = new Map<string, string>();
  for (const c of UN_COUNTRIES) map.set(normalizeDelegation(c.name), c.code);
  for (const [alias, code] of Object.entries(DELEGATION_ALIASES)) {
    const key = normalizeDelegation(alias);
    if (key) map.set(key, code);
  }
  return map;
})();

/**
 * Resolve a free-text delegation name to an ISO-3166 alpha-2 code, or null when
 * it is not a country (custom delegation, crisis character, corporation).
 */
export function delegationIdentity(value: string | null | undefined): string | null {
  const raw = (value ?? '').trim();
  if (!raw) return null;
  const exact = getCountryByName(raw);           // canonical name, case-insensitive
  if (exact) return exact.code;
  const key = normalizeDelegation(raw);
  if (!key) return null;
  const hit = DELEGATION_IDENTITY.get(key);
  if (hit) return hit;
  // A roster imported as bare ISO codes ("US", "GB", "CN").
  if (/^[a-z]{2}$/.test(key)) {
    const byCode = UN_COUNTRIES.find((c) => c.code.toLowerCase() === key);
    if (byCode) return byCode.code;
  }
  return null;
}

/** Case/spacing-insensitive key used when neither side resolves to a country.
 *  Falls back to the raw lowercased string for non-Latin names. */
function looseKey(value: string): string {
  return normalizeDelegation(value) || value.trim().toLowerCase();
}

/** True when a veto-list entry and a delegation name are the same seat. */
export function vetoEntryMatches(entry: string, delegation: string): boolean {
  const a = delegationIdentity(entry);
  const b = delegationIdentity(delegation);
  if (a && b) return a === b;
  return looseKey(entry) === looseKey(delegation);
}

/** True when any of `delegations` is a veto holder under `vetoList`. */
export function isVetoDelegation(vetoList: string[], delegation: string): boolean {
  return vetoList.some((entry) => vetoEntryMatches(entry, delegation));
}

/** Veto entries that match NO delegation in the room. A silent no-match is exactly
 *  how a missing veto hides, so the panel surfaces these. */
export function unmatchedVetoEntries(vetoList: string[], delegations: string[]): string[] {
  return vetoList.filter((entry) => entry.trim() && !delegations.some((d) => vetoEntryMatches(entry, d)));
}

// ── Rule maths ──────────────────────────────────────────────────────────────

export type QuorumThreshold = CommitteeSettings['quorumThreshold'];

export interface VoteTally {
  forCount: number;
  againstCount: number;
  abstainCount: number;
}

/** Only the settings the outcome actually depends on. */
export type VoteRules = Pick<
  CommitteeSettings,
  'substantiveThreshold' | 'allowAbstentions' | 'abstentionsInDenominator' | 'quorumThreshold'
>;

export interface VoteOutcome {
  /** Votes that count toward the threshold. */
  denominator: number;
  /** How many "for" votes the resolution needs at the current denominator. */
  needed: number;
  thresholdMet: boolean;
  /** Delegations that must be present for the vote to be valid (0 = no quorum rule). */
  quorumNeeded: number;
  quorumMet: boolean;
  /** True when abstentions are inside the denominator. */
  countsAbstentions: boolean;
  passed: boolean;
}

const QUORUM_FRACTION: Record<QuorumThreshold, number> = {
  none: 0,
  '1-4': 1 / 4,
  '1-3': 1 / 3,
  '1-2': 1 / 2,
};

export function computeVoteOutcome({
  tally,
  rules,
  presentCount,
  totalCount,
  vetoBlocked,
  unanimousFail,
}: {
  tally: VoteTally;
  rules: VoteRules;
  /** Non-observer delegations not marked absent. */
  presentCount: number;
  /** Non-observer delegations on the roster. */
  totalCount: number;
  vetoBlocked: boolean;
  unanimousFail: boolean;
}): VoteOutcome {
  const { forCount, againstCount, abstainCount } = tally;

  // Abstentions only enter the denominator when they are allowed AND the chair
  // has asked for them to count. Default stays "excluded", the historic rule.
  const countsAbstentions = rules.allowAbstentions === true && rules.abstentionsInDenominator === true;
  const denominator = forCount + againstCount + (countsAbstentions ? abstainCount : 0);

  let needed: number;
  let thresholdMet: boolean;
  if (rules.substantiveThreshold === 'supermajority-2-3') {
    needed = Math.ceil((2 * denominator) / 3);
    thresholdMet = denominator > 0 && forCount >= needed;
  } else if (rules.substantiveThreshold === 'consensus') {
    // Consensus: nobody against. "Needed" is the whole counted body.
    needed = denominator;
    thresholdMet = againstCount === 0 && forCount > 0;
  } else {
    // Simple majority — identical to the previous `for > against` rule when
    // abstentions are excluded, and to "majority of votes cast" when they aren't.
    needed = Math.floor(denominator / 2) + 1;
    thresholdMet = denominator > 0 && forCount >= needed;
  }

  const fraction = QUORUM_FRACTION[rules.quorumThreshold ?? 'none'] ?? 0;
  const quorumNeeded = fraction > 0 ? Math.ceil(totalCount * fraction) : 0;
  const quorumMet = quorumNeeded === 0 || presentCount >= quorumNeeded;

  return {
    denominator,
    needed,
    thresholdMet,
    quorumNeeded,
    quorumMet,
    countsAbstentions,
    passed: !vetoBlocked && !unanimousFail && thresholdMet && quorumMet,
  };
}

// ── Positioning helper ──────────────────────────────────────────────────────
// Portal renders into `#fit-root` when FitToScreen is mounted. That element is
// `transform: scale(...)`, which makes it the containing block for `position:
// fixed` children — so raw getBoundingClientRect() screen pixels would be off by
// the scale factor. Convert the trigger box (and the usable bounds) into the
// same space the portalled fixed layer lives in.
function anchorBox(el: HTMLElement) {
  const root = typeof document !== 'undefined' ? document.getElementById('fit-root') : null;
  const r = el.getBoundingClientRect();
  if (!root) {
    return {
      top: r.top, bottom: r.bottom, left: r.left, right: r.right,
      viewW: window.innerWidth, viewH: window.innerHeight,
    };
  }
  const rr = root.getBoundingClientRect();
  const scale = root.offsetWidth > 0 && rr.width > 0 ? rr.width / root.offsetWidth : 1;
  const s = scale || 1;
  return {
    top: (r.top - rr.top) / s,
    bottom: (r.bottom - rr.top) / s,
    left: (r.left - rr.left) / s,
    right: (r.right - rr.left) / s,
    viewW: root.offsetWidth,
    viewH: root.offsetHeight,
  };
}

/** Clamp a floating layer into view, flipping above the trigger when it would
 *  overflow the bottom edge. */
function place(box: ReturnType<typeof anchorBox>, w: number, h: number, align: 'start' | 'end') {
  const M = 8;
  const rawLeft = align === 'end' ? box.right - w : box.left;
  const left = Math.min(Math.max(M, rawLeft), Math.max(M, box.viewW - w - M));
  const below = box.bottom + 8;
  const flip = below + h > box.viewH - M && box.top - 8 - h > M;
  return { left, top: flip ? box.top - 8 - h : below };
}

// ── Hover explainer ─────────────────────────────────────────────────────────
// House rule: informational "i" badges reveal on HOVER (and on focus for
// keyboard users), never on click. A short close delay lets the pointer travel
// from the badge into the panel.

function InfoDot({ title, body }: { title: string; body: string }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelId = useId();
  const W = 230;
  const H = 116;

  const reveal = useCallback(() => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
    const el = btnRef.current;
    if (el) setPos(place(anchorBox(el), W, H, 'end'));
    setOpen(true);
  }, []);
  const dismiss = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 220);
  }, []);

  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);
  useEffect(() => {
    if (!open) return;
    const reposition = () => { const el = btnRef.current; if (el) setPos(place(anchorBox(el), W, H, 'end')); };
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label={title}
        aria-describedby={open ? panelId : undefined}
        onMouseEnter={reveal}
        onMouseLeave={dismiss}
        onFocus={reveal}
        onBlur={dismiss}
        onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}
        className="w-[15px] h-[15px] rounded-full shrink-0 flex items-center justify-center text-[9px] font-black leading-none transition-colors focus:outline-none"
        style={{
          backgroundColor: open ? 'rgba(238,217,138,0.22)' : 'rgba(255,255,255,0.10)',
          color: open ? '#EED98A' : 'rgba(255,255,255,0.55)',
          border: '1px solid rgba(255,255,255,0.16)',
          cursor: 'help',
        }}
      >
        i
      </button>
      {open && pos && (
        <Portal>
          <div
            id={panelId}
            role="tooltip"
            onMouseEnter={reveal}
            onMouseLeave={dismiss}
            style={{
              position: 'fixed', top: pos.top, left: pos.left, width: W, zIndex: 10000,
              backgroundColor: '#12271B', border: '1px solid rgba(238,217,138,0.28)',
              borderRadius: 12, padding: '10px 12px',
              boxShadow: '0 16px 40px rgba(5,4,3,0.45)',
              animation: 'gvRuleFade 150ms cubic-bezier(0.22,1,0.36,1)',
            }}
          >
            <style>{`@keyframes gvRuleFade{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}`}</style>
            <p className="text-[10px] font-black tracking-widest mb-1" style={{ color: '#EED98A' }}>
              {title.toUpperCase()}
            </p>
            <p className="text-[11px] leading-snug" style={{ color: 'rgba(255,255,255,0.72)' }}>{body}</p>
          </div>
        </Portal>
      )}
    </>
  );
}

// ── Small dark-surface primitives ───────────────────────────────────────────

function RuleLabel({ children, info }: { children: React.ReactNode; info?: { title: string; body: string } }) {
  return (
    <div className="flex items-center gap-1.5 mb-1.5">
      <span className="text-[10px] font-black tracking-widest" style={{ color: 'rgba(255,255,255,0.5)' }}>
        {children}
      </span>
      {info && <InfoDot title={info.title} body={info.body} />}
    </div>
  );
}

function Seg<T extends string>({ value, options, onChange, label }: {
  value: T;
  options: { value: T; label: string; title?: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex w-full rounded-xl p-[3px] gap-[3px]"
      style={{ backgroundColor: 'rgba(0,0,0,0.24)', border: '1px solid rgba(255,255,255,0.10)' }}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            title={o.title ?? o.label}
            onClick={() => onChange(o.value)}
            className="flex-1 min-w-0 py-[7px] px-1 rounded-lg text-[11px] font-black truncate focus:outline-none active:scale-[0.97]"
            style={{
              backgroundColor: on ? '#EDE7D8' : 'transparent',
              color: on ? '#1C1410' : 'rgba(255,255,255,0.55)',
              boxShadow: on ? '0 1px 4px rgba(0,0,0,0.32)' : 'none',
              transition: 'background-color 160ms, color 160ms, transform 120ms',
            }}
            onMouseEnter={(e) => { if (!on) (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.9)'; }}
            onMouseLeave={(e) => { if (!on) (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.55)'; }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function RuleToggle({ checked, onChange, label, disabled, info }: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
  info?: { title: string; body: string };
}) {
  return (
    <div className="flex items-center gap-2 py-[7px]" style={{ opacity: disabled ? 0.4 : 1 }}>
      <span className="flex-1 text-[12px] font-semibold leading-snug" style={{ color: 'rgba(255,255,255,0.88)' }}>
        {label}
      </span>
      {info && <InfoDot title={info.title} body={info.body} />}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className="relative shrink-0 w-9 h-[20px] rounded-full focus:outline-none active:scale-[0.96]"
        style={{
          backgroundColor: checked ? '#3D7A52' : 'rgba(255,255,255,0.16)',
          border: '1px solid rgba(255,255,255,0.14)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'background-color 180ms, transform 120ms',
        }}
      >
        <span
          className="absolute top-[2px] left-[2px] w-[14px] h-[14px] rounded-full"
          style={{
            backgroundColor: '#FFFFFF',
            boxShadow: '0 1px 3px rgba(0,0,0,0.35)',
            transform: checked ? 'translateX(16px)' : 'translateX(0)',
            transition: 'transform 180ms cubic-bezier(0.22,1,0.36,1)',
          }}
        />
      </button>
    </div>
  );
}

function Stat({ label, value, tone = 'plain' }: { label: string; value: string; tone?: 'plain' | 'gold' | 'muted' }) {
  const color = tone === 'gold' ? '#EED98A' : tone === 'muted' ? 'rgba(255,255,255,0.62)' : '#FFFFFF';
  return (
    <div
      className="rounded-xl px-2 py-2 text-center min-w-0"
      style={{ backgroundColor: 'rgba(0,0,0,0.24)', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      <div className="text-[16px] font-black tabular-nums leading-none truncate" style={{ color }}>{value}</div>
      <div className="text-[8.5px] font-black tracking-widest mt-1 truncate" style={{ color: 'rgba(255,255,255,0.42)' }}>
        {label}
      </div>
    </div>
  );
}

// ── The panel ───────────────────────────────────────────────────────────────

export interface VotingRulesPanelProps {
  rules: VoteRules;
  /** Writes a single CommitteeSettings field (store + DB) — see the voting page. */
  onChange: <K extends keyof CommitteeSettings>(key: K, value: CommitteeSettings[K]) => void;
  /** Veto mode lives on the same settings object; shown read-only-ish for 'custom'. */
  vetoMode: CommitteeSettings['vetoMode'];
  onVetoModeChange: (mode: CommitteeSettings['vetoMode']) => void;
  tally: VoteTally;
  outcome: VoteOutcome;
  votesCast: number;
  eligible: number;
  presentCount: number;
  totalCount: number;
  /** True once the final result screen is showing — the chip states the verdict. */
  resultShown: boolean;
  vetoBlocked: boolean;
  unanimousFail: boolean;
  /** The veto seats currently in force (p5Delegations or vetoCountries). Used only
   *  to warn about entries that match nobody in the room. */
  vetoEntries?: string[];
  /** Every non-observer delegation name on the roster. */
  delegationNames?: string[];
  className?: string;
  style?: React.CSSProperties;
}

export function VotingRulesPanel({
  rules, onChange, vetoMode, onVetoModeChange,
  tally, outcome, votesCast, eligible, presentCount, totalCount,
  resultShown, vetoBlocked, unanimousFail,
  vetoEntries = [], delegationNames = [], className = '', style,
}: VotingRulesPanelProps) {
  const t = useT();
  const consensus = rules.substantiveThreshold === 'consensus';

  // A veto entry that resolves to no delegation can never block anything, and the
  // failure is completely silent on the result screen — which is exactly how a
  // "Russian Federation" roster used to pass a vetoed resolution. Surface it.
  const vetoActive = vetoMode === 'p5' || vetoMode === 'custom';
  const missingVetoSeats = vetoActive ? unmatchedVetoEntries(vetoEntries, delegationNames) : [];
  const seatedVetoCount = vetoActive ? vetoEntries.length - missingVetoSeats.length : 0;

  const verdict = (() => {
    if (resultShown) {
      return outcome.passed
        ? { text: t('voting_rules_verdict_passed'), fg: '#0F2A18', bg: '#6EE7A0' }
        : { text: t('voting_rules_verdict_failed'), fg: '#3A0C0C', bg: '#FCA5A5' };
    }
    if (votesCast === 0) {
      return { text: t('voting_rules_verdict_awaiting'), fg: 'rgba(255,255,255,0.62)', bg: 'rgba(255,255,255,0.10)' };
    }
    return outcome.passed
      ? { text: t('voting_rules_verdict_on_track_pass'), fg: '#6EE7A0', bg: 'rgba(110,231,160,0.14)' }
      : { text: t('voting_rules_verdict_on_track_fail'), fg: '#FCA5A5', bg: 'rgba(252,165,165,0.14)' };
  })();

  const blockedNote = vetoBlocked
    ? t('voting_rules_blocked_veto')
    : unanimousFail
    ? t('voting_rules_blocked_unanimous')
    : !outcome.quorumMet
    ? t('voting_rules_blocked_quorum', { present: presentCount, needed: outcome.quorumNeeded })
    : null;

  const sentence = consensus
    ? t('voting_rules_sentence_consensus', { cast: votesCast, eligible })
    : t('voting_rules_sentence', { cast: votesCast, eligible, needed: outcome.needed });

  return (
    <div
      className={`rounded-2xl shadow-2xl flex flex-col ${className}`}
      style={{ backgroundColor: '#1B3828', border: '1px solid rgba(255,255,255,0.12)', ...style }}
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-3 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.12)' }}>
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <h2 className="text-base font-black text-white leading-none">{t('voting_rules_title')}</h2>
          <span
            className="text-[9px] font-black tracking-widest px-2 py-1 rounded-full whitespace-nowrap"
            style={{ backgroundColor: verdict.bg, color: verdict.fg }}
          >
            {verdict.text}
          </span>
        </div>

        {/* Live derived numbers — these are what the rules below actually change. */}
        <div className="grid grid-cols-3 gap-1.5">
          <Stat label={t('voting_rules_stat_cast')} value={`${votesCast}/${eligible}`} />
          <Stat label={t('voting_rules_stat_counted')} value={String(outcome.denominator)} tone="muted" />
          <Stat
            label={consensus ? t('voting_rules_stat_against_max') : t('voting_rules_stat_to_pass')}
            value={consensus ? '0' : String(outcome.needed)}
            tone="gold"
          />
        </div>
        <p className="text-[10.5px] mt-2 leading-snug tabular-nums" style={{ color: 'rgba(255,255,255,0.6)' }}>
          {sentence}
        </p>
        <p className="text-[10px] mt-0.5 leading-snug" style={{ color: 'rgba(255,255,255,0.38)' }}>
          {outcome.countsAbstentions
            ? t('voting_rules_abstentions_counted', { n: tally.abstainCount })
            : t('voting_rules_abstentions_excluded', { n: tally.abstainCount })}
        </p>
        {blockedNote && (
          <p className="text-[10.5px] mt-2 font-semibold leading-snug" style={{ color: '#FCA5A5' }}>
            {blockedNote}
          </p>
        )}
      </div>

      {/* Controls */}
      <div className="px-4 py-3 flex-1 overflow-y-auto">
        <RuleLabel info={{
          title: t('voting_rules_threshold_info_title'),
          body: t('voting_rules_threshold_info_body'),
        }}>
          {t('voting_rules_threshold_heading')}
        </RuleLabel>
        <Seg
          label={t('voting_rules_threshold_info_title')}
          value={rules.substantiveThreshold}
          onChange={(v) => onChange('substantiveThreshold', v)}
          options={[
            { value: 'simple', label: t('voting_rules_threshold_simple'), title: t('settings_majority_simple') },
            { value: 'supermajority-2-3', label: '2/3', title: t('settings_majority_supermajority') },
            { value: 'consensus', label: t('voting_rules_threshold_consensus'), title: t('settings_majority_consensus') },
          ]}
        />

        <div className="mt-3.5">
          <RuleLabel>{t('voting_rules_abstentions_heading')}</RuleLabel>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <RuleToggle
              label={t('settings_allow_abstentions_label')}
              checked={rules.allowAbstentions}
              onChange={(v) => onChange('allowAbstentions', v)}
              info={{
                title: t('voting_rules_allow_abstentions_info_title'),
                body: t('voting_rules_allow_abstentions_info_body'),
              }}
            />
            <RuleToggle
              label={t('voting_rules_count_abstentions_label')}
              checked={rules.abstentionsInDenominator === true}
              disabled={!rules.allowAbstentions}
              onChange={(v) => onChange('abstentionsInDenominator', v)}
              info={{
                title: t('voting_rules_count_abstentions_info_title'),
                body: t('voting_rules_count_abstentions_info_body'),
              }}
            />
          </div>
          {!rules.allowAbstentions && tally.abstainCount > 0 && (
            <p className="text-[10px] mt-1 leading-snug" style={{ color: '#EED98A' }}>
              {tally.abstainCount === 1
                ? t('voting_rules_abstentions_kept_one')
                : t('voting_rules_abstentions_kept_other', { n: tally.abstainCount })}
            </p>
          )}
        </div>

        <div className="mt-3.5">
          <RuleLabel info={{
            title: t('voting_rules_veto_info_title'),
            body: t('voting_rules_veto_info_body'),
          }}>
            {t('voting_rules_veto_heading')}
          </RuleLabel>
          <Seg
            label={t('voting_rules_veto_mode')}
            value={vetoMode}
            onChange={onVetoModeChange}
            options={[
              { value: 'none', label: t('voting_rules_veto_off'), title: t('settings_veto_none_label') },
              { value: 'p5', label: 'P5', title: t('settings_veto_p5_label') },
              { value: 'unanimous', label: t('voting_rules_veto_unanimous_short'), title: t('settings_veto_unanimous_label') },
              ...(vetoMode === 'custom'
                ? [{ value: 'custom' as const, label: t('voting_rules_veto_custom_short'), title: t('settings_veto_custom_label') }]
                : []),
            ]}
          />
          {vetoMode === 'custom' && (
            <p className="text-[10px] mt-1.5 leading-snug" style={{ color: 'rgba(255,255,255,0.42)' }}>
              {t('voting_rules_veto_custom_note')}
            </p>
          )}
          {vetoActive && vetoEntries.length > 0 && (
            missingVetoSeats.length > 0 ? (
              <div
                className="mt-2 rounded-xl px-2.5 py-2"
                style={{ backgroundColor: 'rgba(182,135,31,0.16)', border: '1px solid rgba(238,217,138,0.34)' }}
              >
                <p className="text-[10.5px] font-black leading-snug" style={{ color: '#EED98A' }}>
                  {missingVetoSeats.length === 1
                    ? '1 veto seat is not in this committee'
                    : `${missingVetoSeats.length} veto seats are not in this committee`}
                </p>
                <p className="text-[10px] mt-0.5 leading-snug" style={{ color: 'rgba(255,255,255,0.66)' }}>
                  {missingVetoSeats.join(', ')} — no delegation on the roster matches, so
                  {missingVetoSeats.length === 1 ? ' it' : ' they'} can never block a vote.
                  {seatedVetoCount > 0
                    ? ` ${seatedVetoCount} veto seat${seatedVetoCount === 1 ? '' : 's'} still active.`
                    : ' No veto is in force.'}
                </p>
              </div>
            ) : (
              <p className="text-[10px] mt-1.5 leading-snug" style={{ color: 'rgba(255,255,255,0.42)' }}>
                {seatedVetoCount} veto seat{seatedVetoCount === 1 ? '' : 's'} seated: {vetoEntries.join(', ')}
              </p>
            )
          )}
        </div>

        <div className="mt-3.5">
          <RuleLabel info={{ title: t('voting_rules_quorum_info_title'), body: t('settings_quorum_note') }}>
            {t('voting_rules_quorum_heading')}
          </RuleLabel>
          <Seg
            label={t('settings_quorum_label')}
            value={rules.quorumThreshold}
            onChange={(v) => onChange('quorumThreshold', v)}
            options={[
              { value: 'none', label: t('voting_rules_quorum_none_short'), title: t('settings_quorum_none') },
              { value: '1-4', label: '1/4', title: t('settings_quorum_1_4') },
              { value: '1-3', label: '1/3', title: t('settings_quorum_1_3') },
              { value: '1-2', label: '1/2', title: t('settings_quorum_1_2') },
            ]}
          />
          <p
            className="text-[10px] mt-1.5 leading-snug tabular-nums"
            style={{ color: outcome.quorumMet ? 'rgba(255,255,255,0.45)' : '#FCA5A5' }}
          >
            {outcome.quorumNeeded > 0
              ? t(
                  outcome.quorumMet ? 'voting_rules_quorum_line_required' : 'voting_rules_quorum_line_not_met',
                  { present: presentCount, total: totalCount, needed: outcome.quorumNeeded },
                )
              : t('voting_rules_quorum_line_none', { present: presentCount, total: totalCount })}
          </p>
        </div>
      </div>

      <div className="px-4 py-2.5 shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.12)' }}>
        <p className="text-[9px] text-center font-mono tracking-wider" style={{ color: 'rgba(255,255,255,0.35)' }}>
          {t('settings_changes_apply')}
        </p>
      </div>
    </div>
  );
}

// ── Header trigger + portalled popover ──────────────────────────────────────

export function VotingRulesPopover(props: VotingRulesPanelProps & { triggerLabel?: string }) {
  const { triggerLabel, ...panelProps } = props;
  const t = useT();
  const label = triggerLabel ?? t('voting_rules_trigger');
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; maxH: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const W = 336;
  const H = 470;

  const reposition = useCallback(() => {
    const el = btnRef.current;
    if (!el) return;
    const box = anchorBox(el);
    // Never taller than the space we have; the panel body scrolls internally.
    const h = Math.min(H, box.viewH - 24);
    const p = place(box, W, h, 'end');
    setPos({ ...p, maxH: Math.max(180, box.viewH - p.top - 8) });
  }, []);

  useEffect(() => {
    if (!open) return;
    reposition();
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (btnRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [open, reposition]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="text-xs px-3 py-1.5 rounded-lg font-black shrink-0 focus:outline-none active:scale-[0.97]"
        style={{
          backgroundColor: open ? '#1B3828' : '#EDE7D8',
          color: open ? '#EED98A' : '#1B3828',
          border: '1.5px solid #C8BAA8',
          transition: 'background-color 160ms, color 160ms, transform 120ms',
        }}
        onMouseEnter={(e) => { if (!open) (e.currentTarget as HTMLElement).style.backgroundColor = '#DDD4C0'; }}
        onMouseLeave={(e) => { if (!open) (e.currentTarget as HTMLElement).style.backgroundColor = '#EDE7D8'; }}
      >
        {label}
      </button>
      {open && pos && (
        <Portal>
          <div
            ref={panelRef}
            role="dialog"
            aria-label={t('voting_rules_title')}
            style={{
              position: 'fixed', top: pos.top, left: pos.left, width: W, zIndex: 9999,
              maxHeight: pos.maxH,
              animation: 'gvRulePop 170ms cubic-bezier(0.22,1,0.36,1)',
            }}
          >
            <style>{`@keyframes gvRulePop{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}`}</style>
            <VotingRulesPanel {...panelProps} style={{ maxHeight: pos.maxH, overflow: 'hidden' }} />
          </div>
        </Portal>
      )}
    </>
  );
}
