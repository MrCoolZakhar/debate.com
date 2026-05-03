'use client';

import SiteNav from '@/components/SiteNav';

export default function ConferencesPage() {
  return (
    <div className="min-h-screen bg-[#EDE7D8] flex flex-col relative overflow-x-hidden">

      {/* Grain */}
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

      <SiteNav />

      {/* Main content */}
      <section className="relative z-10 flex-1 flex items-center justify-center px-8 py-20">
        <div className="flex flex-col md:flex-row items-center gap-8 max-w-5xl w-full" style={{ paddingLeft: '6vw' }}>

          {/* Otter image */}
          <div className="shrink-0 flex items-center justify-center" style={{ width: 420 }}>
            <img
              src="/WIP.png"
              alt="An otter with a half-eaten gavel — work in progress"
              style={{ width: '100%', height: 'auto', objectFit: 'contain', mixBlendMode: 'multiply' }}
            />
          </div>

          {/* Text + CTA */}
          <div className="flex flex-col items-start gap-6" style={{ maxWidth: 600 }}>
            <h1
              className="font-black text-[#1C1410] tracking-tight leading-none whitespace-nowrap"
              style={{ fontSize: 'clamp(40px, 6vw, 72px)' }}
            >
              COMING SOON
            </h1>

            <p className="text-[#6A5A4A] leading-relaxed" style={{ fontSize: '17px' }}>
              The otters are working hard to bring you MUN Conferences on Gavelling. We expect to roll out the first conferences starting in{' '}
              <span className="text-[#1C1410] font-semibold">August 2026</span>.
            </p>

            <p className="text-[#9A8A78] leading-relaxed text-sm">
              If you are a conference organiser and would like to organise your MUN conference <span className="font-bold text-[#6A5A4A]">fee-free</span> on Gavelling, book an intro call with us below.
            </p>

            <a
              href="#"
              onClick={(e) => e.preventDefault()}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.backgroundColor = '#2A5A3C';
                el.style.transform = 'translateY(-2px)';
                el.style.boxShadow = '0 8px 28px rgba(27, 56, 40, 0.35)';
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.backgroundColor = '#1B3828';
                el.style.transform = 'translateY(0)';
                el.style.boxShadow = '0 4px 16px rgba(27, 56, 40, 0.2)';
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: '#1B3828',
                color: '#EED98A',
                fontWeight: 800,
                fontSize: '15px',
                letterSpacing: '0.03em',
                padding: '14px 32px',
                borderRadius: '14px',
                textDecoration: 'none',
                transition: 'all 200ms ease',
                boxShadow: '0 4px 16px rgba(27, 56, 40, 0.2)',
                cursor: 'pointer',
              }}
            >
              Book an Intro Call →
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer
        className="relative z-10 border-t border-[#DDD4C0] bg-[#EDE7D8] px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4"
      >
        <img
          src="/GavellingLogo.png"
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
  );
}
