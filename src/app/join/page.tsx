'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useCommitteeStore } from '@/lib/store';
import { getCommitteeByCode, addChairName } from '@/lib/committeeService';
import { Committee } from '@/lib/types';
import { useSettingsStore } from '@/lib/settingsStore';
import { Emoji } from '@/components/Emoji';
import { useT, useLanguage } from '@/contexts/LanguageContext';
import { getCountryDisplayName } from '@/lib/countries';
import FitToScreen from '@/components/FitToScreen';
import { supabase } from '@/lib/supabase';
import { PRESET_LOGOS } from '@/lib/presetNames';

type JoinMode = 'delegate' | 'chair' | 'advisor';


function JoinPageInner() {
  const t = useT();
  const { language } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { committees } = useCommitteeStore();
  const { getSettings } = useSettingsStore();

  const initialMode = (searchParams.get('mode') as JoinMode) ?? 'delegate';
  const [mode, setMode] = useState<JoinMode>(initialMode);
  const [code, setCode] = useState(searchParams.get('code') ?? '');
  const [country, setCountry] = useState('');
  const [error, setError] = useState('');
  const [suffixError, setSuffixError] = useState('');
  const [lookingUp, setLookingUp] = useState(false);
  const [foundCommittee, setFoundCommittee] = useState<Committee | null>(null);
  // Chair name selection — after committee found in chair mode
  const [chairName, setChairName] = useState('');
  const [chairNameMode, setChairNameMode] = useState<'select' | 'new'>('select');
  const [newChairName, setNewChairName] = useState('');
  const [chairPassword, setChairPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [activeChairNames, setActiveChairNames] = useState<Set<string>>(new Set());
  const presenceChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // On mount, if code was pre-filled from URL, trigger lookup immediately
  useEffect(() => {
    const initial = searchParams.get('code') ?? '';
    if (initial.length >= 4) {
      doLookup(initial.toUpperCase(), initialMode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Subscribe to chair presence channel to detect if a chair is already active
  useEffect(() => {
    if (presenceChannelRef.current) {
      supabase.removeChannel(presenceChannelRef.current);
      presenceChannelRef.current = null;
      setActiveChairNames(new Set());
    }
    if (!foundCommittee || mode !== 'chair') return;

    const channel = supabase.channel(`chair-presence-${foundCommittee.id}`);
    presenceChannelRef.current = channel;

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<{ joinedAt: number }>();
        setActiveChairNames(new Set(Object.keys(state)));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      presenceChannelRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [foundCommittee?.id, mode]);

  function doLookup(upper: string, currentMode: JoinMode = mode) {
    setLookingUp(true);
    setError('');
    setFoundCommittee(null);
    setChairName('');
    setChairNameMode('select');
    setNewChairName('');
    setChairPassword('');
    setPasswordError('');
    setActiveChairNames(new Set());

    // 1. Check local store first (instant)
    const local = Object.values(committees).find((c) => c.code === upper);
    if (local) {
      setFoundCommittee(local);
      setLookingUp(false);
      return;
    }

    // 2. Fall back to DB
    getCommitteeByCode(upper).then((remote) => {
      if (remote) {
        setFoundCommittee(remote);
      } else {
        setFoundCommittee(null);
        setError(t('join_not_found'));
      }
      setLookingUp(false);
    });
  }

  const handleCodeChange = (val: string) => {
    // Allow up to 20 chars for custom codes
    const upper = val.toUpperCase().slice(0, 20);
    setCode(upper);
    setError('');
    setSuffixError('');
    setFoundCommittee(null);
    setLookingUp(false);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (upper.length >= 4) {
      setLookingUp(true);
      debounceRef.current = setTimeout(() => doLookup(upper, mode), 350);
    }
  };

  const handleJoin = () => {
    if (!foundCommittee) { setError('Committee not found.'); return; }
    if (mode === 'chair') {
      const name = chairNameMode === 'new' ? newChairName.trim() : chairName;
      if (!name) { setError(t('join_select_name')); return; }
      const expectedPassword = foundCommittee.dbChairJoinSuffix ?? getSettings(foundCommittee.code).chairJoinSuffix;
      if (expectedPassword && chairPassword !== expectedPassword) {
        setPasswordError('Incorrect password — ask your head chair.');
        return;
      }
      addChairName(foundCommittee.id, name);
      router.push(`/chair/${foundCommittee.code}?chairName=${encodeURIComponent(name)}`);
      return;
    }
    if (mode === 'advisor') {
      router.push(`/advisor/${foundCommittee.code}`);
      return;
    }
    // delegate
    const encoded = encodeURIComponent(country);
    router.push(`/delegate/${foundCommittee.code}?country=${encoded}`);
  };

  const resetMode = (m: JoinMode) => {
    setMode(m);
    setError('');
    setCountry('');
    setChairName('');
    setChairNameMode('select');
    setNewChairName('');
    setChairPassword('');
    setPasswordError('');
    setActiveChairNames(new Set());
  };

  const tabs: { key: JoinMode; label: string; icon: string }[] = [
    { key: 'delegate', label: 'Delegate', icon: '🌐' },
    { key: 'chair', label: 'Re-join as Chair', icon: '🪑' },
    { key: 'advisor', label: 'Faculty Advisor', icon: '👁️' },
  ];

  const selectedChairName = chairNameMode === 'new' ? newChairName.trim() : chairName;
  const chairAlreadyActive = !!selectedChairName && activeChairNames.has(selectedChairName);

  return (
    <FitToScreen>
    <div className="h-full w-full flex flex-col overflow-hidden relative" style={{ backgroundColor: '#EDE7D8' }}>
      {/* Grain texture */}
      <div className="pointer-events-none fixed inset-0 z-0" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23grain)' opacity='1'/%3E%3C/svg%3E")`, backgroundRepeat: 'repeat', backgroundSize: '300px 300px', mixBlendMode: 'multiply', opacity: 0.18 }} />
      <nav className="relative z-10 border-b border-[#DDD4C0]/60 px-6 h-16 flex items-center justify-between" style={{ backgroundColor: '#EDE7D8' }}>
        <Link href="/" className="flex items-center gap-3">
          <img src="/GavellingLogo.png" alt="Gavelling" className="w-[150px] h-auto object-contain" />
        </Link>
        <Link href="/create" className="text-sm text-[#1B3828] hover:text-[#6A5A4A] transition-colors">
          {t('join_create_link')}
        </Link>
      </nav>

      <div className="relative z-10 flex-1 flex items-center justify-center px-6 py-4">
        <div className="w-full max-w-lg">

          {/* Title */}
          <h1 className="text-5xl font-black text-center mb-0.5 tracking-wide" style={{ color: '#1B3828', fontFamily: "'Outfit', sans-serif", letterSpacing: '-0.01em' }}>{t('join_title')}</h1>
          <p className="text-center text-sm mb-4" style={{ color: '#9A8A78' }}>{t('join_subtitle')}</p>

          {/* Code input — always first */}
          <div className="mb-5">
            <div className="relative">
              <input
                type="text"
                value={code}
                onChange={(e) => handleCodeChange(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && foundCommittee) handleJoin(); }}
                placeholder={t('join_code_placeholder')}
                className="w-full rounded-2xl px-6 py-3.5 font-mono text-xl tracking-widest text-center uppercase focus:outline-none transition-colors"
                style={{ backgroundColor: '#FAF8F3', border: '2px solid #DDD4C0', color: '#1C1410' }}
                onFocus={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#1B3828'; }}
                onBlur={(e) => { (e.currentTarget as HTMLElement).style.borderColor = foundCommittee ? '#1B3828' : '#DDD4C0'; }}
                maxLength={20}
                autoFocus
              />
              {lookingUp && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  <div className="w-5 h-5 border-2 border-[#1B3828] border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
            {error && <p className="text-sm mt-2 text-center font-semibold" style={{ color: '#8B2020' }}>{error}</p>}
            {suffixError && !error && (
              <p className="text-sm mt-2 text-center font-semibold px-3 py-2 rounded-xl" style={{ color: '#8B2020', backgroundColor: 'rgba(139,32,32,0.08)', border: '1px solid rgba(139,32,32,0.2)' }}>{suffixError}</p>
            )}
          </div>

          {/* Committee found card */}
          {foundCommittee && (
            <div className="mb-5 rounded-xl px-4 py-2.5 flex items-center gap-3" style={{ backgroundColor: 'rgba(27,56,40,0.08)', border: '1.5px solid rgba(27,56,40,0.25)' }}>
              {PRESET_LOGOS[foundCommittee.name]
                ? <img src={PRESET_LOGOS[foundCommittee.name]} alt="" className="w-8 h-8 object-contain shrink-0" />
                : <span className="text-xs font-mono font-black shrink-0" style={{ color: '#1B3828' }}>✓</span>
              }
              <div className="min-w-0">
                <p className="font-black text-sm truncate" style={{ color: '#1C1410' }}>{foundCommittee.name}{foundCommittee.topic ? <span className="font-normal text-xs ms-1.5" style={{ color: '#9A8A78' }}>· {foundCommittee.topic}</span> : ''}</p>
                <p className="text-xs" style={{ color: '#9A8A78' }}>{foundCommittee.delegates.length} {t('join_delegates_registered')}</p>
                {foundCommittee.endedAt && <p className="text-xs font-semibold mt-0.5" style={{ color: '#B8844A' }}>{t('join_session_ended')}</p>}
                {!foundCommittee.endedAt && foundCommittee.suspendedAt && mode === 'delegate' && <p className="text-xs font-semibold mt-0.5" style={{ color: '#B8844A' }}>{t('join_adjourned')}</p>}
              </div>
            </div>
          )}

          {/* Role cards */}
          {(() => {
            const roleCards: { key: JoinMode; label: string; desc: string }[] = [
              { key: 'delegate', label: t('join_role_delegate'), desc: t('join_role_delegate_desc') },
              { key: 'chair', label: t('join_role_chair'), desc: t('join_role_chair_desc') },
              { key: 'advisor', label: t('join_role_advisor'), desc: t('join_role_advisor_desc') },
            ];
            return (
              <div className="grid grid-cols-3 gap-4 mb-5">
                {roleCards.map(({ key, label, desc }) => {
                  const enabled = true;
                  const isActive = mode === key && enabled;
                  return (
                    <button
                      key={key}
                      onClick={() => { if (enabled) resetMode(key); }}
                      disabled={!enabled}
                      className="flex flex-col items-center justify-center gap-1.5 transition-all focus:outline-none"
                      style={{
                        height: '160px',
                        padding: '0 12px',
                        backgroundColor: '#1B3828',
                        opacity: enabled ? 1 : 0.35,
                        border: isActive ? '2px solid #EED98A' : '2px solid rgba(61,122,82,0.4)',
                        borderRadius: '20px',
                        cursor: enabled ? 'pointer' : 'not-allowed',
                        transform: isActive ? 'scale(1.04)' : 'scale(1)',
                        boxShadow: isActive ? '0 12px 40px rgba(27,56,40,0.35)' : '0 4px 16px rgba(27,56,40,0.15)',
                        overflow: 'hidden',
                        position: 'relative',
                      }}
                    >
                      <span className="font-black text-sm tracking-wide" style={{ color: isActive ? '#EED98A' : '#A8C5B0', fontFamily: "'Outfit', sans-serif" }}>{label}</span>
                      <span className="text-xs px-3 text-center leading-snug" style={{ color: isActive ? 'rgba(238,217,138,0.7)' : 'rgba(168,197,176,0.6)' }}>{desc}</span>
                    </button>
                  );
                })}
              </div>
            );
          })()}

          {/* Delegate country select */}
          {foundCommittee && mode === 'delegate' && (() => {
            return (
              <div className="mb-4">
                <label className="block text-sm font-semibold mb-2" style={{ color: '#1C1410' }}>{t('join_country_label')}</label>
                <select
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full rounded-xl px-4 py-3 focus:outline-none transition-colors"
                  style={{ backgroundColor: '#FAF8F3', border: '1.5px solid #DDD4C0', color: '#1C1410' }}
                >
                  <option value="">{t('join_country_placeholder')}</option>
                  {foundCommittee.delegates.map((d) => (
                    <option key={d.country} value={d.country}>{getCountryDisplayName(d.country, language)}</option>
                  ))}
                </select>
              </div>
            );
          })()}

          {/* Chair name selection */}
          {foundCommittee && mode === 'chair' && (
            <div className="mb-4">
              <label className="block text-sm font-semibold mb-2" style={{ color: '#1C1410' }}>{t('join_chair_label')}</label>
              {foundCommittee.chairNames.length > 0 && (
                <div className="space-y-2 mb-3">
                  {foundCommittee.chairNames.map((n) => (
                    <button
                      key={n}
                      onClick={() => { setChairNameMode('select'); setChairName(n); }}
                      className="w-full text-start px-4 py-2.5 rounded-xl border text-sm font-semibold transition-colors focus:outline-none"
                      style={{
                        backgroundColor: chairNameMode === 'select' && chairName === n ? '#1B3828' : '#FAF8F3',
                        borderColor: chairNameMode === 'select' && chairName === n ? '#2A5A3C' : '#DDD4C0',
                        color: chairNameMode === 'select' && chairName === n ? 'white' : '#6A5A4A',
                      }}
                    >
                      {n}
                    </button>
                  ))}
                  <button
                    onClick={() => { setChairNameMode('new'); setChairName(''); }}
                    className="w-full text-start px-4 py-2.5 rounded-xl border text-sm font-semibold transition-colors focus:outline-none"
                    style={{
                      backgroundColor: chairNameMode === 'new' ? '#DDD4C0' : '#FAF8F3',
                      borderColor: chairNameMode === 'new' ? '#1B3828' : '#DDD4C0',
                      color: chairNameMode === 'new' ? '#1C1410' : '#9A8A78',
                    }}
                  >
                    {t('join_new_name')}
                  </button>
                </div>
              )}
              {(chairNameMode === 'new' || foundCommittee.chairNames.length === 0) && (
                <input
                  type="text"
                  value={newChairName}
                  onChange={(e) => setNewChairName(e.target.value)}
                  placeholder={t('join_name_placeholder')}
                  autoFocus={chairNameMode === 'new'}
                  className="w-full rounded-xl px-4 py-3 focus:outline-none transition-colors"
                  style={{ backgroundColor: '#FAF8F3', border: '1.5px solid #DDD4C0', color: '#1C1410' }}
                />
              )}
            </div>
          )}

          {foundCommittee && mode === 'chair' && chairAlreadyActive && (
            <div className="mb-4 px-4 py-3 rounded-xl text-xs font-semibold flex items-center gap-2"
              style={{ backgroundColor: 'rgba(139,32,32,0.08)', border: '1px solid rgba(139,32,32,0.2)', color: '#8B2020' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              This name is already in an active session. Select a different name to join as a view-only co-chair.
            </div>
          )}

          {foundCommittee && mode === 'chair' && (() => {
            const requiresPassword = !!(foundCommittee.dbChairJoinSuffix ?? getSettings(foundCommittee.code).chairJoinSuffix);
            if (!requiresPassword) return null;
            return (
              <div className="mb-4">
                <label className="block text-sm font-semibold mb-2" style={{ color: '#1C1410' }}>Chair Password</label>
                <input
                  type="password"
                  value={chairPassword}
                  onChange={(e) => { setChairPassword(e.target.value); setPasswordError(''); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleJoin(); }}
                  placeholder="Enter password…"
                  className="w-full rounded-xl px-4 py-3 focus:outline-none transition-colors"
                  style={{ backgroundColor: '#FAF8F3', border: `1.5px solid ${passwordError ? '#8B2020' : '#DDD4C0'}`, color: '#1C1410' }}
                />
                {passwordError && <p className="text-xs mt-1.5 font-semibold" style={{ color: '#8B2020' }}>{passwordError}</p>}
              </div>
            );
          })()}

          {/* Join button */}
          <button
            onClick={handleJoin}
            disabled={
              mode === 'delegate'
                ? (!foundCommittee || !country)
                : mode === 'chair'
                ? (!foundCommittee ||
                    (chairNameMode === 'select' ? !chairName : !newChairName.trim()) ||
                    (!!(foundCommittee.dbChairJoinSuffix ?? getSettings(foundCommittee.code).chairJoinSuffix) && !chairPassword) ||
                    chairAlreadyActive)
                : !foundCommittee
            }
            className="w-full py-4 rounded-2xl font-black text-base transition-all focus:outline-none"
            style={{ fontFamily: "'Outfit', sans-serif", letterSpacing: '0.06em' }}
            onMouseEnter={(e) => { if (!(e.currentTarget as HTMLButtonElement).disabled) (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
            onMouseLeave={(e) => { if (!(e.currentTarget as HTMLButtonElement).disabled) (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
            ref={(el) => {
              if (el) {
                const isDisabled = el.disabled;
                el.style.backgroundColor = isDisabled ? '#DDD4C0' : '#1B3828';
                el.style.color = isDisabled ? '#9A8A78' : 'white';
              }
            }}
          >
            {mode === 'delegate'
              ? (foundCommittee?.endedAt ? t('join_btn_delegate_ended') : t('join_btn_delegate'))
              : mode === 'chair' ? t('join_btn_chair') : t('join_btn_advisor')}
          </button>

          <p className="text-center text-sm mt-6" style={{ color: '#9A8A78' }}>
            {t('join_chair_prompt')}{' '}
            <Link href="/create" className="font-semibold transition-colors" style={{ color: '#1B3828' }}>
              {t('join_create_instead')}
            </Link>
          </p>

        </div>
      </div>
    </div>
    </FitToScreen>
  );
}

export default function JoinPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 relative" style={{ backgroundColor: '#EDE7D8' }}>
        <style>{`@keyframes gavel-strike { 0% { transform: rotate(-30deg); } 35% { transform: rotate(15deg); } 50% { transform: rotate(10deg); } 65% { transform: rotate(15deg); } 100% { transform: rotate(-30deg); } } .gavel-anim { animation: gavel-strike 1s ease-in-out infinite; transform-origin: 85% 85%; }`}</style>
        <svg className="gavel-anim" width="72" height="72" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="38" y="38" width="8" height="28" rx="3" transform="rotate(-45 38 38)" fill="#1B3828" />
          <rect x="8" y="14" width="36" height="16" rx="5" transform="rotate(-45 8 14)" fill="#B6871F" />
          <rect x="10" y="16" width="36" height="7" rx="3" transform="rotate(-45 10 16)" fill="#6A5A4A" opacity="0.4" />
          <circle cx="56" cy="56" r="3" fill="#1B3828" opacity="0.5" />
        </svg>
        <p className="text-[#9A8A78] text-sm font-mono tracking-widest">LOADING…</p>
      </div>
    }>
      <JoinPageInner />
    </Suspense>
  );
}
