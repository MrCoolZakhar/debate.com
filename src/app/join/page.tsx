'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useCommitteeStore } from '@/lib/store';
import { getCommitteeByCode, addChairName } from '@/lib/committeeService';
import { Committee } from '@/lib/types';
import { useSettingsStore } from '@/lib/settingsStore';
import { Emoji } from '@/components/Emoji';

type JoinMode = 'delegate' | 'chair' | 'advisor';

function JoinPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { committees } = useCommitteeStore();
  const { getSettings } = useSettingsStore();

  const initialMode = (searchParams.get('mode') as JoinMode) ?? 'delegate';
  const [mode, setMode] = useState<JoinMode>(initialMode);
  const [code, setCode] = useState(searchParams.get('code') ?? '');
  const [country, setCountry] = useState('');
  const [error, setError] = useState('');
  const [lookingUp, setLookingUp] = useState(false);
  const [foundCommittee, setFoundCommittee] = useState<Committee | null>(null);
  // Chair name selection — after committee found in chair mode
  const [chairName, setChairName] = useState('');
  const [chairNameMode, setChairNameMode] = useState<'select' | 'new'>('select');
  const [newChairName, setNewChairName] = useState('');

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // On mount, if code was pre-filled from URL, trigger lookup immediately
  useEffect(() => {
    const initial = searchParams.get('code') ?? '';
    if (initial.length >= 4) {
      doLookup(initial.toUpperCase(), initialMode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function doLookup(upper: string, currentMode: JoinMode = mode) {
    setLookingUp(true);
    setError('');
    setFoundCommittee(null);
    setChairName('');
    setChairNameMode('select');
    setNewChairName('');

    // For chair codes with suffix (e.g. "ABC123-1234"), try stripping the suffix first
    const tryBase = upper.includes('-') ? upper.slice(0, upper.lastIndexOf('-')) : null;

    // Validate chair suffix and conditionally set the found committee
    const trySetCommittee = (found: Committee) => {
      if (currentMode === 'chair' && upper.includes('-')) {
        const suffix = upper.slice(upper.lastIndexOf('-') + 1);
        const expectedSuffix = found.dbChairJoinSuffix ?? getSettings(found.code).chairJoinSuffix;
        if (suffix !== expectedSuffix) {
          setError('Invalid chair code — check the code provided by your co-chair.');
          return false;
        }
      }
      setFoundCommittee(found);
      return true;
    };

    // 1. Check local store first (instant)
    const local = Object.values(committees).find((c) => c.code === upper || (tryBase && c.code === tryBase));
    if (local) {
      trySetCommittee(local);
      setLookingUp(false);
      return;
    }

    // 2. Fall back to DB — try base code first if there's a suffix
    const lookupCode = tryBase ?? upper;
    getCommitteeByCode(lookupCode).then(async (remote) => {
      if (!remote && tryBase) {
        // Also try the full code in case it's literally the committee code
        const fallback = await getCommitteeByCode(upper);
        if (fallback) { trySetCommittee(fallback); setLookingUp(false); return; }
      }
      if (remote) {
        trySetCommittee(remote);
      } else {
        setFoundCommittee(null);
        setError('Committee not found. Check the code and try again.');
      }
      setLookingUp(false);
    });
  }

  const handleCodeChange = (val: string) => {
    // Allow up to 20 chars for custom codes
    const upper = val.toUpperCase().slice(0, 20);
    setCode(upper);
    setError('');
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
      if (!name) { setError('Please select or enter your chair name.'); return; }
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
    setCode('');
    setFoundCommittee(null);
    setCountry('');
    setLookingUp(false);
    setChairName('');
    setChairNameMode('select');
    setNewChairName('');
  };

  const tabs: { key: JoinMode; label: string; icon: string }[] = [
    { key: 'delegate', label: 'Delegate', icon: '🌐' },
    { key: 'chair', label: 'Re-join as Chair', icon: '🪑' },
    { key: 'advisor', label: 'Faculty Advisor', icon: '👁️' },
  ];

  return (
    <div className="min-h-screen bg-[#F6F1E9] flex flex-col">
      <nav className="border-b border-[#DDD4C0] px-6 h-16 flex items-center justify-between bg-[#FAF8F3]">
        <Link href="/" className="flex items-center gap-3">
          <img src="/gavelling-logo.png" alt="Gavelling" className="w-[16vw] h-auto max-h-9 object-contain" />
        </Link>
        <Link href="/create" className="text-sm text-[#1B3828] hover:text-[#6A5A4A] transition-colors">
          Chair? Create Committee →
        </Link>
      </nav>

      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <h1 className="text-3xl font-black text-[#1C1410] mb-2">Join a Session</h1>
          <p className="text-[#6A5A4A] mb-8">Enter the session code and choose your role.</p>

          {/* Mode tabs */}
          <div className="flex gap-2 mb-8">
            {tabs.map((t) => (
              <button key={t.key} onClick={() => resetMode(t.key)}
                className={`flex-1 flex flex-col items-center gap-1 py-3 px-2 rounded-xl border transition-all text-center ${
                  mode === t.key
                    ? 'bg-[#DDD4C0] border-[#1B3828] text-[#1C1410]'
                    : 'bg-[#EDE7D8] border-[#DDD4C0] text-[#6A5A4A] hover:border-[#1B3828]'
                }`}>
                <Emoji size="1.25rem">{t.icon}</Emoji>
                <span className="text-xs font-bold">{t.label}</span>
              </button>
            ))}
          </div>

          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-[#1C1410] mb-2">Session Code</label>
              <div className="relative">
                <input
                  type="text"
                  value={code}
                  onChange={(e) => handleCodeChange(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && foundCommittee) handleJoin(); }}
                  placeholder="ABC123 or UNSC-2026"
                  className="w-full bg-[#FAF8F3] border border-[#DDD4C0] rounded-lg px-4 py-3 text-[#1C1410] placeholder-[#9A8A78] focus:outline-none focus:border-[#1B3828] transition-colors font-mono text-xl tracking-widest text-center uppercase"
                  maxLength={20}
                  autoFocus
                />
                {lookingUp && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="w-4 h-4 border-2 border-[#1B3828] border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>
              {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
              {mode === 'chair' && (
                <p className="text-[#9A8A78] text-xs mt-2">Enter full chair code including -XXXX suffix</p>
              )}
            </div>

            {foundCommittee && (
              <div className="bg-[#1B3828]/10 border border-[#1B3828]/30 rounded-xl p-4">
                <div className="text-[#1B3828] text-xs font-mono mb-2">✓ COMMITTEE FOUND</div>
                <div className="text-[#1C1410] font-bold">{foundCommittee.name}</div>
                <div className="text-[#6A5A4A] text-sm mt-1">{foundCommittee.topic}</div>
                <div className="text-[#9A8A78] text-xs mt-2">{foundCommittee.delegates.length} delegates registered</div>
                {foundCommittee.endedAt && (
                  <div className="mt-3 text-xs text-[#B6871F] bg-[#1B3828]/20 border border-[#1B3828]/30 rounded-lg px-3 py-2">
                    This session has ended — view only access.
                  </div>
                )}
                {!foundCommittee.endedAt && foundCommittee.suspendedAt && mode === 'delegate' && (
                  <div className="mt-3 text-xs text-orange-400 bg-orange-950/20 border border-orange-800/30 rounded-lg px-3 py-2">
                    This session is currently adjourned — you will see a waiting screen.
                  </div>
                )}
              </div>
            )}

            {foundCommittee && mode === 'delegate' && (() => {
              const requireName = getSettings(foundCommittee.code).requireDelegationName;
              if (!requireName) return null;
              return (
                <div>
                  <label className="block text-sm font-medium text-[#1C1410] mb-2">Your Country / Delegation</label>
                  <select
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="w-full bg-[#FAF8F3] border border-[#DDD4C0] rounded-lg px-4 py-3 text-[#1C1410] focus:outline-none focus:border-[#1B3828] transition-colors"
                  >
                    <option value="">Select your country...</option>
                    {foundCommittee.delegates.map((d) => (
                      <option key={d.country} value={d.country}>{d.country}</option>
                    ))}
                  </select>
                </div>
              );
            })()}

            {/* Chair name selection — shown when committee found in chair mode */}
            {foundCommittee && mode === 'chair' && (
              <div>
                <label className="block text-sm font-medium text-[#1C1410] mb-2">Which chair are you?</label>
                {foundCommittee.chairNames.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {foundCommittee.chairNames.map((n) => (
                      <button
                        key={n}
                        onClick={() => { setChairNameMode('select'); setChairName(n); }}
                        className={`w-full text-left px-4 py-2.5 rounded-lg border text-sm font-semibold transition-colors ${
                          chairNameMode === 'select' && chairName === n
                            ? 'bg-[#1B3828] border-[#2A5A3C] text-white'
                            : 'bg-[#FAF8F3] border-[#DDD4C0] text-[#6A5A4A] hover:border-[#1B3828]'
                        }`}
                      >
                        🪑 {n}
                      </button>
                    ))}
                    <button
                      onClick={() => { setChairNameMode('new'); setChairName(''); }}
                      className={`w-full text-left px-4 py-2.5 rounded-lg border text-sm font-semibold transition-colors ${
                        chairNameMode === 'new'
                          ? 'bg-[#DDD4C0] border-[#1B3828] text-[#1C1410]'
                          : 'bg-[#FAF8F3] border-[#DDD4C0] text-[#9A8A78] hover:border-[#1B3828]'
                      }`}
                    >
                      + New name
                    </button>
                  </div>
                )}
                {(chairNameMode === 'new' || foundCommittee.chairNames.length === 0) && (
                  <input
                    type="text"
                    value={newChairName}
                    onChange={(e) => setNewChairName(e.target.value)}
                    placeholder="Enter your name…"
                    autoFocus={chairNameMode === 'new'}
                    className="w-full bg-[#FAF8F3] border border-[#DDD4C0] rounded-lg px-4 py-3 text-[#1C1410] placeholder-[#9A8A78] focus:outline-none focus:border-[#1B3828] transition-colors"
                  />
                )}
              </div>
            )}

            <button
              onClick={handleJoin}
              disabled={
                mode === 'delegate'
                  ? (!foundCommittee || (getSettings(foundCommittee?.code ?? '').requireDelegationName && !country))
                  : mode === 'chair'
                  ? (!foundCommittee ||
                      ((foundCommittee.dbSeparateChairCode ?? getSettings(foundCommittee.code).separateChairCode) && !code.includes('-')) ||
                      (chairNameMode === 'select' ? !chairName : !newChairName.trim()))
                  : !foundCommittee
              }
              className="w-full bg-[#1B3828] hover:bg-[#2A5A3C] disabled:bg-[#DDD4C0] disabled:text-[#9A8A78] text-white py-3 rounded-lg font-semibold transition-colors"
            >
              {mode === 'delegate'
                ? (foundCommittee?.endedAt ? 'View Session →' : 'Join Session →')
                : mode === 'chair' ? 'Open Chair Panel →' : 'Open Advisor View →'}
            </button>
          </div>

          <p className="text-center text-[#9A8A78] text-sm mt-8">
            Are you a chair?{' '}
            <Link href="/create" className="text-[#1B3828] hover:text-[#6A5A4A]">
              Create a committee instead
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#F6F1E9] flex flex-col items-center justify-center gap-4">
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
