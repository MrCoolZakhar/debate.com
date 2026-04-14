'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useCommitteeStore } from '@/lib/store';
import { getCommitteeByCode } from '@/lib/committeeService';
import { Committee } from '@/lib/types';
import { useSettingsStore } from '@/lib/settingsStore';

type JoinMode = 'delegate' | 'chair' | 'advisor';

function JoinPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { committees } = useCommitteeStore();
  const { getSettings } = useSettingsStore();

  const [mode, setMode] = useState<JoinMode>('delegate');
  const [code, setCode] = useState(searchParams.get('code') ?? '');
  const [country, setCountry] = useState('');
  const [error, setError] = useState('');
  const [lookingUp, setLookingUp] = useState(false);
  const [foundCommittee, setFoundCommittee] = useState<Committee | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // On mount, if code was pre-filled from URL, trigger lookup immediately
  useEffect(() => {
    const initial = searchParams.get('code') ?? '';
    if (initial.length >= 4) {
      doLookup(initial.toUpperCase());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function doLookup(upper: string) {
    setLookingUp(true);
    setError('');
    setFoundCommittee(null);

    // 1. Check local store first (instant)
    const local = Object.values(committees).find((c) => c.code === upper);
    if (local) {
      setFoundCommittee(local);
      setLookingUp(false);
      return;
    }

    // 2. Fall back to Supabase
    getCommitteeByCode(upper).then((remote) => {
      if (remote) {
        setFoundCommittee(remote);
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
      debounceRef.current = setTimeout(() => doLookup(upper), 350);
    }
  };

  const handleJoin = () => {
    if (!foundCommittee) { setError('Committee not found.'); return; }
    if (mode === 'chair') {
      router.push(`/chair/${foundCommittee.code}`);
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
  };

  const tabs: { key: JoinMode; label: string; icon: string }[] = [
    { key: 'delegate', label: 'Delegate', icon: '🌐' },
    { key: 'chair', label: 'Re-join as Chair', icon: '🪑' },
    { key: 'advisor', label: 'Faculty Advisor', icon: '👁️' },
  ];

  return (
    <div className="min-h-screen bg-[#0D0906] flex flex-col">
      <nav className="border-b border-[#2E1E0F] px-6 h-16 flex items-center justify-between bg-[#150F09]">
        <Link href="/" className="flex items-center gap-3">
          <img src="/gavelling-logo.png" alt="Gavelling" className="w-[16vw] h-auto max-h-9 object-contain" />
        </Link>
        <Link href="/create" className="text-sm text-[#7B4A1E] hover:text-[#C4A882] transition-colors">
          Chair? Create Committee →
        </Link>
      </nav>

      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <h1 className="text-3xl font-black text-white mb-2">Join a Session</h1>
          <p className="text-[#C4A882] mb-8">Enter the session code and choose your role.</p>

          {/* Mode tabs */}
          <div className="flex gap-2 mb-8">
            {tabs.map((t) => (
              <button key={t.key} onClick={() => resetMode(t.key)}
                className={`flex-1 flex flex-col items-center gap-1 py-3 px-2 rounded-xl border transition-all text-center ${
                  mode === t.key
                    ? 'bg-[#2E1E0F] border-[#7B4A1E] text-white'
                    : 'bg-[#1A1209] border-[#2E1E0F] text-[#C4A882] hover:border-[#7B4A1E]'
                }`}>
                <span className="text-xl">{t.icon}</span>
                <span className="text-xs font-bold">{t.label}</span>
              </button>
            ))}
          </div>

          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-[#E8D5B7] mb-2">Session Code</label>
              <div className="relative">
                <input
                  type="text"
                  value={code}
                  onChange={(e) => handleCodeChange(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && foundCommittee) handleJoin(); }}
                  placeholder="ABC123 or UNSC-2026"
                  className="w-full bg-[#150F09] border border-[#2E1E0F] rounded-lg px-4 py-3 text-white placeholder-[#7A5A38] focus:outline-none focus:border-[#7B4A1E] transition-colors font-mono text-xl tracking-widest text-center uppercase"
                  maxLength={20}
                  autoFocus
                />
                {lookingUp && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="w-4 h-4 border-2 border-[#7B4A1E] border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>
              {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
            </div>

            {foundCommittee && (
              <div className="bg-[#7B4A1E]/10 border border-[#7B4A1E]/30 rounded-xl p-4">
                <div className="text-[#7B4A1E] text-xs font-mono mb-2">✓ COMMITTEE FOUND</div>
                <div className="text-white font-bold">{foundCommittee.name}</div>
                <div className="text-[#C4A882] text-sm mt-1">{foundCommittee.topic}</div>
                <div className="text-[#7A5A38] text-xs mt-2">{foundCommittee.delegates.length} delegates registered</div>
              </div>
            )}

            {foundCommittee && mode === 'delegate' && (() => {
              const requireName = getSettings(foundCommittee.code).requireDelegationName;
              if (!requireName) return null;
              return (
                <div>
                  <label className="block text-sm font-medium text-[#E8D5B7] mb-2">Your Country / Delegation</label>
                  <select
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="w-full bg-[#150F09] border border-[#2E1E0F] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#7B4A1E] transition-colors"
                  >
                    <option value="">Select your country...</option>
                    {foundCommittee.delegates.map((d) => (
                      <option key={d.country} value={d.country}>{d.country}</option>
                    ))}
                  </select>
                </div>
              );
            })()}

            <button
              onClick={handleJoin}
              disabled={mode === 'delegate'
                ? (!foundCommittee || (getSettings(foundCommittee?.code ?? '').requireDelegationName && !country))
                : !foundCommittee}
              className="w-full bg-[#7B4A1E] hover:bg-[#8B5A2B] disabled:bg-[#2E1E0F] disabled:text-[#7A5A38] text-white py-3 rounded-lg font-semibold transition-colors"
            >
              {mode === 'delegate' ? 'Join Session →' : mode === 'chair' ? 'Open Chair Panel →' : 'Open Advisor View →'}
            </button>
          </div>

          <p className="text-center text-[#7A5A38] text-sm mt-8">
            Are you a chair?{' '}
            <Link href="/create" className="text-[#7B4A1E] hover:text-[#C4A882]">
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
    <Suspense fallback={<div className="h-screen bg-[#0D0906] flex items-center justify-center"><span className="text-[#7A5A38]">Loading...</span></div>}>
      <JoinPageInner />
    </Suspense>
  );
}
