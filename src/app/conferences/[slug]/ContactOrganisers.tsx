'use client';

/**
 * "Contact the organisers", directly under the Apply button in the Apply card
 * of the public conference page (owner, 12 Oct 2026: "we get a lot of emails
 * from people that's meant for a specific conference and this should lead
 * them directly to their email").
 *
 * Leads to the conference's OWN address (`conferences.contact_email`) by
 * mailto, with a subject naming the conference, and prints the address under
 * the button with a copy key for a device without a mail app. Without a valid
 * address it falls back to the participant dashboard's "Ask the Organisers"
 * thread, but only when the caller passes `onAsk` (signed in, with an
 * application here). With neither it renders nothing. It never points at a
 * Gavelling address.
 */

import { useEffect, useRef, useState } from 'react';
import { Check, Copy, Mail, MessageCircle } from 'lucide-react';
import { Emoji3D } from '@/components/neu';

const FONT = 'var(--font-brand), sans-serif';
const INK = '#1C1410';

/** A plain, sendable address that is not ours. */
export function conferenceContactEmail(raw: string | null | undefined): string | null {
  const email = (raw ?? '').trim();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return null;
  if (/gavelling/i.test(email.split('@')[1] ?? '')) return null;
  return email;
}

const BUTTON_CSS = `
.gv-contact-btn{transition:transform 200ms cubic-bezier(.32,.72,0,1),box-shadow 200ms cubic-bezier(.32,.72,0,1)}
.gv-contact-btn:hover{transform:translateY(-2px);box-shadow:0 2px 0 rgba(255,255,255,0.9) inset,0 14px 28px rgba(0,0,0,0.28)}
.gv-contact-btn:active{transform:translateY(0) scale(0.98)}
.gv-contact-btn:focus-visible{outline:2px solid #EED98A;outline-offset:3px}
.gv-contact-copy:focus-visible{outline:2px solid #EED98A;outline-offset:2px}
@media (prefers-reduced-motion: reduce){.gv-contact-btn,.gv-contact-btn:hover,.gv-contact-btn:active{transition:none;transform:none}}
`;

const BUTTON_STYLE: React.CSSProperties = {
  minHeight: 54,
  padding: '0 18px',
  borderRadius: 14,
  border: 'none',
  backgroundColor: '#FFFFFF',
  color: INK,
  fontFamily: FONT,
  fontWeight: 700,
  fontSize: 15.5,
  textDecoration: 'none',
  cursor: 'pointer',
  boxShadow: '0 2px 0 rgba(255,255,255,0.9) inset, 0 10px 24px rgba(0,0,0,0.22)',
};

function ButtonFace({ fallbackIcon }: { fallbackIcon: typeof Mail }) {
  return (
    <>
      <Emoji3D name="E-mail" size={30} fallback={fallbackIcon} fallbackColor="#1B3828" style={{ flexShrink: 0 }} />
      <span>Contact the organisers</span>
    </>
  );
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* fall through to the textarea route */ }
  try {
    const el = document.createElement('textarea');
    el.value = text;
    el.setAttribute('readonly', '');
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}

export function ContactOrganisers({ email, conferenceName, onAsk }: {
  /** `conferences.contact_email` as stored. */
  email: string | null | undefined;
  /** The acronym (or full name) for the mail subject. */
  conferenceName: string;
  /** Opens the dashboard's "Ask the Organisers" thread. Pass it only when
   *  the viewer is signed in and has an application here. */
  onAsk?: () => void;
}) {
  const address = conferenceContactEmail(email);
  const [copied, setCopied] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timer = useRef<number | null>(null);
  const addressRef = useRef<HTMLSpanElement | null>(null);
  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  if (!address && !onAsk) return null;

  if (!address) {
    return (
      <div className="mt-5">
        <style>{BUTTON_CSS}</style>
        <button
          type="button"
          onClick={onAsk}
          className="gv-contact-btn w-full flex items-center justify-center gap-2.5 focus:outline-none"
          style={BUTTON_STYLE}
        >
          <ButtonFace fallbackIcon={MessageCircle} />
        </button>
        <p className="text-center" style={{ margin: '8px 0 0 0', fontFamily: FONT, fontSize: 12.5, lineHeight: 1.45, color: 'color-mix(in srgb, var(--gv-on-main) 78%, transparent)' }}>
          Send them a message from your dashboard
        </p>
      </div>
    );
  }

  const subject = `Question about ${conferenceName}`.trim();
  const href = `mailto:${address}?subject=${encodeURIComponent(subject)}`;

  const onCopy = async () => {
    const ok = await copyText(address);
    setCopied(ok ? 'copied' : 'failed');
    // The clipboard refused (an old browser, an embedded view): select the
    // address instead so one more press copies it by hand.
    if (!ok && addressRef.current) {
      const range = document.createRange();
      range.selectNodeContents(addressRef.current);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied('idle'), 2200);
  };

  return (
    <div className="mt-5">
      <style>{BUTTON_CSS}</style>
      <a
        href={href}
        className="gv-contact-btn w-full flex items-center justify-center gap-2.5 focus:outline-none"
        style={BUTTON_STYLE}
        aria-label={`Contact the organisers by email at ${address}`}
      >
        <ButtonFace fallbackIcon={Mail} />
      </a>
      <div className="mt-2 flex items-center justify-center gap-1">
        <span
          ref={addressRef}
          className="min-w-0 text-center [overflow-wrap:anywhere] select-all"
          style={{ fontFamily: FONT, fontSize: 12.5, lineHeight: 1.4, color: 'color-mix(in srgb, var(--gv-on-main) 82%, transparent)' }}
        >
          {address}
        </span>
        <button
          type="button"
          onClick={onCopy}
          className="gv-contact-copy flex-shrink-0 inline-flex items-center justify-center gap-1 rounded-lg focus:outline-none"
          aria-label={copied === 'copied' ? 'Email address copied' : 'Copy email address'}
          title={copied === 'copied' ? 'Copied' : 'Copy email address'}
          style={{
            minWidth: 36,
            minHeight: 36,
            padding: '0 8px',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            color: 'var(--gv-on-main)',
            fontFamily: FONT,
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          {copied === 'copied'
            ? <><Check size={15} strokeWidth={2.4} aria-hidden /><span>Copied</span></>
            : <Copy size={15} strokeWidth={2.2} aria-hidden />}
        </button>
      </div>
      <span className="sr-only" aria-live="polite">
        {copied === 'copied' ? 'Email address copied' : copied === 'failed' ? 'Could not copy. Select the address to copy it.' : ''}
      </span>
    </div>
  );
}
