'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCommitteeStore } from '@/lib/store';

type JoinMode = 'delegate' | 'chair' | 'advisor';

export default function JoinPage() {
  const router = useRouter();
  const { joinCommittee, committees } = useCommitteeStore();

  const [mode, setMode] = useState<JoinMode>('delegate');
  const [code, setCode] = useState('');
  const [country, setCountry] = useState('');
  const [error, setError] = useState('');
  const [foundCommittee, setFoundCommittee] = useState<{ name: string; topic: string; delegates: { country: string }[] } | null>(null);

  const handleCodeChange = (val: string) => {
    const upper = val.toUpperCase().slice(0, 6);
    setCode(upper);
    setError('');
    if (upper.length === 6) {
      const c = Object.values(committees).find((c) => c.code === upper);
      if (c) {
        setFoundCommittee(c);
      } else {
        setFoundCommittee(null);
        setError('Committee not found. Check the code and try again.');
      }
    } else {
      setFoundCommittee(null);
    }
  };

  const handleJoin = () => {
    if (mode === 'chair') {
      if (!foundCommittee) { setError('Committee not found.'); return; }
      router.push(`/chair/${code}`);
      return;
    }
    if (mode === 'advisor') {
      if (!foundCommittee) { setError('Committee not found.'); return; }
      router.push(`/advisor/${code}`);
      return;
    }
    // delegate
    const committee = joinCommittee(code);
    if (committee) {
      const encoded = encodeURIComponent(country);
      router.push(`/delegate/${committee.code}?country=${encoded}`);
    } else {
      setError('Committee not found.');
    }
  };

  const tabs: { key: JoinMode; label: string; icon: string; desc: string }[] = [
    { key: 'delegate', label: 'Delegate', icon: '🌐', desc: 'Join as a country delegation' },
    { key: 'chair', label: 'Re-join as Chair', icon: '🪑', desc: 'Access the chair panel' },
    { key: 'advisor', label: 'Faculty Advisor', icon: '👁️', desc: 'Read-only observer view' },
  ];

  return (
    <div className="min-h-screen bg-[#0D0906] flex flex-col">
      <nav className="border-b border-[#2E1E0F] px-6 h-16 flex items-center justify-between bg-[#150F09]">
        <Link href="/" className="flex items-center gap-3">
          <img src="/gavelling-logo.png" alt="Gavelling" className="h-9 w-auto" />
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
              <button key={t.key} onClick={() => { setMode(t.key); setError(''); setCode(''); setFoundCommittee(null); setCountry(''); }}
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
              <input
                type="text"
                value={code}
                onChange={(e) => handleCodeChange(e.target.value)}
                placeholder="ABC123"
                className="w-full bg-[#150F09] border border-[#2E1E0F] rounded-lg px-4 py-3 text-white placeholder-[#7A5A38] focus:outline-none focus:border-[#7B4A1E] transition-colors font-mono text-xl tracking-widest text-center uppercase"
                maxLength={6}
              />
              {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
            </div>

            {foundCommittee && (
              <div className="bg-[#7B4A1E]/10 border border-[#2E1E0F] rounded-xl p-4">
                <div className="text-[#7B4A1E] text-xs font-mono mb-2">COMMITTEE FOUND</div>
                <div className="text-white font-bold">{foundCommittee.name}</div>
                <div className="text-[#C4A882] text-sm mt-1">{foundCommittee.topic}</div>
                <div className="text-[#7A5A38] text-xs mt-2">{foundCommittee.delegates.length} delegates registered</div>
              </div>
            )}

            {foundCommittee && mode === 'delegate' && (
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
            )}

            <button
              onClick={handleJoin}
              disabled={mode === 'delegate' ? (!foundCommittee || !country) : !foundCommittee}
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
