#!/usr/bin/env node
/**
 * check-og-config — the build-time guard for WhatsApp / iMessage / Slack link
 * previews. Runs in `prebuild`, so Vercel refuses to deploy a regression.
 *
 * `npm run check:og` tests a RUNNING server and nobody remembers to run it.
 * This one reads the source, needs no server and runs on every build. Each rule
 * is a way the preview has actually broken before:
 *
 *  1. next.config `htmlLimitedBots: /.*\/` — without it Next streams dynamic
 *     pages' og: tags into <body> for any user agent not on its bot list, and
 *     preview fetchers read only <head> (6 Oct 2026, conference pages).
 *  2. No `openGraph:` object outside src/lib/seo.ts and the root layout — a
 *     page-level openGraph REPLACES the layout's and drops og:image (twice).
 *  3. The conference card token carries no date — a daily URL meant a cold
 *     render on the first share of every day (6 Oct 2026).
 *  4. The card routes stay on the Node runtime and `sharp` is a real
 *     dependency — without sharp the cards are unencoded PNGs and WebP banners
 *     vanish.
 *  5. The card fonts and the static share card exist, and the static card is
 *     small enough for WhatsApp.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const read = (p) => readFileSync(join(root, p), 'utf8');
const failures = [];
const fail = (msg) => failures.push(msg);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.') || name === '_archive') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?|mjs|js)$/.test(name)) out.push(p);
  }
  return out;
}

// 1. Metadata in <head> for every user agent.
const nextConfig = read('next.config.ts');
const bots = nextConfig.match(/^\s*htmlLimitedBots:\s*(\/.*\/[a-z]*)\s*,/m)?.[1];
if (bots !== '/.*/') {
  fail(
    `next.config.ts must set \`htmlLimitedBots: /.*/\` (found ${bots ?? 'nothing'}). ` +
      'Without it, dynamic pages stream og: tags into <body> and WhatsApp shows a bare link.',
  );
}

// 2. One way to write Open Graph.
const allowedOg = new Set(['src/lib/seo.ts', 'src/app/layout.tsx']);
for (const file of walk(join(root, 'src'))) {
  const rel = relative(root, file).split('\\').join('/');
  if (allowedOg.has(rel)) continue;
  const src = readFileSync(file, 'utf8');
  if (/\bopenGraph\s*:/.test(src)) {
    fail(`${rel}: hand-written \`openGraph:\`. Use pageMetadata() from src/lib/seo.ts; a page-level openGraph drops og:image.`);
  }
}

// 3. No date in the conference card token.
const ogVersion = read('src/lib/ogVersion.ts');
const versionFn = ogVersion.match(/export function ogVersion\([\s\S]*?\n}/)?.[0] ?? '';
if (!versionFn) fail('src/lib/ogVersion.ts: ogVersion() not found.');
else if (/utcToday|new Date|Date\.now/.test(versionFn)) {
  fail('src/lib/ogVersion.ts: ogVersion() must not depend on the date. A daily URL is a cold render on every first share.');
}

// 4. Node runtime, sharp installed.
for (const file of walk(join(root, 'src/app/api/og'))) {
  const src = readFileSync(file, 'utf8');
  if (/export\s+const\s+runtime\s*=\s*['"]edge['"]/.test(src)) {
    fail(`${relative(root, file)}: the card routes must run on Node (sharp cannot load on the edge).`);
  }
}
const pkg = JSON.parse(read('package.json'));
if (!pkg.dependencies?.sharp) fail('package.json: `sharp` must be in dependencies (it encodes the share cards).');

// 5. Assets.
for (const f of ['Outfit-Regular.ttf', 'Outfit-Medium.ttf', 'Outfit-Bold.ttf', 'Outfit-ExtraBold.ttf']) {
  if (!existsSync(join(root, 'src/app/api/og/_shared', f))) fail(`src/app/api/og/_shared/${f} is missing (card fonts).`);
}
const seo = read('src/lib/seo.ts');
const staticCard = seo.match(/OG_IMAGE_URL = `\$\{SITE_URL\}(\/[^`]+)`/)?.[1];
if (!staticCard) fail('src/lib/seo.ts: OG_IMAGE_URL not found.');
else {
  const p = join(root, 'public', staticCard);
  if (!existsSync(p)) fail(`public${staticCard} (the site share card) is missing.`);
  else {
    const size = statSync(p).size;
    if (size > 300 * 1024) fail(`public${staticCard} is ${Math.round(size / 1024)}KB; keep it under 300KB for WhatsApp.`);
    const head = readFileSync(p).subarray(0, 3);
    if (/\.jpe?g$/i.test(staticCard) && !(head[0] === 0xff && head[1] === 0xd8)) {
      fail(`public${staticCard} is not a JPEG, but it is declared as one.`);
    }
  }
}

if (failures.length) {
  console.error(`\ncheck-og-config: ${failures.length} problem(s) that would break link previews:\n`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  console.error('');
  process.exit(1);
}
console.log('check-og-config: OK');
