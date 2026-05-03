'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import SiteNav from '@/components/SiteNav';

const steps = [
  { step: '01', title: 'Create a Committee', desc: 'Chair enters committee name, topic, and delegates. Pick a preset or build custom.' },
  { step: '02', title: 'Share the Code', desc: 'Delegates join instantly with a session code from any device.' },
  { step: '03', title: 'Run the Session', desc: 'Manage roll call, speakers list, motions, and voting — all in one place.' },
];

const chairFeatures = [
  'General Speakers List with live countdown',
  'Moderated & Unmoderated Caucus tools',
  'Right of Reply as independent overlay',
  'Motions queue sorted by precedence',
  'Working Paper & Draft Resolution flow',
  'Session suspend & resume with full state',
];

const delegateFeatures = [
  'Live session view on any device',
  'GSL join requests sent to chair',
  'Queue position with floor indicator',
  'Document viewing & WP submission',
  'Speaking history & stats',
  'Real-time status updates',
];

const faFeatures = [
  'Read-only observer view',
  'Nudge delegates via emoji',
  'Live queue & speaker monitoring',
  'Delegate card breakdowns',
  'Last motion tracking per delegate',
  'No setup or account required',
];

const featureColumns = [
  { role: 'For Chairs', features: chairFeatures },
  { role: 'For Delegates', features: delegateFeatures },
  { role: 'For Faculty Advisors', features: faFeatures },
];

export default function LandingPage() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState('');

  const handleJoin = () => {
    const code = joinCode.trim().toUpperCase();
    if (code.length >= 4) {
      const isChairCode = code.includes('-') && code.split('-').pop()?.length === 4;
      if (isChairCode) {
        router.push(`/join?code=${encodeURIComponent(code)}&mode=chair`);
      } else {
        router.push(`/join?code=${encodeURIComponent(code)}`);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#0D0906] flex flex-col relative overflow-x-hidden">
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          backgroundImage: 'url(/background-grain.png)',
          backgroundRepeat: 'repeat',
          backgroundSize: '300px 300px',
          mixBlendMode: 'screen',
          opacity: 0.07,
        }}
      />

      <SiteNav />

      {/* Hero */}
      <section className="relative z-10 flex-1 flex items-stretch px-4 gap-4 pb-8 min-h-[80vh]">
        <div className="hidden lg:flex flex-col w-[22vw] shrink-0">
          <div className="flex-1 rounded-2xl border border-[#2E1E0F] overflow-hidden bg-[#120D07]"
            style={{ aspectRatio: '9/16', maxHeight: '78vh' }}>
            <img src="/landing-left.jpg" alt="" className="w-full h-full object-cover opacity-80"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
                (e.target as HTMLImageElement).parentElement!.style.background = '#1A1209';
              }} />
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center py-12 px-4">
          <h1
            className="font-black tracking-tight text-white leading-[1.05] mb-5 text-center whitespace-nowrap"
            style={{ fontSize: 'clamp(56px, 8vw, 120px)' }}
          >
            MUN done{' '}
            <span style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontWeight: 400, color: '#B8844A' }}>
              right.
            </span>
          </h1>

          <p className="text-[#C4A882] text-lg max-w-md text-center mb-12 leading-relaxed">
            The most user-friendly way to run your MUN committee.
          </p>

          <Link href="/create"
            className="bg-[#7B4A1E] hover:bg-[#8B5A2B] active:scale-[0.98] text-white px-10 py-5 rounded-2xl font-black text-xl transition-all shadow-lg shadow-[#7B4A1E]/20 mb-6">
            Start Your Committee →
          </Link>

          <div className="w-full max-w-xs">
            <p className="text-xs text-[#7A5A38] text-center mb-2 font-mono tracking-wider">JOIN A SESSION</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 20))}
                onKeyDown={(e) => { if (e.key === 'Enter') handleJoin(); }}
                placeholder="Session code"
                className="flex-1 bg-[#150F09] border border-[#2E1E0F] focus:border-[#7B4A1E] rounded-xl px-4 py-3 text-white placeholder-[#7A5A38] focus:outline-none text-sm font-mono tracking-widest uppercase text-center transition-colors"
                maxLength={20}
              />
              <button
                onClick={handleJoin}
                disabled={joinCode.trim().length < 4}
                className="bg-[#2E1E0F] hover:bg-[#3D2A15] disabled:opacity-40 border border-[#2E1E0F] text-[#C4A882] px-4 py-3 rounded-xl font-bold text-sm transition-colors"
              >
                Join →
              </button>
            </div>
          </div>
        </div>

        <div className="hidden lg:flex flex-col w-[22vw] shrink-0">
          <div className="flex-1 rounded-2xl border border-[#2E1E0F] overflow-hidden bg-[#120D07]"
            style={{ aspectRatio: '9/16', maxHeight: '78vh' }}>
            <img src="/landing-right.jpg" alt="" className="w-full h-full object-cover opacity-80"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
                (e.target as HTMLImageElement).parentElement!.style.background = '#1A1209';
              }} />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="relative z-10 border-t border-[#2E1E0F] py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-black text-white mb-3">Up and Running in Minutes</h2>
            <p className="text-[#C4A882]">No downloads, no setup. Just open your browser and start chairing.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {steps.map((s) => (
              <div key={s.step} className="text-center">
                <div className="text-5xl font-black text-[#2E1E0F] mb-4">{s.step}</div>
                <h3 className="text-lg font-bold text-white mb-2">{s.title}</h3>
                <p className="text-[#7A5A38] text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* All Free Features */}
      <section className="relative z-10 border-t border-[#2E1E0F] py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-mono tracking-[0.2em] text-[#7A5A38] mb-4 uppercase">No paywalls. No catch.</p>
            <h2 className="font-black text-white leading-none" style={{ fontSize: 'clamp(52px, 8vw, 112px)' }}>
              All Free Features
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {featureColumns.map((col) => (
              <div key={col.role} className="rounded-2xl p-8"
                style={{ backgroundColor: 'rgba(46, 30, 15, 0.25)', border: '1px solid rgba(46, 30, 15, 0.8)' }}>
                <h3 className="font-black text-white mb-6 pb-4"
                  style={{ fontSize: '18px', borderBottom: '1px solid rgba(184, 132, 74, 0.25)', letterSpacing: '0.02em' }}>
                  {col.role}
                </h3>
                <ul className="space-y-3">
                  {col.features.map((f) => (
                    <li key={f} className="flex items-start gap-3">
                      <span className="mt-[5px] shrink-0 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#B8844A' }} />
                      <span className="text-sm leading-relaxed" style={{ color: '#C4A882' }}>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-[#2E1E0F] px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
        <img src="/GavellingLogo.png" alt="Gavelling" className="h-8 w-auto"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        <p className="text-xs text-[#7A5A38]">© {new Date().getFullYear()} Gavelling. Built for the MUN community.</p>
      </footer>
    </div>
  );
}
