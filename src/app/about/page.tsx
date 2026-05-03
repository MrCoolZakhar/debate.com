'use client';

import { useState } from 'react';
import SiteNav from '@/components/SiteNav';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const AMBASSADORS = [
  { name: 'Ambassador One',      country: 'United Kingdom', initials: 'A1' },
  { name: 'Ambassador Two',      country: 'Brazil',         initials: 'A2' },
  { name: 'Ambassador Three',    country: 'Japan',          initials: 'A3' },
  { name: 'Ambassador Four',     country: 'South Africa',   initials: 'A4' },
  { name: 'Ambassador Five',     country: 'Germany',        initials: 'A5' },
  { name: 'Ambassador Six',      country: 'India',          initials: 'A6' },
  { name: 'Ambassador Seven',    country: 'Australia',      initials: 'A7' },
  { name: 'Ambassador Eight',    country: 'Canada',         initials: 'A8' },
  { name: 'Ambassador Nine',     country: 'France',         initials: 'A9' },
  { name: 'Ambassador Ten',      country: 'Argentina',      initials: 'AT' },
  { name: 'Ambassador Eleven',   country: 'Nigeria',        initials: 'AE' },
  { name: 'Ambassador Twelve',   country: 'South Korea',    initials: 'AK' },
  { name: 'Ambassador Thirteen', country: 'Mexico',         initials: 'AM' },
  { name: 'Ambassador Fourteen', country: 'Egypt',          initials: 'AF' },
  { name: 'Ambassador Fifteen',  country: 'Sweden',         initials: 'AS' },
];

const LOREM = `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.`;

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

export default function AboutPage() {
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
          <div className="shrink-0"><FounderPhoto src="/Peter.png" name="Peter Zakhar" /></div>
          <div className="flex-1">
            <p className="text-xs font-mono tracking-[0.18em] text-[#9A8A78] mb-2 uppercase">Co-Founder</p>
            <h2 className="text-4xl font-black text-[#1C1410] mb-1">Peter Zakhar</h2>
            <p className="text-[#B6871F] text-sm font-semibold mb-6 tracking-wide">Business Development & Frontend</p>
            <p className="text-[#6A5A4A] leading-relaxed text-base">{LOREM}</p>
          </div>
        </div>
        <div className="flex flex-col md:flex-row-reverse items-center gap-16">
          <div className="shrink-0"><FounderPhoto src="/Christian.png" name="Christian Galindo Haas" /></div>
          <div className="flex-1">
            <p className="text-xs font-mono tracking-[0.18em] text-[#9A8A78] mb-2 uppercase">Co-Founder</p>
            <h2 className="text-4xl font-black text-[#1C1410] mb-1">Christian Galindo Haas</h2>
            <p className="text-[#B6871F] text-sm font-semibold mb-6 tracking-wide">Backend Development & Business Dev</p>
            <p className="text-[#6A5A4A] leading-relaxed text-base">{LOREM}</p>
          </div>
        </div>
      </section>

      {/* Global Ambassadors */}
      <section className="relative z-10 py-24 px-6" style={{ borderTop: '1px solid rgba(221, 212, 192, 0.8)' }}>
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-mono tracking-[0.2em] text-[#9A8A78] mb-3 uppercase">Representing the world</p>
            <h2 className="text-4xl font-black text-[#1C1410]">Global Ambassadors</h2>
          </div>
          <div className="grid grid-cols-5 gap-8">
            {AMBASSADORS.map((amb) => (
              <div key={amb.name} className="flex flex-col items-center gap-3">
                <Avatar style={{ width: 80, height: 80, border: '2px solid rgba(28, 20, 16, 0.15)', backgroundColor: 'rgba(221, 212, 192, 0.5)' }}>
                  <AvatarImage src="" alt={amb.name} />
                  <AvatarFallback style={{ backgroundColor: 'rgba(221, 212, 192, 0.8)', color: '#B6871F', fontWeight: 700, fontSize: 14 }}>
                    {amb.initials}
                  </AvatarFallback>
                </Avatar>
                <div className="text-center">
                  <p className="text-[#1C1410] text-xs font-bold leading-tight">{amb.name}</p>
                  <p className="text-[#9A8A78] text-xs mt-0.5">{amb.country}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Ambassador CTA */}
      <section className="relative z-10" style={{ borderTop: '1px solid rgba(221, 212, 192, 0.8)' }}>
        <button
          onClick={() => { setOpen(true); setSubmitted(false); }}
          className="w-full group transition-all duration-300"
          style={{ background: 'linear-gradient(135deg, #1B3828 0%, #2A5A3C 100%)', padding: '64px 48px', cursor: 'pointer', textAlign: 'center' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'linear-gradient(135deg, #2A5A3C 0%, #1B3828 100%)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'linear-gradient(135deg, #1B3828 0%, #2A5A3C 100%)'; }}
        >
          <p className="font-black text-white mb-4 group-hover:text-[#EED98A] transition-colors duration-300"
            style={{ fontSize: 'clamp(28px, 4vw, 52px)', letterSpacing: '-0.02em' }}>
            Start Gavelling with us
          </p>
          <p className="text-[#EED98A]/60 text-base max-w-xl mx-auto leading-relaxed">
            Are you chairing conferences in your country and there are no ambassadors from where you are from? Apply and get your merch package.
          </p>
          <div className="inline-flex items-center gap-2 mt-8 px-8 py-3 rounded-full font-bold text-sm tracking-wide"
            style={{ border: '1.5px solid rgba(238, 217, 138, 0.4)', color: '#EED98A' }}>
            Apply Now →
          </div>
        </button>
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
      <footer className="relative z-10 border-t border-[#DDD4C0] bg-[#EDE7D8] px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
        <img src="/GavellingLogo.png" alt="Gavelling" className="h-7 w-auto"
          style={{ filter: 'brightness(0) saturate(100%) invert(18%) sepia(25%) saturate(800%) hue-rotate(100deg) brightness(85%)' }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        <p className="text-xs text-[#9A8A78]">© {new Date().getFullYear()} Gavelling. Built for the MUN community.</p>
      </footer>
    </div>
  );
}
