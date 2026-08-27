#!/usr/bin/env node
/**
 * check-brand-marks.mjs — guard against the crescent-"C" logo bug.
 *
 * THE BUG. There is one piece of brand artwork (gavel + olive wreath) in two
 * shapes: a SQUARE mark and a WIDE ~4:1 lockup whose wordmark "GAVELLING"
 * starts around x=185. Square-crop the lockup and you keep the mark plus the
 * left bowl of the capital G — which reads as a crescent, or a "C" bitten out
 * of the right-hand side. See public/README.md.
 *
 * WHY A SCRIPT. That happened once *inside a file*: gavel-mark.png shipped for
 * months with the G baked in as opaque WHITE pixels at x 246-300 of 300. White
 * on transparent is invisible on ivory pages and in every OS/GitHub preview
 * (they all matte transparency onto white), so human review kept passing it.
 * It was only visible on the forest-green surfaces. A human cannot reliably
 * catch this; a pixel check can.
 *
 * WHAT IT CHECKS. For each square mark: find opaque, near-white pixels, ignore
 * the specular highlights that legitimately sit on the gavel head, and fail if
 * a dense cluster survives out near an edge. A sliced glyph is a big connected
 * blob at the margin; a highlight is a handful of pixels in the middle.
 *
 * Usage: npm run check:brand
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Square, transparent marks only. Wide lockups legitimately contain white
// wordmark pixels out at the margins, so they are not checked here.
const MARKS = [
  'src/app/icon.png',
  'src/app/apple-icon.png',
  'public/gavelling-mark.png',
  'public/gavel-mark.png',
  'public/gavel-mark.webp',
];

/** Opaque + near-white. The wordmark is pure white; the artwork is brown/green. */
const ALPHA_MIN = 200;
const WHITE_MIN = 225;
/** Outside this central box, near-white opaque pixels are suspicious. */
const CORE = 0.62;
/** Below this many suspicious pixels it is specular highlights, not a glyph. */
const BLOB_MIN = 300;

let sharp;
try {
  sharp = (await import('sharp')).default;
} catch {
  console.error('check:brand — `sharp` is not installed; skipping (not a failure).');
  process.exit(0);
}

let failed = 0;

for (const rel of MARKS) {
  const abs = path.join(ROOT, rel);
  if (!existsSync(abs)) {
    console.error(`FAIL  ${rel} — missing`);
    failed++;
    continue;
  }

  const { data, info } = await sharp(readFileSync(abs))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width: w, height: h, channels: ch } = info;
  const x0 = w * (1 - CORE) / 2, x1 = w - x0;
  const y0 = h * (1 - CORE) / 2, y1 = h - y0;

  let outside = 0, minX = w, maxX = 0, minY = h, maxY = 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * ch;
      if (data[i + 3] < ALPHA_MIN) continue;
      if (data[i] < WHITE_MIN || data[i + 1] < WHITE_MIN || data[i + 2] < WHITE_MIN) continue;
      if (x >= x0 && x <= x1 && y >= y0 && y <= y1) continue; // central highlights
      outside++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  if (outside >= BLOB_MIN) {
    console.error(
      `FAIL  ${rel} — ${outside} opaque near-white px outside the centre, ` +
      `bbox x:${minX}-${maxX} y:${minY}-${maxY} (image ${w}x${h}).\n` +
      `      This is the signature of a wordmark sliced in by a square crop of the ` +
      `wide lockup.\n` +
      `      Rebuild the mark from src/app/icon.png. See public/README.md.`
    );
    failed++;
  } else {
    console.log(`ok    ${rel} (${w}x${h}, ${outside} stray px, under the ${BLOB_MIN} threshold)`);
  }
}

if (failed) {
  console.error(`\ncheck:brand — ${failed} mark(s) failed.`);
  process.exit(1);
}
console.log('\ncheck:brand — all marks clean.');
