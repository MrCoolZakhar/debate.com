import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// IndexNow (indexnow.org): instant "this URL changed" pings to Bing, Yandex,
// Naver, Seznam, etc. (Google does not support IndexNow; it discovers via the
// sitemap + Search Console.) The key is intentionally public — the protocol
// verifies ownership by fetching /<key>.txt from our own domain.
const INDEXNOW_KEY = '8b2d058420fbf3a0f241bf68224fb156';
const HOST = 'gavelling.com';

// Called fire-and-forget by the organizer UI right after a conference is
// published. We re-check is_public server-side so the endpoint can't be used
// to ping arbitrary or private URLs.
export async function POST(req: NextRequest) {
  let slug: unknown;
  try {
    ({ slug } = await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  if (typeof slug !== 'string' || !/^[a-z0-9-]{1,120}$/.test(slug)) {
    return NextResponse.json({ error: 'invalid slug' }, { status: 400 });
  }

  const { data } = await supabase
    .from('conferences')
    .select('is_public')
    .eq('slug', slug)
    .maybeSingle();
  if (!data?.is_public) {
    return NextResponse.json({ error: 'not public' }, { status: 404 });
  }

  try {
    const res = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host: HOST,
        key: INDEXNOW_KEY,
        keyLocation: `https://${HOST}/${INDEXNOW_KEY}.txt`,
        urlList: [
          `https://${HOST}/conferences/${slug}`,
          // The listing surfaces changed too — nudge them along with the page.
          `https://${HOST}/conferences/explore`,
          `https://${HOST}/conferences/map`,
        ],
      }),
    });
    return NextResponse.json({ ok: true, status: res.status });
  } catch {
    // Indexing pings are best-effort; never surface a failure to the UI.
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
