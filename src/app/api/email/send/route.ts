// POST /api/email/send — thin server-side relay into Resend.
//
// Two shapes:
//   { template: 'welcome', to, name? }         → renders the branded welcome email
//   { to, subject, html, text?, replyTo? }     → raw send (internal use)
//
// Runs on the nodejs runtime so RESEND_API_KEY stays server-side. When the
// key is missing, resend.ts no-ops with a console.warn and this returns
// { ok: true, skipped: true } so fire-and-forget callers never surface errors.

import { NextResponse } from 'next/server';
import { sendEmail, renderWelcomeEmail } from '@/lib/resend';

export const runtime = 'nodejs';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface SendBody {
  template?: 'welcome';
  to?: string;
  name?: string;
  subject?: string;
  html?: string;
  text?: string;
  replyTo?: string;
}

export async function POST(request: Request) {
  let body: SendBody;
  try {
    body = (await request.json()) as SendBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const to = (body.to || '').trim();
  if (!EMAIL_RE.test(to)) {
    return NextResponse.json({ ok: false, error: 'A valid "to" email address is required' }, { status: 400 });
  }

  if (body.template === 'welcome') {
    const { subject, html, text } = renderWelcomeEmail(body.name);
    const result = await sendEmail({ to, subject, html, text });
    return NextResponse.json(result, { status: result.ok ? 200 : 502 });
  }

  if (!body.subject || !body.html) {
    return NextResponse.json({ ok: false, error: '"subject" and "html" are required' }, { status: 400 });
  }

  const result = await sendEmail({
    to,
    subject: body.subject,
    html: body.html,
    text: body.text,
    replyTo: body.replyTo,
  });
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
