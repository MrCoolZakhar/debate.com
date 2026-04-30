'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const steps = [
  { step: '01', title: 'Create a Committee', desc: 'Chair enters committee name, topic, and delegates. Pick a preset or build custom.' },
  { step: '02', title: 'Share the Code', desc: 'Delegates join instantly with a session code from any device.' },
  { step: '03', title: 'Run the Session', desc: 'Manage roll call, speakers list, motions, and voting — all in one place.' },
];

const leftImages = [
  '/landing-left-1.jpg',
  '/landing-left-2.jpg',
  '/landing-left-3.jpg',
  '/landing-left-4.jpg',
  '/landing-left-5.jpg',
  '/landing-left-6.jpg',
];

const rightImages = [
  '/landing-right-1.jpg',
  '/landing-right-2.jpg',
  '/landing-right-3.jpg',
  '/landing-right-4.jpg',
  '/landing-right-5.jpg',
  '/landing-right-6.jpg',
];

export default function LandingPage() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState('');
  const [carouselIdx, setCarouselIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => {
      setCarouselIdx((i) => (i + 1) % leftImages.length);
    }, 3500);
    return () => clearInterval(t);
  }, []);

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

        {/* Nav — logo only */}
        <nav className="relative z-10 px-8 h-16 flex items-center shrink-0">
          <img
            src="/gavelling-logo.png"
            alt="Gavelling"
            className="w-[16vw] h-auto max-h-9 object-contain"
            style={{ filter: 'brightness(0) saturate(100%) invert(18%) sepia(25%) saturate(800%) hue-rotate(100deg) brightness(85%)' }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        </nav>

        {/* Hero — three columns */}
        <section className="relative z-10 flex-1 flex items-stretch px-4 gap-4 pb-8 min-h-[80vh]">

          {/* Left image carousel */}
          <div className="hidden lg:flex flex-col w-[22vw] shrink-0">
            <div className="flex-1 rounded-2xl border border-[#DDD4C0] overflow-hidden bg-[#EDE7D8] relative" style={{ aspectRatio: '9/16', maxHeight: '78vh' }}>
              {leftImages.map((src, i) => (
                <img
                  key={src}
                  src={src}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover transition-opacity duration-1000"
                  style={{ opacity: i === carouselIdx ? 1 : 0 }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              ))}
            </div>
            <div className="flex justify-center gap-1.5 mt-2">
              {leftImages.map((_, i) => (
                <button key={i} onClick={() => setCarouselIdx(i)}
                  className={`w-1.5 h-1.5 rounded-full transition-all ${i === carouselIdx ? 'bg-[#1B3828]' : 'bg-[#DDD4C0]'}`}
                />
              ))}
            </div>
          </div>

          {/* Center content */}
          <div className="flex-1 flex flex-col items-center justify-center py-12 px-4">
            <div className="inline-flex items-center gap-2 bg-[#EAF1EC] border border-[#DDD4C0] text-[#1B3828] text-xs font-medium px-3 py-1.5 rounded-full mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-[#3D7A52] animate-pulse shrink-0" />
              Free to use · No account needed
            </div>

            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-[#1C1410] leading-[1.1] mb-5 text-center uppercase">
              Run Your Committee<br />
              <span className="text-[#B6871F] font-black">with Confidence</span>
            </h1>

            <p className="text-[#6A5A4A] text-lg max-w-md text-center mb-12 leading-relaxed">
              Gavelling gives chairs everything they need — from roll call to final voting.
            </p>

            {/* Start committee — primary CTA */}
            <Link
              href="/create"
              className="bg-[#1B3828] hover:bg-[#2A5A3C] active:scale-[0.98] text-white px-10 py-5 rounded-2xl font-black text-xl transition-all shadow-lg shadow-[#1B3828]/20 mb-6"
            >
              Start Your Committee →
            </Link>

            {/* Join session — inline input */}
            <div className="w-full max-w-xs">
              <p className="text-xs text-[#9A8A78] text-center mb-2 font-mono tracking-wider">JOIN A SESSION</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 20))}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleJoin(); }}
                  placeholder="Session code"
                  className="flex-1 bg-[#FAF8F3] border border-[#DDD4C0] focus:border-[#1B3828] rounded-xl px-4 py-3 text-[#1C1410] placeholder-[#9A8A78] focus:outline-none text-sm font-mono tracking-widest uppercase text-center transition-colors"
                  maxLength={20}
                />
                <button
                  onClick={handleJoin}
                  disabled={joinCode.trim().length < 4}
                  className="bg-[#1B3828] hover:bg-[#2A5A3C] disabled:opacity-40 border border-[#1B3828] text-[#EED98A] px-4 py-3 rounded-xl font-bold text-sm transition-colors"
                >
                  Join →
                </button>
              </div>
            </div>
          </div>

          {/* Right image carousel */}
          <div className="hidden lg:flex flex-col w-[22vw] shrink-0">
            <div className="flex-1 rounded-2xl border border-[#DDD4C0] overflow-hidden bg-[#EDE7D8] relative" style={{ aspectRatio: '9/16', maxHeight: '78vh' }}>
              {rightImages.map((src, i) => (
                <img
                  key={src}
                  src={src}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover transition-opacity duration-1000"
                  style={{ opacity: i === carouselIdx ? 1 : 0 }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              ))}
            </div>
            <div className="flex justify-center gap-1.5 mt-2">
              {rightImages.map((_, i) => (
                <button key={i} onClick={() => setCarouselIdx(i)}
                  className={`w-1.5 h-1.5 rounded-full transition-all ${i === carouselIdx ? 'bg-[#1B3828]' : 'bg-[#DDD4C0]'}`}
                />
              ))}
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
  );
}
