#!/usr/bin/env node
/**
 * check-indexability — the regression guard for Google Search Console.
 *
 * Search Console kept reporting the same families of problems: sitemap URLs
 * that redirect, hreflang pointing at `?lang=` URLs that canonicalise away,
 * private pages "indexed, though blocked by robots.txt" (a Disallow stops
 * Google reading the noindex, so it indexes the bare URL), build assets and
 * PDFs crawled as pages, and public pages "discovered, not indexed" because
 * nothing server-rendered links to them.
 *
 * This script asserts all of it against a real server:
 *
 *   npm run check:indexability                               # https://gavelling.com
 *   npm run check:indexability -- --base=http://localhost:3000
 *
 * For every URL in the sitemap (sitemap indexes are followed):
 *   - HTTP 200 with NO redirect
 *   - <link rel=canonical> equals the sitemap URL exactly
 *   - no noindex in <meta name=robots|googlebot> or X-Robots-Tag
 *   - not disallowed by robots.txt
 *   - <title>, <h1> and real body text present in the RAW HTML
 *   - lastmod parses and is not in the future
 *   - every hreflang alternate is itself a 200, self-canonical, indexable URL
 *   - at least one other sitemap page links to it with a plain <a href>
 * Plus: known private routes must be noindex (or redirect / 4xx) AND crawlable,
 * build assets and public PDFs must carry X-Robots-Tag: noindex, and internal
 * links on indexable pages must not point at redirects or 404s.
 *
 * When --base is not the production origin, sitemap URLs are fetched from the
 * base but canonicals are still compared with the production URL (the site
 * always declares https://gavelling.com canonicals).
 *
 * Exits 1 with a report when anything fails.
 */

const SITE = 'https://gavelling.com';
const UA = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const BASE = arg('base', SITE).replace(/\/$/, '');
const CONCURRENCY = Number(arg('concurrency', '6'));
const MIN_TEXT = Number(arg('min-text', '250'));
const TIMEOUT_MS = Number(arg('timeout', '30000'));

// Routes that must never be indexed. Each must be crawlable (so Google can
// read the noindex) and answer with noindex, a redirect or a 4xx.
// `blocked: true` = deliberately disallowed in robots.txt instead, because
// rendering it has side effects (a seat claim, an unsubscribe) or it is not a
// page at all. Those must ALSO be noindex, in case a URL leaks.
const PRIVATE_ROUTES = [
  { path: '/auth/signin' },
  { path: '/auth/signup' },
  { path: '/chair/ABC123', blocked: true },
  { path: '/delegate/ABC123', blocked: true },
  { path: '/advisor/ABC123', blocked: true },
  { path: '/voting/ABC123', blocked: true },
  { path: '/join?code=ABC123' },
  { path: '/join?code=ABC123-1234&mode=chair' },
  { path: '/manage/example-slug' },
  { path: '/admin' },
  { path: '/account/profile' },
  { path: '/account/cv' },
  { path: '/my-conferences' },
  { path: '/invites/delegation/example-token' },
  { path: '/drafts/example-token' },
  { path: '/drafts/example-token?stop=1', blocked: true },
  { path: '/delegation/example-id' },
  { path: '/conferences/new' },
  { path: '/conferences/example-slug/apply' },
  { path: '/conferences/example-slug/pay' },
  { path: '/conferences/example-slug/role/chair' },
  { path: '/conferences/example-slug/papers' },
  { path: '/unsubscribe?token=x', blocked: true },
  { path: '/api/geo', blocked: true },
];

// Pages that MUST stay indexable even though their parameterised forms are not.
const MUST_INDEX = ['/', '/join', '/create', '/blog', '/conferences/explore'];

// Indexable pages that are deliberately NOT in the sitemap (no warning):
// personal CVs (people, not landing pages) and per-conference reviews tabs
// (the conference page is the landing page; the tab is thin until reviewed).
const UNLISTED_OK = [/^\/cv\//, /^\/conferences\/[^/]+\/reviews$/];

// Non-HTML files that must carry X-Robots-Tag: noindex.
const NOINDEX_FILES = ['/UNSC_RESOLUTION.pdf'];

// ── helpers ──────────────────────────────────────────────────────────────────

const decode = (s) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&#x27;|&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;|&#160;/g, ' ');

const norm = (u) => {
  // Only the root may differ by a trailing slash (https://x.com == https://x.com/).
  try {
    const url = new URL(u);
    return url.pathname === '/' && !url.search ? `${url.origin}` : u;
  } catch {
    return u;
  }
};

/** Production URL → the URL to actually request on BASE. */
const toBase = (u) => (u.startsWith(SITE) ? BASE + u.slice(SITE.length) : u);

async function get(url, { redirect = 'manual' } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const started = Date.now();
  try {
    const res = await fetch(url, { headers: { 'user-agent': UA }, redirect, signal: ctrl.signal });
    const type = res.headers.get('content-type') ?? '';
    const body = /text|xml|json|javascript/.test(type) ? await res.text() : (await res.arrayBuffer(), '');
    return { status: res.status, headers: res.headers, body, ms: Date.now() - started };
  } finally {
    clearTimeout(t);
  }
}

async function pool(items, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        try {
          out[idx] = await fn(items[idx]);
        } catch (err) {
          out[idx] = { error: err };
        }
      }
    }),
  );
  return out;
}

// robots.txt: the `*` group, Allow/Disallow with `*` and `$`, longest match wins.
function parseRobots(txt) {
  const groups = [];
  let cur = null;
  let lastWasAgent = false;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    if (!line) continue;
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const val = m[2].trim();
    if (key === 'user-agent') {
      if (!lastWasAgent) groups.push((cur = { agents: [], rules: [] }));
      cur.agents.push(val.toLowerCase());
      lastWasAgent = true;
    } else {
      lastWasAgent = false;
      if (cur && (key === 'allow' || key === 'disallow')) cur.rules.push({ allow: key === 'allow', path: val });
    }
  }
  const google = groups.find((g) => g.agents.includes('googlebot')) ?? groups.find((g) => g.agents.includes('*'));
  const rules = (google?.rules ?? []).filter((r) => r.path !== '');
  return (pathAndQuery) => {
    let best = null;
    for (const r of rules) {
      const re = new RegExp(
        '^' +
          r.path
            .split('*')
            .map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
            .join('.*')
            .replace(/\\\$$/, '$'),
      );
      if (re.test(pathAndQuery)) {
        if (!best || r.path.length > best.path.length || (r.path.length === best.path.length && r.allow)) best = r;
      }
    }
    return best && !best.allow ? best.path : null;
  };
}

const metaRobots = (html) => {
  const tags = html.match(/<meta[^>]+name="(?:robots|googlebot)"[^>]*>/gi) ?? [];
  return tags.map((t) => (t.match(/content="([^"]*)"/i)?.[1] ?? '').toLowerCase()).join(', ');
};
const canonicalOf = (html) => {
  const tags = html.match(/<link[^>]+rel="canonical"[^>]*>/gi) ?? [];
  return tags.map((t) => decode(t.match(/href="([^"]*)"/i)?.[1] ?? ''));
};
const alternatesOf = (html) =>
  (html.match(/<link[^>]+rel="alternate"[^>]*hreflang="[^"]*"[^>]*>|<link[^>]+hreflang="[^"]*"[^>]*rel="alternate"[^>]*>/gi) ?? []).map(
    (t) => ({ lang: t.match(/hreflang="([^"]*)"/i)?.[1], href: decode(t.match(/href="([^"]*)"/i)?.[1] ?? '') }),
  );
const titleOf = (html) => decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '').trim();
const h1Of = (html) => decode((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? '').replace(/<[^>]+>/g, '')).trim();
const textOf = (html) =>
  decode(
    html
      .replace(/<head[\s\S]*?<\/head>/i, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<template[\s\S]*?<\/template>/gi, '')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .trim();
const linksOf = (html, pageUrl) => {
  const out = new Set();
  for (const m of html.matchAll(/<a\b[^>]*\bhref="([^"]*)"/gi)) {
    const href = decode(m[1]);
    if (!href || href.startsWith('#') || /^(mailto|tel|javascript):/i.test(href)) continue;
    try {
      const u = new URL(href, pageUrl);
      u.hash = '';
      out.add(u.toString());
    } catch {}
  }
  return out;
};

async function readSitemap(url, seen = new Set()) {
  if (seen.has(url)) return [];
  seen.add(url);
  const r = await get(toBase(url));
  if (r.status !== 200) throw new Error(`${url} → HTTP ${r.status}`);
  const locs = [...r.body.matchAll(/<(sitemap|url)>([\s\S]*?)<\/\1>/g)].map((m) => ({
    kind: m[1],
    loc: decode(m[2].match(/<loc>([\s\S]*?)<\/loc>/)?.[1]?.trim() ?? ''),
    lastmod: m[2].match(/<lastmod>([\s\S]*?)<\/lastmod>/)?.[1]?.trim() ?? null,
    alternates: [...m[2].matchAll(/<xhtml:link[^>]*hreflang="([^"]*)"[^>]*href="([^"]*)"/g)].map((a) => ({ lang: a[1], href: decode(a[2]) })),
  }));
  const urls = [];
  for (const e of locs) {
    if (e.kind === 'sitemap') urls.push(...(await readSitemap(e.loc, seen)));
    else urls.push({ ...e, sitemap: url });
  }
  return urls;
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  const fail = [];
  const warn = [];
  const F = (url, msg) => fail.push([url, msg]);
  const W = (url, msg) => warn.push([url, msg]);

  console.log(`check-indexability: ${BASE}\n`);

  const robotsRes = await get(`${BASE}/robots.txt`);
  if (robotsRes.status !== 200) F('/robots.txt', `HTTP ${robotsRes.status}`);
  const blockedBy = parseRobots(robotsRes.body);
  if (!/^sitemap:\s*https:\/\/gavelling\.com\/sitemap\.xml/im.test(robotsRes.body)) F('/robots.txt', 'no "Sitemap: https://gavelling.com/sitemap.xml" line');

  const entries = await readSitemap(`${SITE}/sitemap.xml`);
  console.log(`sitemap: ${entries.length} URLs`);

  const seenLoc = new Set();
  for (const e of entries) {
    if (seenLoc.has(e.loc)) F(e.loc, 'listed twice in the sitemap');
    seenLoc.add(e.loc);
    if (!e.loc.startsWith(`${SITE}/`) && e.loc !== SITE) F(e.loc, `sitemap URL is not on ${SITE} (host, scheme or www mismatch)`);
    if (/[?#]/.test(e.loc)) F(e.loc, 'sitemap URL carries a query string or fragment');
    if (e.loc !== SITE && e.loc.endsWith('/')) F(e.loc, 'sitemap URL has a trailing slash (Next serves the slashless form)');
    if (e.lastmod) {
      const d = new Date(e.lastmod);
      if (Number.isNaN(d.getTime())) F(e.loc, `lastmod "${e.lastmod}" does not parse`);
      else if (d.getTime() > Date.now() + 36 * 3600e3) F(e.loc, `lastmod ${e.lastmod} is in the future`);
    } else W(e.loc, 'no lastmod');
  }
  if (entries.length > 45000) F('/sitemap.xml', `${entries.length} URLs: split into a sitemap index (limit 50,000)`);

  const sitemapSet = new Set(entries.map((e) => norm(e.loc)));
  const inbound = new Map([...sitemapSet].map((u) => [u, 0]));
  const internalLinks = new Map(); // link → first page that has it

  const results = await pool(entries, async (e) => {
    const r = await get(toBase(e.loc));
    return { e, r };
  });

  const slow = [];
  for (const res of results) {
    if (res.error) {
      F('?', `request failed: ${res.error.message}`);
      continue;
    }
    const { e, r } = res;
    const u = e.loc;
    const path = new URL(u).pathname + new URL(u).search;
    if (r.status >= 300 && r.status < 400) {
      F(u, `redirects (HTTP ${r.status} → ${r.headers.get('location')}); list the final URL instead`);
      continue;
    }
    if (r.status !== 200) {
      F(u, `HTTP ${r.status}`);
      continue;
    }
    if (r.ms > 3000) slow.push([u, r.ms]);
    const blocked = blockedBy(path);
    if (blocked) F(u, `blocked by robots.txt rule "Disallow: ${blocked}"`);
    const xrt = (r.headers.get('x-robots-tag') ?? '').toLowerCase();
    if (/noindex|none/.test(xrt)) F(u, `X-Robots-Tag: ${xrt}`);
    const html = r.body;
    const mr = metaRobots(html);
    if (/noindex|none/.test(mr)) F(u, `meta robots "${mr}"`);
    const canon = canonicalOf(html);
    if (canon.length === 0) F(u, 'no <link rel="canonical">');
    else if (canon.length > 1) F(u, `${canon.length} canonical tags`);
    else if (norm(canon[0]) !== norm(u)) F(u, `canonical is "${canon[0]}"`);
    if (!titleOf(html)) F(u, 'no <title> in raw HTML');
    if (!h1Of(html)) F(u, 'no <h1> in raw HTML (content is client-rendered only)');
    const text = textOf(html);
    if (text.length < MIN_TEXT) F(u, `only ${text.length} characters of body text in raw HTML (client-rendered?)`);
    for (const a of [...alternatesOf(html), ...e.alternates]) {
      if (!a.href) continue;
      if (/[?]/.test(a.href)) F(u, `hreflang ${a.lang} points at a query-string URL ${a.href}`);
      else if (!sitemapSet.has(norm(a.href)) && norm(a.href) !== norm(u)) W(u, `hreflang ${a.lang} → ${a.href} is not in the sitemap`);
    }
    for (const l of linksOf(html, u.startsWith(SITE) ? u : SITE)) {
      const abs = l.startsWith(BASE) && BASE !== SITE ? SITE + l.slice(BASE.length) : l;
      if (!abs.startsWith(SITE)) continue;
      const n = norm(abs);
      if (inbound.has(n) && n !== norm(u)) inbound.set(n, inbound.get(n) + 1);
      if (!internalLinks.has(n)) internalLinks.set(n, u);
    }
  }

  for (const [u, n] of inbound) {
    if (n === 0 && norm(u) !== SITE) F(u, 'no plain <a href> to it from any other sitemap page (orphan: Google will not prioritise crawling it)');
  }
  for (const [u, ms] of slow) W(u, `slow: ${ms} ms`);

  // Internal links on indexable pages that land on a redirect or an error.
  const toProbe = [...internalLinks.keys()].filter((l) => {
    if (sitemapSet.has(l)) return false;
    const p = new URL(l);
    if (blockedBy(p.pathname + p.search)) return false;
    return !/\.(png|jpe?g|webp|gif|svg|ico|pdf|xml|txt|webmanifest)$/i.test(p.pathname);
  });
  const probes = await pool(toProbe, async (l) => ({ l, r: await get(toBase(l)) }));
  for (const p of probes) {
    if (p.error) continue;
    const { l, r } = p;
    const from = internalLinks.get(l);
    if (r.status >= 300 && r.status < 400) {
      const loc = r.headers.get('location') ?? '';
      const target = new URL(loc, l);
      // Auth-gated pages bouncing to sign-in are private, not a crawl-path bug.
      if (!/^\/auth\//.test(target.pathname)) F(l, `internal link (on ${from}) redirects to ${loc}; link to the final URL`);
    } else if (r.status >= 400) F(l, `internal link (on ${from}) returns HTTP ${r.status}`);
    else if (r.status === 200 && /text\/html/.test(r.headers.get('content-type') ?? '')) {
      const canon = canonicalOf(r.body);
      const noindex = /noindex|none/.test(metaRobots(r.body) + (r.headers.get('x-robots-tag') ?? ''));
      if (!noindex && canon.length === 1 && norm(canon[0]) === norm(l) && !UNLISTED_OK.some((re) => re.test(new URL(l).pathname))) W(l, `indexable, self-canonical and linked (on ${from}) but missing from the sitemap`);
    }
  }

  // Host variants must reach https://gavelling.com in ONE permanent redirect.
  // (17 Sep 2026: https://www.gavelling.com had no valid certificate, so the
  // redirect Search Console tried to validate failed at TLS.)
  if (BASE === SITE) {
    for (const v of ['https://www.gavelling.com/', 'http://www.gavelling.com/', 'http://gavelling.com/']) {
      try {
        const r = await get(v);
        const loc = r.headers.get('location') ?? '';
        if (![301, 308].includes(r.status)) F(v, `HTTP ${r.status}, expected a 301/308 to ${SITE}/`);
        else if (norm(new URL(loc, v).toString()) !== SITE) F(v, `redirects to ${loc}, expected ${SITE}/ in one hop`);
      } catch (err) {
        F(v, `request failed (${err.cause?.code ?? err.message}): fix the domain / certificate in Vercel`);
      }
    }
  }

  // Pages that must stay indexable.
  for (const p of MUST_INDEX) {
    const u = p === '/' ? SITE : SITE + p;
    if (!sitemapSet.has(norm(u))) F(u, 'must be indexable but is not in the sitemap');
  }

  // Private routes: crawlable + noindex (or redirect / 4xx).
  const privRes = await pool(PRIVATE_ROUTES, async (route) => ({ route, r: await get(BASE + route.path) }));
  for (const pr of privRes) {
    if (pr.error) {
      F('private', `request failed: ${pr.error.message}`);
      continue;
    }
    const { route, r } = pr;
    const blocked = blockedBy(route.path);
    if (route.blocked) {
      if (!blocked) F(route.path, 'must stay disallowed in robots.txt (acts on GET or is not a page)');
      const xrt = (r.headers.get('x-robots-tag') ?? '').toLowerCase();
      if (r.status < 300 && !/noindex/.test(xrt + metaRobots(r.body))) F(route.path, 'disallowed route has no noindex (X-Robots-Tag) for when its URL leaks');
      continue;
    }
    if (blocked) F(route.path, `blocked by robots.txt "Disallow: ${blocked}", so Google cannot see its noindex and may index the bare URL. Allow it and serve noindex.`);
    if (r.status >= 300 && r.status < 400) continue;
    if (r.status >= 400) {
      if (r.status !== 404 && r.status !== 410 && r.status !== 401 && r.status !== 403) F(route.path, `HTTP ${r.status}`);
      else if (!/noindex/.test(metaRobots(r.body) + (r.headers.get('x-robots-tag') ?? '').toLowerCase())) W(route.path, `HTTP ${r.status} without noindex (fine: errors are not indexed)`);
      continue;
    }
    const noindex = /noindex|none/.test(metaRobots(r.body) + ' ' + (r.headers.get('x-robots-tag') ?? '').toLowerCase());
    if (!noindex) F(route.path, 'private route is indexable (no noindex meta or X-Robots-Tag)');
  }

  // Build assets and public files: must be noindex by header, never blocked.
  const home = await get(`${BASE}/`).catch((err) => (F('/', `request failed: ${err.message}`), { body: '' }));
  const asset = home.body.match(/\/_next\/static\/[^"'\s]+\.(?:js|css)(?:\?[^"'\s]*)?/)?.[0];
  const files = [...NOINDEX_FILES, ...(asset ? [decode(asset)] : [])];
  if (!asset) W('/_next/static', 'no asset found on the homepage to check');
  for (const f of files) {
    let r;
    try {
      r = await get(BASE + f);
    } catch (err) {
      F(f, `request failed: ${err.message}`);
      continue;
    }
    if (r.status !== 200) {
      F(f, `HTTP ${r.status}`);
      continue;
    }
    const xrt = (r.headers.get('x-robots-tag') ?? '').toLowerCase();
    if (!/noindex/.test(xrt)) F(f, `no "X-Robots-Tag: noindex" (got "${xrt || 'none'}"): Google reports it as a crawled page`);
    const blocked = blockedBy(new URL(f, SITE).pathname);
    if (blocked) F(f, `blocked by robots.txt "Disallow: ${blocked}"; Google needs assets to render pages`);
  }

  // ── report ────────────────────────────────────────────────────────────────
  // Group identical problems (URLs masked) so a systemic bug reads as one line
  // with its affected URLs underneath, not as 60 unrelated failures.
  const group = (list) => {
    const byMsg = new Map();
    for (const [u, m] of list) {
      const key = m.replace(/https?:\/\/\S+/g, '<url>').replace(/\d+ ms/, 'N ms').replace(/only \d+ characters/, 'only N characters');
      if (!byMsg.has(key)) byMsg.set(key, []);
      byMsg.get(key).push(m === key ? u : `${u}  (${m})`);
    }
    return byMsg;
  };
  const print = (list, mark, out, cap) => {
    for (const [msg, items] of group(list)) {
      out(`  ${mark} ${msg}  [${items.length}]`);
      for (const i of items.slice(0, cap)) out(`      ${i}`);
      if (items.length > cap) out(`      … and ${items.length - cap} more`);
    }
  };
  if (warn.length) {
    console.log(`\nWARNINGS (${warn.length}):`);
    print(warn, '!', console.log, 8);
  }
  console.log('');
  if (fail.length) {
    console.error(`FAILURES (${fail.length}):`);
    print(fail, '✗', console.error, 30);
    console.error(`\ncheck-indexability: FAILED, ${fail.length} problem(s) on ${BASE}`);
    process.exit(1);
  }
  console.log(`check-indexability: OK, ${entries.length} sitemap URLs indexable, ${PRIVATE_ROUTES.length} private routes noindex, assets noindex.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
