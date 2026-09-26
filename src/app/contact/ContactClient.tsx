'use client';

import { useState } from 'react';
import SiteNav from '@/components/SiteNav';
import SiteFooter from '@/components/SiteFooter';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useT, useLanguage } from '@/contexts/LanguageContext';
import { friendlyError } from '@/lib/friendlyError';

const GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23grain)' opacity='1'/%3E%3C/svg%3E")`;

const inputStyle: React.CSSProperties = {
  backgroundColor: 'rgba(221, 212, 192, 0.4)',
  border: '1px solid rgba(28, 20, 16, 0.18)',
  color: '#1C1410',
  borderRadius: '10px',
};

const labelStyle: React.CSSProperties = {
  color: '#5A5046',
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
};

const FOREST = '#1B3828';
const GOLD = '#EED98A';
const INK_SOFT = '#5A5046';

// Hover and focus states live in a stylesheet, not in mouse handlers: a keyboard
// user gets the same lift on focus-visible, and prefers-reduced-motion switches
// the motion off. Palette: forest / gold / ivory / ink only (owner).
const CONTACT_CSS = `
.gv-way{display:flex;align-items:center;gap:12px;min-height:48px;padding:6px 10px;margin-inline:-10px;border-radius:14px;
  text-decoration:none;cursor:pointer;outline:none;
  transition:transform 160ms ease-out,box-shadow 160ms ease-out,background-color 160ms ease-out}
.gv-way-disc{width:40px;height:40px;border-radius:12px;flex-shrink:0;display:flex;align-items:center;justify-content:center;
  background:rgba(27,56,40,0.08);border:1px solid rgba(27,56,40,0.14);color:${FOREST};
  transition:background-color 160ms ease-out,border-color 160ms ease-out,color 160ms ease-out}
.gv-way-label{font-size:12px;font-weight:700;letter-spacing:0.02em;color:#1C1410;margin:0;
  text-decoration:underline;text-decoration-color:transparent;text-decoration-thickness:1.5px;text-underline-offset:3px;
  transition:color 160ms ease-out,text-decoration-color 160ms ease-out}
.gv-way-desc{font-size:11px;color:${INK_SOFT};margin:1px 0 0}
.gv-way:hover,.gv-way:focus-visible{transform:translateY(-2px);background-color:rgba(250,248,243,0.7);
  box-shadow:0 2px 6px rgba(27,56,40,0.10),0 12px 26px -8px rgba(27,56,40,0.32)}
.gv-way:hover .gv-way-disc,.gv-way:focus-visible .gv-way-disc{background:${FOREST};border-color:${FOREST};color:${GOLD}}
.gv-way:hover .gv-way-label,.gv-way:focus-visible .gv-way-label{color:${FOREST};text-decoration-color:${FOREST}}
.gv-way:focus-visible{box-shadow:0 0 0 2px #FAF8F3,0 0 0 4px ${FOREST},0 12px 26px -8px rgba(27,56,40,0.32)}
.gv-btn:focus-visible{outline:2px solid ${FOREST};outline-offset:3px}
.gv-btn-inline:focus-visible{outline:2px solid ${FOREST};outline-offset:3px;border-radius:4px}
@media (prefers-reduced-motion:reduce){
  .gv-way,.gv-way-disc,.gv-way-label{transition:none}
  .gv-way:hover,.gv-way:focus-visible{transform:none}
}
`;

/** Titles and captions carry no full stop (owner). Body sentences keep theirs. */
const noStop = (s: string) => s.replace(/[.。]\s*$/, '');

export default function ContactClient() {
  const { language } = useLanguage();
  const t = useT();

  const SUBJECTS = [
    // Button labels are sentence case (CLAUDE.md §8); /contact is English-only.
    { id: 'general',    label: 'General enquiry' },
    { id: 'conference', label: 'Conference partnership' },
    { id: 'press',      label: 'Press and media' },
    { id: 'feedback',   label: 'Feedback' },
  ];

  const PLACEHOLDERS: Record<string, string> = {
    general:    t('contact_placeholder_general'),
    conference: t('contact_placeholder_conference'),
    press:      t('contact_placeholder_press'),
    feedback:   t('contact_placeholder_feedback'),
  };

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
        console.error('[contact]', res.status, body);
        setSubmitError("Couldn't send your message. Please try again.");
        setSending(false);
        return;
      }
      setSubmitted(true);
    } catch (err) {
      setSubmitError(friendlyError(err, "We couldn't reach Gavelling. Check your connection and try again."));
    } finally {
      setSending(false);
    }
  };

  return (
    // An ordinary scrolling page (25 Sep 2026). It used to be md:h-screen with
    // overflow hidden and the form column scrolling inside, which left the footer
    // clipped below the screen on every desktop; the green panel is sticky, so the
    // split still reads as one screen while the form and the footer flow past it.
    <div className="min-h-screen bg-[#EDE7D8] flex flex-col relative">

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

      <div className="relative z-10 flex flex-col flex-1">
        <style>{CONTACT_CSS}</style>
        <SiteNav />

        {/* ── Hero split ── */}
        <section className="flex flex-col md:flex-row flex-1">

          {/* Left — editorial green panel, sticky for the page's scroll */}
          <div
            className="relative flex flex-col px-10 py-12 md:px-14 md:py-14 md:sticky md:top-0 md:h-screen md:basis-[44%] md:shrink-0"
            style={{
              background: 'linear-gradient(160deg, #1B3828 0%, #142B1C 60%, #0E1E13 100%)',
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

            <div className="relative z-10 flex flex-col md:h-full md:min-h-0">
              {/* Heading */}
              <h1
                className="font-black text-white tracking-tight leading-[0.9]"
                style={{ fontSize: 'clamp(40px, 11vw, 110px)' }}
              >
                {t('contact_hero_line1')}{t('contact_hero_line2_plain') ? <><br />{t('contact_hero_line2_plain')}{' '}</> : ' '}
                <span
                  style={{
                    fontFamily: "'Playfair Display', serif",
                    fontStyle: 'italic',
                    fontWeight: 400,
                    color: '#EED98A',
                  }}
                >
                  {noStop(t('contact_hero_line2_italic'))}
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
                  {t('contact_hero_quote')}
                </p>
                <p className="text-xs mt-2" style={{ color: 'rgba(238, 217, 138, 0.2)', letterSpacing: '0.12em' }}>
                  {noStop(t('contact_hero_quote_author'))}
                </p>
              </div>
            </div>
          </div>

          {/* Right — form */}
          <div
            className="flex-1 flex flex-col justify-start px-10 py-10 md:px-14 md:pt-10 md:pb-14"
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
                  <p className="text-xs font-mono tracking-[0.2em] text-[#5A5046] mb-2 uppercase">{noStop(t('contact_success_eyebrow'))}</p>
                  <h2 className="text-3xl font-black text-[#1C1410] mb-3">The Chair Acknowledges</h2>
                  <p className="text-[#5A5046] leading-relaxed">
                    {t('contact_success_desc')}
                  </p>
                </div>

                <button
                  type="button"
                  className="gv-btn-inline"
                  onClick={() => {
                    setSubmitted(false);
                    setForm({ name: '', email: '', message: '' });
                    setSubject('general');
                  }}
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: '#1B3828',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    textDecorationColor: '#1B3828',
                    textDecorationThickness: 1.5,
                    textUnderlineOffset: 3,
                    padding: '10px 0',
                    minHeight: 44,
                  }}
                >
                  {t('contact_send_another')}
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-5 w-full">

                <div>
                  <p className="text-xs font-mono tracking-[0.2em] text-[#5A5046] mb-2 uppercase">{noStop(t('contact_heading_eyebrow'))}</p>
                  <h2 className="text-3xl font-black text-[#1C1410]">Get in Touch</h2>
                </div>

                {/* Subject pills */}
                <div className="flex flex-col gap-2.5">
                  <Label style={labelStyle}>{t('contact_label_subject')}</Label>
                  {/* Wraps, never scrolls sideways. As a nowrap row these four
                      pills measured 571px against a 295px column on a 375px
                      phone, so "Press & Media" and "Feedback" sat entirely off
                      screen behind a hairline scrollbar — two of the four
                      reasons to write to us, invisible on the device most
                      people write from. The desktop column is ~530px, so they
                      were partly hidden there too. */}
                  <div className="flex flex-row flex-wrap gap-2">
                    {SUBJECTS.map((s) => {
                      const active = subject === s.id;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          className="gv-btn"
                          aria-pressed={active}
                          onClick={() => setSubject(s.id)}
                          style={{
                            // 44px tall: a thumb-sized target on a phone.
                            padding: '7px 16px',
                            minHeight: 44,
                            borderRadius: 9999,
                            fontSize: 12.5,
                            fontWeight: active ? 800 : 700,
                            backgroundColor: active ? '#1B3828' : 'rgba(28, 20, 16, 0.07)',
                            color: active ? '#EED98A' : '#5A5046',
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
                    <Label htmlFor="contact-name" style={labelStyle}>{t('contact_label_name')}</Label>
                    <Input
                      id="contact-name"
                      placeholder={t('contact_placeholder_name')}
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      style={inputStyle}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5 flex-1">
                    <Label htmlFor="contact-email" style={labelStyle}>{t('contact_label_email')}</Label>
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
                  <Label htmlFor="contact-message" style={labelStyle}>{t('contact_label_message')}</Label>
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
                    type="button"
                    className="gv-btn"
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
                      padding: '13px 32px',
                      minHeight: 48,
                      borderRadius: 14,
                      border: 'none',
                      cursor: canSubmit && !sending ? 'pointer' : 'not-allowed',
                      opacity: canSubmit && !sending ? 1 : 0.38,
                      transition: 'all 200ms ease',
                      boxShadow: '0 4px 14px rgba(27, 56, 40, 0.18)',
                    }}
                  >
                    {sending ? t('contact_sending') : 'Yield to the chair'}
                  </button>
                  <p className="text-xs" style={{ color: '#5A5046' }}>{noStop(t('contact_reply_time'))}</p>
                </div>

                {/* Other ways to reach us — inline */}
                <div style={{ marginTop: 20, borderTop: '1px solid rgba(28, 20, 16, 0.1)', paddingTop: 20 }}>
                  <p style={{ fontSize: 10, fontFamily: 'monospace', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#5A5046', marginBottom: 8 }}>
                    {noStop(t('contact_other_ways'))}
                  </p>
                  {/* Each way is one link that LOOKS like one: on hover and focus it lifts,
                      the disc turns forest with a gold glyph and the label goes forest and
                      underlined (CONTACT_CSS). The SVGs read currentColor for that. */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>

                    {/* Email */}
                    <a href="mailto:wearegavelling@gmail.com" className="gv-way">
                      <span className="gv-way-disc" aria-hidden>
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="2" y="4" width="20" height="16" rx="2" />
                          <polyline points="2,4 12,13 22,4" />
                        </svg>
                      </span>
                      <div>
                        <p className="gv-way-label">wearegavelling@gmail.com</p>
                        <p className="gv-way-desc">{noStop(t('contact_email_desc'))}</p>
                      </div>
                    </a>

                    {/* Instagram */}
                    <a href="https://instagram.com/wearegavelling" target="_blank" rel="noopener noreferrer" className="gv-way">
                      <span className="gv-way-disc" aria-hidden>
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="2" y="2" width="20" height="20" rx="5" />
                          <circle cx="12" cy="12" r="4" />
                          <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" />
                        </svg>
                      </span>
                      <div>
                        <p className="gv-way-label">@wearegavelling</p>
                        <p className="gv-way-desc">{noStop(t('contact_instagram_desc'))}</p>
                      </div>
                    </a>

                    {/* Book a call */}
                    <a href="https://calendar.app.google/BgWXxMdKmEJE3dDq6" target="_blank" rel="noopener noreferrer" className="gv-way">
                      <span className="gv-way-disc" aria-hidden>
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="4" width="18" height="18" rx="2" />
                          <line x1="16" y1="2" x2="16" y2="6" />
                          <line x1="8" y1="2" x2="8" y2="6" />
                          <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                      </span>
                      <div>
                        <p className="gv-way-label">{noStop(t('contact_book_call'))}</p>
                        <p className="gv-way-desc">{noStop(t('contact_book_call_desc'))}</p>
                      </div>
                    </a>

                  </div>
                </div>

              </div>
            )}
          </div>
        </section>

        {/* ── Footer: the one footer (src/components/SiteFooter.tsx) ── */}
        <SiteFooter copy={t('contact_footer_copy')} />
      </div>
    </div>
  );
}
