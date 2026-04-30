'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';

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
              <a href="#about" className="text-[#1C1410] font-medium text-sm hover:text-[#1B3828] transition-colors tracking-wide">About Us</a>
              <a href="#sessions" className="text-[#1C1410] font-medium text-sm hover:text-[#1B3828] transition-colors tracking-wide">Sessions</a>
            </div>
          </nav>

          {/* Hero — two columns */}
          <section className="relative z-10 flex items-center min-h-[88vh] px-8 md:px-14 gap-8 pb-24">

            {/* LEFT — text column */}
            <div className="flex-1 flex flex-col justify-center max-w-2xl">

              {/* Eyebrow */}
              <div className="hero-1 inline-flex items-center gap-2 bg-[#EAF1EC] border border-[#C8D8C0] text-[#1B3828] text-xs font-semibold px-4 py-1.5 rounded-full mb-8 w-fit tracking-wide">
                <span className="w-1.5 h-1.5 rounded-full bg-[#3D7A52] animate-pulse shrink-0" />
                Free to use · No account needed
              </div>

              {/* Title */}
              <h1 className="hero-2 font-black tracking-tight text-[#1C1410] leading-[0.92] mb-6 uppercase"
                  style={{ fontSize: 'clamp(48px, 6vw, 88px)' }}>
                Run Your<br />
                Committee<br />
                <span className="text-[#B6871F]">with Confidence</span>
              </h1>

              {/* Subtitle */}
              <p className="hero-3 text-[#6A5A4A] text-lg max-w-md mb-10 leading-relaxed">
                Gavelling gives chairs everything they need — from roll call to final voting.
              </p>

              {/* CTA */}
              <button
                onClick={() => router.push('/create')}
                className="hero-4 bg-[#1B3828] hover:bg-[#2A5A3C] active:scale-[0.98] text-[#EED98A] px-10 py-5 rounded-2xl font-black text-xl transition-all shadow-lg shadow-[#1B3828]/20 mb-8 w-fit">
                Start Your Committee →
              </button>

              {/* Join input */}
              <div className="hero-5 flex flex-col gap-2 w-fit mt-6">
                <p className="text-xs text-[#9A8A78] tracking-[0.16em] uppercase" style={{ fontFamily: "'DM Mono', monospace" }}>Join a Session</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="SESSION CODE"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 20))}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleJoin(); }}
                    maxLength={20}
                    className="bg-[#FAF8F3] border border-[#DDD4C0] focus:border-[#1B3828] rounded-xl px-4 py-3 text-[#1C1410] placeholder-[#9A8A78] focus:outline-none text-sm tracking-widest uppercase text-center transition-colors w-44"
                    style={{ fontFamily: "'DM Mono', monospace" }}
                  />
                  <button
                    onClick={handleJoin}
                    disabled={joinCode.trim().length < 4}
                    className="bg-[#1B3828] hover:bg-[#2A5A3C] disabled:opacity-40 text-[#EED98A] px-5 py-3 rounded-xl font-bold text-sm transition-colors">
                    Join →
                  </button>
                </div>
              </div>
            </div>

            {/* RIGHT — gavel + animated SVG leaves */}
            <div className="flex-1 flex items-center justify-center relative">

              {/* Gavel PNG — fades and pops in first */}
              <motion.img
                src="/GAVELLING__1_.png"
                alt="Gavelling gavel"
                initial={{ opacity: 0, scale: 0.7, rotate: -30 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                transition={{ duration: 0.9, ease: [0.34, 1.56, 0.64, 1], delay: 0.2 }}
                className="w-[620px] h-[620px] md:w-[720px] md:h-[720px] object-contain select-none absolute"
                style={{
                  mixBlendMode: 'multiply',
                  filter: 'drop-shadow(0 24px 64px rgba(27,56,40,0.12))',
                  transform: 'rotate(-22deg) translateX(60px) translateY(20px)',
                }}
                draggable={false}
              />

              {/* SVG olive wreath — leaves draw in after gavel appears */}
              <motion.svg
                viewBox="0 0 300 300"
                className="absolute w-[380px] h-[380px] md:w-[440px] md:h-[440px]"
                style={{ transform: 'translateX(30px) translateY(10px)' }}
                initial="hidden"
                animate="visible"
              >
                {/* Left branch */}
                <motion.path
                  d="M150,220 Q100,200 70,170 Q45,140 40,110 Q38,85 50,70"
                  stroke="#3D7A52"
                  strokeWidth="3"
                  fill="none"
                  variants={{
                    hidden: { pathLength: 0, opacity: 0 },
                    visible: { pathLength: 1, opacity: 1, transition: { duration: 1.4, ease: 'easeInOut', delay: 1.0 } }
                  }}
                />
                <motion.path
                  d="M80,160 Q60,145 55,125"
                  stroke="#3D7A52" strokeWidth="8" strokeLinecap="round" fill="none"
                  variants={{ hidden: { pathLength: 0, opacity: 0 }, visible: { pathLength: 1, opacity: 1, transition: { duration: 0.5, delay: 1.1 } } }}
                />
                <motion.path
                  d="M65,140 Q48,122 47,102"
                  stroke="#3D7A52" strokeWidth="8" strokeLinecap="round" fill="none"
                  variants={{ hidden: { pathLength: 0, opacity: 0 }, visible: { pathLength: 1, opacity: 1, transition: { duration: 0.5, delay: 1.25 } } }}
                />
                <motion.path
                  d="M58,115 Q50,95 56,76"
                  stroke="#3D7A52" strokeWidth="7" strokeLinecap="round" fill="none"
                  variants={{ hidden: { pathLength: 0, opacity: 0 }, visible: { pathLength: 1, opacity: 1, transition: { duration: 0.5, delay: 1.4 } } }}
                />
                <motion.path
                  d="M100,185 Q78,175 72,155"
                  stroke="#3D7A52" strokeWidth="8" strokeLinecap="round" fill="none"
                  variants={{ hidden: { pathLength: 0, opacity: 0 }, visible: { pathLength: 1, opacity: 1, transition: { duration: 0.5, delay: 1.0 } } }}
                />
                <motion.path
                  d="M120,200 Q100,195 92,178"
                  stroke="#3D7A52" strokeWidth="8" strokeLinecap="round" fill="none"
                  variants={{ hidden: { pathLength: 0, opacity: 0 }, visible: { pathLength: 1, opacity: 1, transition: { duration: 0.5, delay: 0.95 } } }}
                />

                {/* Right branch */}
                <motion.path
                  d="M150,220 Q200,200 230,170 Q255,140 260,110 Q262,85 250,70"
                  stroke="#3D7A52"
                  strokeWidth="3"
                  fill="none"
                  variants={{
                    hidden: { pathLength: 0, opacity: 0 },
                    visible: { pathLength: 1, opacity: 1, transition: { duration: 1.4, ease: 'easeInOut', delay: 1.0 } }
                  }}
                />
                <motion.path
                  d="M220,160 Q240,145 245,125"
                  stroke="#3D7A52" strokeWidth="8" strokeLinecap="round" fill="none"
                  variants={{ hidden: { pathLength: 0, opacity: 0 }, visible: { pathLength: 1, opacity: 1, transition: { duration: 0.5, delay: 1.1 } } }}
                />
                <motion.path
                  d="M235,140 Q252,122 253,102"
                  stroke="#3D7A52" strokeWidth="8" strokeLinecap="round" fill="none"
                  variants={{ hidden: { pathLength: 0, opacity: 0 }, visible: { pathLength: 1, opacity: 1, transition: { duration: 0.5, delay: 1.25 } } }}
                />
                <motion.path
                  d="M242,115 Q250,95 244,76"
                  stroke="#3D7A52" strokeWidth="7" strokeLinecap="round" fill="none"
                  variants={{ hidden: { pathLength: 0, opacity: 0 }, visible: { pathLength: 1, opacity: 1, transition: { duration: 0.5, delay: 1.4 } } }}
                />
                <motion.path
                  d="M200,185 Q222,175 228,155"
                  stroke="#3D7A52" strokeWidth="8" strokeLinecap="round" fill="none"
                  variants={{ hidden: { pathLength: 0, opacity: 0 }, visible: { pathLength: 1, opacity: 1, transition: { duration: 0.5, delay: 1.0 } } }}
                />
                <motion.path
                  d="M180,200 Q200,195 208,178"
                  stroke="#3D7A52" strokeWidth="8" strokeLinecap="round" fill="none"
                  variants={{ hidden: { pathLength: 0, opacity: 0 }, visible: { pathLength: 1, opacity: 1, transition: { duration: 0.5, delay: 0.95 } } }}
                />

                {/* Bottom stem where branches meet */}
                <motion.path
                  d="M135,225 Q150,235 165,225"
                  stroke="#3D7A52" strokeWidth="4" fill="none"
                  variants={{ hidden: { pathLength: 0, opacity: 0 }, visible: { pathLength: 1, opacity: 1, transition: { duration: 0.4, delay: 0.9 } } }}
                />
              </motion.svg>

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
