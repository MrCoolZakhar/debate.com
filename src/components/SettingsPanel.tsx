'use client';

import { useState, useEffect, useRef } from 'react';
import Portal from '@/components/Portal';
import { Globe } from 'lucide-react';
import { useSettingsStore, CommitteeSettings, MotionNames } from '@/lib/settingsStore';
import { Committee } from '@/lib/types';
import { updateCommitteeChairSuffixInDB } from '@/lib/committeeService';
import { getFlagEmoji, getCountryByName, getCountryDisplayName } from '@/lib/countries';
import { useT, useLanguage } from '@/contexts/LanguageContext';

type SettingsTab = 'voting' | 'motions' | 'access' | 'points';

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-black tracking-wider uppercase mb-1 mt-5 first:mt-0" style={{ color: '#1B3828', letterSpacing: '0.08em' }}>{children}</p>;
}

function CodeCopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="w-full flex items-center justify-center gap-2 rounded-xl py-3 font-mono text-xl tracking-widest font-black transition-all focus:outline-none"
      style={{ backgroundColor: '#1B3828', color: '#EED98A', letterSpacing: '0.12em' }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
    >
      {copied
        ? <><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg> Copied</>
        : <>{code} <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.6"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></>
      }
    </button>
  );
}

function ChairPasswordDisplay({ password }: { password: string }) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  return (
    <button
      onClick={() => { navigator.clipboard.writeText(password); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      onMouseEnter={() => setRevealed(true)}
      onMouseLeave={() => { setRevealed(false); }}
      className="w-full flex items-center justify-between rounded-xl px-4 py-2.5 font-mono text-sm font-bold tracking-widest transition-all focus:outline-none group"
      style={{ backgroundColor: '#EDE7D8', border: '1px solid #DDD4C0', color: '#1B3828' }}
    >
      <span style={{ letterSpacing: revealed ? '0.12em' : '0.05em', filter: revealed ? 'none' : 'blur(4px)', transition: 'filter 0.2s ease', userSelect: revealed ? 'text' : 'none' }}>
        {password}
      </span>
      {copied
        ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3D7A52" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" opacity={revealed ? 1 : 0.4}><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
      }
    </button>
  );
}

function RenameRow({ label, defaultName, value, onChange }: {
  label?: string; defaultName: string; value: string; onChange: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const isCustom = value !== defaultName;

  const startEdit = () => {
    setDraft(isCustom ? value : '');
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };
  const commit = () => {
    const trimmed = draft.trim();
    onChange(trimmed || defaultName);
    setEditing(false);
  };

  return (
    <div className="flex items-center justify-between gap-4 py-3 group" style={{ borderBottom: '1px solid #DDD4C0' }}>
      <div className="flex-1 min-w-0">
        {label && <div className="text-xs mb-0.5" style={{ color: '#9A8A78' }}>{label}</div>}
        {editing ? (
          <input
            ref={inputRef}
            type="text"
            value={draft}
            placeholder={defaultName}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setEditing(false); } }}
            className="w-full text-sm font-semibold focus:outline-none bg-transparent border-b"
            style={{ color: '#1C1410', borderColor: '#1B3828', borderBottomWidth: '1.5px', paddingBottom: '1px' }}
          />
        ) : (
          <button
            onClick={startEdit}
            className="text-sm font-semibold text-left w-full truncate flex items-center gap-1.5"
            style={{ color: '#1C1410' }}
          >
            <span>{isCustom ? value : defaultName}</span>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#9A8A78" strokeWidth="2.5" className="opacity-0 group-hover:opacity-100 shrink-0 transition-opacity"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
        )}
      </div>
      {isCustom && !editing && (
        <button
          onClick={() => onChange(defaultName)}
          className="text-[10px] font-mono shrink-0 px-1.5 py-0.5 rounded transition-colors"
          style={{ color: '#9A8A78', border: '1px solid #DDD4C0' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#8B2020'; (e.currentTarget as HTMLElement).style.borderColor = '#8B2020'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#9A8A78'; (e.currentTarget as HTMLElement).style.borderColor = '#DDD4C0'; }}
          title="Reset to default"
        >reset</button>
      )}
    </div>
  );
}

// ── Motion order drag-and-rename tab ──────────────────────────────────────────
type OrderableType = 'moderated' | 'unmoderated' | 'consultation' | 'tour';

const MOTION_META: Record<OrderableType, {
  enabledKey: keyof CommitteeSettings;
  namesKey: keyof MotionNames;
  defaultName: string;
  disruptiveness: number;
}> = {
  moderated:    { enabledKey: 'motionModeratedCaucus',   namesKey: 'moderated',    defaultName: 'Moderated Caucus',          disruptiveness: 3 },
  unmoderated:  { enabledKey: 'motionUnmoderatedCaucus', namesKey: 'unmoderated',  defaultName: 'Unmoderated Caucus',        disruptiveness: 2 },
  consultation: { enabledKey: 'motionCoW',               namesKey: 'consultation', defaultName: 'Consultation of the Whole', disruptiveness: 2 },
  tour:         { enabledKey: 'motionTourDeTable',       namesKey: 'tour',         defaultName: 'Tour de Table',             disruptiveness: 1 },
};

function MotionsTab({ s, upd }: {
  s: CommitteeSettings;
  upd: <K extends keyof CommitteeSettings>(key: K, value: CommitteeSettings[K]) => void;
}) {
  const order: OrderableType[] = (s.motionOrder ?? ['moderated', 'unmoderated', 'tour', 'consultation']) as OrderableType[];
  const dragItem = useRef<number | null>(null);
  const dragOver = useRef<number | null>(null);
  const [dragActive, setDragActive] = useState<number | null>(null);

  function handleDragStart(i: number) { dragItem.current = i; setDragActive(i); }
  function handleDragEnter(i: number) { dragOver.current = i; }
  function handleDragEnd() {
    setDragActive(null);
    if (dragItem.current === null || dragOver.current === null || dragItem.current === dragOver.current) return;
    const newOrder = [...order];
    const [moved] = newOrder.splice(dragItem.current, 1);
    newOrder.splice(dragOver.current, 0, moved);
    upd('motionOrder', newOrder);
    dragItem.current = null;
    dragOver.current = null;
  }

  return (
    <div>
      <SectionLabel>Motion Types</SectionLabel>
      <p className="text-xs mb-3 leading-snug" style={{ color: '#9A8A78' }}>
        Drag to reorder. Toggle to enable or disable. Click the name to rename.
      </p>
      <div className="space-y-1 mb-4">
        {order.map((motionType, i) => {
          const meta = MOTION_META[motionType];
          const enabled = s[meta.enabledKey] !== false;
          const currentName = s.motionNames[meta.namesKey] ?? meta.defaultName;
          const isDragging = dragActive === i;
          return (
            <div
              key={motionType}
              draggable
              onDragStart={() => handleDragStart(i)}
              onDragEnter={() => handleDragEnter(i)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => e.preventDefault()}
              className="flex items-center gap-2 px-2 rounded-xl transition-all select-none"
              style={{
                border: '1px solid #DDD4C0',
                backgroundColor: isDragging ? '#EDE7D8' : '#FAF8F3',
                opacity: isDragging ? 0.5 : 1,
                cursor: 'grab',
              }}
            >
              {/* Drag handle */}
              <div className="shrink-0 flex flex-col gap-[3px] px-1 py-2">
                {[0,1,2].map(r => (
                  <div key={r} className="flex gap-[3px]">
                    {[0,1].map(c => <div key={c} className="w-[3px] h-[3px] rounded-full" style={{ backgroundColor: '#C5B9A8' }} />)}
                  </div>
                ))}
              </div>
              {/* Name (click to rename inline) — flex-1 */}
              <div className="flex-1 min-w-0">
                <RenameRow
                  defaultName={meta.defaultName}
                  value={currentName}
                  onChange={(v) => upd('motionNames', { ...s.motionNames, [meta.namesKey]: v })}
                />
              </div>
              {/* Disruptiveness pip bar — live: top position = 4 pips, bottom = 1 */}
              <div className="shrink-0 flex gap-[2px] items-center" title={`Disruptiveness: ${4 - i}/4`}>
                {[1,2,3,4].map((level) => (
                  <div key={level} className="w-[4px] h-[10px] rounded-sm"
                    style={{ backgroundColor: level <= (4 - i) ? '#B6871F' : '#DDD4C0' }} />
                ))}
              </div>
              {/* Enable/disable toggle */}
              <button
                onClick={() => upd(meta.enabledKey as keyof CommitteeSettings, (!enabled) as CommitteeSettings[typeof meta.enabledKey])}
                className="relative shrink-0 w-8 h-[18px] rounded-full transition-colors focus:outline-none"
                style={{ backgroundColor: enabled ? '#1B3828' : '#DDD4C0' }}
              >
                <span className={`absolute top-[2px] left-[2px] w-[14px] h-[14px] rounded-full bg-white transition-transform shadow-sm ${enabled ? 'translate-x-[14px]' : 'translate-x-0'}`} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Suspend/End debate — always at bottom, always enabled, rename only */}
      <SectionLabel>Procedural Motions</SectionLabel>
      <p className="text-xs mb-2 leading-snug" style={{ color: '#9A8A78' }}>Always available. Click to rename.</p>
      <div className="space-y-1">
        {([
          { key: 'suspendDebate' as keyof MotionNames, defaultName: 'Suspend Debate' },
          { key: 'endDebate' as keyof MotionNames, defaultName: 'End Debate' },
        ]).map(({ key, defaultName }) => (
          <div key={key} className="flex items-center gap-2 px-2 rounded-xl"
            style={{ border: '1px solid #DDD4C0', backgroundColor: '#FAF8F3' }}>
            {/* Invisible grip placeholder for alignment */}
            <div className="shrink-0 flex flex-col gap-[3px] px-1 py-2 opacity-0 pointer-events-none">
              {[0,1,2].map(r => (
                <div key={r} className="flex gap-[3px]">
                  {[0,1].map(c => <div key={c} className="w-[3px] h-[3px] rounded-full bg-transparent" />)}
                </div>
              ))}
            </div>
            <div className="flex-1 min-w-0">
              <RenameRow
                defaultName={defaultName}
                value={s.motionNames[key] ?? defaultName}
                onChange={(v) => upd('motionNames', { ...s.motionNames, [key]: v })}
              />
            </div>
            {/* All 4 pips filled in red — max disruptiveness */}
            <div className="shrink-0 flex gap-[2px] items-center" title="High disruptiveness">
              {[1,2,3,4].map((level) => (
                <div key={level} className="w-[4px] h-[10px] rounded-sm" style={{ backgroundColor: '#8B2020' }} />
              ))}
            </div>
            {/* No toggle — always on, spacer for alignment */}
            <div className="w-8 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
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

export function SettingsPanel({ committee, onClose }: {
  committee: Committee;
  onClose: () => void;
}) {
  const t = useT();
  const { language, setLanguage } = useLanguage();
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [tab, setTab] = useState<SettingsTab>('access');
  const { getSettings, updateSetting } = useSettingsStore();
  const s = getSettings(committee.code);
  const upd = <K extends keyof CommitteeSettings>(key: K, value: CommitteeSettings[K]) =>
    updateSetting(committee.code, key, value);

  // Points tab — expanded delegate
  const [expandedDelegate, setExpandedDelegate] = useState<string | null>(null);

  // Auto-generate chairJoinSuffix on mount if none exists; always sync to DB
  useEffect(() => {
    if (s.chairJoinSuffix === '') {
      const newSuffix = Math.floor(1000 + Math.random() * 9000).toString();
      upd('chairJoinSuffix', newSuffix);
      updateCommitteeChairSuffixInDB(committee.id, newSuffix);
    } else {
      updateCommitteeChairSuffixInDB(committee.id, s.chairJoinSuffix);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.chairJoinSuffix]);

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
    { id: 'access', label: t('settings_tab_access') },
    { id: 'motions', label: t('settings_tab_motions') },
    { id: 'voting', label: t('settings_tab_voting') },
    { id: 'points', label: t('settings_tab_points') },
  ];

  return (
    <Portal><div
      className="fixed inset-0 z-[60] bg-black/40 flex justify-end"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md flex flex-col h-full shadow-2xl overflow-hidden" style={{ backgroundColor: '#FAF8F3', borderLeft: '1px solid #DDD4C0' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: '1px solid #DDD4C0', backgroundColor: '#1B3828' }}>
          <h2 className="text-xl font-black" style={{ color: '#EED98A' }}>{t('settings_session_settings')}</h2>
          <div className="flex items-center gap-2.5">
            {/* Compact language toggle in header */}
            <div className="relative">
              <button
                onClick={() => setShowLangMenu((v) => !v)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl transition-colors focus:outline-none"
                style={{ color: '#EED98A', backgroundColor: showLangMenu ? 'rgba(238,217,138,0.12)' : 'transparent' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(238,217,138,0.12)'; }}
                onMouseLeave={(e) => { if (!showLangMenu) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
              >
                <Globe size={14} strokeWidth={2} />
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '11px', fontWeight: 700 }}>{language.toUpperCase()}</span>
              </button>
              {showLangMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowLangMenu(false)} />
                  <div className="absolute right-0 top-full mt-2 z-50 rounded-xl overflow-hidden shadow-xl" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', minWidth: '140px' }}>
                    {([['en', t('settings_english')], ['es', t('settings_spanish')], ['fr', t('settings_french')]] as [string, string][]).map(([code, label], i) => (
                      <div key={code}>
                        {i > 0 && <div style={{ height: '1px', backgroundColor: '#DDD4C0' }} />}
                        <button
                          onClick={() => { setLanguage(code as 'en' | 'es' | 'fr'); setShowLangMenu(false); }}
                          className="w-full flex items-center gap-2.5 px-4 py-3 text-left transition-colors focus:outline-none"
                          style={{ color: language === code ? '#1B3828' : '#6A5A4A', fontWeight: language === code ? 800 : 600, fontSize: '13px', backgroundColor: language === code ? 'rgba(27,56,40,0.07)' : 'transparent' }}
                          onMouseEnter={(e) => { if (language !== code) (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.04)'; }}
                          onMouseLeave={(e) => { if (language !== code) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                        >
                          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '11px', color: '#9A8A78' }}>{code.toUpperCase()}</span>
                          <span>{label}</span>
                          {language === code && <span className="ml-auto" style={{ color: '#B6871F' }}>✓</span>}
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
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
          {tab === 'motions' && <MotionsTab s={s} upd={upd} />}

          {/* ── Access & Identity ── */}
          {tab === 'access' && (
            <div>
              <SectionLabel>{t('settings_section_codes')}</SectionLabel>
              <div className="py-3" style={{ borderBottom: '1px solid #DDD4C0' }}>
                <div className="text-xs mb-1.5" style={{ color: '#9A8A78' }}>{t('settings_session_code_label')}</div>
                <CodeCopyButton code={committee.code} />
              </div>
              <div className="py-3" style={{ borderBottom: '1px solid #DDD4C0' }}>
                <div className="text-xs mb-1.5" style={{ color: '#9A8A78' }}>{t('settings_chair_code_label')}</div>
                <ChairPasswordDisplay password={s.chairJoinSuffix || '????'} />
              </div>
              <Toggle
                label={t('settings_chair_approval_label')}
                note={t('settings_chair_approval_note')}
                value={s.requireChairApproval}
                onChange={(v) => upd('requireChairApproval', v)}
              />

              <SectionLabel>GSL</SectionLabel>
              <Toggle
                label={t('settings_gsl_require_next_label')}
                note={t('settings_gsl_require_next_note')}
                value={s.gslRequireNextSpeaker}
                onChange={(v) => upd('gslRequireNextSpeaker', v)}
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
                        <span className="flex-1 text-sm font-semibold truncate" style={{ color: '#1C1410' }}>{getCountryDisplayName(d.country, language)}</span>
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
    </div></Portal>
  );
}
