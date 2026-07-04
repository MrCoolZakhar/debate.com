import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
// Cache the vanity spots counter. It doesn't need to be live-exact, and an uncached
// count(*) polled on every visit was hammering the Supabase REST origin (HTTP 522s that
// broke committee creation). Framework revalidation + an in-memory TTL keep Supabase to
// ~one count per minute regardless of traffic.
export const revalidate = 60;

const supabase = createClient(
  'https://luruhkwrgisytejswlas.supabase.co',
  'sb_publishable_k7NdduzaXK358z8ew18ZKA_vBSieDlV'
);

const COUNT_TTL_MS = 60_000;
let cachedCount: { value: number; at: number } | null = null;

export async function GET() {
  // Serve the cached count if it's still fresh — avoids a DB round-trip on every poll.
  if (cachedCount && Date.now() - cachedCount.at < COUNT_TTL_MS) {
    return NextResponse.json({ count: cachedCount.value });
  }
  // Hard 2s cap on the count query. Under a saturated DB the count would otherwise hang
  // ~90s (until Cloudflare 522s), holding a connection the whole time — hung count queries
  // were a primary driver of the pool exhaustion. Aborting fast releases the connection.
  const controller = new AbortController();
  const abortTimer = setTimeout(() => controller.abort(), 2000);
  try {
    const { count, error } = await supabase
      .from('pre_registrations')
      .select('*', { count: 'exact', head: true })
      .abortSignal(controller.signal);

    const value = error ? (cachedCount?.value ?? 123) : (count ?? 0) + 123;
    // Cache the result of BOTH success and failure so a slow/down DB can't be re-hammered
    // on every request — at most one attempt per instance per TTL window.
    cachedCount = { value, at: Date.now() };
    return NextResponse.json({ count: value });
  } catch {
    const value = cachedCount?.value ?? 123;
    cachedCount = { value, at: Date.now() };
    return NextResponse.json({ count: value });
  } finally {
    clearTimeout(abortTimer);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Check for duplicate first
    const { data: existing } = await supabase
      .from('pre_registrations')
      .select('id')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ duplicate: true }, { status: 200 });
    }

    const { error } = await supabase
      .from('pre_registrations')
      .insert({ email: email.toLowerCase().trim() });

    if (error) {
      // Unique constraint race condition — treat as duplicate
      if (error.code === '23505') {
        return NextResponse.json({ duplicate: true }, { status: 200 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
