// /r/<click token>/<link key>: the tracked links in our own campaign emails
// (newsletters). CLAUDE.md §6, "Email campaigns".
//
// It records ONE thing: that the recipient row behind this token clicked this
// link key, at this time (record_campaign_click, SECURITY DEFINER, anon). It
// stores no IP, no user agent, no cookie, no referrer and calls no third party.
// The user agent is read only to skip counting obvious bots and link scanners,
// which are still redirected. The destination comes from the campaign's own
// `links` map in the database and is only ever followed when it is on
// https://gavelling.com; anything else, an unknown token or a database error
// lands on the homepage. Never cached, never indexed (and disallowed in
// robots.txt, because fetching it has a side effect).

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabase';
import { BOT_UA, CLICK_TOKEN_RE, LINK_KEY_RE, SITE, safeCampaignDestination } from '@/lib/emailCampaigns';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function go(url: string): NextResponse {
  const res = NextResponse.redirect(url, 302);
  res.headers.set('X-Robots-Tag', 'noindex, nofollow');
  res.headers.set('Cache-Control', 'no-store');
  res.headers.set('Referrer-Policy', 'no-referrer');
  return res;
}

type Ctx = { params: Promise<{ token: string; key: string }> };

async function handle(req: NextRequest, ctx: Ctx, mayRecord: boolean): Promise<NextResponse> {
  const { token, key } = await ctx.params;
  if (!CLICK_TOKEN_RE.test(token) || !LINK_KEY_RE.test(key)) return go(SITE);

  const ua = req.headers.get('user-agent') || '';
  const record = mayRecord && !!ua && !BOT_UA.test(ua);

  try {
    const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await client.rpc('record_campaign_click', {
      p_token: token, p_key: key, p_record: record,
    });
    if (error) return go(SITE);
    return go(safeCampaignDestination(data));
  } catch {
    return go(SITE);
  }
}

export function GET(req: NextRequest, ctx: Ctx) {
  return handle(req, ctx, true);
}

// A HEAD (some mail clients and link scanners probe links this way) is
// redirected to the same place but never counted.
export function HEAD(req: NextRequest, ctx: Ctx) {
  return handle(req, ctx, false);
}
