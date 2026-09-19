// Anonymous, aggregate page-view counter for public conference pages.
//
// Stores NOTHING about the request: no IP, no user agent, no cookie, no user
// id. The IP is used only for an in-memory rate limit that lives and dies with
// this server instance; the user agent only to drop obvious bots. What reaches
// the database is `record_conference_page_view(slug, source, host?)`, which
// adds 1 to one (conference, day, source) counter. A forwarded access token
// lets the database skip the conference's own organisers; it is not stored.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabase';
import { isTrafficSource } from '@/lib/trafficSource';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BOT_UA = /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|quora link|whatsapp|telegrambot|discordbot|headless|lighthouse|pingdom|monitor|curl|wget|python-requests|httpclient|axios|node-fetch|go-http/i;

// 30 counted posts a minute per IP, per server instance, then silently ignored.
const WINDOW_MS = 60_000;
const LIMIT = 30;
const hits = new Map<string, { start: number; n: number }>();
let calls = 0;

function limited(ip: string): boolean {
  const now = Date.now();
  if (++calls % 200 === 0 || hits.size > 5000) {
    for (const [k, v] of hits) if (now - v.start > WINDOW_MS) hits.delete(k);
    if (hits.size > 5000) hits.clear();
  }
  const cur = hits.get(ip);
  if (!cur || now - cur.start > WINDOW_MS) {
    hits.set(ip, { start: now, n: 1 });
    return false;
  }
  cur.n += 1;
  return cur.n > LIMIT;
}

const SLUG = /^[a-z0-9][a-z0-9-]{0,199}$/i;
const HOST = /^[a-z0-9.-]{1,253}$/;

export async function POST(req: NextRequest) {
  const ua = req.headers.get('user-agent') || '';
  if (!ua || BOT_UA.test(ua)) return new NextResponse(null, { status: 204 });

  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || req.headers.get('x-real-ip') || 'unknown';
  if (limited(ip)) return new NextResponse(null, { status: 204 });

  let body: { slug?: unknown; source?: unknown; host?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  const slug = typeof body.slug === 'string' ? body.slug : '';
  if (!SLUG.test(slug) || !isTrafficSource(body.source)) return NextResponse.json({ ok: false }, { status: 400 });
  const host = typeof body.host === 'string' && HOST.test(body.host.toLowerCase()) ? body.host.toLowerCase() : null;

  const auth = req.headers.get('authorization');
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: auth && /^Bearer [\w.-]+$/.test(auth) ? { headers: { Authorization: auth } } : undefined,
  });

  let { error } = await client.rpc('record_conference_page_view', { p_slug: slug, p_source: body.source, p_host: host });
  // An expired token fails the whole call; count the view anonymously instead.
  if (error && auth) {
    const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    ({ error } = await anon.rpc('record_conference_page_view', { p_slug: slug, p_source: body.source, p_host: host }));
  }
  if (error) return NextResponse.json({ ok: false }, { status: 502 });
  return new NextResponse(null, { status: 204 });
}
