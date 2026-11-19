// One-off backfill: smaller copies of the big images already in storage (owner, 19 Nov 2026).
//
// Supabase's cached egress reached 219.5 of 250 GB: conference logos were 768 px
// PNGs of about 260 KB drawn at 40 to 120 px. New uploads are shrunk in the
// browser (src/lib/shrinkImage.ts); this script makes the same smaller copy of
// every image already in the public conference-assets bucket.
//
// Run by Christian on his Mac:
//   SUPABASE_SERVICE_ROLE_KEY=... node scripts/shrink-storage-images.mjs [--dry-run]
//
// - The key is read ONLY from the environment: never printed, never written to
//   a file, never committed. NEXT_PUBLIC_SUPABASE_URL comes from .env.local.
// - It lists logos/, committee-emblems/, avatars/ and banners/ (every object,
//   paged, sub-folders included) and, for every image over 120 KB, downloads it,
//   shrinks it with sharp (longer side at most 512 px, banners 2000 px; WebP
//   quality 86, alpha kept) and uploads the copy NEXT TO the original as
//   {same name without extension}.webp (image/webp, cache one year, upsert
//   false; skipped when that .webp already exists or is not smaller). It never
//   deletes or overwrites an original. GIF and SVG are left alone.
// - It writes (and keeps adding to) scripts/out/shrunk-images.json: [{ bucket, from, to, beforeBytes,
//   afterBytes }], and prints one line per folder: files done, MB before, MB after.
// - --dry-run downloads and shrinks in memory and prints the totals: it uploads
//   nothing and writes nothing.
// - It writes NO database row and calls NO RPC: the chat repoints the URL
//   columns from the JSON afterwards.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const BUCKET = 'conference-assets';
const FOLDERS = { logos: 512, 'committee-emblems': 512, avatars: 512, banners: 2000 };
const MIN_BYTES = 120 * 1024;
const IMAGE_EXT = /\.(png|jpe?g|webp|avif|tiff?)$/i;
const DRY = process.argv.includes('--dry-run');

function envFromFile(name) {
  try {
    const text = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8');
    for (const line of text.split('\n')) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (m && m[1] === name) return m[2].replace(/^['"]|['"]$/g, '');
    }
  } catch { /* no .env.local */ }
  return undefined;
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || envFromFile('NEXT_PUBLIC_SUPABASE_URL');
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url) { console.error('NEXT_PUBLIC_SUPABASE_URL is missing from .env.local.'); process.exit(1); }
if (!key) { console.error('Set SUPABASE_SERVICE_ROLE_KEY in the environment.'); process.exit(1); }

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

/** Every object under a prefix, sub-folders included, paged. */
async function listAll(prefix) {
  const out = [];
  const PAGE = 1000;
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase.storage.from(BUCKET).list(prefix, { limit: PAGE, offset, sortBy: { column: 'name', order: 'asc' } });
    if (error) throw new Error(`list ${prefix}: ${error.message}`);
    for (const item of data ?? []) {
      const full = `${prefix}/${item.name}`;
      if (item.id === null) out.push(...await listAll(full)); // a folder
      else out.push({ path: full, size: item.metadata?.size ?? 0 });
    }
    if (!data || data.length < PAGE) break;
  }
  return out;
}

const mb = (n) => (n / 1024 / 1024).toFixed(1);
// Kept across runs: a run stopped half way keeps its rows, and the re-run
// (which skips every .webp already made) adds only the new ones.
const OUT_DIR = path.join(ROOT, 'scripts', 'out');
const OUT_FILE = path.join(OUT_DIR, 'shrunk-images.json');
let results = [];
if (!DRY) {
  try { results = JSON.parse(fs.readFileSync(OUT_FILE, 'utf8')); } catch { results = []; }
  if (!Array.isArray(results)) results = [];
}
function saveResults() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(results, null, 2));
}

for (const [folder, maxSide] of Object.entries(FOLDERS)) {
  const objects = await listAll(folder);
  const existing = new Set(objects.map(o => o.path));
  let done = 0, before = 0, after = 0, skipped = 0, failed = 0;
  for (const obj of objects) {
    if (obj.size <= MIN_BYTES || !IMAGE_EXT.test(obj.path)) continue;
    const to = obj.path.replace(/\.[^./]+$/, '') + '.webp';
    if (existing.has(to)) { skipped++; continue; } // already done, or the original is that .webp
    try {
      const { data: blob, error } = await supabase.storage.from(BUCKET).download(obj.path);
      if (error || !blob) throw new Error(error?.message ?? 'no data');
      const input = Buffer.from(await blob.arrayBuffer());
      const output = await sharp(input, { failOn: 'none' })
        .rotate()
        .resize(maxSide, maxSide, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 86, alphaQuality: 100 })
        .toBuffer();
      if (output.length >= input.length) { skipped++; continue; }
      if (!DRY) {
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(to, output, {
          contentType: 'image/webp', cacheControl: '31536000', upsert: false,
        });
        if (upErr) {
          if (/exists|duplicate/i.test(upErr.message)) { skipped++; continue; }
          throw new Error(upErr.message);
        }
        results.push({ bucket: BUCKET, from: obj.path, to, beforeBytes: input.length, afterBytes: output.length });
        saveResults();
      }
      done++; before += input.length; after += output.length;
    } catch (e) {
      failed++;
      console.warn(`  skipped ${obj.path}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  console.log(`${folder}: ${done} files${DRY ? ' (dry run)' : ''}, ${mb(before)} MB before, ${mb(after)} MB after (${skipped} skipped, ${failed} failed)`);
}

if (!DRY) {
  saveResults();
  console.log(`Wrote scripts/out/shrunk-images.json (${results.length} rows).`);
}
