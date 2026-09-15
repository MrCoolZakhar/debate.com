'use client';

/**
 * PreVoteScreen — the calm, projector-readable "before the vote" screen on /voting/[code].
 *
 * Replaces the old dark roll-call modal plus the side rules console. Three parts:
 *   1. a summary band: big present counts and, in plain sentences, what this vote will
 *      need to pass under the rules as they stand right now
 *   2. the roll call (round flags, an explicit Absent / Present / P+V control per seat,
 *      observers kept apart)
 *   3. the rules: threshold, abstentions, veto (with the custom "+" picker), quorum
 * and ONE primary action, "Start voting", which confirms the roll call.
 *
 * It owns no rule state. Every control calls `onRulesChange` with only the keys that
 * changed, and the voting page writes that patch through `applyRules` →
 * `saveCommitteeSettings` → `patch_committee_settings` (AGENTS.md rule 12). The
 * pass/fail maths is `computeVoteOutcome`, the same function the ballot screen uses.
 *
 * Only the Moderator's device renders it (the page gates it on `!isViewOnly`, because
 * the roll call writes delegate statuses). `readOnly` still disables every control, so
 * the component can never be the thing that lets a Commenter write.
 */

import type { ReactNode } from 'react';
import { Megaphone, Scale, ShieldCheck, Users, CircleSlash } from 'lucide-react';
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
const CARD = '#F0EBDD';
const CARD_SHADOW = '0 0 0 1px rgba(27,56,40,0.06), 0 1px 2px rgba(27,56,40,0.06), 0 8px 24px rgba(27,56,40,0.07)';
const PRESS = 'transition-[background-color,color,box-shadow,transform] duration-150 active:scale-[0.96] motion-reduce:transition-none motion-reduce:active:scale-100';

export interface PreVoteScreenProps {
  delegates: Delegate[];
  rollCallStatuses: Record<string, DelegateStatus>;
  isObserverSeat: (d: Delegate) => boolean;
  onToggleObserver: (d: Delegate) => void;
  onSetStatus: (id: string, status: DelegateStatus) => void;
  onConfirm: () => void;
  settings: CommitteeSettings;
  /** Only the changed keys. */
  onRulesChange: (patch: Partial<CommitteeSettings>) => void;
  onVetoModeChange: (mode: CommitteeSettings['vetoMode']) => void;
  /** The veto seats in force (P5 list or the custom list). */
  vetoEntries: string[];
  readOnly?: boolean;
}

function Section({ title, hint, children, className = '' }: { title: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-3xl p-4 sm:p-6 ${className}`} style={{ backgroundColor: CARD, boxShadow: CARD_SHADOW }}>
      <h2 className="text-[20px] sm:text-[22px] font-black leading-tight [text-wrap:balance]" style={{ color: INK }}>{title}</h2>
      {hint && <p className="text-[14px] mt-1 leading-snug [text-wrap:pretty]" style={{ color: INK_SOFT }}>{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function RuleBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="py-4 first:pt-0 last:pb-0 [&:not(:last-child)]:shadow-[inset_0_-1px_0_rgba(27,56,40,0.08)]">
      <p className="text-[12px] font-black uppercase tracking-[0.14em] mb-2.5" style={{ color: INK_SOFT }}>{label}</p>
      {children}
    </div>
  );
}

/** A radio group of large, calm options, each with an optional second line. */
function Choice<T extends string>({ value, options, onChange, label, disabled }: {
  value: T;
  options: { value: T; label: string; sub?: string }[];
  onChange: (v: T) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid gap-2" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${options.some((o) => o.sub) ? '8.5rem' : '4.5rem'}, 1fr))` }}>
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
            className={`min-h-12 rounded-2xl px-3 py-2.5 text-start focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] disabled:cursor-not-allowed ${PRESS}`}
            style={{
              backgroundColor: on ? FOREST : '#FAF8F3',
              color: on ? GOLD : INK,
              boxShadow: on ? '0 1px 2px rgba(27,56,40,0.25), 0 6px 16px rgba(27,56,40,0.18)' : '0 0 0 1px rgba(27,56,40,0.10)',
              opacity: disabled && !on ? 0.6 : 1,
            }}
          >
            <span className="block text-[16px] font-black leading-tight">{o.label}</span>
            {o.sub && (
              <span className="block text-[12.5px] font-medium leading-snug mt-0.5" style={{ color: on ? 'rgba(238,217,138,0.78)' : INK_SOFT }}>
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
    <label className="flex items-center gap-3 min-h-11 cursor-pointer" style={{ opacity: disabled ? 0.45 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}>
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
          style={{
            boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
            transform: checked ? 'translateX(calc(var(--gv-dir, 1) * 20px))' : 'translateX(0)',
          }}
        />
      </button>
    </label>
  );
}

function BigCount({ value, label, total, tone }: { value: number; label: string; total?: string; tone: 'gold' | 'plain' | 'dim' }) {
  const color = tone === 'gold' ? GOLD : tone === 'plain' ? '#FFFFFF' : 'rgba(255,255,255,0.62)';
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-baseline gap-x-1.5">
        <span className="text-[44px] sm:text-[56px] font-black leading-none tabular-nums" style={{ color }}>{value}</span>
        {total && <span className="text-[15px] font-bold tabular-nums whitespace-nowrap" style={{ color: 'rgba(255,255,255,0.55)' }}>{total}</span>}
      </div>
      <div className="text-[13px] sm:text-[14px] font-bold mt-1.5 leading-tight" style={{ color: 'rgba(255,255,255,0.72)' }}>{label}</div>
    </div>
  );
}

function Fact({ icon, children, tone = 'plain' }: { icon: ReactNode; children: ReactNode; tone?: 'plain' | 'warn' }) {
  return (
    <li className="flex items-start gap-3">
      <span
        className="mt-0.5 shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
        style={{ backgroundColor: tone === 'warn' ? 'rgba(252,165,165,0.16)' : 'rgba(238,217,138,0.14)', color: tone === 'warn' ? '#FCA5A5' : GOLD }}
        aria-hidden
      >
        {icon}
      </span>
      <span className="text-[15px] sm:text-[16px] font-semibold leading-snug [text-wrap:pretty]" style={{ color: tone === 'warn' ? '#FECACA' : 'rgba(255,255,255,0.9)' }}>
        {children}
      </span>
    </li>
  );
}

export function PreVoteScreen({
  delegates, rollCallStatuses, isObserverSeat, onToggleObserver, onSetStatus, onConfirm,
  settings, onRulesChange, onVetoModeChange, vetoEntries, readOnly = false,
}: PreVoteScreenProps) {
  const t = useT();
  const { language } = useLanguage();
  const rtl = language === 'ar';

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

  const thresholdFact = settings.substantiveThreshold === 'consensus'
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
    : {
        text: t('voting_prevote_veto_line', {
          names: seatedVeto.map((d) => getCountryDisplayName(d.country, language)).join(rtl ? '، ' : ', '),
        }),
        warn: false,
      };

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
    s === 'present' ? 'rgba(61,122,82,0.10)' : s === 'present-voting' ? 'rgba(182,135,31,0.12)' : 'transparent';

  return (
    <Portal>
      <div
        className="gv-prevote fixed inset-0 z-50 overflow-y-auto"
        style={{ backgroundColor: '#EDE7D8', ['--gv-dir' as string]: rtl ? -1 : 1 }}
        dir={rtl ? 'rtl' : undefined}
        role="dialog"
        aria-modal="true"
        aria-labelledby="gv-prevote-title"
      >
        <style>{`
          @keyframes gvPreVoteIn { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: none } }
          .gv-prevote .gv-in { animation: gvPreVoteIn 320ms cubic-bezier(0.2,0,0,1) both }
          .gv-prevote .gv-in-2 { animation-delay: 80ms }
          .gv-prevote .gv-in-3 { animation-delay: 160ms }
          @media (prefers-reduced-motion: reduce) { .gv-prevote .gv-in { animation: none } }
        `}</style>
        <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-8 pt-6 sm:pt-10 pb-36">
          {/* Heading */}
          <header className="gv-in mb-5 sm:mb-7">
            <p className="text-[13px] font-black uppercase tracking-[0.18em]" style={{ color: '#8A6414' }}>{t('voting_prevote_eyebrow')}</p>
            <h1 id="gv-prevote-title" className="text-[30px] sm:text-[40px] font-black leading-[1.05] mt-1 [text-wrap:balance]" style={{ color: INK }}>
              {t('voting_prevote_title')}
            </h1>
          </header>

          {/* Summary band */}
          <section
            className="gv-in gv-in-2 rounded-3xl p-5 sm:p-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-10"
            style={{ backgroundColor: FOREST, boxShadow: '0 2px 4px rgba(27,56,40,0.18), 0 18px 48px rgba(27,56,40,0.22)' }}
            aria-live="polite"
          >
            <div className="grid grid-cols-3 gap-4 sm:gap-6 content-start">
              <BigCount value={presentCount} total={t('voting_prevote_of_total', { total: votable.length })} label={t('voting_prevote_present')} tone="gold" />
              <BigCount value={pvCount} label={t('voting_prevote_present_voting')} tone="plain" />
              <BigCount value={absentCount} label={t('voting_prevote_seg_absent')} tone="dim" />
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-black uppercase tracking-[0.16em] mb-3" style={{ color: 'rgba(238,217,138,0.8)' }}>{t('voting_prevote_to_pass')}</p>
              <ul className="space-y-3">
                <Fact icon={<Scale size={16} strokeWidth={2.5} />}>{thresholdFact}</Fact>
                <Fact icon={<CircleSlash size={16} strokeWidth={2.5} />}>{abstentionFact}</Fact>
                <Fact icon={<ShieldCheck size={16} strokeWidth={2.5} />} tone={vetoFact.warn ? 'warn' : 'plain'}>{vetoFact.text}</Fact>
                <Fact icon={<Users size={16} strokeWidth={2.5} />} tone={quorumFact.warn ? 'warn' : 'plain'}>{quorumFact.text}</Fact>
              </ul>
            </div>
          </section>

          <div className="mt-5 sm:mt-7 grid gap-5 sm:gap-7 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] items-start">
            {/* Roll call */}
            <Section className="gv-in gv-in-3" title={t('voting_roll_call_heading')} hint={t('voting_prevote_roll_call_hint')}>
              {votable.length === 0 ? (
                <p className="text-[15px] py-4" style={{ color: INK_SOFT }}>{t('voting_mark_present')}</p>
              ) : (
                <ul className="space-y-1.5">
                  {votable.map((d) => {
                    const s = statusOf(d);
                    const name = getCountryDisplayName(d.country, language);
                    return (
                      <li
                        key={d.id}
                        className="flex items-center gap-3 rounded-2xl ps-2 pe-1.5 py-1.5 flex-wrap sm:flex-nowrap transition-[background-color] duration-200 motion-reduce:transition-none"
                        style={{ backgroundColor: rowTint(s) }}
                      >
                        <SeatCircleFlag seat={d} size={40} decorative style={{ opacity: s === 'absent' ? 0.5 : 1 }} />
                        <span className="flex-1 min-w-0 text-[17px] font-bold truncate" style={{ color: s === 'absent' ? INK_SOFT : INK }}>{name}</span>
                        <div className="flex items-center gap-1 ms-auto">
                          <button
                            type="button"
                            onClick={() => onToggleObserver(d)}
                            disabled={readOnly}
                            title={t('rollcall_observer_make')}
                            aria-label={`${t('rollcall_observer_make')}: ${name}`}
                            className={`w-10 h-10 rounded-full flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] hover:bg-[rgba(27,56,40,0.08)] disabled:opacity-40 ${PRESS}`}
                            style={{ color: INK_SOFT }}
                          >
                            <Megaphone size={17} aria-hidden />
                          </button>
                          <div role="radiogroup" aria-label={name} className="flex rounded-full p-1 gap-0.5" style={{ backgroundColor: 'rgba(27,56,40,0.07)' }}>
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
                                  className={`h-9 min-w-[3.25rem] px-2.5 rounded-full text-[13px] font-black focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] disabled:cursor-not-allowed ${PRESS}`}
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
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              {observers.length > 0 && (
                <div className="mt-5 pt-4" style={{ boxShadow: 'inset 0 1px 0 rgba(27,56,40,0.10)' }}>
                  <p className="text-[12px] font-black uppercase tracking-[0.14em]" style={{ color: '#8A6414' }}>
                    {t('voting_observers_heading', { n: observers.length })}
                  </p>
                  <p className="text-[13px] mt-0.5 mb-2 leading-snug" style={{ color: INK_SOFT }}>{t('voting_observers_note')}</p>
                  <ul className="space-y-1.5">
                    {observers.map((d) => {
                      const name = getCountryDisplayName(d.country, language);
                      return (
                        <li key={d.id} className="flex items-center gap-3 rounded-2xl ps-2 pe-1.5 py-1.5" style={{ backgroundColor: 'rgba(238,217,138,0.22)' }}>
                          <SeatCircleFlag seat={d} size={36} decorative />
                          <span className="flex-1 min-w-0 text-[16px] font-bold truncate" style={{ color: INK }}>{name}</span>
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
                            <Megaphone size={17} aria-hidden />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </Section>

            {/* Rules */}
            <Section className="gv-in gv-in-3" title={t('voting_rules_title')} hint={readOnly ? t('voting_rules_read_only') : t('settings_changes_apply')}>
              <RuleBlock label={t('voting_rules_threshold_info_title')}>
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
              </RuleBlock>

              <RuleBlock label={t('voting_rules_abstentions_heading')}>
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
              </RuleBlock>

              <RuleBlock label={t('voting_rules_veto_info_title')}>
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
                  <div className="mt-3">
                    <VetoCountryPicker
                      size="lg"
                      selected={vetoEntries}
                      roster={votable}
                      readOnly={readOnly || settings.vetoMode === 'p5'}
                      onChange={(next) => onRulesChange({ vetoCountries: next })}
                    />
                    {settings.vetoMode === 'p5' && !readOnly && (
                      <p className="text-[13px] mt-2 leading-snug" style={{ color: INK_SOFT }}>{t('voting_veto_p5_fixed')}</p>
                    )}
                  </div>
                )}
              </RuleBlock>

              <RuleBlock label={t('voting_rules_quorum_info_title')}>
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
              </RuleBlock>
            </Section>
          </div>
        </div>

        {/* The one primary action */}
        <div
          className="fixed inset-x-0 bottom-0 z-10 px-4 sm:px-8 pt-6 pb-4 sm:pb-6"
          style={{ background: 'linear-gradient(to top, #EDE7D8 62%, rgba(237,231,216,0))' }}
        >
          <div className="mx-auto w-full max-w-[1200px] flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:justify-end">
            <p className="text-[15px] font-semibold text-center sm:text-end [text-wrap:pretty]" style={{ color: presentCount > 0 ? INK_SOFT : '#8B2020' }}>
              {presentCount > 0 ? t('voting_prevote_start_sub', { n: presentCount }) : t('voting_mark_present')}
            </p>
            <button
              type="button"
              onClick={onConfirm}
              disabled={presentCount === 0 || readOnly}
              className={`min-h-14 px-10 rounded-2xl text-[19px] font-black focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] focus-visible:ring-offset-2 disabled:cursor-not-allowed ${PRESS}`}
              style={{
                backgroundColor: presentCount > 0 && !readOnly ? FOREST : 'rgba(27,56,40,0.18)',
                color: presentCount > 0 && !readOnly ? GOLD : 'rgba(28,20,16,0.45)',
                boxShadow: presentCount > 0 && !readOnly ? '0 2px 4px rgba(27,56,40,0.22), 0 12px 32px rgba(27,56,40,0.26)' : 'none',
              }}
            >
              {t('voting_prevote_start')}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
