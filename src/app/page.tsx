'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const features = [
  'General Speakers List with live countdown timer',
  'Moderated & Unmoderated Caucus management',
  'Right of Reply as a fully independent overlay',
  'Roll call with Present / Present & Voting tracking',
  'Motions queue auto-sorted by procedural precedence',
  'Working Paper & Draft Resolution submission flow',
  'Delegate-side live session view on any device',
  'Voting procedure with abstention and rights support',
  'Real-time co-chair sync via Supabase',
  'Session suspend & resume with full state preservation',
];

const steps = [
  { step: '01', title: 'Create a Committee', desc: 'Chair enters committee name, topic, and delegates. Pick a preset or build custom.' },
  { step: '02', title: 'Share the Code', desc: 'Delegates join instantly with a session code from any device.' },
  { step: '03', title: 'Run the Session', desc: 'Manage roll call, speakers list, motions, and voting — all in one place.' },
];

const NAV_LINKS = [
  { label: 'HOME', href: '/' },
  { label: 'CONFERENCES', href: '/conferences' },
  { label: 'ABOUT US', href: '/about' },
  { label: 'CONTACT', href: '/contact' },
];

export default function LandingPage() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState('');
  const [hoveredNav, setHoveredNav] = useState<string | null>(null);

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

      {/* Grain overlay */}
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

      {/* ── Nav ── */}
      <nav
        className="relative z-20 flex items-center justify-between px-8 shrink-0"
        style={{
          height: '72px',
          borderBottom: '1px solid rgba(46, 30, 15, 0.8)',
          backdropFilter: 'blur(8px)',
          backgroundColor: 'rgba(13, 9, 6, 0.85)',
        }}
      >
        {/* Logo */}
        <Link href="/">
          <img
            src="/GavellingLogo.png"
            alt="Gavelling"
            className="h-10 w-auto object-contain"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        </Link>

        {/* Nav links */}
        <div className="flex items-center">
          {NAV_LINKS.map((link, i) => (
            <div key={link.label} className="flex items-center">
              {/* Divider — 70% height */}
              {i > 0 && (
                <div style={{ width: '1px', height: '28px', backgroundColor: 'rgba(196, 168, 130, 0.25)', margin: '0 2px' }} />
              )}
              <Link
                href={link.href}
                onMouseEnter={() => setHoveredNav(link.label)}
                onMouseLeave={() => setHoveredNav(null)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '8px 20px',
                  fontSize: '13px',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  color: hoveredNav === link.label ? '#C4A882' : 'rgba(196, 168, 130, 0.6)',
                  textDecoration: 'none',
                  borderRadius: '8px',
                  transition: 'all 200ms ease',
                  backgroundColor: hoveredNav === link.label ? 'rgba(196, 168, 130, 0.07)' : 'transparent',
                  transform: hoveredNav === link.label ? 'translateY(-1px)' : 'translateY(0)',
                  position: 'relative',
                }}
              >
                {link.label}
                {/* Underline slide-in effect */}
                <span
                  style={{
                    position: 'absolute',
                    bottom: '4px',
                    left: '20px',
                    right: '20px',
                    height: '1px',
                    backgroundColor: '#B8844A',
                    transform: hoveredNav === link.label ? 'scaleX(1)' : 'scaleX(0)',
                    transformOrigin: 'left',
                    transition: 'transform 200ms ease',
                  }}
                />
              </Link>
            </div>
          ))}
        </div>

        {/* Pre-register CTA */}
        <Link
          href="/pre-register"
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = '#B8844A';
            (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
            (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px rgba(184, 132, 74, 0.4)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
            (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
            (e.currentTarget as HTMLElement).style.boxShadow = 'none';
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '10px 22px',
            fontSize: '13px',
            fontWeight: 800,
            letterSpacing: '0.08em',
            color: '#C4A882',
            border: '1.5px solid rgba(196, 168, 130, 0.5)',
            borderRadius: '9999px',
            textDecoration: 'none',
            transition: 'all 200ms ease',
            backgroundColor: 'transparent',
            boxShadow: 'none',
          }}
        >
          PRE-REGISTER
        </Link>
      </nav>

      {/* ── Hero ── */}
      <section className="relative z-10 flex-1 flex items-stretch px-4 gap-4 pb-8 min-h-[80vh]">

        {/* Left image */}
        <div className="hidden lg:flex flex-col w-[22vw] shrink-0">
          <div
            className="flex-1 rounded-2xl border border-[#2E1E0F] overflow-hidden bg-[#120D07]"
            style={{ aspectRatio: '9/16', maxHeight: '78vh' }}
          >
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

        {/* Centre content */}
        <div className="flex-1 flex flex-col items-center justify-center py-12 px-4">

          <h1
            className="font-black tracking-tight text-white leading-[1.05] mb-5 text-center whitespace-nowrap"
            style={{ fontSize: 'clamp(56px, 8vw, 120px)' }}
          >
            MUN done{' '}
            <span style={{
              fontFamily: "'Playfair Display', serif",
              fontStyle: 'italic',
              fontWeight: 400,
              color: '#B8844A',
            }}>
              right.
            </span>
          </h1>

          <p className="text-[#C4A882] text-lg max-w-md text-center mb-12 leading-relaxed">
            The most user-friendly way to run your MUN committee.
          </p>

          {/* Primary CTA */}
          <Link
            href="/create"
            className="bg-[#7B4A1E] hover:bg-[#8B5A2B] active:scale-[0.98] text-white px-10 py-5 rounded-2xl font-black text-xl transition-all shadow-lg shadow-[#7B4A1E]/20 mb-6"
          >
            Start Your Committee →
          </Link>

          {/* Join session */}
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

        {/* Right image */}
        <div className="hidden lg:flex flex-col w-[22vw] shrink-0">
          <div
            className="flex-1 rounded-2xl border border-[#2E1E0F] overflow-hidden bg-[#120D07]"
            style={{ aspectRatio: '9/16', maxHeight: '78vh' }}
          >
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

      {/* ── How it works ── */}
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

      {/* ── All Free Features ── */}
      <section className="relative z-10 border-t border-[#2E1E0F] py-24 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-mono tracking-[0.2em] text-[#7A5A38] mb-3 uppercase">No paywalls. No catch.</p>
            <h2 className="text-4xl font-black text-white mb-4">All Free Features</h2>
            <p className="text-[#C4A882] max-w-md mx-auto">Everything you need to run a complete committee session, free forever.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-0">
            {features.map((feature, i) => (
              <div
                key={i}
                className="group flex items-start gap-4 py-5"
                style={{
                  borderBottom: i < features.length - 1 ? '1px solid rgba(46, 30, 15, 0.6)' : 'none',
                }}
              >
                {/* Number */}
                <span
                  className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-xs font-black"
                  style={{
                    backgroundColor: 'rgba(123, 74, 30, 0.15)',
                    color: '#B8844A',
                    border: '1px solid rgba(184, 132, 74, 0.25)',
                    fontFamily: 'monospace',
                  }}
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                {/* Text */}
                <span
                  className="text-sm leading-relaxed pt-1 transition-colors duration-200 group-hover:text-white"
                  style={{ color: '#C4A882' }}
                >
                  {feature}
                </span>
              </div>
            ))}
          </div>

          {/* Bottom nudge */}
          <div className="text-center mt-16">
            <Link
              href="/create"
              className="bg-[#7B4A1E] hover:bg-[#8B5A2B] active:scale-[0.98] text-white px-8 py-4 rounded-2xl font-black text-base transition-all shadow-lg shadow-[#7B4A1E]/20"
            >
              Start for free →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="relative z-10 border-t border-[#2E1E0F] px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
        <img
          src="/GavellingLogo.png"
          alt="Gavelling"
          className="h-8 w-auto"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
        <p className="text-xs text-[#7A5A38]">
          © {new Date().getFullYear()} Gavelling. Built for the MUN community.
        </p>
      </footer>

    </div>
  );
}
