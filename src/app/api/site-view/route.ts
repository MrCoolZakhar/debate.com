// Anonymous, aggregate page-view counter for the whole site (25 Sep 2026),
// the twin of /api/conference-view. Stores NOTHING about the request: the IP
// serves an in-memory rate limit that dies with this server instance, the
// user agent only drops obvious bots. What reaches the database is
// `record_site_view(page, source)`, which adds 1 to one (day, page, source)
// counter. No token is forwarded: nothing here depends on who is viewing.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BOT_UA = /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|quora link|whatsapp|telegrambot|discordbot|headless|lighthouse|pingdom|monitor|curl|wget|python-requests|httpclient|axios|node-fetch|go-http/i;

// 60 counted posts a minute per IP, per server instance (a visit posts one per page).
const WINDOW_MS = 60_000;
const LIMIT = 60;
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

const PAGE = /^[a-z0-9][a-z0-9/_-]{0,59}$/;
const SOURCE = /^[a-z0-9][a-z0-9.-]{0,39}$/;

export async function POST(req: NextRequest) {
  const ua = req.headers.get('user-agent') || '';
  if (!ua || BOT_UA.test(ua)) return new NextResponse(null, { status: 204 });

  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || req.headers.get('x-real-ip') || 'unknown';
  if (limited(ip)) return new NextResponse(null, { status: 204 });

  let body: { page?: unknown; source?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  const page = typeof body.page === 'string' ? body.page.toLowerCase() : '';
  const source = typeof body.source === 'string' && SOURCE.test(body.source.toLowerCase()) ? body.source.toLowerCase() : 'direct';
  if (!PAGE.test(page)) return NextResponse.json({ ok: false }, { status: 400 });

  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await client.rpc('record_site_view', { p_page: page, p_source: source });
  if (error) return NextResponse.json({ ok: false }, { status: 502 });
  return new NextResponse(null, { status: 204 });
}
