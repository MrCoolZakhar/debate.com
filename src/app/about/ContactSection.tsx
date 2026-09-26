'use client';

// Contact, at the very top of /about (/contact 308s here since 26 Sep 2026).
// "Pick who you are": three cards; choosing one opens a short form in place,
// already tagged for that topic. It posts to /api/contact with the same payload
// the old /contact form sent ({ name, email, message, subject }); the route
// saves it and the database queues the team alert, and files it in a
// conference's inbox when the message names a conference the sender applied to.

import { useId, useState } from 'react';
import { Building2, Gavel, Newspaper, Check, Copy, type LucideIcon } from 'lucide-react';
import { GoldWord } from '@/components/BrandHeading';

const FOREST = '#1B3828';
const INK = '#1C1410';
const INK_SOFT = '#5A5046';
export const TEAM_EMAIL = 'wearegavelling@gmail.com';

type TopicId = 'organiser' | 'delegate' | 'press';

const TOPICS: { id: TopicId; icon: LucideIcon; title: string; line: string; subject: string; placeholder: string }[] = [
  {
    id: 'organiser', icon: Building2,
    title: "I'm organising a conference",
    line: 'Bring your conference onto Gavelling',
    subject: 'Conference partnership',
    placeholder: 'Tell us about your conference: its name, when it runs and what you need',
  },
  {
    id: 'delegate', icon: Gavel,
    title: "I'm a delegate or chair",
    line: 'Help with your account or a session',
    subject: 'General enquiry',
    placeholder: 'What happened, and which conference or session code it was',
  },
  {
    id: 'press', icon: Newspaper,
    title: 'Press or partnerships',
    line: 'Stories and sponsorships',
    subject: 'Press and media',
    placeholder: 'Who you are and what you have in mind',
  },
];

export const CONTACT_CSS = `
.gv-who{display:flex;flex-direction:column;align-items:flex-start;gap:14px;text-align:start;width:100%;
  padding:22px;border-radius:18px;border:none;cursor:pointer;background:#FFFFFF;
  box-shadow:0 1px 2px rgba(27,56,40,0.08),0 10px 28px -12px rgba(27,56,40,0.30);
  transition:transform 180ms cubic-bezier(0.22,1,0.36,1),box-shadow 180ms ease}
.gv-who:hover{transform:translateY(-2px);box-shadow:0 2px 4px rgba(27,56,40,0.10),0 16px 34px -12px rgba(27,56,40,0.38)}
.gv-who:active{transform:scale(0.99)}
.gv-who:focus{outline:none}
.gv-who:focus-visible{box-shadow:0 0 0 2px #FFFFFF,0 0 0 4px ${FOREST},0 16px 34px -12px rgba(27,56,40,0.38)}
.gv-who[aria-expanded="true"]{box-shadow:inset 0 0 0 2px ${FOREST},0 16px 34px -12px rgba(27,56,40,0.38)}
.gv-who-disc{width:52px;height:52px;border-radius:50%;display:flex;align-items:center;justify-content:center;
  background:rgba(191,219,199,0.55)}
.gv-reveal{display:grid;grid-template-rows:0fr;transition:grid-template-rows 280ms cubic-bezier(0.22,1,0.36,1)}
.gv-reveal[data-open="true"]{grid-template-rows:1fr}
.gv-reveal>div{overflow:hidden;min-height:0}
.gv-field{width:100%;border-radius:12px;border:1.5px solid rgba(28,20,16,0.16);background:#FFFFFF;color:${INK};
  font-size:16px;padding:12px 14px;font-family:inherit;transition:border-color 140ms ease,box-shadow 140ms ease}
.gv-field:focus{outline:none;border-color:${FOREST};box-shadow:0 0 0 3px rgba(27,56,40,0.14)}
.gv-label{display:block;color:${INK};font-size:14px;font-weight:700;margin-bottom:6px}
.gv-forest-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:48px;padding:0 22px;
  border-radius:10px;border:none;cursor:pointer;background:linear-gradient(90deg,#1B3828 0%,#2A5A3C 55%,#1E4A31 100%);
  color:#FFFFFF;font-size:15px;font-weight:700;box-shadow:0 2px 10px rgba(27,56,40,0.18);
  transition:filter 140ms ease,transform 160ms cubic-bezier(0.22,1,0.36,1)}
.gv-forest-btn:hover:not(:disabled){filter:brightness(1.12);transform:translateY(-1px)}
.gv-forest-btn:active:not(:disabled){transform:scale(0.98)}
.gv-forest-btn:disabled{opacity:0.45;cursor:default}
.gv-forest-btn:focus{outline:none}
.gv-forest-btn:focus-visible{outline:2px solid ${FOREST};outline-offset:3px}
.gv-rim{width:44px;height:44px;border-radius:50%;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;
  border:none;cursor:pointer;color:${FOREST};background:linear-gradient(180deg,#FFFFFF 0%,#EFEADC 100%);
  box-shadow:inset 0 1px 0 #FFFFFF,0 0 0 1px rgba(27,56,40,0.14),0 2px 6px rgba(27,56,40,0.14);
  transition:transform 140ms ease,box-shadow 140ms ease}
.gv-rim:hover{transform:translateY(-1px);box-shadow:inset 0 1px 0 #FFFFFF,0 0 0 1px rgba(27,56,40,0.2),0 4px 10px rgba(27,56,40,0.18)}
.gv-rim:active{transform:scale(0.96)}
.gv-rim:focus{outline:none}
.gv-rim:focus-visible{outline:2px solid ${FOREST};outline-offset:3px}
.gv-inline-link{color:${FOREST};font-weight:700;text-decoration:underline;text-underline-offset:3px;text-decoration-thickness:1.5px}
.gv-inline-link:focus{outline:none}
.gv-inline-link:focus-visible{outline:2px solid ${FOREST};outline-offset:3px;border-radius:4px}
@media (prefers-reduced-motion:reduce){.gv-who,.gv-reveal,.gv-forest-btn,.gv-rim{transition:none}.gv-who:hover,.gv-rim:hover{transform:none}}
`;

function DuoIcon({ icon: Icon, size = 26 }: { icon: LucideIcon; size?: number }) {
  return <Icon size={size} strokeWidth={1.7} fill="rgba(238,217,138,0.8)" style={{ color: FOREST }} aria-hidden />;
}

export default function ContactSection() {
  const formId = useId();
  const [topic, setTopic] = useState<TopicId | null>(null);
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [copied, setCopied] = useState(false);

  const current = TOPICS.find((t) => t.id === topic) ?? null;
  const canSend = !!(form.name.trim() && form.email.trim() && form.message.trim()) && !sending;

  const send = async () => {
    if (!current || !canSend) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          message: form.message.trim(),
          subject: current.subject,
        }),
      });
      if (!res.ok) throw new Error(`contact ${res.status}`);
      setSent(true);
      setForm({ name: '', email: '', message: '' });
    } catch {
      setError(`Your message didn't send. Check your connection and try again, or email ${TEAM_EMAIL}.`);
    } finally {
      setSending(false);
    }
  };

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(TEAM_EMAIL);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked: the address is selectable text right beside the button.
    }
  };

  return (
    <section id="contact" aria-labelledby="contact-title" className="relative z-10 w-full max-w-6xl mx-auto px-4 sm:px-6"
      style={{ paddingTop: 'clamp(40px, 4vw, 64px)', paddingBottom: 'clamp(32px, 3vw, 48px)' }}>
      <style>{CONTACT_CSS}</style>
      <p style={{ margin: 0, color: INK_SOFT, fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>About and contact</p>
      <h1 id="contact-title" className="font-black tracking-tight" style={{ color: INK, fontSize: 'clamp(32px, 4vw, 52px)', lineHeight: 1.05, margin: '8px 0 0' }}>
        Talk to <GoldWord>Us</GoldWord>
      </h1>
      <p style={{ color: INK_SOFT, fontSize: 17, lineHeight: 1.5, margin: '12px 0 0', maxWidth: 560 }}>
        Pick who you are and a person on the team will reply
      </p>

      <div role="group" aria-label="Who are you?" className="grid gap-4 md:grid-cols-3" style={{ marginTop: 28 }}>
        {TOPICS.map((t) => (
          <button
            key={t.id}
            type="button"
            className="gv-who"
            aria-expanded={topic === t.id}
            aria-controls={formId}
            onClick={() => { setTopic((cur) => (cur === t.id ? null : t.id)); setSent(false); setError(null); }}
          >
            <span className="gv-who-disc"><DuoIcon icon={t.icon} /></span>
            <span>
              <span style={{ display: 'block', color: INK, fontSize: 18, fontWeight: 800, lineHeight: 1.25 }}>{t.title}</span>
              <span style={{ display: 'block', color: INK_SOFT, fontSize: 14.5, lineHeight: 1.45, marginTop: 4 }}>{t.line}</span>
            </span>
          </button>
        ))}
      </div>

      <div id={formId} className="gv-reveal" data-open={!!current} aria-hidden={!current} inert={!current ? true : undefined}>
        <div>
          <div style={{ marginTop: 16, background: '#FFFFFF', borderRadius: 18, padding: 'clamp(18px, 2.4vw, 28px)', boxShadow: '0 1px 2px rgba(27,56,40,0.08),0 10px 28px -12px rgba(27,56,40,0.30)' }}>
            {sent ? (
              <div role="status" className="flex flex-col items-start gap-3">
                <span className="gv-who-disc"><Check size={24} strokeWidth={2.4} style={{ color: FOREST }} aria-hidden /></span>
                <p style={{ margin: 0, color: INK, fontSize: 20, fontWeight: 800 }}>Message sent</p>
                <p style={{ margin: 0, color: INK_SOFT, fontSize: 15, lineHeight: 1.5 }}>A person on the team will reply to your email within 48 hours.</p>
                <button type="button" className="gv-inline-link" style={{ background: 'none', border: 'none', padding: '8px 0', cursor: 'pointer', fontSize: 15 }} onClick={() => setSent(false)}>
                  Send another message
                </button>
              </div>
            ) : (
              <form
                onSubmit={(e) => { e.preventDefault(); void send(); }}
                className="grid gap-4"
                aria-label={current ? `Message: ${current.title}` : 'Message'}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="gv-label" htmlFor={`${formId}-name`}>Your name</label>
                    <input id={`${formId}-name`} className="gv-field" autoComplete="name" value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </div>
                  <div>
                    <label className="gv-label" htmlFor={`${formId}-email`}>Email</label>
                    <input id={`${formId}-email`} className="gv-field" type="email" autoComplete="email" value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label className="gv-label" htmlFor={`${formId}-message`}>Message</label>
                  <textarea id={`${formId}-message`} className="gv-field" rows={5} style={{ resize: 'vertical' }}
                    placeholder={current?.placeholder} value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })} />
                </div>
                {error && <p role="alert" style={{ margin: 0, color: '#8B2020', fontSize: 14, fontWeight: 600, lineHeight: 1.45 }}>{error}</p>}
                <div>
                  <button type="submit" className="gv-forest-btn" disabled={!canSend}>
                    {sending ? 'Sending' : 'Send message'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-8 gap-y-4" style={{ marginTop: 24 }}>
        <div className="flex items-center gap-3">
          <span style={{ color: INK_SOFT, fontSize: 14 }}>Or email</span>
          <span style={{ color: INK, fontSize: 16, fontWeight: 700, userSelect: 'all', overflowWrap: 'anywhere' }}>{TEAM_EMAIL}</span>
          <button type="button" className="gv-rim" onClick={copyEmail} aria-label={copied ? 'Email address copied' : 'Copy the email address'} title={copied ? 'Copied' : 'Copy'}>
            {copied ? <Check size={18} strokeWidth={2.4} aria-hidden /> : <Copy size={17} strokeWidth={2} aria-hidden />}
          </button>
          <span aria-live="polite" style={{ color: FOREST, fontSize: 13, fontWeight: 700, minWidth: 48 }}>{copied ? 'Copied' : ''}</span>
        </div>
        <div className="flex items-center gap-2" style={{ fontSize: 15, color: INK_SOFT }}>
          <span>Instagram</span>
          <a className="gv-inline-link" href="https://instagram.com/wearegavelling" target="_blank" rel="noopener noreferrer">@wearegavelling</a>
        </div>
      </div>
    </section>
  );
}
