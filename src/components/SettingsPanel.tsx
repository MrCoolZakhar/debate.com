'use client';

import { useState, useEffect } from 'react';
import { useSettingsStore, CommitteeSettings } from '@/lib/settingsStore';
import { Committee } from '@/lib/types';
import { updateCommitteeCode, updateCommitteeChairSuffixInDB } from '@/lib/committeeService';
import { getFlagEmoji, getCountryByName } from '@/lib/countries';
import { useT, useLanguage } from '@/contexts/LanguageContext';

type SettingsTab = 'voting' | 'motions' | 'access' | 'points';

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-mono font-bold tracking-widest mb-1 mt-5 first:mt-0" style={{ color: '#1B3828' }}>{children}</p>;
}

function Toggle({ value, onChange, label, note }: {
  value: boolean; onChange: (v: boolean) => void; label: string; note?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 last:border-0" style={{ borderBottom: '1px solid #DDD4C0' }}>
      <div className="flex-1">
        <div className="text-sm font-semibold" style={{ color: '#1C1410' }}>{label}</div>
        {note && <div className="text-xs mt-0.5 leading-snug" style={{ color: '#9A8A78' }}>{note}</div>}
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`relative shrink-0 w-10 h-[22px] rounded-full transition-colors mt-0.5 focus:outline-none`}
        style={{ backgroundColor: value ? '#1B3828' : '#DDD4C0' }}
      >
        <span className={`absolute top-[2px] left-[2px] w-[18px] h-[18px] rounded-full bg-white transition-transform shadow-sm ${value ? 'translate-x-[18px]' : 'translate-x-0'}`} />
      </button>
    </div>
  );
}

function SelectRow({ value, onChange, label, options, note }: {
  value: string; onChange: (v: string) => void; label: string;
  options: { value: string; label: string }[]; note?: string;
}) {
  return (
    <div className="py-3 last:border-0" style={{ borderBottom: '1px solid #DDD4C0' }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="text-sm font-semibold" style={{ color: '#1C1410' }}>{label}</div>
          {note && <div className="text-xs mt-0.5 leading-snug" style={{ color: '#9A8A78' }}>{note}</div>}
        </div>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none shrink-0 cursor-pointer max-w-[180px]"
          style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', color: '#1C1410' }}
        >
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
    </div>
  );
}

export function SettingsPanel({ committee, onClose, onCodeChange }: {
  committee: Committee;
  onClose: () => void;
  onCodeChange?: (newCode: string) => void;
}) {
  const t = useT();
  const { language, setLanguage } = useLanguage();
  const [tab, setTab] = useState<SettingsTab>('voting');
  const { getSettings, updateSetting, migrateSettings } = useSettingsStore();
  const s = getSettings(committee.code);
  const upd = <K extends keyof CommitteeSettings>(key: K, value: CommitteeSettings[K]) =>
    updateSetting(committee.code, key, value);

  // Custom session ID local state — allows full erase
  const [customCodeInput, setCustomCodeInput] = useState(s.customSessionId || committee.code);
  const [codeSaving, setCodeSaving] = useState(false);
  const [codeError, setCodeError] = useState('');
  const [codeSaved, setCodeSaved] = useState(false);

  // Points tab — expanded delegate
  const [expandedDelegate, setExpandedDelegate] = useState<string | null>(null);

  // Keep input in sync if the prop changes (e.g. after a redirect)
  useEffect(() => {
    setCustomCodeInput(s.customSessionId || committee.code);
  }, [committee.code, s.customSessionId]);

  // Auto-generate chairJoinSuffix when separateChairCode is enabled and suffix is empty
  useEffect(() => {
    if (s.separateChairCode && s.chairJoinSuffix === '') {
      const newSuffix = Math.floor(1000 + Math.random() * 9000).toString();
      upd('chairJoinSuffix', newSuffix);
      updateCommitteeChairSuffixInDB(committee.id, newSuffix);
    } else if (s.separateChairCode && s.chairJoinSuffix !== '') {
      updateCommitteeChairSuffixInDB(committee.id, s.chairJoinSuffix);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.separateChairCode, s.chairJoinSuffix]);

  const handleCodeSave = async () => {
    const newCode = customCodeInput.trim().toUpperCase();
    if (!newCode) {
      setCodeError('Code cannot be empty.');
      return;
    }
    if (newCode.length < 4) {
      setCodeError('Code must be at least 4 characters.');
      return;
    }
    if (newCode === committee.code) return; // no change

    setCodeSaving(true);
    setCodeError('');
    const success = await updateCommitteeCode(committee.id, newCode);
    if (success) {
      migrateSettings(committee.code, newCode);
      setCodeSaved(true);
      setTimeout(() => setCodeSaved(false), 2000);
      onCodeChange?.(newCode);
    } else {
      setCodeError('Code already taken or invalid. Try another.');
    }
    setCodeSaving(false);
  };

  // ── Points scoring helpers ──
  function computeScore(country: string) {
    const delegate = committee.delegates.find((d) => d.country === country);
    const isPresent = delegate ? delegate.status !== 'absent' : false;

    const attendancePoints = isPresent ? 5 : 0;

    const wpPoints = committee.documents
      .filter((doc) => doc.type === 'working-paper' && doc.sponsors.includes(country))
      .length * 10;

    const drPoints = committee.documents
      .filter((doc) => doc.type === 'draft-resolution' && doc.sponsors.includes(country))
      .length * 20;

    const logs = committee.messages
      .filter((m) => m.sender === '__system__' && m.content.startsWith('__log__:'))
      .map((m) => {
        try { return JSON.parse(m.content.slice('__log__:'.length)); } catch { return null; }
      })
      .filter((entry): entry is { country: string; seconds: number; context: string; topic: string; timestamp: string } => entry !== null && entry.country === country);

    const speakingPoints = Math.floor(logs.reduce((sum, e) => sum + (e.seconds || 0), 0) / 10);

    const gslSpeeches = logs.filter((e) => e.context === 'speakers-list').length;
    const caucusSpeeches = logs.filter((e) => e.context === 'moderated-caucus' || e.context === 'unmoderated-caucus' || e.context === 'tour-de-table').length;

    const gslPoints = gslSpeeches * 10;
    const caucusPoints = caucusSpeeches * 8;

    return {
      total: attendancePoints + wpPoints + drPoints + speakingPoints + gslPoints + caucusPoints,
      attendancePoints,
      wpPoints,
      drPoints,
      speakingPoints,
      gslSpeeches,
      caucusSpeeches,
      gslPoints,
      caucusPoints,
      logs,
    };
  }

  const tabs: { id: SettingsTab; label: string }[] = [
    { id: 'voting', label: t('settings_tab_voting') },
    { id: 'motions', label: t('settings_tab_motions') },
    { id: 'access', label: t('settings_tab_access') },
    { id: 'points', label: t('settings_tab_points') },
  ];

  const chairCode = `${committee.code}-${s.chairJoinSuffix || '????'}`;

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/40 flex justify-end"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md flex flex-col h-full shadow-2xl overflow-hidden" style={{ backgroundColor: '#FAF8F3', borderLeft: '1px solid #DDD4C0' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: '1px solid #DDD4C0', backgroundColor: '#1B3828' }}>
          <div className="flex flex-col">
            <h2 className="text-base font-black" style={{ color: '#EED98A' }}>{t('settings_session_settings')}</h2>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(238,217,138,0.6)', fontFamily: "'DM Mono', monospace" }}>{committee.name} · {committee.code}</p>
          </div>
          <div className="flex items-center gap-2.5">
            {/* Compact language toggle in header */}
            <div className="relative">
              {/* NEW badge — overlaps top of the toggle */}
              <span
                className="absolute left-1/2 -translate-x-1/2 z-10 pointer-events-none"
                style={{
                  top: '-9px',
                  backgroundColor: '#0E1E13',
                  color: '#EED98A',
                  border: '1.5px solid rgba(238,217,138,0.55)',
                  borderRadius: '6px',
                  padding: '1px 6px',
                  fontSize: '8px',
                  fontWeight: 900,
                  letterSpacing: '0.1em',
                  whiteSpace: 'nowrap',
                  lineHeight: '14px',
                }}
              >✨ NEW</span>
              <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid rgba(238,217,138,0.25)' }}>
                <button
                  onClick={() => setLanguage('en')}
                  className="px-2.5 py-1 text-[11px] font-black transition-all focus:outline-none"
                  style={{ backgroundColor: language === 'en' ? '#EED98A' : 'transparent', color: language === 'en' ? '#1B3828' : 'rgba(238,217,138,0.55)' }}
                >EN</button>
                <button
                  onClick={() => setLanguage('es')}
                  className="px-2.5 py-1 text-[11px] font-black transition-all focus:outline-none"
                  style={{ backgroundColor: language === 'es' ? '#EED98A' : 'transparent', color: language === 'es' ? '#1B3828' : 'rgba(238,217,138,0.55)' }}
                >ES</button>
              </div>
            </div>
            <button onClick={onClose} className="text-xl leading-none transition-colors focus:outline-none" style={{ color: 'rgba(238,217,138,0.6)' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#EED98A'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'rgba(238,217,138,0.6)'; }}>✕</button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex shrink-0" style={{ borderBottom: '1px solid #DDD4C0', backgroundColor: '#FAF8F3' }}>
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="flex-1 py-2.5 text-xs font-bold transition-colors focus:outline-none"
              style={{
                color: tab === t.id ? '#1B3828' : '#9A8A78',
                borderBottom: tab === t.id ? '2px solid #1B3828' : '2px solid transparent',
                marginBottom: '-1px',
              }}
            >
              {t.label.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">

          {/* ── Voting & Majorities ── */}
          {tab === 'voting' && (
            <div>
              <SectionLabel>{t('settings_section_voting')}</SectionLabel>
              <SelectRow
                label={t('settings_procedural_threshold')}
                value={s.proceduralThreshold}
                onChange={(v) => upd('proceduralThreshold', v as CommitteeSettings['proceduralThreshold'])}
                options={[
                  { value: 'simple', label: t('settings_majority_simple') },
                  { value: 'absolute', label: t('settings_majority_absolute') },
                ]}
              />
              <SelectRow
                label={t('settings_substantive_threshold')}
                value={s.substantiveThreshold}
                onChange={(v) => upd('substantiveThreshold', v as CommitteeSettings['substantiveThreshold'])}
                options={[
                  { value: 'simple', label: t('settings_majority_simple') },
                  { value: 'supermajority-2-3', label: t('settings_majority_supermajority') },
                  { value: 'consensus', label: t('settings_majority_consensus') },
                ]}
              />
              <SelectRow
                label={t('settings_amendment_threshold')}
                value={s.amendmentThreshold}
                onChange={(v) => upd('amendmentThreshold', v as CommitteeSettings['amendmentThreshold'])}
                options={[
                  { value: 'simple', label: t('settings_majority_simple') },
                  { value: 'supermajority-2-3', label: t('settings_majority_supermajority') },
                ]}
              />

              <SectionLabel>{t('settings_section_abstentions')}</SectionLabel>
              <Toggle
                label={t('settings_allow_abstentions_label')}
                note={t('settings_allow_abstentions_note')}
                value={s.allowAbstentions}
                onChange={(v) => upd('allowAbstentions', v)}
              />

              <SectionLabel>{t('settings_section_veto')}</SectionLabel>
              <div className="space-y-3 py-3" style={{ borderBottom: '1px solid #DDD4C0' }}>
                {([
                  { id: 'none', label: t('settings_veto_none_label'), desc: t('settings_veto_none_desc') },
                  { id: 'p5', label: t('settings_veto_p5_label'), desc: t('settings_veto_p5_desc') },
                  { id: 'unanimous', label: t('settings_veto_unanimous_label'), desc: t('settings_veto_unanimous_desc') },
                ] as const).map((option) => (
                  <label key={option.id} className="flex items-start gap-3 cursor-pointer" onClick={() => upd('vetoMode', option.id)}>
                    <div className="mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors"
                      style={{ borderColor: s.vetoMode === option.id ? '#1B3828' : '#DDD4C0', backgroundColor: s.vetoMode === option.id ? '#1B3828' : 'transparent' }}>
                      {s.vetoMode === option.id && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                    <div>
                      <div className="text-sm font-semibold" style={{ color: '#1C1410' }}>{option.label}</div>
                      <div className="text-xs mt-0.5 leading-snug" style={{ color: '#9A8A78' }}>{option.desc}</div>
                    </div>
                  </label>
                ))}
              </div>

              {s.vetoMode === 'p5' && (
                <div className="mt-2 p-3 rounded-xl" style={{ backgroundColor: '#EDE7D8', border: '1px solid #DDD4C0' }}>
                  <p className="text-xs font-semibold mb-1" style={{ color: '#1B3828' }}>{t('settings_p5_delegations')}</p>
                  <p className="text-xs font-mono" style={{ color: '#1C1410' }}>{s.p5Delegations.join(' · ')}</p>
                  <p className="text-xs mt-1" style={{ color: '#9A8A78' }}>{t('settings_p5_note')}</p>
                </div>
              )}

              <SectionLabel>{t('settings_section_quorum')}</SectionLabel>
              <SelectRow
                label={t('settings_quorum_label')}
                note={t('settings_quorum_note')}
                value={s.quorumThreshold}
                onChange={(v) => upd('quorumThreshold', v as CommitteeSettings['quorumThreshold'])}
                options={[
                  { value: 'none', label: t('settings_quorum_none') },
                  { value: '1-4', label: t('settings_quorum_1_4') },
                  { value: '1-3', label: t('settings_quorum_1_3') },
                  { value: '1-2', label: t('settings_quorum_1_2') },
                ]}
              />
            </div>
          )}

          {/* ── Motions ── */}
          {tab === 'motions' && (
            <div>
              <SectionLabel>{t('settings_section_motions')}</SectionLabel>
              <p className="text-xs mb-3 leading-snug" style={{ color: '#9A8A78' }}>{t('settings_motions_disabled_note')}</p>
              <Toggle
                label={t('settings_motion_moderated')}
                value={s.motionModeratedCaucus}
                onChange={(v) => upd('motionModeratedCaucus', v)}
              />
              <Toggle
                label={t('settings_motion_unmoderated')}
                value={s.motionUnmoderatedCaucus}
                onChange={(v) => upd('motionUnmoderatedCaucus', v)}
              />
              <Toggle
                label={t('settings_motion_cow')}
                value={s.motionCoW}
                onChange={(v) => upd('motionCoW', v)}
              />
              <Toggle
                label={t('settings_motion_tdt')}
                value={s.motionTourDeTable}
                onChange={(v) => upd('motionTourDeTable', v)}
              />
            </div>
          )}

          {/* ── Access & Identity ── */}
          {tab === 'access' && (
            <div>
              <SectionLabel>{t('settings_section_codes')}</SectionLabel>
              <div className="py-3" style={{ borderBottom: '1px solid #DDD4C0' }}>
                <div className="text-sm font-semibold mb-0.5" style={{ color: '#1C1410' }}>{t('settings_custom_id_label')}</div>
                <div className="text-xs mb-2 leading-snug" style={{ color: '#9A8A78' }}>
                  {t('settings_custom_id_note')}
                  {t('settings_code_hint')}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customCodeInput}
                    onChange={(e) => {
                      setCustomCodeInput(e.target.value.toUpperCase());
                      setCodeError('');
                      setCodeSaved(false);
                    }}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleCodeSave(); }}
                    placeholder={committee.code}
                    maxLength={20}
                    className="flex-1 rounded-lg px-3 py-2 text-sm focus:outline-none font-mono"
                    style={{ backgroundColor: '#FAF8F3', border: '1.5px solid #DDD4C0', color: '#1C1410' }}
                    onFocus={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#1B3828'; }}
                    onBlur={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#DDD4C0'; }}
                  />
                  <button
                    onClick={handleCodeSave}
                    disabled={codeSaving || !customCodeInput.trim() || customCodeInput.trim().toUpperCase() === committee.code}
                    className="px-3 py-2 rounded-lg text-xs font-bold transition-colors shrink-0 focus:outline-none"
                    style={{
                      backgroundColor: codeSaved ? '#3D7A52' : (!codeSaving && customCodeInput.trim() && customCodeInput.trim().toUpperCase() !== committee.code) ? '#1B3828' : '#DDD4C0',
                      color: codeSaved ? 'white' : (!codeSaving && customCodeInput.trim() && customCodeInput.trim().toUpperCase() !== committee.code) ? '#EDE7D8' : '#9A8A78',
                    }}
                  >
                    {codeSaving ? '…' : codeSaved ? t('settings_saved_check') : t('settings_apply')}
                  </button>
                </div>
                {codeError && <p className="text-red-400 text-xs mt-1.5">{codeError}</p>}
              </div>
              <Toggle
                label={t('settings_separate_chair_code_label')}
                note={t('settings_separate_chair_code_note')}
                value={s.separateChairCode}
                onChange={(v) => upd('separateChairCode', v)}
              />
              {s.separateChairCode && (
                <div className="py-3" style={{ borderBottom: '1px solid #DDD4C0' }}>
                  <div className="text-xs mb-1.5" style={{ color: '#9A8A78' }}>{t('settings_chair_code_label')}</div>
                  <div className="flex items-center gap-2">
                    <span className="flex-1 rounded-lg px-3 py-2 text-sm font-mono tracking-wider" style={{ backgroundColor: '#EDE7D8', border: '1px solid #DDD4C0', color: '#1B3828' }}>
                      {chairCode}
                    </span>
                    <button
                      onClick={() => navigator.clipboard.writeText(chairCode)}
                      className="px-3 py-2 rounded-lg text-xs font-bold transition-colors shrink-0 focus:outline-none"
                      style={{ backgroundColor: '#1B3828', color: '#EED98A' }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
                    >
                      {t('settings_copy')}
                    </button>
                  </div>
                </div>
              )}
              <Toggle
                label={t('settings_chair_approval_label')}
                note={t('settings_chair_approval_note')}
                value={s.requireChairApproval}
                onChange={(v) => upd('requireChairApproval', v)}
              />

              <SectionLabel>{t('settings_section_chair_resign')}</SectionLabel>
              <Toggle
                label={t('settings_multi_chairs_label')}
                note={t('settings_multi_chairs_note')}
                value={s.allowMultipleCoChairs}
                onChange={(v) => upd('allowMultipleCoChairs', v)}
              />
              <Toggle
                label={t('settings_chair_persistence_label')}
                note={t('settings_chair_persistence_note')}
                value={s.chairSessionPersistence}
                onChange={(v) => upd('chairSessionPersistence', v)}
              />
              <Toggle
                label={t('settings_chair_takeover_label')}
                note={t('settings_chair_takeover_note')}
                value={s.chairTakeoverProtection}
                onChange={(v) => upd('chairTakeoverProtection', v)}
              />

              <SectionLabel>{t('settings_section_delegate_identity')}</SectionLabel>
              <Toggle
                label={t('settings_require_delegation_label')}
                note={t('settings_require_delegation_note')}
                value={s.requireDelegationName}
                onChange={(v) => upd('requireDelegationName', v)}
              />

            </div>
          )}

          {/* ── Points ── */}
          {tab === 'points' && (
            <div>
              <SectionLabel>{t('settings_section_leaderboard')}</SectionLabel>
              <p className="text-xs mb-3 leading-snug" style={{ color: '#9A8A78' }}>
                {t('settings_points_scoring_note')}
              </p>
              {committee.delegates.length === 0 && (
                <p className="text-xs" style={{ color: '#9A8A78' }}>{t('settings_points_no_delegates')}</p>
              )}
              {[...committee.delegates]
                .map((d) => ({ delegate: d, score: computeScore(d.country) }))
                .sort((a, b) => b.score.total - a.score.total)
                .map(({ delegate: d, score }, idx) => {
                  const flag = getFlagEmoji(getCountryByName(d.country)?.code ?? '') || '🌐';
                  const isExpanded = expandedDelegate === d.id;
                  return (
                    <div key={d.id} style={{ borderBottom: '1px solid #DDD4C0' }} className="last:border-0">
                      <button
                        className="w-full flex items-center gap-3 py-3 text-left transition-colors rounded-lg px-1 focus:outline-none"
                        style={{ color: '#1C1410' }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#EDE7D8'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                        onClick={() => setExpandedDelegate(isExpanded ? null : d.id)}
                      >
                        <span className="text-xs w-5 text-right shrink-0 font-mono" style={{ color: '#9A8A78' }}>{idx + 1}</span>
                        <span className="text-lg leading-none shrink-0">{flag}</span>
                        <span className="flex-1 text-sm font-semibold truncate" style={{ color: '#1C1410' }}>{d.country}</span>
                        <span className="text-xs font-mono px-2 py-0.5 rounded-full shrink-0" style={{ backgroundColor: d.status === 'absent' ? '#DDD4C0' : '#1B3828', color: d.status === 'absent' ? '#9A8A78' : '#EED98A' }}>
                          {t('settings_points_pts').replace('{n}', String(score.total))}
                        </span>
                        <span className="text-xs shrink-0" style={{ color: '#9A8A78' }}>{isExpanded ? '▲' : '▼'}</span>
                      </button>

                      {isExpanded && (
                        <div className="mx-1 mb-3 p-3 rounded-xl space-y-3" style={{ backgroundColor: '#EDE7D8', border: '1px solid #DDD4C0' }}>
                          <div>
                            <p className="text-[10px] font-mono font-bold tracking-widest mb-1.5" style={{ color: '#1B3828' }}>{t('settings_points_score_breakdown')}</p>
                            <div className="space-y-1">
                              {[
                                { label: t('settings_points_attendance'), value: score.attendancePoints },
                                { label: t('settings_points_wp_sponsored'), value: score.wpPoints },
                                { label: t('settings_points_dr_sponsored'), value: score.drPoints },
                                { label: t('settings_points_speaking_time'), value: score.speakingPoints },
                                { label: t('settings_points_gsl_speeches').replace('{n}', String(score.gslSpeeches)), value: score.gslPoints },
                                { label: t('settings_points_caucus_speeches').replace('{n}', String(score.caucusSpeeches)), value: score.caucusPoints },
                              ].map(({ label, value }) => (
                                <div key={label} className="flex justify-between text-xs">
                                  <span style={{ color: '#6A5A4A' }}>{label}</span>
                                  <span className="font-mono" style={{ color: '#1C1410' }}>+{value}</span>
                                </div>
                              ))}
                              <div className="flex justify-between text-xs pt-1 mt-1" style={{ borderTop: '1px solid #DDD4C0' }}>
                                <span className="font-semibold" style={{ color: '#1B3828' }}>{t('settings_points_total')}</span>
                                <span className="font-mono font-black" style={{ color: '#1B3828' }}>+{score.total}</span>
                              </div>
                            </div>
                          </div>

                          {score.logs.length > 0 && (
                            <div>
                              <p className="text-[10px] font-mono font-bold tracking-widest mb-1.5" style={{ color: '#1B3828' }}>{t('settings_points_speaking_history')}</p>
                              <div className="space-y-1">
                                {score.logs.map((entry, i) => (
                                  <div key={i} className="text-xs">
                                    <span style={{ color: '#1C1410' }}>{entry.topic || '—'}</span>
                                    <span style={{ color: '#9A8A78' }}> · {entry.context} · {entry.seconds}s</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          <div>
                            <p className="text-[10px] font-mono font-bold tracking-widest mb-1.5" style={{ color: '#1B3828' }}>{t('settings_points_tips')}</p>
                            <div className="space-y-1">
                              {score.gslSpeeches === 0 && <p className="text-xs" style={{ color: '#6A5A4A' }}>{t('settings_points_tip_gsl')}</p>}
                              {score.caucusSpeeches === 0 && <p className="text-xs" style={{ color: '#6A5A4A' }}>{t('settings_points_tip_caucus')}</p>}
                              {score.wpPoints === 0 && score.drPoints === 0 && <p className="text-xs" style={{ color: '#6A5A4A' }}>{t('settings_points_tip_paper')}</p>}
                              {score.gslSpeeches > 0 && score.caucusSpeeches > 0 && (score.wpPoints > 0 || score.drPoints > 0) && <p className="text-xs" style={{ color: '#3D7A52' }}>{t('settings_points_tip_great')}</p>}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        <div className="px-5 py-3 shrink-0" style={{ borderTop: '1px solid #DDD4C0' }}>
          <p className="text-[10px] text-center font-mono" style={{ color: '#9A8A78' }}>{t('settings_changes_apply')}</p>
        </div>
      </div>
    </div>
  );
}
