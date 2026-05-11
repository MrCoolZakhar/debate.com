'use client';

import { useState, useEffect } from 'react';
import { useSettingsStore, CommitteeSettings } from '@/lib/settingsStore';
import { Committee } from '@/lib/types';
import { updateCommitteeCode } from '@/lib/committeeService';
import { getFlagEmoji, getCountryByName } from '@/lib/countries';

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
      upd('chairJoinSuffix', Math.floor(1000 + Math.random() * 9000).toString());
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
    { id: 'voting', label: 'Voting' },
    { id: 'motions', label: 'Motions' },
    { id: 'access', label: 'Access' },
    { id: 'points', label: 'Points' },
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
            <h2 className="text-base font-black" style={{ color: '#EED98A' }}>SESSION SETTINGS</h2>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(238,217,138,0.6)', fontFamily: "'DM Mono', monospace" }}>{committee.name} · {committee.code}</p>
          </div>
          <button onClick={onClose} className="text-xl leading-none transition-colors focus:outline-none" style={{ color: 'rgba(238,217,138,0.6)' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#EED98A'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'rgba(238,217,138,0.6)'; }}>✕</button>
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
              <SectionLabel>VOTING THRESHOLDS</SectionLabel>
              <SelectRow
                label="Procedural vote threshold"
                value={s.proceduralThreshold}
                onChange={(v) => upd('proceduralThreshold', v as CommitteeSettings['proceduralThreshold'])}
                options={[
                  { value: 'simple', label: 'Simple majority (1/2 + 1)' },
                  { value: 'absolute', label: 'Absolute majority (1/2)' },
                ]}
              />
              <SelectRow
                label="Substantive vote threshold"
                value={s.substantiveThreshold}
                onChange={(v) => upd('substantiveThreshold', v as CommitteeSettings['substantiveThreshold'])}
                options={[
                  { value: 'simple', label: 'Simple majority (1/2 + 1)' },
                  { value: 'supermajority-2-3', label: '2/3 Supermajority' },
                  { value: 'consensus', label: 'Consensus' },
                ]}
              />
              <SelectRow
                label="Amendment vote threshold"
                value={s.amendmentThreshold}
                onChange={(v) => upd('amendmentThreshold', v as CommitteeSettings['amendmentThreshold'])}
                options={[
                  { value: 'simple', label: 'Simple majority (1/2 + 1)' },
                  { value: 'supermajority-2-3', label: '2/3 Supermajority' },
                ]}
              />

              <SectionLabel>ABSTENTIONS</SectionLabel>
              <Toggle
                label="Allow abstentions on substantive votes"
                note="Abstentions are excluded from the denominator when calculating the threshold."
                value={s.allowAbstentions}
                onChange={(v) => upd('allowAbstentions', v)}
              />

              <SectionLabel>VETO POWER</SectionLabel>
              <div className="space-y-3 py-3" style={{ borderBottom: '1px solid #DDD4C0' }}>
                {([
                  { id: 'none', label: 'No veto power', desc: 'Standard majority rules apply' },
                  { id: 'p5', label: 'P5 veto power', desc: 'China, France, Russia, UK, USA each hold an individual veto. A single No defeats any resolution.' },
                  { id: 'unanimous', label: 'Unanimous decision required', desc: 'All present-and-voting delegations must vote Yes for a resolution to pass.' },
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
                  <p className="text-xs font-semibold mb-1" style={{ color: '#1B3828' }}>P5 Delegations</p>
                  <p className="text-xs font-mono" style={{ color: '#1C1410' }}>{s.p5Delegations.join(' · ')}</p>
                  <p className="text-xs mt-1" style={{ color: '#9A8A78' }}>These are the permanent veto-holding delegations. A single veto vote Against defeats any substantive resolution.</p>
                </div>
              )}

              <SectionLabel>QUORUM</SectionLabel>
              <SelectRow
                label="Quorum threshold"
                note="Minimum delegates present for formal business (motions, voting) to proceed."
                value={s.quorumThreshold}
                onChange={(v) => upd('quorumThreshold', v as CommitteeSettings['quorumThreshold'])}
                options={[
                  { value: 'none', label: 'No quorum required' },
                  { value: '1-4', label: '1/4 of total delegations' },
                  { value: '1-3', label: '1/3 of total delegations' },
                  { value: '1-2', label: '1/2 of total delegations' },
                ]}
              />
            </div>
          )}

          {/* ── Motions ── */}
          {tab === 'motions' && (
            <div>
              <SectionLabel>ENABLED MOTION TYPES</SectionLabel>
              <p className="text-xs mb-3 leading-snug" style={{ color: '#9A8A78' }}>Disabled motion types are hidden from the delegate motion-request interface immediately.</p>
              <Toggle
                label="Moderated caucus"
                value={s.motionModeratedCaucus}
                onChange={(v) => upd('motionModeratedCaucus', v)}
              />
              <Toggle
                label="Unmoderated caucus"
                value={s.motionUnmoderatedCaucus}
                onChange={(v) => upd('motionUnmoderatedCaucus', v)}
              />
              <Toggle
                label="Committee of the Whole (CoW)"
                value={s.motionCoW}
                onChange={(v) => upd('motionCoW', v)}
              />
              <Toggle
                label="Tour de Table"
                value={s.motionTourDeTable}
                onChange={(v) => upd('motionTourDeTable', v)}
              />
            </div>
          )}

          {/* ── Access & Identity ── */}
          {tab === 'access' && (
            <div>
              <SectionLabel>SESSION ID & JOIN CODES</SectionLabel>
              <div className="py-3" style={{ borderBottom: '1px solid #DDD4C0' }}>
                <div className="text-sm font-semibold mb-0.5" style={{ color: '#1C1410' }}>Custom session ID</div>
                <div className="text-xs mb-2 leading-snug" style={{ color: '#9A8A78' }}>
                  Human-readable identifier (e.g. UNSC-2026). Delegates re-joining will need the new ID.
                  Updates instantly — delegates can join with the new code right away.
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
                    {codeSaving ? '…' : codeSaved ? '✓ Saved' : 'APPLY'}
                  </button>
                </div>
                {codeError && <p className="text-red-400 text-xs mt-1.5">{codeError}</p>}
              </div>
              <Toggle
                label="Separate chair join code"
                note="Chairs join with a unique code separate from delegates. The chair code is shown below."
                value={s.separateChairCode}
                onChange={(v) => upd('separateChairCode', v)}
              />
              {s.separateChairCode && (
                <div className="py-3" style={{ borderBottom: '1px solid #DDD4C0' }}>
                  <div className="text-xs mb-1.5" style={{ color: '#9A8A78' }}>Chair join code</div>
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
                      COPY
                    </button>
                  </div>
                </div>
              )}
              <Toggle
                label="Chair must approve delegate entry"
                note="Joining delegates are held in a waiting room and the chair must admit them individually."
                value={s.requireChairApproval}
                onChange={(v) => upd('requireChairApproval', v)}
              />

              <SectionLabel>CHAIR RE-SIGN-IN</SectionLabel>
              <Toggle
                label="Allow multiple co-chairs simultaneously"
                note="Permits more than one chair account to be active in the same session at the same time."
                value={s.allowMultipleCoChairs}
                onChange={(v) => upd('allowMultipleCoChairs', v)}
              />
              <Toggle
                label="Chair session persistence"
                note="Keeps chair signed in across browser refreshes and device switches without re-authenticating."
                value={s.chairSessionPersistence}
                onChange={(v) => upd('chairSessionPersistence', v)}
              />
              <Toggle
                label="Chair takeover protection"
                note="New device sign-in alerts the existing session with a 30-second window to confirm before logout."
                value={s.chairTakeoverProtection}
                onChange={(v) => upd('chairTakeoverProtection', v)}
              />

              <SectionLabel>DELEGATE IDENTITY</SectionLabel>
              <Toggle
                label="Require delegation name at join"
                note="Delegates must specify their country or bloc name before entering the session."
                value={s.requireDelegationName}
                onChange={(v) => upd('requireDelegationName', v)}
              />
            </div>
          )}

          {/* ── Points ── */}
          {tab === 'points' && (
            <div>
              <SectionLabel>DELEGATE LEADERBOARD</SectionLabel>
              <p className="text-xs mb-3 leading-snug" style={{ color: '#9A8A78' }}>
                Scores: +5 attendance · +10 per WP sponsored · +20 per DR sponsored · +1 per 10s speaking · +10 per GSL speech · +8 per caucus speech
              </p>
              {committee.delegates.length === 0 && (
                <p className="text-xs" style={{ color: '#9A8A78' }}>No delegates in this session yet.</p>
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
                          {score.total} pts
                        </span>
                        <span className="text-xs shrink-0" style={{ color: '#9A8A78' }}>{isExpanded ? '▲' : '▼'}</span>
                      </button>

                      {isExpanded && (
                        <div className="mx-1 mb-3 p-3 rounded-xl space-y-3" style={{ backgroundColor: '#EDE7D8', border: '1px solid #DDD4C0' }}>
                          <div>
                            <p className="text-[10px] font-mono font-bold tracking-widest mb-1.5" style={{ color: '#1B3828' }}>SCORE BREAKDOWN</p>
                            <div className="space-y-1">
                              {[
                                { label: 'Attendance', value: score.attendancePoints },
                                { label: 'Working papers sponsored', value: score.wpPoints },
                                { label: 'Draft resolutions sponsored', value: score.drPoints },
                                { label: 'Speaking time', value: score.speakingPoints },
                                { label: `GSL speeches (${score.gslSpeeches}×)`, value: score.gslPoints },
                                { label: `Caucus speeches (${score.caucusSpeeches}×)`, value: score.caucusPoints },
                              ].map(({ label, value }) => (
                                <div key={label} className="flex justify-between text-xs">
                                  <span style={{ color: '#6A5A4A' }}>{label}</span>
                                  <span className="font-mono" style={{ color: '#1C1410' }}>+{value}</span>
                                </div>
                              ))}
                              <div className="flex justify-between text-xs pt-1 mt-1" style={{ borderTop: '1px solid #DDD4C0' }}>
                                <span className="font-semibold" style={{ color: '#1B3828' }}>Total</span>
                                <span className="font-mono font-black" style={{ color: '#1B3828' }}>+{score.total}</span>
                              </div>
                            </div>
                          </div>

                          {score.logs.length > 0 && (
                            <div>
                              <p className="text-[10px] font-mono font-bold tracking-widest mb-1.5" style={{ color: '#1B3828' }}>SPEAKING HISTORY</p>
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
                            <p className="text-[10px] font-mono font-bold tracking-widest mb-1.5" style={{ color: '#1B3828' }}>TIPS</p>
                            <div className="space-y-1">
                              {score.gslSpeeches === 0 && <p className="text-xs" style={{ color: '#6A5A4A' }}>• Get on the General Speakers&apos; List</p>}
                              {score.caucusSpeeches === 0 && <p className="text-xs" style={{ color: '#6A5A4A' }}>• Request a moderated caucus and speak</p>}
                              {score.wpPoints === 0 && score.drPoints === 0 && <p className="text-xs" style={{ color: '#6A5A4A' }}>• Submit a working paper or draft resolution</p>}
                              {score.gslSpeeches > 0 && score.caucusSpeeches > 0 && (score.wpPoints > 0 || score.drPoints > 0) && <p className="text-xs" style={{ color: '#3D7A52' }}>Great engagement — keep it up!</p>}
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
          <p className="text-[10px] text-center font-mono" style={{ color: '#9A8A78' }}>Changes apply instantly · No save required</p>
        </div>
      </div>
    </div>
  );
}
