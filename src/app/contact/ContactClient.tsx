'use client';

// /contact (owner, 18 Oct 2026): the top bar's Contact opens this page. Back to
// the clean split the owner liked (27 Sep 2026): the green editorial panel on
// the left (the heading, the hero picture, and the founders: Peter on the
// left, Christian on the right, a short word about Gavelling between them),
// the form on the right with the other ways to reach us and a link to the help
// desk. One screen from md (no page scroll at 1280x800 and up); phones stack.
// No site footer on /contact (owner, 27 Sep 2026).

import Image from 'next/image';
import SiteNav from '@/components/SiteNav';
import ContactSection from './ContactSection';

const GOLD = '#EED98A';

const GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23grain)' opacity='1'/%3E%3C/svg%3E")`;

// The photos are full scenes inside a round frame (the same pictures /about
// shows); `face` is where the face sits in the 800px source, as fractions, so
// the circle can zoom in on it.
const FOUNDERS = [
  { name: 'Peter Zakhar', role: 'Co-Founder, Business Development & Frontend', src: '/PeterPic.png', face: { x: 0.6375, y: 0.35 } },
  { name: 'Christian Galindo', role: 'Co-Founder, Business Development & Backend', src: '/Christian.png', face: { x: 0.6, y: 0.375 } },
] as const;

const ZOOM = 2.4;

function Founder({ founder }: { founder: (typeof FOUNDERS)[number] }) {
  const pct = ZOOM * 100;
  return (
    <figure className="flex flex-col items-center text-center" style={{ margin: 0 }}>
      <div
        className="gv-founder-circle relative overflow-hidden rounded-full"
        style={{ boxShadow: `0 0 0 2px ${GOLD}, 0 10px 24px -10px rgba(0,0,0,0.6)`, background: '#F0EBDD' }}
      >
        <div
          className="absolute"
          style={{
            width: `${pct}%`,
            height: `${pct}%`,
            left: `${50 - founder.face.x * pct}%`,
            top: `${50 - founder.face.y * pct}%`,
          }}
        >
          <Image src={founder.src} alt={founder.name} fill sizes="(min-width: 768px) 220px, 180px" style={{ objectFit: 'cover' }} />
        </div>
      </div>
      <figcaption style={{ marginTop: 8 }}>
        <span style={{ display: 'block', color: '#FFFFFF', fontSize: 14, fontWeight: 800, lineHeight: 1.25 }}>{founder.name}</span>
        <span style={{ display: 'block', color: 'rgba(238,217,138,0.7)', fontSize: 11.5, lineHeight: 1.35, marginTop: 2, overflowWrap: 'anywhere' }}>{founder.role}</span>
      </figcaption>
    </figure>
  );
}

export default function ContactClient() {
  return (
    <div className="min-h-screen md:h-[100svh] md:min-h-0 md:overflow-hidden bg-[#EDE7D8] flex flex-col">
      <style>{`
        .gv-founder-circle{width:76px;height:76px}
        .gv-founders{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.6fr) minmax(0,1fr);gap:14px;align-items:center}
        @media (min-width:1280px){.gv-founder-circle{width:92px;height:92px}}
        /* Gavin stays at every width (prompt 141): the picture is cropped, never
           hidden, so the green panel never shows an empty band. Stacked on a
           phone it is a shorter band above the form. */
        .gv-contact-hero{display:flex;flex:0 0 auto;height:clamp(150px,36vw,220px);margin:14px 0;overflow:hidden;border-radius:16px}
        @media (min-width:768px){.gv-contact-hero{flex:1 1 0;height:auto;min-height:90px}}
      `}</style>

      <SiteNav />

      <section className="flex flex-col md:flex-row flex-1 md:min-h-0">
        {/* Left: the green editorial panel */}
        <div
          className="relative flex flex-col px-6 py-8 sm:px-10 md:px-10 lg:px-12 md:py-7 md:min-h-0 md:basis-[44%] md:shrink-0"
          style={{ background: 'linear-gradient(160deg, #1B3828 0%, #142B1C 60%, #0E1E13 100%)' }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{ backgroundImage: GRAIN, backgroundRepeat: 'repeat', backgroundSize: '300px 300px', mixBlendMode: 'overlay', opacity: 0.07 }}
          />
          <div className="relative z-10 flex flex-col flex-1 md:min-h-0">
            <p className="m-0 font-black text-white tracking-tight leading-[0.92]" style={{ fontSize: 'clamp(38px, min(6.4vw, 10svh), 88px)' }}>
              The Floor Is{' '}
              <span style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontWeight: 400, color: GOLD }}>Yours</span>
            </p>

            {/* The picture takes whatever room is left, cropped round Gavin and the desk. */}
            <div className="gv-contact-hero">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/Contact-Hero.webp" alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', display: 'block' }} />
            </div>

            <section
              aria-label="Who makes Gavelling"
              className="gv-founders mt-6 md:mt-auto"
              style={{ paddingTop: 16, borderTop: '1px solid rgba(238,217,138,0.16)' }}
            >
              <Founder founder={FOUNDERS[0]} />
              <p className="m-0 text-center" style={{ color: 'rgba(250,246,234,0.78)', fontSize: 13, lineHeight: 1.55 }}>
                <strong style={{ color: GOLD, fontWeight: 800 }}>Gavelling is made by those who love MUN.</strong>{' '}
                Any chair can run a live session for free, with no account, while delegates follow on their phones.
                Conferences run here too, and organisers pay nothing.
              </p>
              <Founder founder={FOUNDERS[1]} />
            </section>
          </div>
        </div>

        {/* Right: the form */}
        <div className="flex-1 flex flex-col justify-center px-6 py-8 sm:px-10 lg:px-12 md:py-5 md:min-h-0">
          <ContactSection />
        </div>
      </section>
    </div>
  );
}
