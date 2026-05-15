'use client';

import { useState } from 'react';
import SiteNav from '@/components/SiteNav';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

const AMBASSADORS = [
  // Europe
  { name: 'Kyle Wilkinson',          country: 'United Kingdom', initials: 'KW', photo: '/kyle_ambassador.png' },
  { name: 'Celine Nasser',           country: 'United Kingdom', initials: 'CN', photo: '/celine_ambassador.png' },
  { name: 'Noelia Alvarez Iglesias', country: 'Spain',          initials: 'NA', photo: '/noelia_ambassador.png' },
  { name: 'Armande Loretz',          country: 'France',         initials: 'AL', photo: '/armande_ambassador.png' },
  // South America
  { name: 'Manuela Trujillo',        country: 'Peru',           initials: 'MT', photo: '/manuela_ambassador.png' },
  { name: 'Valentina Cruz',          country: 'Peru',           initials: 'VC', photo: '/valentina_ambassador.png' },
  { name: 'Paolo Marinuzzi',         country: 'Venezuela',      initials: 'PM', photo: '/paolo_ambassador.png' },
  { name: 'Anna Cocconi',            country: 'Venezuela',      initials: 'AC', photo: '/anna_ambassador.png' },
  // Asia (west to east)
  { name: 'Farah Lahiani',           country: 'UAE',            initials: 'FH', photo: '/farah_ambassador.png' },
  { name: 'Tyler Serano',            country: 'Philippines',    initials: 'TS', photo: '' },
  { name: 'Andrew Mailoa',           country: 'Indonesia',      initials: 'AM', photo: '/andrew_ambassador.png' },
  { name: 'Charlito Gunawan',        country: 'Indonesia',      initials: 'CG', photo: '/charlito_ambassador.png' },
  { name: 'Victor',                  country: 'Hong Kong',      initials: 'VH', photo: '' },
];

const inputStyle: React.CSSProperties = {
  backgroundColor: 'rgba(221, 212, 192, 0.4)',
  border: '1px solid rgba(28, 20, 16, 0.2)',
  color: '#1C1410',
  borderRadius: '10px',
};

const FounderPhoto = ({ src, name }: { src: string; name: string }) => (
  <div style={{ width: 260, height: 260, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, border: '2px solid rgba(196, 168, 130, 0.15)' }}>
    <img
      src={src}
      alt={name}
      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', mixBlendMode: 'normal' }}
    />
  </div>
);

export default function AboutClient() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', country: '', experience: '' });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    if (!form.name || !form.email || !form.country) return;
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-[#EDE7D8] flex flex-col relative overflow-x-hidden">
      {/* Grain */}
      <div className="pointer-events-none fixed inset-0 z-0"
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23grain)' opacity='1'/%3E%3C/svg%3E")`, backgroundRepeat: 'repeat', backgroundSize: '300px 300px', mixBlendMode: 'multiply', opacity: 0.18 }} />

      <SiteNav />

      {/* Banner */}
      <section className="relative z-10 w-full flex items-end"
        style={{ height: 340, background: 'linear-gradient(135deg, #1B3828 0%, #2A5A3C 50%, #1B3828 100%)', borderBottom: '1px solid rgba(27, 56, 40, 0.3)' }}>
<div className="relative z-10 w-full text-center px-12 pb-10">
          <p className="font-black text-white tracking-tight leading-none" style={{ fontSize: 'clamp(36px, 5vw, 72px)' }}>
            made by those who{' '}
            <span style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontWeight: 400, color: '#EED98A' }}>love</span>
            {' '}MUN
          </p>
        </div>
      </section>

      {/* Founders */}
      <section className="relative z-10 py-24 px-6 max-w-6xl mx-auto w-full">
        <div className="flex flex-col md:flex-row items-center gap-16 mb-28">
          <div className="shrink-0"><FounderPhoto src="/PeterPic.jpg" name="Peter Zakhar" /></div>
          <div className="flex-1">
            <p className="text-xs font-mono tracking-[0.18em] text-[#9A8A78] mb-2 uppercase">Co-Founder</p>
            <h2 className="text-4xl font-black text-[#1C1410] mb-1">Peter Zakhar</h2>
            <p className="text-[#B6871F] text-sm font-semibold mb-6 tracking-wide">Business Development & Frontend</p>
            <p className="text-[#6A5A4A] leading-relaxed text-base">Peter is not scared of risky ideas. He listens, asks and acts immediately on any Gavelling related feedback. He is not just a figure with good ideas, but someone who has actively trained his own delegation to win over 100 awards in a single year. Ultimately, fun, adventure and creativity knows no bounds for Peter, having travelled to over 40 countries at 22.</p>
          </div>
        </div>
        <div className="flex flex-col md:flex-row-reverse items-center gap-16">
          <div className="shrink-0"><FounderPhoto src="/Christian.jpg" name="Christian Galindo" /></div>
          <div className="flex-1">
            <p className="text-xs font-mono tracking-[0.18em] text-[#9A8A78] mb-2 uppercase">Co-Founder</p>
            <h2 className="text-4xl font-black text-[#1C1410] mb-1">Christian Galindo</h2>
            <p className="text-[#B6871F] text-sm font-semibold mb-6 tracking-wide">Business Development & Backend</p>
            <p className="text-[#6A5A4A] leading-relaxed text-base">Christian is constantly looking for change and progress; having lived in 9 countries at 21 years old. He applies this same mindset to Gavelling: voicing new ideas, taking feedback, and looking for positive change. His constant journey for new challenges led him to train delegates across continents to win awards at a 90% rate in global conferences.</p>
          </div>
        </div>
      </section>

      {/* Global Ambassadors */}
      <section className="relative z-10 py-24 px-6" style={{ borderTop: '1px solid rgba(221, 212, 192, 0.8)' }}>
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-mono tracking-[0.2em] text-[#9A8A78] mb-3 uppercase">Representing the world</p>
            <h2 className="text-4xl font-black text-[#1C1410]">GLOBAL AMBASSADORS</h2>
          </div>
          <div className="grid grid-cols-5 gap-8">
            {AMBASSADORS.map((amb) => (
              <div key={amb.name} className="flex flex-col items-center gap-3">
                <div style={{ width: 120, height: 120, borderRadius: '50%', overflow: 'hidden', border: '2px solid rgba(28,20,16,0.15)', backgroundColor: 'rgba(221,212,192,0.5)', flexShrink: 0 }}>
                  {amb.photo ? (
                    <img
                      src={amb.photo}
                      alt={amb.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', display: 'block' }}
                    />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(221,212,192,0.8)', color: '#B6871F', fontWeight: 700, fontSize: 16 }}>
                      {amb.initials}
                    </div>
                  )}
                </div>
                <div className="text-center">
                  <p className="text-[#1C1410] text-xs font-bold leading-tight">{amb.name}</p>
                  <p className="text-[#9A8A78] text-[10px] mt-0.5">{amb.country}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Ambassador CTA */}
      <section className="relative z-10" style={{ borderTop: '1px solid rgba(221, 212, 192, 0.8)' }}>
        <div
          className="w-full text-center"
          style={{ background: 'linear-gradient(135deg, #1B3828 0%, #2A5A3C 100%)', padding: '64px 48px' }}
        >
          <p className="font-black text-white mb-4"
            style={{ fontSize: 'clamp(28px, 4vw, 52px)', letterSpacing: '-0.02em' }}>
            Start Gavelling with us
          </p>
          <p className="text-[#EED98A]/60 text-base max-w-xl mx-auto leading-relaxed">
            Are you chairing conferences in your country and there are no ambassadors from where you are from? Apply and get your merch package.
          </p>
          <button
            onClick={() => { setOpen(true); setSubmitted(false); }}
            className="inline-flex items-center gap-2 mt-8 px-8 py-3 rounded-full font-bold text-sm tracking-wide transition-all duration-150"
            style={{ border: '1.5px solid rgba(238, 217, 138, 0.4)', color: '#EED98A', background: 'transparent', cursor: 'pointer' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(238, 217, 138, 0.12)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
            onMouseDown={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(238, 217, 138, 0.25)'; (e.currentTarget as HTMLButtonElement).style.color = '#FFFFFF'; }}
            onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(238, 217, 138, 0.12)'; (e.currentTarget as HTMLButtonElement).style.color = '#EED98A'; }}
          >
            Apply Now →
          </button>
        </div>
      </section>

      {/* Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg"
          style={{ backgroundColor: '#FAF8F3', border: '1px solid rgba(221, 212, 192, 0.8)', borderRadius: '20px', color: '#1C1410' }}>
          <DialogHeader>
            <DialogTitle className="text-[#1C1410] text-xl font-black">
              {submitted ? 'Application received' : 'Apply to be an Ambassador'}
            </DialogTitle>
            <DialogDescription style={{ color: '#9A8A78' }}>
              {submitted ? "We'll be in touch shortly. Thank you for wanting to grow the MUN community with us." : 'Tell us a bit about yourself and your MUN journey.'}
            </DialogDescription>
          </DialogHeader>

          {submitted ? (
            <div className="py-8 text-center">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ backgroundColor: 'rgba(27, 56, 40, 0.1)', border: '1px solid rgba(27, 56, 40, 0.3)' }}>
                <span style={{ fontSize: 28, color: '#1B3828' }}>✓</span>
              </div>
              <Button onClick={() => setOpen(false)} style={{ backgroundColor: '#1B3828', color: '#EED98A', borderRadius: '12px', fontWeight: 700 }}>
                Close
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-5 pt-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="amb-name" style={{ color: '#6A5A4A', fontSize: 13, fontWeight: 600 }}>Full Name</Label>
                <Input id="amb-name" placeholder="Your name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={inputStyle} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="amb-email" style={{ color: '#6A5A4A', fontSize: 13, fontWeight: 600 }}>Email</Label>
                <Input id="amb-email" type="email" placeholder="you@example.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={inputStyle} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="amb-country" style={{ color: '#6A5A4A', fontSize: 13, fontWeight: 600 }}>Country</Label>
                <Input id="amb-country" placeholder="Where are you based?" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} style={inputStyle} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="amb-exp" style={{ color: '#6A5A4A', fontSize: 13, fontWeight: 600 }}>MUN Experience & Upcoming Conferences</Label>
                <Textarea id="amb-exp" placeholder="Tell us about your MUN background..." value={form.experience} onChange={(e) => setForm({ ...form, experience: e.target.value })} rows={4} style={{ ...inputStyle, resize: 'none' }} />
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setOpen(false)} className="flex-1"
                  style={{ borderColor: 'rgba(28, 20, 16, 0.2)', color: '#9A8A78', backgroundColor: 'transparent', borderRadius: '12px' }}>
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={!form.name || !form.email || !form.country} className="flex-1"
                  style={{ backgroundColor: '#1B3828', color: '#EED98A', borderRadius: '12px', fontWeight: 800, opacity: (!form.name || !form.email || !form.country) ? 0.45 : 1 }}>
                  Submit Application
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Footer */}
      <footer className="relative z-10 border-t border-[#DDD4C0] bg-[#EDE7D8] px-6 py-8">
        <div className="flex flex-col items-center gap-4 md:grid md:grid-cols-3 md:gap-0 md:items-center">
          <img src="/GavellingLogo.png" alt="Gavelling" className="h-7 w-auto"
            style={{ filter: 'brightness(0) saturate(100%) invert(18%) sepia(25%) saturate(800%) hue-rotate(100deg) brightness(85%)' }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          <div className="flex items-center justify-center gap-4">
            <a href="https://www.instagram.com/wearegavelling/" target="_blank" rel="noopener noreferrer"
              aria-label="Instagram"
              style={{ color: '#9A8A78', transition: 'color 0.15s' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = '#1B3828'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = '#9A8A78'; }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
              </svg>
            </a>
            <span aria-label="LinkedIn (coming soon)" style={{ color: '#C8BFB0', cursor: 'default' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/>
              </svg>
            </span>
          </div>
          <p className="text-xs text-[#9A8A78] md:text-right">© {new Date().getFullYear()} Gavelling. Built for the MUN community.</p>
        </div>
      </footer>
    </div>
  );
}
