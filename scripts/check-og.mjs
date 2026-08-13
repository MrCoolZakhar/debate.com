#!/usr/bin/env node
/**
 * check-og — the regression guard for link previews.
 *
 * Sharing gavelling.com to WhatsApp has broken twice for the same two reasons:
 *
 *   1. Next.js REPLACES a parent `openGraph` object rather than deep-merging
 *      it, so a page writing `openGraph: { title, description }` silently
 *      drops og:image and the card comes back as a bare URL.
 *   2. og:url was hardcoded to the homepage in the root layout and inherited
 *      by every page that didn't set its own. Facebook/WhatsApp key their
 *      preview cache on og:url, so a dozen pages collapsed into ONE cache
 *      entry — which is why previews "broke at random".
 *
 * This script asserts, against a REAL production server, that every public
 * route serves a complete card AND an og:url that is its own path.
 *
 *   npm run check:og                 # against http://localhost:3000
 *   npm run check:og -- --base=https://gavelling.com
 *   npm run check:og -- --start      # build output already present: boots
 *                                    # `next start` on a spare port itself
 *
 * Exits non-zero on the first failure so it can gate a deploy.
 */

import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const SITE = 'https://gavelling.com';

// A WhatsApp scraper UA — the exact client Peter reported the bug from. Some
// hosts serve crawlers differently, so probe as the crawler, not as curl.
const UA = 'WhatsApp/2.23.20.0 A';

/**
 * Every route a human might paste into a chat. `expect` is the path og:url and
 * the canonical must resolve to; `redirectsTo` marks routes that legitimately
 * 3xx (we then assert the destination, not the redirect stub).
 *
 * ADDING A PUBLIC PAGE? Add it here. That is the whole point of this file.
 */
const ROUTES = [
  { path: '/' },
  { path: '/sessions' },
  { path: '/about' },
  { path: '/contact' },
  { path: '/blog' },
  { path: '/blog/mun-motions-explained' },
  { path: '/blog/how-to-run-mun-committee' },
  { path: '/blog/best-mun-software-2026' },
  { path: '/blog/muncommand-alternative' },
  { path: '/blog/mymun-alternative' },
  { path: '/privacy' },
  { path: '/terms' },
  { path: '/create' },
  { path: '/join' },
  { path: '/conferences/explore' },
  { path: '/conferences/map' },
  { path: '/conferences/roles' },
  { path: '/conferences/new' },
  { path: '/conferences', redirectsTo: '/' },
  { path: '/conferences/organise', redirectsTo: '/my-conferences', skipCard: true },
];

const args = process.argv.slice(2);
const baseArg = args.find((a) => a.startsWith('--base='));
const wantStart = args.includes('--start');
const PORT = Number(process.env.OG_CHECK_PORT ?? 4317);
const BASE = (baseArg ? baseArg.slice('--base='.length) : wantStart ? `http://localhost:${PORT}` : 'http://localhost:3000')
  .replace(/\/$/, '');

const meta = (html, prop) => {
  // Next emits <meta property="og:x" content="y"/>; attribute order is stable
  // but be liberal anyway.
  const re = new RegExp(`<meta[^>]+(?:property|name)="${prop}"[^>]*>`, 'i');
  const tag = html.match(re)?.[0];
  if (!tag) return null;
  const val = tag.match(/content="([^"]*)"/i)?.[1];
  return val == null ? null : decodeEntities(val);
};

const link = (html, rel) => {
  const tag = html.match(new RegExp(`<link[^>]+rel="${rel}"[^>]*>`, 'i'))?.[0];
  const val = tag?.match(/href="([^"]*)"/i)?.[1];
  return val ? decodeEntities(val) : null;
};

const decodeEntities = (s) =>
  s.replace(/&amp;/g, '&').replace(/&#x27;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

async function fetchRoute(path) {
  const res = await fetch(`${BASE}${path}`, { headers: { 'user-agent': UA }, redirect: 'manual' });
  return { status: res.status, location: res.headers.get('location'), html: await res.text() };
}

async function waitForServer(url, attempts = 60) {
  for (let i = 0; i < attempts; i++) {
    try {
      await fetch(url, { headers: { 'user-agent': UA } });
      return true;
    } catch {
      await sleep(500);
    }
  }
  return false;
}

async function main() {
  let child = null;
  if (wantStart) {
    child = spawn('npx', ['next', 'start', '-p', String(PORT)], { stdio: 'ignore', detached: false });
    if (!(await waitForServer(BASE))) {
      child.kill();
      console.error(`check-og: server never came up on ${BASE}. Did you run \`npm run build\`?`);
      process.exit(1);
    }
  }

  const failures = [];
  const rows = [];

  for (const route of ROUTES) {
    const expectPath = route.redirectsTo ?? route.path;
    const expectUrl = expectPath === '/' ? SITE : `${SITE}${expectPath}`;
    let r;
    try {
      r = await fetchRoute(route.path);
    } catch (err) {
      failures.push(`${route.path}: request failed — ${err.message}`);
      continue;
    }

    if (route.redirectsTo) {
      if (r.status < 300 || r.status >= 400) {
        failures.push(`${route.path}: expected a redirect to ${route.redirectsTo}, got HTTP ${r.status}`);
        continue;
      }
      if (!(r.location ?? '').endsWith(route.redirectsTo)) {
        failures.push(`${route.path}: redirects to ${r.location}, expected ${route.redirectsTo}`);
      }
      // Follow it and check the destination's card instead of the 308 stub.
      if (route.skipCard) { rows.push([route.path, `→ ${route.redirectsTo}`, '—', '—']); continue; }
      try {
        r = await fetchRoute(route.redirectsTo);
      } catch (err) {
        failures.push(`${route.redirectsTo}: request failed — ${err.message}`);
        continue;
      }
    } else if (r.status !== 200) {
      failures.push(`${route.path}: HTTP ${r.status}`);
      continue;
    }

    const title = meta(r.html, 'og:title');
    const desc = meta(r.html, 'og:description');
    const image = meta(r.html, 'og:image');
    const imgType = meta(r.html, 'og:image:type');
    const url = meta(r.html, 'og:url');
    const canonical = link(r.html, 'canonical');

    const where = route.path;
    if (!title) failures.push(`${where}: missing og:title`);
    if (!desc) failures.push(`${where}: missing og:description`);
    // BUG 3 GUARD — the openGraph-replaces-parent trap.
    if (!image) failures.push(`${where}: missing og:image (a page-level openGraph REPLACES the layout's — use pageMetadata() from src/lib/seo.ts)`);
    else if (!/^https:\/\//.test(image)) failures.push(`${where}: og:image "${image}" is not an absolute https URL`);
    if (image && !imgType) failures.push(`${where}: missing og:image:type`);
    // BUG 1 GUARD — the shared-preview-cache trap.
    if (!url) failures.push(`${where}: missing og:url`);
    else if (url.replace(/\/$/, '') !== expectUrl.replace(/\/$/, ''))
      failures.push(`${where}: og:url is "${url}" but should be "${expectUrl}" — Facebook/WhatsApp key their preview cache on og:url, so a wrong one makes this page share another page's card`);
    if (canonical && canonical.replace(/\/$/, '') !== expectUrl.replace(/\/$/, ''))
      failures.push(`${where}: canonical is "${canonical}" but should be "${expectUrl}"`);

    rows.push([where, title ? `${title.slice(0, 44)}${title.length > 44 ? '…' : ''}` : '✗ MISSING', image ? image.replace(SITE, '') : '✗ MISSING', url ? url.replace(SITE, '') || '/' : '✗ MISSING']);
  }

  const w = [0, 1, 2, 3].map((i) => Math.max(...rows.map((r) => String(r[i]).length), 0));
  const head = ['ROUTE', 'og:title', 'og:image', 'og:url'];
  console.log(head.map((h, i) => h.padEnd(w[i])).join('  '));
  console.log(w.map((n) => '-'.repeat(n)).join('  '));
  for (const r of rows) console.log(r.map((c, i) => String(c).padEnd(w[i])).join('  '));
  console.log('');

  if (child) { child.kill('SIGTERM'); }

  if (failures.length) {
    console.error(`check-og: ${failures.length} failure(s) across ${ROUTES.length} routes on ${BASE}\n`);
    for (const f of failures) console.error(`  ✗ ${f}`);
    console.error('');
    process.exit(1);
  }
  console.log(`check-og: OK — ${ROUTES.length} routes on ${BASE} all serve a complete card with their own og:url.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
