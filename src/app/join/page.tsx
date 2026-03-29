'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCommitteeStore } from '@/lib/store';

export default function JoinPage() {
  const router = useRouter();
  const { joinCommittee, committees } = useCommitteeStore();

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
    const committee = joinCommittee(code);
    if (committee) {
      const encoded = encodeURIComponent(country);
      router.push(`/delegate/${committee.code}?country=${encoded}`);
    } else {
      setError('Committee not found.');
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0e1a] flex flex-col">
      <nav className="border-b border-[#1e2540] px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-sm font-bold">M</div>
          <span className="font-bold text-white">MUN Command</span>
        </Link>
        <Link href="/create" className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
          Chair? Create Committee →
        </Link>
      </nav>

      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <h1 className="text-3xl font-black text-white mb-2">Join a Committee</h1>
          <p className="text-[#8892aa] mb-8">Enter the session code from your chair or director.</p>

          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-[#c0c8d8] mb-2">Session Code</label>
              <input
                type="text"
                value={code}
                onChange={(e) => handleCodeChange(e.target.value)}
                placeholder="ABC123"
                className="w-full bg-[#0f1526] border border-[#1e2540] rounded-lg px-4 py-3 text-white placeholder-[#4a5580] focus:outline-none focus:border-blue-600 transition-colors font-mono text-xl tracking-widest text-center uppercase"
                maxLength={6}
              />
              {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
            </div>

            {foundCommittee && (
              <div className="bg-blue-950/30 border border-blue-800/40 rounded-xl p-4">
                <div className="text-blue-400 text-xs font-mono mb-2">COMMITTEE FOUND</div>
                <div className="text-white font-bold">{foundCommittee.name}</div>
                <div className="text-[#8892aa] text-sm mt-1">{foundCommittee.topic}</div>
                <div className="text-[#4a5580] text-xs mt-2">{foundCommittee.delegates.length} delegates registered</div>
              </div>
            )}

            {foundCommittee && (
              <div>
                <label className="block text-sm font-medium text-[#c0c8d8] mb-2">Your Country / Delegation</label>
                <select
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full bg-[#0f1526] border border-[#1e2540] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-600 transition-colors"
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
              disabled={!foundCommittee || !country}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900 disabled:text-blue-700 text-white py-3 rounded-lg font-semibold transition-colors"
            >
              Join Session →
            </button>
          </div>

          <p className="text-center text-[#4a5580] text-sm mt-8">
            Are you a chair?{' '}
            <Link href="/create" className="text-blue-400 hover:text-blue-300">
              Create a committee instead
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
