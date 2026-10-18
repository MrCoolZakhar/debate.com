'use client';

/**
 * The organisers' email, directly under the roles in the Apply card of the
 * public conference page (owner, 12 Oct 2026: "we get a lot of emails from
 * people that's meant for a specific conference and this should lead them
 * directly to their email").
 *
 * 18 Oct 2026 (owner: the "Contact the organiser" button was "weird"): no
 * button. A white card per address: the 3D email picture with "Contact" small
 * beneath it, the address beside it. A press anywhere on the card copies the
 * address and slides "Email copied" up from the bottom of the screen
 * (`BottomToast.tsx`; the page mounts the one host). Only the conference's OWN
 * address (`conferences.contact_email`); several separated by commas or spaces
 * each get their own card. With no valid address it renders nothing (the old
 * fallback to the dashboard's Ask the Organisers thread is gone from here). It
 * never points at a Gavelling address.
 */

import { Mail } from 'lucide-react';
import { Emoji3D } from '@/components/neu';
import { showBottomToast } from './BottomToast';

const FONT = 'var(--font-brand), sans-serif';
const INK = '#1C1410';

/** A plain, sendable address that is not ours. */
export function conferenceContactEmail(raw: string | null | undefined): string | null {
  const email = (raw ?? '').trim();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return null;
  if (/gavelling/i.test(email.split('@')[1] ?? '')) return null;
  return email;
}

/** Every valid address in the stored field (one, or several separated by
 *  commas, semicolons or spaces), each once. */
export function conferenceContactEmails(raw: string | null | undefined): string[] {
  const out: string[] = [];
  for (const part of (raw ?? '').split(/[,;\s]+/)) {
    const email = conferenceContactEmail(part);
    if (email && !out.some(e => e.toLowerCase() === email.toLowerCase())) out.push(email);
  }
  return out;
}

export async function copyText(text: string): Promise<boolean> {
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

/** Copies the address and says so at the bottom of the screen. When the
 *  clipboard refuses (an old browser, an embedded view) the address on screen
 *  is selected instead so one more press copies it by hand. */
export async function copyEmailWithToast(address: string, select?: HTMLElement | null) {
  const ok = await copyText(address);
  if (ok) {
    showBottomToast('Email copied');
    return;
  }
  if (select) {
    const range = document.createRange();
    range.selectNodeContents(select);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }
  showBottomToast('Select the email to copy it');
}

const CARD_CSS = `
.gv-contact-card{transition:transform 200ms cubic-bezier(.32,.72,0,1),box-shadow 200ms cubic-bezier(.32,.72,0,1)}
.gv-contact-card:hover{transform:translateY(-1px);box-shadow:0 2px 0 rgba(255,255,255,0.9) inset,0 10px 20px rgba(0,0,0,0.24)}
.gv-contact-card:active{transform:scale(0.98)}
.gv-contact-card:focus-visible{outline:2px solid #EED98A;outline-offset:3px}
@media (prefers-reduced-motion: reduce){.gv-contact-card,.gv-contact-card:hover,.gv-contact-card:active{transition:none;transform:none}}
`;

function ContactEmailCard({ address }: { address: string }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        const node = (e.currentTarget as HTMLElement).querySelector<HTMLElement>('[data-contact-address]');
        void copyEmailWithToast(address, node);
      }}
      className="gv-contact-card w-full flex items-center gap-3 text-left rounded-[12px] focus:outline-none"
      aria-label={`Copy the organisers' email, ${address}`}
      title="Copy email address"
      style={{
        minHeight: 60,
        padding: '8px 14px 8px 10px',
        border: 'none',
        backgroundColor: '#FFFFFF',
        boxShadow: '0 2px 0 rgba(255,255,255,0.9) inset, 0 4px 12px rgba(0,0,0,0.18)',
        cursor: 'pointer',
      }}
    >
      <span className="shrink-0 flex flex-col items-center" style={{ minWidth: 48 }}>
        <Emoji3D name="E-mail" size={28} fallback={Mail} fallbackColor="#1B3828" />
        <span style={{ fontFamily: FONT, fontSize: 10.5, fontWeight: 600, lineHeight: 1.2, color: '#5A4A3C', marginTop: 2 }}>
          Contact
        </span>
      </span>
      <span
        data-contact-address
        className="flex-1 min-w-0 [overflow-wrap:anywhere]"
        style={{ fontFamily: FONT, fontSize: 14.5, fontWeight: 700, lineHeight: 1.3, color: INK }}
      >
        {address}
      </span>
    </button>
  );
}

export function ContactOrganisers({ email }: {
  /** `conferences.contact_email` as stored. */
  email: string | null | undefined;
}) {
  const addresses = conferenceContactEmails(email);
  if (addresses.length === 0) return null;
  return (
    <div className="mt-4 flex flex-col gap-2">
      <style>{CARD_CSS}</style>
      {addresses.map(a => <ContactEmailCard key={a} address={a} />)}
    </div>
  );
}
