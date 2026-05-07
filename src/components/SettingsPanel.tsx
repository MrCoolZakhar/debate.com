'use client';

import { useState, useEffect } from 'react';
import { Poppins } from 'next/font/google';
import { useSettingsStore, CommitteeSettings, DEFAULT_MOTION_NAMES } from '@/lib/settingsStore';
import { Committee } from '@/lib/types';
import { updateCommitteeCode, deleteDocumentsByType } from '@/lib/committeeService';
import { getFlagUrl, getCountryByName } from '@/lib/countries';

const poppins = Poppins({ subsets: ['latin'], weight: ['600', '700', '800'] });

type SettingsTab = 'voting' | 'motions' | 'access' | 'points';

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${poppins.className} text-xs font-bold text-[#6A5A4A] tracking-widest uppercase mt-6 mb-1 first:mt-0`}>
      {children}
    </div>
  );
}

function Divider() {
  return <div className="border-t border-[#DDD4C0] my-1" />;
}

function Toggle({ value, onChange, label, note }: {
  value: boolean; onChange: (v: boolean) => void; label: string; note?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-[#DDD4C0] last:border-0">
      <div className="flex-1">
        <div className="text-sm font-semibold text-[#1C1410]">{label}</div>
        {note && <div className="text-xs text-[#9A8A78] mt-0.5 leading-snug">{note}</div>}
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`relative shrink-0 w-10 h-[22px] rounded-full transition-colors mt-0.5 ${value ? 'bg-[#1B3828]' : 'bg-[#DDD4C0]'}`}
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
    <div className="py-3 border-b border-[#DDD4C0] last:border-0">
      <div className="text-sm font-semibold text-[#1C1410] mb-1">{label}</div>
      {note && <div className="text-xs text-[#9A8A78] mb-2 leading-snug">{note}</div>}
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
              value === o.value
                ? 'bg-[#1B3828] border-[#2A5A3C] text-white'
                : 'bg-[#FAF8F3] border-[#DDD4C0] text-[#6A5A4A] hover:border-[#1B3828]'
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
      <div className="w-full max-w-md bg-[#F6F1E9] border-l border-[#DDD4C0] flex flex-col h-full shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#DDD4C0] shrink-0">
          <div className="flex flex-col">
            <img
              src="/GavellingLogo.png"
              alt=""
              className="w-24 h-auto object-contain mb-1"
              style={{ filter: 'grayscale(1) brightness(0.6)' }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
            <h2 className="text-base font-black text-[#1C1410]">SESSION SETTINGS</h2>
            <p className="text-xs text-[#9A8A78] mt-0.5">{committee.name} · {committee.code}</p>
          </div>
          <button onClick={onClose} className="text-[#9A8A78] hover:text-[#1C1410] transition-colors text-xl leading-none">✕</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#DDD4C0] shrink-0">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 py-2.5 text-xs font-bold transition-colors ${
                tab === t.id
                  ? 'text-[#1C1410] border-b-2 border-[#1B3828] -mb-px'
                  : 'text-[#9A8A78] hover:text-[#6A5A4A]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5">

          {/* ── Voting & Majorities ── */}
          {tab === 'voting' && (
            <div>
              <SectionHeading>VOTING THRESHOLDS</SectionHeading>
              <Divider />
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

              <SectionHeading>ABSTENTIONS</SectionHeading>
              <Divider />
              <Toggle
                label="Allow abstentions on Draft Resolutions"
                note="If turned off, all delegations will have to vote."
                value={s.allowAbstentions}
                onChange={(v) => upd('allowAbstentions', v)}
              />

              <SectionHeading>VETO POWER</SectionHeading>
              <Divider />
              {/* Vertical slider — 3 positions, active highlighted with moving indicator */}
              <div className="py-3 border-b border-[#DDD4C0]">
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
                      <div className="relative w-1 rounded-full bg-[#DDD4C0] shrink-0" style={{ minHeight: '120px' }}>
                        <div
                          className="absolute left-0 w-1 rounded-full bg-[#1B3828] transition-all duration-300"
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
                                ? 'bg-[#1B3828]/20 border border-[#1B3828]/50'
                                : 'bg-transparent border border-transparent hover:bg-[#EDE7D8]'
                            }`}
                          >
                            <div className={`text-sm font-semibold ${s.vetoMode === option.id ? 'text-[#1C1410]' : 'text-[#6A5A4A]'}`}>{option.label}</div>
                            <div className="text-xs text-[#9A8A78] mt-0.5 leading-snug">{option.desc}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {s.vetoMode === 'p5' && (
                <div className="mt-2 p-3 bg-[#EDE7D8] border border-[#DDD4C0] rounded-xl">
                  <p className="text-xs font-semibold text-[#6A5A4A] mb-1">P5 Delegations</p>
                  <p className="text-xs text-[#1C1410]">{s.p5Delegations.join(' · ')}</p>
                  <p className="text-xs text-[#9A8A78] mt-1">These are the permanent veto-holding delegations. A single veto vote Against defeats any substantive resolution.</p>
                </div>
              )}

              <SectionHeading>QUORUM</SectionHeading>
              <Divider />
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
              <SectionHeading>ENABLED MOTION TYPES</SectionHeading>
              <Divider />
              <Toggle label="Moderated caucus" value={s.motionModeratedCaucus} onChange={(v) => upd('motionModeratedCaucus', v)} />
              <Toggle label="Unmoderated caucus" value={s.motionUnmoderatedCaucus} onChange={(v) => upd('motionUnmoderatedCaucus', v)} />
              <Toggle label="Consultation of the Whole (CoW)" value={s.motionCoW} onChange={(v) => upd('motionCoW', v)} />
              <Toggle label="Tour de Table" value={s.motionTourDeTable} onChange={(v) => upd('motionTourDeTable', v)} />

              <SectionHeading>DOCUMENT SUBMISSION LIMITS</SectionHeading>
              <Divider />

              {/* WP limit */}
              <div className="py-3 border-b border-[#DDD4C0]">
                <div className="flex items-center justify-between gap-4 mb-2">
                  <div className="text-sm font-semibold text-[#1C1410]">Working Paper limit</div>
                  <button
                    onClick={() => upd('wpSubmissionLimit', s.wpSubmissionLimit === null ? 5 : null)}
                    className={`relative shrink-0 w-10 h-[22px] rounded-full transition-colors ${s.wpSubmissionLimit !== null ? 'bg-[#1B3828]' : 'bg-[#DDD4C0]'}`}
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
                      className="w-20 bg-[#FAF8F3] border border-[#DDD4C0] focus:border-[#1B3828] rounded-lg px-3 py-1.5 text-[#1C1410] text-sm text-center focus:outline-none transition-colors"
                    />
                    <span className="text-xs text-[#9A8A78]">max WPs</span>
                  </div>
                )}
                <button
                  onClick={() => setResetConfirm('working-paper')}
                  className="mt-2 text-xs text-[#9A8A78] hover:text-[#6A5A4A] transition-colors"
                >
                  Reset count for WPs →
                </button>
              </div>

              {/* DR limit */}
              <div className="py-3 border-b border-[#DDD4C0]">
                <div className="flex items-center justify-between gap-4 mb-2">
                  <div className="text-sm font-semibold text-[#1C1410]">Draft Resolution limit</div>
                  <button
                    onClick={() => upd('drSubmissionLimit', s.drSubmissionLimit === null ? 3 : null)}
                    className={`relative shrink-0 w-10 h-[22px] rounded-full transition-colors ${s.drSubmissionLimit !== null ? 'bg-[#1B3828]' : 'bg-[#DDD4C0]'}`}
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
                      className="w-20 bg-[#FAF8F3] border border-[#DDD4C0] focus:border-[#1B3828] rounded-lg px-3 py-1.5 text-[#1C1410] text-sm text-center focus:outline-none transition-colors"
                    />
                    <span className="text-xs text-[#9A8A78]">max DRs</span>
                  </div>
                )}
                <button
                  onClick={() => setResetConfirm('draft-resolution')}
                  className="mt-2 text-xs text-[#9A8A78] hover:text-[#6A5A4A] transition-colors"
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
                    <p className="text-sm font-semibold text-[#1C1410]">
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
                        className="flex-1 bg-[#DDD4C0] hover:bg-[#C8BAA8] text-[#6A5A4A] py-2 rounded-lg font-bold text-xs transition-colors"
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
              <SectionHeading>SESSION ID &amp; JOIN CODES</SectionHeading>
              <Divider />
              <div className="py-3 border-b border-[#DDD4C0]">
                <div className="text-sm font-semibold text-[#1C1410] mb-2">Custom session ID</div>
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
                    className="flex-1 bg-[#FAF8F3] border border-[#DDD4C0] rounded-lg px-3 py-2 text-[#1C1410] text-sm focus:outline-none focus:border-[#1B3828] font-mono"
                  />
                  <button
                    onClick={handleCodeSave}
                    disabled={codeSaving || !customCodeInput.trim() || customCodeInput.trim().toUpperCase() === committee.code}
                    className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors shrink-0 ${
                      codeSaved
                        ? 'bg-green-800 text-green-200'
                        : 'bg-[#1B3828] hover:bg-[#2A5A3C] disabled:bg-[#DDD4C0] disabled:text-[#9A8A78] text-white'
                    }`}
                  >
                    {codeSaving ? '…' : codeSaved ? '✓ Saved' : 'Apply'}
                  </button>
                </div>
                {codeError && <p className="text-red-400 text-xs mt-1.5">{codeError}</p>}
              </div>
              <Toggle
                label="Separate chair join code"
                value={s.separateChairCode}
                onChange={(v) => upd('separateChairCode', v)}
              />
              {s.separateChairCode && (
                <div className="py-3 border-b border-[#DDD4C0]">
                  <div className="text-xs text-[#9A8A78] mb-1.5">Chair join code</div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(chairCode);
                      setCopiedChairCode(true);
                      setTimeout(() => setCopiedChairCode(false), 2000);
                    }}
                    className="w-full bg-[#FAF8F3] border border-[#DDD4C0] hover:border-[#1B3828] hover:bg-[#EDE7D8] rounded-lg px-3 py-2 text-sm font-mono tracking-wider transition-colors cursor-pointer text-left"
                  >
                    {copiedChairCode
                      ? <span className="text-green-400 font-bold">✓ Copied</span>
                      : <span className="text-[#1C1410]">{chairCode}</span>
                    }
                  </button>
                </div>
              )}
              <Toggle
                label="Chair must approve delegate entry"
                value={s.requireChairApproval}
                onChange={(v) => upd('requireChairApproval', v)}
              />

              <SectionHeading>CHAIR RE-SIGN-IN</SectionHeading>
              <Divider />
              <Toggle
                label="Allow multiple co-chairs simultaneously"
                value={s.allowMultipleCoChairs}
                onChange={(v) => upd('allowMultipleCoChairs', v)}
              />
              <Toggle
                label="Chair session persistence"
                value={s.chairSessionPersistence}
                onChange={(v) => upd('chairSessionPersistence', v)}
              />
            </div>
          )}

          {/* ── Points ── */}
          {tab === 'points' && (
            <div>
              <SectionHeading>DELEGATE LEADERBOARD</SectionHeading>
              <Divider />
              <p className="text-xs text-[#9A8A78] mb-3 leading-snug">
                Scores: +5 attendance · +10 per WP sponsored · +20 per DR sponsored · +1 per 10s speaking · +10 per GSL speech · +8 per caucus speech
              </p>
              {committee.delegates.length === 0 && (
                <p className="text-xs text-[#9A8A78]">No delegates in this session yet.</p>
              )}
              {[...committee.delegates]
                .map((d) => ({ delegate: d, score: computeScore(d.country) }))
                .sort((a, b) => b.score.total - a.score.total)
                .map(({ delegate: d, score }, idx) => {
                  const flagCode = getCountryByName(d.country)?.code ?? null;
                  const isExpanded = expandedDelegate === d.id;
                  return (
                    <div key={d.id} className="border-b border-[#DDD4C0] last:border-0">
                      <button
                        className="w-full flex items-center gap-3 py-3 text-left hover:bg-[#EDE7D8] transition-colors rounded-lg px-1"
                        onClick={() => setExpandedDelegate(isExpanded ? null : d.id)}
                      >
                        <span className="text-xs text-[#9A8A78] w-5 text-right shrink-0">{idx + 1}</span>
                        {flagCode
                          ? <img src={getFlagUrl(flagCode)} alt={flagCode} className="w-5 h-5 object-contain shrink-0" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                          : <span className="text-lg shrink-0">🌐</span>}
                        <span className="flex-1 text-sm font-semibold text-[#1C1410] truncate">{d.country}</span>
                        <span className={`text-xs font-mono px-2 py-0.5 rounded-full shrink-0 ${d.status === 'absent' ? 'text-[#9A8A78]' : 'text-[#6A5A4A]'}`}>
                          {score.total} pts
                        </span>
                        <span className="text-[#9A8A78] text-xs shrink-0">{isExpanded ? '▲' : '▼'}</span>
                      </button>

                      {isExpanded && (
                        <div className="mx-1 mb-3 p-3 bg-[#EDE7D8] border border-[#DDD4C0] rounded-xl space-y-3">
                          {/* Breakdown */}
                          <div>
                            <p className="text-[10px] font-mono text-[#9A8A78] tracking-widest mb-1.5">SCORE BREAKDOWN</p>
                            <div className="space-y-1">
                              <div className="flex justify-between text-xs">
                                <span className="text-[#6A5A4A]">Attendance</span>
                                <span className="text-[#1C1410] font-mono">+{score.attendancePoints}</span>
                              </div>
                              <div className="flex justify-between text-xs">
                                <span className="text-[#6A5A4A]">Working papers sponsored</span>
                                <span className="text-[#1C1410] font-mono">+{score.wpPoints}</span>
                              </div>
                              <div className="flex justify-between text-xs">
                                <span className="text-[#6A5A4A]">Draft resolutions sponsored</span>
                                <span className="text-[#1C1410] font-mono">+{score.drPoints}</span>
                              </div>
                              <div className="flex justify-between text-xs">
                                <span className="text-[#6A5A4A]">Speaking time</span>
                                <span className="text-[#1C1410] font-mono">+{score.speakingPoints}</span>
                              </div>
                              <div className="flex justify-between text-xs">
                                <span className="text-[#6A5A4A]">GSL speeches ({score.gslSpeeches}×)</span>
                                <span className="text-[#1C1410] font-mono">+{score.gslPoints}</span>
                              </div>
                              <div className="flex justify-between text-xs">
                                <span className="text-[#6A5A4A]">Caucus speeches ({score.caucusSpeeches}×)</span>
                                <span className="text-[#1C1410] font-mono">+{score.caucusPoints}</span>
                              </div>
                              <div className="flex justify-between text-xs border-t border-[#DDD4C0] pt-1 mt-1">
                                <span className="text-[#1C1410] font-semibold">Total</span>
                                <span className="text-[#1C1410] font-mono font-bold">+{score.total}</span>
                              </div>
                            </div>
                          </div>

                          {/* Speaking history */}
                          {score.logs.length > 0 && (
                            <div>
                              <p className="text-[10px] font-mono text-[#9A8A78] tracking-widest mb-1.5">SPEAKING HISTORY</p>
                              <div className="space-y-1">
                                {score.logs.map((entry, i) => (
                                  <div key={i} className="text-xs text-[#6A5A4A]">
                                    <span className="text-[#1C1410]">{entry.topic || '—'}</span>
                                    <span className="text-[#9A8A78]"> · {entry.context} · {entry.seconds}s</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Tips */}
                          <div>
                            <p className="text-[10px] font-mono text-[#9A8A78] tracking-widest mb-1.5">TIPS</p>
                            <div className="space-y-1">
                              {score.gslSpeeches === 0 && (
                                <p className="text-xs text-[#6A5A4A]">• Get on the General Speakers&apos; List</p>
                              )}
                              {score.caucusSpeeches === 0 && (
                                <p className="text-xs text-[#6A5A4A]">• Request a moderated caucus and speak</p>
                              )}
                              {score.wpPoints === 0 && score.drPoints === 0 && (
                                <p className="text-xs text-[#6A5A4A]">• Submit a working paper or draft resolution</p>
                              )}
                              {score.gslSpeeches > 0 && score.caucusSpeeches > 0 && (score.wpPoints > 0 || score.drPoints > 0) && (
                                <p className="text-xs text-[#9A8A78]">Great engagement — keep it up!</p>
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

        <div className="px-5 py-3 border-t border-[#DDD4C0] shrink-0">
          <p className="text-[10px] text-[#9A8A78] text-center">Changes apply instantly · No save required</p>
        </div>
      </div>
    </div>
  );
}
