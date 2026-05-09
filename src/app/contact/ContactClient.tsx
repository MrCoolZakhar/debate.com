'use client';

import { useState } from 'react';
import SiteNav from '@/components/SiteNav';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

const SUBJECTS = [
  { id: 'general',    label: 'General Enquiry' },
  { id: 'conference', label: 'Conference Partnership' },
  { id: 'press',      label: 'Press & Media' },
  { id: 'feedback',   label: 'Feedback' },
];

const GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23grain)' opacity='1'/%3E%3C/svg%3E")`;

const PLACEHOLDERS: Record<string, string> = {
  general:    "What's on your mind? No formal placard required.",
  conference: 'Tell us about your conference — expected delegates, date, school...',
  press:      "Tell us about your publication and what you're working on...",
  feedback:   'What would make Gavelling better for you?',
};

const inputStyle: React.CSSProperties = {
  backgroundColor: 'rgba(221, 212, 192, 0.4)',
  border: '1px solid rgba(28, 20, 16, 0.18)',
  color: '#1C1410',
  borderRadius: '10px',
};

const labelStyle: React.CSSProperties = {
  color: '#6A5A4A',
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
};

export default function ContactClient() {
  const [subject, setSubject]     = useState('general');
  const [form, setForm]           = useState({ name: '', email: '', message: '' });
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending]     = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const canSubmit = form.name.trim() && form.email.trim() && form.message.trim();

  const handleSubmit = async () => {
    if (!canSubmit || sending) return;
    setSending(true);
    setSubmitError(null);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, email: form.email, message: form.message, subject }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setSubmitError(`Error ${res.status}: ${body.error ?? 'Unknown error'}`);
        setSending(false);
        return;
      }
      setSubmitted(true);
    } catch (err) {
      setSubmitError(`Network error: ${err instanceof Error ? err.message : 'Could not reach server'}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="h-screen bg-[#EDE7D8] flex flex-col relative overflow-hidden">

      {/* Grain overlay */}
      <div
        className="pointer-events-none fixed inset-0 z-[1]"
        style={{
          backgroundImage: GRAIN,
          backgroundRepeat: 'repeat',
          backgroundSize: '300px 300px',
          mixBlendMode: 'multiply',
          opacity: 0.18,
        }}
      />

      <div className="relative z-10 flex flex-col h-full">
        <SiteNav />

        {/* ── Hero split ── */}
        <section className="flex flex-col md:flex-row flex-1">

          {/* Left — editorial green panel */}
          <div
            className="relative flex flex-col px-10 py-12 md:px-14 md:py-14 md:sticky md:top-0 md:h-screen"
            style={{
              background: 'linear-gradient(160deg, #1B3828 0%, #142B1C 60%, #0E1E13 100%)',
              flexBasis: '44%',
              flexShrink: 0,
            }}
          >
            {/* Grain tint on green */}
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                backgroundImage: GRAIN,
                backgroundRepeat: 'repeat',
                backgroundSize: '300px 300px',
                mixBlendMode: 'overlay',
                opacity: 0.07,
              }}
            />

            <div className="relative z-10 flex flex-col h-full">
              {/* Heading */}
              <h1
                className="font-black text-white tracking-tight leading-[0.9]"
                style={{ fontSize: 'clamp(62px, 7.5vw, 110px)' }}
              >
                The Floor<br />
                Is{' '}
                <span
                  style={{
                    fontFamily: "'Playfair Display', serif",
                    fontStyle: 'italic',
                    fontWeight: 400,
                    color: '#EED98A',
                  }}
                >
                  Yours.
                </span>
              </h1>

              {/* Image slot — transparent WebP; no bg, contain so alpha shows green panel behind */}
              <div style={{ flex: 1, marginTop: 32, marginBottom: 24, minHeight: 180, display: 'flex', alignItems: 'center' }}>
                <img
                  src="/Contact-Hero.webp"
                  alt=""
                  style={{ width: '100%', height: 'auto', objectFit: 'contain', display: 'block' }}
                />
              </div>

              {/* Quote */}
              <div
                className="pt-6"
                style={{ borderTop: '1px solid rgba(238, 217, 138, 0.1)' }}
              >
                <p
                  style={{
                    fontFamily: "'Playfair Display', serif",
                    fontStyle: 'italic',
                    fontSize: 14,
                    color: 'rgba(238, 217, 138, 0.35)',
                    lineHeight: 1.7,
                  }}
                >
                  "Diplomacy is the art of letting someone else have your way."
                </p>
                <p className="text-xs mt-2" style={{ color: 'rgba(238, 217, 138, 0.2)', letterSpacing: '0.12em' }}>
                  — Daniele Vare
                </p>
              </div>
            </div>
          </div>

          {/* Right — form */}
          <div
            className="flex-1 flex flex-col justify-start px-10 py-10 md:px-14 md:pt-10 overflow-y-auto"
            style={{ backgroundColor: '#EDE7D8' }}
          >
            {submitted ? (
              <div className="flex flex-col items-start gap-6">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center"
                  style={{
                    backgroundColor: 'rgba(27, 56, 40, 0.1)',
                    border: '1px solid rgba(27, 56, 40, 0.25)',
                  }}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1B3828" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>

                <div>
                  <p className="text-xs font-mono tracking-[0.2em] text-[#9A8A78] mb-2 uppercase">Motion received</p>
                  <h2 className="text-3xl font-black text-[#1C1410] mb-3">The chair acknowledges.</h2>
                  <p className="text-[#6A5A4A] leading-relaxed">
                    Your message has been noted in the record. We'll be in touch within
                    48 hours — usually much sooner.
                  </p>
                </div>

                <button
                  onClick={() => {
                    setSubmitted(false);
                    setForm({ name: '', email: '', message: '' });
                    setSubject('general');
                  }}
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: '#1B3828',
                    letterSpacing: '0.05em',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    textDecorationColor: 'rgba(27, 56, 40, 0.3)',
                    textUnderlineOffset: 3,
                    padding: 0,
                  }}
                >
                  Send another message
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-5 w-full">

                <div>
                  <p className="text-xs font-mono tracking-[0.2em] text-[#9A8A78] mb-2 uppercase">Raise your motion</p>
                  <h2 className="text-3xl font-black text-[#1C1410]">GET IN TOUCH</h2>
                </div>

                {/* Subject pills */}
                <div className="flex flex-col gap-2.5">
                  <Label style={labelStyle}>Subject</Label>
                  <div className="flex flex-row flex-nowrap gap-2 overflow-x-auto">
                    {SUBJECTS.map((s) => {
                      const active = subject === s.id;
                      return (
                        <button
                          key={s.id}
                          onClick={() => setSubject(s.id)}
                          style={{
                            padding: '7px 16px',
                            borderRadius: 9999,
                            fontSize: 13,
                            fontWeight: active ? 800 : 600,
                            backgroundColor: active ? '#1B3828' : 'rgba(28, 20, 16, 0.07)',
                            color: active ? '#EED98A' : '#6A5A4A',
                            border: `1.5px solid ${active ? '#1B3828' : 'rgba(28, 20, 16, 0.14)'}`,
                            cursor: 'pointer',
                            transition: 'all 180ms ease',
                            whiteSpace: 'nowrap',
                            flexShrink: 0,
                          }}
                        >
                          {s.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Name + Email */}
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex flex-col gap-1.5 flex-1">
                    <Label htmlFor="contact-name" style={labelStyle}>Name</Label>
                    <Input
                      id="contact-name"
                      placeholder="Your name"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      style={inputStyle}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5 flex-1">
                    <Label htmlFor="contact-email" style={labelStyle}>Email</Label>
                    <Input
                      id="contact-email"
                      type="email"
                      placeholder="you@example.com"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      style={inputStyle}
                    />
                  </div>
                </div>

                {/* Message */}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="contact-message" style={labelStyle}>Message</Label>
                  <Textarea
                    id="contact-message"
                    placeholder={PLACEHOLDERS[subject]}
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    rows={4}
                    style={{ ...inputStyle, resize: 'none' }}
                  />
                </div>

                {/* Submit error */}
                {submitError && (
                  <p className="text-xs font-mono text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    {submitError}
                  </p>
                )}

                {/* Submit */}
                <div className="flex items-center gap-5">
                  <button
                    onClick={handleSubmit}
                    disabled={!canSubmit || sending}
                    onMouseEnter={(e) => {
                      if (!canSubmit) return;
                      const el = e.currentTarget as HTMLElement;
                      el.style.backgroundColor = '#2A5A3C';
                      el.style.transform = 'translateY(-2px)';
                      el.style.boxShadow = '0 8px 28px rgba(27, 56, 40, 0.32)';
                    }}
                    onMouseLeave={(e) => {
                      const el = e.currentTarget as HTMLElement;
                      el.style.backgroundColor = '#1B3828';
                      el.style.transform = 'translateY(0)';
                      el.style.boxShadow = '0 4px 14px rgba(27, 56, 40, 0.18)';
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      backgroundColor: '#1B3828',
                      color: '#EED98A',
                      fontWeight: 800,
                      fontSize: 15,
                      letterSpacing: '0.04em',
                      padding: '13px 32px',
                      borderRadius: 14,
                      border: 'none',
                      cursor: canSubmit && !sending ? 'pointer' : 'not-allowed',
                      opacity: canSubmit && !sending ? 1 : 0.38,
                      transition: 'all 200ms ease',
                      boxShadow: '0 4px 14px rgba(27, 56, 40, 0.18)',
                    }}
                  >
                    {sending ? 'Sending…' : 'YIELD TO CHAIR →'}
                  </button>
                  <p className="text-xs" style={{ color: '#9A8A78' }}>We reply within 48 hrs</p>
                </div>

                {/* Other ways to reach us — inline */}
                <div style={{ marginTop: 20, borderTop: '1px solid rgba(28, 20, 16, 0.1)', paddingTop: 20 }}>
                  <p style={{ fontSize: 10, fontFamily: 'monospace', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#9A8A78', marginBottom: 12 }}>
                    Other ways to reach us
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

                    {/* Email */}
                    <a href="mailto:wearegavelling@gmail.com" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(27, 56, 40, 0.08)', border: '1px solid rgba(27, 56, 40, 0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1B3828" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="2" y="4" width="20" height="16" rx="2" />
                          <polyline points="2,4 12,13 22,4" />
                        </svg>
                      </div>
                      <div>
                        <p style={{ fontSize: 11, fontWeight: 700, color: '#1B3828', letterSpacing: '0.02em' }}>wearegavelling@gmail.com</p>
                        <p style={{ fontSize: 11, color: '#9A8A78', marginTop: 1 }}>Drop us a line directly</p>
                      </div>
                    </a>

                    {/* Instagram */}
                    <a href="https://instagram.com/wearegavelling" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(27, 56, 40, 0.08)', border: '1px solid rgba(27, 56, 40, 0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1B3828" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="2" y="2" width="20" height="20" rx="5" />
                          <circle cx="12" cy="12" r="4" />
                          <circle cx="17.5" cy="6.5" r="0.5" fill="#1B3828" />
                        </svg>
                      </div>
                      <div>
                        <p style={{ fontSize: 11, fontWeight: 700, color: '#1B3828', letterSpacing: '0.02em' }}>@wearegavelling</p>
                        <p style={{ fontSize: 11, color: '#9A8A78', marginTop: 1 }}>Follow the debate</p>
                      </div>
                    </a>

                    {/* Book a call */}
                    <a href="https://calendly.com/wearegavelling" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(27, 56, 40, 0.08)', border: '1px solid rgba(27, 56, 40, 0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1B3828" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="4" width="18" height="18" rx="2" />
                          <line x1="16" y1="2" x2="16" y2="6" />
                          <line x1="8" y1="2" x2="8" y2="6" />
                          <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                      </div>
                      <div>
                        <p style={{ fontSize: 11, fontWeight: 700, color: '#1B3828', letterSpacing: '0.02em' }}>Book a call</p>
                        <p style={{ fontSize: 11, color: '#9A8A78', marginTop: 1 }}>30 mins, no agenda required</p>
                      </div>
                    </a>

                  </div>
                </div>

              </div>
            )}
          </div>
        </section>

        {/* ── Footer ── */}
        <footer className="relative z-10 border-t border-[#DDD4C0] bg-[#EDE7D8] px-6 py-4">
          <div className="flex flex-col items-center gap-4 md:grid md:grid-cols-3 md:gap-0 md:items-center">
            <img
              src="/GavellingLogo.png"
              alt="Gavelling"
              className="h-7 w-auto"
              style={{ filter: 'brightness(0) saturate(100%) invert(18%) sepia(25%) saturate(800%) hue-rotate(100deg) brightness(85%)' }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
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
    </div>
  );
}
