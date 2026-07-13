// Server-side Resend wrapper — the single place the app talks to
// https://api.resend.com/emails directly (the conference outbox drains
// through the `send-emails` edge function instead; see emailDelivery.ts).
//
// Reads RESEND_API_KEY from the server environment. When the key is absent
// (local dev without secrets) every send becomes a graceful no-op with a
// console.warn, so signup and other fire-and-forget callers never break.
//
// NEVER import this from client components — the API key must not leak
// into the browser bundle. Route handlers / server actions only.

import { renderEmailHtml } from './emailHtml';
import { getSiteUrl } from './emailBlocks';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

/** Verified Resend domain (DNS: resend._domainkey.mail + send.mail subdomain). */
const DEFAULT_FROM = 'Gavelling <hello@mail.gavelling.com>';

export function getResendFrom(): string {
  return process.env.RESEND_FROM_EMAIL || DEFAULT_FROM;
}

export interface SendEmailArgs {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

export interface SendEmailResult {
  ok: boolean;
  /** Resend message id when the send succeeded. */
  id?: string;
  /** 'skipped' when RESEND_API_KEY is not configured. */
  skipped?: boolean;
  error?: string;
}

export async function sendEmail({ to, subject, html, text, replyTo }: SendEmailArgs): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[resend] RESEND_API_KEY is not set — email not sent:', subject);
    return { ok: true, skipped: true };
  }

  const payload: Record<string, unknown> = {
    from: getResendFrom(),
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
  };
  if (text) payload.text = text;
  if (replyTo) payload.reply_to = replyTo;

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error(`[resend] send failed ${res.status}:`, errText.slice(0, 500));
      return { ok: false, error: `Resend error ${res.status}` };
    }
    const data = (await res.json()) as { id?: string };
    return { ok: true, id: data.id };
  } catch (err) {
    console.error('[resend] send threw:', err);
    return { ok: false, error: String(err) };
  }
}

// ── Welcome email (new sign-ups) ───────────────────────────────────────────
// Rendered through Christian's branded email shell (emailHtml.ts) with a
// platform-level pseudo-conference so the header reads GAVELLING on forest
// with the gavel mark, and the footer carries the hello@ contact.

export function renderWelcomeEmail(name: string | null | undefined): { subject: string; html: string; text: string } {
  const siteUrl = getSiteUrl();
  const firstName = (name || '').trim().split(/\s+/)[0] || 'delegate';

  const paragraphs = [
    `Dear ${firstName},`,
    'Welcome to Gavelling, the home of Model UN conferences, committees, and your growing MUN CV.',
    'To get you started, we’ve credited 50 Gavelling Points to your account. Earn more by attending conferences and winning awards, and spend them on rewards and fee waivers.',
    'Your next step: browse upcoming conferences and apply as a delegate or chair.',
  ];

  const html = renderEmailHtml({
    blocks: [
      ...paragraphs.map((content) => ({ type: 'paragraph' as const, content })),
      { type: 'button' as const, label: 'Explore conferences', destination: 'custom' as const, url: `${siteUrl}/conferences` },
      { type: 'paragraph' as const, content: 'See you in committee,\nThe Gavelling Team' },
    ],
    conference: {
      slug: '',
      full_name: 'Gavelling',
      acronym: 'GAVELLING',
      banner_url: null,
      logo_url: `${siteUrl}/gavel-mark.png`,
      contact_email: 'hello@gavelling.com',
    },
    ctx: {},
  });

  return {
    subject: 'Welcome to Gavelling: 50 points are waiting for you',
    html,
    text: `${paragraphs.join('\n\n')}\n\nExplore conferences: ${siteUrl}/conferences\n\nSee you in committee,\nThe Gavelling Team`,
  };
}
