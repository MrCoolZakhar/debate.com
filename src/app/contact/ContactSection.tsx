'use client';

// The form side of /contact (owner, 18 Oct 2026: back to the clean layout of
// 27 Sep, no big icon tiles). A title, subject pills, name, email and message,
// Send, then the other ways to reach us (email, which copies, Instagram and a
// call) as quiet rows with small outlined glyphs, and a link to the help desk.
// It posts to /api/contact with { name, email, message, subject }; the route
// saves it and the database queues the team alert, and files it in a
// conference's inbox when the message names a conference the sender applied to.

import { useId, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import { useFitOneLine } from '@/lib/useFitOneLine';

const FOREST = '#1B3828';
const INK = '#1C1410';
const INK_SOFT = '#5A5046';
export const TEAM_EMAIL = 'wearegavelling@gmail.com';
const CALL_URL = 'https://calendar.app.google/BgWXxMdKmEJE3dDq6';

const SUBJECTS = [
  { id: 'general', label: 'General enquiry', subject: 'General enquiry', placeholder: "What's on your mind? No formal placard required" },
  { id: 'conference', label: 'My conference', subject: 'Conference partnership', placeholder: 'Tell us about your conference: its name, when it runs and what you need' },
  { id: 'session', label: 'A session or my account', subject: 'Support', placeholder: 'What happened, and which conference or session code it was' },
  { id: 'press', label: 'Press or partnerships', subject: 'Press and media', placeholder: 'Who you are and what you have in mind' },
] as const;

type SubjectId = (typeof SUBJECTS)[number]['id'];

const CONTACT_CSS = `
.gv-pill{padding:7px 14px;min-height:36px;border-radius:9999px;font-size:13px;font-weight:700;cursor:pointer;
  background:rgba(28,20,16,0.06);color:${INK_SOFT};border:1.5px solid rgba(28,20,16,0.12);
  transition:background-color 160ms ease,color 160ms ease,border-color 160ms ease}
.gv-pill:hover{border-color:rgba(27,56,40,0.4);color:${FOREST}}
.gv-pill[aria-pressed="true"]{background:${FOREST};color:#FFFFFF;border-color:${FOREST}}
.gv-pill:focus{outline:none}
.gv-pill:focus-visible{outline:2px solid ${FOREST};outline-offset:2px}
.gv-field{width:100%;border-radius:12px;border:1px solid #DDD4C0;background:#FFFFFF;color:${INK};
  font-size:14px;padding:10px 14px;font-family:inherit;transition:border-color 140ms ease,box-shadow 140ms ease}
@media (max-width:743px){.gv-field{font-size:16px}}
.gv-field:focus{outline:none;border-color:${FOREST};box-shadow:0 0 0 3px rgba(27,56,40,0.10)}
.gv-label{display:block;color:${INK};font-size:13px;font-weight:700;margin-bottom:6px}
.gv-send{display:inline-flex;align-items:center;gap:8px;min-height:48px;padding:0 24px;border:none;border-radius:11px;cursor:pointer;
  background:linear-gradient(90deg,#1B3828 0%,#2A5A3C 55%,#1E4A31 100%);color:#FFFFFF;font-size:15px;font-weight:700;
  box-shadow:0 8px 18px -8px rgba(27,56,40,0.55),inset 0 1px 0 rgba(255,255,255,0.14);transition:transform 160ms ease,filter 160ms ease}
.gv-send:hover:not(:disabled){transform:translateY(-1px);filter:brightness(1.06)}
.gv-send:active:not(:disabled){transform:scale(0.98)}
.gv-send:disabled{opacity:0.45;cursor:not-allowed}
.gv-send:focus{outline:none}
.gv-send:focus-visible{outline:2px solid ${FOREST};outline-offset:3px}
.gv-ways{display:grid;gap:4px}
@media (min-width:1100px){.gv-ways{grid-template-columns:minmax(0,1.35fr) minmax(0,1fr) minmax(0,1fr);gap:8px}}
.gv-way{display:flex;align-items:center;gap:10px;min-height:44px;padding:6px 10px;margin-inline:-10px;border-radius:14px;border:none;
  background:transparent;text-align:start;text-decoration:none;cursor:pointer;color:inherit;font:inherit;min-width:0;
  transition:transform 160ms ease-out,box-shadow 160ms ease-out,background-color 160ms ease-out}
.gv-way-disc{width:36px;height:36px;border-radius:11px;flex-shrink:0;display:flex;align-items:center;justify-content:center;
  background:rgba(27,56,40,0.08);border:1px solid rgba(27,56,40,0.14);color:${FOREST};
  transition:background-color 160ms ease-out,border-color 160ms ease-out,color 160ms ease-out}
.gv-way-label{display:block;font-size:13px;font-weight:700;color:${INK};line-height:1.3}
.gv-way-desc{display:block;font-size:11.5px;color:${INK_SOFT};line-height:1.3;margin-top:1px}
.gv-way:hover,.gv-way:focus-visible{transform:translateY(-2px);background-color:rgba(255,255,255,0.7);
  box-shadow:0 2px 6px rgba(27,56,40,0.10),0 12px 26px -8px rgba(27,56,40,0.32)}
.gv-way:hover .gv-way-disc,.gv-way:focus-visible .gv-way-disc{background:${FOREST};border-color:${FOREST};color:#FFFFFF}
.gv-way:focus{outline:none}
.gv-inline-link{color:${FOREST};font-weight:700;text-decoration:underline;text-underline-offset:3px;text-decoration-thickness:1.5px}
.gv-inline-link:focus{outline:none}
.gv-inline-link:focus-visible{outline:2px solid ${FOREST};outline-offset:3px;border-radius:4px}
@media (prefers-reduced-motion:reduce){.gv-pill,.gv-send,.gv-way,.gv-way-disc{transition:none}.gv-send:hover:not(:disabled),.gv-way:hover,.gv-way:focus-visible{transform:none}}
`;

const glyph = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };

function EmailWay() {
  const [copied, setCopied] = useState(false);
  // The address stays on one line: it shrinks a little before it would wrap.
  const addressRef = useFitOneLine<HTMLSpanElement>(TEAM_EMAIL, 13, 11);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(TEAM_EMAIL);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      window.location.href = `mailto:${TEAM_EMAIL}`;
    }
  };
  return (
    <button type="button" className="gv-way" onClick={copy} aria-label={copied ? 'Email address copied' : `Copy ${TEAM_EMAIL}`}>
      <span className="gv-way-disc">
        {copied ? <Check size={16} strokeWidth={2.4} aria-hidden /> : (
          <svg {...glyph}><rect x="2" y="4" width="20" height="16" rx="2" /><polyline points="2,4 12,13 22,4" /></svg>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span ref={addressRef} className="gv-way-label">{TEAM_EMAIL}</span>
        <span className="gv-way-desc" aria-live="polite">{copied ? 'Copied' : 'Tap to copy'}</span>
      </span>
    </button>
  );
}

export default function ContactSection() {
  const formId = useId();
  const [subjectId, setSubjectId] = useState<SubjectId>('general');
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const current = SUBJECTS.find((s) => s.id === subjectId) ?? SUBJECTS[0];
  const canSend = !!(form.name.trim() && form.email.trim() && form.message.trim()) && !sending;

  const send = async () => {
    if (!canSend) return;
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

  return (
    <section id="contact" aria-labelledby="contact-title" className="w-full flex flex-col gap-4" style={{ maxWidth: 760 }}>
      <style>{CONTACT_CSS}</style>
      <div>
        <h1 id="contact-title" className="font-black tracking-tight" style={{ color: INK, fontSize: 'clamp(28px, 2.6vw, 36px)', lineHeight: 1.1, margin: 0 }}>
          Get in Touch
        </h1>
        <p style={{ color: INK_SOFT, fontSize: 15, lineHeight: 1.5, margin: '6px 0 0' }}>
          A person on the team replies within 48 hours
        </p>
      </div>

      {sent ? (
        <div role="status" className="flex flex-col items-start gap-3" style={{ padding: '8px 0' }}>
          <span className="gv-way-disc" style={{ width: 48, height: 48, borderRadius: 14 }}><Check size={22} strokeWidth={2.5} aria-hidden /></span>
          <p style={{ margin: 0, color: INK, fontSize: 22, fontWeight: 800 }}>Message Sent</p>
          <p style={{ margin: 0, color: INK_SOFT, fontSize: 15, lineHeight: 1.5 }}>We will reply to your email within 48 hours, usually much sooner.</p>
          <button type="button" className="gv-inline-link" style={{ background: 'none', border: 'none', padding: '8px 0', cursor: 'pointer', fontSize: 15 }} onClick={() => setSent(false)}>
            Send another message
          </button>
        </div>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); void send(); }} className="flex flex-col gap-3.5" aria-label="Message">
          <div>
            <span className="gv-label" id={`${formId}-subject`}>What is it about?</span>
            <div role="group" aria-labelledby={`${formId}-subject`} className="flex flex-wrap gap-2">
              {SUBJECTS.map((s) => (
                <button key={s.id} type="button" className="gv-pill" aria-pressed={subjectId === s.id} onClick={() => setSubjectId(s.id)}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <div>
              <label className="gv-label" htmlFor={`${formId}-name`}>Name</label>
              <input id={`${formId}-name`} className="gv-field" autoComplete="name" placeholder="Your name" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="gv-label" htmlFor={`${formId}-email`}>Email</label>
              <input id={`${formId}-email`} className="gv-field" type="email" autoComplete="email" placeholder="you@example.com" value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="gv-label" htmlFor={`${formId}-message`}>Message</label>
            <textarea id={`${formId}-message`} className="gv-field" rows={3} style={{ resize: 'none', lineHeight: 1.6 }}
              placeholder={current.placeholder} value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })} />
          </div>
          {error && <p role="alert" style={{ margin: 0, color: '#8B2020', fontSize: 14, fontWeight: 600, lineHeight: 1.45 }}>{error}</p>}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <button type="submit" className="gv-send" disabled={!canSend}>
              {sending ? 'Sending' : <>Send message<ArrowRight size={17} strokeWidth={2.4} aria-hidden /></>}
            </button>
            <p style={{ margin: 0, fontSize: 14, color: INK_SOFT, lineHeight: 1.5 }}>
              Have a general question? See the <Link className="gv-inline-link" href="/help">help desk</Link>
            </p>
          </div>
        </form>
      )}

      <div style={{ borderTop: '1px solid rgba(28,20,16,0.1)', paddingTop: 12 }}>
        <p style={{ margin: '0 0 4px', color: INK, fontSize: 13, fontWeight: 800 }}>Other Ways to Reach Us</p>
        <div className="gv-ways">
          <EmailWay />
          <a className="gv-way" href="https://instagram.com/wearegavelling" target="_blank" rel="noopener noreferrer">
            <span className="gv-way-disc">
              <svg {...glyph}><rect x="2" y="2" width="20" height="20" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" /></svg>
            </span>
            <span className="min-w-0">
              <span className="gv-way-label">@wearegavelling</span>
              <span className="gv-way-desc">Follow the debate</span>
            </span>
          </a>
          <a className="gv-way" href={CALL_URL} target="_blank" rel="noopener noreferrer">
            <span className="gv-way-disc">
              <svg {...glyph}><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
            </span>
            <span className="min-w-0">
              <span className="gv-way-label">Book a call</span>
              <span className="gv-way-desc">30 minutes with the team</span>
            </span>
          </a>
        </div>
      </div>
    </section>
  );
}
