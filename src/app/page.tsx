'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

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
    <div
      className="min-h-screen flex flex-col overflow-x-hidden"
      style={{ backgroundColor: '#EDEAE4', fontFamily: "'Montserrat', sans-serif" }}
    >
      {/* Nav */}
      <nav className="relative z-20 flex items-center justify-between px-10 py-5" style={{ borderBottom: '1px solid rgba(0, 0, 0, 0.12)' }}>
        <img
          src="/GavellingLogo.png"
          alt="Gavelling Sessions App"
          className="h-16 w-auto object-contain"
        />
        <div className="flex items-center gap-12">
          {['Conferences', 'About Us', 'Contact'].map((item) => (
            <span
              key={item}
              className="text-[#2C2C2C] font-semibold text-lg cursor-pointer hover:text-[#1B4D2E] transition-colors"
              style={{ fontFamily: 'system-ui, sans-serif', fontWeight: 600, letterSpacing: '0.01em' }}
            >
              {item}
            </span>
          ))}
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 flex flex-1 items-stretch min-h-[calc(100vh-88px)]">

        {/* Left — text + CTAs */}
        <div className="flex flex-col justify-center pl-10 pr-6 w-[48%] shrink-0 pb-16 pt-8">
          <h1
            className="leading-none mb-10 uppercase"
            style={{
              fontFamily: "'Montserrat', sans-serif",
              fontWeight: 900,
              fontSize: 'clamp(72px, 9vw, 118px)',
              color: '#1B4D2E',
              textShadow: '0 0 80px rgba(27, 77, 46, 0.25), 0 0 160px rgba(27, 77, 46, 0.12)',
              letterSpacing: '-0.02em',
            }}
          >
            A NEW<br />
            WAY TO<br />
            DO <span style={{ textDecoration: 'underline', textDecorationColor: '#000000', textUnderlineOffset: '6px', textDecorationThickness: '6px' }}>MUN</span>
          </h1>

          {/* Primary CTA */}
          <Link
            href="/create"
            className="flex items-center justify-center mb-4"
            style={{
              backgroundColor: '#1B4D2E',
              color: '#FFFFFF',
              fontFamily: "'Montserrat', sans-serif",
              fontWeight: 900,
              fontSize: '18px',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              borderRadius: '9999px',
              padding: '20px 40px',
              width: 'fit-content',
              minWidth: '360px',
              boxShadow: '0 0 32px rgba(27, 77, 46, 0.35), 0 4px 16px rgba(27, 77, 46, 0.2)',
              textDecoration: 'none',
              transition: 'box-shadow 0.2s, background-color 0.2s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = '#163D24';
              (e.currentTarget as HTMLElement).style.boxShadow = '0 0 48px rgba(27, 77, 46, 0.5), 0 4px 20px rgba(27, 77, 46, 0.3)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = '#1B4D2E';
              (e.currentTarget as HTMLElement).style.boxShadow = '0 0 32px rgba(27, 77, 46, 0.35), 0 4px 16px rgba(27, 77, 46, 0.2)';
            }}
          >
            START YOUR COMMITTEE
          </Link>

          {/* Join row */}
          <div className="flex items-center gap-3" style={{ minWidth: '360px' }}>
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 20))}
              onKeyDown={(e) => { if (e.key === 'Enter') handleJoin(); }}
              placeholder="Enter Code"
              className="flex-1"
              maxLength={20}
              style={{
                backgroundColor: '#2C2C2C',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '9999px',
                padding: '18px 28px',
                fontSize: '16px',
                fontFamily: "'Montserrat', sans-serif",
                fontWeight: 700,
                outline: 'none',
                letterSpacing: '0.03em',
              }}
            />
            <button
              onClick={handleJoin}
              disabled={joinCode.trim().length < 4}
              style={{
                backgroundColor: '#4A4A4A',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '9999px',
                padding: '18px 32px',
                fontSize: '16px',
                fontFamily: "'Montserrat', sans-serif",
                fontWeight: 800,
                cursor: joinCode.trim().length < 4 ? 'not-allowed' : 'pointer',
                opacity: joinCode.trim().length < 4 ? 0.5 : 1,
                letterSpacing: '0.03em',
                transition: 'background-color 0.2s',
              }}
            >
              Join
            </button>
          </div>
        </div>

        {/* Right — video */}
        <div className="flex-1 relative overflow-hidden" style={{ backgroundColor: '#000000' }}>
          <video
            autoPlay
            muted
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
            style={{ objectPosition: 'center center' }}
            onEnded={(e) => {
              const video = e.currentTarget;
              video.currentTime = video.duration - 0.001;
              video.pause();
            }}
          >
            <source src="/hero-video.mp4" type="video/mp4" />
          </video>
        </div>

      </section>
    </div>
  );
}
