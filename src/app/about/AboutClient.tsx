'use client';

// /about: contact first, then the founders, the ambassadors on a world map and
// the ambassador application. /contact 308s here (next.config.ts, 26 Sep 2026).
// English only, like every page outside the sessions routes.

import { useState } from 'react';
import SiteNav from '@/components/SiteNav';
import SiteFooter from '@/components/SiteFooter';
import { GoldWord } from '@/components/BrandHeading';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Check } from 'lucide-react';
import ContactSection, { TEAM_EMAIL } from './ContactSection';
import AmbassadorMap from './AmbassadorMap';
import { AMBASSADORS } from './ambassadors';

const INK = '#1C1410';
const INK_SOFT = '#5A5046';
const FOREST = '#1B3828';
const SECTION_PAD = 'clamp(40px, 4vw, 64px)';
const CARD_SHADOW = '0 1px 2px rgba(27,56,40,0.08),0 10px 28px -12px rgba(27,56,40,0.30)';

const GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23grain)' opacity='1'/%3E%3C/svg%3E")`;

const FOUNDERS = [
  {
    name: 'Peter Zakhar', photo: '/PeterPic.jpg', role: 'Co-founder, business development and frontend',
    bio: 'Peter acts on feedback the day it arrives. He trained his own delegation to more than 100 awards in a single year, and had travelled to over 40 countries by 22.',
  },
  {
    name: 'Christian Galindo', photo: '/Christian.jpg', role: 'Co-founder, business development and backend',
    bio: 'Christian had lived in 9 countries by 21 and brings the same appetite for change to Gavelling. He has trained delegates across continents to win awards at a 90% rate at global conferences.',
  },
];

const COUNTRY_COUNT = new Set(AMBASSADORS.map((a) => a.country)).size;

function SectionTitle({ id, lead, gold }: { id: string; lead: string; gold: string }) {
  return (
    <h2 id={id} className="font-black tracking-tight" style={{ color: INK, fontSize: 'clamp(24px, 2.4vw, 40px)', lineHeight: 1.1, margin: 0 }}>
      {lead} <GoldWord>{gold}</GoldWord>
    </h2>
  );
}

export default function AboutClient() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', country: '', experience: '' });
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');

  // /api/ambassador writes the row and the team alert together. The thank-you
  // screen shows only when the server says it landed (owner, 26 Sep 2026: the
  // form used to thank people even when the send failed, so applications were
  // lost silently). A failure keeps the form filled and says what to do.
  const handleSubmit = async () => {
    if (!form.name || !form.email || !form.country || sending) return;
    setSending(true);
    setSendError('');
    try {
      const res = await fetch('/api/ambassador', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          country: form.country.trim(),
          experience: form.experience.trim() || null,
        }),
      });
      if (!res.ok) throw new Error(`ambassador ${res.status}`);
      setSubmitted(true);
    } catch {
      setSendError(`Your application didn't send. Check your connection and try again, or email ${TEAM_EMAIL}.`);
    } finally {
      setSending(false);
    }
  };

  const canApply = !!(form.name && form.email && form.country) && !sending;

  return (
    <div className="min-h-screen bg-[#EDE7D8] flex flex-col relative overflow-x-hidden">
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0"
        style={{ backgroundImage: GRAIN, backgroundRepeat: 'repeat', backgroundSize: '300px 300px', mixBlendMode: 'multiply', opacity: 0.18 }} />

      <SiteNav />

      <main className="relative z-10 flex-1">
        {/* (a) Contact, first */}
        <ContactSection />

        {/* (b) The founders */}
        <section aria-labelledby="founders-title" className="w-full max-w-6xl mx-auto px-4 sm:px-6" style={{ paddingTop: SECTION_PAD, paddingBottom: SECTION_PAD }}>
          <SectionTitle id="founders-title" lead="Made by People Who Love" gold="MUN" />
          <div className="grid gap-5 md:grid-cols-2" style={{ marginTop: 24 }}>
            {FOUNDERS.map((f) => (
              <article key={f.name} className="flex flex-col sm:flex-row gap-5 items-start" style={{ background: '#FFFFFF', borderRadius: 20, padding: 'clamp(18px, 2.2vw, 26px)', boxShadow: CARD_SHADOW }}>
                <div style={{ width: 112, height: 112, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, boxShadow: '0 0 0 3px #FFFFFF, 0 0 0 5px #E3C56A, 0 6px 16px -6px rgba(27,56,40,0.4)' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={f.photo} alt={f.name} loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                </div>
                <div>
                  <h3 style={{ margin: 0, color: INK, fontSize: 22, fontWeight: 800, lineHeight: 1.2 }}>{f.name}</h3>
                  <p style={{ margin: '4px 0 0', color: FOREST, fontSize: 14, fontWeight: 600 }}>{f.role}</p>
                  <p style={{ margin: '10px 0 0', color: INK_SOFT, fontSize: 15, lineHeight: 1.6 }}>{f.bio}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* (c) The ambassadors on the map */}
        <section aria-labelledby="ambassadors-title" className="w-full max-w-6xl mx-auto px-4 sm:px-6" style={{ paddingTop: SECTION_PAD, paddingBottom: SECTION_PAD }}>
          <SectionTitle id="ambassadors-title" lead="Our Ambassadors Around the" gold="World" />
          <p style={{ color: INK_SOFT, fontSize: 16, lineHeight: 1.5, margin: '10px 0 0' }}>
            <strong style={{ color: INK, fontSize: 22, fontWeight: 800 }}>{AMBASSADORS.length}</strong> ambassadors in{' '}
            <strong style={{ color: INK, fontSize: 22, fontWeight: 800 }}>{COUNTRY_COUNT}</strong> countries. Hover a face to meet them
          </p>
          <div style={{ marginTop: 20, background: '#FFFFFF', borderRadius: 24, padding: 'clamp(12px, 2.4vw, 32px)', boxShadow: CARD_SHADOW }}>
            <AmbassadorMap />
          </div>
        </section>

        {/* (d) Become an ambassador */}
        <section aria-labelledby="apply-title" className="w-full max-w-6xl mx-auto px-4 sm:px-6" style={{ paddingBottom: SECTION_PAD }}>
          <div className="flex flex-col md:flex-row md:items-center gap-5 justify-between" style={{ background: '#FFFFFF', borderRadius: 20, padding: 'clamp(20px, 2.6vw, 32px)', boxShadow: CARD_SHADOW }}>
            <div>
              <SectionTitle id="apply-title" lead="Become an" gold="Ambassador" />
              <p style={{ color: INK_SOFT, fontSize: 16, lineHeight: 1.5, margin: '8px 0 0', maxWidth: 560 }}>
                Chairing in a country we have not reached yet? Apply and we will send you a merch package
              </p>
            </div>
            <button type="button" className="gv-forest-btn shrink-0" onClick={() => { setOpen(true); setSubmitted(false); }}>
              Apply to be an ambassador
            </button>
          </div>
        </section>
      </main>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg" style={{ backgroundColor: '#FFFFFF', border: 'none', borderRadius: 20, color: INK, boxShadow: CARD_SHADOW }}>
          <DialogHeader>
            <DialogTitle style={{ color: INK, fontSize: 22, fontWeight: 900 }}>
              {submitted ? 'Application Received' : 'Apply to Be an Ambassador'}
            </DialogTitle>
            <DialogDescription style={{ color: INK_SOFT }}>
              {submitted
                ? "We'll be in touch shortly. Thank you for wanting to grow the MUN community with us."
                : 'Tell us a bit about yourself and your MUN journey.'}
            </DialogDescription>
          </DialogHeader>

          {submitted ? (
            <div className="py-6 flex flex-col items-center gap-4">
              <span className="gv-who-disc"><Check size={26} strokeWidth={2.4} aria-hidden style={{ color: FOREST }} /></span>
              <button type="button" className="gv-forest-btn" onClick={() => setOpen(false)}>Close</button>
            </div>
          ) : (
            <form className="flex flex-col gap-4 pt-2" onSubmit={(e) => { e.preventDefault(); void handleSubmit(); }}>
              <div>
                <label className="gv-label" htmlFor="amb-name">Full name</label>
                <input id="amb-name" className="gv-field" autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="gv-label" htmlFor="amb-email">Email</label>
                <input id="amb-email" className="gv-field" type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <label className="gv-label" htmlFor="amb-country">Country</label>
                <input id="amb-country" className="gv-field" autoComplete="country-name" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
              </div>
              <div>
                <label className="gv-label" htmlFor="amb-exp">Your MUN experience</label>
                <textarea id="amb-exp" className="gv-field" rows={4} style={{ resize: 'vertical' }} placeholder="Conferences you have chaired or attended"
                  value={form.experience} onChange={(e) => setForm({ ...form, experience: e.target.value })} />
              </div>
              {sendError && <p role="alert" style={{ margin: 0, color: '#8B2020', fontSize: 14, fontWeight: 600, lineHeight: 1.45 }}>{sendError}</p>}
              <div className="flex items-center gap-4 pt-1">
                <button type="submit" className="gv-forest-btn" disabled={!canApply}>{sending ? 'Sending' : 'Submit application'}</button>
                <button type="button" className="gv-inline-link" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, padding: '8px 0' }} onClick={() => setOpen(false)}>
                  Cancel
                </button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <SiteFooter />
    </div>
  );
}
