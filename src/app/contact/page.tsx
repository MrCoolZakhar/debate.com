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

export default function ContactPage() {
  const [subject, setSubject]     = useState('general');
  const [form, setForm]           = useState({ name: '', email: '', message: '' });
  const [submitted, setSubmitted] = useState(false);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  const canSubmit = form.name.trim() && form.email.trim() && form.message.trim();

  return (
    <div className="min-h-screen bg-[#EDE7D8] flex flex-col relative overflow-x-hidden">

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

      <div className="relative z-10 flex flex-col min-h-screen">
        <SiteNav />

        {/* ── Hero split ── */}
        <section className="flex flex-col md:flex-row flex-1">

          {/* Left — editorial green panel */}
          <div
            className="relative flex flex-col justify-between px-10 py-16 md:px-14 md:py-20 md:sticky md:top-0 md:h-screen"
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

            <div className="relative z-10 flex flex-col h-full justify-between">
              <div>
                {/* Eyebrow */}
                <p
                  className="font-mono tracking-[0.22em] uppercase mb-8"
                  style={{ fontSize: 11, color: 'rgba(238, 217, 138, 0.45)' }}
                >
                  The chair recognizes you
                </p>

                {/* Heading */}
                <h1
                  className="font-black text-white tracking-tight leading-[0.9] mb-8"
                  style={{ fontSize: 'clamp(48px, 5.5vw, 84px)' }}
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

                {/* Subtext */}
                <p
                  className="leading-relaxed mb-12"
                  style={{ fontSize: 16, color: 'rgba(245, 240, 232, 0.58)', maxWidth: 360 }}
                >
                  Whether you're scaling a conference, chairing your first committee,
                  or covering MUN for a story — we read every message.
                </p>

                {/* Reasons */}
                <div className="flex flex-col gap-6">
                  {[
                    { label: 'Conference Organisers', sub: 'Host your MUN fee-free on Gavelling' },
                    { label: 'Delegates & Chairs',    sub: 'Questions, ideas, or just saying hi' },
                    { label: 'Press & Partnerships',  sub: 'Press kit available on request' },
                  ].map((item) => (
                    <div key={item.label} className="flex items-start gap-4">
                      <div
                        className="shrink-0"
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          backgroundColor: '#EED98A',
                          marginTop: 7,
                        }}
                      />
                      <div>
                        <p className="font-bold text-white text-sm leading-snug">{item.label}</p>
                        <p className="text-xs mt-0.5" style={{ color: 'rgba(238, 217, 138, 0.45)' }}>{item.sub}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quote */}
              <div
                className="mt-16 pt-8"
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
            className="flex-1 flex flex-col justify-center px-10 py-16 md:px-14 md:py-20"
            style={{ backgroundColor: '#EDE7D8' }}
          >
            {submitted ? (
              <div className="flex flex-col items-start gap-6 max-w-lg">
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
              <div className="flex flex-col gap-8 max-w-lg w-full">

                <div>
                  <p className="text-xs font-mono tracking-[0.2em] text-[#9A8A78] mb-2 uppercase">Raise your motion</p>
                  <h2 className="text-3xl font-black text-[#1C1410]">Get in touch</h2>
                </div>

                {/* Subject pills */}
                <div className="flex flex-col gap-2.5">
                  <Label style={labelStyle}>Subject</Label>
                  <div className="flex flex-wrap gap-2">
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
                    rows={6}
                    style={{ ...inputStyle, resize: 'none' }}
                  />
                </div>

                {/* Submit */}
                <div className="flex items-center gap-5">
                  <button
                    onClick={() => canSubmit && setSubmitted(true)}
                    disabled={!canSubmit}
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
                      cursor: canSubmit ? 'pointer' : 'not-allowed',
                      opacity: canSubmit ? 1 : 0.38,
                      transition: 'all 200ms ease',
                      boxShadow: '0 4px 14px rgba(27, 56, 40, 0.18)',
                    }}
                  >
                    Yield to Chair →
                  </button>
                  <p className="text-xs" style={{ color: '#9A8A78' }}>We reply within 48 hrs</p>
                </div>

              </div>
            )}
          </div>
        </section>

        {/* ── Other ways to reach us ── */}
        <section
          className="relative z-10 border-t"
          style={{ borderColor: '#DDD4C0', backgroundColor: '#E6DFCF' }}
        >
          <div className="max-w-6xl mx-auto px-8 py-16">
            <p className="text-xs font-mono tracking-[0.2em] text-[#9A8A78] mb-10 uppercase text-center">
              Other ways to reach us
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {[
                {
                  id:      'email',
                  eyebrow: 'Direct Line',
                  heading: 'hello@gavelling.com',
                  body:    'For everything else — drop us a line directly.',
                  cta:     'Open in Mail',
                  href:    'mailto:hello@gavelling.com',
                },
                {
                  id:      'call',
                  eyebrow: 'Conference Organisers',
                  heading: 'Book an intro call',
                  body:    "Run your MUN conference on Gavelling, completely fee-free. Let's talk.",
                  cta:     'Book a 30-min call →',
                  href:    '#',
                },
                {
                  id:      'social',
                  eyebrow: 'Follow the Debate',
                  heading: '@gavelling',
                  body:    'Updates, MUN tips, and the occasional gavel meme. Come find us.',
                  cta:     'Find us online →',
                  href:    '#',
                },
              ].map((channel) => {
                const hl = hoveredCard === channel.id;
                return (
                  <a
                    key={channel.id}
                    href={channel.href}
                    onClick={channel.href === '#' ? (e) => e.preventDefault() : undefined}
                    onMouseEnter={() => setHoveredCard(channel.id)}
                    onMouseLeave={() => setHoveredCard(null)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                      padding: '26px 26px 22px',
                      borderRadius: 18,
                      backgroundColor: hl ? '#EDE7D8' : 'rgba(255, 255, 255, 0.42)',
                      border: `1px solid ${hl ? 'rgba(27, 56, 40, 0.18)' : 'rgba(221, 212, 192, 0.9)'}`,
                      textDecoration: 'none',
                      transition: 'all 220ms ease',
                      transform: hl ? 'translateY(-3px)' : 'translateY(0)',
                      boxShadow: hl
                        ? '0 8px 28px rgba(28, 20, 16, 0.09)'
                        : '0 2px 8px rgba(28, 20, 16, 0.04)',
                      cursor: 'pointer',
                    }}
                  >
                    <p
                      className="font-mono tracking-[0.16em] uppercase"
                      style={{ fontSize: 10, color: '#9A8A78' }}
                    >
                      {channel.eyebrow}
                    </p>
                    <p className="font-black text-[#1C1410] leading-tight" style={{ fontSize: 17 }}>
                      {channel.heading}
                    </p>
                    <p className="text-sm leading-relaxed" style={{ color: '#6A5A4A', flex: 1 }}>
                      {channel.body}
                    </p>
                    <p className="text-sm font-bold" style={{ color: '#1B3828', marginTop: 6 }}>
                      {channel.cta}
                    </p>
                  </a>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── Footer ── */}
        <footer className="relative z-10 border-t border-[#DDD4C0] bg-[#EDE7D8] px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <img
            src="/GavellingLogo.png"
            alt="Gavelling"
            className="h-7 w-auto"
            style={{ filter: 'brightness(0) saturate(100%) invert(18%) sepia(25%) saturate(800%) hue-rotate(100deg) brightness(85%)' }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          <p className="text-xs text-[#9A8A78]">© {new Date().getFullYear()} Gavelling. Built for the MUN community.</p>
        </footer>
      </div>
    </div>
  );
}
