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
  backgroundColor: 'rgba(46, 30, 15, 0.4)',
  border: '1px solid rgba(196, 168, 130, 0.2)',
  color: '#F5ECD7',
  borderRadius: '10px',
};

const PhotoPlaceholder = ({ label }: { label: string }) => (
  <div className="rounded-2xl overflow-hidden flex items-center justify-center"
    style={{ width: 280, height: 340, background: 'linear-gradient(160deg, #2E1E0F 0%, #1A1007 100%)', border: '1px solid rgba(196, 168, 130, 0.15)' }}>
    <div style={{ textAlign: 'center', opacity: 0.35 }}>
      <div style={{ width: 64, height: 64, borderRadius: '50%', border: '2px dashed #C4A882', margin: '0 auto 12px' }} />
      <p className="text-[#C4A882] text-xs font-mono tracking-widest">{label}</p>
    </div>
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
    <div className="min-h-screen bg-[#0D0906] flex flex-col relative overflow-x-hidden">
      <div className="pointer-events-none fixed inset-0 z-0"
        style={{ backgroundImage: 'url(/background-grain.png)', backgroundRepeat: 'repeat', backgroundSize: '300px 300px', mixBlendMode: 'screen', opacity: 0.07 }} />

      <SiteNav />

      {/* Banner */}
      <section className="relative z-10 w-full flex items-end"
        style={{ height: 340, background: 'linear-gradient(135deg, #1A1007 0%, #2E1E0F 50%, #1A1007 100%)', borderBottom: '1px solid rgba(46, 30, 15, 0.8)' }}>
        <div className="absolute inset-0 flex items-center justify-center flex-col gap-3" style={{ opacity: 0.25 }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', border: '2px dashed #C4A882' }} />
          <p className="text-[#C4A882] text-xs font-mono tracking-widest uppercase">Photo of Peter & Christian — coming soon</p>
        </div>
        <div className="relative z-10 w-full text-center px-12 pb-10">
          <p className="font-black text-white tracking-tight leading-none" style={{ fontSize: 'clamp(36px, 5vw, 72px)' }}>
            made by those who{' '}
            <span style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontWeight: 400, color: '#B8844A' }}>love</span>
            {' '}MUN
          </p>
        </div>
      </section>

      {/* Founders */}
      <section className="relative z-10 py-24 px-6 max-w-6xl mx-auto w-full">
        {/* Peter — photo left, text right */}
        <div className="flex flex-col md:flex-row items-center gap-16 mb-28">
          <div className="shrink-0"><PhotoPlaceholder label="PETER" /></div>
          <div className="flex-1">
            <p className="text-xs font-mono tracking-[0.18em] text-[#7A5A38] mb-2 uppercase">Co-Founder</p>
            <h2 className="text-4xl font-black text-white mb-1">Peter Zakhar</h2>
            <p className="text-[#B8844A] text-sm font-semibold mb-6 tracking-wide">Business Development & Frontend</p>
            <p className="text-[#C4A882] leading-relaxed text-base">{LOREM}</p>
          </div>
        </div>

        {/* Christian — text left, photo right */}
        <div className="flex flex-col md:flex-row-reverse items-center gap-16">
          <div className="shrink-0"><PhotoPlaceholder label="CHRISTIAN" /></div>
          <div className="flex-1">
            <p className="text-xs font-mono tracking-[0.18em] text-[#7A5A38] mb-2 uppercase">Co-Founder</p>
            <h2 className="text-4xl font-black text-white mb-1">Christian</h2>
            <p className="text-[#B8844A] text-sm font-semibold mb-6 tracking-wide">Backend Development</p>
            <p className="text-[#C4A882] leading-relaxed text-base">{LOREM}</p>
          </div>
        </div>
      </section>

      {/* Global Ambassadors */}
      <section className="relative z-10 py-24 px-6" style={{ borderTop: '1px solid rgba(46, 30, 15, 0.8)' }}>
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-mono tracking-[0.2em] text-[#7A5A38] mb-3 uppercase">Representing the world</p>
            <h2 className="text-4xl font-black text-white">Global Ambassadors</h2>
          </div>
          <div className="grid grid-cols-5 gap-8">
            {AMBASSADORS.map((amb) => (
              <div key={amb.name} className="flex flex-col items-center gap-3">
                <Avatar style={{ width: 80, height: 80, border: '2px solid rgba(196, 168, 130, 0.2)', backgroundColor: 'rgba(46, 30, 15, 0.6)' }}>
                  <AvatarImage src="" alt={amb.name} />
                  <AvatarFallback style={{ backgroundColor: 'rgba(46, 30, 15, 0.8)', color: '#B8844A', fontWeight: 700, fontSize: 14 }}>
                    {amb.initials}
                  </AvatarFallback>
                </Avatar>
                <div className="text-center">
                  <p className="text-white text-xs font-bold leading-tight">{amb.name}</p>
                  <p className="text-[#7A5A38] text-xs mt-0.5">{amb.country}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Ambassador CTA */}
      <section className="relative z-10" style={{ borderTop: '1px solid rgba(46, 30, 15, 0.8)' }}>
        <button
          onClick={() => { setOpen(true); setSubmitted(false); }}
          className="w-full group transition-all duration-300"
          style={{ background: 'linear-gradient(135deg, #2E1E0F 0%, #1A1007 100%)', padding: '64px 48px', cursor: 'pointer', textAlign: 'center', touchAction: 'manipulation' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'linear-gradient(135deg, #3D2A15 0%, #2E1E0F 100%)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'linear-gradient(135deg, #2E1E0F 0%, #1A1007 100%)'; }}
        >
          <p className="font-black text-white mb-4 group-hover:text-[#C4A882] transition-colors duration-300"
            style={{ fontSize: 'clamp(28px, 4vw, 52px)', letterSpacing: '-0.02em' }}>
            Start Gavelling with us
          </p>
          <p className="text-[#7A5A38] text-base max-w-xl mx-auto leading-relaxed">
            Are you chairing conferences in your country and there are no ambassadors from where you are from? Apply and get your merch package.
          </p>
          <div className="inline-flex items-center gap-2 mt-8 px-8 py-3 rounded-full font-bold text-sm tracking-wide"
            style={{ border: '1.5px solid rgba(196, 168, 130, 0.4)', color: '#C4A882' }}>
            Apply Now →
          </div>
        </button>
      </section>

      {/* Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg"
          style={{ backgroundColor: '#120D07', border: '1px solid rgba(46, 30, 15, 0.9)', borderRadius: '20px', color: '#F5ECD7' }}>
          <DialogHeader>
            <DialogTitle className="text-white text-xl font-black">
              {submitted ? 'Application received' : 'Apply to be an Ambassador'}
            </DialogTitle>
            <DialogDescription style={{ color: '#7A5A38' }}>
              {submitted ? "We'll be in touch shortly. Thank you for wanting to grow the MUN community with us." : 'Tell us a bit about yourself and your MUN journey.'}
            </DialogDescription>
          </DialogHeader>

          {submitted ? (
            <div className="py-8 text-center">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ backgroundColor: 'rgba(61, 107, 53, 0.2)', border: '1px solid rgba(61, 107, 53, 0.4)' }}>
                <span style={{ fontSize: 28, color: '#3D6B35' }}>✓</span>
              </div>
              <Button onClick={() => setOpen(false)} style={{ backgroundColor: '#7B4A1E', color: '#fff', borderRadius: '12px', fontWeight: 700 }}>
                Close
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-5 pt-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="amb-name" style={{ color: '#C4A882', fontSize: 13, fontWeight: 600 }}>Full Name</Label>
                <Input id="amb-name" placeholder="Your name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={inputStyle} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="amb-email" style={{ color: '#C4A882', fontSize: 13, fontWeight: 600 }}>Email</Label>
                <Input id="amb-email" type="email" placeholder="you@example.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={inputStyle} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="amb-country" style={{ color: '#C4A882', fontSize: 13, fontWeight: 600 }}>Country</Label>
                <Input id="amb-country" placeholder="Where are you based?" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} style={inputStyle} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="amb-exp" style={{ color: '#C4A882', fontSize: 13, fontWeight: 600 }}>MUN Experience & Upcoming Conferences</Label>
                <Textarea id="amb-exp" placeholder="Tell us about your MUN background and any conferences you're chairing or attending over the next year..." value={form.experience} onChange={(e) => setForm({ ...form, experience: e.target.value })} rows={4} style={{ ...inputStyle, resize: 'none' }} />
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setOpen(false)} className="flex-1"
                  style={{ borderColor: 'rgba(196, 168, 130, 0.25)', color: '#7A5A38', backgroundColor: 'transparent', borderRadius: '12px' }}>
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={!form.name || !form.email || !form.country} className="flex-1"
                  style={{ backgroundColor: '#7B4A1E', color: '#fff', borderRadius: '12px', fontWeight: 800, opacity: (!form.name || !form.email || !form.country) ? 0.45 : 1 }}>
                  Submit Application
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Footer */}
      <footer className="relative z-10 px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4"
        style={{ borderTop: '1px solid rgba(46, 30, 15, 0.8)' }}>
        <img src="/GavellingLogo.png" alt="Gavelling" className="h-8 w-auto" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        <p className="text-xs text-[#7A5A38]">© {new Date().getFullYear()} Gavelling. Built for the MUN community.</p>
      </footer>
    </div>
  );
}
