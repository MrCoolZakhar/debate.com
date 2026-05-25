'use client';

import { useState, useRef, useEffect } from 'react';
import { useT, useLanguage } from '@/contexts/LanguageContext';
import { Committee, PendingMotion, PendingMotionType } from '@/lib/types';
import { getCountryByName, getFlagUrl, getCountryDisplayName, matchesCountryQuery, startsWithCountryQuery } from '@/lib/countries';
import { Emoji } from '@/components/Emoji';
import { useSettingsStore, DEFAULT_MOTION_NAMES, MotionNames } from '@/lib/settingsStore';
import {
  addPendingMotion as addPendingMotionInDB,
  removePendingMotion as removePendingMotionInDB,
  clearPendingMotions as clearPendingMotionsInDB,
  setPhase as setPhaseInDB,
  updateCaucus as updateCaucusInDB,
  addToCaucusList as addToCaucusListInDB,
  batchAddToCaucusList as batchAddToCaucusListInDB,
  clearCaucusList as clearCaucusListInDB,
  suspendDebate as suspendDebateInDB,
  endDebate as endDebateInDB,
} from '@/lib/committeeService';

type ModalView = 'list' | 'raise' | 'vote';
type TypeMeta = Record<PendingMotionType, { icon: string; label: string; sub: string }>;

const TYPE_STATIC: Record<PendingMotionType, { icon: string; sub: string }> = {
  'end-debate':     { icon: '🏁', sub: 'Formally close the session' },
  'suspend-debate': { icon: '⏸️', sub: 'Suspend the session temporarily' },
  consultation:     { icon: '🤝', sub: 'Informal session, all together' },
  tour:             { icon: '🔄', sub: 'Everyone speaks once, alphabetical order' },
  unmoderated:      { icon: '💬', sub: 'Free time for delegates to talk' },
  moderated:        { icon: '🎙️', sub: 'Structured speeches, blank slate to fill' },
};

function buildTypeMeta(motionNames: MotionNames): TypeMeta {
  return {
    'end-debate':     { ...TYPE_STATIC['end-debate'],     label: motionNames.endDebate },
    'suspend-debate': { ...TYPE_STATIC['suspend-debate'], label: motionNames.suspendDebate },
    consultation:     { ...TYPE_STATIC.consultation,      label: motionNames.consultation },
    tour:             { ...TYPE_STATIC.tour,              label: motionNames.tour },
    unmoderated:      { ...TYPE_STATIC.unmoderated,       label: motionNames.unmoderated },
    moderated:        { ...TYPE_STATIC.moderated,         label: motionNames.moderated },
  };
}

// Regular motion types (moderated first per design spec)
const TYPE_ORDER: PendingMotionType[] = ['moderated', 'unmoderated', 'tour', 'consultation'];

function requiredVotes(type: PendingMotionType, present: number): { needed: number; fraction: string } {
  if (type === 'consultation' || type === 'tour') return { needed: Math.ceil((present * 2) / 3), fraction: '2/3 majority' };
  return { needed: Math.floor(present / 2) + 1, fraction: 'Simple majority' };
}

function DisruptivenessBadge({ type }: { type: PendingMotionType }) {
  const t = useT();
  const labels: Record<PendingMotionType, string> = {
    'end-debate': t('motions_badge_ends'), 'suspend-debate': t('motions_badge_suspends'),
    consultation: t('motions_badge_most'), tour: t('motions_badge_very'),
    unmoderated: t('motions_badge_disruptive'), moderated: t('motions_badge_least'),
  };
  const colors: Record<PendingMotionType, string> = {
    'end-debate': 'bg-[#8B2020]/20 text-[#8B2020] border-[#8B2020]/40',
    'suspend-debate': 'bg-[#B8844A]/15 text-[#B8844A] border-orange-800/40',
    consultation: 'bg-[#8B2020]/20 text-[#8B2020] border-[#8B2020]/40',
    tour: 'bg-[#B8844A]/15 text-[#B8844A] border-orange-800/40',
    unmoderated: 'bg-[#B6871F]/10 text-[#B6871F] border-[#B6871F]/30',
    moderated: 'bg-[#1B3828]/30 text-[#EED98A] border-[#1B3828]/40',
  };
  return <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${colors[type]}`}>{labels[type]}</span>;
}

const COUNTRY_ACRONYMS: Record<string, string> = {
  'uk':   'United Kingdom',
  'us':   'United States',
  'usa':  'United States',
  'uae':  'United Arab Emirates',
  'drc':  'DR Congo',
  'roc':  'Taiwan',
  'rok':  'South Korea',
  'dprk': 'North Korea',
  'car':  'Central African Republic',
  'png':  'Papua New Guinea',
};

function ProposerInput({ candidates, value, onChange, blockedCountries }: {
  candidates: string[]; value: string; onChange: (v: string) => void; blockedCountries?: Set<string>;
}) {
  const t = useT();
  const { language } = useLanguage();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const resolved = COUNTRY_ACRONYMS[query.trim().toLowerCase()] ?? query.trim();
  const matches = resolved
    ? candidates.filter((c) => startsWithCountryQuery(c, resolved, language))
        .concat(candidates.filter((c) => !startsWithCountryQuery(c, resolved, language) && matchesCountryQuery(c, resolved, language)))
    : [];
  const top = matches[0] ?? null;
  const commit = (country: string) => {
    if (blockedCountries?.has(country)) return;
    onChange(country); setQuery(country); setOpen(false);
  };
  return (
    <div className="relative">
      {value && !open ? (
        <div className="flex items-center gap-3 bg-[#1B3828]/10 border-2 border-[#3D7A52]/40 rounded-xl px-4 py-3">
          {(() => { const f = getCountryByName(value); return f ? <img src={getFlagUrl(f.code)} alt={f.code} style={{ borderRadius: '6px', border: '1.5px solid rgba(28,20,16,0.10)', objectFit: 'cover' }} className="w-7 h-5 inline-block" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} /> : null; })()}
          <span className="text-sm text-[#1C1410] flex-1 font-semibold">{getCountryDisplayName(value, language)}</span>
          <button onClick={() => { setOpen(true); setQuery(''); onChange(''); inputRef.current?.focus(); }} className="text-xs font-bold transition-colors focus:outline-none" style={{ color: '#2A5A3C' }}>{t('motions_change')}</button>
        </div>
      ) : (
        <div className="flex items-center bg-[#FAF8F3] border border-[#DDD4C0] focus-within:border-[#1B3828] rounded-xl overflow-hidden transition-colors">
          <input ref={inputRef} autoFocus={open} type="text" value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); onChange(''); }}
            onKeyDown={(e) => { if (e.key === 'Enter' && top) { e.preventDefault(); commit(top); } if (e.key === 'Escape') { setQuery(''); setOpen(false); } }}
            placeholder={t('motions_proposer_placeholder')}
            className="flex-1 bg-transparent px-4 py-3 text-[#1C1410] placeholder-[#9A8A78] focus:outline-none text-sm" />
          {top && query && <span className="text-xs text-[#9A8A78] px-3 truncate max-w-[120px]">↵ {getCountryDisplayName(top, language)}</span>}
        </div>
      )}
      {open && query && matches.length > 0 && (
        <div className="absolute bottom-full left-0 right-0 mb-1 bg-[#FAF8F3] border border-[#DDD4C0] rounded-xl overflow-hidden z-30 shadow-xl max-h-48 overflow-y-auto">
          {matches.slice(0, 6).map((country, i) => {
            const found = getCountryByName(country);
            const isBlocked = blockedCountries?.has(country) ?? false;
            return (
              <button key={country}
                onMouseDown={(e) => { e.preventDefault(); if (!isBlocked) commit(country); }}
                disabled={isBlocked}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                  isBlocked ? 'opacity-50 cursor-not-allowed bg-[#FAF8F3]' :
                  i === 0 ? 'bg-[#1B3828]/20 text-[#1C1410]' : 'text-[#1C1410] hover:bg-[#DDD4C0]'
                }`}>
                {found ? <img src={getFlagUrl(found.code)} alt={found.code} className="w-5 h-5 object-contain inline-block" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} /> : <Emoji size="1.125rem">🌐</Emoji>}
                <span className="text-sm flex-1">{getCountryDisplayName(country, language)}</span>
                {isBlocked
                  ? <span className="text-xs text-[#B8844A] shrink-0 font-semibold">{t('motions_motion_on_floor')}</span>
                  : i === 0 && <span className="ml-auto text-xs text-[#9A8A78]">Enter ↵</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Raise Motion Form ─────────────────────────────────────────────────────────
function RaiseMotionForm({ committee, typeMeta, onBack, onRaised, editingMotion, belowQuorum = false }: {
  committee: Committee;
  typeMeta: TypeMeta;
  onBack: () => void;
  onRaised: (motion: Omit<PendingMotion, 'id' | 'disruptiveness'>) => void;
  editingMotion?: PendingMotion | null;
  belowQuorum?: boolean;
}) {
  const t = useT();
  const { language } = useLanguage();
  const { getSettings } = useSettingsStore();
  const s = getSettings(committee.code);
  const enabledTypes = TYPE_ORDER.filter((motionType) => {
    if (motionType === 'moderated')    return s.motionModeratedCaucus !== false;
    if (motionType === 'unmoderated')  return s.motionUnmoderatedCaucus !== false;
    if (motionType === 'consultation') return s.motionCoW !== false;
    if (motionType === 'tour')         return s.motionTourDeTable !== false;
    return true;
  });
  const [type, setType] = useState<PendingMotionType | null>(editingMotion?.type ?? enabledTypes[0] ?? null);
  const [proposer, setProposer] = useState(editingMotion?.proposedBy ?? '');
  const [totalMinsStr, setTotalMinsStr] = useState(editingMotion ? String(Math.floor(editingMotion.totalTime / 60)) : '10');
  const [totalSecsStr, setTotalSecsStr] = useState(editingMotion ? String(editingMotion.totalTime % 60) : '0');
  const [speakingTimeStr, setSpeakingTimeStr] = useState(editingMotion ? String(editingMotion.speakingTime) : '60');
  const [topic, setTopic] = useState(editingMotion?.topic ?? '');
  const [tourOrder, setTourOrder] = useState<'asc' | 'desc' | 'custom'>(editingMotion?.tourOrder ?? 'asc');
  const [error, setError] = useState('');

  const presentCountries = committee.delegates.filter((d) => d.status !== 'absent').map((d) => d.country);
  const countriesWithMotions = new Set(
    (committee.pendingMotions ?? [])
      .filter((m) => m.type !== ('join-request' as string) && (m.type as string) !== 'gsl-request')
      .map((m) => m.proposedBy)
  );

  const totalMins = parseInt(totalMinsStr, 10) || 0;
  const totalSecs = Math.min(59, parseInt(totalSecsStr, 10) || 0);
  const speakingTime = parseInt(speakingTimeStr, 10) || 0;
  const totalTime = totalMins * 60 + totalSecs;

  const speakerCount = (totalTime > 0 && speakingTime > 0) ? Math.floor(totalTime / speakingTime) : null;
  const unusedSecs = (totalTime > 0 && speakingTime > 0) ? totalTime % speakingTime : 0;

  const numClass = 'bg-transparent text-[#1C1410] text-xl font-bold text-center focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';
  const numClassSm = 'bg-transparent text-[#1C1410] text-lg font-bold text-center focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';

  const canSubmit = () => {
    if (!type || !proposer) return false;
    if (type === 'moderated' && !topic.trim()) return false;
    return true;
  };

  const submit = () => {
    if (!type || !canSubmit()) return;
    setError('');
    const isSuspendOrEnd = type === 'suspend-debate' || type === 'end-debate';
    if (!isSuspendOrEnd) {
      if ((type === 'moderated' || type === 'unmoderated') && totalTime === 0) {
        setError('Total caucus time cannot be zero.');
        return;
      }
      if (type === 'moderated' && speakingTime === 0) {
        setError('Speaking time per delegate cannot be zero.');
        return;
      }
    }
    const motion: Omit<PendingMotion, 'id' | 'disruptiveness'> = {
      type,
      proposedBy: proposer,
      totalTime: isSuspendOrEnd ? 0 : (type === 'tour' ? presentCountries.length * speakingTime : totalTime),
      speakingTime: isSuspendOrEnd ? 0 : speakingTime,
      topic: topic.trim(),
      speakerList: [],
      proposerPosition: null,
      ...(type === 'tour' ? { tourOrder } : {}),
    };
    onRaised(motion);
  };

  return (
    <div className="flex flex-col h-full">
      {/* PERMANENT NOTE: No scroll in raise motion form. If content doesn't fit, reduce spacing
          or lay fields side-by-side — never re-add overflow-y-auto here. */}
      <div className="flex-1 px-7 pt-0 pb-4 space-y-4">
        <h2 className="text-3xl font-black tracking-wide" style={{ color: '#1B3828' }}>{editingMotion ? t('motions_edit_heading') : t('motions_raise_heading')}</h2>

        {/* Type tabs — always shown */}
        <div className="flex gap-1.5 flex-wrap items-stretch">
          <div className="flex gap-1.5 flex-1 flex-wrap">
            {enabledTypes.map((motionType) => (
              <button key={motionType} type="button" onClick={() => setType(motionType)}
                className={`px-3 py-2 rounded-xl border font-bold text-base transition-all flex-1 min-w-[120px] ${
                  type === motionType ? 'bg-[#1B3828] border-[#2A5A3C] text-white' : 'bg-transparent border-[#DDD4C0] text-[#6A5A4A] hover:border-[#1B3828]'
                }`}>
                {typeMeta[motionType].label}
              </button>
            ))}
          </div>
          {/* Special debate control buttons — half size, red, stacked */}
          <div className="flex flex-col gap-1 self-stretch">
            <button type="button" onClick={() => setType('suspend-debate')}
              className={`px-2 flex-1 rounded-lg border text-xs font-bold transition-colors ${type === 'suspend-debate' ? 'bg-[#8B2020] border-red-700 text-white' : 'border-[#8B2020]/40 bg-[#8B2020]/20 text-[#8B2020] hover:bg-[#8B2020]/20'}`}>
              {t('motions_suspend')}
            </button>
            <button type="button" onClick={() => setType('end-debate')}
              className={`px-2 flex-1 rounded-lg border text-xs font-bold transition-colors ${type === 'end-debate' ? 'bg-[#8B2020] border-red-700 text-white' : 'border-[#8B2020]/40 bg-[#8B2020]/20 text-[#8B2020] hover:bg-[#8B2020]/20'}`}>
              {t('motions_end_debate')}
            </button>
          </div>
        </div>

        {type && (
          <>
            {/* For moderated caucus: Topic first, then Proposed By */}
            {type !== 'moderated' && (
              <div>
                <label className="block text-lg font-semibold mb-2" style={{ color: '#3D7A52' }}>{t('motions_proposed_by')}</label>
                <ProposerInput candidates={presentCountries} value={proposer} onChange={setProposer} blockedCountries={countriesWithMotions} />
              </div>
            )}

            {/* Tour de Table — speaking time per delegate + order */}
            {type === 'tour' && (
              <>
                <div className="bg-transparent border border-[#DDD4C0] rounded-2xl p-3 space-y-2">
                  <p className="text-[#1C1410] font-semibold text-xs">
                    {t('motions_all_speak', { n: presentCountries.length })}
                  </p>
                  <div>
                    <label className="block text-sm font-semibold text-[#6A5A4A] mb-1">{t('motions_speaking_time_label')}</label>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 bg-[#FAF8F3] border border-[#DDD4C0] rounded-xl px-3 py-1.5">
                        <input type="number" min={10} value={speakingTimeStr}
                          onChange={(e) => setSpeakingTimeStr(e.target.value)}
                          className={`w-14 ${numClass}`} />
                        <span className="text-[#6A5A4A] text-sm">{t('motions_sec')}</span>
                      </div>
                      <span className="text-xs text-[#9A8A78]">
                        {t('motions_total_approx', { n: speakingTime > 0 ? Math.ceil((presentCountries.length * speakingTime) / 60) : 0 })}
                      </span>
                    </div>
                    <div className="flex gap-2 mt-1.5">
                      {[30, 45, 60, 90, 120].map((t) => (
                        <button key={t} onClick={() => setSpeakingTimeStr(String(t))}
                          className={`text-xs px-2.5 py-1 rounded-lg transition-colors focus:outline-none ${speakingTime === t ? 'bg-[#1B3828] text-white font-bold' : 'bg-transparent border border-[#DDD4C0] text-[#6A5A4A] hover:text-[#1B3828]'}`}>
                          {t}s
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-[#6A5A4A] mb-1">{t('motions_speaking_order')}</label>
                    <div className="flex gap-3">
                      <button onClick={() => setTourOrder('asc')}
                        className={`flex-1 py-2 rounded-xl font-bold text-sm transition-colors focus:outline-none ${tourOrder === 'asc' ? 'bg-[#1B3828] text-white' : 'bg-transparent border border-[#DDD4C0] text-[#6A5A4A] hover:text-[#1B3828]'}`}>
                        {t('motions_az')}
                      </button>
                      <button onClick={() => setTourOrder('desc')}
                        className={`flex-1 py-2 rounded-xl font-bold text-sm transition-colors focus:outline-none ${tourOrder === 'desc' ? 'bg-[#1B3828] text-white' : 'bg-transparent border border-[#DDD4C0] text-[#6A5A4A] hover:text-[#1B3828]'}`}>
                        {t('motions_za')}
                      </button>
                      <button onClick={() => setTourOrder('custom')}
                        className={`flex-1 py-2 rounded-xl font-bold text-sm transition-colors focus:outline-none ${tourOrder === 'custom' ? 'bg-[#1B3828] text-white' : 'bg-transparent border border-[#DDD4C0] text-[#6A5A4A] hover:text-[#1B3828]'}`}>
                        {t('motions_room_order')}
                      </button>
                    </div>
                    <div style={{ height: '32px', display: 'flex', alignItems: 'center' }}>
                      {tourOrder === 'custom' && (
                        <p className="text-xs text-[#9A8A78] leading-relaxed">{t('motions_room_order_hint')}</p>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Unmoderated / Consultation — total time */}
            {(type === 'unmoderated' || type === 'consultation') && (
              <div>
                <label className="block text-lg font-semibold text-[#6A5A4A] mb-2">{t('motions_total_time_label')}</label>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 bg-[#FAF8F3] border border-[#DDD4C0] rounded-xl px-3 py-2.5">
                    <input type="number" min={0} value={totalMinsStr}
                      onChange={(e) => setTotalMinsStr(e.target.value)}
                      className={`w-12 ${numClass}`} />
                    <span className="text-[#6A5A4A] text-sm">{t('motions_min')}</span>
                  </div>
                  <div className="flex items-center gap-2 bg-[#FAF8F3] border border-[#DDD4C0] rounded-xl px-3 py-2.5">
                    <input type="number" min={0} max={59} value={totalSecsStr}
                      onChange={(e) => setTotalSecsStr(e.target.value)}
                      className={`w-12 ${numClass}`} />
                    <span className="text-[#6A5A4A] text-sm">{t('motions_sec')}</span>
                  </div>
                </div>
                <div className="flex gap-2 mt-2">
                  {[2, 5, 10, 15, 20].map((m) => (
                    <button key={m} onClick={() => { setTotalMinsStr(String(m)); setTotalSecsStr('0'); }}
                      className={`text-xs px-2.5 py-1.5 rounded-lg transition-colors ${totalMins === m && totalSecs === 0 ? 'bg-[#1B3828] text-white font-bold' : 'bg-[#EDE7D8] border border-[#DDD4C0] text-[#6A5A4A] hover:text-[#1B3828]'}`}>
                      {m}m
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Moderated caucus — Topic first, then Proposed By */}
            {type === 'moderated' && (
              <>
                <div>
                  <label className="block text-lg font-semibold text-[#6A5A4A] mb-2">{t('motions_topic_label')} <span className="text-[#8B2020]">*</span></label>
                  <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)}
                    placeholder={language === 'es' ? 'ej. Respuesta humanitaria en zonas de conflicto' : 'e.g. Humanitarian response in conflict zones'}
                    className="w-full bg-[#FAF8F3] border-2 border-[#DDD4C0] rounded-xl px-4 py-4 text-[#1C1410] placeholder-[#9A8A78] focus:outline-none focus:border-[#1B3828] transition-colors" />
                </div>
                <div>
                  <label className="block text-lg font-semibold mb-2" style={{ color: '#3D7A52' }}>{t('motions_proposed_by')}</label>
                  <ProposerInput candidates={presentCountries} value={proposer} onChange={setProposer} blockedCountries={countriesWithMotions} />
                </div>
                {/* Total time + speaking time — side by side to avoid scroll */}
                <div className="flex gap-4 items-start">
                  <div className="flex-1">
                    <label className="block text-sm font-semibold text-[#6A5A4A] mb-2">{t('motions_total_time_label')}</label>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 bg-[#FAF8F3] border border-[#DDD4C0] rounded-xl px-3 py-2">
                        <input type="number" min={0} value={totalMinsStr}
                          onChange={(e) => setTotalMinsStr(e.target.value)}
                          className={`w-10 ${numClassSm}`} />
                        <span className="text-[#6A5A4A] text-xs">{t('motions_min')}</span>
                      </div>
                      <div className="flex items-center gap-1.5 bg-[#FAF8F3] border border-[#DDD4C0] rounded-xl px-3 py-2">
                        <input type="number" min={0} max={59} value={totalSecsStr}
                          onChange={(e) => setTotalSecsStr(e.target.value)}
                          className={`w-10 ${numClassSm}`} />
                        <span className="text-[#6A5A4A] text-xs">{t('motions_sec')}</span>
                      </div>
                    </div>
                    <div className="flex gap-1.5 mt-2 flex-wrap">
                      {[2, 5, 10, 15, 20].map((m) => (
                        <button key={m} onClick={() => { setTotalMinsStr(String(m)); setTotalSecsStr('0'); }}
                          className={`text-xs px-2 py-1 rounded-lg transition-colors ${totalMins === m && totalSecs === 0 ? 'bg-[#1B3828] text-white font-bold' : 'bg-[#EDE7D8] border border-[#DDD4C0] text-[#6A5A4A] hover:text-[#1B3828]'}`}>
                          {m}m
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-semibold text-[#6A5A4A] mb-2">{t('motions_per_delegate')}</label>
                    <div className="flex items-center gap-1.5 bg-[#FAF8F3] border border-[#DDD4C0] rounded-xl px-3 py-2 w-fit">
                      <input type="number" min={0} value={speakingTimeStr}
                        onChange={(e) => setSpeakingTimeStr(e.target.value)}
                        className={`w-12 ${numClassSm}`} />
                      <span className="text-[#6A5A4A] text-xs">{t('motions_sec')}</span>
                    </div>
                    <div className="flex gap-1.5 mt-2 flex-wrap">
                      {[30, 45, 60, 90, 120].map((t) => (
                        <button key={t} onClick={() => setSpeakingTimeStr(String(t))}
                          className={`text-xs px-2 py-1 rounded-lg transition-colors ${speakingTime === t ? 'bg-[#1B3828] text-white font-bold' : 'bg-[#EDE7D8] border border-[#DDD4C0] text-[#6A5A4A] hover:text-[#1B3828]'}`}>
                          {t}s
                        </button>
                      ))}
                    </div>
                    {speakerCount !== null && (
                      <div className="mt-3 rounded-lg bg-white border border-[#DDD4C0] px-3 py-2 inline-flex items-baseline gap-1.5">
                        <span className="font-black text-xl leading-tight" style={{ color: '#1B3828' }}>{speakerCount}</span>
                        <span className="text-sm font-semibold" style={{ color: '#6A5A4A' }}>{speakerCount === 1 ? t('motions_delegate_speak').replace('{s}', t('motions_delegate_singular')) : t('motions_delegate_speak').replace('{s}', t('motions_delegate_plural'))}</span>
                        {unusedSecs > 0 && (
                          <span className="text-xs font-semibold ml-1" style={{ color: '#B8844A' }}>{t('motions_unused_secs').replace('{n}', String(unusedSecs))}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {type && (
        <div className="px-7 pb-7 pt-3 border-t border-white/10 shrink-0">
          {belowQuorum && (
            <div className="mb-4 p-3 bg-[#8B2020]/20 border border-[#8B2020]/40 rounded-xl text-xs text-[#8B2020]">
              ⚠️ {t('motions_quorum_warning')}
            </div>
          )}
          {error && <p className="text-[#8B2020] text-sm font-medium mb-3">{error}</p>}
          <button onClick={submit} disabled={!canSubmit() || belowQuorum}
            className="w-full bg-[#1B3828] hover:bg-[#2A5A3C] disabled:bg-[#DDD4C0] disabled:text-[#9A8A78] text-white py-5 rounded-2xl text-base font-black transition-colors focus:outline-none" style={{ letterSpacing: '0.05em' }}>
            {editingMotion ? t('motions_edit_btn') : t('motions_raise_btn')}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Voting View ───────────────────────────────────────────────────────────────
function VotingView({ committee, typeMeta, onAccepted, onAllDone, onRemove, onBack, onEdit, pendingIds }: {
  committee: Committee;
  typeMeta: TypeMeta;
  onAccepted: (motion: PendingMotion) => void;
  onAllDone: () => void;
  onRemove: (motionId: string) => void;
  onBack: () => void;
  onEdit: (motionId: string) => void;
  pendingIds: Set<string>;
}) {
  const t = useT();
  // Filter out join-request pseudo-motions — those are handled in the chair banner, not here
  const initialSorted = [...(committee.pendingMotions ?? [])]
    .filter((m) => m.type !== ('join-request' as string))
    .sort((a, b) => {
      if (b.disruptiveness !== a.disruptiveness) return b.disruptiveness - a.disruptiveness;
      const aIdx = (committee.pendingMotions ?? []).findIndex((m) => m.id === a.id);
      const bIdx = (committee.pendingMotions ?? []).findIndex((m) => m.id === b.id);
      return aIdx - bIdx;
    });

  const [order, setOrder] = useState<PendingMotion[]>(initialSorted);
  const dragIndexRef = useRef<number | null>(null);

  // Keep order in sync when motions are removed externally
  const motionIdKey = (committee.pendingMotions ?? []).map((m) => m.id).join(',');
  useEffect(() => {
    const current = (committee.pendingMotions ?? []).filter((m) => m.type !== ('join-request' as string));
    setOrder((prev) => {
      // Match by proposer+type so temp ID → real UUID swaps don't create duplicates
      const currentMap = new Map(current.map((m) => [`${m.proposedBy}|${m.type}`, m]));
      const merged = prev
        .map((p) => currentMap.get(`${p.proposedBy}|${p.type}`) ?? null)
        .filter((m): m is PendingMotion => m !== null);
      const mergedKeys = new Set(merged.map((m) => `${m.proposedBy}|${m.type}`));
      const newOnes = current
        .filter((m) => !mergedKeys.has(`${m.proposedBy}|${m.type}`))
        .sort((a, b) => b.disruptiveness - a.disruptiveness);
      return [...merged, ...newOnes].sort((a, b) => b.disruptiveness - a.disruptiveness);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [motionIdKey]);

  const present = committee.delegates.filter((d) => d.status !== 'absent').length;

  if (order.length === 0) {
    return (
      <div className="px-7 pb-7 text-center py-8">
        <p className="text-[#6A5A4A]">{t('motions_no_vote')}</p>
        <button onClick={onAllDone} className="mt-4 text-sm text-[#B6871F] hover:text-[#EED98A]">{t('motions_back')}</button>
      </div>
    );
  }

  const primary = order[0];
  const rest = order.slice(1, 4);

  const renderCard = (m: PendingMotion, large: boolean, idx: number) => {
    const meta = typeMeta[m.type];
    const { needed, fraction } = requiredVotes(m.type, present);
    const totalMins = Math.floor(m.totalTime / 60);
    const totalSecs = m.totalTime % 60;
    const speakMins = Math.floor(m.speakingTime / 60);
    const speakSecs = m.speakingTime % 60;
    const fmtTime = (mins: number, secs: number) =>
      mins > 0 ? (secs > 0 ? `${mins}m ${secs}s` : `${mins}m`) : `${secs}s`;
    const isPrimary = idx === 0;
    const f = getCountryByName(m.proposedBy);

    return (
      <div
        key={m.id}
        draggable
        onDragStart={() => { dragIndexRef.current = idx; }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={() => {
          const from = dragIndexRef.current;
          if (from === null || from === idx) return;
          const newOrder = [...order];
          const [moved] = newOrder.splice(from, 1);
          newOrder.splice(idx, 0, moved);
          setOrder(newOrder);
          dragIndexRef.current = null;
        }}
        onDragEnd={() => { dragIndexRef.current = null; }}
        className={`bg-transparent rounded-2xl flex flex-col cursor-grab ${
          large
            ? `p-6 space-y-3 flex-1 min-w-0 border-2 ${isPrimary ? 'border-[#1B3828]' : 'border-[#DDD4C0]'}`
            : 'p-4 space-y-2 border border-[#DDD4C0]'
        }`}
      >
        {/* Header: icon + type label + flag in top-right */}
        <div className="flex items-center gap-2">
          <span className={`font-black text-[#1C1410] flex-1 ${large ? 'text-3xl' : 'text-lg'}`}>{meta.label}</span>
          {f ? <img src={getFlagUrl(f.code)} alt={f.code} style={{ borderRadius: '8px', border: '1.5px solid rgba(28,20,16,0.10)', objectFit: 'cover' }} className={large ? 'w-14 h-10 inline-block' : 'w-8 h-6 inline-block'} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} /> : null}
        </div>

        {/* Topic inline */}
        {m.topic && (
          <p className={`${large ? 'text-2xl' : 'text-base'} font-semibold`} style={{ color: '#1C1410' }}>
            <span className="font-bold" style={{ color: '#1B3828' }}>{t('motions_topic_inline')} </span>{m.topic}
          </p>
        )}

        {/* Timings — emphasised */}
        {m.type !== 'tour' && m.totalTime > 0 && (
          <div className="flex flex-col gap-0.5">
            <p className={`${large ? 'text-sm' : 'text-xs'}`} style={{ color: '#1C1410' }}>
              <span className="font-semibold" style={{ color: '#1B3828' }}>{t('motions_total_time_display')} </span>
              <span className="font-black">{fmtTime(totalMins, totalSecs)}</span>
            </p>
            {m.type === 'moderated' && m.speakingTime > 0 && (
              <p className={`${large ? 'text-sm' : 'text-xs'}`} style={{ color: '#1C1410' }}>
                <span className="font-semibold" style={{ color: '#1B3828' }}>{t('motions_speaker_time_display')} </span>
                <span className="font-black">{fmtTime(speakMins, speakSecs)}</span>
              </p>
            )}
            {m.type === 'moderated' && m.speakingTime > 0 && m.totalTime > 0 && (
              <p className={`${large ? 'text-sm' : 'text-xs'}`} style={{ color: '#1C1410' }}>
                <span className="font-semibold" style={{ color: '#1B3828' }}>{t('motions_total_speakers_display')} </span>
                <span className="font-black">{Math.floor(m.totalTime / m.speakingTime)} {Math.floor(m.totalTime / m.speakingTime) === 1 ? t('motions_speaker_singular') : t('motions_speaker_plural')}{m.totalTime % m.speakingTime !== 0 ? ' ⚠' : ''}</span>
              </p>
            )}
          </div>
        )}
        {m.type === 'tour' && (
          <div className="flex items-center gap-2">
            <span className={`font-black ${large ? 'text-base text-[#1C1410]' : 'text-xs text-[#6A5A4A]'}`}>
              {fmtTime(0, m.speakingTime)} {t('motions_per_delegate')}
            </span>
            <span className={`${large ? 'text-sm' : 'text-xs'} text-[#9A8A78]`}>
              {m.tourOrder === 'desc' ? 'Z→A' : m.tourOrder === 'custom' ? 'Custom' : 'A→Z'}
            </span>
          </div>
        )}

        {/* Required votes */}
        <div className="flex items-center gap-2 bg-[#FAF8F3] border border-[#DDD4C0] rounded-xl px-3 py-1.5">
          <span className="text-xs font-semibold" style={{ color: '#1B3828' }}>{fraction === 'Simple majority' ? t('motions_simple_majority') : t('motions_supermajority')}</span>
          <span className="text-xs font-bold ml-auto" style={{ color: '#1C1410' }}>{t('motions_needs_votes', { needed, present })}</span>
        </div>

        {/* Accept/Reject/Edit — ONLY on the primary (idx===0) card being voted upon */}
        {isPrimary && (
          <div className="flex gap-2 mt-auto">
            <button onClick={() => onAccepted(m)}
              className="flex-1 bg-[#2A5A3C] hover:bg-[#3D7A52] text-white py-2.5 rounded-xl font-bold text-sm transition-colors focus:outline-none" style={{ fontFamily: "'Outfit', sans-serif", letterSpacing: '0.05em' }}>
              {t('motions_accept_btn')}
            </button>
            <button onClick={() => onRemove(m.id)}
              disabled={pendingIds.has(m.id)}
              className={`flex-1 bg-[#DDD4C0] hover:bg-red-950/40 hover:text-[#8B2020] text-[#6A5A4A] border border-[#DDD4C0] hover:border-[#8B2020]/40 py-2.5 rounded-xl font-bold text-sm transition-colors focus:outline-none ${pendingIds.has(m.id) ? 'opacity-40 cursor-not-allowed' : ''}`} style={{ fontFamily: "'Outfit', sans-serif", letterSpacing: '0.05em' }}>
              {t('motions_reject_btn')}
            </button>
            <button onClick={(e) => { e.stopPropagation(); onEdit(m.id); }}
              title="Edit motion"
              className="bg-[#B6871F]/20 hover:bg-[#B6871F]/40 border border-[#B6871F]/50 hover:border-[#B6871F] text-[#B6871F] py-2.5 px-4 rounded-xl font-bold text-sm transition-colors shrink-0 focus:outline-none" style={{ fontFamily: "'DM Mono', monospace" }}>
              {t('motions_edit_label')}
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="px-7 pb-7 space-y-3 flex flex-col h-full overflow-hidden">
      <div className="flex items-center shrink-0">
        <h2 className="text-3xl font-black" style={{ color: '#1B3828' }}>{t('motions_vote_heading')}</h2>
      </div>
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs shrink-0 font-semibold" style={{ backgroundColor: '#1B3828', color: '#EED98A' }}>
        <span>{t('motions_drag_hint')}</span>
      </div>
      <div className="flex gap-4 flex-1 min-h-0">
        {/* Left column — primary motion being voted on */}
        <div className="flex-1 flex flex-col min-w-0">
          {renderCard(primary, true, 0)}
        </div>
        {/* Right column — queued motions + Raise a Motion button */}
        <div className="w-72 flex flex-col gap-3 overflow-y-auto">
          {rest.map((m, i) => renderCard(m, false, i + 1))}
          <button
            onClick={onBack}
            className="w-full bg-[#2A5A3C] hover:bg-[#3D7A52] text-white py-3 rounded-2xl font-black text-sm transition-colors shrink-0 focus:outline-none"
            style={{ letterSpacing: '0.05em' }}
          >
            {t('motions_raise_motion_btn')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Modal ────────────────────────────────────────────────────────────────
export default function MotionsModal({ committee, onClose, onCommitteeUpdate, belowQuorum = false }: {
  committee: Committee;
  onClose: () => void;
  onCommitteeUpdate?: (updater: (c: Committee) => Committee) => void;
  belowQuorum?: boolean;
}) {
  const t = useT();
  const { language } = useLanguage();
  const DEFAULT_MOTION_NAMES_LOCALIZED = language === 'es' ? {
    moderated: 'Cáucus Moderado',
    unmoderated: 'Cáucus No Moderado',
    consultation: 'Consulta de Gabinete',
    tour: 'Round Robin',
    suspendDebate: 'Suspender Debate',
    endDebate: 'Cerrar Debate',
  } : DEFAULT_MOTION_NAMES;
  const motionNames = { ...DEFAULT_MOTION_NAMES_LOCALIZED };
  const typeMeta = buildTypeMeta(motionNames);
  const pending = [...(committee.pendingMotions ?? [])].filter((m) => m.type !== ('join-request' as string)).sort((a, b) => b.disruptiveness - a.disruptiveness);
  const [view, setView] = useState<ModalView>(pending.length === 0 ? 'raise' : 'vote');
  const [specialVoteMotion, setSpecialVoteMotion] = useState<PendingMotion | null>(null);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [editingMotionId, setEditingMotionId] = useState<string | null>(null);
  const update = (updater: (c: Committee) => Committee) => onCommitteeUpdate?.(updater);

  const handleRaised = (motion: Omit<PendingMotion, 'id' | 'disruptiveness'>) => {
    if (committee.pendingMotions?.some(
      (m) => m.proposedBy === motion.proposedBy &&
        m.type !== ('join-request' as string) &&
        (m.type as string) !== 'gsl-request'
    )) return;

    const tempId = `temp-${Date.now()}`;
    const base = {
      'end-debate': 6_000_000, 'suspend-debate': 5_000_000,
      consultation: 4_000_000, tour: 3_000_000, unmoderated: 2_000_000, moderated: 1_000_000,
    };
    const disruptiveness = base[motion.type] + motion.totalTime;

    setPendingIds((prev) => new Set([...prev, tempId]));
    update((c) => ({ ...c, pendingMotions: [...(c.pendingMotions ?? []), { ...motion, id: tempId, disruptiveness }] }));

    addPendingMotionInDB(committee.id, motion).then((realId) => {
      if (!realId) return;
      update((c) => ({
        ...c,
        pendingMotions: (c.pendingMotions ?? []).map((m) =>
          m.id === tempId ? { ...m, id: realId } : m
        ),
      }));
      setPendingIds((prev) => { const next = new Set(prev); next.delete(tempId); return next; });
    });

    setView('vote');
  };

  const handleRemove = (motionId: string) => {
    update((c) => ({ ...c, pendingMotions: (c.pendingMotions ?? []).filter((m) => m.id !== motionId) }));
    // Only call DB if this is a real UUID (not a temp optimistic ID)
    if (!motionId.startsWith('temp-')) {
      removePendingMotionInDB(motionId);
    }
  };

  const handleEdited = (motion: Omit<PendingMotion, 'id' | 'disruptiveness'>) => {
    if (!editingMotionId) return;
    const oldId = editingMotionId;

    // Remove old motion from local state immediately (same as handleRemove but inline
    // so committee.pendingMotions is clean before the re-add, avoiding the duplicate check)
    update((c) => ({ ...c, pendingMotions: (c.pendingMotions ?? []).filter((m) => m.id !== oldId) }));
    if (!oldId.startsWith('temp-')) removePendingMotionInDB(oldId);

    // Add replacement — same logic as handleRaised but NO duplicate check
    const tempId = `temp-${Date.now()}`;
    const base: Record<string, number> = {
      'end-debate': 6_000_000, 'suspend-debate': 5_000_000,
      consultation: 4_000_000, tour: 3_000_000, unmoderated: 2_000_000, moderated: 1_000_000,
    };
    const disruptiveness = (base[motion.type] ?? 0) + motion.totalTime;

    setPendingIds((prev) => new Set([...prev, tempId]));
    update((c) => ({ ...c, pendingMotions: [...(c.pendingMotions ?? []), { ...motion, id: tempId, disruptiveness }] }));

    addPendingMotionInDB(committee.id, motion).then((realId) => {
      if (!realId) return;
      update((c) => ({
        ...c,
        pendingMotions: (c.pendingMotions ?? []).map((m) => m.id === tempId ? { ...m, id: realId } : m),
      }));
      setPendingIds((prev) => { const next = new Set(prev); next.delete(tempId); return next; });
    });

    setEditingMotionId(null);
    setView('vote');
  };

  const handleMotionAccepted = async (motion: PendingMotion) => {
    // Clear ALL other pending motions — only the accepted one proceeds
    // GSL (speakersList) is NEVER modified here

    if (motion.type === 'suspend-debate' || motion.type === 'end-debate') {
      setSpecialVoteMotion(motion);
      return;
    }

    if (motion.type === 'unmoderated') {
      const caucus = {
        active: true, type: 'unmoderated' as const, motionLabel: typeMeta['unmoderated'].label,
        purpose: motion.topic || '', proposedBy: motion.proposedBy,
        totalTime: motion.totalTime, remainingTime: motion.totalTime,
        speakingTime: 0, speakerTimeRemaining: 0, currentSpeaker: null,
        proposerPosition: null, spokenCountries: [],
      };
      update((c) => ({ ...c, phase: 'unmoderated-caucus', caucus, pendingMotions: [], caucusQueue: [], currentSpeaker: null }));
      onClose();
      clearPendingMotionsInDB(committee.id);
      clearCaucusListInDB(committee.id);
      updateCaucusInDB(committee.id, caucus);
      setPhaseInDB(committee.id, 'unmoderated-caucus');
      return;
    }
    if (motion.type === 'consultation') {
      const caucus = {
        active: true, type: 'unmoderated' as const, motionLabel: typeMeta['consultation'].label,
        purpose: motion.topic || '', proposedBy: motion.proposedBy,
        totalTime: motion.totalTime, remainingTime: motion.totalTime,
        speakingTime: 0, speakerTimeRemaining: 0, currentSpeaker: null,
        proposerPosition: null, spokenCountries: [],
      };
      // GSL preserved, caucusQueue cleared, phase → unmoderated-caucus
      update((c) => ({ ...c, phase: 'unmoderated-caucus', caucus, pendingMotions: [], caucusQueue: [], currentSpeaker: null }));
      onClose();
      clearPendingMotionsInDB(committee.id);
      clearCaucusListInDB(committee.id);
      updateCaucusInDB(committee.id, caucus);
      setPhaseInDB(committee.id, 'unmoderated-caucus');
      return;

    } else if (motion.type === 'moderated') {
      const caucus = {
        active: true, type: 'moderated' as const, motionLabel: typeMeta['moderated'].label,
        purpose: motion.topic || '', proposedBy: motion.proposedBy,
        totalTime: motion.totalTime, remainingTime: motion.totalTime,
        speakingTime: motion.speakingTime, speakerTimeRemaining: motion.speakingTime,
        currentSpeaker: null, proposerPosition: null, spokenCountries: [],
      };
      update((c) => ({ ...c, phase: 'moderated-caucus', caucus, pendingMotions: [], caucusQueue: [], currentSpeaker: null }));
      onClose();
      clearPendingMotionsInDB(committee.id);
      clearCaucusListInDB(committee.id);
      updateCaucusInDB(committee.id, caucus);
      setPhaseInDB(committee.id, 'moderated-caucus');
      return;

    } else if (motion.type === 'tour') {
      // Tour de Table — all present delegates ordered by tourOrder
      // GSL is NEVER touched — tour uses caucusQueue exclusively
      const alphabetical = committee.delegates
        .filter((d) => d.status !== 'absent')
        .sort((a, b) => a.country.localeCompare(b.country));

      if (motion.tourOrder === 'custom') {
        // Room Order — empty queue, chair calls speakers manually
        const n = alphabetical.length;
        const totalTourTime = n * motion.speakingTime;
        const caucus = {
          active: true, type: 'moderated' as const, motionLabel: typeMeta['tour'].label,
          purpose: 'Tour de Table (Room Order)',
          proposedBy: motion.proposedBy, totalTime: totalTourTime, remainingTime: totalTourTime,
          speakingTime: motion.speakingTime, speakerTimeRemaining: motion.speakingTime,
          currentSpeaker: null, proposerPosition: null, spokenCountries: [],
        };
        // Numbered placeholder queue — "Speaker 1", "Speaker 2", etc.
        const caucusQueue = alphabetical.map((_, i) => ({
          delegateId: `room-order-${i + 1}`,
          country: `Speaker ${i + 1}`,
        }));
        update((c) => ({ ...c, phase: 'moderated-caucus', caucus, pendingMotions: [], caucusQueue, currentSpeaker: null }));
        onClose();
        clearPendingMotionsInDB(committee.id);
        updateCaucusInDB(committee.id, caucus);
        setPhaseInDB(committee.id, 'moderated-caucus');
        clearCaucusListInDB(committee.id).then(() =>
          batchAddToCaucusListInDB(committee.id, caucusQueue)
        );
        return;
      }

      const sorted = committee.delegates
        .filter((d) => d.status !== 'absent')
        .sort((a, b) => motion.tourOrder === 'asc'
          ? a.country.localeCompare(b.country)
          : b.country.localeCompare(a.country));
      const proposerIdx = sorted.findIndex((d) => d.country === motion.proposedBy);
      const presentDelegates = proposerIdx >= 0
        ? [...sorted.slice(proposerIdx), ...sorted.slice(0, proposerIdx)]
        : sorted;

      const totalTourTime = presentDelegates.length * motion.speakingTime;
      const caucus = {
        active: true, type: 'moderated' as const, motionLabel: typeMeta['tour'].label,
        purpose: `Tour de Table (${motion.tourOrder === 'desc' ? 'Z→A' : 'A→Z'})`,
        proposedBy: motion.proposedBy, totalTime: totalTourTime, remainingTime: totalTourTime,
        speakingTime: motion.speakingTime, speakerTimeRemaining: motion.speakingTime,
        currentSpeaker: null, proposerPosition: null, spokenCountries: [],
      };
      const caucusQueue = presentDelegates.map((d) => ({ delegateId: d.id, country: d.country }));

      // GSL preserved, caucusQueue filled with ordered delegates
      update((c) => ({ ...c, phase: 'moderated-caucus', caucus, pendingMotions: [], caucusQueue, currentSpeaker: null }));
      onClose();
      clearPendingMotionsInDB(committee.id);
      updateCaucusInDB(committee.id, caucus);
      setPhaseInDB(committee.id, 'moderated-caucus');
      // Await clear before insert to prevent race condition (DELETE winning after INSERT)
      clearCaucusListInDB(committee.id).then(() =>
        batchAddToCaucusListInDB(
          committee.id,
          presentDelegates.map((d) => ({ delegateId: d.id, country: d.country }))
        )
      );
      return;
    }
  };

  // ── Special vote: "Does this motion pass?" ──────────────────────────────────
  if (specialVoteMotion) {
    const isSuspend = specialVoteMotion.type === 'suspend-debate';
    return (
      <div className="fixed inset-0 z-[60] bg-[#F6F1E9] flex flex-col items-center justify-center text-center px-8">
        <p className="text-xs font-mono tracking-widest text-[#9A8A78] mb-6">
          {typeMeta[specialVoteMotion.type].label.toUpperCase()} · {getCountryDisplayName(specialVoteMotion.proposedBy, language)}
        </p>
        <h1 className="text-4xl font-black mb-14 tracking-wide" style={{ color: '#1B3828', fontFamily: "'Outfit', sans-serif" }}>{t('motions_does_pass')}</h1>
        <div className="flex gap-8">
          <button
            onClick={async () => {
              const motionId = specialVoteMotion!.id;
              if (!motionId.startsWith('temp-')) {
                await removePendingMotionInDB(motionId);
              }
              update((c) => ({ ...c, pendingMotions: (c.pendingMotions ?? []).filter((m) => m.id !== motionId) }));
              if (isSuspend) {
                onCommitteeUpdate?.((c) => ({ ...c, suspendedAt: new Date().toISOString(), phase: 'adjourned' as const }));
                suspendDebateInDB(committee.id);
              } else {
                const now = new Date();
                const expires = new Date(now.getTime() + 1 * 60 * 60 * 1000);
                onCommitteeUpdate?.((c) => ({ ...c, endedAt: now.toISOString(), expiresAt: expires.toISOString(), phase: 'adjourned' as const }));
                endDebateInDB(committee.id);
              }
              setSpecialVoteMotion(null);
              onClose();
            }}
            className="px-16 py-8 rounded-3xl text-white text-2xl font-black transition-colors focus:outline-none" style={{ backgroundColor: '#1B3828', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.05em' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}>
            {t('motions_yes')}
          </button>
          <button
            onClick={() => {
              const motionId = specialVoteMotion.id;
              removePendingMotionInDB(motionId);
              update((c) => ({ ...c, pendingMotions: (c.pendingMotions ?? []).filter((m) => m.id !== motionId) }));
              setSpecialVoteMotion(null);
              onClose();
            }}
            className="px-16 py-8 rounded-3xl text-white text-2xl font-black transition-colors focus:outline-none" style={{ backgroundColor: '#8B2020', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.05em' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#7A1C1C'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#8B2020'; }}>
            {t('motions_no')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(5, 8, 20, 0.88)', backdropFilter: 'blur(4px)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[#FAF8F3] border border-[#DDD4C0] rounded-3xl w-full shadow-2xl overflow-hidden flex flex-col max-w-5xl" style={{ height: '88vh' }}>
        <div className="flex items-center justify-end px-7 pt-6 pb-0 shrink-0">
          <button onClick={onClose} className="text-[#9A8A78] hover:text-[#1C1410] transition-colors text-xl leading-none">✕</button>
        </div>
        <div className="flex-1 min-h-0 pt-2 flex flex-col">
          {view === 'raise' && (
            <RaiseMotionForm
              committee={committee}
              typeMeta={typeMeta}
              onBack={() => { setEditingMotionId(null); setView(pending.length > 0 ? 'vote' : 'list'); }}
              onRaised={editingMotionId ? handleEdited : handleRaised}
              editingMotion={editingMotionId ? ((committee.pendingMotions ?? []).find((m) => m.id === editingMotionId) ?? null) : null}
              belowQuorum={belowQuorum}
            />
          )}
          {view === 'vote' && (
            <VotingView
              committee={committee}
              typeMeta={typeMeta}
              onAccepted={handleMotionAccepted}
              onAllDone={() => { setView('list'); onClose(); }}
              onRemove={handleRemove}
              onBack={() => setView('raise')}
              onEdit={(motionId) => { setEditingMotionId(motionId); setView('raise'); }}
              pendingIds={pendingIds}
            />
          )}
          {view === 'list' && (
            <div className="px-7 pb-7 space-y-4">
              <h2 className="text-3xl font-black text-[#1C1410]">{t('motions_title')}</h2>
              {pending.length === 0 ? (
                <div className="text-center py-8">
                  <div className="mb-3"><Emoji size="2.5rem">📋</Emoji></div>
                  <p className="text-[#6A5A4A]">{t('motions_no_raised')}</p>
                  <p className="text-sm text-[#9A8A78] mt-1">{t('motions_floor_open')}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-[#9A8A78] font-mono">{t('motions_ranked')}</p>
                  {pending.map((m, i) => {
                    const meta = typeMeta[m.type];
                    const mins = Math.floor(m.totalTime / 60);
                    const secs = m.totalTime % 60;
                    const proposerFlag = getCountryByName(m.proposedBy);
                    return (
                      <div key={m.id} className="bg-[#EDE7D8] border border-[#DDD4C0] rounded-xl px-4 py-4">
                        <div className="flex items-start gap-3">
                          <span className="text-xs text-[#9A8A78] font-mono w-4 mt-1">{i + 1}</span>
                          <Emoji size="1.5rem">{meta.icon}</Emoji>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-base font-black text-[#1C1410]">{meta.label}</span>
                              <DisruptivenessBadge type={m.type} />
                            </div>
                            <div className="flex items-center gap-1.5 mt-1">
                              {proposerFlag ? <img src={getFlagUrl(proposerFlag.code)} alt={proposerFlag.code} className="w-5 h-5 object-contain inline-block" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} /> : <Emoji size="1rem">🌐</Emoji>}
                              <span className="text-sm font-semibold text-[#1C1410]">{m.proposedBy}</span>
                            </div>
                            {m.topic && <p className="text-sm text-[#6A5A4A] mt-1 font-medium">"{m.topic}"</p>}
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                              {m.type !== 'tour' && m.totalTime > 0 && (
                                <span className="text-xs font-bold text-[#1B3828] bg-[#FAF8F3] border border-[#DDD4C0] px-2 py-0.5 rounded-md">
                                  {mins > 0 ? `${mins}m` : ''}{secs > 0 ? ` ${secs}s` : ''} {t('motions_total_label')}
                                </span>
                              )}
                              {m.type === 'moderated' && m.speakingTime > 0 && (
                                <span className="text-xs font-bold text-[#2A5A3C] bg-[#FAF8F3] border border-[#DDD4C0] px-2 py-0.5 rounded-md">
                                  {m.speakingTime}{t('motions_s_per_speaker')}
                                </span>
                              )}
                              {m.type === 'tour' && (
                                <>
                                  <span className="text-xs font-bold text-[#1B3828] bg-[#FAF8F3] border border-[#DDD4C0] px-2 py-0.5 rounded-md">
                                    {m.speakingTime}{t('motions_s_per_delegate')}
                                  </span>
                                  <span className="text-xs font-bold text-[#6A5A4A] bg-[#FAF8F3] border border-[#DDD4C0] px-2 py-0.5 rounded-md">
                                    {m.tourOrder === 'desc' ? 'Z→A' : 'A→Z'}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                          <button onClick={() => handleRemove(m.id)} className="text-[#9A8A78] hover:text-[#8B2020] text-sm transition-colors mt-0.5">✕</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setView('raise')}
                  className="flex-1 bg-[#EDE7D8] hover:bg-[#DDD4C0] border border-[#DDD4C0] hover:border-[#1B3828] text-[#1C1410] py-3.5 rounded-2xl font-bold transition-all">
                  {t('motions_raise_list_btn')}
                </button>
                {pending.length > 0 && (
                  <button onClick={() => setView('vote')}
                    className="flex-1 bg-[#1B3828] hover:bg-[#2A5A3C] text-white py-3.5 rounded-2xl font-black transition-colors">
                    {t('motions_vote_list_btn')}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}