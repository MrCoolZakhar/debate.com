'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const steps = [
  { step: '01', title: 'Create a Committee', desc: 'Chair enters committee name, topic, and delegates. Pick a preset or build custom.' },
  { step: '02', title: 'Share the Code', desc: 'Delegates join instantly with a session code from any device.' },
  { step: '03', title: 'Run the Session', desc: 'Manage roll call, speakers list, motions, and voting — all in one place.' },
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
    <div className="min-h-screen bg-[#0D0906] flex flex-col relative overflow-x-hidden" style={{ backgroundImage: 'url(/landing-bg.png)', backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }}>

      {/* Grain overlay — place background-grain.png in /public/ */}
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

      {/* Nav — logo only */}
      <nav className="relative z-10 px-8 h-16 flex items-center shrink-0">
        <img
          src="/gavelling-logo.png"
          alt="Gavelling"
          className="w-[16vw] h-auto max-h-9 object-contain"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      </nav>

      {/* Hero — three columns */}
      <section className="relative z-10 flex-1 flex items-stretch px-4 gap-4 pb-8 min-h-[80vh]">

        {/* Left image slot — 9:16, name the file landing-left.jpg */}
        <div className="hidden lg:flex flex-col w-[22vw] shrink-0">
          <div className="flex-1 rounded-2xl border border-[#2E1E0F] overflow-hidden bg-[#120D07]"
            style={{ aspectRatio: '9/16', maxHeight: '78vh' }}>
            <img
              src="/landing-left.jpg"
              alt=""
              className="w-full h-full object-cover opacity-80"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
                (e.target as HTMLImageElement).parentElement!.style.background = '#1A1209';
              }}
            />
          </div>
        </div>

        {/* Center content */}
        <div className="flex-1 flex flex-col items-center justify-center py-12 px-4">
          <div className="inline-flex items-center gap-2 bg-[#7B4A1E]/10 border border-[#2E1E0F] text-[#C4A882] text-xs font-medium px-3 py-1.5 rounded-full mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-[#3D6B35] animate-pulse shrink-0" />
            Free to use · No account needed
          </div>

          <h1 className="text-5xl md:text-6xl font-black tracking-tight text-white leading-[1.05] mb-5 text-center">
            Run Your Committee<br />
            <span className="text-[#B8844A]">with Confidence</span>
          </h1>

          <p className="text-[#C4A882] text-lg max-w-md text-center mb-12 leading-relaxed">
            Gavelling gives chairs everything they need — from roll call to final voting.
          </p>

          {/* Start committee — primary CTA */}
          <Link
            href="/create"
            className="bg-[#7B4A1E] hover:bg-[#8B5A2B] active:scale-[0.98] text-white px-10 py-5 rounded-2xl font-black text-xl transition-all shadow-lg shadow-[#7B4A1E]/20 mb-6"
          >
            Start Your Committee →
          </Link>

          {/* Join session — inline input */}
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

        {/* Right image slot — 9:16, name the file landing-right.jpg */}
        <div className="hidden lg:flex flex-col w-[22vw] shrink-0">
          <div className="flex-1 rounded-2xl border border-[#2E1E0F] overflow-hidden bg-[#120D07]"
            style={{ aspectRatio: '9/16', maxHeight: '78vh' }}>
            <img
              src="/landing-right.jpg"
              alt=""
              className="w-full h-full object-cover opacity-80"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
                (e.target as HTMLImageElement).parentElement!.style.background = '#1A1209';
              }}
            />
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

      {/* Footer */}
      <footer className="relative z-10 border-t border-[#2E1E0F] px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
        <img
          src="/gavelling-logo.png"
          alt="Gavelling"
          className="h-7 w-auto"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
        <p className="text-xs text-[#7A5A38]">
          © {new Date().getFullYear()} Gavelling. Built for the MUN community.
        </p>
      </footer>
    </div>
  );
}
