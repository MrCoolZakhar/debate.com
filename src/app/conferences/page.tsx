'use client';

import SiteNav from '@/components/SiteNav';

export default function ConferencesPage() {
  return (
    <div className="min-h-screen bg-[#0D0906] flex flex-col relative overflow-x-hidden">

      {/* Grain */}
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

      {/* Main content */}
      <section className="relative z-10 flex-1 flex items-center justify-center px-8 py-20">
        <div className="flex flex-col md:flex-row items-center gap-16 max-w-4xl w-full">

          {/* Otter image */}
          <div className="shrink-0 flex items-center justify-center" style={{ width: 280 }}>
            <img
              src="/WIP.png"
              alt="An otter with a half-eaten gavel — work in progress"
              style={{
                width: '100%',
                height: 'auto',
                objectFit: 'contain',
                mixBlendMode: 'normal',
              }}
            />
          </div>

          {/* Text + CTA */}
          <div className="flex flex-col items-start gap-6">
            <h1
              className="font-black text-white tracking-tight leading-none"
              style={{ fontSize: 'clamp(40px, 6vw, 72px)' }}
            >
              COMING SOON
            </h1>

            <p className="text-[#C4A882] leading-relaxed" style={{ fontSize: '17px', maxWidth: 480 }}>
              The otters are working hard to bring you MUN Conferences on Gavelling. We expect to roll out the first conferences starting in{' '}
              <span className="text-white font-semibold">August 2026</span>.
            </p>

            <p className="text-[#7A5A38] leading-relaxed text-sm" style={{ maxWidth: 480 }}>
              If you are a conference organiser and would like to organise your MUN conference fee-free on Gavelling, feel free to book an intro call with us below.
            </p>

            <a
              href="#"
              onClick={(e) => e.preventDefault()}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.backgroundColor = '#8B5A2B';
                el.style.transform = 'translateY(-2px)';
                el.style.boxShadow = '0 8px 28px rgba(123, 74, 30, 0.45)';
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.backgroundColor = '#7B4A1E';
                el.style.transform = 'translateY(0)';
                el.style.boxShadow = '0 4px 16px rgba(123, 74, 30, 0.25)';
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: '#7B4A1E',
                color: '#FFFFFF',
                fontWeight: 800,
                fontSize: '15px',
                letterSpacing: '0.03em',
                padding: '14px 32px',
                borderRadius: '14px',
                textDecoration: 'none',
                transition: 'all 200ms ease',
                boxShadow: '0 4px 16px rgba(123, 74, 30, 0.25)',
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
        className="relative z-10 px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4"
        style={{ borderTop: '1px solid rgba(46, 30, 15, 0.8)' }}
      >
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
