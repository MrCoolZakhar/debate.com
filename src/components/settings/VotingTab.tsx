'use client';

import { Ban, CircleDashed, Crown, Handshake, ListChecks, MonitorSmartphone, Scale, ShieldBan, Users, Check } from 'lucide-react';
import type { CommitteeSettings } from '@/lib/settingsStore';
import { getCountryByName, getCountryDisplayName } from '@/lib/countries';
import { SeatCircleFlag, CircleFlag } from '@/components/CircleFlag';
import { K, T, W, LH, ICON, Section, GavelSwitch, SealChoice, HoverHint, InfoHint } from './settingsKit';
import type { TabProps } from './settingsTypes';

/** A hemicycle of 15 seats with the share needed to pass filled in forest. Also drawn on the
 *  voting roll call's Threshold bookmark. */
export function Hemicycle({ share, on, size = 30 }: { share: number; on?: boolean; size?: number }) {
  const seats: { x: number; y: number }[] = [];
  const rows = [{ r: 13, n: 7 }, { r: 8, n: 5 }, { r: 3.5, n: 3 }];
  rows.forEach(({ r, n }) => {
    for (let i = 0; i < n; i++) {
      const a = Math.PI - (Math.PI * i) / (n - 1);
      seats.push({ x: 16 + r * Math.cos(a), y: 17 - r * Math.sin(a) });
    }
  });
  seats.sort((a, b) => a.x - b.x);
  const filled = Math.ceil(share * seats.length);
  return (
    <svg width={size} height={(size * 20) / 32} viewBox="0 0 32 20" aria-hidden>
      {seats.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="1.7" fill={i < filled ? (on ? K.gold : K.forest) : (on ? 'rgba(238,217,138,0.28)' : 'rgba(27,56,40,0.2)')} />
      ))}
    </svg>
  );
}

/** A pie for a quorum fraction. */
function FractionPie({ frac, on }: { frac: number; on?: boolean }) {
  const r = 8;
  const a = frac * Math.PI * 2;
  const x = 10 + r * Math.sin(a);
  const y = 10 - r * Math.cos(a);
  const large = frac > 0.5 ? 1 : 0;
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
      <circle cx="10" cy="10" r={r} fill="none" stroke={on ? 'rgba(238,217,138,0.4)' : 'rgba(27,56,40,0.25)'} strokeWidth="1.5" strokeDasharray={frac === 0 ? '2 2' : undefined} />
      {frac > 0 && <path d={`M10 10 L10 ${10 - r} A${r} ${r} 0 ${large} 1 ${x} ${y} Z`} fill={on ? K.gold : K.forest} />}
    </svg>
  );
}

export default function VotingTab({ committee, s, upd, t, language, isViewOnly }: TabProps) {
  const dim = isViewOnly ? { opacity: 0.55, pointerEvents: 'none' as const } : undefined;
  const voting = committee.delegates.filter((d) => !d.isObserver);
  const total = voting.length;
  const quorumFrac: Record<CommitteeSettings['quorumThreshold'], number> = { none: 0, '1-4': 0.25, '1-3': 1 / 3, '1-2': 0.5 };
  const need = Math.ceil(quorumFrac[s.quorumThreshold] * total);

  const identity = (name: string) => getCountryByName(name)?.code ?? name.trim().toLowerCase();
  const p5 = s.p5Delegations ?? [];
  const p5Ids = new Set(p5.map(identity));
  const seatedNames = committee.delegates.filter((d) => p5Ids.has(identity(d.country))).map((d) => d.country);
  const seatedIds = new Set(seatedNames.map(identity));
  const vetoSet = new Set(s.vetoCountries ?? []);

  return (
    <div style={dim} aria-disabled={isViewOnly || undefined}>
      <Section icon={Scale} title={t('settings_substantive_threshold')} hint={t('stg_threshold_hint')} lead>
        {/* Three large panes (the hemicycle big, the name and a short caption beneath) with
            abstentions in their own pane at the side (17 Sep 2026). */}
        <div className="stg-vote-top" style={{ padding: '14px 0' }}>
          <SealChoice
            variant="pane"
            label={t('settings_substantive_threshold')}
            colsClass="sm:grid-cols-3"
            value={s.substantiveThreshold}
            onChange={(v) => upd('substantiveThreshold', v)}
            options={[
              { value: 'simple', title: t('settings_majority_simple'), note: t('stg_simple_note'), art: <Hemicycle size={116} share={8 / 15} on={s.substantiveThreshold === 'simple'} /> },
              { value: 'supermajority-2-3', title: t('settings_majority_supermajority'), note: t('stg_super_note'), art: <Hemicycle size={116} share={2 / 3} on={s.substantiveThreshold === 'supermajority-2-3'} /> },
              { value: 'consensus', title: t('settings_majority_consensus'), note: t('stg_consensus_note'), art: <Hemicycle size={116} share={1} on={s.substantiveThreshold === 'consensus'} /> },
            ]}
          />
          <div className="flex flex-col items-center justify-center text-center" style={{ borderRadius: 18, background: K.ivory, boxShadow: K.inSm, padding: '18px 14px' }}>
            <CircleDashed aria-hidden size={40} strokeWidth={1.8} style={{ color: s.allowAbstentions ? ICON.voting : K.inkSoft }} />
            <span className="inline-flex items-center gap-1.5" style={{ marginTop: 10 }}>
              <span id="stg-abst" style={{ fontSize: T.body, fontWeight: W.section, color: K.ink, lineHeight: LH.body }}>{t('settings_allow_abstentions_label')}</span>
              <InfoHint text={t('settings_allow_abstentions_note')} />
            </span>
            <span style={{ marginTop: 12 }}>
              <GavelSwitch icon={CircleDashed} labelledBy="stg-abst" checked={s.allowAbstentions} onChange={(v) => upd('allowAbstentions', v)} />
            </span>
          </div>
        </div>
      </Section>

      {/* Ballot choices (17 Sep 2026): rights votes and Pass, both on by default. */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2" style={{ padding: '4px 2px 14px' }}>
        <span className="inline-flex items-center gap-2.5">
          <span id="stg-rights" style={{ fontSize: T.body, fontWeight: W.label, color: K.ink }}>{t('voting_allow_rights_label')}</span>
          <GavelSwitch labelledBy="stg-rights" checked={s.allowRightsVotes !== false} onChange={(v) => upd('allowRightsVotes', v)} />
        </span>
        <span className="inline-flex items-center gap-2.5">
          <span id="stg-pass" style={{ fontSize: T.body, fontWeight: W.label, color: K.ink }}>{t('voting_allow_pass_label')}</span>
          <InfoHint text={t('voting_allow_pass_note')} />
          <GavelSwitch labelledBy="stg-pass" checked={s.allowPass !== false} onChange={(v) => upd('allowPass', v)} />
        </span>
      </div>

      {/* Device voting (src/lib/deviceVoting.ts): off by default. Frozen into each ballot when it opens. */}
      <Section icon={MonitorSmartphone} title={t('voting_method_title')} hint={t('voting_method_hint')} delay={20}>
        <div style={{ padding: '10px 0' }}>
          <SealChoice
            compact
            colsClass="grid-cols-2"
            label={t('voting_method_title')}
            value={s.votingMethod === 'device' ? 'device' : 'rollcall'}
            onChange={(v) => upd('votingMethod', v)}
            options={[
              { value: 'rollcall', title: t('voting_method_rollcall'), icon: ListChecks },
              { value: 'device', title: t('voting_method_device'), icon: MonitorSmartphone },
            ]}
          />
        </div>
      </Section>

      <Section icon={ShieldBan} title={t('stg_veto_title')} hint={t('stg_veto_hint')} lead delay={40}>
        <div style={{ padding: '10px 0' }}>
          <SealChoice
            label={t('stg_veto_title')}
            value={s.vetoMode}
            onChange={(v) => upd('vetoMode', v)}
            options={[
              { value: 'none', title: t('settings_veto_none_label'), note: t('settings_veto_none_desc'), icon: Ban },
              { value: 'p5', title: t('settings_veto_p5_label'), note: t('stg_veto_p5_short'), icon: Crown },
              { value: 'unanimous', title: t('settings_veto_unanimous_label'), note: t('settings_veto_unanimous_desc'), icon: Handshake },
              { value: 'custom', title: t('settings_veto_custom_label'), note: t('settings_veto_custom_desc'), icon: ListChecks },
            ]}
          />
        </div>

        {/* The P5 list is fixed (it is the Security Council's permanent five). The panel
            answers the question a non-UNSC chair has: which of them sit here? */}
        {s.vetoMode === 'p5' && (
          <div style={{ borderTop: `1px solid ${K.hair}`, padding: '10px 0' }}>
            <div className="flex items-center justify-between gap-3" style={{ marginBottom: 10 }}>
              <HoverHint text={t('stg_p5_fixed_hint')}>
                <span style={{ fontSize: T.body, fontWeight: W.section, color: K.forest }}>{t('settings_p5_delegations')}</span>
              </HoverHint>
              <span className="stg-num" style={{ fontSize: T.caption, fontWeight: W.label, color: seatedIds.size === p5.length ? K.forestMid : '#7A5424' }}>
                {t('stg_p5_seated', { n: seatedIds.size, total: p5.length })}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {p5.map((name) => {
                const seated = seatedIds.has(identity(name));
                return (
                  <span key={name} className="inline-flex items-center gap-2" style={{
                    height: 38, padding: '0 12px 0 4px', borderRadius: 999, background: seated ? K.surface : 'transparent',
                    boxShadow: seated ? K.outSm : 'inset 0 0 0 1px rgba(28,20,16,0.12)', opacity: seated ? 1 : 0.5,
                  }}>
                    <CircleFlag country={name} size={30} decorative />
                    <span style={{ fontSize: T.body, fontWeight: W.label, color: K.ink }}>{getCountryDisplayName(name, language)}</span>
                  </span>
                );
              })}
            </div>
            {seatedIds.size < p5.length && (
              <div className="flex flex-wrap items-center gap-3" style={{ marginTop: 12, padding: '10px 12px', borderRadius: 12, background: 'rgba(184,132,74,0.10)' }}>
                <span className="stg-body flex-1" style={{ minWidth: 200, fontSize: T.body, fontWeight: W.body, color: '#7A5424' }}>
                  {seatedIds.size === 0 ? t('stg_p5_none_seated') : t('stg_p5_some_seated', { n: seatedIds.size })}
                </span>
                <button type="button" onClick={() => { upd('vetoCountries', seatedNames); upd('vetoMode', 'custom'); }}
                  className="stg-focus stg-press" style={{ height: 34, padding: '0 12px', borderRadius: 10, border: 'none', background: K.forest, color: K.gold, fontSize: T.body, fontWeight: W.section, cursor: 'pointer' }}>
                  {t('stg_p5_switch_custom')}
                </button>
              </div>
            )}
          </div>
        )}

        {s.vetoMode === 'custom' && (
          <div style={{ borderTop: `1px solid ${K.hair}`, padding: '10px 0' }}>
            <div className="flex items-center justify-between gap-3" style={{ marginBottom: 10 }}>
              <span className="inline-flex items-center gap-1.5">
                <span style={{ fontSize: T.body, fontWeight: W.section, color: K.forest }}>{t('settings_veto_custom_members')}</span>
                <InfoHint text={t('settings_veto_custom_note')} />
              </span>
              <span className="stg-num" style={{ fontSize: T.caption, fontWeight: W.label, color: K.inkSoft }}>{t('stg_selected_count', { n: committee.delegates.filter((d) => vetoSet.has(d.country)).length })}</span>
            </div>
            <div className="flex flex-wrap gap-2" role="group" aria-label={t('settings_veto_custom_members')}>
              {[...committee.delegates]
                .sort((a, b) => getCountryDisplayName(a.country, language).localeCompare(getCountryDisplayName(b.country, language), language, { sensitivity: 'base' }))
                .map((d) => {
                  const on = vetoSet.has(d.country);
                  return (
                    <button key={d.id} type="button" aria-pressed={on}
                      onClick={() => { const cur = s.vetoCountries ?? []; upd('vetoCountries', on ? cur.filter((c) => c !== d.country) : [...cur, d.country]); }}
                      className="stg-focus stg-press relative inline-flex items-center gap-2"
                      style={{
                        height: 40, padding: '0 14px 0 4px', borderRadius: 999, border: 'none', cursor: 'pointer',
                        background: on ? K.forest : K.surface, color: on ? '#F3EAD0' : K.ink, boxShadow: on ? '0 6px 14px -8px rgba(27,56,40,0.8)' : K.outSm,
                      }}>
                      <span className="relative inline-flex">
                        <SeatCircleFlag seat={d} size={32} decorative ring={on ? K.gold : true} />
                        {on && (
                          <span aria-hidden className="absolute inline-flex items-center justify-center" style={{ bottom: -2, insetInlineEnd: -3, width: 15, height: 15, borderRadius: 999, background: K.gold, color: K.forest, boxShadow: '0 0 0 2px ' + K.forest }}>
                            <Check size={9} strokeWidth={3.4} />
                          </span>
                        )}
                      </span>
                      <span style={{ fontSize: T.body, fontWeight: W.label }}>{getCountryDisplayName(d.country, language)}</span>
                    </button>
                  );
                })}
            </div>
          </div>
        )}
      </Section>

      <Section icon={Users} title={t('settings_section_quorum')} hint={t('settings_quorum_note')} delay={80}
        aside={s.quorumThreshold !== 'none' && total > 0 ? (
          <span className="stg-num shrink-0" style={{ fontSize: T.body, fontWeight: W.label, color: K.forest, background: K.ivory, borderRadius: 999, padding: '5px 10px', boxShadow: K.inSm }}>
            {t('stg_quorum_needs', { n: need, total })}
          </span>
        ) : undefined}>
        <div style={{ padding: '10px 0' }}>
          <SealChoice
            compact
            colsClass="grid-cols-2 lg:grid-cols-4"
            label={t('settings_quorum_label')}
            value={s.quorumThreshold}
            onChange={(v) => upd('quorumThreshold', v)}
            options={[
              { value: 'none', title: t('settings_quorum_none'), art: <FractionPie frac={0} on={s.quorumThreshold === 'none'} /> },
              { value: '1-4', title: t('settings_quorum_1_4'), art: <FractionPie frac={0.25} on={s.quorumThreshold === '1-4'} /> },
              { value: '1-3', title: t('settings_quorum_1_3'), art: <FractionPie frac={1 / 3} on={s.quorumThreshold === '1-3'} /> },
              { value: '1-2', title: t('settings_quorum_1_2'), art: <FractionPie frac={0.5} on={s.quorumThreshold === '1-2'} /> },
            ]}
          />
        </div>
      </Section>
    </div>
  );
}
