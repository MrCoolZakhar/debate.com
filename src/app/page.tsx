'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

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
    <>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .hero-1 { animation: fadeUp 0.55s cubic-bezier(0.4,0,0.2,1) both 0.05s; }
        .hero-2 { animation: fadeUp 0.55s cubic-bezier(0.4,0,0.2,1) both 0.18s; }
        .hero-3 { animation: fadeUp 0.55s cubic-bezier(0.4,0,0.2,1) both 0.30s; }
        .hero-4 { animation: fadeUp 0.55s cubic-bezier(0.4,0,0.2,1) both 0.42s; }
        .hero-5 { animation: fadeUp 0.55s cubic-bezier(0.4,0,0.2,1) both 0.54s; }
        @keyframes gavelFadeIn {
          0%   { opacity: 0; transform: translateX(120px) translateY(-52%); }
          100% { opacity: 1; transform: translateX(0) translateY(-52%); }
        }
        @keyframes textReveal {
          0%   { opacity: 0; transform: translateY(28px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .text-reveal-1 { animation: textReveal 0.7s cubic-bezier(0.4,0,0.2,1) both 3.3s; }
        .text-reveal-2 { animation: textReveal 0.7s cubic-bezier(0.4,0,0.2,1) both 3.55s; }
        .text-reveal-3 { animation: textReveal 0.7s cubic-bezier(0.4,0,0.2,1) both 3.8s; }
        .text-reveal-4 { animation: textReveal 0.7s cubic-bezier(0.4,0,0.2,1) both 4.05s; }
        .text-reveal-5 { animation: textReveal 0.7s cubic-bezier(0.4,0,0.2,1) both 4.1s; }
      `}</style>

      <div className="min-h-screen bg-[#EDE7D8] flex flex-col relative overflow-x-hidden">
        <div className="relative z-10 flex flex-col min-h-screen">
          {/* Grain overlay */}
          <div
            className="pointer-events-none fixed inset-0 z-[1]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23grain)' opacity='1'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'repeat',
              backgroundSize: '300px 300px',
              mixBlendMode: 'multiply',
              opacity: 0.18,
            }}
          />

          {/* Nav */}
          <nav className="relative z-20 flex items-center justify-between px-8 md:px-14 py-5">
            {/* Logo — left */}
            <div className="flex items-center gap-3">
              <img src="/GAVELLING__1_.png" alt="Gavelling" className="w-11 h-11 object-contain" style={{ mixBlendMode: 'multiply' }} />
              <div className="flex flex-col leading-none">
                <span className="font-black text-[#1B3828] text-lg tracking-tight uppercase">Gavelling</span>
                <span className="text-[#B6871F] text-[9px] tracking-[0.18em] uppercase" style={{ fontFamily: "'DM Mono', monospace" }}>Sessions App</span>
              </div>
            </div>
            {/* Nav links — right */}
            <div className="flex items-center gap-8">
              <a href="#sessions" className="text-[#1C1410] font-medium text-sm hover:text-[#1B3828] transition-colors tracking-wide">Sessions</a>
              <a href="#about" className="text-[#1C1410] font-medium text-sm hover:text-[#1B3828] transition-colors tracking-wide">About Us</a>
            </div>
          </nav>

          {/* Hero */}
          <section className="relative z-10 h-[calc(100vh-72px)] flex flex-col items-center justify-center overflow-hidden">

            {/* VIDEO BACKGROUND */}
            <div className="absolute inset-0 z-0">
              <video
                autoPlay
                muted
                playsInline
                className="absolute inset-0 w-full h-full object-cover"
                style={{ opacity: 0.55 }}
              >
                <source src="/hero_no_audio.webm" type="video/webm" />
                <source src="/hero_no_audio.mp4" type="video/mp4" />
              </video>

              {/* Inward vignette mask — darkens edges, keeps center clear */}
              <div className="absolute inset-0" style={{
                background: 'radial-gradient(ellipse 70% 70% at 50% 50%, transparent 40%, rgba(237,231,216,0.6) 70%, rgba(237,231,216,0.95) 100%)',
              }} />

              {/* Bottom gradient — fades into green section cleanly */}
              <div className="absolute bottom-0 left-0 right-0 h-48" style={{
                background: 'linear-gradient(to bottom, transparent, #EDE7D8)',
              }} />

              {/* Left gradient — text readability */}
              <div className="absolute top-0 left-0 bottom-0 w-[55%]" style={{
                background: 'linear-gradient(to right, rgba(237,231,216,0.85) 0%, rgba(237,231,216,0.5) 60%, transparent 100%)',
              }} />

              {/* Top gradient — integrates nav with video */}
              <div className="absolute top-0 left-0 right-0 h-40" style={{
                background: 'linear-gradient(to bottom, rgba(237,231,216,0.98) 0%, rgba(237,231,216,0.7) 50%, transparent 100%)',
              }} />
            </div>

            {/* CONTENT — centered vertically, text left */}
            <div className="relative z-10 flex items-center px-8 md:px-14">
              <div className="flex flex-col justify-center items-center text-center w-full max-w-2xl mx-auto">

                {/* Eyebrow */}
                <div className="text-reveal-1 inline-flex items-center gap-2 bg-[#EAF1EC] border border-[#C8D8C0] text-[#1B3828] text-xs font-semibold px-4 py-1.5 rounded-full mb-4 w-fit tracking-wide mx-auto" style={{ opacity: 0 }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#3D7A52] animate-pulse shrink-0" />
                  Free to use · No account needed
                </div>

                {/* Title */}
                <h1 className="text-reveal-2 font-black tracking-wide text-[#1C1410] leading-[0.95] mb-4 uppercase text-center" style={{ fontSize: 'clamp(32px, 4.2vw, 64px)', opacity: 0 }}>
                  Run Your<br />
                  Committee<br />
                  <span className="text-[#B6871F]">with Confidence</span>
                </h1>

                {/* Subtitle */}
                <p className="text-reveal-3 text-lg max-w-lg mb-6 leading-relaxed font-medium text-center text-[#1B3828]" style={{
                  opacity: 0,
                  backgroundColor: 'rgba(246,241,233,0.55)',
                  backdropFilter: 'blur(4px)',
                  WebkitBackdropFilter: 'blur(4px)',
                  borderRadius: '12px',
                  padding: '10px 20px',
                }}>
                  Gavelling gives chairs everything they need —<br />from roll call to final voting.
                </p>

                {/* CTA */}
                <button
                  onClick={() => router.push('/create')}
                  className="text-reveal-4 bg-[#1B3828] hover:bg-[#2A5A3C] active:scale-[0.98] text-[#EED98A] px-10 py-5 rounded-2xl font-black text-xl transition-all shadow-lg shadow-[#1B3828]/20 mb-5 w-fit mx-auto"
                  style={{ opacity: 0 }}
                >
                  START YOUR COMMITTEE →
                </button>

                {/* Join input */}
                <div className="text-reveal-5 flex flex-col gap-2 w-fit items-center" style={{ opacity: 0 }}>
                  <p className="text-xs text-[#6A5A4A] tracking-[0.16em] uppercase font-semibold" style={{ fontFamily: "'DM Mono', monospace" }}>Join a Session</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="SESSION CODE"
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 20))}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleJoin(); }}
                      maxLength={20}
                      className="bg-[#FAF8F3]/90 border border-[#DDD4C0] focus:border-[#1B3828] rounded-xl px-4 py-3 text-[#1C1410] placeholder-[#9A8A78] focus:outline-none text-sm tracking-widest uppercase text-center transition-colors w-44 backdrop-blur-sm"
                      style={{ fontFamily: "'DM Mono', monospace" }}
                    />
                    <button
                      onClick={handleJoin}
                      disabled={joinCode.trim().length < 4}
                      className="bg-[#1B3828] hover:bg-[#2A5A3C] disabled:opacity-40 text-[#EED98A] px-5 py-3 rounded-xl font-bold text-sm transition-colors"
                    >
                      Join →
                    </button>
                  </div>
                </div>

              </div>
            </div>
          </section>

          {/* How it works */}
          <section className="relative z-10 border-t border-[#DDD4C0] bg-[#1B3828] py-20 px-6">
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-14">
                <h2 className="text-3xl font-black text-white mb-3 uppercase tracking-wide">Up and Running in Minutes</h2>
                <p className="text-[#EED98A]">No downloads, no setup. Just open your browser and start chairing.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[#B6871F]/30">
                {steps.map((s) => (
                  <div key={s.step} className="text-center px-10 py-6">
                    <div className="text-5xl font-black text-[#2A5A3C] mb-4">{s.step}</div>
                    <h3 className="text-lg font-bold text-white mb-2 uppercase tracking-wide">{s.title}</h3>
                    <p className="text-[#EED98A] opacity-70 text-sm leading-relaxed">{s.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Footer */}
          <footer className="relative z-10 border-t border-[#DDD4C0] bg-[#EDE7D8] px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <img
              src="/gavelling-logo.png"
              alt="Gavelling"
              className="h-7 w-auto"
              style={{ filter: 'brightness(0) saturate(100%) invert(18%) sepia(25%) saturate(800%) hue-rotate(100deg) brightness(85%)' }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
            <p className="text-xs text-[#9A8A78]">
              © {new Date().getFullYear()} Gavelling. Built for the MUN community.
            </p>
          </footer>
        </div>
      </div>
    </>
  );
}
