'use client';

/**
 * PreVoteScreen: the roll call and the rules before a vote on /voting/[code].
 *
 * One screen, no page scroll at 1280x800 and up. Two columns:
 *   • the roll call (round flags, an Absent / Present / P+V control per seat, All present /
 *     All P+V, observers kept apart at the end); only the list scrolls
 *   • what the vote needs to pass in plain sentences (forest summary), the rules in four
 *     tabs (Threshold, Abstentions, Veto with the custom "+" picker, Quorum), and ONE
 *     primary action at the bottom of the column
 * Below the lg breakpoint the columns stack and the body scrolls.
 *
 * Opened after a draft resolution is chosen (then the action is "Start voting", which
 * confirms the roll call and opens the ballot), or on its own from the resolution list or
 * the roster notice (then it is "Done").
 *
 * It owns no rule state. Every control calls `onRulesChange` with only the keys that
 * changed; the page writes that patch through `applyRules` → `saveCommitteeSettings` →
 * `patch_committee_settings` (AGENTS.md rule 12). The pass/fail maths is
 * `computeVoteOutcome`, the same function the ballot screen uses.
 *
 * Only the Moderator's device renders it (the page gates it on `!isViewOnly`, because the
 * roll call writes delegate statuses). `readOnly` still disables every control.
 */

import { useState, type ReactNode } from 'react';
import { ArrowLeft, CircleSlash, Megaphone, Scale, ShieldCheck, Users } from 'lucide-react';
import Portal from '@/components/Portal';
import { SeatCircleFlag } from '@/components/CircleFlag';
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
const CARD = '#F6F1E6';
const CARD_SHADOW = '0 0 0 1px rgba(27,56,40,0.06), 0 1px 2px rgba(27,56,40,0.06), 0 10px 28px rgba(27,56,40,0.07)';
const PRESS = 'transition-[background-color,color,box-shadow,transform] duration-150 active:scale-[0.96] motion-reduce:transition-none motion-reduce:active:scale-100';

type RuleTab = 'threshold' | 'abstentions' | 'veto' | 'quorum';

export interface PreVoteScreenProps {
  delegates: Delegate[];
  rollCallStatuses: Record<string, DelegateStatus>;
  isObserverSeat: (d: Delegate) => boolean;
  onToggleObserver: (d: Delegate) => void;
  onSetStatus: (id: string, status: DelegateStatus) => void;
  /** Every voting (non-observer) seat to one status. */
  onBulkStatus: (status: 'present' | 'present-voting') => void;
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
    <div role="radiogroup" aria-label={label} className="grid gap-2" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${options.some((o) => o.sub) ? '9rem' : '4.5rem'}, 1fr))` }}>
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
            className={`min-h-12 rounded-2xl px-3.5 py-2.5 text-start focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] disabled:cursor-not-allowed ${PRESS}`}
            style={{
              backgroundColor: on ? FOREST : '#FCFAF5',
              color: on ? GOLD : INK,
              boxShadow: on ? '0 1px 2px rgba(27,56,40,0.25), 0 6px 16px rgba(27,56,40,0.18)' : '0 0 0 1px rgba(27,56,40,0.10)',
              opacity: disabled && !on ? 0.6 : 1,
            }}
          >
            <span className="block text-[15px] font-semibold leading-tight">{o.label}</span>
            {o.sub && (
              <span className="block text-[12.5px] font-medium leading-snug mt-0.5" style={{ color: on ? 'rgba(238,217,138,0.8)' : INK_SOFT }}>
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
    <label className="flex items-center gap-3 min-h-12" style={{ opacity: disabled ? 0.45 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}>
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

function Fact({ icon, children, tone = 'plain' }: { icon: ReactNode; children: ReactNode; tone?: 'plain' | 'warn' }) {
  return (
    <li className="flex items-start gap-2.5">
      <span
        className="mt-px shrink-0 w-6 h-6 rounded-full flex items-center justify-center"
        style={{ backgroundColor: tone === 'warn' ? 'rgba(252,165,165,0.18)' : 'rgba(238,217,138,0.14)', color: tone === 'warn' ? '#FCA5A5' : GOLD }}
        aria-hidden
      >
        {icon}
      </span>
      <span className="text-[14px] font-medium leading-snug [text-wrap:pretty]" style={{ color: tone === 'warn' ? '#FECACA' : 'rgba(255,255,255,0.9)' }}>
        {children}
      </span>
    </li>
  );
}

function CountChip({ n, label, tone }: { n: string | number; label: string; tone: 'green' | 'gold' | 'dim' }) {
  const p = tone === 'green'
    ? { bg: 'rgba(47,107,69,0.12)', fg: '#2F6B45' }
    : tone === 'gold'
    ? { bg: 'rgba(182,135,31,0.14)', fg: '#6A4A0A' }
    : { bg: 'rgba(27,56,40,0.06)', fg: INK_SOFT };
  return (
    <span className="inline-flex items-baseline gap-1.5 h-8 px-3 rounded-full items-center" style={{ backgroundColor: p.bg, color: p.fg }}>
      <span className="text-[14px] font-semibold tabular-nums">{n}</span>
      <span className="text-[12.5px] font-medium whitespace-nowrap">{label}</span>
    </span>
  );
}

export function PreVoteScreen({
  delegates, rollCallStatuses, isObserverSeat, onToggleObserver, onSetStatus, onBulkStatus, onConfirm, onClose,
  doc = null, settings, onRulesChange, onVetoModeChange, vetoEntries, readOnly = false,
}: PreVoteScreenProps) {
  const t = useT();
  const { language } = useLanguage();
  const rtl = language === 'ar';
  const [tab, setTab] = useState<RuleTab>('threshold');

  const statusOf = (d: Delegate): DelegateStatus => rollCallStatuses[d.id] ?? d.status;
  const votable = delegates.filter((d) => !isObserverSeat(d)).sort((a, b) => compareCountryNames(a.country, b.country, language));
  const observers = delegates.filter((d) => isObserverSeat(d)).sort((a, b) => compareCountryNames(a.country, b.country, language));
  const presentCount = votable.filter((d) => statusOf(d) !== 'absent').length;
  const pvCount = votable.filter((d) => statusOf(d) === 'present-voting').length;
  const absentCount = votable.length - presentCount;

  // What this vote needs if every present delegation votes For or Against. The same
  // function the ballot screen judges the real tally with.
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
    ? t('voting_prevote_needed_consensus')
    : presentCount === 0
    ? t('voting_mark_present')
    : t('voting_prevote_needed_line', { needed: outcome.needed, n: presentCount });

  const abstentionFact = !settings.allowAbstentions
    ? t('voting_prevote_abstain_off')
    : outcome.countsAbstentions
    ? t('voting_prevote_abstain_counted')
    : t('voting_prevote_abstain_excluded');

  const vetoFact: { text: string; warn: boolean } = settings.vetoMode === 'unanimous'
    ? { text: t('voting_prevote_veto_unanimous_line'), warn: false }
    : !vetoOn
    ? { text: t('voting_prevote_veto_off_line'), warn: false }
    : seatedVeto.length === 0
    ? { text: t('voting_veto_none_seated'), warn: true }
    : { text: t('voting_prevote_veto_line', { names: seatedVeto.map((d) => getCountryDisplayName(d.country, language)).join(rtl ? '، ' : ', ') }), warn: false };

  const quorumFact: { text: string; warn: boolean } = outcome.quorumNeeded === 0
    ? { text: t('voting_prevote_quorum_none'), warn: false }
    : outcome.quorumMet
    ? { text: t('voting_prevote_quorum_met', { present: presentCount, needed: outcome.quorumNeeded }), warn: false }
    : { text: t('voting_prevote_quorum_not_met', { present: presentCount, needed: outcome.quorumNeeded }), warn: true };

  const segments: { value: DelegateStatus; label: string; title: string; on: string }[] = [
    { value: 'absent', label: t('voting_prevote_seg_absent'), title: t('voting_prevote_seg_absent'), on: '#8B2020' },
    { value: 'present', label: t('voting_prevote_seg_present'), title: t('voting_prevote_seg_present'), on: '#2F6B45' },
    { value: 'present-voting', label: t('voting_prevote_seg_pv'), title: t('voting_prevote_present_voting'), on: '#8A6414' },
  ];
  const rowTint = (s: DelegateStatus) =>
    s === 'present' ? 'rgba(61,122,82,0.09)' : s === 'present-voting' ? 'rgba(182,135,31,0.11)' : 'transparent';

  const thresholdValue = settings.substantiveThreshold === 'supermajority-2-3' ? '2/3'
    : consensus ? t('voting_rules_threshold_consensus') : t('voting_rules_threshold_simple');
  const abstValue = !settings.allowAbstentions ? t('voting_prevote_tab_abst_off')
    : outcome.countsAbstentions ? t('voting_prevote_tab_abst_counted') : t('voting_prevote_tab_abst_excluded');
  const vetoValue = settings.vetoMode === 'p5' ? 'P5'
    : settings.vetoMode === 'custom' ? `${t('voting_rules_veto_custom_short')} · ${vetoEntries.length}`
    : settings.vetoMode === 'unanimous' ? t('voting_prevote_veto_unanimous') : t('voting_rules_veto_off');
  const quorumValue = settings.quorumThreshold === 'none' ? t('voting_rules_quorum_none_short') : settings.quorumThreshold.replace('-', '/');

  const tabs: { key: RuleTab; label: string; value: string; warn?: boolean }[] = [
    { key: 'threshold', label: t('voting_rules_threshold_info_title'), value: thresholdValue },
    { key: 'abstentions', label: t('voting_abstain_label'), value: abstValue },
    { key: 'veto', label: t('voting_rules_veto_info_title'), value: vetoValue, warn: vetoFact.warn },
    { key: 'quorum', label: t('voting_rules_quorum_info_title'), value: quorumValue, warn: quorumFact.warn },
  ];

  const canConfirm = presentCount > 0 && !readOnly;

  return (
    <Portal>
      <div
        className="gv-prevote fixed inset-0 z-50 flex flex-col"
        style={{ backgroundColor: '#EDE7D8', ['--gv-dir' as string]: rtl ? -1 : 1 }}
        dir={rtl ? 'rtl' : undefined}
        role="dialog"
        aria-modal="true"
        aria-labelledby="gv-prevote-title"
        onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
      >
        <style>{`
          @keyframes gvPreVoteIn { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: none } }
          .gv-prevote .gv-in { animation: gvPreVoteIn 340ms cubic-bezier(0.2,0,0,1) backwards }
          .gv-prevote .gv-in-2 { animation-delay: 70ms }
          .gv-prevote .gv-in-3 { animation-delay: 140ms }
          .gv-prevote .gv-in-4 { animation-delay: 210ms }
          .gv-prevote .gv-tabpanel { animation: gvPreVoteIn 220ms cubic-bezier(0.2,0,0,1) backwards }
          @media (prefers-reduced-motion: reduce) { .gv-prevote .gv-in, .gv-prevote .gv-tabpanel { animation: none } }
        `}</style>

        {/* Top line: the way back and what this roll call is for */}
        <div className="gv-in shrink-0 flex items-center gap-3 px-4 sm:px-6 h-16">
          <button
            type="button"
            onClick={onClose}
            className={`inline-flex items-center gap-2 h-10 ps-2.5 pe-4 rounded-full text-[14px] font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] hover:bg-[rgba(27,56,40,0.08)] ${PRESS}`}
            style={{ color: INK_SOFT }}
          >
            <ArrowLeft size={17} strokeWidth={2.25} aria-hidden style={{ transform: rtl ? 'scaleX(-1)' : undefined }} />
            {t('voting_prevote_close')}
          </button>
          <div className="min-w-0 flex-1 flex items-baseline gap-3">
            <h1 id="gv-prevote-title" className="min-w-0 truncate text-[19px] sm:text-[21px] font-bold leading-tight" style={{ color: INK, letterSpacing: '-0.01em' }}>
              {doc ? t('voting_prevote_for_doc', { code: doc.code }) : t('voting_prevote_title')}
              {doc?.title && <span className="font-medium text-[15px] sm:text-[16px] ms-3" style={{ color: INK_SOFT, letterSpacing: 0 }}>{doc.title}</span>}
            </h1>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden px-4 sm:px-6 pb-4 sm:pb-6">
          <div className="lg:h-full grid gap-4 sm:gap-5 lg:grid-cols-[minmax(0,1.12fr)_minmax(0,1fr)]">

            {/* ── Roll call ── */}
            <section className="gv-in gv-in-2 rounded-[28px] flex flex-col lg:min-h-0 overflow-hidden" style={{ backgroundColor: CARD, boxShadow: CARD_SHADOW }}>
              <div className="shrink-0 px-5 pt-5 pb-3 flex flex-wrap items-center gap-x-4 gap-y-3">
                <div className="min-w-0 me-auto">
                  <h2 className="text-[18px] font-bold leading-tight" style={{ color: INK }}>{t('voting_roll_call_heading')}</h2>
                  <p className="text-[13px] mt-0.5 leading-snug" style={{ color: INK_SOFT }}>{t('voting_prevote_roll_call_hint')}</p>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap" aria-live="polite">
                  <CountChip n={`${presentCount}/${votable.length}`} label={t('voting_prevote_present')} tone="green" />
                  <CountChip n={pvCount} label={t('voting_prevote_seg_pv')} tone="gold" />
                  <CountChip n={absentCount} label={t('voting_prevote_seg_absent')} tone="dim" />
                </div>
              </div>
              {votable.length > 0 && !readOnly && (
                <div className="shrink-0 px-5 pb-3 flex items-center gap-2">
                  <button type="button" onClick={() => onBulkStatus('present')}
                    className={`h-9 px-3.5 rounded-full text-[13px] font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] hover:bg-[rgba(47,107,69,0.18)] ${PRESS}`}
                    style={{ backgroundColor: 'rgba(47,107,69,0.10)', color: '#2F6B45' }}>
                    {t('rollcall_all_present')}
                  </button>
                  <button type="button" onClick={() => onBulkStatus('present-voting')}
                    className={`h-9 px-3.5 rounded-full text-[13px] font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] hover:bg-[rgba(182,135,31,0.22)] ${PRESS}`}
                    style={{ backgroundColor: 'rgba(182,135,31,0.13)', color: '#6A4A0A' }}>
                    {t('rollcall_all_pv')}
                  </button>
                </div>
              )}
              <div className="lg:flex-1 lg:min-h-0 overflow-y-auto px-3 pb-4" style={{ boxShadow: 'inset 0 1px 0 rgba(27,56,40,0.07)' }}>
                {votable.length === 0 ? (
                  <p className="text-[15px] py-6 px-2" style={{ color: INK_SOFT }}>{t('voting_mark_present')}</p>
                ) : (
                  <ul className="space-y-1 pt-2">
                    {votable.map((d) => {
                      const s = statusOf(d);
                      const name = getCountryDisplayName(d.country, language);
                      return (
                        <li
                          key={d.id}
                          className="flex items-center gap-3 rounded-2xl ps-2 pe-1.5 py-1.5 transition-[background-color] duration-200 motion-reduce:transition-none"
                          style={{ backgroundColor: rowTint(s) }}
                        >
                          <SeatCircleFlag seat={d} size={38} decorative style={{ opacity: s === 'absent' ? 0.5 : 1 }} />
                          <span className="flex-1 min-w-0 text-[16px] font-medium truncate" style={{ color: s === 'absent' ? INK_SOFT : INK }}>{name}</span>
                          <button
                            type="button"
                            onClick={() => onToggleObserver(d)}
                            disabled={readOnly}
                            title={t('rollcall_observer_make')}
                            aria-label={`${t('rollcall_observer_make')}: ${name}`}
                            className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] hover:bg-[rgba(27,56,40,0.08)] disabled:opacity-40 ${PRESS}`}
                            style={{ color: '#9A8A78' }}
                          >
                            <Megaphone size={16} aria-hidden />
                          </button>
                          <div role="radiogroup" aria-label={name} className="shrink-0 flex rounded-full p-1 gap-0.5" style={{ backgroundColor: 'rgba(27,56,40,0.07)' }}>
                            {segments.map((seg) => {
                              const on = s === seg.value;
                              return (
                                <button
                                  key={seg.value}
                                  type="button"
                                  role="radio"
                                  aria-checked={on}
                                  title={seg.title}
                                  disabled={readOnly}
                                  onClick={() => { if (!on) onSetStatus(d.id, seg.value); }}
                                  className={`h-8 min-w-[3.25rem] px-2.5 rounded-full text-[12.5px] font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] disabled:cursor-not-allowed ${PRESS}`}
                                  style={{
                                    backgroundColor: on ? seg.on : 'transparent',
                                    color: on ? '#FFFFFF' : INK_SOFT,
                                    boxShadow: on ? '0 1px 2px rgba(0,0,0,0.18)' : 'none',
                                  }}
                                >
                                  {seg.label}
                                </button>
                              );
                            })}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {observers.length > 0 && (
                  <div className="mt-4 pt-3 px-2" style={{ boxShadow: 'inset 0 1px 0 rgba(27,56,40,0.10)' }}>
                    <p className="text-[14px] font-semibold" style={{ color: INK }}>
                      {t('voting_observers_heading', { n: observers.length })}
                    </p>
                    <p className="text-[13px] mt-0.5 mb-2 leading-snug" style={{ color: INK_SOFT }}>{t('voting_observers_note')}</p>
                    <ul className="space-y-1">
                      {observers.map((d) => {
                        const name = getCountryDisplayName(d.country, language);
                        return (
                          <li key={d.id} className="flex items-center gap-3 rounded-2xl ps-2 pe-1.5 py-1.5 -mx-2" style={{ backgroundColor: 'rgba(238,217,138,0.24)' }}>
                            <SeatCircleFlag seat={d} size={34} decorative />
                            <span className="flex-1 min-w-0 text-[15px] font-medium truncate" style={{ color: INK }}>{name}</span>
                            <button
                              type="button"
                              onClick={() => onToggleObserver(d)}
                              disabled={readOnly}
                              title={t('rollcall_observer_remove')}
                              aria-label={`${t('rollcall_observer_remove')}: ${name}`}
                              aria-pressed
                              className={`w-10 h-10 rounded-full flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] disabled:opacity-40 ${PRESS}`}
                              style={{ backgroundColor: FOREST, color: GOLD }}
                            >
                              <Megaphone size={16} aria-hidden />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>
            </section>

            {/* ── What it takes, the rules, the action ── */}
            <div className="flex flex-col gap-4 sm:gap-5 lg:min-h-0">
              <section
                className="gv-in gv-in-3 shrink-0 rounded-[28px] p-5 flex gap-5 items-start"
                style={{ backgroundColor: FOREST, boxShadow: '0 2px 4px rgba(27,56,40,0.18), 0 16px 40px rgba(27,56,40,0.22)' }}
                aria-live="polite"
              >
                <div className="shrink-0 w-[92px] text-center">
                  <p className="text-[12.5px] font-medium" style={{ color: 'rgba(238,217,138,0.85)' }}>{t('voting_prevote_to_pass')}</p>
                  <p className="text-[40px] font-bold leading-none tabular-nums mt-1.5" style={{ color: GOLD }}>
                    {consensus ? 0 : presentCount === 0 ? '–' : outcome.needed}
                  </p>
                  <p className="text-[12.5px] font-medium mt-1.5 leading-tight" style={{ color: 'rgba(255,255,255,0.72)' }}>
                    {consensus ? t('voting_rules_stat_against_max').toLowerCase() : t('voting_prevote_of_total', { total: presentCount })}
                  </p>
                </div>
                <ul className="min-w-0 flex-1 space-y-2">
                  <Fact icon={<Scale size={13} strokeWidth={2.5} />}>{thresholdFact}</Fact>
                  <Fact icon={<CircleSlash size={13} strokeWidth={2.5} />}>{abstentionFact}</Fact>
                  <Fact icon={<ShieldCheck size={13} strokeWidth={2.5} />} tone={vetoFact.warn ? 'warn' : 'plain'}>{vetoFact.text}</Fact>
                  <Fact icon={<Users size={13} strokeWidth={2.5} />} tone={quorumFact.warn ? 'warn' : 'plain'}>{quorumFact.text}</Fact>
                </ul>
              </section>

              <section className="gv-in gv-in-4 rounded-[28px] flex flex-col lg:flex-1 lg:min-h-0 overflow-hidden" style={{ backgroundColor: CARD, boxShadow: CARD_SHADOW }}>
                <div className="shrink-0 px-5 pt-4 flex items-baseline justify-between gap-3">
                  <h2 className="text-[16px] font-bold" style={{ color: INK }}>{t('voting_rules_title')}</h2>
                  <p className="text-[12px] truncate" style={{ color: INK_SOFT }}>{readOnly ? t('voting_rules_read_only') : t('settings_changes_apply')}</p>
                </div>
                <div role="tablist" aria-label={t('voting_rules_title')} className="shrink-0 mx-4 mt-3 grid grid-cols-4 gap-1 rounded-2xl p-1" style={{ backgroundColor: 'rgba(27,56,40,0.07)' }}>
                  {tabs.map((tb) => {
                    const on = tab === tb.key;
                    return (
                      <button
                        key={tb.key}
                        type="button"
                        role="tab"
                        id={`gv-rule-tab-${tb.key}`}
                        aria-selected={on}
                        aria-controls="gv-rule-panel"
                        onClick={() => setTab(tb.key)}
                        className="min-w-0 rounded-xl px-2 py-2 text-start focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] transition-[background-color,box-shadow,color] duration-150 motion-reduce:transition-none"
                        style={{
                          backgroundColor: on ? '#FCFAF5' : 'transparent',
                          boxShadow: on ? '0 1px 2px rgba(27,56,40,0.10), 0 4px 10px rgba(27,56,40,0.08)' : 'none',
                        }}
                      >
                        <span className="flex items-center gap-1.5 text-[12px] font-medium truncate" style={{ color: on ? FOREST : INK_SOFT }}>
                                                    <span className="truncate">{tb.label}</span>
                        </span>
                        <span className="block text-[13.5px] font-semibold truncate mt-0.5 tabular-nums" style={{ color: tb.warn ? '#8B2020' : INK }}>{tb.value}</span>
                      </button>
                    );
                  })}
                </div>
                <div id="gv-rule-panel" role="tabpanel" aria-labelledby={`gv-rule-tab-${tab}`} key={tab} className="gv-tabpanel lg:flex-1 lg:min-h-0 overflow-y-auto px-5 py-4">
                  {tab === 'threshold' && (
                    <Choice
                      label={t('voting_rules_threshold_info_title')}
                      value={settings.substantiveThreshold}
                      disabled={readOnly}
                      onChange={(v) => onRulesChange({ substantiveThreshold: v })}
                      options={[
                        { value: 'simple', label: t('voting_rules_threshold_simple'), sub: t('voting_prevote_threshold_simple_sub') },
                        { value: 'supermajority-2-3', label: '2/3', sub: t('voting_prevote_threshold_two_thirds_sub') },
                        { value: 'consensus', label: t('voting_rules_threshold_consensus'), sub: t('voting_prevote_threshold_consensus_sub') },
                      ]}
                    />
                  )}
                  {tab === 'abstentions' && (
                    <div className="divide-y divide-[rgba(27,56,40,0.08)]">
                      <Switch
                        label={t('settings_allow_abstentions_label')}
                        checked={settings.allowAbstentions}
                        disabled={readOnly}
                        onChange={(v) => onRulesChange({ allowAbstentions: v })}
                      />
                      <Switch
                        label={t('voting_rules_count_abstentions_label')}
                        checked={settings.abstentionsInDenominator === true}
                        disabled={readOnly || !settings.allowAbstentions}
                        onChange={(v) => onRulesChange({ abstentionsInDenominator: v })}
                      />
                      <p className="text-[13px] pt-3 leading-snug [text-wrap:pretty]" style={{ color: INK_SOFT }}>{t('voting_rules_count_abstentions_info_body')}</p>
                    </div>
                  )}
                  {tab === 'veto' && (
                    <div>
                      <Choice
                        label={t('voting_rules_veto_mode')}
                        value={settings.vetoMode}
                        disabled={readOnly}
                        onChange={onVetoModeChange}
                        options={[
                          { value: 'none', label: t('voting_rules_veto_off') },
                          { value: 'p5', label: 'P5' },
                          { value: 'unanimous', label: t('voting_prevote_veto_unanimous') },
                          { value: 'custom', label: t('voting_rules_veto_custom_short') },
                        ]}
                      />
                      {vetoOn && (
                        <div className="mt-4">
                          <VetoCountryPicker
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
                      <p className="text-[13px] mt-3 leading-snug [text-wrap:pretty]" style={{ color: vetoFact.warn ? '#8B2020' : INK_SOFT }}>{vetoFact.text}</p>
                    </div>
                  )}
                  {tab === 'quorum' && (
                    <div>
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
                      <p className="text-[13px] mt-3 leading-snug" style={{ color: quorumFact.warn ? '#8B2020' : INK_SOFT }}>{quorumFact.text}</p>
                    </div>
                  )}
                </div>
              </section>

              {/* The one primary action */}
              <div className="gv-in gv-in-4 shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <p className="flex-1 text-[14px] font-medium text-center sm:text-start [text-wrap:pretty]" style={{ color: presentCount > 0 ? INK_SOFT : '#8B2020' }}>
                  {presentCount > 0 ? t('voting_prevote_start_sub', { n: presentCount }) : t('voting_mark_present')}
                </p>
                <button
                  type="button"
                  onClick={onConfirm}
                  disabled={!canConfirm}
                  className={`h-12 px-8 rounded-full text-[15px] font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] focus-visible:ring-offset-2 disabled:cursor-not-allowed ${PRESS}`}
                  style={{
                    backgroundColor: canConfirm ? FOREST : 'rgba(27,56,40,0.18)',
                    color: canConfirm ? GOLD : 'rgba(28,20,16,0.45)',
                    boxShadow: canConfirm ? '0 2px 4px rgba(27,56,40,0.22), 0 12px 32px rgba(27,56,40,0.26)' : 'none',
                  }}
                >
                  {doc ? t('voting_prevote_start') : t('voting_prevote_done')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
}
