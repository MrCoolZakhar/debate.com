'use client';

// /contact (owner, 18 Oct 2026): the top bar's Contact opens this page. One
// screen at 1280x800 and up: the contact block (who are you, the form, the
// team email, Instagram and a link to the help desk), then the founders band:
// Peter on the left, Christian on the right, a short word about Gavelling
// between them. Phones stack and scroll, compact.
// No site footer on /contact (owner, 27 Sep 2026).

import Image from 'next/image';
import SiteNav from '@/components/SiteNav';
import ContactSection from './ContactSection';

const INK = '#1C1410';
const INK_SOFT = '#5A5046';
const FOREST = '#1B3828';

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
        style={{ boxShadow: `0 0 0 3px #FFFFFF, 0 0 0 5px ${FOREST}, 0 12px 28px -12px rgba(27,56,40,0.45)`, background: '#F0EBDD' }}
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
          <Image src={founder.src} alt={founder.name} fill sizes="(min-width: 768px) 260px, 220px" style={{ objectFit: 'cover' }} />
        </div>
      </div>
      <figcaption style={{ marginTop: 10 }}>
        <span style={{ display: 'block', color: INK, fontSize: 16, fontWeight: 800, lineHeight: 1.25 }}>{founder.name}</span>
        <span style={{ display: 'block', color: INK_SOFT, fontSize: 13, lineHeight: 1.4, marginTop: 2, overflowWrap: 'anywhere' }}>{founder.role}</span>
      </figcaption>
    </figure>
  );
}

export default function ContactClient() {
  return (
    <div className="min-h-[100dvh] flex flex-col" style={{ background: '#F4EFE3' }}>
      <style>{`
        .gv-founder-circle{width:88px;height:88px}
        .gv-founders{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:18px 16px;align-items:center}
        .gv-founders-about{grid-column:1 / -1;order:3}
        @media (min-width:768px){
          .gv-founder-circle{width:104px;height:104px}
          .gv-founders{grid-template-columns:minmax(0,1fr) minmax(0,2fr) minmax(0,1fr);gap:32px}
          .gv-founders-about{grid-column:auto;order:0}
        }
      `}</style>

      <SiteNav />

      <main className="flex-1 w-full flex flex-col justify-center">
        <div
          className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-10"
          style={{ paddingTop: 'clamp(16px, 2.2vw, 28px)', paddingBottom: 'clamp(20px, 2.4vw, 32px)' }}
        >
          <ContactSection />

          <section
            aria-label="Who makes Gavelling"
            className="gv-founders"
            style={{ marginTop: 'clamp(22px, 2.6vw, 34px)', paddingTop: 'clamp(18px, 2.2vw, 26px)', borderTop: '1px solid #DDD4C0' }}
          >
            <Founder founder={FOUNDERS[0]} />
            <div className="gv-founders-about text-center">
              <p style={{ margin: '0 auto', maxWidth: 640, color: INK_SOFT, fontSize: 16, lineHeight: 1.6 }}>
                <strong style={{ color: INK, fontWeight: 800 }}>Gavelling is made by those who love MUN.</strong>{' '}
                Any chair can run a live committee session for free, with no account and nothing to install, while delegates follow along on their phones.
                Conferences list, take applications and run their committees here too, and organisers pay nothing.
              </p>
            </div>
            <Founder founder={FOUNDERS[1]} />
          </section>
        </div>
      </main>
    </div>
  );
}
