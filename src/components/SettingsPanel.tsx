'use client';

import { useState, useEffect } from 'react';
import { useSettingsStore, CommitteeSettings, DEFAULT_MOTION_NAMES } from '@/lib/settingsStore';
import { Committee } from '@/lib/types';
import { updateCommitteeCode, deleteDocumentsByType } from '@/lib/committeeService';
import { getFlagUrl, getCountryByName } from '@/lib/countries';

type SettingsTab = 'voting' | 'motions' | 'access' | 'points';

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-mono text-[#7A5A38] tracking-widest mb-1 mt-5 first:mt-0">{children}</p>;
}

function Toggle({ value, onChange, label, note }: {
  value: boolean; onChange: (v: boolean) => void; label: string; note?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-[#2E1E0F] last:border-0">
      <div className="flex-1">
        <div className="text-sm font-semibold text-white">{label}</div>
        {note && <div className="text-xs text-[#7A5A38] mt-0.5 leading-snug">{note}</div>}
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`relative shrink-0 w-10 h-[22px] rounded-full transition-colors mt-0.5 ${value ? 'bg-[#7B4A1E]' : 'bg-[#2E1E0F]'}`}
      >
        <span className={`absolute top-[2px] left-[2px] w-[18px] h-[18px] rounded-full bg-white transition-transform shadow-sm ${value ? 'translate-x-[18px]' : 'translate-x-0'}`} />
      </button>
    </div>
  );
}

function BubbleRow({ value, onChange, label, options, note }: {
  value: string; onChange: (v: string) => void; label: string;
  options: { value: string; label: string }[]; note?: string;
}) {
  return (
    <div className="py-3 border-b border-[#2E1E0F] last:border-0">
      <div className="text-sm font-semibold text-white mb-1">{label}</div>
      {note && <div className="text-xs text-[#7A5A38] mb-2 leading-snug">{note}</div>}
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
              value === o.value
                ? 'bg-[#7B4A1E] border-[#8B5A2B] text-white'
                : 'bg-[#150F09] border-[#2E1E0F] text-[#C4A882] hover:border-[#7B4A1E]'
            }`}
          >
            {o.label}
          </button>
        ))}
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
  const [copiedChairCode, setCopiedChairCode] = useState(false);

  // Points tab — expanded delegate
  const [expandedDelegate, setExpandedDelegate] = useState<string | null>(null);

  // Document reset confirmation
  const [resetConfirm, setResetConfirm] = useState<'working-paper' | 'draft-resolution' | null>(null);

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
      <div className="w-full max-w-md bg-[#120D07] border-l border-[#2E1E0F] flex flex-col h-full shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2E1E0F] shrink-0">
          <div className="flex flex-col">
            <img
              src="/gavelling-logo.png"
              alt=""
              className="w-24 h-auto object-contain mb-1"
              style={{ filter: 'grayscale(1) brightness(0.6)' }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
            <h2 className="text-base font-black text-white">Session Settings</h2>
            <p className="text-xs text-[#7A5A38] mt-0.5">{committee.name} · {committee.code}</p>
          </div>
          <button onClick={onClose} className="text-[#7A5A38] hover:text-white transition-colors text-xl leading-none">✕</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#2E1E0F] shrink-0">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 py-2.5 text-xs font-bold transition-colors ${
                tab === t.id
                  ? 'text-white border-b-2 border-[#7B4A1E] -mb-px'
                  : 'text-[#7A5A38] hover:text-[#C4A882]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">

          {/* ── Voting & Majorities ── */}
          {tab === 'voting' && (
            <div>
              <SectionLabel>VOTING THRESHOLDS</SectionLabel>
              <BubbleRow
                label="Procedural vote threshold"
                value={s.proceduralThreshold}
                onChange={(v) => upd('proceduralThreshold', v as CommitteeSettings['proceduralThreshold'])}
                options={[
                  { value: 'simple', label: 'Simple (1/2 + 1)' },
                  { value: 'absolute', label: 'Absolute (1/2)' },
                ]}
              />
              <BubbleRow
                label="Substantive vote threshold"
                value={s.substantiveThreshold}
                onChange={(v) => upd('substantiveThreshold', v as CommitteeSettings['substantiveThreshold'])}
                options={[
                  { value: 'simple', label: 'Simple (1/2 + 1)' },
                  { value: 'supermajority-2-3', label: '2/3 Supermajority' },
                  { value: 'consensus', label: 'Consensus' },
                ]}
              />
              <BubbleRow
                label="Amendment vote threshold"
                value={s.amendmentThreshold}
                onChange={(v) => upd('amendmentThreshold', v as CommitteeSettings['amendmentThreshold'])}
                options={[
                  { value: 'simple', label: 'Simple (1/2 + 1)' },
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
              {/* Vertical slider — 3 positions, active highlighted with moving indicator */}
              <div className="py-3 border-b border-[#2E1E0F]">
                {(() => {
                  const vetoOptions = [
                    { id: 'none' as const, label: 'No veto power', desc: 'Standard majority rules apply' },
                    { id: 'p5' as const, label: 'P5 veto power', desc: 'China, France, Russia, UK, USA each hold an individual veto.' },
                    { id: 'unanimous' as const, label: 'Unanimous required', desc: 'All present-and-voting delegations must vote Yes.' },
                  ];
                  const activeIdx = vetoOptions.findIndex((o) => o.id === s.vetoMode);
                  return (
                    <div className="relative flex gap-3">
                      {/* Left indicator track */}
                      <div className="relative w-1 rounded-full bg-[#2E1E0F] shrink-0" style={{ minHeight: '120px' }}>
                        <div
                          className="absolute left-0 w-1 rounded-full bg-[#7B4A1E] transition-all duration-300"
                          style={{
                            top: `${(activeIdx / (vetoOptions.length - 1)) * 100 * ((vetoOptions.length - 1) / vetoOptions.length)}%`,
                            height: `${100 / vetoOptions.length}%`,
                          }}
                        />
                      </div>
                      {/* Options */}
                      <div className="flex-1 flex flex-col gap-1">
                        {vetoOptions.map((option) => (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => upd('vetoMode', option.id)}
                            className={`w-full text-left px-3 py-2.5 rounded-xl transition-colors ${
                              s.vetoMode === option.id
                                ? 'bg-[#7B4A1E]/20 border border-[#7B4A1E]/50'
                                : 'bg-transparent border border-transparent hover:bg-[#1A1209]'
                            }`}
                          >
                            <div className={`text-sm font-semibold ${s.vetoMode === option.id ? 'text-white' : 'text-[#C4A882]'}`}>{option.label}</div>
                            <div className="text-xs text-[#7A5A38] mt-0.5 leading-snug">{option.desc}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {s.vetoMode === 'p5' && (
                <div className="mt-2 p-3 bg-[#1A1209] border border-[#2E1E0F] rounded-xl">
                  <p className="text-xs font-semibold text-[#C4A882] mb-1">P5 Delegations</p>
                  <p className="text-xs text-white">{s.p5Delegations.join(' · ')}</p>
                  <p className="text-xs text-[#7A5A38] mt-1">These are the permanent veto-holding delegations. A single veto vote Against defeats any substantive resolution.</p>
                </div>
              )}

              <SectionLabel>QUORUM</SectionLabel>
              <BubbleRow
                label="Quorum threshold"
                note="Minimum delegates present for formal business (motions, voting) to proceed."
                value={s.quorumThreshold}
                onChange={(v) => upd('quorumThreshold', v as CommitteeSettings['quorumThreshold'])}
                options={[
                  { value: 'none', label: 'None' },
                  { value: '1-4', label: '1/4' },
                  { value: '1-3', label: '1/3' },
                  { value: '1-2', label: '1/2' },
                ]}
              />
            </div>
          )}

          {/* ── Motions ── */}
          {tab === 'motions' && (
            <div>
              <SectionLabel>ENABLED MOTION TYPES</SectionLabel>
              <p className="text-xs text-[#7A5A38] mb-3 leading-snug">Disabled motion types are hidden from the delegate motion-request interface immediately.</p>
              <Toggle label="Moderated caucus" value={s.motionModeratedCaucus} onChange={(v) => upd('motionModeratedCaucus', v)} />
              <Toggle label="Unmoderated caucus" value={s.motionUnmoderatedCaucus} onChange={(v) => upd('motionUnmoderatedCaucus', v)} />
              <Toggle label="Consultation of the Whole (CoW)" value={s.motionCoW} onChange={(v) => upd('motionCoW', v)} />
              <Toggle label="Tour de Table" value={s.motionTourDeTable} onChange={(v) => upd('motionTourDeTable', v)} />

              <SectionLabel>MOTION NAMES</SectionLabel>
              <p className="text-xs text-[#7A5A38] mb-3 leading-snug">Rename motion types to match your committee's rules of procedure.</p>
              {(
                [
                  { key: 'moderated',     defaultName: DEFAULT_MOTION_NAMES.moderated },
                  { key: 'unmoderated',   defaultName: DEFAULT_MOTION_NAMES.unmoderated },
                  { key: 'consultation',  defaultName: DEFAULT_MOTION_NAMES.consultation },
                  { key: 'tour',          defaultName: DEFAULT_MOTION_NAMES.tour },
                  { key: 'suspendDebate', defaultName: DEFAULT_MOTION_NAMES.suspendDebate },
                  { key: 'endDebate',     defaultName: DEFAULT_MOTION_NAMES.endDebate },
                ] as const
              ).map(({ key, defaultName }) => (
                <div key={key} className="py-2 border-b border-[#2E1E0F] last:border-0">
                  <div className="text-xs text-[#7A5A38] mb-1">{defaultName}</div>
                  <input
                    type="text"
                    value={s.motionNames?.[key] ?? defaultName}
                    onChange={(e) => upd('motionNames', { ...(s.motionNames ?? DEFAULT_MOTION_NAMES), [key]: e.target.value })}
                    placeholder={defaultName}
                    className="w-full bg-[#150F09] border border-[#2E1E0F] focus:border-[#7B4A1E] rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none transition-colors"
                  />
                </div>
              ))}

              <SectionLabel>DOCUMENT SUBMISSION LIMITS</SectionLabel>
              <p className="text-xs text-[#7A5A38] mb-3 leading-snug">Set a cap on how many working papers or draft resolutions can be submitted per session.</p>

              {/* WP limit */}
              <div className="py-3 border-b border-[#2E1E0F]">
                <div className="flex items-center justify-between gap-4 mb-2">
                  <div className="text-sm font-semibold text-white">Working Paper limit</div>
                  <button
                    onClick={() => upd('wpSubmissionLimit', s.wpSubmissionLimit === null ? 5 : null)}
                    className={`relative shrink-0 w-10 h-[22px] rounded-full transition-colors ${s.wpSubmissionLimit !== null ? 'bg-[#7B4A1E]' : 'bg-[#2E1E0F]'}`}
                  >
                    <span className={`absolute top-[2px] left-[2px] w-[18px] h-[18px] rounded-full bg-white transition-transform shadow-sm ${s.wpSubmissionLimit !== null ? 'translate-x-[18px]' : 'translate-x-0'}`} />
                  </button>
                </div>
                {s.wpSubmissionLimit !== null && (
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="number"
                      min={1}
                      value={s.wpSubmissionLimit}
                      onChange={(e) => upd('wpSubmissionLimit', Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-20 bg-[#150F09] border border-[#2E1E0F] focus:border-[#7B4A1E] rounded-lg px-3 py-1.5 text-white text-sm text-center focus:outline-none transition-colors"
                    />
                    <span className="text-xs text-[#7A5A38]">max WPs</span>
                  </div>
                )}
                <button
                  onClick={() => setResetConfirm('working-paper')}
                  className="mt-2 text-xs text-[#7A5A38] hover:text-[#C4A882] transition-colors"
                >
                  Reset count for WPs →
                </button>
              </div>

              {/* DR limit */}
              <div className="py-3 border-b border-[#2E1E0F]">
                <div className="flex items-center justify-between gap-4 mb-2">
                  <div className="text-sm font-semibold text-white">Draft Resolution limit</div>
                  <button
                    onClick={() => upd('drSubmissionLimit', s.drSubmissionLimit === null ? 3 : null)}
                    className={`relative shrink-0 w-10 h-[22px] rounded-full transition-colors ${s.drSubmissionLimit !== null ? 'bg-[#7B4A1E]' : 'bg-[#2E1E0F]'}`}
                  >
                    <span className={`absolute top-[2px] left-[2px] w-[18px] h-[18px] rounded-full bg-white transition-transform shadow-sm ${s.drSubmissionLimit !== null ? 'translate-x-[18px]' : 'translate-x-0'}`} />
                  </button>
                </div>
                {s.drSubmissionLimit !== null && (
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="number"
                      min={1}
                      value={s.drSubmissionLimit}
                      onChange={(e) => upd('drSubmissionLimit', Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-20 bg-[#150F09] border border-[#2E1E0F] focus:border-[#7B4A1E] rounded-lg px-3 py-1.5 text-white text-sm text-center focus:outline-none transition-colors"
                    />
                    <span className="text-xs text-[#7A5A38]">max DRs</span>
                  </div>
                )}
                <button
                  onClick={() => setResetConfirm('draft-resolution')}
                  className="mt-2 text-xs text-[#7A5A38] hover:text-[#C4A882] transition-colors"
                >
                  Reset count for DRs →
                </button>
              </div>

              {/* Reset confirmation panel */}
              {resetConfirm && (() => {
                const isWP = resetConfirm === 'working-paper';
                const count = (committee.documents ?? []).filter((d) => d.type === resetConfirm).length;
                return (
                  <div className="mt-3 p-4 bg-red-950/30 border border-red-900/40 rounded-xl space-y-3">
                    <p className="text-sm font-semibold text-white">
                      This will delete all {count} submitted {isWP ? 'WP' : 'DR'}{count !== 1 ? 's' : ''} and reset the count. Continue?
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={async () => {
                          await deleteDocumentsByType(committee.id, resetConfirm);
                          setResetConfirm(null);
                        }}
                        className="flex-1 bg-red-700 hover:bg-red-600 text-white py-2 rounded-lg font-bold text-xs transition-colors"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setResetConfirm(null)}
                        className="flex-1 bg-[#2E1E0F] hover:bg-[#3D2A15] text-[#C4A882] py-2 rounded-lg font-bold text-xs transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* ── Access & Identity ── */}
          {tab === 'access' && (
            <div>
              <SectionLabel>SESSION ID & JOIN CODES</SectionLabel>
              <div className="py-3 border-b border-[#2E1E0F]">
                <div className="text-sm font-semibold text-white mb-0.5">Custom session ID</div>
                <div className="text-xs text-[#7A5A38] mb-2 leading-snug">
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
                    className="flex-1 bg-[#150F09] border border-[#2E1E0F] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#7B4A1E] font-mono"
                  />
                  <button
                    onClick={handleCodeSave}
                    disabled={codeSaving || !customCodeInput.trim() || customCodeInput.trim().toUpperCase() === committee.code}
                    className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors shrink-0 ${
                      codeSaved
                        ? 'bg-green-800 text-green-200'
                        : 'bg-[#7B4A1E] hover:bg-[#8B5A2B] disabled:bg-[#2E1E0F] disabled:text-[#7A5A38] text-white'
                    }`}
                  >
                    {codeSaving ? '…' : codeSaved ? '✓ Saved' : 'Apply'}
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
                <div className="py-3 border-b border-[#2E1E0F]">
                  <div className="text-xs text-[#7A5A38] mb-1.5">Chair join code</div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(chairCode);
                      setCopiedChairCode(true);
                      setTimeout(() => setCopiedChairCode(false), 2000);
                    }}
                    className="w-full bg-[#150F09] border border-[#2E1E0F] hover:border-[#7B4A1E] hover:bg-[#1A1209] rounded-lg px-3 py-2 text-sm font-mono tracking-wider transition-colors cursor-pointer text-left"
                  >
                    {copiedChairCode
                      ? <span className="text-green-400 font-bold">✓ Copied</span>
                      : <span className="text-white">{chairCode}</span>
                    }
                  </button>
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
              <p className="text-xs text-[#7A5A38] mb-3 leading-snug">
                Scores: +5 attendance · +10 per WP sponsored · +20 per DR sponsored · +1 per 10s speaking · +10 per GSL speech · +8 per caucus speech
              </p>
              {committee.delegates.length === 0 && (
                <p className="text-xs text-[#7A5A38]">No delegates in this session yet.</p>
              )}
              {[...committee.delegates]
                .map((d) => ({ delegate: d, score: computeScore(d.country) }))
                .sort((a, b) => b.score.total - a.score.total)
                .map(({ delegate: d, score }, idx) => {
                  const flagCode = getCountryByName(d.country)?.code ?? null;
                  const isExpanded = expandedDelegate === d.id;
                  return (
                    <div key={d.id} className="border-b border-[#2E1E0F] last:border-0">
                      <button
                        className="w-full flex items-center gap-3 py-3 text-left hover:bg-[#1A1209] transition-colors rounded-lg px-1"
                        onClick={() => setExpandedDelegate(isExpanded ? null : d.id)}
                      >
                        <span className="text-xs text-[#7A5A38] w-5 text-right shrink-0">{idx + 1}</span>
                        {flagCode
                          ? <img src={getFlagUrl(flagCode)} alt={flagCode} className="w-5 h-5 object-contain shrink-0" />
                          : <span className="text-lg shrink-0">🌐</span>}
                        <span className="flex-1 text-sm font-semibold text-white truncate">{d.country}</span>
                        <span className={`text-xs font-mono px-2 py-0.5 rounded-full shrink-0 ${d.status === 'absent' ? 'text-[#7A5A38]' : 'text-[#C4A882]'}`}>
                          {score.total} pts
                        </span>
                        <span className="text-[#7A5A38] text-xs shrink-0">{isExpanded ? '▲' : '▼'}</span>
                      </button>

                      {isExpanded && (
                        <div className="mx-1 mb-3 p-3 bg-[#1A1209] border border-[#2E1E0F] rounded-xl space-y-3">
                          {/* Breakdown */}
                          <div>
                            <p className="text-[10px] font-mono text-[#7A5A38] tracking-widest mb-1.5">SCORE BREAKDOWN</p>
                            <div className="space-y-1">
                              <div className="flex justify-between text-xs">
                                <span className="text-[#C4A882]">Attendance</span>
                                <span className="text-white font-mono">+{score.attendancePoints}</span>
                              </div>
                              <div className="flex justify-between text-xs">
                                <span className="text-[#C4A882]">Working papers sponsored</span>
                                <span className="text-white font-mono">+{score.wpPoints}</span>
                              </div>
                              <div className="flex justify-between text-xs">
                                <span className="text-[#C4A882]">Draft resolutions sponsored</span>
                                <span className="text-white font-mono">+{score.drPoints}</span>
                              </div>
                              <div className="flex justify-between text-xs">
                                <span className="text-[#C4A882]">Speaking time</span>
                                <span className="text-white font-mono">+{score.speakingPoints}</span>
                              </div>
                              <div className="flex justify-between text-xs">
                                <span className="text-[#C4A882]">GSL speeches ({score.gslSpeeches}×)</span>
                                <span className="text-white font-mono">+{score.gslPoints}</span>
                              </div>
                              <div className="flex justify-between text-xs">
                                <span className="text-[#C4A882]">Caucus speeches ({score.caucusSpeeches}×)</span>
                                <span className="text-white font-mono">+{score.caucusPoints}</span>
                              </div>
                              <div className="flex justify-between text-xs border-t border-[#2E1E0F] pt-1 mt-1">
                                <span className="text-white font-semibold">Total</span>
                                <span className="text-white font-mono font-bold">+{score.total}</span>
                              </div>
                            </div>
                          </div>

                          {/* Speaking history */}
                          {score.logs.length > 0 && (
                            <div>
                              <p className="text-[10px] font-mono text-[#7A5A38] tracking-widest mb-1.5">SPEAKING HISTORY</p>
                              <div className="space-y-1">
                                {score.logs.map((entry, i) => (
                                  <div key={i} className="text-xs text-[#C4A882]">
                                    <span className="text-white">{entry.topic || '—'}</span>
                                    <span className="text-[#7A5A38]"> · {entry.context} · {entry.seconds}s</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Tips */}
                          <div>
                            <p className="text-[10px] font-mono text-[#7A5A38] tracking-widest mb-1.5">TIPS</p>
                            <div className="space-y-1">
                              {score.gslSpeeches === 0 && (
                                <p className="text-xs text-[#C4A882]">• Get on the General Speakers&apos; List</p>
                              )}
                              {score.caucusSpeeches === 0 && (
                                <p className="text-xs text-[#C4A882]">• Request a moderated caucus and speak</p>
                              )}
                              {score.wpPoints === 0 && score.drPoints === 0 && (
                                <p className="text-xs text-[#C4A882]">• Submit a working paper or draft resolution</p>
                              )}
                              {score.gslSpeeches > 0 && score.caucusSpeeches > 0 && (score.wpPoints > 0 || score.drPoints > 0) && (
                                <p className="text-xs text-[#7A5A38]">Great engagement — keep it up!</p>
                              )}
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

        <div className="px-5 py-3 border-t border-[#2E1E0F] shrink-0">
          <p className="text-[10px] text-[#7A5A38] text-center">Changes apply instantly · No save required</p>
        </div>
      </div>
    </div>
  );
}
