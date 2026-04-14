'use client';

import { useState, useEffect } from 'react';
import { useSettingsStore, CommitteeSettings } from '@/lib/settingsStore';
import { Committee } from '@/lib/types';
import { updateCommitteeCode } from '@/lib/committeeService';

type SettingsTab = 'voting' | 'motions' | 'access';

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

function SelectRow({ value, onChange, label, options, note }: {
  value: string; onChange: (v: string) => void; label: string;
  options: { value: string; label: string }[]; note?: string;
}) {
  return (
    <div className="py-3 border-b border-[#2E1E0F] last:border-0">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="text-sm font-semibold text-white">{label}</div>
          {note && <div className="text-xs text-[#7A5A38] mt-0.5 leading-snug">{note}</div>}
        </div>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="bg-[#150F09] border border-[#2E1E0F] rounded-lg px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-[#7B4A1E] shrink-0 cursor-pointer max-w-[180px]"
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

  // Keep input in sync if the prop changes (e.g. after a redirect)
  useEffect(() => {
    setCustomCodeInput(s.customSessionId || committee.code);
  }, [committee.code, s.customSessionId]);

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

  const tabs: { id: SettingsTab; label: string }[] = [
    { id: 'voting', label: 'Voting' },
    { id: 'motions', label: 'Motions' },
    { id: 'access', label: 'Access' },
  ];

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/40 flex justify-end"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md bg-[#120D07] border-l border-[#2E1E0F] flex flex-col h-full shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2E1E0F] shrink-0">
          <div>
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
              <div className="space-y-3 py-3 border-b border-[#2E1E0F]">
                {([
                  { id: 'none', label: 'No veto power', desc: 'Standard majority rules apply' },
                  { id: 'p5', label: 'P5 veto power', desc: 'China, France, Russia, UK, USA each hold an individual veto. A single No defeats any resolution.' },
                  { id: 'unanimous', label: 'Unanimous decision required', desc: 'All present-and-voting delegations must vote Yes for a resolution to pass.' },
                ] as const).map((option) => (
                  <label key={option.id} className="flex items-start gap-3 cursor-pointer" onClick={() => upd('vetoMode', option.id)}>
                    <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${s.vetoMode === option.id ? 'border-[#7B4A1E] bg-[#7B4A1E]' : 'border-[#3D2A15]'}`}>
                      {s.vetoMode === option.id && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white">{option.label}</div>
                      <div className="text-xs text-[#7A5A38] mt-0.5 leading-snug">{option.desc}</div>
                    </div>
                  </label>
                ))}
              </div>

              {s.vetoMode === 'p5' && (
                <div className="mt-2 p-3 bg-[#1A1209] border border-[#2E1E0F] rounded-xl">
                  <p className="text-xs font-semibold text-[#C4A882] mb-1">P5 Delegations</p>
                  <p className="text-xs text-white">{s.p5Delegations.join(' · ')}</p>
                  <p className="text-xs text-[#7A5A38] mt-1">These are the permanent veto-holding delegations. A single veto vote Against defeats any substantive resolution.</p>
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
              <p className="text-xs text-[#7A5A38] mb-3 leading-snug">Disabled motion types are hidden from the delegate motion-request interface immediately.</p>
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
                label="Separate delegate join code"
                note="Delegates use a different code from the chair. Disabling makes a single shared code for everyone."
                value={s.separateDelegateCode}
                onChange={(v) => upd('separateDelegateCode', v)}
              />
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
        </div>

        <div className="px-5 py-3 border-t border-[#2E1E0F] shrink-0">
          <p className="text-[10px] text-[#7A5A38] text-center">Changes apply instantly · No save required</p>
        </div>
      </div>
    </div>
  );
}
