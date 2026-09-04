/**
 * One-click unsubscribe. NO SESSION REQUIRED — that is the entire point.
 *
 * The List-Unsubscribe header used to point at /account/profile, which is
 * behind a login. So the header existed and did nothing useful: an imported
 * delegate who never made an account had no way to stop us, and Gmail's
 * bulk-sender rules want a URL that unsubscribes on its own.
 *
 * ONE route handler, not a page plus an API endpoint, because there is one URL
 * in the header and it has to answer two very different callers.
 *
 * ── A GET MUST NEVER UNSUBSCRIBE ANYONE ─────────────────────────────────────
 *
 * This is not theoretical here. Earlier this session a real user's account was
 * confirmed 25 seconds after signup by Gmail's link scanner, before she had
 * opened the email — inbox providers and security appliances routinely fetch
 * every URL in a message. If a GET acted, those scanners would silently
 * unsubscribe people who never touched the link, and the failure would be
 * invisible: mail simply stops arriving.
 *
 * So:
 *   GET  — renders a confirmation page. Changes NOTHING.
 *   POST — acts. RFC 8058 one-click sends `List-Unsubscribe=One-Click` with no
 *          user interaction and expects a 2xx, so this must not require a
 *          session, a cookie or a CSRF token; any of those and Gmail treats
 *          the unsubscribe as broken. A scanner will not POST.
 *
 * The token IS the credential. It is a per-address uuid from `email_optouts`,
 * carries no session, and grants nothing except the ability to change that one
 * address's email preferences. The worst outcome of a leaked token is that
 * somebody stops their own email. `email_optouts` has RLS on with no policies,
 * so tokens are unlistable.
 *
 * Deliberately NOT advertising a `mailto:` alternate. Gmail accepts either an
 * https URL with one-click or a mailto, and we have no inbox that parses
 * unsubscribe mail — advertising one that goes nowhere is worse than silence.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Same convention as src/app/api/emails/queue-participant/route.ts.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://luruhkwrgisytejswlas.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_k7NdduzaXK358z8ew18ZKA_vBSieDlV';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Action = 'all' | 'marketing' | 'resubscribe';
type Result = { ok: true; email: string } | { ok: false };

async function run(token: string, action: Action): Promise<Result> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  if (action === 'resubscribe') {
    const { data } = await supabase.rpc('cancel_unsubscribe', { p_token: token });
    const r = data as { ok: boolean; email?: string } | null;
    return r?.ok ? { ok: true, email: r.email! } : { ok: false };
  }
  const { data } = await supabase.rpc('apply_unsubscribe', { p_token: token, p_scope: action });
  const r = data as { ok: boolean; email?: string } | null;
  return r?.ok ? { ok: true, email: r.email! } : { ok: false };
}

/** Renders the confirmation page. Mutates nothing — see the note above. */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('t') ?? '';
  if (!UUID_RE.test(token)) return html(page({ state: 'bad-link' }));
  return html(page({ state: 'confirm', token }));
}

export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('t') ?? '';

  // Distinguish the two POSTs. RFC 8058 sends a form body containing
  // `List-Unsubscribe=One-Click`; our own page posts an `a` field.
  let formAction = '';
  let oneClick = false;
  try {
    const form = await req.formData();
    formAction = String(form.get('a') ?? '');
    oneClick = String(form.get('List-Unsubscribe') ?? '') === 'One-Click';
  } catch {
    // A one-click POST with no parseable body is still a one-click POST.
    oneClick = true;
  }

  if (!UUID_RE.test(token)) {
    // Still 200 for the machine caller: a provider probing a malformed link
    // should not see a 4xx and conclude our unsubscribe is broken.
    return oneClick
      ? new NextResponse('ok', { status: 200, headers: { 'Content-Type': 'text/plain' } })
      : html(page({ state: 'bad-link' }));
  }

  const action: Action =
    formAction === 'marketing' ? 'marketing' : formAction === 'resubscribe' ? 'resubscribe' : 'all';

  const result = await run(token, action);

  if (oneClick && !formAction) {
    return new NextResponse('ok', { status: 200, headers: { 'Content-Type': 'text/plain' } });
  }
  if (!result.ok) return html(page({ state: 'bad-link' }));
  return html(page({
    state: action === 'resubscribe' ? 'resubscribed' : action === 'marketing' ? 'marketing' : 'all',
    email: result.email,
    token,
  }));
}

function html(body: string) {
  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // Never cached, never indexed. robots.ts disallows it too, but a header
      // is what actually stops a token-bearing URL being retained.
      'Cache-Control': 'no-store, max-age=0',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
    },
  });
}

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

type PageState = 'confirm' | 'all' | 'marketing' | 'resubscribed' | 'bad-link';

function page(o: { state: PageState; email?: string; token?: string }): string {
  const FOREST = '#1B3828';
  const INK = '#1C1410';
  const SOFT = '#544B3E';
  const BASE = '#EDE7D8';
  const CARD = '#FAF8F3';

  const heading =
    o.state === 'bad-link' ? 'This link has expired'
    : o.state === 'resubscribed' ? "You're back on the list"
    : o.state === 'marketing' ? 'Only the essentials from now on'
    : o.state === 'all' ? 'You have been unsubscribed'
    : 'Stop emails from Gavelling?';

  const who = o.email ? `<p class="who">${esc(o.email)}</p>` : '';

  // Every mutation is a POST form, so nothing here can be triggered by a
  // crawler, a link scanner or a prefetch.
  const form = (label: string, action: Action, kind: 'btn' | 'btn-quiet') =>
    `<form method="post" action="/unsubscribe?t=${esc(o.token ?? '')}" style="display:inline;">
       <input type="hidden" name="a" value="${action}">
       <button class="${kind}" type="submit">${esc(label)}</button>
     </form>`;

  let body: string;
  let actions = '';

  switch (o.state) {
    case 'bad-link':
      body = `<p>We could not read that unsubscribe link. It may have been broken by the email client that displayed it.</p>
              <p>You can change every email setting yourself from your account, or reply to any email from a conference and ask their team to remove you.</p>`;
      actions = `<a class="btn" href="/account/profile">Open my email settings</a>`;
      break;
    case 'resubscribed':
      body = `<p>That unsubscribe has been undone. You will receive email from Gavelling again, including about conferences you have applied to.</p>`;
      actions = `<a class="btn" href="/account/profile">Choose exactly what I get</a>`;
      break;
    case 'marketing':
      body = `<p>We will not send you announcements or reminders any more.</p>
              <p>You will still hear from us about <strong>your own registrations</strong> — an application decision, a fee that becomes due, your committee allocation, a study guide your chairs publish. Those are the emails people are sorry to have missed.</p>`;
      actions = form('Actually, stop everything', 'all', 'btn-quiet') + form('Undo', 'resubscribe', 'btn-quiet');
      break;
    case 'all':
      body = `<p><strong>You will no longer receive any email from Gavelling</strong> — including about conferences you have applied to, decisions on those applications, and fees that become due.</p>
              <p>If you only wanted the announcements to stop, keep the essentials instead.</p>`;
      actions = form('Keep essential emails only', 'marketing', 'btn') + form('Undo — resubscribe me', 'resubscribe', 'btn-quiet');
      break;
    default:
      body = `<p>Choose what you would like to stop. Nothing has changed yet.</p>
              <p><strong>Essential emails</strong> are about your own registrations — an application decision, a fee that becomes due, your committee allocation. Most people who unsubscribe from a conference platform still want those.</p>`;
      actions = form('Keep essential emails only', 'marketing', 'btn') + form('Stop everything', 'all', 'btn-quiet');
      break;
  }

  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Email preferences · Gavelling</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
         padding:28px 20px; background:${BASE}; color:${INK};
         font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
  .card { width:100%; max-width:540px; background:${CARD}; border-radius:24px; padding:38px 34px;
          box-shadow: 0 18px 44px rgba(27,56,40,0.13), 0 2px 6px rgba(27,56,40,0.06); }
  .mark { width:46px; height:46px; border-radius:999px; background:${FOREST}; color:#EED98A;
          display:flex; align-items:center; justify-content:center; font-weight:800; font-size:19px;
          margin-bottom:20px; letter-spacing:-0.02em; }
  h1 { margin:0 0 6px; font-size:26px; line-height:1.2; font-weight:800; color:${FOREST}; letter-spacing:-0.02em; }
  p { margin:0 0 14px; font-size:15px; line-height:1.65; color:${SOFT}; }
  p.who { margin:0 0 18px; font-size:14px; }
  strong { color:${INK}; }
  .actions { display:flex; flex-wrap:wrap; gap:10px; margin-top:24px; }
  .btn, .btn-quiet { display:inline-block; text-decoration:none; font:inherit; font-size:14px;
                     font-weight:700; padding:13px 22px; border-radius:999px; border:0; cursor:pointer; }
  .btn { background:${FOREST}; color:#FAF8F3; }
  .btn-quiet { background:transparent; color:${SOFT}; box-shadow: inset 0 0 0 1.5px rgba(27,56,40,0.18); }
  .foot { margin-top:26px; padding-top:18px; border-top:1px solid rgba(27,56,40,0.10);
          font-size:12px; line-height:1.6; color:#6E6456; }
  .foot a { color:#6E6456; }
  @media (prefers-color-scheme: dark) {
    body { background:#0E0D0A; color:#F3EFE6; }
    .card { background:#232019; box-shadow:none; }
    h1 { color:#A9C7B4; }
    p { color:#CFC7B8; }
    strong { color:#F3EFE6; }
    .btn { background:#2E5C41; color:#F3EFE6; }
    .btn-quiet { color:#CFC7B8; box-shadow: inset 0 0 0 1.5px rgba(255,255,255,0.18); }
    .foot { border-top-color: rgba(255,255,255,0.12); color:#A79D8D; }
  }
</style></head>
<body><div class="card">
  <div class="mark">G</div>
  <h1>${esc(heading)}</h1>
  ${who}
  ${body}
  <div class="actions">${actions}</div>
  <div class="foot">
    Account and security email — password resets and address confirmations — is not affected by this,
    because it does not go through our mailing system.
    <br><br>
    GAVELLING LTD · Registered in England &amp; Wales no. 17337652 ·
    <a href="https://gavelling.com">gavelling.com</a>
  </div>
</div></body></html>`;
}
